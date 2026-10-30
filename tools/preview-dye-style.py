"""Snapshot and compare only Indigo, Navy and Wine with the creator's Amber."""
import argparse
from hashlib import sha256
import json
from pathlib import Path
import shutil
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
ITEMS = ROOT / "RP/textures/items/dyes"
BEFORE = ROOT / "tools/references/dye-style-before"
TARGETS = ("indigo", "navy", "wine")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--snapshot", action="store_true")
    args = parser.parse_args()
    hashes_path = BEFORE / "hashes.json"
    if args.snapshot:
        assert not hashes_path.exists(), "Snapshot already exists; preserve the original comparison."
        BEFORE.mkdir(parents=True, exist_ok=True)
        hashes = {file.name: sha256(file.read_bytes()).hexdigest() for file in ITEMS.glob("*.png")}
        hashes_path.write_text(json.dumps(hashes, indent=2) + "\n", encoding="utf-8")
        for color in ("amber", *TARGETS):
            shutil.copyfile(ITEMS / f"{color}_dye.png", BEFORE / f"{color}_dye.png")
        print("Saved original icons and all 22 file hashes.")
        return
    hashes = json.loads(hashes_path.read_text(encoding="utf-8"))
    for name, digest in hashes.items():
        if name not in {f"{color}_dye.png" for color in TARGETS}:
            assert sha256((ITEMS / name).read_bytes()).hexdigest() == digest, f"Out-of-scope texture changed: {name}"
    sheet = Image.new("RGBA", (960, 416), (31, 32, 37, 255))
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default(size=14)
    for row in range(2):
        for col, color in enumerate(("amber", *TARGETS)):
            x, y = col * 240, row * 208
            icon = Image.open((BEFORE if row == 0 else ITEMS) / f"{color}_dye.png").convert("RGBA")
            draw.text((x + 8, y + 8), color.title(), fill="white", font=font)
            label = "Creator reference / unchanged" if color == "amber" else ("Before" if row == 0 else "After / vanilla pigment style")
            draw.text((x + 8, y + 28), label, fill=(184, 185, 193), font=font)
            for dx, bg in [(8, (48, 49, 55)), (128, (213, 211, 203))]:
                tile = Image.new("RGBA", (16, 16), (*bg, 255))
                tile.alpha_composite(icon)
                sheet.alpha_composite(tile.resize((96, 96), Image.Resampling.NEAREST), (x + dx, y + 54))
            sheet.alpha_composite(icon, (x + 12, y + 174))
            draw.text((x + 40, y + 174), "native 16x16", fill=(184, 185, 193), font=font)
    output = ROOT / "tools/generated/dye-style-comparison.png"
    sheet.convert("RGB").save(output)
    print("Verified: Amber and all other 18 non-target textures are byte-identical.")
    print("Preview RGBA SHA256:", sha256(sheet.tobytes()).hexdigest())


if __name__ == "__main__":
    main()
