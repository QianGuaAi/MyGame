"""Validate generated asset files against the image manifest."""

from __future__ import annotations

import argparse
import json
import re
from collections import defaultdict
from pathlib import Path


try:
    from PIL import Image
except ImportError as exc:  # pragma: no cover
    raise SystemExit("Missing dependency: python -m pip install pillow") from exc


HERO_FRAME_RE = re.compile(r"^[a-z]+-[a-z]+-[0-9][0-9]\.png$")


def corner_alpha_ok(path: Path) -> bool:
    im = Image.open(path).convert("RGBA")
    w, h = im.size
    corners = [
        im.getpixel((0, 0))[3],
        im.getpixel((w - 1, 0))[3],
        im.getpixel((0, h - 1))[3],
        im.getpixel((w - 1, h - 1))[3],
    ]
    return all(alpha == 0 for alpha in corners)


def image_size(path: Path) -> tuple[int, int]:
    with Image.open(path) as im:
        return im.size


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", default="tools/assets-manifest.json")
    parser.add_argument("--assets", default="src/assets")
    parser.add_argument("--strict-missing", action="store_true")
    parser.add_argument(
        "--include-pending",
        action="store_true",
        help="also validate pending/generated entries when their output files already exist",
    )
    args = parser.parse_args()

    warnings: list[str] = []
    errors: list[str] = []
    assets = Path(args.assets)

    hero_dir = assets / "heroes" / "action-sheets"
    if hero_dir.exists():
        for path in sorted(hero_dir.glob("*.png")):
            if not HERO_FRAME_RE.match(path.name):
                errors.append(f"bad hero frame name: {path}")

    manifest_path = Path(args.manifest)
    manifest = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else []
    groups: dict[str, list[Path]] = defaultdict(list)
    for entry in manifest:
        if not args.include_pending and entry.get("status") != "postprocessed":
            continue
        out = Path(entry["out_path"])
        if not out.exists():
            if args.strict_missing:
                errors.append(f"missing asset: {out}")
            continue

        expected_size = tuple(entry["final_size"])
        actual_size = image_size(out)
        if actual_size != expected_size:
            errors.append(f"bad size: {out} expected {expected_size} got {actual_size}")

        if entry.get("api", {}).get("background") == "transparent" and not corner_alpha_ok(out):
            warnings.append(f"corner not transparent: {out}")

        group = entry.get("anim_group")
        if group:
            groups[group].append(out)

    for group, paths in sorted(groups.items()):
        sizes = {image_size(path) for path in paths if path.exists()}
        if len(sizes) > 1:
            errors.append(f"inconsistent frame sizes for {group}: {sorted(sizes)}")

    png_count = len(list(assets.rglob("*.png"))) if assets.exists() else 0
    if png_count < 600:
        warnings.append(f"png count below final target: {png_count} < 600")

    for row in errors:
        print(f"ERROR: {row}")
    for row in warnings:
        print(f"WARN: {row}")

    print(f"checked png_count={png_count}, errors={len(errors)}, warnings={len(warnings)}")
    raise SystemExit(1 if errors else 0)


if __name__ == "__main__":
    main()
