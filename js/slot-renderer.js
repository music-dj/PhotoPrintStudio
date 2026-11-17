/**
 * PhotoPrint Studio - Unified Slot Renderer Engine
 * Guarantees 100% Pixel-Perfect WYSIWYG consistency between Screen Preview and 300 DPI Export.
 */

class SlotRenderer {
    /**
     * Compute render parameters for an image inside a box
     */
    static computeTransform(boxW, boxH, imgW, imgH, slotState) {
        const rotation = slotState.rotation || 0;
        const isRotated90 = Math.abs(rotation % 180) === 90;

        // Effective dimensions after rotation
        const effW = isRotated90 ? imgH : imgW;
        const effH = isRotated90 ? imgW : imgH;

        // Base scale:
        // 'cover': fills the box completely to edges (standard for photo printing)
        // 'contain': fits entire image inside box with letterboxing
        const fitMode = slotState.fitMode || 'cover';
        const scaleCover = Math.max(boxW / effW, boxH / effH);
        const scaleContain = Math.min(boxW / effW, boxH / effH);
        const baseScale = fitMode === 'contain' ? scaleContain : scaleCover;

        // User zoom multiplier (1.0 = 100% base fit)
        const userZoom = slotState.zoom !== undefined ? slotState.zoom : 1.0;
        const finalScale = baseScale * userZoom;

        const drawW = imgW * finalScale;
        const drawH = imgH * finalScale;

        // Pan offsets: panRatio is normalized relative to slot dimensions (-1.0 to 1.0)
        const panX = (slotState.panRatioX || 0) * boxW;
        const panY = (slotState.panRatioY || 0) * boxH;

        return {
            drawW,
            drawH,
            panX,
            panY,
            rotation
        };
    }

    /**
     * Render a slot onto any 2D canvas context (Screen preview or 300 DPI high-res canvas)
     * @param {CanvasRenderingContext2D} ctx - Target 2D context
     * @param {Object} options - Slot rendering options
     */
    static renderSlot(ctx, options) {
        const {
            x = 0,
            y = 0,
            width,
            height,
            imageObj = null,
            slotState = {},
            border = null,
            isExport = false
        } = options;

        if (width <= 0 || height <= 0) return;

        ctx.save();

        // 1. Setup Clipping to Slot Boundaries (so zoomed image NEVER leaks outside)
        const borderRadius = (border && border.enabled && border.radiusPx) ? border.radiusPx : 0;
        ctx.beginPath();
        if (borderRadius > 0 && typeof ctx.roundRect === 'function') {
            ctx.roundRect(x, y, width, height, borderRadius);
        } else {
            ctx.rect(x, y, width, height);
        }
        ctx.clip();

        // 2. White Paper Surface
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(x, y, width, height);

        // 3. Draw Image if present
        if (imageObj && imageObj.width && imageObj.height) {
            const transform = this.computeTransform(
                width,
                height,
                imageObj.naturalWidth || imageObj.width,
                imageObj.naturalHeight || imageObj.height,
                slotState
            );

            ctx.save();
            // Center of the slot + user pan offset
            const centerX = x + width / 2 + transform.panX;
            const centerY = y + height / 2 + transform.panY;

            ctx.translate(centerX, centerY);

            if (transform.rotation !== 0) {
                ctx.rotate(transform.rotation * Math.PI / 180);
            }

            // High quality smoothing
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';

            // Draw image centered at origin
            ctx.drawImage(
                imageObj,
                -transform.drawW / 2,
                -transform.drawH / 2,
                transform.drawW,
                transform.drawH
            );

            ctx.restore();
        } else if (!isExport) {
            // Draw empty subtle grid pattern for preview if no image
            ctx.save();
            ctx.fillStyle = '#F8FAFC';
            ctx.fillRect(x, y, width, height);
            ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.strokeRect(x + 1, y + 1, width - 2, height - 2);
            ctx.restore();
        }

        // 4. Draw Border / Frame on top of image
        if (border && border.enabled && border.widthPx > 0) {
            ctx.save();
            ctx.strokeStyle = border.color || '#000000';
            ctx.lineWidth = border.widthPx;
            const half = border.widthPx / 2;

            ctx.beginPath();
            if (borderRadius > 0 && typeof ctx.roundRect === 'function') {
                ctx.roundRect(
                    x + half,
                    y + half,
                    width - border.widthPx,
                    height - border.widthPx,
                    Math.max(0, borderRadius - half)
                );
            } else {
                ctx.strokeRect(
                    x + half,
                    y + half,
                    width - border.widthPx,
                    height - border.widthPx
                );
            }
            ctx.stroke();
            ctx.restore();
        }

        ctx.restore();
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SlotRenderer };
}
