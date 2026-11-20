import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {parse, printParseErrorCode} from 'jsonc-parser';

export const ROOT = path.resolve(import.meta.dirname, '../..');
const locales = {en: 'en_US', 'pt-BR': 'pt_BR', 'es-MX': 'es_MX'};
const label = (en, pt, es) => ({en, 'pt-BR': pt, 'es-MX': es});
const title = value => value.split('_').map(word => word[0]?.toUpperCase() + word.slice(1)).join(' ');
const families = {
  andesite: label('Andesite', 'Andesito', 'Andesita'),
  basalt: label('Basalt', 'Basalto', 'Basalto'), blackstone: label('Blackstone', 'Pedra-negra', 'Piedra negra'),
  calcite: label('Calcite', 'Calcita', 'Calcita'), deepslate: label('Deepslate', 'Ardósia', 'Pizarra profunda'),
  diorite: label('Diorite', 'Diorito', 'Diorita'), dripstone: label('Dripstone', 'Espeleotema', 'Espeleotema'),
  end_stone: label('End Stone', 'Pedra do End', 'Piedra del End'), granite: label('Granite', 'Granito', 'Granito'),
  netherrack: label('Netherrack', 'Netherrack', 'Netherrack'), nether: label('Nether Bricks', 'Tijolos do Nether', 'Ladrillos del Nether'),
  mud: label('Mud', 'Lama', 'Barro'), obsidian: label('Obsidian', 'Obsidiana', 'Obsidiana'),
  prismarine: label('Prismarine', 'Prismarinho', 'Prismarina'), purpur: label('Purpur', 'Púrpura', 'Púrpura'),
  quartz: label('Quartz', 'Quartzo', 'Cuarzo'), stone: label('Stone', 'Pedra', 'Piedra'),
  tuff: label('Tuff', 'Tufo', 'Toba'), concrete: label('Concrete', 'Concreto', 'Concreto'),
  wool: label('Wool', 'Lã', 'Lana'), glass: label('Glass', 'Vidro', 'Vidrio'),
  grass: label('Grass', 'Grama', 'Césped'),
};
const woods = {
  acacia: label('Acacia', 'Acácia', 'Acacia'), bamboo: label('Bamboo', 'Bambu', 'Bambú'),
  birch: label('Birch', 'Bétula', 'Abedul'), cherry: label('Cherry', 'Cerejeira', 'Cerezo'),
  crimson: label('Crimson', 'Carmesim', 'Carmesí'), dark_oak: label('Dark Oak', 'Carvalho Escuro', 'Roble Oscuro'),
  jungle: label('Jungle', 'Selva', 'Jungla'), mangrove: label('Mangrove', 'Mangue', 'Mangle'),
  oak: label('Oak', 'Carvalho', 'Roble'), pale_oak: label('Pale Oak', 'Carvalho Pálido', 'Roble Pálido'),
  spruce: label('Spruce', 'Pinheiro', 'Abeto'), warped: label('Warped', 'Distorcida', 'Distorsionado'),
};
const nativeColors = [
  ['white', 'White', 'Branco', 'Blanco'], ['orange', 'Orange', 'Laranja', 'Naranja'],
  ['magenta', 'Magenta', 'Magenta', 'Magenta'], ['light_blue', 'Light Blue', 'Azul Claro', 'Azul Claro'],
  ['yellow', 'Yellow', 'Amarelo', 'Amarillo'], ['lime', 'Lime', 'Verde Limão', 'Verde Lima'],
  ['pink', 'Pink', 'Rosa', 'Rosa'], ['gray', 'Gray', 'Cinza', 'Gris'],
  ['light_gray', 'Light Gray', 'Cinza Claro', 'Gris Claro'], ['cyan', 'Cyan', 'Ciano', 'Cian'],
  ['purple', 'Purple', 'Roxo', 'Morado'], ['blue', 'Blue', 'Azul', 'Azul'],
  ['brown', 'Brown', 'Marrom', 'Marrón'], ['green', 'Green', 'Verde', 'Verde'],
  ['red', 'Red', 'Vermelho', 'Rojo'], ['black', 'Black', 'Preto', 'Negro'],
];
export const toolGroups = [
  {id: 'chisel', labels: label('Chisels', 'Cinzéis', 'Cinceles')},
  {id: 'gloves', labels: label('Construction Gloves', 'Luvas de Construção', 'Guantes de Construcción')},
  {id: 'glass_cutter', labels: label('Glass Cutters', 'Cortadores de Vidro', 'Cortadores de Vidrio')},
  {id: 'furniture_hammer', labels: label('Furniture Hammers', 'Martelos de Mobília', 'Martillos de Mobiliario')},
  {id: 'painting', labels: label('Painting: Buckets, Brushes & Rollers', 'Pintura: Baldes, Pincéis e Rolos', 'Pintura: Cubetas, Pinceles y Rodillos')},
];

