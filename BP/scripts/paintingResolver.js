import {BlockTypes} from '@minecraft/server';
import {PAINT_COLORS} from './paintingData.js';

const COLOR_ALIASES = {silver: 'light_gray', lima: 'lime'};
const COLOR_PREFIXES = [...Object.keys(PAINT_COLORS), ...Object.keys(COLOR_ALIASES)]
  .sort((a, b) => b.length - a.length);
const UNCOLORED_FAMILIES = {
  'minecraft:glass': 'stained_glass',
  'minecraft:glass_pane': 'stained_glass_pane',
  'minecraft:hardened_clay': 'terracotta',
  'minecraft:terracotta': 'terracotta',
};
const CACHE_LIMIT = 4096;
const targets = new Map();

function familyNames(family) {
  // These spellings describe the same Atelier glass finish.
  if (/^clear_glass(?:_|$)/.test(family)) return [family, family.replace(/^clear_glass/, 'clean_glass')];
  if (/^clean_glass(?:_|$)/.test(family)) return [family, family.replace(/^clean_glass/, 'clear_glass')];
  return [family];
}

function findTarget(identifier, color) {
  const separator = identifier.indexOf(':');
  if (separator < 1) return undefined;
  const namespace = identifier.slice(0, separator);
  const name = identifier.slice(separator + 1);
  const prefix = COLOR_PREFIXES.find(candidate => name.startsWith(`${candidate}_`));
  const family = UNCOLORED_FAMILIES[identifier] ?? (prefix ? name.slice(prefix.length + 1) : name);
  if (!family) return undefined;
  // An already-colored center may still anchor a roller stroke on its neighbors.
  if (prefix && (COLOR_ALIASES[prefix] ?? prefix) === color) return identifier;

  // Keep another add-on's block in its own namespace. Only Minecraft and
  // Atelier exchange destinations, e.g. vanilla white wool <-> extra navy wool.
  const namespaces = namespace === 'minecraft' ? ['minecraft', 'dorios_atelier']
    : namespace === 'dorios_atelier' ? ['dorios_atelier', 'minecraft'] : [namespace];
  const spellings = [color, ...Object.keys(COLOR_ALIASES).filter(alias => COLOR_ALIASES[alias] === color)];
  for (const candidateNamespace of namespaces) {
    for (const candidateFamily of familyNames(family)) {
      for (const spelling of spellings) {
        const target = `${candidateNamespace}:${spelling}_${candidateFamily}`;
        if (BlockTypes.get(target)) return target;
      }
    }
  }
  return undefined;
}

export function resolvePaintTarget(identifier, color) {
  if (typeof identifier !== 'string' || !Object.prototype.hasOwnProperty.call(PAINT_COLORS, color)) return undefined;
  const key = `${identifier}|${color}`;
  if (targets.has(key)) return targets.get(key);
  const target = findTarget(identifier, color);
  // Cache missing destinations too. Bound memory without scanning players or blocks.
  if (targets.size >= CACHE_LIMIT) targets.delete(targets.keys().next().value);
  targets.set(key, target);
  return target;
}
