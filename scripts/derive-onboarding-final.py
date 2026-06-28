"""
Regenerate onboarding-XX-final.png files using the LANDSCAPE chibi master.

These are the actual files the app renders (per assetRequireMap).
The card they're shown in is landscape (aspect ~1.55:1), so the images
must be landscape too — no vertical cropping.

Layout per scene:
  - Chibi on LEFT third
  - Kanji/text on RIGHT two-thirds
  - No kanji baked into base image (all text via PIL, Sensei whitelist only)

Whitelist (Sensei): 日本語, にほんご, あ, い, う, しごと, 7時, ア, 人, 一
"""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os
import math

MASTER = r"C:/Users/tophe/AppData/Local/hermes/cache/images/openai_codex_gpt-image-2-low_20260626_072852_cf25a775.png"
OUT_DIR = r"C:/Users/tophe/japanese-tutor-mobile-app/src/assets/source/illustrations/onboarding"
os.makedirs(OUT_DIR, exist_ok=True)

# Brand color
BRAND = (42, 111, 151, 255)
BRAND_SOFT = (42, 111, 151, 60)
ACCENT = (244, 162, 97, 255)
INK = (28, 42, 56, 255)
PAPER = (255, 255, 255, 245)
SHADOW = (0, 0, 0, 40)

# Font: YuGothM.ttc combines dakuten properly (verified via QC)
font_candidates = [
    (r"C:\Windows\Fonts\YuGothM.ttc", 0),
    (r"C:\Windows\Fonts\YuGothR.ttc", 0),
    (r"C:\Windows\Fonts\YuGothB.ttc", 0),
    (r"C:\Windows\Fonts\msgothic.ttc", 0),
    (r"C:\Windows\Fonts\msmincho.ttc", 0),
]
FONT_PATH = None
FONT_INDEX = 0
for p, idx in font_candidates:
    if os.path.exists(p):
        FONT_PATH = p
        FONT_INDEX = idx
        break

def f(size):
    return ImageFont.truetype(FONT_PATH, size, index=FONT_INDEX)

master = Image.open(MASTER).convert("RGBA")
W, H = master.size
print(f"master {W}x{H}")

def card(x, y, w, h, radius=24, fill=PAPER, stroke=BRAND, stroke_w=4):
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    sh = Image.new("RGBA", (w + 24, h + 24), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sh)
    sd.rounded_rectangle((12, 12, w + 12, h + 12), radius=radius, fill=SHADOW)
    sh = sh.filter(ImageFilter.GaussianBlur(6))
    layer.alpha_composite(sh, (x - 12, y - 12))
    d.rounded_rectangle((x, y, x + w, y + h), radius=radius, fill=fill, outline=stroke, width=stroke_w)
    return layer

