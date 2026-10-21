#!/usr/bin/env python3
"""Resize and recompress the public gallery without retaining camera metadata."""

from pathlib import Path

from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parents[1]
GALLERY = ROOT / "assets" / "gallery"
FILES = [
    "hillside-landmark.jpg",
    "landmark-front.jpg",
    "landmark-wide.jpg",
    "moonlit-landmark.jpg",
    "stone-detail.jpg",
    "summer-landmark.jpg",
]


def main() -> None:
    for name in FILES:
        path = GALLERY / name
        with Image.open(path) as image:
            prepared = ImageOps.exif_transpose(image).convert("RGB")
            prepared.thumbnail((2000, 2000), Image.Resampling.LANCZOS)
            prepared.save(
                path,
                "JPEG",
                quality=84,
                optimize=True,
                progressive=True,
            )
        print(f"Optimized {path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
