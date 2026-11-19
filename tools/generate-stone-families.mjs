import fs from 'node:fs/promises';
import path from 'node:path';
import config from '../content/stone-families.json' with {type: 'json'};
import {PROJECT_ROOT, readJson, stableJson, walkJsonFiles, writeJson, writeText} from './lib/project-index.mjs';
import {adaptPillarBlock, adaptShapeBlock, loadShapeTemplates} from './lib/blocks-with-traits.mjs';
import {blockName, LOCALES, localeFileName, parseLang, serializeLang} from './lib/localization.mjs';
import {orderGeneratedStonework} from './lib/stonework-order.mjs';

const WRITE = process.argv.includes('--write');
const CHECK = process.argv.includes('--check');
const root = relative => path.join(PROJECT_ROOT, relative);
const id = name => `dorios_atelier:${name}`;
const shapes = {slab: 'slabs', stairs: 'stairs', vertical_slab: 'vertical_slabs', wall: 'walls'};
const shapeGroups = {slab: 'minecraft:itemGroup.name.slab', stairs: 'minecraft:itemGroup.name.stairs',
  vertical_slab: 'dorios_atelier:itemGroup.name.verticalSlabs', wall: 'dorios_atelier:itemGroup.name.walls'};
const counts = {slab: 2, stairs: 1, vertical_slab: 2, wall: 1};
const sources = {andesite: 'minecraft:andesite', basalt: 'minecraft:basalt', deepslate: 'minecraft:deepslate', dripstone: 'minecraft:dripstone_block',
  end_stone: 'minecraft:end_stone', hardened_netherrack: id('hardened_netherrack')};
