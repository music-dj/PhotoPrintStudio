"""
Generate a beautiful, high-resolution app icon for PhotoPrint Studio.
"""
from PIL import Image, ImageDraw, ImageFilter
import math

def create_app_icon():
    size = 512
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # 1. Base rounded rectangle with gradient background
    padding = 24
    radius = 110
    
    # Create smooth gradient
    gradient = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(gradient)
    
    for y in range(size):
        ratio = y / size
        # From vibrant cyan (#0ea5e9) to deep royal indigo (#4f46e5)
        r = int(14 * (1 - ratio) + 79 * ratio)
        g = int(165 * (1 - ratio) + 70 * ratio)
        b = int(233 * (1 - ratio) + 229 * ratio)
        gdraw.line([(0, y), (size, y)], fill=(r, g, b, 255))

    # Mask for rounded rect
    mask = Image.new("L", (size, size), 0)
    mdraw = ImageDraw.Draw(mask)
    mdraw.rounded_rectangle([padding, padding, size - padding, size - padding], radius=radius, fill=255)

    # Composite gradient with mask
    base = Image.composite(gradient, img, mask)

    # Draw inner subtle border/glow
    bdraw = ImageDraw.Draw(base)
    bdraw.rounded_rectangle(
        [padding, padding, size - padding, size - padding],
        radius=radius,
        outline=(255, 255, 255, 60),
        width=4
    )

    # 2. Main Sheet / Photo Paper (Pure White with shadow)
    # A paper sheet slightly tilted or straight
    paper_x0 = 80
    paper_y0 = 80
    paper_x1 = size - 80
    paper_y1 = size - 80
    paper_radius = 28

    # Shadow under paper
    shadow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    sdraw = ImageDraw.Draw(shadow)
    sdraw.rounded_rectangle(
        [paper_x0, paper_y0 + 16, paper_x1, paper_y1 + 16],
        radius=paper_radius,
        fill=(0, 0, 0, 110)
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(16))
    base = Image.alpha_composite(base, shadow)

    # Paper surface
    pdraw = ImageDraw.Draw(base)
    pdraw.rounded_rectangle(
        [paper_x0, paper_y0, paper_x1, paper_y1],
        radius=paper_radius,
        fill=(250, 252, 255, 255),
        outline=(255, 255, 255, 220),
        width=3
    )

    # 3. Inside the sheet: 4 Split Photo Grids (representing A4 split into photos)
    grid_margin = 24
    inner_x0 = paper_x0 + grid_margin
    inner_y0 = paper_y0 + grid_margin
    inner_x1 = paper_x1 - grid_margin
    inner_y1 = paper_y1 - grid_margin
    gap = 16

    mid_x = (inner_x0 + inner_x1) // 2
    mid_y = (inner_y0 + inner_y1) // 2

    slots = [
        # Slot 1: Top-Left (Landscape Mountain & Sun)
        ([inner_x0, inner_y0, mid_x - gap//2, mid_y - gap//2], (30, 41, 59)),
        # Slot 2: Top-Right (Portrait / Vibrant)
        ([mid_x + gap//2, inner_y0, inner_x1, mid_y - gap//2], (15, 23, 42)),
        # Slot 3: Bottom-Left
        ([inner_x0, mid_y + gap//2, mid_x - gap//2, inner_y1], (15, 23, 42)),
        # Slot 4: Bottom-Right
        ([mid_x + gap//2, mid_y + gap//2, inner_x1, inner_y1], (30, 41, 59)),
    ]

    for rect, fill_col in slots:
        pdraw.rounded_rectangle(rect, radius=16, fill=fill_col, outline=(203, 213, 225, 255), width=2)

    # Mini artwork in Top-Left Slot (Landscape / Mountain & Sun)
    r1 = slots[0][0]
    # Sun
    sun_x = r1[0] + 32
    sun_y = r1[1] + 30
    pdraw.ellipse([sun_x - 12, sun_y - 12, sun_x + 12, sun_y + 12], fill=(251, 191, 36, 255))
    # Mountains
    poly1 = [
        (r1[0] + 10, r1[3] - 2),
        (r1[0] + 45, r1[1] + 50),
        (r1[0] + 80, r1[3] - 2)
    ]
    pdraw.polygon(poly1, fill=(56, 189, 248, 220))
    poly2 = [
        (r1[0] + 50, r1[3] - 2),
        (r1[0] + 95, r1[1] + 40),
        (r1[2] - 10, r1[3] - 2)
    ]
    pdraw.polygon(poly2, fill=(99, 102, 241, 240))

    # Mini artwork in Top-Right Slot (Camera Aperture icon)
    r2 = slots[1][0]
    cx = (r2[0] + r2[2]) // 2
    cy = (r2[1] + r2[3]) // 2
    pdraw.ellipse([cx - 30, cy - 30, cx + 30, cy + 30], outline=(56, 189, 248, 255), width=4)
    pdraw.ellipse([cx - 14, cy - 14, cx + 14, cy + 14], fill=(56, 189, 248, 255))

    # Mini artwork in Bottom-Left Slot (Printer nozzle / sparkles)
    r3 = slots[2][0]
    cx3 = (r3[0] + r3[2]) // 2
    cy3 = (r3[1] + r3[3]) // 2
    pdraw.rounded_rectangle([cx3 - 35, cy3 - 18, cx3 + 35, cy3 + 18], radius=8, outline=(16, 185, 129, 240), width=3)
    pdraw.line([(cx3 - 22, cy3), (cx3 + 22, cy3)], fill=(16, 185, 129, 255), width=3)

    # Mini artwork in Bottom-Right Slot (Crop / Frame mark)
    r4 = slots[3][0]
    cx4 = (r4[0] + r4[2]) // 2
    cy4 = (r4[1] + r4[3]) // 2
    pdraw.arc([cx4 - 28, cy4 - 28, cx4 + 28, cy4 + 28], start=45, end=315, fill=(244, 63, 94, 255), width=4)
    pdraw.polygon([(cx4, cy4 - 15), (cx4 + 15, cy4 + 10), (cx4 - 15, cy4 + 10)], fill=(244, 63, 94, 220))

    # Center floating badge: "A4 / A5 / A6"
    badge_w = 110
    badge_h = 42
    bx0 = (size - badge_w) // 2
    by0 = (size - badge_h) // 2
    
    pdraw.rounded_rectangle(
        [bx0, by0, bx0 + badge_w, by0 + badge_h],
        radius=21,
        fill=(15, 23, 42, 250),
        outline=(56, 189, 248, 255),
        width=3
    )

    # Save PNG
    base.save("app_icon.png", format="PNG")
    print("Generated app_icon.png successfully!")

    # Save multi-size Windows .ico
    icon_sizes = [(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)]
    base.save("app_icon.ico", format="ICO", sizes=icon_sizes)
    print("Generated app_icon.ico with sizes:", icon_sizes)

if __name__ == "__main__":
    create_app_icon()
