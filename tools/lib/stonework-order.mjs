// Preserve the existing Stonework entries and place generated full blocks next
// to their material family. Other creative groups are outside this rule.
const MATERIAL_ORDER = [
  'andesite', 'basalt', 'blackstone', 'calcite', 'deepslate', 'diorite',
  'dripstone', 'end_stone', 'granite', 'mud', 'nether', 'netherrack',
  'prismarine', 'purpur', 'quartz', 'stone', 'tuff', 'obsidian',
];
const FINISH_ORDER = [
  '', 'cobbled', 'polished', 'smooth', 'bricks', 'tiles', 'chiseled',
  'chiseled_bricks', 'chiseled_tiles', 'cracked_bricks', 'cracked_tiles',
  'polished_tiling', 'carved', 'pillar', 'tiles_pillar', 'chiseled_pillar',
];

function materialRank(name) {
  const index = MATERIAL_ORDER.findIndex(material => `_${name}_`.includes(`_${material}_`));
  return index < 0 ? MATERIAL_ORDER.length : index;
}

function finishRank(variant) {
  const finish = variant.id.replace(variant.family, '').split('_').filter(Boolean).join('_');
  const index = FINISH_ORDER.indexOf(finish);
  return index < 0 ? FINISH_ORDER.length : index;
}

export function orderGeneratedStonework(catalog, variants) {
  const group = catalog['minecraft:crafting_items_catalog']?.categories
    ?.flatMap(category => category.groups ?? [])
    .find(entry => entry.group_identifier?.name === 'dorios_atelier:itemGroup.name.stoneBricks');
  if (!group) throw new Error('Stonework creative group was not found.');

  const generated = new Map(variants.map(variant => [`dorios_atelier:${variant.id}`, variant]));
  const ordered = group.items.filter(identifier => !generated.has(identifier));
  const families = [...new Set(group.items.filter(identifier => generated.has(identifier))
    .map(identifier => generated.get(identifier).family))]
    .sort((left, right) => materialRank(left) - materialRank(right) || left.localeCompare(right, 'en'));

  for (const family of families) {
    const items = group.items.filter(identifier => generated.get(identifier)?.family === family)
      .sort((left, right) => finishRank(generated.get(left)) - finishRank(generated.get(right))
        || left.localeCompare(right, 'en'));
    let insertAt = 0;
    for (let index = 0; index < ordered.length; index++) {
      const name = generated.get(ordered[index])?.family ?? ordered[index].split(':').pop();
      if (materialRank(name) <= materialRank(family)) insertAt = index + 1;
    }
    ordered.splice(insertAt, 0, ...items);
  }
  group.items = ordered;
  return catalog;
}
