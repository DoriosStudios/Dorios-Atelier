import fs from 'node:fs/promises';
import path from 'node:path';
import spec from '../content/painting.json' with {type: 'json'};
import extraColors from '../content/concrete-colors.json' with {type: 'json'};
import {PROJECT_ROOT, readJson, stableJson, writeJson, writeText} from './lib/project-index.mjs';
import {itemName, LOCALES, parseLang, serializeLang} from './lib/localization.mjs';
import {VANILLA_PAINT_COLORS, PAINT_MESSAGES, PAINT_GROUP_NAMES, paintColorName} from './lib/painting-localization.mjs';

const WRITE = process.argv.includes('--write');
const CHECK = process.argv.includes('--check');
const root = file => path.join(PROJECT_ROOT, file);
const id = name => `dorios_atelier:${name}`;
const legacyGroupName = 'dorios_atelier:itemGroup.name.painting';
const groupDefinitions = [
  {name: 'paintBuckets', icon: 'red_paint_bucket'},
  {name: 'paintbrushes', icon: 'iron_paintbrush'},
  {name: 'paintRollers', icon: 'iron_paint_roller'},
];
const changes = new Map();
async function queue(file, document) {
  const absolute = root(file);
  let current;
  try { current = await readJson(absolute); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (stableJson(current) !== stableJson(document)) changes.set(absolute, {document});
}
async function queueText(file, text) {
  const absolute = root(file);
  let current = '';
  try { current = await fs.readFile(absolute, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (current.replaceAll('\r\n', '\n') !== text) changes.set(absolute, {text});
}
const colors = [...VANILLA_PAINT_COLORS, ...extraColors.colors.map(color => color.id)];
const colorHex = {...spec.vanillaColors, ...Object.fromEntries(extraColors.colors.map(color => [color.id, color.hex]))};
for (const color of colors) if (!/^#[0-9a-f]{6}$/i.test(colorHex[color])) throw new Error(`Missing paint palette color: ${color}`);
const atlas = await readJson(root('RP/textures/item_texture.json'));
const catalog = await readJson(root('BP/item_catalog/crafting_item_catalog.json'));
const category = catalog['minecraft:crafting_items_catalog'].categories.find(entry => entry.category_name === 'equipment');
if (!category) throw new Error('Equipment creative category is missing.');
const groups = groupDefinitions.map(({name, icon}) => ({
  group_identifier: {name: `dorios_atelier:itemGroup.name.${name}`, icon: id(icon)}, items: [],
}));
const managedGroups = new Set([legacyGroupName, ...groups.map(group => group.group_identifier.name)]);
const groupIndex = category.groups.findIndex(group => managedGroups.has(group.group_identifier?.name));
category.groups = category.groups.filter(group => !managedGroups.has(group.group_identifier?.name));
category.groups.splice(groupIndex < 0 ? category.groups.length : groupIndex, 0, ...groups);
const items = [];
function item(name, components) {
  items.push(name);
  const group = name.endsWith('_paint_bucket') ? groups[0] : name.endsWith('_paintbrush') ? groups[1] : groups[2];
  group.items.push(id(name));
  const texture = `dorios_atelier_${name}`;
  atlas.texture_data[texture] = {textures: `textures/items/painting/${name}`};
  return {format_version: '1.21.100', 'minecraft:item': {
    description: {identifier: id(name), menu_category: {category: 'equipment', group: group.group_identifier.name}},
    components: {'minecraft:icon': texture, 'minecraft:max_stack_size': 1, ...components},
  }};
}
function recipe(name, pattern, key, unlock) {
  return {format_version: '1.21.100', 'minecraft:recipe_shaped': {description: {identifier: id(`craft_${name}`)}, tags: ['crafting_table'], pattern, key, result: {item: id(name)}, unlock: [{item: unlock}]}};
}
const bucketComponents = {'minecraft:allow_off_hand': true, 'minecraft:interact_button': true, 'dorios_atelier:paint_bucket': {}};
await queue('BP/items/painting/empty_paint_bucket.json', item('empty_paint_bucket', bucketComponents));
await queue('BP/recipes/painting/empty_paint_bucket.json', recipe('empty_paint_bucket', ['S S', 'I I', ' I '], {S: {item: 'minecraft:stick'}, I: {item: 'minecraft:iron_ingot'}}, 'minecraft:iron_ingot'));
for (const color of colors) {
  const name = `${color}_paint_bucket`;
  await queue(`BP/items/painting/${name}.json`, item(name, {...bucketComponents, 'minecraft:durability': {max_durability: spec.bucketDurability}}));
  const dye = `${VANILLA_PAINT_COLORS.includes(color) ? 'minecraft' : 'dorios_atelier'}:${color}_dye`;
  await queue(`BP/recipes/painting/${name}.json`, {format_version: '1.21.100', 'minecraft:recipe_shapeless': {
    description: {identifier: id(`fill_${name}`)}, tags: ['crafting_table'], ingredients: [{item: id('empty_paint_bucket')}, {item: 'minecraft:water_bucket'}, {item: dye}],
    result: {item: id(name)}, unlock: [{item: dye}],
  }});
}
for (const tier of spec.tiers) for (const tool of ['paintbrush', 'paint_roller']) {
  const name = `${tier.name}_${tool}`;
  await queue(`BP/items/painting/${name}.json`, item(name, {'minecraft:hand_equipped': true, 'minecraft:interact_button': true,
    'minecraft:durability': {max_durability: tier.durability}, 'dorios_atelier:paint_tool': {}, 'minecraft:dyeable': {},
    'minecraft:icon': {textures: {default: `dorios_atelier_${name}`, dyed: `dorios_atelier_${name}_dyed`}},
  }));
  atlas.texture_data[`dorios_atelier_${name}_dyed`] = {textures: `textures/items/painting/layers/${name}_dyed`};
  const roller = tool === 'paint_roller';
  await queue(`BP/recipes/painting/${name}.json`, recipe(name, roller ? ['WWW', '  M', '  S'] : [' W ', ' M ', ' S '],
    {W: {item: 'minecraft:white_wool'}, M: tier.material, S: {item: 'minecraft:stick'}}, tier.unlock));
}
await queue('RP/textures/item_texture.json', atlas);
await queue('BP/item_catalog/crafting_item_catalog.json', catalog);
for (const locale of LOCALES) {
  const entries = parseLang(await fs.readFile(root(`RP/texts/${locale}.lang`), 'utf8'));
  for (const name of items) entries.set(`item.${id(name)}`, itemName(name, locale));
  for (const color of colors) entries.set(`ui.dorios_atelier.paint.color.${color}`, paintColorName(color, locale));
  entries.delete(legacyGroupName);
  groups.forEach((group, index) => entries.set(group.group_identifier.name, PAINT_GROUP_NAMES[locale][index]));
  for (const [key, text] of Object.entries(PAINT_MESSAGES[locale])) if (key !== 'group') entries.set(`ui.dorios_atelier.paint.${key}`, text);
  await queueText(`RP/texts/${locale}.lang`, serializeLang(entries));
}

// Block destinations are resolved lazily against the world's live registry.
// Only the palette belongs in generated runtime data.
const rgb = color => {
  const hex = colorHex[color].slice(1);
  return {red: parseInt(hex.slice(0, 2), 16) / 255, green: parseInt(hex.slice(2, 4), 16) / 255, blue: parseInt(hex.slice(4, 6), 16) / 255};
};
await queueText('BP/scripts/paintingData.js', `// Generated by tools/generate-painting.mjs.\nexport const PAINT_COLORS = ${JSON.stringify(Object.fromEntries(colors.map(color => [color, rgb(color)])), null, 2)};\n`);
console.log(`Painting: ${colors.length} colors, ${items.length} items; adaptive block lookup; ${changes.size} file(s) ${WRITE ? 'to write' : 'different'}.`);
if (WRITE) for (const [file, change] of changes) {
  if (change.document) await writeJson(file, change.document); else await writeText(file, change.text);
}
if (CHECK && changes.size) process.exitCode = 1;
