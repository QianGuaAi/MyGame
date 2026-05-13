"""Classify PNG backgrounds as real-alpha, greenscreen, or bad-bg."""

from __future__ import annotations

import argparse
from collections import defaultdict
from pathlib import Path


try:
    from PIL import Image
except ImportError as exc:  # pragma: no cover
    raise SystemExit("Missing dependency: python -m pip install pillow") from exc


def classify(path: Path) -> str:
    im = Image.open(path).convert("RGBA")
    w, h = im.size
    corners = [
        im.getpixel((0, 0)),
        im.getpixel((w - 1, 0)),
        im.getpixel((0, h - 1)),
        im.getpixel((w - 1, h - 1)),
    ]
    if all(c[3] == 0 for c in corners):
        return "real-alpha"

    def is_green(c: tuple[int, int, int, int]) -> bool:
        r, g, b, a = c
        return a == 255 and g > 180 and r < 80 and b < 80

    if all(is_green(c) for c in corners):
        return "greenscreen"
    return "bad-bg"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("path", nargs="?", default="src/assets")
    parser.add_argument("--limit", type=int, default=10)
    args = parser.parse_args()

    root = Path(args.path)
    files = [root] if root.is_file() else sorted(root.rglob("*.png"))
    buckets: dict[str, list[Path]] = defaultdict(list)
    for png in files:
        buckets[classify(png)].append(png)

    for name in ("real-alpha", "greenscreen", "bad-bg"):
        rows = buckets[name]
        print(f"{name}: {len(rows)} files")
        for path in rows[: args.limit]:
            print(f"  {path}")


if __name__ == "__main__":
    main()
