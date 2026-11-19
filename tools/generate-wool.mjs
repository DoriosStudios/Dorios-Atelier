import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import colors from '../content/concrete-colors.json' with {type: 'json'};
import spec from '../content/wool.json' with {type: 'json'};
import {PROJECT_ROOT, readJson, stableJson, writeJson, writeText} from './lib/project-index.mjs';
import {adaptShapeBlock, loadShapeTemplates} from './lib/blocks-with-traits.mjs';
import {blockName, GROUP_TRANSLATIONS, LOCALES, parseLang, serializeLang} from './lib/localization.mjs';

const WRITE = process.argv.includes('--write'), CHECK = process.argv.includes('--check');
const root = file => path.join(PROJECT_ROOT, file), id = name => `dorios_atelier:${name}`;
const reference = await fs.readFile(root('tools/references/mojang/wool_colored_white.png'));
if (createHash('sha256').update(reference).digest('hex') !== spec.textureSource.sha256) throw new Error('The pinned wool weave changed.');
const changes = new Map();
async function queue(file, document) {
  const absolute = root(file);
  let current;
  try { current = await readJson(absolute); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (stableJson(current) !== stableJson(document)) changes.set(absolute, {document});
}
const registry = await readJson(root('RP/blocks.json'));
const atlas = await readJson(root('RP/textures/terrain_texture.json'));
const catalog = await readJson(root('BP/item_catalog/crafting_item_catalog.json'));
const policy = await readJson(root('content/variant-policy.json'));
const templates = await loadShapeTemplates();
const construction = catalog['minecraft:crafting_items_catalog'].categories.find(category => category.category_name === 'construction');
const concreteGroup = construction.groups.find(group => group.group_identifier?.name === 'dorios_atelier:itemGroup.name.concreteExtra');
const concreteOrder = [...new Set((concreteGroup?.items ?? []).filter(item => item.endsWith('_concrete')).map(item => item.split(':')[1].slice(0, -'_concrete'.length)))];
const order = [...new Set([...concreteOrder, ...colors.colors.map(color => color.id)])];
const byColor = new Map(colors.colors.map(color => [color.id, color]));
let group = construction.groups.find(group => group.group_identifier?.name === spec.group);
if (!group) {
  group = {group_identifier: {name: spec.group, icon: id(`${order[0]}_wool`)}, items: []};
  const index = construction.groups.indexOf(concreteGroup);
  construction.groups.splice(index < 0 ? construction.groups.length : index + 1, 0, group);
}
const ids = [];
const directories = {block: 'entire_blocks/Wool', carpet: 'carpets', slab: 'slabs', stairs: 'stairs', vertical_slab: 'vertical_slabs'};
for (const colorId of order) {
  const color = byColor.get(colorId);
  if (!color) continue;
  const base = `${color.id}_wool`, texture = `dorios_atelier_${base}`;
  atlas.texture_data[texture] = {textures: {path: 'textures/blocks/wool/white_weave', tint_color: color.hex}};
  const material = {
    'minecraft:material_instances': {'*': {texture, render_method: 'opaque', ambient_occlusion: true, face_dimming: true}},
    'minecraft:destructible_by_mining': {seconds_to_destroy: .8},
    'minecraft:destructible_by_explosion': {explosion_resistance: .8},
    'minecraft:map_color': color.hex,
    'minecraft:flammable': {flame_odds: 30, burn_odds: 60},
    'tag:wool': {}, 'tag:minecraft:wool': {}, 'tag:minecraft:is_shears_item_destructible': {},
  };
  for (const format of spec.formats) {
    const name = format === 'block' ? base : format === 'carpet' ? `${color.id}_carpet` : `${base}_${format}`;
    const identifier = id(name);
    ids.push(identifier);
    let document = {format_version: '1.26.10', 'minecraft:block': {
      description: {identifier, menu_category: {category: 'construction', group: spec.group}},
      components: structuredClone(material),
    }};
    if (format === 'block') Object.assign(document['minecraft:block'].components, {
      'minecraft:geometry': 'minecraft:geometry.full_block', 'minecraft:light_dampening': 15,
      'minecraft:redstone_conductivity': {allows_wire_to_step_down: true, redstone_conductor: true},
    });
    else if (format === 'carpet') Object.assign(document['minecraft:block'].components, {
      'minecraft:geometry': 'geometry.dorios_atelier.wool_carpet',
      'minecraft:collision_box': {origin: [-8, 0, -8], size: [16, 1, 16]},
      'minecraft:selection_box': {origin: [-8, 0, -8], size: [16, 1, 16]},
      'minecraft:light_dampening': 0,
      'minecraft:destructible_by_mining': {seconds_to_destroy: .1},
      'minecraft:placement_filter': {conditions: [{allowed_faces: ['up']}]},
    });
    else document = adaptShapeBlock(templates[format], document);
    await queue(`BP/blocks/decorative/${directories[format]}/${name}.json`, document);
    registry[identifier] = {sound: 'cloth', textures: texture};
  }
  const entry = {base, source: id(base), variants: {slab: 'generate', stairs: 'generate', vertical_slab: 'generate', wall: 'skip'}, notes: 'Colored wool; flammable cloth. Carpets are generated separately.'};
  const index = policy.materials.findIndex(material => material.base === base);
  if (index < 0) policy.materials.push(entry); else policy.materials[index] = entry;
  await queue(`BP/recipes/wool/${base}.json`, {format_version: '1.21.100', 'minecraft:recipe_shapeless': {
    description: {identifier: id(`craft_${base}`)}, tags: ['crafting_table'],
    ingredients: [...Array.from({length: 8}, () => ({item: 'minecraft:white_wool'})), {item: id(`${color.id}_dye`)}],
    result: {item: id(base), count: 8}, unlock: [{item: id(`${color.id}_dye`)}],
  }});
  await queue(`BP/recipes/wool/${color.id}_carpet.json`, {format_version: '1.21.100', 'minecraft:recipe_shaped': {
    description: {identifier: id(`craft_${color.id}_carpet`)}, tags: ['crafting_table'],
    pattern: ['WW'], key: {W: {item: id(base)}}, result: {item: id(`${color.id}_carpet`), count: 3}, unlock: [{item: id(base)}],
  }});
}
group.items = ids;
group.group_identifier.icon = ids[0];
await queue('RP/blocks.json', registry);
await queue('RP/textures/terrain_texture.json', atlas);
await queue('BP/item_catalog/crafting_item_catalog.json', catalog);
await queue('content/variant-policy.json', policy);
await queue('RP/models/blocks/wool_carpet.geo.json', {format_version: '1.12.0', 'minecraft:geometry': [{
  description: {identifier: 'geometry.dorios_atelier.wool_carpet', texture_width: 16, texture_height: 16, visible_bounds_width: 2, visible_bounds_height: 1, visible_bounds_offset: [0, 0, 0]},
  bones: [{name: 'carpet', pivot: [0, 0, 0], cubes: [{origin: [-8, 0, -8], size: [16, 1, 16], uv: {
    up: {uv: [0, 0], uv_size: [16, 16]}, down: {uv: [0, 0], uv_size: [16, 16]},
    north: {uv: [0, 0], uv_size: [16, 1]}, south: {uv: [0, 0], uv_size: [16, 1]},
    east: {uv: [0, 0], uv_size: [16, 1]}, west: {uv: [0, 0], uv_size: [16, 1]},
  }}]}],
}]});
let textureChanged = true;
try { textureChanged = !(await fs.readFile(root('RP/textures/blocks/wool/white_weave.png'))).equals(reference); } catch (error) { if (error.code !== 'ENOENT') throw error; }
for (const locale of LOCALES) {
  const file = root(`RP/texts/${locale}.lang`);
  const current = await fs.readFile(file, 'utf8'), entries = parseLang(current);
  entries.set(spec.group, GROUP_TRANSLATIONS[locale].woolExtra);
  for (const identifier of ids) entries.set(`tile.${identifier}.name`, blockName(identifier.split(':')[1], locale));
  const text = serializeLang(entries);
  if (current.replaceAll('\r\n', '\n') !== text) changes.set(file, {text});
}
console.log(`Wool: ${colors.colors.length} colors, ${ids.length} blocks; ${changes.size} definition file(s) ${WRITE ? 'to write' : 'different'}; shared weave changed: ${textureChanged}.`);
if (WRITE) {
  for (const [file, change] of changes) {
    if (change.document) await writeJson(file, change.document); else await writeText(file, change.text);
  }
  if (textureChanged) {
    await fs.mkdir(root('RP/textures/blocks/wool'), {recursive: true});
    await fs.writeFile(root('RP/textures/blocks/wool/white_weave.png'), reference);
  }
}
if (CHECK && (changes.size || textureChanged)) process.exitCode = 1;
