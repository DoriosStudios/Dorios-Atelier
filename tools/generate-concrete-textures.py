"""Recolor pinned Mojang concrete without resizing or changing its grain."""
import argparse
from collections import Counter
from hashlib import sha256
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent


def save_preview(previews, destination):
    columns = min(7, len(previews))
    rows = (len(previews) + columns - 1) // columns
    cell_w, cell_h = 264, 240
    sheet = Image.new("RGB", (columns * cell_w, rows * cell_h), (30, 30, 34))
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default(size=16)
    for index, (color, texture) in enumerate(previews):
        x, y = (index % columns) * cell_w, (index // columns) * cell_h
        draw.text((x + 12, y + 8), color["en"], fill="white", font=font)
        draw.text((x + 12, y + 30), color["hex"], fill=(190, 190, 195), font=font)
        sheet.paste(texture.resize((128, 128), Image.Resampling.NEAREST), (x + 12, y + 60))
        sheet.paste(texture, (x + 152, y + 60))
        tiled = Image.new("RGB", (48, 48))
        for ty in range(3):
            for tx in range(3):
                tiled.paste(texture, (tx * 16, ty * 16))
        sheet.paste(tiled.resize((96, 96), Image.Resampling.NEAREST), (x + 152, y + 92))
        draw.text((x + 12, y + 204), "8x / native + tiled", fill=(190, 190, 195), font=font)
    destination.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(destination)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--write", action="store_true")
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    spec = json.loads((ROOT / "content/concrete-colors.json").read_text(encoding="utf-8"))
    source_path = ROOT / "tools/references/mojang/concrete_white.png"
    assert sha256(source_path.read_bytes()).hexdigest() == spec["textureSource"]["sha256"]
    source = Image.open(source_path).convert("RGB")
    assert source.size == (16, 16)
    source_pixels = list(source.get_flattened_data() if hasattr(source, "get_flattened_data") else source.getdata())
    anchor = Counter(source_pixels).most_common(1)[0][0]
    changed = []
    previews = []
    for color in spec["colors"]:
        target = tuple(bytes.fromhex(color["hex"][1:]))
        pixels = [tuple(target[c] + pixel[c] - anchor[c] for c in range(3)) for pixel in source_pixels]
        assert all(0 <= channel <= 255 for pixel in pixels for channel in pixel)
        assert Counter(pixels).most_common(1)[0][0] == target
        assert len(set(pixels)) == len(set(source_pixels))
        texture = Image.new("RGB", source.size)
        texture.putdata(pixels)
        destination = ROOT / f"RP/textures/blocks/concrete/{color['id']}_concrete.png"
        same = False
        if destination.exists():
            with Image.open(destination) as existing:
                same = existing.size == texture.size and existing.mode == "RGB" and existing.tobytes() == texture.tobytes()
        if not same:
            changed.append(str(destination.relative_to(ROOT)))
            if args.write:
                destination.parent.mkdir(parents=True, exist_ok=True)
                texture.save(destination)
        previews.append((color, texture))
    if args.write:
        save_preview(previews, ROOT / "tools/generated/concrete-preview.png")
        expansion = [(color, texture) for color, texture in previews if color.get("paletteSource") == "spectrum_expansion"]
        if expansion:
            save_preview(expansion, ROOT / "tools/generated/concrete-expansion-preview.png")
    print(f"Concrete textures: {len(previews)} colors; {len(changed)} changes; source hash and native grain verified.")
    for filename in changed:
        print(f"  {'W' if args.write else 'P'} {filename}")
    if args.check and changed:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
