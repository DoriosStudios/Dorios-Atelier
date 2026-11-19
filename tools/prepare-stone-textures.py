"""Extract the creator's top/side atlas tiles without changing the source art."""
from pathlib import Path
import json
import sys
import hashlib
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
WRITE = "--write" in sys.argv
config = json.loads((ROOT / "content/stone-families.json").read_text(encoding="utf-8"))
changes = 0
identities = {}
for variant in config["variants"]:
    source = ROOT / "RP/textures/blocks" / (variant["texture"] + ".png")
    with Image.open(source) as image:
        image = image.convert("RGBA")
        if variant["atlas"]:
            top, side = image.crop((0, 0, 16, 16)), image.crop((0, 16, 16, 32))
        else:
            if image.size != (16, 16):
                raise ValueError(f"Expected a native 16x16 stone texture: {source}")
            top = side = image
        fingerprint = (variant['family'], hashlib.sha256(top.tobytes() + side.tobytes()).hexdigest())
        if fingerprint in identities:
            raise ValueError(f"Identical stone faces: {variant['id']} and {identities[fingerprint]}; reuse the existing variant.")
        identities[fingerprint] = variant['id']
    if not variant["atlas"]:
        continue
    source = ROOT / "RP/textures/blocks" / (variant["texture"] + ".png")
    with Image.open(source) as image:
        image = image.convert("RGBA")
        if image.size != (32, 32) or image.crop((16, 0, 32, 32)).getbbox():
            raise ValueError(f"Expected a 16x32 top/side strip in a 32x32 canvas: {source}")
        for face, box in [("top", (0, 0, 16, 16)), ("side", (0, 16, 16, 32))]:
            output = ROOT / "RP/textures/blocks/stone_faces" / f"{variant['id']}_{face}.png"
            tile = image.crop(box)
            if output.exists():
                with Image.open(output) as current:
                    if current.size == tile.size and current.convert("RGBA").tobytes() == tile.tobytes():
                        continue
            changes += 1
            if WRITE:
                output.parent.mkdir(parents=True, exist_ok=True)
                tile.save(output)
print(f"Stone atlas faces: {changes} file(s) {'written' if WRITE else 'different'}.")
if "--check" in sys.argv and changes:
    sys.exit(1)
