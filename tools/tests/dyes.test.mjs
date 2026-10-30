import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import spec from "../../content/concrete-colors.json" with { type: "json" };
import { PROJECT_ROOT, readJson } from "../lib/project-index.mjs";
import { GROUP_TRANSLATIONS, itemName, LOCALES, parseLang } from "../lib/localization.mjs";

const root = (file) => path.join(PROJECT_ROOT, file);
test("all 22 dyes have icons, translations and unique creative entries", async () => {
  const atlas = await readJson(root("RP/textures/item_texture.json"));
  const catalog = await readJson(root("BP/item_catalog/crafting_item_catalog.json"));
  const allItems = catalog["minecraft:crafting_items_catalog"].categories.flatMap((category) => category.groups.flatMap((group) => group.items));
  const languages = new Map(await Promise.all(LOCALES.map(async (locale) => [locale, parseLang(await readFile(root(`RP/texts/${locale}.lang`), "utf8"))])));
  for (const color of spec.colors) {
    const name = `${color.id}_dye`;
    const id = `dorios_atelier:${name}`;
    const item = (await readJson(root(`BP/items/dyes/${name}.json`)))["minecraft:item"];
    assert.equal(item.description.identifier, id);
    assert.deepEqual(item.description.menu_category, { category: "nature", group: "dorios_atelier:itemGroup.name.dyes" });
    assert.equal(item.components["minecraft:max_stack_size"], 64);
    const texture = atlas.texture_data[item.components["minecraft:icon"]].textures;
    await access(root(`RP/${texture}.png`));
    assert.equal(allItems.filter((entry) => entry === id).length, 1);
    for (const locale of LOCALES) assert.equal(languages.get(locale).get(`item.${id}`), itemName(name, locale));
  }
  for (const retired of spec.retiredColors) {
    assert.ok(!allItems.includes(`dorios_atelier:${retired.id}_dye`));
    await assert.rejects(access(root(`BP/items/dyes/${retired.id}_dye.json`)), { code: "ENOENT" });
  }
});

test("the localized nature dye group follows the two creator screenshots exactly", async () => {
  const catalog = await readJson(root("BP/item_catalog/crafting_item_catalog.json"));
  const categories = catalog["minecraft:crafting_items_catalog"].categories;
  const groups = categories.flatMap((category) => category.groups
    .filter((group) => group.group_identifier?.name === "dorios_atelier:itemGroup.name.dyes")
    .map((group) => ({ category: category.category_name, ...group })));
  assert.equal(groups.length, 1);
  assert.equal(groups[0].category, "nature");
  assert.equal(groups[0].group_identifier.icon, "dorios_atelier:sand_dye");
  const expected = [
    "sand", "peach", "coral", "scarlet", "wine", "rose", "burgundy", "dusty_purple",
    "lavender", "slate", "indigo", "navy", "aqua", "teal", "mint", "emerald",
    "forest", "chartreuse", "olive", "ivory", "amber", "copper",
  ].map((color) => `dorios_atelier:${color}_dye`);
  assert.deepEqual(groups[0].items, expected);
  for (const locale of LOCALES) {
    const entries = parseLang(await readFile(root(`RP/texts/${locale}.lang`), "utf8"));
    assert.equal(entries.get(groups[0].group_identifier.name), GROUP_TRANSLATIONS[locale].dyes);
  }
});

test("mixing conserves dye count and yields the item used in concrete recipes", async () => {
  for (const color of spec.colors) {
    const id = `dorios_atelier:${color.id}_dye`;
    const mixing = (await readJson(root(`BP/recipes/dyes/${color.id}_dye.json`)))["minecraft:recipe_shapeless"];
    assert.deepEqual(mixing.ingredients, color.dyes.map((dye) => ({ item: `minecraft:${dye}_dye` })));
    assert.deepEqual(mixing.result, { item: id, count: 2 });
    const concrete = (await readJson(root(`BP/recipes/concrete/${color.id}_concrete.json`)))["minecraft:recipe_shapeless"];
    assert.equal(concrete.ingredients.filter((entry) => entry.item === id).length, 1);
    assert.equal(concrete.result.count, 8);
  }
});
