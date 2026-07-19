#!/usr/bin/env python3
"""Create the transparent Inukshuk asset used by the land visualizer.

The outline is deliberately traced from the project photograph rather than
generated, so the preview shows the actual sculpture and its stone texture.
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "gallery" / "stone-detail.jpg"
OUTPUT = ROOT / "assets" / "visualizer" / "inukshuk-cutout.webp"
LAND_SOURCE = ROOT / "assets" / "gallery" / "hillside-landmark.jpg"
LAND_OUTPUT = ROOT / "assets" / "visualizer" / "demo-land.jpg"

# Coordinates in the 1500 x 2000 source image. Each stone is kept separate so
# the negative space around the arms and between the legs remains transparent.
STONES = [
    # Head
    [(750, 598), (780, 566), (883, 535), (934, 558), (954, 584),
     (956, 790), (750, 804)],
    # Arms
    [(510, 841), (1295, 683), (1322, 698), (1337, 768), (1309, 800),
     (557, 920), (510, 900)],
    # Upper body
    [(637, 877), (1055, 825), (1108, 848), (1107, 937), (1059, 970),
     (657, 996), (619, 971), (627, 903)],
    # Lower body
    [(596, 984), (1125, 927), (1167, 956), (1182, 1139), (1146, 1173),
     (614, 1186), (573, 1151), (570, 1023)],
    # Left leg
    [(684, 1175), (821, 1171), (811, 1557), (784, 1603), (707, 1604),
     (674, 1570), (671, 1215)],
    # Right leg
    [(934, 1169), (1063, 1163), (1072, 1586), (1047, 1625), (951, 1612),
     (919, 1578), (919, 1210)],
]


def main() -> None:
    source = Image.open(SOURCE).convert("RGB")
    mask = Image.new("L", source.size, 0)
    drawer = ImageDraw.Draw(mask)
    for stone in STONES:
        drawer.polygon(stone, fill=255)

    # A small feather avoids a visibly hard cut while keeping the stone edges.
    mask = mask.filter(ImageFilter.GaussianBlur(1.2))
    subject = source.convert("RGBA")
    subject.putalpha(mask)

    bbox = mask.getbbox()
    if bbox is None:
        raise RuntimeError("Cutout mask is empty")
    left, top, right, bottom = bbox
    padding = 10
    crop = (
        max(0, left - padding),
        max(0, top - padding),
        min(source.width, right + padding),
        min(source.height, bottom + padding),
    )

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    subject.crop(crop).save(OUTPUT, "WEBP", quality=86, method=6)
    print(f"Created {OUTPUT.relative_to(ROOT)}")

    # A statue-free crop of the same Pennine property gives the tool an
    # immediate, believable demo while visitors decide whether to add a photo.
    land = Image.open(LAND_SOURCE).convert("RGB")
    demo = land.crop((0, 600, 1400, 1475)).resize(
        (1200, 750), Image.Resampling.LANCZOS
    )
    demo.save(LAND_OUTPUT, "JPEG", quality=84, optimize=True, progressive=True)
    print(f"Created {LAND_OUTPUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
