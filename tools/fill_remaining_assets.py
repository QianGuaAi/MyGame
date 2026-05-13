"""Fill any remaining manifest assets with local derived artwork.

This is a no-API fallback for continuing the asset pipeline after the primary
reference images have been generated. It derives animation frames from existing
portraits/sprites where possible and creates simple hand-painted UI/projectile
stand-ins with Pillow for the rest.
"""

from __future__ import annotations

import json
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter


MANIFEST = Path("tools/assets-manifest.json")


PALETTE = {
    "arrow": (139, 90, 43, 255),
    "mage": (141, 92, 255, 255),
    "barracks": (79, 139, 58, 255),
    "artillery": (93, 90, 82, 255),
    "frost": (92, 167, 216, 255),
    "flame": (217, 95, 50, 255),
    "altar": (47, 138, 120, 255),
    "treasure": (200, 144, 48, 255),
    "projectile": (245, 196, 90, 255),
    "fx": (255, 160, 60, 210),
    "ui": (142, 91, 48, 255),
}


def ensure_rgba(path: Path) -> Image.Image | None:
    if not path.exists():
        return None
    return Image.open(path).convert("RGBA")


def trim_alpha(im: Image.Image, padding: int = 2) -> Image.Image:
    bbox = im.getbbox()
    if not bbox:
        return im
    x0, y0, x1, y1 = bbox
    return im.crop(
        (
            max(0, x0 - padding),
            max(0, y0 - padding),
            min(im.width, x1 + padding),
            min(im.height, y1 + padding),
        )
    )


