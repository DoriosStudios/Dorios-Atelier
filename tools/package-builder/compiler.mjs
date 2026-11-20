import {zipSync, strFromU8, strToU8} from 'fflate';
import {selectedRecords} from './selection.mjs';

const PREFIX = 'dorios_atelier:';
const json = bytes => JSON.parse(strFromU8(bytes));
const encode = value => strToU8(JSON.stringify(value));
const ownId = value => typeof value === 'string' && value.startsWith(PREFIX);

function strings(value, target = new Set()) {
  if (typeof value === 'string') target.add(value);
  else if (Array.isArray(value)) value.forEach(entry => strings(entry, target));
  else if (value && typeof value === 'object') Object.values(value).forEach(entry => strings(entry, target));
  return target;
}

function outputs(recipe) {
  const result = recipe.result ?? recipe.output;
  return [...strings(result)].filter(value => value.includes(':'));
}

function ingredients(recipe) {
  // Descriptions and unlock hints are not crafting ingredients.
  const {description, result, output, unlock, ...inputs} = recipe;
  return [...strings(inputs)].filter(ownId);
}

/** Compiles trusted Atelier release sources, entirely in memory. */
export function compilePackage(catalog, source, selection, progress = () => {}) {
  if (catalog.schemaVersion !== 1) throw new Error('Unsupported builder catalog.');
  const chosen = selectedRecords(catalog, selection);
  if (!chosen.length) throw new Error('EMPTY_SELECTION');
  const records = new Map(catalog.records.map(record => [record.id, record]));
  const selected = new Set(chosen.map(record => record.id));
  const requested = new Set(selected);
  const tools = new Set(chosen.filter(record => record.kind === 'tool').map(record => record.tool));
  if ([...tools].some(tool => tool !== 'painting')) selected.add(`${PREFIX}settings`);
  progress('recipes');

  const recipes = [];
  for (const [file, bytes] of Object.entries(source)) {
    if (!file.startsWith('BP/recipes/') || !file.endsWith('.json')) continue;
    const document = json(bytes);
    const key = Object.keys(document).find(key => key.startsWith('minecraft:recipe_'));
    if (!key) continue;
    const recipe = document[key];
    recipes.push({file, document, recipe, outputs: outputs(recipe), inputs: ingredients(recipe)});
  }

  // Find a finite path from vanilla ingredients before choosing dependencies.
  // This avoids slab <-> block and stonecutter conversion cycles.
  const routes = new Map();
  for (let changed = true; changed;) {
    changed = false;
    for (const recipe of recipes) {
      if (recipe.inputs.some(id => !routes.has(id))) continue;
      const depth = 1 + Math.max(0, ...recipe.inputs.map(id => routes.get(id).depth));
      for (const id of recipe.outputs.filter(id => records.has(id))) {
        if (!routes.has(id) || depth < routes.get(id).depth) {
          routes.set(id, {depth, recipe});
          changed = true;
        }
      }
    }
  }
  const addDependencies = id => {
    for (const input of routes.get(id)?.recipe.inputs ?? []) {
      if (selected.has(input)) continue;
      if (!records.has(input)) throw new Error(`Missing ingredient definition: ${input}`);
      selected.add(input);
      addDependencies(input);
    }
  };
  [...selected].forEach(addDependencies);

  const result = {};
  const put = (file, document) => { result[file] = encode(document); };
  const keep = file => { if (source[file]) result[file] = source[file]; };
  for (const id of selected) {
    const record = records.get(id);
    if (!record) throw new Error(`Missing selected definition: ${id}`);
    keep(record.file);
  }
  let recipeCount = 0;
  for (const entry of recipes) {
    if (!entry.outputs.length || !entry.outputs.every(id => !ownId(id) || selected.has(id))
      || !entry.inputs.every(id => selected.has(id))) continue;
    // Do not keep vanilla-output conversions belonging to omitted families.
    if (!entry.outputs.some(id => selected.has(id)) && !entry.inputs.some(id => selected.has(id))) continue;
    if (Array.isArray(entry.recipe.unlock)) {
      entry.recipe.unlock = entry.recipe.unlock.filter(hint => !ownId(hint.item) || selected.has(hint.item));
    }
    put(entry.file, entry.document);
    recipeCount++;
  }
  progress('resources');

  const creative = json(source['BP/item_catalog/crafting_item_catalog.json']);
  const categories = creative['minecraft:crafting_items_catalog'].categories;
  for (const category of categories) {
    category.groups = category.groups.flatMap(group => {
      group.items = group.items.filter(id => !ownId(id) || selected.has(id));
      if (!group.items.some(id => selected.has(id))) return [];
      if (group.group_identifier && ownId(group.group_identifier.icon)
        && !selected.has(group.group_identifier.icon)) group.group_identifier.icon = group.items[0];
      return [group];
    });
  }
  creative['minecraft:crafting_items_catalog'].categories = categories.filter(category => category.groups.length);
  put('BP/item_catalog/crafting_item_catalog.json', creative);

  const blockSounds = json(source['RP/blocks.json']);
  put('RP/blocks.json', Object.fromEntries(Object.entries(blockSounds)
    .filter(([id]) => !ownId(id) || selected.has(id))));
  for (const [file, bytes] of Object.entries(source)) {
    if (!file.startsWith('RP/') || /^(RP\/textures\/|RP\/blocks.json$|RP\/manifest.json$)/.test(file)) continue;
    if (file.startsWith('RP/attachables/')) {
      const id = json(bytes)['minecraft:attachable']?.description?.identifier;
      if (!selected.has(id)) continue;
    }
    if (file.endsWith('.lang')) {
      const lines = strFromU8(bytes).split(/\r?\n/).filter(line => {
        const id = line.match(/^(?:tile|item)\.(dorios_atelier:[^=]+?)(?:\.name)?=/)?.[1];
        return !id || selected.has(id);
      });
      result[file] = strToU8(lines.join('\n'));
    } else keep(file);
  }

  // Atlas names are read from the retained block/item/attachable definitions.
  const references = new Set();
  for (const [file, bytes] of Object.entries(result)) {
    if (file.endsWith('.json')) strings(json(bytes), references);
  }
  for (const file of ['RP/textures/terrain_texture.json', 'RP/textures/item_texture.json']) {
    const atlas = json(source[file]);
    atlas.texture_data = Object.fromEntries(Object.entries(atlas.texture_data)
      .filter(([name]) => references.has(name)));
    strings(atlas.texture_data, references);
    put(file, atlas);
  }
  const texturePaths = new Set([...references].filter(value => value.startsWith('textures/')));
  for (const file of Object.keys(source).filter(file => file.startsWith('RP/textures/'))) {
    const relative = file.slice(3);
    const noExtension = relative.replace(/\.(png|tga|jpg|jpeg)$/i, '');
    if (texturePaths.has(relative) || texturePaths.has(noExtension)) keep(file);
  }
  put('RP/textures/textures_list.json', [...new Set(Object.keys(result)
    .filter(file => /^RP\/textures\/.*\.(png|tga)$/i.test(file))
    .map(file => file.slice(3).replace(/\.(png|tga)$/i, '')))].sort());

  progress('scripts');
  const mainImports = tools.size ? ["./doriosAPI/main.js"] : [];
  if ([...tools].some(tool => tool !== 'painting')) mainImports.push('./toolMemory.js');
  for (const tool of tools) mainImports.push(`./${{
    chisel: 'chisel', gloves: 'gloves', glass_cutter: 'glassCutter',
    furniture_hammer: 'furnitureHammer', painting: 'painting',
  }[tool]}.js`);
  const visitScript = file => {
    if (result[file]) return;
    if (!source[file]) throw new Error(`Missing script: ${file}`);
    let text = strFromU8(source[file]);
    if (file === 'BP/scripts/variants.js') {
      text = text.replace('export const MATERIAL_CYCLES =', 'const ALL_MATERIAL_CYCLES =');
      text = text.replace('export const BLOCK_ALIAS =',
        `const selectedBlocks = new Set(${JSON.stringify([...selected].filter(id => records.get(id)?.kind === 'block'))});\n`
        + `export const MATERIAL_CYCLES = ALL_MATERIAL_CYCLES.map(cycle => cycle.filter(id => !id.startsWith('${PREFIX}') || selectedBlocks.has(id))).filter(cycle => cycle.length > 1);\nexport const BLOCK_ALIAS =`);
      text = text.replace('globalThis.InsightAtelierVariants =',
        `for (const [alias, target] of BLOCK_ALIAS) if (target.startsWith('${PREFIX}') && !selectedBlocks.has(target)) BLOCK_ALIAS.delete(alias);\nglobalThis.InsightAtelierVariants =`);
    }
    result[file] = strToU8(text);
    const folder = file.slice(0, file.lastIndexOf('/'));
    for (const match of text.matchAll(/(?:\bimport\s*(?:[^'";]*?\sfrom\s*)?|\bexport\s+[^'";]*?\sfrom\s*)['"](\.[^'"]+)['"]/g)) {
      const parts = `${folder}/${match[1]}`.split('/');
      const normalized = [];
      for (const part of parts) {
        if (part === '..') normalized.pop();
        else if (part !== '.') normalized.push(part);
      }
      visitScript(normalized.join('/'));
    }
  };
  mainImports.forEach(entry => visitScript(`BP/scripts/${entry.slice(2)}`));
  if (mainImports.length) result['BP/scripts/main.js'] = strToU8(mainImports.map(entry => `import '${entry}';`).join('\n'));

  for (const pack of ['BP', 'RP']) {
    keep(`${pack}/pack_icon.png`);
    const manifest = json(source[`${pack}/manifest.json`]);
    manifest.header.name += ' · Custom';
    if (pack === 'BP' && !tools.size) {
      manifest.modules = manifest.modules.filter(module => module.type !== 'script');
      manifest.dependencies = manifest.dependencies.filter(dependency => !dependency.module_name);
      delete manifest.capabilities;
    }
    put(`${pack}/manifest.json`, manifest);
  }
  const dependencies = [...selected].filter(id => !requested.has(id));
  put('BP/atelier_selection.json', {schemaVersion: 1, source: catalog.source, selection,
    selected: [...requested].sort(), dependencies: dependencies.sort()});
  progress('compressing');
  return {
    bytes: zipSync(result, {level: 6}),
    summary: {blocks: [...selected].filter(id => records.get(id)?.kind === 'block').length,
      items: [...selected].filter(id => records.get(id)?.kind !== 'block').length,
      recipes: recipeCount, files: Object.keys(result).length, dependencies},
  };
}
