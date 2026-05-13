"""Post-process raw generated images into game-ready assets.

Usage:
    python tools/postprocess.py tools/assets-manifest.json
    python tools/postprocess.py tools/assets-manifest.json --stage B

The script updates manifest statuses in place. It only processes entries whose
raw image exists, so it is safe to run after each generation stage.
"""

from __future__ import annotations

import argparse
import json
from collections import defaultdict
from pathlib import Path


try:
    import cv2
    import numpy as np
    from PIL import Image
except ImportError as exc:  # pragma: no cover - command-line ergonomics
    raise SystemExit(
        "Missing image dependencies. Install them with:\n"
        "  python -m pip install pillow numpy opencv-python\n"
    ) from exc


TRANSPARENT_BACKGROUNDS = {"transparent"}


def trim_alpha(im: Image.Image, padding: int = 2) -> Image.Image:
    bbox = im.getbbox()
    if bbox is None:
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


def fit_resize(im: Image.Image, target: tuple[int, int]) -> Image.Image:
    src_w, src_h = im.size
    tgt_w, tgt_h = target
    scale = min(tgt_w / src_w, tgt_h / src_h)
    new_w = max(1, round(src_w * scale))
    new_h = max(1, round(src_h * scale))
    resized = im.resize((new_w, new_h), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", target, (0, 0, 0, 0))
    canvas.paste(resized, ((tgt_w - new_w) // 2, (tgt_h - new_h) // 2), resized)
    return canvas


def cover_resize(im: Image.Image, target: tuple[int, int]) -> Image.Image:
    src_w, src_h = im.size
    tgt_w, tgt_h = target
    scale = max(tgt_w / src_w, tgt_h / src_h)
    new_w = max(1, round(src_w * scale))
    new_h = max(1, round(src_h * scale))
    resized = im.resize((new_w, new_h), Image.Resampling.LANCZOS)
    left = max(0, (new_w - tgt_w) // 2)
    top = max(0, (new_h - tgt_h) // 2)
    return resized.crop((left, top, left + tgt_w, top + tgt_h))


def classify_bg(im: Image.Image) -> str:
    rgba = im.convert("RGBA")
    w, h = rgba.size
    corners = [
        rgba.getpixel((0, 0)),
        rgba.getpixel((w - 1, 0)),
        rgba.getpixel((0, h - 1)),
        rgba.getpixel((w - 1, h - 1)),
    ]
    if all(c[3] == 0 for c in corners):
        return "real-alpha"

    def is_green(c: tuple[int, int, int, int]) -> bool:
        r, g, b, a = c
        return a == 255 and g > 180 and r < 80 and b < 80

    if all(is_green(c) for c in corners):
        return "greenscreen"
    return "bad-bg"


def greenscreen_to_alpha(im: Image.Image) -> Image.Image:
    arr = np.array(im.convert("RGBA"))
    bgr = cv2.cvtColor(arr[..., :3], cv2.COLOR_RGB2BGR)
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    mask = cv2.inRange(hsv, (40, 80, 80), (80, 255, 255))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    alpha = 255 - mask
    r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]
    g_capped = np.minimum(g, np.maximum(r, b))
    out = np.stack([r, g_capped, b, alpha], axis=-1)
    return Image.fromarray(out.astype(np.uint8), "RGBA")


def content_anchor(im: Image.Image, anchor: str) -> tuple[int, int]:
    arr = np.array(im.convert("RGBA"))
    alpha = arr[..., 3]
    ys, xs = np.where(alpha > 16)
    if len(xs) == 0:
        return im.width // 2, im.height // 2
    if anchor == "bottom-center":
        return int(xs.mean()), int(ys.max())
    return int(xs.mean()), int(ys.mean())


def align_group(paths: list[Path], anchor: str) -> None:
    existing = [p for p in paths if p.exists()]
    if len(existing) < 2:
        return
    images = [Image.open(p).convert("RGBA") for p in existing]
    target_size = images[0].size
    target_anchor = content_anchor(images[0], anchor)
    images[0].save(existing[0])
    for path, image in zip(existing[1:], images[1:]):
        ax, ay = content_anchor(image, anchor)
        dx = target_anchor[0] - ax
        dy = target_anchor[1] - ay
        canvas = Image.new("RGBA", target_size, (0, 0, 0, 0))
        canvas.paste(image, (dx, dy), image)
        canvas.save(path)


def process(entry: dict) -> tuple[bool, str]:
    raw = Path(entry["raw_path"])
    if not raw.exists():
        return False, "raw-missing"

    im = Image.open(raw).convert("RGBA")
    wants_transparent = entry.get("api", {}).get("background") in TRANSPARENT_BACKGROUNDS
    if wants_transparent:
        bucket = classify_bg(im)
        if bucket == "bad-bg":
            entry["status"] = "failed"
            entry["error"] = "bad background; reissue required"
            return False, "bad-bg"
        if bucket == "greenscreen":
            im = greenscreen_to_alpha(im)

    if entry.get("trim", True):
        im = trim_alpha(im, padding=int(entry.get("trim_padding", 2)))
        im = fit_resize(im, tuple(entry["final_size"]))
    else:
        im = cover_resize(im, tuple(entry["final_size"]))

    out = Path(entry["out_path"])
    out.parent.mkdir(parents=True, exist_ok=True)
    im.save(out)
    entry["status"] = "postprocessed"
    entry.pop("error", None)
    return True, "ok"


def eligible(entry: dict, stage: str | None) -> bool:
    if stage and entry.get("stage") != stage:
        return False
    return entry.get("status") in {"generated", "postprocessed", "pending", "failed"}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("manifest", nargs="?", default="tools/assets-manifest.json")
    parser.add_argument("--stage", choices=["0", "A", "B", "C", "D"])
    parser.add_argument("--no-align", action="store_true")
    args = parser.parse_args()

    manifest_path = Path(args.manifest)
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))

    counts: dict[str, int] = defaultdict(int)
    processed_entries: list[dict] = []
    for entry in manifest:
        if not eligible(entry, args.stage):
            continue
        ok, reason = process(entry)
        counts[reason] += 1
        if ok:
            processed_entries.append(entry)

    if not args.no_align:
        groups: dict[str, list[Path]] = defaultdict(list)
        anchors: dict[str, str] = {}
        for entry in manifest:
            if entry.get("status") != "postprocessed":
                continue
            group = entry.get("anim_group")
            if not group:
                continue
            groups[group].append(Path(entry["out_path"]))
            anchors[group] = entry.get("anchor", "bottom-center")
        for group, paths in groups.items():
            align_group(sorted(paths), anchors[group])

    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    summary = ", ".join(f"{key}={counts[key]}" for key in sorted(counts))
    print(f"postprocess complete: {summary or 'nothing to do'}")


if __name__ == "__main__":
    main()
