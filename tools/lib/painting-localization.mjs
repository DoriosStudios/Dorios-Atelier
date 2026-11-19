import concreteColors from '../../content/concrete-colors.json' with {type: 'json'};

export const VANILLA_PAINT_COLORS = ['white', 'light_gray', 'gray', 'black', 'brown', 'red', 'orange', 'yellow', 'lime', 'green', 'cyan', 'light_blue', 'blue', 'purple', 'magenta', 'pink'];
const vanillaNames = {
  en_US: ['White', 'Light Gray', 'Gray', 'Black', 'Brown', 'Red', 'Orange', 'Yellow', 'Lime', 'Green', 'Cyan', 'Light Blue', 'Blue', 'Purple', 'Magenta', 'Pink'],
  pt_BR: ['Branca', 'Cinza-clara', 'Cinza', 'Preta', 'Marrom', 'Vermelha', 'Laranja', 'Amarela', 'Verde-limão', 'Verde', 'Ciano', 'Azul-clara', 'Azul', 'Roxa', 'Magenta', 'Rosa'],
  pt_PT: ['Branca', 'Cinzenta-clara', 'Cinzenta', 'Preta', 'Castanha', 'Vermelha', 'Laranja', 'Amarela', 'Verde-lima', 'Verde', 'Ciano', 'Azul-clara', 'Azul', 'Roxa', 'Magenta', 'Cor-de-rosa'],
  es_ES: ['Blanca', 'Gris Clara', 'Gris', 'Negra', 'Marrón', 'Roja', 'Naranja', 'Amarilla', 'Verde Lima', 'Verde', 'Cian', 'Azul Clara', 'Azul', 'Morada', 'Magenta', 'Rosa'],
  es_MX: ['Blanca', 'Gris Clara', 'Gris', 'Negra', 'Café', 'Roja', 'Naranja', 'Amarilla', 'Verde Lima', 'Verde', 'Cian', 'Azul Clara', 'Azul', 'Morada', 'Magenta', 'Rosa'],
};
export function paintColorName(color, locale) {
  const index = VANILLA_PAINT_COLORS.indexOf(color);
  if (index >= 0) return vanillaNames[locale][index];
  const extra = concreteColors.colors.find(entry => entry.id === color);
  return extra?.[locale === 'en_US' ? 'en' : locale.startsWith('pt_') ? 'pt' : 'es'];
}
export function paintItemName(identifier, locale, materials) {
  const bucket = /^(.*)_paint_bucket$/.exec(identifier);
  if (bucket) {
    if (bucket[1] === 'empty') return {en_US: 'Empty Paint Bucket', pt_BR: 'Balde de Tinta Vazio', pt_PT: 'Balde de Tinta Vazio', es_ES: 'Cubo de Pintura Vacío', es_MX: 'Cubeta de Pintura Vacía'}[locale];
    const color = paintColorName(bucket[1], locale);
    if (!color) throw new Error(`Unknown paint color: ${bucket[1]}`);
    if (locale === 'en_US') return `${color} Paint Bucket`;
    if (locale.startsWith('pt_')) return `Balde de Tinta ${color}`;
    return `${locale === 'es_MX' ? 'Cubeta' : 'Cubo'} de Pintura ${color}`;
  }
  const tool = /^(wooden|stone|copper|iron|golden|diamond|netherite)_(paintbrush|paint_roller)$/.exec(identifier);
  if (!tool) return undefined;
  const names = {en_US: ['Paintbrush', 'Paint Roller'], pt_BR: ['Pincel', 'Rolo de Tinta'], pt_PT: ['Pincel', 'Rolo de Pintura'], es_ES: ['Pincel', 'Rodillo de Pintura'], es_MX: ['Pincel', 'Rodillo de Pintura']};
  const type = names[locale][tool[2] === 'paintbrush' ? 0 : 1];
  return locale === 'en_US' ? `${materials[tool[1]]} ${type}` : `${type} de ${materials[tool[1]]}`;
}
export const PAINT_GROUP_NAMES = {
  en_US: ['Paint Buckets', 'Paintbrushes', 'Paint Rollers'],
  pt_BR: ['Baldes de Tinta', 'Pincéis', 'Rolos de Tinta'],
  pt_PT: ['Baldes de Tinta', 'Pincéis', 'Rolos de Tinta'],
  es_ES: ['Cubos de Pintura', 'Pinceles', 'Rodillos de Pintura'],
  es_MX: ['Cubetas de Pintura', 'Pinceles', 'Rodillos de Pintura'],
};
export const PAINT_MESSAGES = {
  en_US: {group: 'Painting', need_bucket: 'Hold a filled paint bucket in your offhand to load this tool.', need_dip: 'Use this tool with a filled paint bucket in your offhand to load a color.', matching_bucket: 'Hold a paint bucket matching the loaded color in your offhand.', need_tool: 'Hold a paintbrush or paint roller in your main hand and place the paint bucket in your offhand.', loaded: 'Paint color loaded.', cleaned: 'Paint washed off.', already_clean: 'This tool is already clean.', loaded_color: '§7Paint: §r%1', no_change: 'No eligible blocks need this color.'},
  pt_BR: {group: 'Pintura', need_bucket: 'Segure um balde de tinta cheio na segunda mão para carregar a ferramenta.', need_dip: 'Use a ferramenta com um balde de tinta cheio na segunda mão para carregar uma cor.', matching_bucket: 'Segure na segunda mão um balde com a cor carregada na ferramenta.', need_tool: 'Segure um pincel ou rolo de tinta na mão principal e coloque o balde na segunda mão.', loaded: 'Cor de tinta carregada.', cleaned: 'Tinta removida da ferramenta.', already_clean: 'Esta ferramenta já está limpa.', loaded_color: '§7Tinta: §r%1', no_change: 'Nenhum bloco elegível precisa desta cor.'},
  pt_PT: {group: 'Pintura', need_bucket: 'Segure um balde de tinta cheio na mão secundária para carregar a ferramenta.', need_dip: 'Use a ferramenta com um balde de tinta cheio na mão secundária para carregar uma cor.', matching_bucket: 'Segure na mão secundária um balde com a cor carregada na ferramenta.', need_tool: 'Segure um pincel ou rolo de pintura na mão principal e coloque o balde na mão secundária.', loaded: 'Cor de tinta carregada.', cleaned: 'Tinta removida da ferramenta.', already_clean: 'Esta ferramenta já está limpa.', loaded_color: '§7Tinta: §r%1', no_change: 'Nenhum bloco elegível precisa desta cor.'},
  es_ES: {group: 'Pintura', need_bucket: 'Sostén un cubo de pintura lleno en la mano secundaria para cargar la herramienta.', need_dip: 'Usa la herramienta con un cubo de pintura lleno en la mano secundaria para cargar un color.', matching_bucket: 'Sostén en la mano secundaria un cubo del color cargado en la herramienta.', need_tool: 'Sostén un pincel o rodillo de pintura en la mano principal y coloca el cubo en la mano secundaria.', loaded: 'Color de pintura cargado.', cleaned: 'Pintura eliminada de la herramienta.', already_clean: 'Esta herramienta ya está limpia.', loaded_color: '§7Pintura: §r%1', no_change: 'Ningún bloque compatible necesita este color.'},
  es_MX: {group: 'Pintura', need_bucket: 'Sostén una cubeta de pintura llena en la mano secundaria para cargar la herramienta.', need_dip: 'Usa la herramienta con una cubeta de pintura llena en la mano secundaria para cargar un color.', matching_bucket: 'Sostén en la mano secundaria una cubeta del color cargado en la herramienta.', need_tool: 'Sostén un pincel o rodillo de pintura en la mano principal y coloca la cubeta en la mano secundaria.', loaded: 'Color de pintura cargado.', cleaned: 'Pintura eliminada de la herramienta.', already_clean: 'Esta herramienta ya está limpia.', loaded_color: '§7Pintura: §r%1', no_change: 'Ningún bloque compatible necesita este color.'},
};