async function walk(folder) {
  const entries = await fs.readdir(folder, {withFileTypes: true});
  const files = await Promise.all(entries.sort((a, b) => a.name.localeCompare(b.name, 'en')).map(entry =>
    entry.isDirectory() ? walk(path.join(folder, entry.name)) : [path.join(folder, entry.name)]));
  return files.flat();
}

export async function createCatalogSource() {
  const source = {};
  const allFiles = (await Promise.all(['BP', 'RP'].map(pack => walk(path.join(ROOT, pack))))).flat();
  for (const absolute of allFiles) {
    if (!/\.(json|js|lang|png|tga|jpg|jpeg)$/i.test(absolute)) continue;
    const file = path.relative(ROOT, absolute).replaceAll(path.sep, '/');
    const bytes = await fs.readFile(absolute);
    if (file.endsWith('.json')) {
      const errors = [];
      const value = parse(bytes.toString('utf8'), errors, {allowTrailingComma: true});
      if (errors.length) throw new Error(`${file}: ${printParseErrorCode(errors[0].error)}`);
      source[file] = Buffer.from(JSON.stringify(value));
    } else source[file] = bytes;
  }
  const read = async file => JSON.parse(await fs.readFile(path.join(ROOT, file), 'utf8'));
  const stones = (await read('content/stone-families.json')).variants;
  const stoneMap = new Map(stones.map(value => [value.id, value.family]));
  const colorData = (await read('content/concrete-colors.json')).colors;
  const colors = new Map(nativeColors.map(([id, ...names]) => [id, {id, labels: label(...names)}]));
  for (const color of colorData) colors.set(color.id, {id: color.id, labels: label(color.en, color.pt, color.es), hex: color.hex});
  colors.set('none', {id: 'none', labels: label('Uncolored', 'Sem cor', 'Sin color')});
  const colorTokens = [...colors.keys(), 'lima', 'silver'].sort((a, b) => b.length - a.length);
  const translations = Object.fromEntries(await Promise.all(Object.entries(locales).map(async ([locale, filename]) => {
    const text = await fs.readFile(path.join(ROOT, `RP/texts/${filename}.lang`), 'utf8');
    return [locale, new Map(text.split(/\r?\n/).filter(line => line.includes('=')).map(line => {
      const index = line.indexOf('=');
      return [line.slice(0, index), line.slice(index + 1).replace(/§./g, '')];
    }))];
  })));
  const blockLabel = (id, fallback) => Object.fromEntries(Object.entries(translations).map(([locale, values]) => {
    const direct = values.get(`tile.dorios_atelier:${id}.name`) ?? values.get(`tile.dorios_atelier:${id}`);
    if (direct) return [locale, direct];
    // A vanilla full block may only have Atelier translations for its shapes.
    const shaped = ['slab', 'stairs', 'wall', 'vertical_slab']
      .map(shape => values.get(`tile.dorios_atelier:${id}_${shape}.name`)).find(Boolean);
    const plain = shaped?.replace(/^(?:Laje Vertical|Laje|Escada|Muro|Losa Vertical|Losa|Escalera|Muro) (?:de |del )?/i, '')
      .replace(/ (?:Vertical Slab|Slab|Stairs|Wall)$/i, '');
    return [locale, plain ?? title(fallback)];
  }));

  const records = [];
  for (const [file, bytes] of Object.entries(source)) {
    if (!file.endsWith('.json') || !/^BP\/(blocks|items)\//.test(file)) continue;
    const document = JSON.parse(bytes);
    const block = document['minecraft:block'];
    const item = document['minecraft:item'];
    const id = (block ?? item)?.description?.identifier;
    if (!id) continue;
    if (item) {
      const folder = file.split('/')[2];
      const tool = folder === 'gloves' ? 'gloves' : folder;
      records.push({id, file, kind: toolGroups.some(group => group.id === tool) ? 'tool' : 'support', tool});
      continue;
    }
    const name = id.split(':')[1];
    const suffix = name.match(/_(vertical_slab|slab|stairs|wall|carpet)$/)?.[1];
    const shape = suffix ?? 'block';
    const base = suffix ? name.slice(0, -suffix.length - 1) : name;
    const token = colorTokens.find(color => base.startsWith(`${color}_`) || (shape === 'carpet' && base === color));
    const color = token === 'lima' ? 'lime' : token === 'silver' ? 'light_gray' : token ?? 'none';
    let family;
    let variant;
    if (shape === 'carpet' || base.endsWith('_wool')) { family = 'wool'; variant = 'plain'; }
    else if (base.endsWith('_concrete')) { family = 'concrete'; variant = 'plain'; }
    else if (base.includes('glass')) {
      family = 'glass'; variant = base.replace(new RegExp(`^${token ?? '__'}_`), '').replace('clear_glass', 'clean_glass');
    } else {
      const wood = Object.keys(woods).sort((a, b) => b.length - a.length).find(wood => base === `sanded_${wood}_wood`);
      if (wood) { family = `${wood}_wood`; variant = 'sanded'; }
      else {
        family = stoneMap.get(base) ?? Object.keys(families).sort((a, b) => b.length - a.length)
          .find(material => `_${base}_`.includes(`_${material}_`))
          ?? (base.includes('cobblestone') ? 'stone' : null);
        if (!family) throw new Error(`Assign a builder family for ${id}`);
        if (family === 'hardened_netherrack') family = 'netherrack';
        variant = base;
      }
    }
    records.push({id, file, kind: 'block', family, variant, shape, color, base});
  }
  const groups = [...new Set(records.filter(record => record.kind === 'block').map(record => record.family))].map(id => {
    const entries = records.filter(record => record.family === id);
    const variants = [...new Set(entries.map(record => record.variant))].map(variant => {
      const representative = entries.find(record => record.variant === variant && record.shape === 'block' && record.color === 'none')
        ?? entries.find(record => record.variant === variant && record.shape === 'block')
        ?? entries.find(record => record.variant === variant);
      return {id: variant, labels: variant === 'plain' ? label('Standard', 'Padrão', 'Estándar')
        : variant === 'sanded' ? label('Sanded', 'Lixada', 'Lijada')
          : variant === 'stained_glass' ? label('Stained Glass', 'Vidro Tingido', 'Vidrio Teñido')
          : blockLabel(representative.base, representative.base)};
    });
    return {id, labels: families[id] ?? woods[id.replace(/_wood$/, '')] ?? label(title(id), title(id), title(id)),
      variants, shapes: [...new Set(entries.map(record => record.shape))],
      colors: [...new Set(entries.map(record => record.color))].map(color => colors.get(color))};
  }).sort((a, b) => a.labels.en.localeCompare(b.labels.en, 'en'));
  const manifest = JSON.parse(source['BP/manifest.json']);
  const hash = createHash('sha256');
  for (const [file, bytes] of Object.entries(source)) { hash.update(file); hash.update(bytes); }
  for (const file of ['catalog.mjs', 'selection.mjs', 'compiler.mjs', 'worker.mjs']) hash.update(await fs.readFile(path.join(ROOT, 'tools/package-builder', file)));
  const fingerprint = hash.digest('hex').slice(0, 20);
  return {source, catalog: {schemaVersion: 1, fingerprint,
    source: {version: manifest.header.version.join('.'), description: manifest.header.description.replace(/§./g, ''),
      minecraft: manifest.header.min_engine_version.join('.')},
    archive: `source-${fingerprint}.zip`, families: groups, tools: toolGroups, records}};
}
