#!/usr/bin/env python3
"""Remove EXIF/IPTC/comments from a JPEG without recompressing its pixels."""

from pathlib import Path
import sys


def strip_metadata(source: bytes) -> bytes:
    if not source.startswith(b"\xff\xd8"):
        raise ValueError("input is not a JPEG")

    output = bytearray(source[:2])
    cursor = 2

    while cursor < len(source):
        if source[cursor] != 0xFF:
            raise ValueError("invalid JPEG marker")

        marker_start = cursor
        while cursor < len(source) and source[cursor] == 0xFF:
            cursor += 1
        if cursor >= len(source):
            break

        marker = source[cursor]
        cursor += 1

        if marker == 0xDA:  # Start of scan: the remainder is compressed pixels.
            output.extend(source[marker_start:])
            break

        if marker in {0xD8, 0xD9, 0x01, *range(0xD0, 0xD8)}:
            output.extend(source[marker_start:cursor])
            continue

        if cursor + 2 > len(source):
            raise ValueError("truncated JPEG segment")

        segment_length = int.from_bytes(source[cursor : cursor + 2], "big")
        segment_end = cursor + segment_length
        if segment_length < 2 or segment_end > len(source):
            raise ValueError("invalid JPEG segment length")

        # APP1 holds EXIF/XMP (including GPS), APP13 holds IPTC, and COM holds
        # free-form comments. Preserve ICC profiles and the encoded pixels.
        if marker not in {0xE1, 0xED, 0xFE}:
            output.extend(source[marker_start:segment_end])

        cursor = segment_end

    return bytes(output)


if len(sys.argv) != 3:
    raise SystemExit("Usage: strip-jpeg-metadata.py <input> <output>")

source_path = Path(sys.argv[1])
output_path = Path(sys.argv[2])
output_path.parent.mkdir(parents=True, exist_ok=True)
output_path.write_bytes(strip_metadata(source_path.read_bytes()))
