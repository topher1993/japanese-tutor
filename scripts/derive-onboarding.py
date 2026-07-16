"""
Derive 3 onboarding scene variants from a clean chibi master illustration.

Strategy: take the master PNG (no baked-in kanji), overlay clean Sensei-approved
kanji via PIL. The AI cannot hallucinate kanji because there are none in the source.

Outputs:
  onboarding-01-welcome.png    - master + 日本語 banner + あ/い/う cards
  onboarding-03-workplace.png  - master + workplace tint + しごと card
  onboarding-04-habit.png      - master + habit tint + clock + 7時 card

Whitelist (Sensei): 日本語, にほんご, あ, い, う, しごと, 7時, ア, 人, 一
"""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
MASTER = os.environ.get("ONBOARDING_MASTER")
if not MASTER:
    raise RuntimeError("Set ONBOARDING_MASTER to the clean portrait source PNG before running this archival generator")
OUT_DIR = str(REPO_ROOT / "src" / "assets" / "source" / "illustrations" / "onboarding")
os.makedirs(OUT_DIR, exist_ok=True)

# Brand color
BRAND = (42, 111, 151, 255)        # #2A6F97 ocean blue
BRAND_SOFT = (42, 111, 151, 60)
ACCENT = (244, 162, 97, 255)       # #F4A261 amber
INK = (28, 42, 56, 255)
PAPER = (255, 255, 255, 245)
SHADOW = (0, 0, 0, 40)

# Find a font that handles dakuten cleanly
# YuGothM.ttc combines dakuten with kanji properly (verified via QC font test)
font_candidates = [
    (os.environ.get("ONBOARDING_FONT", ""), 0),
    (r"C:\Windows\Fonts\YuGothM.ttc", 0),
    (r"C:\Windows\Fonts\YuGothR.ttc", 0),
    (r"C:\Windows\Fonts\YuGothB.ttc", 0),
    (r"C:\Windows\Fonts\msgothic.ttc", 0),
    (r"C:\Windows\Fonts\msmincho.ttc", 0),
    (r"C:\Windows\Fonts\NotoSansJP-VF.ttf", 0),
    ("/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc", 0),
    ("/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc", 0),
    ("/usr/share/fonts/truetype/noto/NotoSansJP-Regular.ttf", 0),
    ("~/.fonts/NotoSansJP-Regular.ttf", 0),
]

FONT_INDEX = 0
FONT_PATH = None
for p, idx in font_candidates:
    expanded = os.path.expanduser(p)
    if expanded and os.path.exists(expanded):
        FONT_PATH = expanded
        FONT_INDEX = idx
        print(f"font: {p} (index {idx})")
        break
if not FONT_PATH:
    raise RuntimeError("No Japanese-capable font found; set ONBOARDING_FONT to a .ttf/.ttc path")

def f(size):
    return ImageFont.truetype(FONT_PATH, size, index=FONT_INDEX)

master = Image.open(MASTER).convert("RGBA")
W, H = master.size
print(f"master {W}x{H}")

# =====================
# Helper: draw a card
# =====================
def card(x, y, w, h, radius=24, fill=PAPER, stroke=BRAND, stroke_w=4):
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    # shadow
    sh = Image.new("RGBA", (w + 24, h + 24), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sh)
    sd.rounded_rectangle((12, 12, w + 12, h + 12), radius=radius, fill=SHADOW)
    sh = sh.filter(ImageFilter.GaussianBlur(6))
    layer.alpha_composite(sh, (x - 12, y - 12))
    d.rounded_rectangle((x, y, x + w, y + h), radius=radius, fill=fill, outline=stroke, width=stroke_w)
    return layer

