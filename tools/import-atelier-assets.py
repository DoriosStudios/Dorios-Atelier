"""Import creator assets, reusing semantic block IDs and identical face pixels."""
import argparse
import hashlib
import json
import shutil
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--source', required=True, type=Path)
parser.add_argument('--write', action='store_true')
args = parser.parse_args()
source = args.source.resolve()
if not source.is_dir():
    parser.error('The asset source must be an existing directory.')
previous = json.loads((ROOT / 'content/stone-families.json').read_text(encoding='utf-8'))

def canonical(stem):
    name = stem.replace('andsite', 'andesite').replace('cranked_', 'cracked_')
    name = name.replace('endstone', 'end_stone').replace('pilar', 'pillar')
    name = name.replace('_pillar_tiles', '_tiles_pillar')
    if name.startswith('tiling_polished_'):
        name = name[len('tiling_'):] + '_tiling'
    name = name.replace('cobbled_netherrack', 'hardened_netherrack')
    if 'netherrack' in name and 'hardened_netherrack' not in name:
        name = name.replace('netherrack', 'hardened_netherrack')
    return name

def faces(file):
    image = Image.open(file).convert('RGBA')
    if image.size == (16, 16):
        return image, image, False
    if image.size == (32, 32) and not image.crop((16, 0, 32, 32)).getbbox():
        return image.crop((0, 0, 16, 16)), image.crop((0, 16, 16, 32)), True
    raise ValueError(f'Unsupported creator texture layout: {file}: {image.size}')

copies = []
variants = []
aliases = dict(previous.get('aliases', {}))
for variant in previous['variants']:
    name = variant['id'].replace('ornate_', '')
    if name != variant['id']:
        aliases[variant['id']] = name
identities = {}
existing_pixels = {}
for file in (ROOT / 'RP/textures/blocks').rglob('*.png'):
    try:
        top, side, atlas = faces(file)
    except ValueError:
        continue
    digest = hashlib.sha256(top.tobytes() + side.tobytes()).hexdigest()
    existing_pixels.setdefault(digest, file)

for file in sorted(source.glob('*.png')):
    # These are the component faces of the chiseled-andesite atlas, not variants.
    if file.stem in {'chiseled_andesite_sd', 'chiseled_andesite_tp'}:
        continue
    name = canonical(file.stem)
    top, side, atlas = faces(file)
    family = next((material for material in ['hardened_netherrack', 'end_stone', 'andesite', 'basalt', 'deepslate', 'dripstone'] if material in name), None)
    if not family:
        raise ValueError(f'Unknown stone family: {file}')
    identity = hashlib.sha256(top.tobytes() + side.tobytes()).hexdigest()
    key = (family, identity)
    if key in identities:
        aliases[name] = identities[key]
        print(f'Reusing identical faces: {name} -> {identities[key]}')
        continue
    identities[key] = name
    current = existing_pixels.get(identity)
    # Reuse an existing source only if the full atlas layout also matches.
    if current is not None and faces(current)[2] == atlas:
        texture = current.relative_to(ROOT / 'RP/textures/blocks').with_suffix('').as_posix()
    else:
        texture = f'stone_families/{name}'
        copies.append((file, ROOT / f'RP/textures/blocks/{texture}.png'))
    variants.append({'id': name, 'family': family, 'texture': texture, 'atlas': atlas, 'textureIdentity': identity})

# Retired names are script-side mappings only; no duplicate blocks are generated.
aliases = {old: new for old, new in aliases.items() if old != new}
config = {'schemaVersion': 2, 'aliases': aliases, 'variants': variants}
for file in sorted((source / 'inks').glob('*.png')):
    name = file.stem.replace('burgundyink_', 'burgundy_ink_').replace('lavander_', 'lavender_')
    name = name.replace('silver_ink_', 'light_gray_ink_').replace('_ink_bucket', '_paint_bucket')
    copies.append((file, ROOT / f'RP/textures/items/painting/{name}.png'))
for file in sorted((source / 'elevators').glob('*.png')):
    copies.append((file, ROOT / 'Upcoming/assets/elevators' / file.name))

changed = [(src, dst) for src, dst in copies if not dst.exists() or src.read_bytes() != dst.read_bytes()]
current_config = json.loads((ROOT / 'content/stone-families.json').read_text(encoding='utf-8'))
print(f'Creator assets: {len(variants)} canonical stone finishes, {len(aliases)} script-side name mappings; {len(changed)} asset copies, config changed: {config != current_config}.')
if args.write:
    for src, dst in changed:
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(src, dst)
    if config != current_config:
        (ROOT / 'content/stone-families.json').write_text(json.dumps(config, indent=2) + '\n', encoding='utf-8')
