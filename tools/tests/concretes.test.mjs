import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { MinecraftItemTypes } from "@minecraft/vanilla-data";
import spec from "../../content/concrete-colors.json" with { type: "json" };
import { PROJECT_ROOT, readJson } from "../lib/project-index.mjs";
import { blockName } from "../lib/localization.mjs";

const root = (file) => path.join(PROJECT_ROOT, file);
const directories = { block: "entire_blocks/Concrete", slab: "slabs", stairs: "stairs", vertical_slab: "vertical_slabs", wall: "walls" };

test("all concrete palettes register five common-stone shapes in the creative catalog", async () => {
  const registry = await readJson(root("RP/blocks.json"));
  const terrain = await readJson(root("RP/textures/terrain_texture.json"));
  const catalog = await readJson(root("BP/item_catalog/crafting_item_catalog.json"));
  const items = catalog["minecraft:crafting_items_catalog"].categories.flatMap((category) => category.groups.flatMap((group) => group.items));
  const concreteGroups = catalog["minecraft:crafting_items_catalog"].categories.flatMap((category) => category.groups)
    .filter((group) => group.group_identifier?.name === "dorios_atelier:itemGroup.name.concreteExtra");
  assert.equal(concreteGroups.length, 1);
  assert.equal(concreteGroups[0].items.length, 110);
  const policy = await readJson(root("content/variant-policy.json"));
  assert.equal(spec.colors.length, 22);
  assert.equal(new Set(spec.colors.map((color) => color.id)).size, 22);
  assert.equal(new Set(spec.colors.map((color) => color.hex)).size, 22);
  assert.ok(spec.colors.some((color) => color.id === "wine" && color.hex === "#7F2437"));
  for (const color of spec.retiredColors) {
    assert.ok(!spec.colors.some((active) => active.id === color.id));
    assert.ok(!Object.keys(registry).some((id) => id === `dorios_atelier:${color.id}_concrete` || id.startsWith(`dorios_atelier:${color.id}_concrete_`)));
    assert.ok(!policy.materials.some((entry) => entry.base === `${color.id}_concrete`));
  }
  for (const color of spec.colors) {
    const base = `${color.id}_concrete`;
    const texture = `dorios_atelier_${base}`;
    assert.deepEqual(terrain.texture_data[texture].textures, [`textures/blocks/concrete/${base}`]);
    const material = policy.materials.find((entry) => entry.base === base);
    assert.equal(material.source, `dorios_atelier:${base}`);
    assert.deepEqual(material.variants, { slab: "generate", stairs: "generate", vertical_slab: "generate", wall: "generate" });
    for (const [shape, directory] of Object.entries(directories)) {
      const name = shape === "block" ? base : `${base}_${shape}`;
      const id = `dorios_atelier:${name}`;
      const block = (await readJson(root(`BP/blocks/decorative/${directory}/${name}.json`)))["minecraft:block"];
      assert.equal(block.description.identifier, id);
      assert.equal(block.description.menu_category.group, "dorios_atelier:itemGroup.name.concreteExtra");
      assert.ok(concreteGroups[0].items.includes(id), id);
      assert.deepEqual(registry[id], { sound: "stone", textures: texture });
      assert.equal(items.filter((entry) => entry === id).length, 1, id);
      assert.equal(block.components["minecraft:map_color"], color.hex);
      assert.deepEqual(block.components["tag:stone"], {});
      assert.deepEqual(block.components["tag:minecraft:is_pickaxe_item_destructible"], {});
      assert.deepEqual(block.components["tag:minecraft:wood_tier_destructible"], {});
      assert.equal(block.components["minecraft:destructible_by_mining"].seconds_to_destroy, 1.8);
      assert.equal(block.components["minecraft:destructible_by_explosion"].explosion_resistance, 1.8);
    }
  }
  assert.equal(blockName("copper_concrete", "pt_BR"), "Concreto Cobre");
  assert.equal(blockName("aqua_concrete", "pt_PT"), "Betão Aqua");
  assert.equal(blockName("mint_concrete", "es_MX"), "Concreto Menta");
});

test("concrete dyeing fits nine slots and every stonecutter conversion has a lossless reset", async () => {
  const itemIds = new Set(Object.values(MinecraftItemTypes));
  const dyePairs = new Set();
  for (const color of spec.colors) {
    const base = `${color.id}_concrete`;
    const source = `dorios_atelier:${base}`;
    const craft = (await readJson(root(`BP/recipes/concrete/${base}.json`)))["minecraft:recipe_shapeless"];
    assert.deepEqual(craft.tags, ["crafting_table"]);
    assert.equal(craft.ingredients.length, 9);
    assert.equal(craft.ingredients.filter((ingredient) => ingredient.item === "minecraft:white_concrete").length, 8);
    assert.equal(craft.ingredients.filter((ingredient) => ingredient.item === `dorios_atelier:${color.id}_dye`).length, 1);
    assert.deepEqual(craft.result, { item: source, count: 8 });
    const pair = color.dyes.toSorted().join("+");
    assert.equal(dyePairs.has(pair), false, `Duplicate dye recipe: ${pair}`);
    dyePairs.add(pair);
    for (const dye of color.dyes) assert.ok(itemIds.has(`minecraft:${dye}_dye`), dye);
    for (const [shape, count] of Object.entries({ slab: 2, stairs: 1, vertical_slab: 2, wall: 1 })) {
      const forward = (await readJson(root(`BP/recipes/stonecutter/subtypes/${base}_${shape}_from_${base}.json`)))["minecraft:recipe_shapeless"];
      const reset = (await readJson(root(`BP/recipes/stonecutter/reset/${base}_from_${base}_${shape}.json`)))["minecraft:recipe_shapeless"];
      assert.deepEqual(forward.tags, ["stonecutter"]);
      assert.deepEqual(forward.ingredients, [{ item: source }]);
      assert.deepEqual(forward.result, { item: `${source}_${shape}`, count });
      assert.deepEqual(reset.tags, ["stonecutter"]);
      assert.equal(reset.ingredients.length, count);
      assert.ok(reset.ingredients.every((entry) => entry.item === `${source}_${shape}`));
      assert.deepEqual(reset.result, { item: source, count: 1 });
    }
  }
});
