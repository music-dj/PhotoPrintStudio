/**
 * PhotoPrint Studio - Core Application Logic
 * Professional A4/A5/A6 Multi-Photo Grid & Layout Engine
 * 100% WYSIWYG Parity between On-Screen Canvas and High-Resolution 300 DPI Export
 */

(function () {
    'use strict';

    // Global Toast Notification System
    window.showAppToast = function (message, filePath) {
        let toast = document.getElementById('appToast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'appToast';
            toast.className = 'app-toast';
            document.body.appendChild(toast);
        }

        let revealBtnHtml = '';
        if (filePath) {
            const escapedPath = filePath.replace(/\\/g, '\\\\');
            revealBtnHtml = `<button class="toast-btn" onclick="window.revealSavedFile('${escapedPath}')">عرض في المجلد</button>`;
        }

        toast.innerHTML = `
            <div class="toast-content">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
                <span class="toast-msg">${message}</span>
            </div>
            ${revealBtnHtml}
        `;

        toast.classList.add('is-visible');
        if (window._toastTimer) clearTimeout(window._toastTimer);
        window._toastTimer = setTimeout(() => {
            toast.classList.remove('is-visible');
        }, 6000);
    };

    window.revealSavedFile = async function (filePath) {
        try {
            await fetch('/api/reveal-file', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: filePath })
            });
        } catch (e) {
            console.error('Could not reveal file:', e);
        }
    };

    // Application state
    const state = {
        orientation: 'portrait',     // 'portrait' | 'landscape'
        layoutId: '2-split',         // preset layout ID
        customRows: 2,
        customCols: 2,
        sheetMargins: { top: 3, right: 3, bottom: 3, left: 3 }, // 3mm standard default
        marginsLinked: true,
        slotGap: 3,                  // 3mm standard default
        globalBorder: {
            enabled: false,
            widthMm: 1.5,
            color: '#000000',
            radiusMm: 0
        },
        slots: {},                   // slotId -> slot data
        selectedSlotId: null,
        zoomPreview: 'fit',          // 'fit' | 0.5 | 0.75 | 1.0
        isDraggingImage: false,
        dragStart: { x: 0, y: 0 },
        initialPan: { x: 0, y: 0 }
    };

    // Cache loaded Image objects for instant high-speed canvas drawing
    const imageCache = new Map();

    function getOrCreateImage(slotId, dataUrl) {
        return new Promise((resolve) => {
            if (!dataUrl) {
                imageCache.delete(slotId);
                return resolve(null);
            }
            if (imageCache.has(slotId)) {
                const cached = imageCache.get(slotId);
                if (cached.src === dataUrl && cached.complete && cached.naturalWidth > 0) {
                    return resolve(cached);
                }
            }
            const img = new Image();
            img.onload = () => {
                imageCache.set(slotId, img);
                resolve(img);
            };
            img.onerror = () => {
                imageCache.delete(slotId);
                resolve(null);
            };
            img.src = dataUrl;
        });
    }

    // DOM Elements Cache
    const el = {};

    function initElements() {
        el.sheetWrapper = document.getElementById('sheetWrapper');
        el.sheetPaper = document.getElementById('sheetPaper');
        el.slotsContainer = document.getElementById('slotsContainer');
        el.orientationPortrait = document.getElementById('btnOrientPortrait');
        el.orientationLandscape = document.getElementById('btnOrientLandscape');
        el.layoutSelect = document.getElementById('layoutSelect');
        el.customGridControls = document.getElementById('customGridControls');
        el.inputCustomRows = document.getElementById('customRows');
        el.inputCustomCols = document.getElementById('customCols');
        
        // Margins
        el.marginLinkBtn = document.getElementById('marginLinkBtn');
        el.marginAll = document.getElementById('marginAll');
        el.marginTop = document.getElementById('marginTop');
        el.marginRight = document.getElementById('marginRight');
        el.marginBottom = document.getElementById('marginBottom');
        el.marginLeft = document.getElementById('marginLeft');
        el.slotGap = document.getElementById('slotGap');
        
        // Border
        el.borderToggle = document.getElementById('borderToggle');
        el.borderOptions = document.getElementById('borderOptions');
        el.borderWidth = document.getElementById('borderWidth');
        el.borderColor = document.getElementById('borderColor');
        el.borderRadius = document.getElementById('borderRadius');
        
        // Floating toolbar & Selected slot inspector
        el.selectedSlotPanel = document.getElementById('selectedSlotPanel');
        el.slotInfoBadge = document.getElementById('slotInfoBadge');
        el.slotZoomSlider = document.getElementById('slotZoomSlider');
        el.slotZoomVal = document.getElementById('slotZoomVal');
        el.slotRotationVal = document.getElementById('slotRotationVal');
        el.btnRotateCw = document.getElementById('btnRotateCw');
        el.btnRotateCcw = document.getElementById('btnRotateCcw');
        el.btnResetPanZoom = document.getElementById('btnResetPanZoom');
        el.btnFitCover = document.getElementById('btnFitCover');
        el.btnFitContain = document.getElementById('btnFitContain');
        el.btnRemoveImage = document.getElementById('btnRemoveImage');
        el.btnChangeImage = document.getElementById('btnChangeImage');
        el.fileInputSlot = document.getElementById('fileInputSlot');
        el.fileInputMultiple = document.getElementById('fileInputMultiple');
        el.fileInputProject = document.getElementById('fileInputProject');

        // Slot Margin Override
        el.slotMarginTop = document.getElementById('slotMarginTop');
        el.slotMarginRight = document.getElementById('slotMarginRight');
        el.slotMarginBottom = document.getElementById('slotMarginBottom');
        el.slotMarginLeft = document.getElementById('slotMarginLeft');

        // Top actions
        el.btnClearAll = document.getElementById('btnClearAll');
        el.btnSaveProject = document.getElementById('btnSaveProject');
        el.btnLoadProject = document.getElementById('btnLoadProject');
        el.btnExportModal = document.getElementById('btnExportModal');
        el.btnPrintDirect = document.getElementById('btnPrintDirect');

        // Modals
        el.exportModal = document.getElementById('exportModal');
        el.confirmModal = document.getElementById('confirmModal');
        el.paperDimensionsLabel = document.getElementById('paperDimensionsLabel');
    }

    /**
     * Initialize Layout Preset Options
     */
    function initLayoutPresets() {
        el.layoutSelect.innerHTML = '';
        PRESET_LAYOUTS.forEach(preset => {
            const opt = document.createElement('option');
            opt.value = preset.id;
            opt.textContent = `${preset.name}`;
            if (preset.id === state.layoutId) opt.selected = true;
            el.layoutSelect.appendChild(opt);
        });

        const customOpt = document.createElement('option');
        customOpt.value = 'custom';
        customOpt.textContent = '⚙️ تقسيم مخصص (صفوف × أعمدة)';
        el.layoutSelect.appendChild(customOpt);
    }

    /**
     * Ensure slot state exists with defaults
     */
    function getSlotState(slotId) {
        if (!state.slots[slotId]) {
            state.slots[slotId] = {
                image: null,
                fileName: '',
                zoom: 1.0,
                rotation: 0,
                panRatioX: 0,
                panRatioY: 0,
                margin: { top: 0, right: 0, bottom: 0, left: 0 },
                fitMode: 'cover' // default clean cover to edges
            };
        }
        return state.slots[slotId];
    }

    /**
     * Draw slot onto its preview canvas using the unified SlotRenderer
     */
    function drawSlotCanvas(slotId) {
        const slotEl = document.getElementById(`dom-${slotId}`);
        if (!slotEl) return;
        const canvas = document.getElementById(`canvas-${slotId}`);
        if (!canvas) return;

        const layoutResult = LayoutEngine.computeSlots(state);
        const slotDef = layoutResult.slots.find(s => s.id === slotId);
        if (!slotDef) return;

        const slotData = getSlotState(slotId);
        const borderCfg = slotData.borderOverride || state.globalBorder;

        // Scale factor for crisp screen preview (2.5x resolution)
        const pxScale = 3.7795 * 2.5;
        const sMargin = slotData.margin || { top: 0, right: 0, bottom: 0, left: 0 };
        const widthMm = Math.max(1, slotDef.wMm - ((sMargin.left || 0) + (sMargin.right || 0)));
        const heightMm = Math.max(1, slotDef.hMm - ((sMargin.top || 0) + (sMargin.bottom || 0)));

        const canvasW = Math.round(widthMm * pxScale);
        const canvasH = Math.round(heightMm * pxScale);

        if (canvas.width !== canvasW || canvas.height !== canvasH) {
            canvas.width = canvasW;
            canvas.height = canvasH;
        }

        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvasW, canvasH);

        const imgObj = imageCache.get(slotId);

        SlotRenderer.renderSlot(ctx, {
            x: 0,
            y: 0,
            width: canvasW,
            height: canvasH,
            imageObj: imgObj,
            slotState: slotData,
            border: {
                enabled: borderCfg.enabled,
                widthPx: borderCfg.enabled ? borderCfg.widthMm * pxScale : 0,
                radiusPx: (borderCfg.radiusMm || 0) * pxScale,
                color: borderCfg.color || '#000000'
            },
            isExport: false
        });
    }

    /**
     * Render the A4 Sheet and its Slots
     */
    function renderSheet() {
        const layoutResult = LayoutEngine.computeSlots(state);
        const { paper, slots } = layoutResult;

        // Update Paper Dimensions Info
        el.paperDimensionsLabel.textContent = `ورقة A4 (${paper.widthMm} × ${paper.heightMm} مم) - الهوامش القياسية 3 مم`;

        // Update Sheet Paper DOM aspect ratio
        el.sheetPaper.setAttribute('data-orientation', state.orientation);
        if (state.orientation === 'portrait') {
            el.sheetPaper.style.width = '210mm';
            el.sheetPaper.style.height = '297mm';
        } else {
            el.sheetPaper.style.width = '297mm';
            el.sheetPaper.style.height = '210mm';
        }

        // Render Slots
        el.slotsContainer.innerHTML = '';

        slots.forEach((slotDef) => {
            const slotData = getSlotState(slotDef.id);
            const isSelected = state.selectedSlotId === slotDef.id;

            // Slot Container element
            const slotEl = document.createElement('div');
            slotEl.className = `paper-slot ${isSelected ? 'is-selected' : ''} ${slotData.image ? 'has-image' : 'is-empty'}`;
            slotEl.id = `dom-${slotDef.id}`;
            slotEl.dataset.slotId = slotDef.id;

            // Positioning in millimeters
            const sMargin = slotData.margin || { top: 0, right: 0, bottom: 0, left: 0 };
            const leftMm = slotDef.xMm + (sMargin.left || 0);
            const topMm = slotDef.yMm + (sMargin.top || 0);
            const widthMm = Math.max(1, slotDef.wMm - ((sMargin.left || 0) + (sMargin.right || 0)));
            const heightMm = Math.max(1, slotDef.hMm - ((sMargin.top || 0) + (sMargin.bottom || 0)));

            slotEl.style.left = `${leftMm}mm`;
            slotEl.style.top = `${topMm}mm`;
            slotEl.style.width = `${widthMm}mm`;
            slotEl.style.height = `${heightMm}mm`;

            // Border styling
            const borderCfg = slotData.borderOverride || state.globalBorder;
            if (borderCfg && borderCfg.enabled) {
                slotEl.style.border = `${borderCfg.widthMm}mm solid ${borderCfg.color}`;
                slotEl.style.borderRadius = `${borderCfg.radiusMm}mm`;
            } else {
                slotEl.style.border = '1px dashed rgba(148, 163, 184, 0.45)';
                slotEl.style.borderRadius = '0';
            }

            // High Precision Preview Canvas
            const canvas = document.createElement('canvas');
            canvas.className = 'slot-preview-canvas';
            canvas.id = `canvas-${slotDef.id}`;
            slotEl.appendChild(canvas);

            if (slotData.image) {
                // Slot badge indicating size and index
                const badge = document.createElement('div');
                badge.className = 'slot-badge';
                badge.textContent = `#${slotDef.index + 1} (${Math.round(widthMm)}×${Math.round(heightMm)}mm)`;
                slotEl.appendChild(badge);

                // Load image into cache and draw
                getOrCreateImage(slotDef.id, slotData.image).then(() => {
                    drawSlotCanvas(slotDef.id);
                });
            } else {
                // Empty placeholder
                const emptyWrap = document.createElement('div');
                emptyWrap.className = 'slot-empty-placeholder';
                emptyWrap.innerHTML = `
                    <div class="empty-icon">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                            <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
                            <circle cx="9" cy="9" r="2"/>
                            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
                        </svg>
                    </div>
                    <span class="empty-text">تقسيم #${slotDef.index + 1}</span>
                    <span class="empty-subtext">اسحب وأفلت صورة هنا أو انقر للاختيار</span>
                    <span class="empty-dim">${Math.round(widthMm)} × ${Math.round(heightMm)} مم</span>
                `;
                slotEl.appendChild(emptyWrap);
                drawSlotCanvas(slotDef.id);
            }

            // Selection and Interaction Listeners
            attachSlotEvents(slotEl, slotDef.id);

            el.slotsContainer.appendChild(slotEl);
        });

        updateSelectedSlotInspector();
        updatePreviewScale();
    }

    /**
     * Attach Drag-and-Drop and Mouse Interaction Events to Slot
     */
    function attachSlotEvents(slotEl, slotId) {
        // Click to Select
        slotEl.addEventListener('click', (e) => {
            e.stopPropagation();
            selectSlot(slotId);
        });

        // Double click to trigger file upload if empty
        slotEl.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            selectSlot(slotId);
            el.fileInputSlot.click();
        });

        // Drag & Drop Image Files from Windows / Explorer
        slotEl.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            slotEl.classList.add('drag-hover');
        });

        slotEl.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            slotEl.classList.remove('drag-hover');
        });

        slotEl.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            slotEl.classList.remove('drag-hover');

            const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
            if (files.length === 0) return;

            selectSlot(slotId);

            if (files.length === 1) {
                loadSingleImageIntoSlot(files[0], slotId);
            } else {
                loadMultipleImages(files, slotId);
            }
        });

        // Mouse Wheel Zoom inside slot
        slotEl.addEventListener('wheel', (e) => {
            const slotData = getSlotState(slotId);
            if (!slotData.image) return;

            e.preventDefault();
            const delta = e.deltaY < 0 ? 0.05 : -0.05;
            let newZoom = Math.min(5.0, Math.max(0.2, (slotData.zoom || 1.0) + delta));
            slotData.zoom = parseFloat(newZoom.toFixed(2));
            drawSlotCanvas(slotId);
            updateSelectedSlotInspector();
        }, { passive: false });

        // Pan Image with Mouse Drag inside slot
        slotEl.addEventListener('mousedown', (e) => {
            const slotData = getSlotState(slotId);
            if (!slotData.image || e.button !== 0) return;

            selectSlot(slotId);
            state.isDraggingImage = true;
            state.dragStart = { x: e.clientX, y: e.clientY };
            state.initialPan = {
                x: slotData.panRatioX || 0,
                y: slotData.panRatioY || 0
            };

            slotEl.classList.add('is-panning');

            const onMouseMove = (moveEvent) => {
                if (!state.isDraggingImage) return;
                const rect = slotEl.getBoundingClientRect();
                const deltaX = (moveEvent.clientX - state.dragStart.x) / rect.width;
                const deltaY = (moveEvent.clientY - state.dragStart.y) / rect.height;

                slotData.panRatioX = state.initialPan.x + deltaX;
                slotData.panRatioY = state.initialPan.y + deltaY;

                drawSlotCanvas(slotId);
            };

            const onMouseUp = () => {
                state.isDraggingImage = false;
                slotEl.classList.remove('is-panning');
                window.removeEventListener('mousemove', onMouseMove);
                window.removeEventListener('mouseup', onMouseUp);
            };

            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
        });
    }

    /**
     * Select a slot and display inspector
     */
    function selectSlot(slotId) {
        state.selectedSlotId = slotId;

        document.querySelectorAll('.paper-slot').forEach(el => {
            el.classList.toggle('is-selected', el.dataset.slotId === slotId);
        });

        updateSelectedSlotInspector();
    }

    /**
     * Update Inspector Controls for Selected Slot
     */
    function updateSelectedSlotInspector() {
        if (!state.selectedSlotId) {
            el.selectedSlotPanel.classList.add('is-disabled');
            el.slotInfoBadge.textContent = 'لم يتم تحديد أي تقسيم';
            return;
        }

        el.selectedSlotPanel.classList.remove('is-disabled');
        const slotData = getSlotState(state.selectedSlotId);
        const slotDef = LayoutEngine.computeSlots(state).slots.find(s => s.id === state.selectedSlotId);

        el.slotInfoBadge.textContent = `التقسيم المحدد #${slotDef ? slotDef.index + 1 : ''} ${slotData.image ? '(يحتوي على صورة)' : '(فارغ)'}`;

        // Controls
        el.slotZoomSlider.value = slotData.zoom || 1.0;
        el.slotZoomVal.textContent = `${Math.round((slotData.zoom || 1.0) * 100)}%`;
        el.slotRotationVal.textContent = `${slotData.rotation || 0}°`;

        // Per slot margin inputs
        const sm = slotData.margin || { top: 0, right: 0, bottom: 0, left: 0 };
        el.slotMarginTop.value = sm.top || 0;
        el.slotMarginRight.value = sm.right || 0;
        el.slotMarginBottom.value = sm.bottom || 0;
        el.slotMarginLeft.value = sm.left || 0;

        el.btnRemoveImage.disabled = !slotData.image;
        el.btnResetPanZoom.disabled = !slotData.image;
        el.btnRotateCw.disabled = !slotData.image;
        el.btnRotateCcw.disabled = !slotData.image;
        el.slotZoomSlider.disabled = !slotData.image;
    }

    /**
     * Load image file into a slot as Base64 Data URL
     */
    function loadSingleImageIntoSlot(file, slotId) {
        if (!file || !file.type.startsWith('image/')) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const slotData = getSlotState(slotId);
            slotData.image = e.target.result;
            slotData.fileName = file.name;
            slotData.zoom = 1.0;
            slotData.rotation = 0;
            slotData.panRatioX = 0;
            slotData.panRatioY = 0;
            slotData.fitMode = 'cover';

            getOrCreateImage(slotId, slotData.image).then(() => {
                renderSheet();
                selectSlot(slotId);
            });
        };
        reader.readAsDataURL(file);
    }

    /**
     * Distribute multiple images across slots starting at startSlotId
     */
    function loadMultipleImages(files, startSlotId) {
        const layoutResult = LayoutEngine.computeSlots(state);
        const slotsList = layoutResult.slots;
        let startIndex = slotsList.findIndex(s => s.id === startSlotId);
        if (startIndex === -1) startIndex = 0;

        files.forEach((file, i) => {
            const targetSlotIndex = startIndex + i;
            if (targetSlotIndex < slotsList.length) {
                const targetSlot = slotsList[targetSlotIndex];
                loadSingleImageIntoSlot(file, targetSlot.id);
            }
        });
    }

    /**
     * Scale Preview so it fits nicely on screen
     */
    function updatePreviewScale() {
        if (!el.sheetWrapper || !el.sheetPaper) return;

        if (state.zoomPreview === 'fit') {
            const wrapperW = el.sheetWrapper.clientWidth - 48;
            const wrapperH = el.sheetWrapper.clientHeight - 48;

            const paperW_mm = state.orientation === 'portrait' ? 210 : 297;
            const paperH_mm = state.orientation === 'portrait' ? 297 : 210;

            const approxW = paperW_mm * 3.7795;
            const approxH = paperH_mm * 3.7795;

            const scaleX = wrapperW / approxW;
            const scaleY = wrapperH / approxH;
            const scale = Math.min(1.0, Math.min(scaleX, scaleY));

            el.sheetPaper.style.transform = `scale(${scale.toFixed(3)})`;
        } else {
            const scale = parseFloat(state.zoomPreview) || 1.0;
            el.sheetPaper.style.transform = `scale(${scale})`;
        }
    }

    /**
     * Setup Event Handlers for UI
     */
    function setupEventListeners() {
        // Paper Orientation (عمودي أو أفقي)
        el.orientationPortrait.addEventListener('click', () => {
            if (state.orientation === 'portrait') return;
            state.orientation = 'portrait';
            el.orientationPortrait.classList.add('active');
            el.orientationLandscape.classList.remove('active');
            renderSheet();
        });

        el.orientationLandscape.addEventListener('click', () => {
            if (state.orientation === 'landscape') return;
            state.orientation = 'landscape';
            el.orientationLandscape.classList.add('active');
            el.orientationPortrait.classList.remove('active');
            renderSheet();
        });

        // Layout Preset Selection
        el.layoutSelect.addEventListener('change', (e) => {
            state.layoutId = e.target.value;
            if (state.layoutId === 'custom') {
                el.customGridControls.classList.remove('hidden');
            } else {
                el.customGridControls.classList.add('hidden');
            }
            renderSheet();
        });

        // Custom Grid Inputs
        el.inputCustomRows.addEventListener('input', (e) => {
            state.customRows = Math.max(1, parseInt(e.target.value, 10) || 1);
            if (state.layoutId === 'custom') renderSheet();
        });

        el.inputCustomCols.addEventListener('input', (e) => {
            state.customCols = Math.max(1, parseInt(e.target.value, 10) || 1);
            if (state.layoutId === 'custom') renderSheet();
        });

        // Global Margins
        el.marginLinkBtn.addEventListener('click', () => {
            state.marginsLinked = !state.marginsLinked;
            el.marginLinkBtn.classList.toggle('active', state.marginsLinked);
            document.getElementById('marginsIndividualGroup').classList.toggle('hidden', state.marginsLinked);
            document.getElementById('marginLinkedGroup').classList.toggle('hidden', !state.marginsLinked);
        });

        el.marginAll.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value) || 0;
            state.sheetMargins = { top: val, right: val, bottom: val, left: val };
            el.marginTop.value = val;
            el.marginRight.value = val;
            el.marginBottom.value = val;
            el.marginLeft.value = val;
            renderSheet();
        });

        [
            { el: el.marginTop, side: 'top' },
            { el: el.marginRight, side: 'right' },
            { el: el.marginBottom, side: 'bottom' },
            { el: el.marginLeft, side: 'left' }
        ].forEach(({ el: input, side }) => {
            input.addEventListener('input', (e) => {
                state.sheetMargins[side] = parseFloat(e.target.value) || 0;
                renderSheet();
            });
        });

        el.slotGap.addEventListener('input', (e) => {
            state.slotGap = parseFloat(e.target.value) || 0;
            renderSheet();
        });

        // Global Border / Frame (برواز للصور)
        el.borderToggle.addEventListener('change', (e) => {
            state.globalBorder.enabled = e.target.checked;
            el.borderOptions.classList.toggle('hidden', !e.target.checked);
            renderSheet();
        });

        el.borderWidth.addEventListener('input', (e) => {
            state.globalBorder.widthMm = parseFloat(e.target.value) || 1;
            renderSheet();
        });

        el.borderColor.addEventListener('input', (e) => {
            state.globalBorder.color = e.target.value;
            renderSheet();
        });

        el.borderRadius.addEventListener('input', (e) => {
            state.globalBorder.radiusMm = parseFloat(e.target.value) || 0;
            renderSheet();
        });

        // Inspector Controls for Selected Slot
        el.slotZoomSlider.addEventListener('input', (e) => {
            if (!state.selectedSlotId) return;
            const slotData = getSlotState(state.selectedSlotId);
            slotData.zoom = parseFloat(e.target.value);
            el.slotZoomVal.textContent = `${Math.round(slotData.zoom * 100)}%`;
            drawSlotCanvas(state.selectedSlotId);
        });

        // Rotation (تدوير داخل التقسيم)
        el.btnRotateCw.addEventListener('click', () => {
            if (!state.selectedSlotId) return;
            const slotData = getSlotState(state.selectedSlotId);
            slotData.rotation = (slotData.rotation + 90) % 360;
            el.slotRotationVal.textContent = `${slotData.rotation}°`;
            drawSlotCanvas(state.selectedSlotId);
        });

        el.btnRotateCcw.addEventListener('click', () => {
            if (!state.selectedSlotId) return;
            const slotData = getSlotState(state.selectedSlotId);
            slotData.rotation = (slotData.rotation - 90 + 360) % 360;
            el.slotRotationVal.textContent = `${slotData.rotation}°`;
            drawSlotCanvas(state.selectedSlotId);
        });

        // Reset Pan & Zoom
        el.btnResetPanZoom.addEventListener('click', () => {
            if (!state.selectedSlotId) return;
            const slotData = getSlotState(state.selectedSlotId);
            slotData.zoom = 1.0;
            slotData.rotation = 0;
            slotData.panRatioX = 0;
            slotData.panRatioY = 0;
            slotData.fitMode = 'cover';
            drawSlotCanvas(state.selectedSlotId);
            updateSelectedSlotInspector();
        });

        // Fit Modes
        el.btnFitCover.addEventListener('click', () => {
            if (!state.selectedSlotId) return;
            const slotData = getSlotState(state.selectedSlotId);
            slotData.fitMode = 'cover';
            slotData.zoom = 1.0;
            slotData.panRatioX = 0;
            slotData.panRatioY = 0;
            drawSlotCanvas(state.selectedSlotId);
            updateSelectedSlotInspector();
        });

        el.btnFitContain.addEventListener('click', () => {
            if (!state.selectedSlotId) return;
            const slotData = getSlotState(state.selectedSlotId);
            slotData.fitMode = 'contain';
            slotData.zoom = 1.0;
            slotData.panRatioX = 0;
            slotData.panRatioY = 0;
            drawSlotCanvas(state.selectedSlotId);
            updateSelectedSlotInspector();
        });

        // Remove single image from selected slot
        el.btnRemoveImage.addEventListener('click', () => {
            if (!state.selectedSlotId) return;
            const slotData = getSlotState(state.selectedSlotId);
            slotData.image = null;
            slotData.fileName = '';
            imageCache.delete(state.selectedSlotId);
            renderSheet();
        });

        // Change image button
        el.btnChangeImage.addEventListener('click', () => {
            if (!state.selectedSlotId) return;
            el.fileInputSlot.click();
        });

        el.fileInputSlot.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0] && state.selectedSlotId) {
                loadSingleImageIntoSlot(e.target.files[0], state.selectedSlotId);
                e.target.value = '';
            }
        });

        // Per Slot Margin inputs
        [
            { el: el.slotMarginTop, side: 'top' },
            { el: el.slotMarginRight, side: 'right' },
            { el: el.slotMarginBottom, side: 'bottom' },
            { el: el.slotMarginLeft, side: 'left' }
        ].forEach(({ el: input, side }) => {
            input.addEventListener('input', (e) => {
                if (!state.selectedSlotId) return;
                const slotData = getSlotState(state.selectedSlotId);
                if (!slotData.margin) slotData.margin = { top: 0, right: 0, bottom: 0, left: 0 };
                slotData.margin[side] = parseFloat(e.target.value) || 0;
                renderSheet();
            });
        });

        // Deselect when clicking outside the paper sheet
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#sheetPaper') && !e.target.closest('#selectedSlotPanel')) {
                state.selectedSlotId = null;
                document.querySelectorAll('.paper-slot').forEach(s => s.classList.remove('is-selected'));
                updateSelectedSlotInspector();
            }
        });

        // Window resize keeps preview centered
        window.addEventListener('resize', () => {
            updatePreviewScale();
            // Re-draw all slot canvases to maintain sharp resolution
            Object.keys(state.slots).forEach(slotId => drawSlotCanvas(slotId));
        });

        // Preview zoom presets
        document.querySelectorAll('.btn-preview-zoom').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.btn-preview-zoom').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                state.zoomPreview = btn.dataset.zoom;
                updatePreviewScale();
            });
        });

        // ============================
        // CLEAR ALL / START OVER
        // ============================
        el.btnClearAll.addEventListener('click', () => {
            showConfirmModal(
                'حذف كل الصور والبدء من جديد؟',
                'سيتم مسح جميع الصور المضافة والرجوع إلى التقسيمات الفارغة.',
                () => {
                    Object.keys(state.slots).forEach(k => {
                        state.slots[k].image = null;
                        state.slots[k].fileName = '';
                    });
                    imageCache.clear();
                    state.selectedSlotId = null;
                    renderSheet();
                }
            );
        });

        // ============================
        // SAVE & LOAD PROJECT FILE (.photoprint JSON)
        // ============================
        function loadProjectStateFromJson(loaded) {
            if (loaded && loaded.state) {
                state.orientation = loaded.state.orientation || 'portrait';
                state.layoutId = loaded.state.layoutId || '2-split';
                state.customRows = loaded.state.customRows || 2;
                state.customCols = loaded.state.customCols || 2;
                state.sheetMargins = loaded.state.sheetMargins || { top: 3, right: 3, bottom: 3, left: 3 };
                state.slotGap = loaded.state.slotGap !== undefined ? loaded.state.slotGap : 3;
                state.globalBorder = loaded.state.globalBorder || { enabled: false, widthMm: 1.5, color: '#000000', radiusMm: 0 };
                state.slots = loaded.state.slots || {};
                state.selectedSlotId = null;

                // Sync UI controls
                syncControlsFromState();

                // Preload all images into cache
                const promises = [];
                Object.keys(state.slots).forEach(slotId => {
                    if (state.slots[slotId].image) {
                        promises.push(getOrCreateImage(slotId, state.slots[slotId].image));
                    }
                });

                Promise.all(promises).then(() => {
                    renderSheet();
                });
                return true;
            }
            return false;
        }

        el.btnSaveProject.addEventListener('click', async () => {
            const projectData = {
                app: 'PhotoPrintStudio',
                version: '1.0.0',
                createdAt: new Date().toISOString(),
                state: {
                    orientation: state.orientation,
                    layoutId: state.layoutId,
                    customRows: state.customRows,
                    customCols: state.customCols,
                    sheetMargins: state.sheetMargins,
                    slotGap: state.slotGap,
                    globalBorder: state.globalBorder,
                    slots: state.slots
                }
            };

            const jsonStr = JSON.stringify(projectData, null, 2);
            const defaultFilename = `مشروع_طباعة_صور_${Date.now()}.photoprint`;

            // 1. Try Native Desktop/Server API
            try {
                const response = await fetch('/api/save-project', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ filename: defaultFilename, content: jsonStr })
                });

                if (response.ok) {
                    const res = await response.json();
                    if (res.success) {
                        window.showAppToast(`تم حفظ المشروع بنجاح: ${res.filename}`, res.path);
                        return;
                    } else if (res.cancelled) {
                        return;
                    }
                }
            } catch (e) {}

            // 2. Try Chromium File System Access API
            if (window.showSaveFilePicker) {
                try {
                    const handle = await window.showSaveFilePicker({
                        suggestedName: defaultFilename,
                        types: [{
                            description: 'مشروع PhotoPrint',
                            accept: { 'application/json': ['.photoprint', '.json'] }
                        }]
                    });
                    const writable = await handle.createWritable();
                    await writable.write(jsonStr);
                    await writable.close();
                    window.showAppToast(`تم حفظ المشروع بنجاح!`);
                    return;
                } catch (err) {
                    if (err.name === 'AbortError') return;
                }
            }

            // 3. Fallback: <a download>
            const blob = new Blob([jsonStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = defaultFilename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 2000);
            window.showAppToast(`تم بدء تنزيل ملف المشروع!`);
        });

        el.btnLoadProject.addEventListener('click', async () => {
            // 1. Try Native Desktop/Server API
            try {
                const response = await fetch('/api/open-project', { method: 'POST' });
                if (response.ok) {
                    const res = await response.json();
                    if (res.success && res.content) {
                        const parsed = JSON.parse(res.content);
                        if (loadProjectStateFromJson(parsed)) {
                            window.showAppToast(`تم فتح المشروع بنجاح: ${res.filename}`);
                            return;
                        }
                    } else if (res.cancelled) {
                        return;
                    }
                }
            } catch (e) {}

            // 2. Fallback: HTML file input
            el.fileInputProject.click();
        });

        el.fileInputProject.addEventListener('change', (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const loaded = JSON.parse(event.target.result);
                    if (loadProjectStateFromJson(loaded)) {
                        window.showAppToast(`تم فتح المشروع بنجاح: ${file.name}`);
                    } else {
                        alert('الملف غير صالح لمشروع PhotoPrint');
                    }
                } catch (err) {
                    alert('خطأ أثناء قراءة ملف المشروع: ' + err.message);
                }
                e.target.value = '';
            };
            reader.readAsText(file);
        });

        // ============================
        // EXPORT MODAL & ACTIONS
        // ============================
        el.btnExportModal.addEventListener('click', () => {
            el.exportModal.classList.remove('hidden');
        });

        document.querySelectorAll('.close-modal-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                el.exportModal.classList.add('hidden');
                el.confirmModal.classList.add('hidden');
            });
        });

        // Export high resolution 300 DPI PNG
        document.getElementById('btnExport300Png').addEventListener('click', async () => {
            setExportButtonLoading(true);
            try {
                await HighResExporter.downloadImage(state, 'png', 300, `طباعة_A4_عالي_الدقة_300dpi`);
                el.exportModal.classList.add('hidden');
            } finally {
                setExportButtonLoading(false);
            }
        });

        // Export high resolution 300 DPI JPEG
        document.getElementById('btnExport300Jpg').addEventListener('click', async () => {
            setExportButtonLoading(true);
            try {
                await HighResExporter.downloadImage(state, 'jpeg', 300, `طباعة_A4_عالي_الدقة_300dpi`);
                el.exportModal.classList.add('hidden');
            } finally {
                setExportButtonLoading(false);
            }
        });

        // Export 150 DPI Fast
        document.getElementById('btnExport150Png').addEventListener('click', async () => {
            setExportButtonLoading(true);
            try {
                await HighResExporter.downloadImage(state, 'png', 150, `طباعة_A4_سريع_150dpi`);
                el.exportModal.classList.add('hidden');
            } finally {
                setExportButtonLoading(false);
            }
        });

        // Direct Native Print
        el.btnPrintDirect.addEventListener('click', () => {
            window.print();
        });

        document.getElementById('btnExportPrint').addEventListener('click', () => {
            el.exportModal.classList.add('hidden');
            window.print();
        });

        // Keyboard Shortcuts
        window.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (state.selectedSlotId) {
                    const slotData = getSlotState(state.selectedSlotId);
                    if (slotData.image) {
                        slotData.image = null;
                        slotData.fileName = '';
                        imageCache.delete(state.selectedSlotId);
                        renderSheet();
                    }
                }
            } else if (e.key === 'r' || e.key === 'R') {
                if (state.selectedSlotId) {
                    el.btnRotateCw.click();
                }
            } else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                el.btnSaveProject.click();
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
                e.preventDefault();
                window.print();
            }
        });
    }

    /**
     * Set loading indicator for export
     */
    function setExportButtonLoading(isLoading) {
        const modalContent = el.exportModal.querySelector('.modal-content');
        if (isLoading) {
            modalContent.classList.add('is-exporting');
        } else {
            modalContent.classList.remove('is-exporting');
        }
    }

    /**
     * Confirmation Modal Helper
     */
    function showConfirmModal(title, message, onConfirm) {
        document.getElementById('confirmModalTitle').textContent = title;
        document.getElementById('confirmModalMsg').textContent = message;
        el.confirmModal.classList.remove('hidden');

        const btnYes = document.getElementById('btnConfirmAction');
        const clickHandler = () => {
            onConfirm();
            el.confirmModal.classList.add('hidden');
            btnYes.removeEventListener('click', clickHandler);
        };
        btnYes.addEventListener('click', clickHandler);
    }

    /**
     * Synchronize UI Controls with current State
     */
    function syncControlsFromState() {
        el.orientationPortrait.classList.toggle('active', state.orientation === 'portrait');
        el.orientationLandscape.classList.toggle('active', state.orientation === 'landscape');
        el.layoutSelect.value = state.layoutId;
        el.customGridControls.classList.toggle('hidden', state.layoutId !== 'custom');
        el.inputCustomRows.value = state.customRows;
        el.inputCustomCols.value = state.customCols;

        el.marginAll.value = state.sheetMargins.top;
        el.marginTop.value = state.sheetMargins.top;
        el.marginRight.value = state.sheetMargins.right;
        el.marginBottom.value = state.sheetMargins.bottom;
        el.marginLeft.value = state.sheetMargins.left;
        el.slotGap.value = state.slotGap;

        el.borderToggle.checked = state.globalBorder.enabled;
        el.borderOptions.classList.toggle('hidden', !state.globalBorder.enabled);
        el.borderWidth.value = state.globalBorder.widthMm;
        el.borderColor.value = state.globalBorder.color;
        el.borderRadius.value = state.globalBorder.radiusMm;
    }

    // Initialize App on DOM Ready
    document.addEventListener('DOMContentLoaded', () => {
        initElements();
        initLayoutPresets();
        syncControlsFromState();
        setupEventListeners();
        renderSheet();

        console.log('PhotoPrint Studio Initialized with Unified WYSIWYG SlotRenderer!');
    });

})();
