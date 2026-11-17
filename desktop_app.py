"""
PhotoPrint Studio - Windows Desktop Application Entry Point
Native Desktop Window + Native File I/O Save/Load Bridge
"""

import os
import sys
import threading
import http.server
import socketserver
import time
import json
import subprocess
import webbrowser
import api_handler

# Resource directory detection (supports PyInstaller --onefile)
if getattr(sys, 'frozen', False):
    BASE_DIR = sys._MEIPASS
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))

class DesktopAppServerHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def log_message(self, format, *args):
        pass

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', 0))
        post_body = self.rfile.read(content_length).decode('utf-8')
        
        try:
            data = json.loads(post_body) if post_body else {}
        except Exception:
            data = {}

        result = {"success": False, "error": "Unknown endpoint"}
        
        try:
            if self.path == '/api/save-image':
                result = api_handler.save_image_from_base64(data)
            elif self.path == '/api/save-project':
                result = api_handler.save_project_json(data)
            elif self.path == '/api/open-project':
                result = api_handler.open_project_file()
            elif self.path == '/api/reveal-file':
                result = api_handler.reveal_in_explorer(data.get('path', ''))
        except Exception as e:
            result = {"success": False, "error": str(e)}

        self.send_response(200)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(result).encode('utf-8'))

def find_free_port():
    import socket
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.bind(('127.0.0.1', 0))
    port = s.getsockname()[1]
    s.close()
    return port

def run_server(port, stop_event):
    with socketserver.TCPServer(('127.0.0.1', port), DesktopAppServerHandler) as httpd:
        httpd.timeout = 1
        while not stop_event.is_set():
            httpd.handle_request()

def open_fallback_browser(url):
    edge_paths = [
        os.path.expandvars(r"%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"),
        os.path.expandvars(r"%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"),
        os.path.expandvars(r"%LocalAppData%\Microsoft\Edge\Application\msedge.exe")
    ]
    for ep in edge_paths:
        if os.path.exists(ep):
            try:
                proc = subprocess.Popen([ep, f"--app={url}"])
                proc.wait()
                return
            except Exception:
                pass
    
    webbrowser.open(url)

def main():
    port = find_free_port()
    stop_event = threading.Event()
    
    server_thread = threading.Thread(target=run_server, args=(port, stop_event), daemon=True)
    server_thread.start()
    
    time.sleep(0.3)
    app_url = f"http://127.0.0.1:{port}/index.html"
    
    try:
        import webview
        icon_path = os.path.join(BASE_DIR, "app_icon.ico")
        if not os.path.exists(icon_path):
            icon_path = None

        window = webview.create_window(
            title="استوديو دمج وطباعة الصور A4 / A5 / A6 - PhotoPrint Studio",
            url=app_url,
            width=1280,
            height=850,
            min_size=(900, 600),
            resizable=True,
            text_select=True,
            confirm_close=False
        )
        
        webview.start(debug=False, icon=icon_path)
    except Exception as e:
        open_fallback_browser(app_url)
    finally:
        stop_event.set()

if __name__ == "__main__":
    main()
