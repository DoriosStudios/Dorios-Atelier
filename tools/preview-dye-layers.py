"""Snapshot the layer-style revision and verify creator-owned reference files."""
import argparse
from hashlib import sha256
import json
from pathlib import Path
import shutil
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
ITEMS = ROOT / "RP/textures/items/dyes"
BEFORE = ROOT / "tools/references/dye-layer-style-before"


def pixels(image):
    return image.get_flattened_data() if hasattr(image, "get_flattened_data") else image.getdata()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--snapshot", action="store_true")
    args = parser.parse_args()
    hashes_file = BEFORE / "hashes.json"
    if args.snapshot:
        assert not hashes_file.exists(), "Preserve the original snapshot."
        BEFORE.mkdir(parents=True, exist_ok=True)
        hashes = {}
        for source in ITEMS.glob("*.png"):
            hashes[source.name] = sha256(source.read_bytes()).hexdigest()
            shutil.copyfile(source, BEFORE / source.name)
        hashes_file.write_text(json.dumps(hashes, indent=2) + "\n", encoding="utf-8")
        print("Saved all current dye icons and the creator's plate.")
        return
    hashes = json.loads(hashes_file.read_text(encoding="utf-8"))
    art = json.loads((ROOT / "content/dye-art.json").read_text(encoding="utf-8"))
    assert sha256((ITEMS / "amber_dye.png").read_bytes()).hexdigest() == art["styleReference"]["sha256"], "Creator Amber changed since style inspection."
    assert sha256((ITEMS / "wooden_base.png").read_bytes()).hexdigest() == hashes["wooden_base.png"], "Creator plate modified."
    base = Image.open(ITEMS / "wooden_base.png").convert("RGBA")
    spec = json.loads((ROOT / "content/concrete-colors.json").read_text(encoding="utf-8"))
    base_colors = set(pixels(base)) - {(0, 0, 0, 0)}
    for color in spec["colors"]:
        if color["id"] == "amber":
            continue
        layer = Image.open(ROOT / f"tools/generated/dye-layers/{color['id']}_pigment.png").convert("RGBA")
        icon = Image.open(ITEMS / f"{color['id']}_dye.png").convert("RGBA")
        expected = base.copy()
        expected.alpha_composite(layer)
        assert expected.tobytes() == icon.tobytes(), f"Layer mismatch: {color['id']}"
        assert not (set(pixels(layer)) - {(0, 0, 0, 0)}) & base_colors, f"Wood pixels leaked into pigment: {color['id']}"
    print("Verified: 21 icons = unchanged wooden_base + pigment; Amber and plate byte-identical.")
    samples = [
        ("Creator plate / lower layer", base),
        ("Indigo pigment / upper layer", Image.open(ROOT / "tools/generated/dye-layers/indigo_pigment.png").convert("RGBA")),
        ("Composite / final icon", Image.open(ITEMS / "indigo_dye.png").convert("RGBA")),
        ("Creator Amber / unchanged", Image.open(ITEMS / "amber_dye.png").convert("RGBA")),
    ]
    sheet = Image.new("RGBA", (960, 208), (31, 32, 37, 255))
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default(size=14)
    for index, (label, icon) in enumerate(samples):
        x = index * 240
        draw.text((x + 8, 8), label, fill="white", font=font)
        for dx, bg in [(8, (48, 49, 55)), (128, (213, 211, 203))]:
            tile = Image.new("RGBA", (16, 16), (*bg, 255))
            tile.alpha_composite(icon)
            sheet.alpha_composite(tile.resize((96, 96), Image.Resampling.NEAREST), (x + dx, 54))
        sheet.alpha_composite(icon, (x + 12, 174))
    sheet.convert("RGB").save(ROOT / "tools/generated/dyes-layers-preview.png")
    print("Layer preview RGBA SHA256:", sha256(sheet.tobytes()).hexdigest())


if __name__ == "__main__":
    main()
