import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import spec from "../content/concrete-colors.json" with { type: "json" };
import creative from "../content/dye-catalog.json" with { type: "json" };
import { PROJECT_ROOT, readJson, stableJson, writeJson, writeText } from "./lib/project-index.mjs";
import { GROUP_TRANSLATIONS, itemName, LOCALES, localeFileName, parseLang, serializeLang } from "./lib/localization.mjs";

const WRITE = process.argv.includes("--write");
const CHECK = process.argv.includes("--check");
const GROUP = creative.group;
assert.equal(creative.order.length, spec.colors.length, "Every dye must appear exactly once in the creative order.");
assert.deepEqual(new Set(creative.order), new Set(spec.colors.map((color) => color.id)), "Creative order must contain all active dye colors.");
const colorsById = new Map(spec.colors.map((color) => [color.id, color]));
const root = (file) => path.join(PROJECT_ROOT, file);
const atlas = await readJson(root("RP/textures/item_texture.json"));
const catalog = await readJson(root("BP/item_catalog/crafting_item_catalog.json"));
const categories = catalog["minecraft:crafting_items_catalog"].categories;
let nature = categories.find((entry) => entry.category_name === "nature");
if (!nature) { nature = { category_name: "nature", groups: [] }; categories.push(nature); }
const managedIds = new Set([...spec.colors, ...(spec.retiredColors ?? [])].map((color) => `dorios_atelier:${color.id}_dye`));
for (const category of categories) {
  category.groups = category.groups.filter((entry) => {
    const hadManaged = entry.items.some((id) => managedIds.has(id));
    entry.items = entry.items.filter((id) => !managedIds.has(id));
    // Remove only the emptied legacy dye registration, retaining unrelated entries.
    return !(hadManaged && entry.items.length === 0 && entry.group_identifier?.name === "minecraft:itemGroup.name.dye");
  });
}
let group = nature.groups.find((entry) => entry.group_identifier?.name === GROUP);
if (!group) {
  group = { group_identifier: { icon: `dorios_atelier:${creative.order[0]}_dye`, name: GROUP }, items: [] };
  nature.groups.push(group);
}
group.group_identifier.icon = `dorios_atelier:${creative.order[0]}_dye`;
const changes = new Map();
async function queue(file, document) {
  let current;
  try { current = await readJson(root(file)); } catch (error) { if (error.code !== "ENOENT") throw error; }
  if (stableJson(current) !== stableJson(document)) changes.set(file, { document });
}
for (const color of spec.retiredColors ?? []) delete atlas.texture_data[`dorios_atelier_${color.id}_dye`];
for (const colorId of creative.order) {
  const color = colorsById.get(colorId);
  const name = `${color.id}_dye`;
  const identifier = `dorios_atelier:${name}`;
  const texture = `dorios_atelier_${name}`;
  group.items.push(identifier);
  atlas.texture_data[texture] = { textures: `textures/items/dyes/${name}` };
  await queue(`BP/items/dyes/${name}.json`, {
    format_version: "1.21.100",
    "minecraft:item": {
      description: { identifier, menu_category: { category: "nature", group: GROUP } },
      components: { "minecraft:max_stack_size": 64, "minecraft:icon": texture },
    },
  });
  await queue(`BP/recipes/dyes/${name}.json`, {
    format_version: "1.21.100",
    "minecraft:recipe_shapeless": {
      description: { identifier: `dorios_atelier:craft_${name}` },
      tags: ["crafting_table"],
      ingredients: color.dyes.map((dye) => ({ item: `minecraft:${dye}_dye` })),
      result: { item: identifier, count: 2 },
      unlock: color.dyes.map((dye) => ({ item: `minecraft:${dye}_dye` })),
    },
  });
}
await queue("RP/textures/item_texture.json", atlas);
await queue("BP/item_catalog/crafting_item_catalog.json", catalog);
for (const locale of LOCALES) {
  const file = `RP/texts/${localeFileName(locale)}`;
  const current = await readFile(root(file), "utf8");
  const entries = parseLang(current);
  entries.set(GROUP, GROUP_TRANSLATIONS[locale].dyes);
  for (const color of spec.retiredColors ?? []) entries.delete(`item.dorios_atelier:${color.id}_dye`);
  for (const color of spec.colors) entries.set(`item.dorios_atelier:${color.id}_dye`, itemName(`${color.id}_dye`, locale));
  const text = serializeLang(entries);
  if (text !== current.replaceAll("\r\n", "\n")) changes.set(file, { text });
}
console.log(`Dyes: ${spec.colors.length} items and mixing recipes; ${changes.size} file(s) ${WRITE ? "to write" : "different"}.`);
if (WRITE) {
  for (const [file, change] of changes) {
    if (change.document) await writeJson(root(file), change.document);
    else await writeText(root(file), change.text);
  }
}
if (CHECK && changes.size) process.exitCode = 1;
