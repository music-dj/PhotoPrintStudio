/**
 * PhotoPrint Studio - Layout Templates & Subdivision Math
 * Calculates millimeter coordinates and percentages for A4 subdivisions
 */

const A4_DIMENSIONS = {
    portrait: { widthMm: 210, heightMm: 297, name: 'عمودي (Portrait)' },
    landscape: { widthMm: 297, heightMm: 210, name: 'أفقي (Landscape)' }
};

// Standard presets for photo counts
const PRESET_LAYOUTS = [
    {
        id: '1-full',
        name: 'صورة واحدة (A4 كاملة)',
        count: 1,
        icon: 'square',
        getGrid: (orientation) => ({ rows: 1, cols: 1 })
    },
    {
        id: '2-split',
        name: 'صورتان (حجم A5)',
        count: 2,
        icon: 'columns',
        getGrid: (orientation) => {
            // For portrait, stacking 2 rows gives 2 A5 landscape halves.
            // For landscape, 2 columns gives 2 A5 portrait halves.
            return orientation === 'portrait' ? { rows: 2, cols: 1 } : { rows: 1, cols: 2 };
        }
    },
    {
        id: '2-cols',
        name: 'صورتان (عموديان)',
        count: 2,
        icon: 'columns',
        getGrid: () => ({ rows: 1, cols: 2 })
    },
    {
        id: '3-grid',
        name: '3 صور (متوازنة)',
        count: 3,
        icon: 'grid',
        customSlots: (orientation) => {
            if (orientation === 'portrait') {
                return [
                    { x: 0, y: 0, width: 100, height: 50 },
                    { x: 0, y: 50, width: 50, height: 50 },
                    { x: 50, y: 50, width: 50, height: 50 }
                ];
            } else {
                return [
                    { x: 0, y: 0, width: 50, height: 100 },
                    { x: 50, y: 0, width: 50, height: 50 },
                    { x: 50, y: 50, width: 50, height: 50 }
                ];
            }
        }
    },
    {
        id: '4-split',
        name: '4 صور (حجم A6 - 2×2)',
        count: 4,
        icon: 'grid-2x2',
        getGrid: () => ({ rows: 2, cols: 2 })
    },
    {
        id: '6-grid',
        name: '6 صور (2×3)',
        count: 6,
        icon: 'layout-grid',
        getGrid: (orientation) => orientation === 'portrait' ? { rows: 3, cols: 2 } : { rows: 2, cols: 3 }
    },
    {
        id: '8-grid',
        name: '8 صور (2×4)',
        count: 8,
        icon: 'layout-grid',
        getGrid: (orientation) => orientation === 'portrait' ? { rows: 4, cols: 2 } : { rows: 2, cols: 4 }
    },
    {
        id: '9-grid',
        name: '9 صور (3×3 مربع)',
        count: 9,
        icon: 'layout-grid',
        getGrid: () => ({ rows: 3, cols: 3 })
    },
    {
        id: '12-grid',
        name: '12 صورة (بطاقات/هويات)',
        count: 12,
        icon: 'layout-grid',
        getGrid: (orientation) => orientation === 'portrait' ? { rows: 4, cols: 3 } : { rows: 3, cols: 4 }
    }
];

class LayoutEngine {
    /**
     * Compute layout slots in millimeter bounds based on configuration
     */
    static computeSlots(config) {
        const {
            orientation = 'portrait',
            layoutId = '2-split',
            customRows = 2,
            customCols = 2,
            sheetMargins = { top: 3, right: 3, bottom: 3, left: 3 }, // in mm (standard 3mm)
            slotGap = 3 // in mm
        } = config;

        const paper = A4_DIMENSIONS[orientation];
        const paperW = paper.widthMm;
        const paperH = paper.heightMm;

        // Printable area inside sheet margins
        const usableW = Math.max(10, paperW - (sheetMargins.left + sheetMargins.right));
        const usableH = Math.max(10, paperH - (sheetMargins.top + sheetMargins.bottom));

        let slotDefs = [];
        const preset = PRESET_LAYOUTS.find(p => p.id === layoutId);

        if (preset && preset.customSlots) {
            const rawSlots = preset.customSlots(orientation);
            slotDefs = rawSlots.map((rs, idx) => {
                const xMm = sheetMargins.left + (rs.x / 100) * usableW;
                const yMm = sheetMargins.top + (rs.y / 100) * usableH;
                const wMm = (rs.width / 100) * usableW;
                const hMm = (rs.height / 100) * usableH;
                return {
                    id: `slot-${idx}`,
                    index: idx,
                    xMm,
                    yMm,
                    wMm,
                    hMm
                };
            });
        } else {
            let rows, cols;
            if (preset && preset.getGrid) {
                const grid = preset.getGrid(orientation);
                rows = grid.rows;
                cols = grid.cols;
            } else {
                rows = Math.max(1, parseInt(customRows, 10) || 1);
                cols = Math.max(1, parseInt(customCols, 10) || 1);
            }

            // Total gaps
            const totalGapX = (cols - 1) * slotGap;
            const totalGapY = (rows - 1) * slotGap;

            const slotW = Math.max(5, (usableW - totalGapX) / cols);
            const slotH = Math.max(5, (usableH - totalGapY) / rows);

            let idx = 0;
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    const xMm = sheetMargins.left + c * (slotW + slotGap);
                    const yMm = sheetMargins.top + r * (slotH + slotGap);
                    slotDefs.push({
                        id: `slot-${idx}`,
                        index: idx,
                        xMm,
                        yMm,
                        wMm: slotW,
                        hMm: slotH,
                        row: r,
                        col: c
                    });
                    idx++;
                }
            }
        }

        return {
            paper,
            paperW,
            paperH,
            usableW,
            usableH,
            slots: slotDefs
        };
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { A4_DIMENSIONS, PRESET_LAYOUTS, LayoutEngine };
}
