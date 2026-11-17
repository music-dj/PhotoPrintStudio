"""
PhotoPrint Studio - Native File System API Handler
Handles native Windows Save As and Open dialogs via HTTP API
"""

import os
import json
import base64
import subprocess
import tkinter as tk
from tkinter import filedialog

def prompt_save_file(default_name, filetypes):
    """Open native Windows Save File dialog on top"""
    root = tk.Tk()
    root.withdraw()
    root.attributes("-topmost", True)
    
    # Extract default extension from first filetype (e.g. "*.png" -> ".png")
    ext = ""
    if filetypes and len(filetypes) > 0:
        raw_ext = filetypes[0][1]
        if raw_ext.startswith("*."):
            ext = raw_ext[1:]

    # Initial directory: Desktop or Pictures
    init_dir = os.path.join(os.path.expanduser("~"), "Pictures")
    if not os.path.exists(init_dir):
        init_dir = os.path.join(os.path.expanduser("~"), "Desktop")

    path = filedialog.asksaveasfilename(
        parent=root,
        title="حفظ الملف باسم",
        initialdir=init_dir,
        initialfile=default_name,
        filetypes=filetypes,
        defaultextension=ext
    )
    root.destroy()
    return path

def prompt_open_file(filetypes):
    """Open native Windows Open File dialog on top"""
    root = tk.Tk()
    root.withdraw()
    root.attributes("-topmost", True)

    init_dir = os.path.join(os.path.expanduser("~"), "Documents")
    if not os.path.exists(init_dir):
        init_dir = os.path.join(os.path.expanduser("~"), "Desktop")

    path = filedialog.askopenfilename(
        parent=root,
        title="فتح مشروع سابق",
        initialdir=init_dir,
        filetypes=filetypes
    )
    root.destroy()
    return path

def save_image_from_base64(data_payload):
    """
    Receives { filename: str, data: str (base64) }
    Saves image to selected path
    """
    filename = data_payload.get("filename", "photoprint_a4.png")
    data_uri = data_payload.get("data", "")
    
    # Strip data URL header (e.g. data:image/png;base64,...)
    if "," in data_uri:
        header, b64_str = data_uri.split(",", 1)
    else:
        b64_str = data_uri

    is_jpg = "image/jpeg" in data_uri or filename.lower().endswith(".jpg") or filename.lower().endswith(".jpeg")
    if is_jpg:
        filetypes = [("صورة JPEG", "*.jpg;*.jpeg"), ("صورة PNG", "*.png"), ("جميع الملفات", "*.*")]
    else:
        filetypes = [("صورة PNG", "*.png"), ("صورة JPEG", "*.jpg;*.jpeg"), ("جميع الملفات", "*.*")]

    target_path = prompt_save_file(filename, filetypes)
    if not target_path:
        return {"success": False, "cancelled": True}

    binary_data = base64.b64decode(b64_str)
    with open(target_path, "wb") as f:
        f.write(binary_data)

    return {
        "success": True,
        "path": target_path,
        "size": len(binary_data),
        "filename": os.path.basename(target_path)
    }

def save_project_json(data_payload):
    """
    Receives { filename: str, content: str }
    Saves project to .photoprint file
    """
    filename = data_payload.get("filename", "project.photoprint")
    content = data_payload.get("content", "{}")

    filetypes = [
        ("مشروع PhotoPrint", "*.photoprint"),
        ("ملف JSON", "*.json"),
        ("جميع الملفات", "*.*")
    ]

    target_path = prompt_save_file(filename, filetypes)
    if not target_path:
        return {"success": False, "cancelled": True}

    with open(target_path, "w", encoding="utf-8") as f:
        f.write(content)

    return {
        "success": True,
        "path": target_path,
        "filename": os.path.basename(target_path)
    }

def open_project_file():
    """
    Opens file dialog, loads and returns project JSON
    """
    filetypes = [
        ("مشروع PhotoPrint", "*.photoprint"),
        ("ملف JSON", "*.json"),
        ("جميع الملفات", "*.*")
    ]

    target_path = prompt_open_file(filetypes)
    if not target_path:
        return {"success": False, "cancelled": True}

    with open(target_path, "r", encoding="utf-8") as f:
        content = f.read()

    return {
        "success": True,
        "path": target_path,
        "filename": os.path.basename(target_path),
        "content": content
    }

def reveal_in_explorer(path):
    """Highlight file in Windows Explorer"""
    if os.path.exists(path):
        subprocess.Popen(f'explorer /select,"{os.path.abspath(path)}"')
        return {"success": True}
    return {"success": False, "error": "File not found"}