const mining = {andesite: 1.5, basalt: 1.25, deepslate: 3, dripstone: 1.5, end_stone: 3, hardened_netherrack: 2};
const identities = new Map();
for (const variant of config.variants) {
  if (!variant.textureIdentity) continue;
  const key = `${variant.family}:${variant.textureIdentity}`;
  if (identities.has(key)) throw new Error(`Identical stone faces: ${variant.id} and ${identities.get(key)}. Reuse the existing variant.`);
  identities.set(key, variant.id);
}
const templates = await loadShapeTemplates();
const pillar = await readJson(root('tools/templates/blocks-with-traits/blocks/pillar.json'));
const registry = await readJson(root('RP/blocks.json'));
const atlas = await readJson(root('RP/textures/terrain_texture.json'));
const catalog = await readJson(root('BP/item_catalog/crafting_item_catalog.json'));
const policy = await readJson(root('content/variant-policy.json'));
const construction = catalog['minecraft:crafting_items_catalog'].categories.find(c => c.category_name === 'construction');
const blocks = new Map();
const recipes = [];
for (const file of await walkJsonFiles(root('BP/blocks'))) {
  const document = await readJson(file);
  blocks.set(document['minecraft:block'].description.identifier, {file, document});
}
for (const file of await walkJsonFiles(root('BP/recipes'))) {
  const document = await readJson(file);
  const key = Object.keys(document).find(k => k.startsWith('minecraft:recipe_'));
  recipes.push({file, document, body: document[key]});
}
const changes = new Map();
const retiredFiles = new Set();
async function retire(file) {
  const allowed = ['BP/blocks', 'BP/loot_tables', 'RP/textures/blocks/stone_faces']
    .some(directory => file.startsWith(root(directory) + path.sep));
  if (!allowed) throw new Error(`Stone retirement outside its managed directories: ${file}`);
  try {
    const info = await fs.stat(file);
    if (!info.isFile()) throw new Error(`Stone retirement must target a file: ${file}`);
    retiredFiles.add(file);
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
async function queue(file, document) {
  let current;
  try { current = await readJson(file); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (stableJson(current) !== stableJson(document)) changes.set(file, {document});
}
// These models are private to the new top/side finishes. Legacy models and UVs
// remain exactly as they were before these texture families were added.
for (const name of ['slab', 'stairs_up', 'stairs_down', 'vertical_slab', 'wall', 'wall_icon']) {
  const model = await readJson(root(`tools/templates/blocks-with-traits/models/${name}.geo.json`));
  for (const geometry of model['minecraft:geometry']) {
    geometry.description.identifier += '_stone_faces';
    for (const bone of geometry.bones ?? []) for (const cube of bone.cubes ?? []) {
      for (const face of ['up', 'down']) if (cube.uv?.[face]) cube.uv[face].material_instance = face;
    }
  }
  await queue(root(`RP/models/blocks/stone_faces_${name}.geo.json`), model);
}
function resultItem(body) { return typeof body.output === 'string' ? body.output : body.result?.item; }
function stonecutter(input, inputCount, output, outputCount, label) {
  return {format_version: '1.21.100', 'minecraft:recipe_shapeless': {
    description: {identifier: id(`sc_${label}`)}, tags: ['stonecutter'],
    ingredients: Array.from({length: inputCount}, () => ({item: input})),
    result: {item: output, count: outputCount}, unlock: [{item: input}],
  }};
}
async function queueConversion(input, inputCount, output, outputCount, label, shapeReset = false) {
  const existing = recipes.find(({body}) => body.tags?.includes('stonecutter')
    && (shapeReset ? body.ingredients?.every(i => i.item === input) : resultItem(body) === output
      && body.ingredients?.every(i => i.item === input))
    && body.ingredients?.length === inputCount);
  const document = stonecutter(input, inputCount, output, outputCount, label);
  if (existing) document['minecraft:recipe_shapeless'].description = existing.body.description;
  await queue(existing?.file ?? root(`BP/recipes/stonecutter/stone_families/${label}.json`), document);
}
function addCatalog(identifier, groupName) {
  let group = construction.groups.find(g => g.group_identifier?.name === groupName);
  if (!group) { group = {group_identifier: {name: groupName, icon: identifier}, items: []}; construction.groups.push(group); }
  if (!group.items.includes(identifier)) group.items.push(identifier);
}
const identifiers = [];
let added = 0;
for (const variant of config.variants) {
  const base = variant.id;
  const key = `dorios_atelier_${base}`;
  const side = variant.atlas ? `${key}_side` : key;
  const top = `${key}_top`;
  if (variant.atlas) {
    atlas.texture_data[side] = {textures: [`textures/blocks/stone_faces/${base}_side`]};
    atlas.texture_data[top] = {textures: [`textures/blocks/stone_faces/${base}_top`]};
  } else atlas.texture_data[side] = {textures: [`textures/blocks/${variant.texture}`]};
  const textures = variant.atlas ? {up: top, down: top, side} : side;
  const material = {texture: side, render_method: 'opaque', ambient_occlusion: true, face_dimming: true};
  const materials = {'*': material};
  if (variant.atlas) for (const face of ['up', 'down']) materials[face] = {...material, texture: top};
  const old = blocks.get(id(base));
  const components = old ? structuredClone(old.document['minecraft:block'].components) : {
    'minecraft:geometry': 'minecraft:geometry.full_block', 'minecraft:light_dampening': 15,
    'minecraft:destructible_by_mining': {seconds_to_destroy: mining[variant.family]},
    'minecraft:destructible_by_explosion': {explosion_resistance: variant.family === 'end_stone' ? 9 : 6},
    'tag:minecraft:is_pickaxe_item_destructible': {}, 'tag:minecraft:stone_tier_destructible': {}, 'tag:stone': {},
    'minecraft:redstone_conductivity': {allows_wire_to_step_down: true, redstone_conductor: true},
  };
  components['minecraft:material_instances'] = materials;
  for (const shape of ['block', ...Object.keys(shapes)]) {
    const name = shape === 'block' ? base : `${base}_${shape}`;
    const identifier = id(name);
    identifiers.push(identifier);
    const group = shape === 'block' ? 'dorios_atelier:itemGroup.name.stoneBricks' : shapeGroups[shape];
    let document = {format_version: '1.26.10', 'minecraft:block': {
      description: {identifier, menu_category: {category: 'construction', group}},
      components: structuredClone(components),
    }};
    if (shape !== 'block') document = adaptShapeBlock(templates[shape], document);
    else if (base.endsWith('_pillar')) {
      document = adaptPillarBlock(pillar, document, {textures});
      document['minecraft:block'].components['minecraft:material_instances'] = structuredClone(materials);
    }
    const existing = blocks.get(identifier);
    if (!existing) added++;
    await queue(existing?.file ?? root(`BP/blocks/decorative/${shape === 'block' ? 'entire_blocks/StoneFamilies' : shapes[shape]}/${name}.json`), document);
    registry[identifier] = {sound: variant.family === 'deepslate' ? 'deepslate' : variant.family === 'hardened_netherrack' ? 'netherrack' : 'stone', textures};
    addCatalog(identifier, group);
    if (shape !== 'block') {
      // Reuse existing recipe files even when their old full-block source was vanilla.
      const previous = recipes.find(r => resultItem(r.body) === identifier && r.body.tags?.includes('stonecutter'));
      if (previous) previous.body.ingredients = [{item: id(base)}];
      await queueConversion(id(base), 1, identifier, counts[shape], `${name}_from_${base}`);
      await queueConversion(identifier, counts[shape], id(base), 1, `${base}_from_${name}`, true);
    }
  }
  const materialPolicy = {base, source: id(base), variants: Object.fromEntries(Object.keys(shapes).map(s => [s, 'generate'])),
    notes: 'Creator stone texture family; native structural shapes with top/side atlas support.'};
  const policyIndex = policy.materials.findIndex(m => m.base === base);
  if (policyIndex < 0) policy.materials.push(materialPolicy); else policy.materials[policyIndex] = materialPolicy;

  if (base === 'hardened_netherrack') {
    await queue(root('BP/recipes/crafting_table/blocks/hardened_netherrack.json'), {
      format_version: '1.21.100', 'minecraft:recipe_shaped': {
        description: {identifier: id('craft_hardened_netherrack')}, tags: ['crafting_table'], pattern: ['NN', 'NN'],
        key: {N: {item: 'minecraft:netherrack'}}, result: {item: id(base), count: 2}, unlock: [{item: 'minecraft:netherrack'}],
      }});
  } else if (base.startsWith('cracked_') || base.startsWith('smooth_')) {
      const uncracked = base.slice(8);
      const input = base.startsWith('smooth_') ? sources[variant.family]
        : uncracked === 'end_stone_bricks' ? 'minecraft:end_bricks' : id(uncracked);
      const existingFurnace = recipes.find(r => r.document['minecraft:recipe_furnace'] && resultItem(r.body) === id(base));
      await queue(root(`BP/recipes/smelting/${base}.json`), {format_version: '1.20.80', 'minecraft:recipe_furnace': {
        ...existingFurnace?.body,
        description: {identifier: id(`smelt_${base}`)}, tags: ['furnace', 'blast_furnace'], input, output: id(base),
      }});
  } else if (!recipes.some(r => resultItem(r.body) === id(base)
    && !(r.body.ingredients ?? []).some(i => i.item?.match(/_(slab|stairs|wall)$/)))) {
    await queueConversion(sources[variant.family], 1, id(base), 1, `${base}_from_${variant.family}`);
  }
  const reset = variant.family === 'hardened_netherrack' ? 'minecraft:netherrack' : sources[variant.family];
  await queueConversion(id(base), 1, reset, variant.family === 'hardened_netherrack' ? 2 : 1, `raw_${variant.family}_from_${base}`);
}
// Retired IDs exist only in script mappings. Never register duplicate blocks.
const aliases = {};
for (const [previous, canonical] of Object.entries(config.aliases ?? {})) {
  for (const suffix of ['', '_slab', '_stairs', '_vertical_slab', '_wall']) {
    const oldId = id(previous + suffix), newId = id(canonical + suffix);
    aliases[oldId] = newId;
    const old = blocks.get(oldId);
    if (old) await retire(old.file);
    await retire(root(`BP/loot_tables/blocks/stone_aliases/${previous + suffix}.json`));
    delete registry[oldId];
  }
  for (const suffix of ['', '_side', '_top']) delete atlas.texture_data[`dorios_atelier_${previous}${suffix}`];
  for (const face of ['side', 'top']) await retire(root(`RP/textures/blocks/stone_faces/${previous}_${face}.png`));
}
for (const category of catalog['minecraft:crafting_items_catalog'].categories) for (const group of category.groups ?? []) {
  group.items = [...new Set(group.items.map(identifier => aliases[identifier] ?? identifier))];
}
policy.materials = policy.materials.filter(material => !Object.hasOwn(config.aliases ?? {}, material.base));
const retiredRecipes = new Set();
function remap(value) {
  if (typeof value === 'string') return aliases[value] ?? value;
  if (Array.isArray(value)) return value.map(remap);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, remap(child)]));
  return value;
}
const finalRecipes = new Map(recipes.map(recipe => [recipe.file, recipe.document]));
for (const [file, change] of changes) if (file.startsWith(root('BP/recipes') + path.sep)) finalRecipes.set(file, change.document);
const seenRecipes = new Set();
const orderedRecipes = [...finalRecipes].sort(([a], [b]) => Number(a.includes('ornate_')) - Number(b.includes('ornate_')) || a.localeCompare(b));
for (const [file, original] of orderedRecipes) {
  const document = remap(original);
  const migrated = stableJson(document) !== stableJson(original) || file.includes('ornate_');
  const key = Object.keys(document).find(key => key.startsWith('minecraft:recipe_'));
  const body = document[key];
  const {description, unlock, ...behavior} = body;
  const signature = stableJson({[key]: behavior});
  const output = resultItem(body);
  const selfConversion = body.tags?.includes('stonecutter') && body.ingredients?.length === 1
    && body.ingredients[0].item === output && (body.result?.count ?? 1) === 1;
  if (migrated && (seenRecipes.has(signature) || selfConversion)) {
    retiredRecipes.add(file); changes.delete(file); continue;
  }
  seenRecipes.add(signature);
  if (stableJson(document) !== stableJson(original)) await queue(file, document);
}
await queue(root('RP/blocks.json'), registry);
await queue(root('RP/textures/terrain_texture.json'), atlas);
await queue(root('BP/item_catalog/crafting_item_catalog.json'), orderGeneratedStonework(catalog, config.variants));
await queue(root('content/variant-policy.json'), policy);
for (const locale of LOCALES) {
  const file = root(`RP/texts/${localeFileName(locale)}`);
  const current = await fs.readFile(file, 'utf8');
  const entries = parseLang(current);
  for (const previous of Object.keys(aliases)) entries.delete(`tile.${previous}.name`);
  for (const identifier of identifiers) entries.set(`tile.${identifier}.name`, blockName(identifier.split(':')[1], locale));
  const next = serializeLang(entries);
  if (current.replaceAll('\r\n', '\n') !== next) changes.set(file, {text: next});
}
// The chisel cycles consume only the hardened netherrack tier, never raw netherrack.
const families = Object.keys(sources);
const cycles = families.map(family => ({family, variants: config.variants.filter(v => v.family === family).map(v => id(v.id))}));
const cycleFile = root('BP/scripts/stoneFamilyVariants.js');
const cycleText = `// Generated by tools/generate-stone-families.mjs.\nexport const STONE_FAMILY_VARIANTS = ${JSON.stringify(cycles, null, 2)};\nexport const STONE_BLOCK_ALIASES = ${JSON.stringify(aliases, null, 2)};\n`;
let oldCycle = '';
try { oldCycle = await fs.readFile(cycleFile, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
if (cycleText !== oldCycle.replaceAll('\r\n', '\n')) changes.set(cycleFile, {text: cycleText});
console.log(`Stone families: ${config.variants.length} full blocks, ${identifiers.length} total definitions (${added} new); ${changes.size} file(s) ${WRITE ? 'to write' : 'different'}.`);
if (WRITE) for (const [file, change] of changes) {
  if (change.document) await writeJson(file, change.document); else await writeText(file, change.text);
}
if (WRITE) for (const file of retiredRecipes) {
  if (!file.startsWith(root('BP/recipes') + path.sep)) throw new Error('Recipe retirement outside the recipe directory.');
  await fs.rm(file);
}
if (WRITE) for (const file of retiredFiles) await fs.rm(file);
console.log(`Canonical stone IDs: ${Object.keys(aliases).length} script-only mappings; ${retiredFiles.size} duplicate block/loot/texture file(s) and ${retiredRecipes.size} redundant recipe(s) ${WRITE ? 'removed' : 'to remove'}.`);
if (CHECK && (changes.size || retiredRecipes.size || retiredFiles.size)) process.exitCode = 1;
