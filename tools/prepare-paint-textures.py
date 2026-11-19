"""Make native tint masks while keeping creator handles and hardware unchanged."""
import argparse
import json
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--write', action='store_true')
parser.add_argument('--check', action='store_true')
args = parser.parse_args()
directory = ROOT / 'RP/textures/items/painting'
masks = json.loads((ROOT / 'content/paint-texture-masks.json').read_text(encoding='utf-8'))
tiers = json.loads((ROOT / 'content/painting.json').read_text(encoding='utf-8'))['tiers']
changes = []
previews = []

def queue(file, image):
    same = False
    if file.exists():
        with Image.open(file) as current:
            same = current.size == image.size and current.convert('RGBA').tobytes() == image.convert('RGBA').tobytes()
    if not same:
        changes.append(file)
        if args.write:
            file.parent.mkdir(parents=True, exist_ok=True)
            image.save(file)

for tier in tiers:
    for tool in ['paintbrush', 'paint_roller']:
        name = f"{tier['name']}_{tool}"
        original = Image.open(directory / f'{name}.png').convert('RGBA')
        if original.size != (16, 16):
            raise ValueError(f'Expected a native 16x16 icon: {name}')
        rows = masks[tool]['rows']
        if len(rows) != 16 or any(len(row) != 16 for row in rows):
            raise ValueError(f'Invalid {tool} paint mask')
        dyed = original.copy()
        review = original.copy()
        for y in range(16):
            for x in range(16):
                r, g, b, alpha = original.getpixel((x, y))
                if rows[y][x] == 'X':
                    if alpha != 255:
                        raise ValueError(f'Mask selected an empty/partial pixel: {name}: {x},{y}')
                    gray = max(r, g, b)
                    # Bedrock TGA icons: 255 = tintable, 3 = fixed visible RGB.
                    dyed.putpixel((x, y), (gray, gray, gray, 255))
                    review.putpixel((x, y), (round(gray * .9), round(gray * .2), round(gray * .25), 255))
                elif alpha:
                    dyed.putpixel((x, y), (r, g, b, 3))
        queue(directory / 'layers' / f'{name}_dyed.tga', dyed)
        previews.append((name, review))

if args.write:
    cache = ROOT / '.cache/paint-texture-review'
    cache.mkdir(parents=True, exist_ok=True)
    sheet = Image.new('RGBA', (7 * 112, 2 * 136), '#30363d')
    draw = ImageDraw.Draw(sheet)
    for index, (name, image) in enumerate(previews):
        column = index // 2
        row = index % 2
        sheet.alpha_composite(image.resize((96, 96), Image.Resampling.NEAREST), (column * 112 + 8, row * 136 + 4))
        draw.text((column * 112 + 4, row * 136 + 108), name.split('_')[0], fill='white')
    sheet.save(cache / 'loaded-red-preview.png')
print(f'Paint textures: {len(tiers) * 2} selective TGA icons; {len(changes)} file(s) {"written" if args.write else "different"}.')
if args.check and changes:
    raise SystemExit(1)
