# -*- mode: python ; coding: utf-8 -*-

import os

block_cipher = None

added_files = [
    ('index.html', '.'),
    ('css', 'css'),
    ('js', 'js'),
    ('assets', 'assets'),
    ('app_icon.ico', '.'),
    ('app_icon.png', '.'),
]

a = Analysis(
    ['desktop_app.py'],
    pathex=[],
    binaries=[],
    datas=added_files,
    hiddenimports=[
        'webview',
        'webview.platforms.winforms',
        'clr',
        'clr_loader',
        'pythonnet',
        'http.server',
        'socketserver',
        'tkinter',
        'tkinter.filedialog',
        'api_handler'
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='PhotoPrintStudio',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon='app_icon.ico',
)
