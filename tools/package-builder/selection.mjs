// Shared by the website and the compiler. No filesystem or Minecraft imports.
export function defaultSelection(catalog, enabled = true) {
  return {
    families: Object.fromEntries(catalog.families.map(family => [family.id, {
      enabled,
      variants: family.variants.map(value => value.id),
      shapes: [...family.shapes],
      colors: family.colors.map(value => value.id),
    }])),
    tools: enabled ? catalog.tools.map(value => value.id) : [],
  };
}

export function selectedRecords(catalog, selection) {
  const tools = new Set(selection?.tools ?? []);
  return catalog.records.filter(record => {
    if (record.kind === 'tool') return tools.has(record.tool);
    if (record.kind !== 'block') return false;
    const family = selection?.families?.[record.family];
    return family?.enabled && family.variants?.includes(record.variant)
      && family.shapes?.includes(record.shape) && family.colors?.includes(record.color);
  });
}