# =====================
# SCENE 1 FINAL: Welcome
# =====================
def scene_welcome_final():
    """Chibi LEFT + speech bubble with 日本語/にほんご + 3 small kanji cards at bottom-right."""
    canvas = master.copy()
    d = ImageDraw.Draw(canvas)

    # Speech bubble on the right
    bubble_x = W * 0.45
    bubble_y = H * 0.08
    bubble_w = W * 0.50
    bubble_h = H * 0.50
    canvas.alpha_composite(card(bubble_x, bubble_y, bubble_w, bubble_h, radius=32))

    # 日本語 large in bubble
    title_font = f(150)
    title = "日本語"
    bbox = d.textbbox((0, 0), title, font=title_font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    tx = bubble_x + (bubble_w - tw) / 2
    ty = bubble_y + 40
    d.text((tx, ty), title, font=title_font, fill=BRAND)

    # にほんご below
    sub_font = f(64)
    sub = "にほんご"
    bbox = d.textbbox((0, 0), sub, font=sub_font)
    sw, sh_h = bbox[2] - bbox[0], bbox[3] - bbox[1]
    d.text((bubble_x + (bubble_w - sw) / 2, bubble_y + bubble_h - sh_h - 30), sub, font=sub_font, fill=ACCENT)

    # 3 small kanji cards at bottom-right
    card_w, card_h = 200, 180
    gap = 30
    total_w = card_w * 3 + gap * 2
    start_x = bubble_x + (bubble_w - total_w) / 2
    y_card = H - card_h - 30
    for i, ch in enumerate(["あ", "い", "う"]):
        x = start_x + i * (card_w + gap)
        canvas.alpha_composite(card(x, y_card, card_w, card_h, radius=20))
        kfont = f(120)
        bbox = d.textbbox((0, 0), ch, font=kfont)
        cw, ch_h = bbox[2] - bbox[0], bbox[3] - bbox[1]
        d.text((x + (card_w - cw) / 2, y_card + (card_h - ch_h) / 2 - 10), ch, font=kfont, fill=INK)

    return canvas

s1f = scene_welcome_final()
s1f.save(os.path.join(OUT_DIR, "onboarding-01-welcome-final.png"))
print("✓ onboarding-01-welcome-final.png")

# =====================
# SCENE 3 FINAL: Workplace
# =====================
def scene_workplace_final():
    """Chibi LEFT + しごと card RIGHT with helmet icon."""
    canvas = master.copy()
    d = ImageDraw.Draw(canvas)

    # しごと card on the right
    card_w, card_h = W * 0.45, H * 0.78
    x_card = W * 0.50
    y_card = (H - card_h) / 2
    canvas.alpha_composite(card(x_card, y_card, card_w, card_h, radius=32))

    # しごと label at top
    label_font = f(110)
    label = "しごと"
    bbox = d.textbbox((0, 0), label, font=label_font)
    lw, lh = bbox[2] - bbox[0], bbox[3] - bbox[1]
    d.text((x_card + (card_w - lw) / 2, y_card + 60), label, font=label_font, fill=BRAND)

    # Helmet icon in middle of card
    icon_size = 220
    cx = x_card + card_w / 2
    cy = y_card + card_h / 2 + 80
    # helmet body
    d.ellipse((cx - icon_size / 2, cy - icon_size / 2 + 30, cx + icon_size / 2, cy + icon_size / 2 + 30),
              fill=BRAND, outline=INK, width=6)
    # helmet gold crest (front)
    d.ellipse((cx - 45, cy - icon_size / 2 - 10, cx + 45, cy - icon_size / 2 + 75), fill=ACCENT, outline=INK, width=5)
    # helmet horns
    d.polygon([
        (cx - icon_size / 2 + 30, cy - icon_size / 2 + 40),
        (cx - icon_size / 2 - 35, cy - icon_size / 2 - 35),
        (cx - icon_size / 2 + 80, cy - icon_size / 2 + 50),
    ], fill=ACCENT, outline=INK)
    d.polygon([
        (cx + icon_size / 2 - 30, cy - icon_size / 2 + 40),
        (cx + icon_size / 2 + 35, cy - icon_size / 2 - 35),
        (cx + icon_size / 2 - 80, cy - icon_size / 2 + 50),
    ], fill=ACCENT, outline=INK)
    # visor slit
    d.rectangle((cx - icon_size / 2 + 35, cy - 20, cx + icon_size / 2 - 35, cy + 10), fill=INK)

    return canvas

s3f = scene_workplace_final()
s3f.save(os.path.join(OUT_DIR, "onboarding-03-workplace-final.png"))
print("✓ onboarding-03-workplace-final.png")

# =====================
# SCENE 4 FINAL: Habit
# =====================
def scene_habit_final():
    """Chibi LEFT + clock icon + 7時 card RIGHT."""
    canvas = master.copy()
    d = ImageDraw.Draw(canvas)

    # Clock icon top-right
    cx, cy, r = int(W * 0.78), int(H * 0.22), 95
    sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sh)
    sd.ellipse((cx - r - 8, cy - r - 8, cx + r + 8, cy + r + 8), fill=SHADOW)
    sh = sh.filter(ImageFilter.GaussianBlur(6))
    canvas.alpha_composite(sh)
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=PAPER, outline=BRAND, width=6)
    for ang_deg in (0, 90, 180, 270):
        a = math.radians(ang_deg)
        x1 = cx + (r - 14) * math.cos(a)
        y1 = cy + (r - 14) * math.sin(a)
        x2 = cx + (r - 4) * math.cos(a)
        y2 = cy + (r - 4) * math.sin(a)
        d.line((x1, y1, x2, y2), fill=INK, width=5)
    # hour hand to 7
    a7 = math.radians(-60)
    d.line((cx, cy, cx + (r - 26) * math.cos(a7), cy + (r - 26) * math.sin(a7)), fill=INK, width=8)
    # minute hand to 12
    a12 = math.radians(-90)
    d.line((cx, cy, cx + (r - 42) * math.cos(a12), cy + (r - 42) * math.sin(a12)), fill=BRAND, width=5)
    d.ellipse((cx - 7, cy - 7, cx + 7, cy + 7), fill=INK)

    # Big 7時 card below clock
    card_w = W * 0.40
    card_h = H * 0.45
    x_card = W * 0.55
    y_card = H * 0.45
    canvas.alpha_composite(card(x_card, y_card, card_w, card_h, radius=32))

    # Big 7時 text
    big = f(280)
    s7 = "7時"
    bbox = d.textbbox((0, 0), s7, font=big)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    d.text((x_card + (card_w - tw) / 2, y_card + (card_h - th) / 2 - 20), s7, font=big, fill=BRAND)

    return canvas

s4f = scene_habit_final()
s4f.save(os.path.join(OUT_DIR, "onboarding-04-habit-final.png"))
print("✓ onboarding-04-habit-final.png")

print("\nALL DONE")
