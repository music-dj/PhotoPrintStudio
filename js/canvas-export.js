/**
 * PhotoPrint Studio - High Resolution Canvas Export Engine
 * Generates true 300 DPI / 150 DPI print-ready images matching exact millimeter dimensions.
 * Uses unified SlotRenderer for 100% WYSIWYG parity with the on-screen preview.
 */

class HighResExporter {
    /**
     * Render the sheet to a high-resolution canvas
     * @param {Object} state - Full application state
     * @param {number} dpi - Target DPI (default 300)
     * @returns {Promise<HTMLCanvasElement>}
     */
    static async renderToCanvas(state, dpi = 300) {
        const { orientation, slots, globalBorder } = state;
        const paper = A4_DIMENSIONS[orientation];
        
        // 1 inch = 25.4 mm
        const pxPerMm = dpi / 25.4;
        const canvasW = Math.round(paper.widthMm * pxPerMm);
        const canvasH = Math.round(paper.heightMm * pxPerMm);

        const canvas = document.createElement('canvas');
        canvas.width = canvasW;
        canvas.height = canvasH;
        const ctx = canvas.getContext('2d');

        // High quality smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // 1. Draw Paper Background (Pure White)
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvasW, canvasH);

        // Compute slot bounds
        const layoutResult = LayoutEngine.computeSlots(state);

        // Helper to load image object
        const loadImage = (src) => {
            return new Promise((resolve) => {
                if (!src) return resolve(null);
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = () => resolve(img);
                img.onerror = () => resolve(null);
                img.src = src;
            });
        };

        // Render each slot using the unified SlotRenderer
        for (const slotDef of layoutResult.slots) {
            const slotState = slots[slotDef.id] || {};
            
            // Per-slot margin overrides or defaults (in mm)
            const slotMargin = slotState.margin || { top: 0, right: 0, bottom: 0, left: 0 };
            
            // Slot bounds in mm
            const sX_mm = slotDef.xMm + (slotMargin.left || 0);
            const sY_mm = slotDef.yMm + (slotMargin.top || 0);
            const sW_mm = Math.max(1, slotDef.wMm - ((slotMargin.left || 0) + (slotMargin.right || 0)));
            const sH_mm = Math.max(1, slotDef.hMm - ((slotMargin.top || 0) + (slotMargin.bottom || 0)));

            // Convert to high-resolution pixels
            const sX_px = sX_mm * pxPerMm;
            const sY_px = sY_mm * pxPerMm;
            const sW_px = sW_mm * pxPerMm;
            const sH_px = sH_mm * pxPerMm;

            // Determine border settings
            const borderConfig = slotState.borderOverride || globalBorder || { enabled: false };
            const borderWidthPx = borderConfig.enabled ? (borderConfig.widthMm || 1) * pxPerMm : 0;
            const borderRadiusPx = (borderConfig.radiusMm || 0) * pxPerMm;

            let imgObj = null;
            if (slotState.image) {
                imgObj = await loadImage(slotState.image);
            }

            // Render slot using exact same logic as screen preview
            SlotRenderer.renderSlot(ctx, {
                x: sX_px,
                y: sY_px,
                width: sW_px,
                height: sH_px,
                imageObj: imgObj,
                slotState: slotState,
                border: {
                    enabled: borderConfig.enabled,
                    widthPx: borderWidthPx,
                    radiusPx: borderRadiusPx,
                    color: borderConfig.color || '#000000'
                },
                isExport: true
            });
        }

        return canvas;
    }

    /**
     * Download or save canvas as high-resolution PNG or JPEG
     * Works natively in Desktop App (.exe) and in standard browsers
     */
    static async downloadImage(state, format = 'png', dpi = 300, filename = 'photoprint_a4') {
        const canvas = await this.renderToCanvas(state, dpi);
        const mimeType = format === 'jpeg' || format === 'jpg' ? 'image/jpeg' : 'image/png';
        const quality = 0.95;
        const fullFileName = `${filename}_${dpi}dpi.${format}`;

        // Get Base64 Data URL
        const dataUrl = canvas.toDataURL(mimeType, quality);

        // 1. Try Native Desktop/Server API (Works in PhotoPrintStudio.exe & server.py)
        try {
            const response = await fetch('/api/save-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: fullFileName, data: dataUrl })
            });

            if (response.ok) {
                const res = await response.json();
                if (res.success) {
                    if (window.showAppToast) {
                        window.showAppToast(`تم حفظ الصورة بنجاح: ${res.filename}`, res.path);
                    }
                    return true;
                } else if (res.cancelled) {
                    return false;
                }
            }
        } catch (e) {
            // Server API not reachable (running as raw file://), continue to browser methods
        }

        // 2. Try Chromium File System Access API
        if (window.showSaveFilePicker) {
            try {
                const blob = await new Promise(resolve => canvas.toBlob(resolve, mimeType, quality));
                const handle = await window.showSaveFilePicker({
                    suggestedName: fullFileName,
                    types: [{
                        description: format.toUpperCase() + ' Image',
                        accept: { [mimeType]: ['.' + format] }
                    }]
                });
                const writable = await handle.createWritable();
                await writable.write(blob);
                await writable.close();
                if (window.showAppToast) {
                    window.showAppToast(`تم حفظ الصورة بنجاح: ${fullFileName}`);
                }
                return true;
            } catch (err) {
                if (err.name === 'AbortError') return false;
            }
        }

        // 3. Fallback to standard Blob URL download
        return new Promise((resolve) => {
            canvas.toBlob((blob) => {
                if (!blob) return resolve(false);
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = fullFileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(() => URL.revokeObjectURL(url), 4000);
                if (window.showAppToast) {
                    window.showAppToast(`تم تصدير وتنزيل الصورة: ${fullFileName}`);
                }
                resolve(true);
            }, mimeType, quality);
        });
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { HighResExporter };
}
