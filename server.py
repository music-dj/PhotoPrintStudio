"""
PhotoPrint Studio - Local Server & Launcher with Native File I/O API
"""

import http.server
import socketserver
import webbrowser
import os
import sys
import json
import api_handler

PORT = 8080
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class AppServerHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

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

def run():
    os.chdir(DIRECTORY)
    port = PORT
    for attempt in range(10):
        try:
            with socketserver.TCPServer(("", port), AppServerHandler) as httpd:
                url = f"http://localhost:{port}/index.html"
                print("=" * 60)
                print("  استوديو دمج وطباعة الصور A4 / A5 / A6 - قيد التشغيل")
                print(f"  الرابط: {url}")
                print("=" * 60)
                print("  اضغط Ctrl+C لإيقاف الخادم.")
                webbrowser.open(url)
                httpd.serve_forever()
                break
        except OSError:
            port += 1
            continue

if __name__ == "__main__":
    try:
        run()
    except KeyboardInterrupt:
        print("\nتم إغلاق الاستوديو بنجاح.")
        sys.exit(0)
