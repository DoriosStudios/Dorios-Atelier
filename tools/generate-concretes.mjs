import { mkdir, readFile, rename } from "node:fs/promises";
import path from "node:path";
import colors from "../content/concrete-colors.json" with { type: "json" };
import { PROJECT_ROOT, readJson, stableJson, writeJson, writeText } from "./lib/project-index.mjs";
import { adaptShapeBlock, loadShapeTemplates } from "./lib/blocks-with-traits.mjs";
import { blockName, GROUP_TRANSLATIONS, LOCALES, localeFileName, parseLang, serializeLang } from "./lib/localization.mjs";

const WRITE = process.argv.includes("--write");
const CHECK = process.argv.includes("--check");
const templates = await loadShapeTemplates();
const CONCRETE_GROUP = "dorios_atelier:itemGroup.name.concreteExtra";
const directories = {
  block: "entire_blocks/Concrete", slab: "slabs", stairs: "stairs",
  vertical_slab: "vertical_slabs", wall: "walls",
};
const root = (file) => path.join(PROJECT_ROOT, file);
const registry = await readJson(root("RP/blocks.json"));
const atlas = await readJson(root("RP/textures/terrain_texture.json"));
const catalog = await readJson(root("BP/item_catalog/crafting_item_catalog.json"));
const policy = await readJson(root("content/variant-policy.json"));
const construction = catalog["minecraft:crafting_items_catalog"].categories.find((entry) => entry.category_name === "construction");
const changes = new Map();
const ids = [];
const retirements = new Set();
const retiredIds = new Set();
for (const color of colors.retiredColors ?? []) {
  if (!/^[a-z_]+$/.test(color.id) || colors.colors.some((active) => active.id === color.id)) {
    throw new Error(`Invalid or still-active retired concrete: ${color.id}`);
  }
  const base = `${color.id}_concrete`;
  delete atlas.texture_data[`dorios_atelier_${base}`];
  policy.materials = policy.materials.filter((entry) => entry.base !== base);
  const files = [
    `RP/textures/blocks/concrete/${base}.png`,
    `BP/recipes/concrete/${base}.json`,
  ];
  for (const [shape, directory] of Object.entries(directories)) {
    const name = shape === "block" ? base : `${base}_${shape}`;
    const identifier = `dorios_atelier:${name}`;
    retiredIds.add(identifier);
    delete registry[identifier];
    files.push(`BP/blocks/decorative/${directory}/${name}.json`);
    if (shape !== "block") {
      files.push(`BP/recipes/stonecutter/subtypes/${name}_from_${base}.json`);
      files.push(`BP/recipes/stonecutter/reset/${base}_from_${name}.json`);
    }
  }
  for (const file of files) {
    try { await readFile(root(file)); retirements.add(file); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
  }
}
const concreteIds = new Set(colors.colors.flatMap((color) => Object.keys(directories).map((shape) =>
  `dorios_atelier:${color.id}_concrete${shape === "block" ? "" : `_${shape}`}`)));
for (const identifier of retiredIds) concreteIds.add(identifier);

// Move only these concrete families, retaining every other catalog item.
for (const category of catalog["minecraft:crafting_items_catalog"].categories) {
  category.groups = category.groups.filter((group) => {
    const hadConcrete = group.items?.some((identifier) => concreteIds.has(identifier));
    if (hadConcrete) group.items = group.items.filter((identifier) => !concreteIds.has(identifier));
    return !hadConcrete || group.items.length > 0 || group.group_identifier?.name === CONCRETE_GROUP;
  });
}
let concreteGroup = construction.groups.find((entry) => entry.group_identifier?.name === CONCRETE_GROUP);
if (!concreteGroup) {
  concreteGroup = {
    group_identifier: { icon: `dorios_atelier:${colors.colors[0].id}_concrete`, name: CONCRETE_GROUP },
    items: [],
  };
  construction.groups.push(concreteGroup);
}

async function queueJson(file, document, indentation = 2) {
  let current;
  try { current = await readJson(root(file)); } catch (error) { if (error.code !== "ENOENT") throw error; }
  if (stableJson(current) !== stableJson(document)) changes.set(file, { document, indentation });
}

for (const color of colors.colors) {
  const base = `${color.id}_concrete`;
  const source = `dorios_atelier:${base}`;
  const texture = `dorios_atelier_${base}`;
  atlas.texture_data[texture] = { textures: [`textures/blocks/concrete/${base}`] };
  const material = {
    "minecraft:material_instances": { "*": {
      texture, render_method: "opaque", ambient_occlusion: true, face_dimming: true,
    } },
    "minecraft:destructible_by_mining": { seconds_to_destroy: 1.8 },
    "minecraft:destructible_by_explosion": { explosion_resistance: 1.8 },
    "minecraft:map_color": color.hex,
    "tag:minecraft:is_pickaxe_item_destructible": {},
    "tag:minecraft:wood_tier_destructible": {},
    "tag:stone": {},
  };

  for (const shape of Object.keys(directories)) {
    const name = shape === "block" ? base : `${base}_${shape}`;
    const identifier = `dorios_atelier:${name}`;
    ids.push(identifier);
    let document = {
      format_version: "1.26.10",
      "minecraft:block": {
        description: { identifier, menu_category: { category: "construction", group: CONCRETE_GROUP } },
        components: structuredClone(material),
      },
    };
    if (shape === "block") {
      Object.assign(document["minecraft:block"].components, {
        "minecraft:geometry": "minecraft:geometry.full_block",
        "minecraft:light_dampening": 15,
        "minecraft:flammable": false,
        "minecraft:redstone_conductivity": { allows_wire_to_step_down: true, redstone_conductor: true },
      });
    } else {
      document = adaptShapeBlock(templates[shape], document);
    }
    await queueJson(`BP/blocks/decorative/${directories[shape]}/${name}.json`, document);
    registry[identifier] = { sound: "stone", textures: texture };
    concreteGroup.items.push(identifier);
  }

  const nextPolicy = {
    base, source,
    variants: { slab: "generate", stairs: "generate", vertical_slab: "generate", wall: "generate" },
    notes: color.paletteSource === "spectrum_expansion"
      ? "Colored concrete; common stone material. Locally selected spectrum-expansion palette."
      : "Colored concrete; common stone material. Palette from Ascendant Technology UI panels.",
  };
  const existing = policy.materials.findIndex((entry) => entry.base === base);
  if (existing === -1) policy.materials.push(nextPolicy);
  else policy.materials[existing] = nextPolicy;

  // Standard eight-block recoloring batch using the matching custom dye.
  await queueJson(`BP/recipes/concrete/${base}.json`, {
    format_version: "1.21.100",
    "minecraft:recipe_shapeless": {
      description: { identifier: `dorios_atelier:craft_${base}` },
      tags: ["crafting_table"],
      ingredients: [...Array.from({ length: 8 }, () => ({ item: "minecraft:white_concrete" })),
        { item: `dorios_atelier:${color.id}_dye` }],
      result: { item: source, count: 8 },
      unlock: [{ item: "minecraft:white_concrete" }],
    },
  });
}

await queueJson("RP/blocks.json", registry);
await queueJson("RP/textures/terrain_texture.json", atlas);
await queueJson("BP/item_catalog/crafting_item_catalog.json", catalog);
await queueJson("content/variant-policy.json", policy, 4);

for (const locale of LOCALES) {
  const file = `RP/texts/${localeFileName(locale)}`;
  const current = await readFile(root(file), "utf8");
  const entries = parseLang(current);
  for (const identifier of retiredIds) entries.delete(`tile.${identifier}.name`);
  entries.set(CONCRETE_GROUP, GROUP_TRANSLATIONS[locale].concreteExtra);
  for (const identifier of ids) {
    const name = identifier.split(":")[1];
    entries.set(`tile.${identifier}.name`, blockName(name, locale));
  }
  const next = serializeLang(entries);
  if (next !== current.replaceAll("\r\n", "\n")) changes.set(file, { text: next });
}

console.log(`Concrete families: ${colors.colors.length} colors, ${ids.length} blocks, ${changes.size} file(s) ${WRITE ? "to write" : "different"}.`);
console.log(`Retired concrete outputs: ${retirements.size} file(s) ${WRITE ? "to archive" : "remaining"}.`);
if (WRITE) {
  const archive = root(`builds/retired-concretes/${new Date().toISOString().replaceAll(":", "-")}`);
  for (const file of retirements) {
    const source = root(file);
    const destination = path.join(archive, file);
    for (const target of [source, destination]) {
      const relative = path.relative(PROJECT_ROOT, target);
      if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error(`Outside project: ${target}`);
    }
    await mkdir(path.dirname(destination), { recursive: true });
    await rename(source, destination);
  }
  if (retirements.size) console.log(`Recoverable archive: ${archive}`);
  for (const [file, change] of changes) {
    if (change.document && change.indentation === 4) await writeText(root(file), JSON.stringify(change.document, null, 4));
    else if (change.document) await writeJson(root(file), change.document);
    else await writeText(root(file), change.text);
  }
}
if (CHECK && (changes.size || retirements.size)) process.exitCode = 1;