# =====================
# SCENE 1: Welcome
# =====================
def scene_welcome():
    canvas = master.copy()
    d = ImageDraw.Draw(canvas)

    # Master is portrait 1024x1536, chibi occupies y=140-700. Below is empty.
    # Layout: 日本語 centered under chibi, にほんご below, 3 cards at bottom.

    title_font = f(90)    # 日本語 (smaller to avoid foot overlap)
    sub_font = f(50)      # にほんご

    # 日本語 centered below chibi feet — pushed down further
    title = "日本語"
    bbox = d.textbbox((0, 0), title, font=title_font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    d.text(((W - tw) / 2, 820), title, font=title_font, fill=(42, 111, 151, 255))

    # にほんご centered below 日本語
    sub = "にほんご"
    bbox = d.textbbox((0, 0), sub, font=sub_font)
    sw, sh_h = bbox[2] - bbox[0], bbox[3] - bbox[1]
    d.text(((W - sw) / 2, 970), sub, font=sub_font, fill=(244, 162, 97, 255))

    # Bottom: 3 kanji cards (あ, い, う) — bottom strip
    card_w, card_h = 200, 200
    gap = 40
    total_w = card_w * 3 + gap * 2
    start_x = (W - total_w) // 2
    y_card = H - card_h - 60

    for i, ch in enumerate(["あ", "い", "う"]):
        x = start_x + i * (card_w + gap)
        canvas.alpha_composite(card(x, y_card, card_w, card_h, radius=20))
        kfont = f(140)
        bbox = d.textbbox((0, 0), ch, font=kfont)
        cw, ch_h = bbox[2] - bbox[0], bbox[3] - bbox[1]
        d.text((x + (card_w - cw) / 2, y_card + (card_h - ch_h) / 2 - 10), ch, font=kfont, fill=INK)

    return canvas

s1 = scene_welcome()
s1.save(os.path.join(OUT_DIR, "onboarding-01-welcome.png"))
print("✓ onboarding-01-welcome.png")

# =====================
# SCENE 3: Workplace
# =====================
def scene_workplace():
    canvas = master.copy()
    d = ImageDraw.Draw(canvas)

    # Subtle workplace tint on lower half (warmer floor)
    tint = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    td = ImageDraw.Draw(tint)
    td.rectangle((0, int(H * 0.65), W, H), fill=(244, 162, 97, 35))
    canvas.alpha_composite(tint)

    # Big しごと card centered below chibi feet
    card_w, card_h = 640, 460
    x_card = (W - card_w) // 2
    y_card = 750
    canvas.alpha_composite(card(x_card, y_card, card_w, card_h, radius=28))

    # しごと label (top of card)
    label_font = f(72)
    label = "しごと"
    bbox = d.textbbox((0, 0), label, font=label_font)
    lw = bbox[2] - bbox[0]
    d.text((x_card + (card_w - lw) / 2, y_card + 50), label, font=label_font, fill=BRAND)

    # Big work icon — helmet/worker silhouette in PIL
    icon_size = 200
    cx = x_card + card_w / 2
    cy = y_card + card_h / 2 + 70
    # helmet body
    d.ellipse((cx - icon_size / 2, cy - icon_size / 2 + 30, cx + icon_size / 2, cy + icon_size / 2 + 30),
              fill=BRAND, outline=INK, width=5)
    # helmet gold crest (front)
    d.ellipse((cx - 40, cy - icon_size / 2 - 10, cx + 40, cy - icon_size / 2 + 70), fill=ACCENT, outline=INK, width=4)
    # helmet horns
    d.polygon([
        (cx - icon_size / 2 + 30, cy - icon_size / 2 + 40),
        (cx - icon_size / 2 - 30, cy - icon_size / 2 - 30),
        (cx - icon_size / 2 + 70, cy - icon_size / 2 + 50),
    ], fill=ACCENT, outline=INK)
    d.polygon([
        (cx + icon_size / 2 - 30, cy - icon_size / 2 + 40),
        (cx + icon_size / 2 + 30, cy - icon_size / 2 - 30),
        (cx + icon_size / 2 - 70, cy - icon_size / 2 + 50),
    ], fill=ACCENT, outline=INK)
    # visor slit
    d.rectangle((cx - icon_size / 2 + 30, cy - 20, cx + icon_size / 2 - 30, cy + 10), fill=INK)

    return canvas

s3 = scene_workplace()
s3.save(os.path.join(OUT_DIR, "onboarding-03-workplace.png"))
print("✓ onboarding-03-workplace.png")

# =====================
# SCENE 4: Habit
# =====================
def scene_habit():
    canvas = master.copy()
    d = ImageDraw.Draw(canvas)

    # Subtle schedule tint
    tint = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    td = ImageDraw.Draw(tint)
    td.rectangle((0, 0, W, H), fill=(42, 111, 151, 18))
    canvas.alpha_composite(tint)

    # Big 7時 card centered below chibi feet
    card_w, card_h = 600, 460
    x_card = (W - card_w) // 2
    y_card = 750
    canvas.alpha_composite(card(x_card, y_card, card_w, card_h, radius=28))

    # Big 7時 text inside card
    big = f(280)
    s7 = "7時"
    bbox = d.textbbox((0, 0), s7, font=big)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    d.text((x_card + (card_w - tw) / 2, y_card + (card_h - th) / 2 - 30), s7, font=big, fill=BRAND)

    # Small clock face top-left of canvas
    cx, cy, r = 130, 200, 90
    sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sh)
    sd.ellipse((cx - r - 8, cy - r - 8, cx + r + 8, cy + r + 8), fill=SHADOW)
    sh = sh.filter(ImageFilter.GaussianBlur(6))
    canvas.alpha_composite(sh)
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=PAPER, outline=BRAND, width=6)
    import math
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

    return canvas

s4 = scene_habit()
s4.save(os.path.join(OUT_DIR, "onboarding-04-habit.png"))
print("✓ onboarding-04-habit.png")

print("\nALL DONE")