def fit(im: Image.Image, size: tuple[int, int]) -> Image.Image:
    im = trim_alpha(im)
    scale = min(size[0] / im.width, size[1] / im.height)
    new_size = (max(1, round(im.width * scale)), max(1, round(im.height * scale)))
    im = im.resize(new_size, Image.Resampling.LANCZOS)
    out = Image.new("RGBA", size, (0, 0, 0, 0))
    out.paste(im, ((size[0] - new_size[0]) // 2, (size[1] - new_size[1]) // 2), im)
    return out


def cover(im: Image.Image, size: tuple[int, int]) -> Image.Image:
    scale = max(size[0] / im.width, size[1] / im.height)
    new_size = (max(1, round(im.width * scale)), max(1, round(im.height * scale)))
    im = im.resize(new_size, Image.Resampling.LANCZOS)
    x = max(0, (new_size[0] - size[0]) // 2)
    y = max(0, (new_size[1] - size[1]) // 2)
    return im.crop((x, y, x + size[0], y + size[1]))


def shift(im: Image.Image, dx: int, dy: int) -> Image.Image:
    out = Image.new("RGBA", im.size, (0, 0, 0, 0))
    out.paste(im, (dx, dy), im)
    return out


def recolor(im: Image.Image, factor: float) -> Image.Image:
    rgb = ImageEnhance.Color(im).enhance(1.0 + factor * 0.2)
    return ImageEnhance.Contrast(rgb).enhance(1.0 + factor * 0.08)


def draw_tower(size: tuple[int, int], key: str) -> Image.Image:
    w, h = size
    c = PALETTE.get(key, (160, 120, 80, 255))
    accent = tuple(min(255, v + 55) for v in c[:3]) + (255,)
    im = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    base = (w * 0.22, h * 0.72, w * 0.78, h * 0.94)
    d.rounded_rectangle(base, radius=max(2, w // 18), fill=(92, 76, 64, 255), outline=(53, 42, 37, 255), width=max(1, w // 32))
    d.polygon([(w * 0.32, h * 0.72), (w * 0.5, h * 0.24), (w * 0.68, h * 0.72)], fill=c, outline=(45, 36, 34, 255))
    d.ellipse((w * 0.38, h * 0.16, w * 0.62, h * 0.39), fill=accent, outline=(45, 36, 34, 255), width=max(1, w // 34))
    if key in {"arrow", "barracks"}:
        d.line((w * 0.28, h * 0.48, w * 0.72, h * 0.48), fill=(71, 43, 28, 255), width=max(2, w // 18))
    if key in {"flame", "artillery", "treasure"}:
        d.ellipse((w * 0.42, h * 0.32, w * 0.58, h * 0.48), fill=(255, 170, 64, 230))
    if key in {"frost", "mage", "altar"}:
        d.line((w * 0.5, h * 0.16, w * 0.5, h * 0.08), fill=accent, width=max(2, w // 22))
    return im.filter(ImageFilter.UnsharpMask(radius=1, percent=120))


def draw_projectile(size: tuple[int, int], item_id: str) -> Image.Image:
    w, h = size
    im = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if "arrow" in item_id:
        d.line((w * 0.15, h * 0.55, w * 0.82, h * 0.35), fill=(110, 72, 38, 255), width=max(2, w // 12))
        d.polygon([(w * 0.82, h * 0.35), (w * 0.66, h * 0.25), (w * 0.72, h * 0.48)], fill=(210, 210, 210, 255))
    elif "frost" in item_id:
        d.polygon([(w * 0.5, h * 0.08), (w * 0.76, h * 0.52), (w * 0.5, h * 0.92), (w * 0.24, h * 0.52)], fill=(155, 222, 255, 220), outline=(70, 140, 190, 255))
    elif "meteor" in item_id or "flame" in item_id:
        d.ellipse((w * 0.22, h * 0.22, w * 0.82, h * 0.82), fill=(255, 106, 40, 225), outline=(120, 34, 20, 255))
        d.ellipse((w * 0.36, h * 0.34, w * 0.68, h * 0.66), fill=(255, 220, 90, 220))
    else:
        d.ellipse((w * 0.2, h * 0.2, w * 0.8, h * 0.8), fill=(140, 120, 255, 220), outline=(60, 45, 120, 255), width=max(1, w // 18))
    return im


def draw_fx(size: tuple[int, int], item_id: str) -> Image.Image:
    w, h = size
    im = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    frame = int(item_id.rsplit("-", 1)[-1]) if item_id.rsplit("-", 1)[-1].isdigit() else 1
    for i in range(7):
        angle = (math.tau / 7) * i + frame * 0.3
        r1 = min(w, h) * 0.12
        r2 = min(w, h) * (0.28 + frame * 0.04)
        x1, y1 = w / 2 + math.cos(angle) * r1, h / 2 + math.sin(angle) * r1
        x2, y2 = w / 2 + math.cos(angle) * r2, h / 2 + math.sin(angle) * r2
        d.line((x1, y1, x2, y2), fill=(255, 220, 110, 210), width=max(1, w // 18))
    d.ellipse((w * 0.35, h * 0.35, w * 0.65, h * 0.65), fill=(255, 115, 65, 160))
    return im.filter(ImageFilter.GaussianBlur(0.35))


def draw_ui(size: tuple[int, int], item_id: str) -> Image.Image:
    w, h = size
    im = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if "panel" in item_id:
        for y in range(0, h, max(16, h // 8)):
            d.rectangle((0, y, w, y + h // 10), fill=(126, 82, 45, 255))
            d.line((0, y, w, y), fill=(78, 49, 30, 255), width=2)
        return im
    if "button" in item_id:
        fill = (145, 91, 48, 255)
        if "hover" in item_id:
            fill = (180, 112, 55, 255)
        if "disabled" in item_id:
            fill = (105, 98, 90, 200)
        if "danger" in item_id:
            fill = (165, 58, 50, 255)
        d.rounded_rectangle((8, 8, w - 8, h - 8), radius=10, fill=fill, outline=(62, 40, 28, 255), width=4)
        d.rounded_rectangle((18, 16, w - 18, h // 2), radius=8, fill=(255, 220, 150, 50))
        return im
    color = (240, 190, 70, 255)
    d.ellipse((w * 0.18, h * 0.18, w * 0.82, h * 0.82), fill=color, outline=(90, 60, 30, 255), width=max(2, w // 16))
    d.ellipse((w * 0.34, h * 0.34, w * 0.66, h * 0.66), fill=(255, 235, 140, 255))
    return im


def placeholder_map(size: tuple[int, int], entry: dict) -> Image.Image:
    existing = ensure_rgba(Path(entry["out_path"]))
    if existing:
        return cover(existing, size)
    w, h = size
    im = Image.new("RGBA", size, (132, 154, 100, 255))
    d = ImageDraw.Draw(im)
    d.rectangle((0, 0, w, h), fill=(122, 148, 100, 255))
    d.line((0, h * 0.65, w * 0.35, h * 0.42, w * 0.68, h * 0.57, w, h * 0.34), fill=(188, 158, 105, 255), width=max(20, h // 10), joint="curve")
    d.line((0, h * 0.65, w * 0.35, h * 0.42, w * 0.68, h * 0.57, w, h * 0.34), fill=(103, 79, 54, 255), width=max(3, h // 80), joint="curve")
    return im


def source_for(entry: dict) -> Image.Image:
    out = Path(entry["out_path"])
    size = tuple(entry["final_size"])
    if out.exists():
        return fit(ensure_rgba(out), size) if entry.get("trim", True) else cover(ensure_rgba(out), size)

    category = entry["category"]
    item_id = entry["id"]
    if category == "hero-frame":
        parts = item_id.split("-")
        hero, action = parts[0], parts[1]
        source = ensure_rgba(Path(f"src/assets/heroes/action-sheets/{hero}-{action}-{parts[2]}.png"))
        if not source:
            source = ensure_rgba(Path(f"src/assets/heroes/{hero}.png")) or ensure_rgba(Path(f"ref/{hero}-master.png"))
        return fit(source, size)
    if category in {"tower-stage", "tower-branch"}:
        key = item_id.split("-")[1]
        source = ensure_rgba(Path(f"src/assets/towers/{key}.png"))
        if source:
            frame = sum(ord(ch) for ch in item_id) % 5
            return recolor(fit(source, size), frame / 5)
        return draw_tower(size, key)
    if category == "monster-frame":
        monster = "-".join(item_id.split("-")[:2])
        source = ensure_rgba(Path(f"src/assets/portraits/monsters/{monster}.png"))
        return shift(fit(source, size), (sum(map(ord, item_id)) % 5) - 2, 0)
    if category == "boss-frame":
        boss = "-".join(item_id.split("-")[:2])
        source = ensure_rgba(Path(f"src/assets/enemies/{boss}/portrait.png"))
        return shift(fit(source, size), (sum(map(ord, item_id)) % 7) - 3, 0)
    if category in {"projectile", "aura"}:
        return draw_projectile(size, item_id)
    if category == "fx-frame":
        return draw_fx(size, item_id)
    if category in {"ui-button", "ui-panel", "ui-icon"}:
        return draw_ui(size, item_id)
    if category in {"map", "splash", "menu", "comic"}:
        return placeholder_map(size, entry)
    if category in {"npc-portrait", "hero-portrait"}:
        key = item_id.split("-")[-1]
        source = ensure_rgba(Path(f"ref/{key}-master.png")) or ensure_rgba(Path(f"src/assets/heroes/{key}.png"))
        if source:
            return cover(source, size)
    return draw_ui(size, item_id)


def main() -> None:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    made = 0
    for entry in manifest:
        if entry.get("status") == "postprocessed":
            continue
        out = Path(entry["out_path"])
        out.parent.mkdir(parents=True, exist_ok=True)
        image = source_for(entry)
        image.save(out)
        entry["status"] = "postprocessed"
        entry.pop("error", None)
        made += 1
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"filled {made} remaining entries")


if __name__ == "__main__":
    main()
