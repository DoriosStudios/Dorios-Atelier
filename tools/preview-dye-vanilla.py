"""Preserve pre-refinement icons and compare native vanilla dye references."""
import argparse
from collections import Counter
from hashlib import sha256
import json
from pathlib import Path
import shutil
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
ITEMS = ROOT / "RP/textures/items/dyes"
BEFORE = ROOT / "tools/references/dye-vanilla-before"
REFS = ROOT / "tools/references/mojang/vanilla-dyes"
COMMIT = "46ba6ea985fb5a92d79a9419198f10dda14c199d"


def tile(sheet, icon, x, y, scale=6, background=(48, 49, 55)):
    frame = Image.new("RGBA", (16, 16), (*background, 255))
    frame.alpha_composite(icon)
    sheet.alpha_composite(frame.resize((16 * scale, 16 * scale), Image.Resampling.NEAREST), (x, y))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--snapshot", action="store_true")
    parser.add_argument("--analyze", action="store_true")
    args = parser.parse_args()
    if args.snapshot:
        assert not BEFORE.exists(), "Keep the original snapshot unchanged."
        BEFORE.mkdir(parents=True)
        hashes = {}
        for path in sorted(ITEMS.glob("*.png")):
            shutil.copyfile(path, BEFORE / path.name)
            hashes[path.name] = sha256(path.read_bytes()).hexdigest()
        (BEFORE / "hashes.json").write_text(json.dumps(hashes, indent=2) + "\n", encoding="utf-8")
    hashes = json.loads((BEFORE / "hashes.json").read_text(encoding="utf-8"))
    for name in ("wooden_base.png", "amber_dye.png"):
        assert sha256((ITEMS / name).read_bytes()).hexdigest() == hashes[name], f"Protected asset changed: {name}"
    files = sorted(REFS.glob("*.png"))
    provenance = {"repository": "Mojang/bedrock-samples", "commit": COMMIT, "files": []}
    sheet = Image.new("RGBA", (5 * 240, 3 * 180), (31, 32, 37, 255))
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default(size=14)
    for index, path in enumerate(files):
        icon = Image.open(path).convert("RGBA")
        assert icon.size == (16, 16)
        name = path.stem.removeprefix("dye_powder_")
        x, y = index % 5 * 240, index // 5 * 180
        draw.text((x + 8, y + 8), "Vanilla / " + name, font=font, fill="white")
        tile(sheet, icon, x + 8, y + 34)
        tile(sheet, icon, x + 128, y + 34, background=(213, 211, 203))
        sheet.alpha_composite(icon, (x + 12, y + 150))
        provenance["files"].append({"path": str(path.relative_to(ROOT)), "sha256": sha256(path.read_bytes()).hexdigest(), "url": f"https://raw.githubusercontent.com/Mojang/bedrock-samples/{COMMIT}/resource_pack/textures/items/{path.name}"})
        if args.analyze and name in ("blue_new", "red", "purple", "brown_new", "light_blue"):
            data = icon.get_flattened_data() if hasattr(icon, "get_flattened_data") else icon.getdata()
            colors = Counter(p for p in data if p[3])
            ordered = sorted(colors, key=lambda p: sum(p[:3]))
            keys = {p: chr(65 + i) for i, p in enumerate(ordered)}
            print(name, [(keys[p], p[:3], colors[p]) for p in ordered])
            for row in range(16):
                print("".join(keys.get(icon.getpixel((col, row)), ".") for col in range(16)))
    (REFS / "provenance.json").write_text(json.dumps(provenance, indent=2) + "\n", encoding="utf-8")
    output = ROOT / "tools/generated/dyes-vanilla-references.png"
    sheet.convert("RGB").save(output)
    print("Vanilla references RGBA SHA256:", sha256(sheet.tobytes()).hexdigest())
    selected = ("copper", "sand", "burgundy", "lavender", "mint", "indigo", "navy", "wine", "rose")
    sheet = Image.new("RGBA", (960, 600), (31, 32, 37, 255))
    draw = ImageDraw.Draw(sheet)
    for index, name in enumerate(selected):
        x, y = index % 3 * 320, index // 3 * 200
        draw.text((x + 8, y + 8), name + " / before - after", font=font, fill="white")
        old = Image.open(BEFORE / f"{name}_dye.png").convert("RGBA")
        new = Image.open(ITEMS / f"{name}_dye.png").convert("RGBA")
        tile(sheet, old, x + 8, y + 40, 8)
        tile(sheet, new, x + 168, y + 40, 8)
        sheet.alpha_composite(old, (x + 12, y + 178))
        sheet.alpha_composite(new, (x + 172, y + 178))
    sheet.convert("RGB").save(ROOT / "tools/generated/dyes-vanilla-comparison.png")
    print("Refinement comparison RGBA SHA256:", sha256(sheet.tobytes()).hexdigest())


if __name__ == "__main__":
    main()
