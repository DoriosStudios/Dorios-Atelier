// chisel.js
import { system, world } from "@minecraft/server";
import { MATERIAL_CYCLES, BLOCK_ALIAS } from "./variants.js";

const CHISEL_COMPONENT_ID = "utilitycraft:chisel";

/* --- helpers de string --- */
function stripNamespace(id) {
  const parts = id.split(":");
  return parts.length > 1 ? parts.slice(1).join(":") : parts[0];
}
function tokensOf(name) {
  return name.split("_").filter(Boolean);
}

/* --- preprocessa ciclos (a partir de MATERIAL_CYCLES importado) --- */
const CYCLES = [];
for (const states of MATERIAL_CYCLES) {
  const tokenCount = new Map();
  const stateInfos = states.map((fullId) => {
    const name = stripNamespace(fullId);
    const toks = tokensOf(name);
    toks.forEach((t) => tokenCount.set(t, (tokenCount.get(t) || 0) + 1));
    return { id: fullId, name, toks, variant: null };
  });

  let material = null;
  let best = -1;
  for (const [tok, cnt] of tokenCount.entries()) {
    if (cnt > best) {
      best = cnt;
      material = tok;
    }
  }
  if (!material) material = stateInfos[0].toks.slice(-1)[0] || stateInfos[0].name;

  stateInfos.forEach((si) => {
    const toksCopy = si.toks.slice();
    const idx = toksCopy.indexOf(material);
    if (idx !== -1) toksCopy.splice(idx, 1);
    si.variant = toksCopy.length ? toksCopy.join("_") : "base";
  });

  const idxByName = new Map();
  const idxByVariant = new Map();
  stateInfos.forEach((si, i) => {
    idxByName.set(si.name, i);
    idxByVariant.set(si.variant, i);
  });

  CYCLES.push({ material, states: stateInfos, idxByName, idxByVariant });
}

/* lookup exato (id -> { cycleIndex, stateIndex }) */
const BLOCK_LOOKUP = new Map();
CYCLES.forEach((cycle, ci) => {
  cycle.states.forEach((si, siIndex) => {
    BLOCK_LOOKUP.set(si.id, { cycleIndex: ci, stateIndex: siIndex });
  });
});

/* alias resolver */
function resolveAlias(blockId) {
  let cur = blockId;
  const visited = new Set();
  while (BLOCK_ALIAS.has(cur) && !visited.has(cur)) {
    visited.add(cur);
    cur = BLOCK_ALIAS.get(cur);
  }
  return cur;
}

/* find entry heurístico para blockId */
function findEntryForBlockId(blockId) {
  const aliased = resolveAlias(blockId);
  if (BLOCK_LOOKUP.has(aliased)) return BLOCK_LOOKUP.get(aliased);

  const name = stripNamespace(blockId);
  for (const [id, entry] of BLOCK_LOOKUP.entries()) {
    if (stripNamespace(id) === name) return entry;
  }

  const parsedTokens = tokensOf(name);
  for (let ci = 0; ci < CYCLES.length; ci++) {
    const cycle = CYCLES[ci];
    if (!parsedTokens.includes(cycle.material)) continue;

    const toksCopy = parsedTokens.slice();
    toksCopy.splice(toksCopy.indexOf(cycle.material), 1);
    const parsedVariant = toksCopy.length ? toksCopy.join("_") : "base";

    const variantIndex = cycle.idxByVariant.get(parsedVariant);
    if (variantIndex !== undefined)
      return { cycleIndex: ci, stateIndex: variantIndex };

    for (let si = 0; si < cycle.states.length; si++) {
      const sname = cycle.states[si].name;
      if (sname === name || sname.includes(name) || name.includes(sname)) {
        return { cycleIndex: ci, stateIndex: si };
      }
    }
    return { cycleIndex: ci, stateIndex: 0 };
  }

  for (let ci = 0; ci < CYCLES.length; ci++) {
    const cycle = CYCLES[ci];
    let shared = false;
    for (const t of parsedTokens) {
      for (const st of cycle.states) {
        if (st.toks.includes(t)) {
          shared = true;
          break;
        }
      }
      if (shared) break;
    }
    if (shared) return { cycleIndex: ci, stateIndex: 0 };
  }

  return undefined;
}

/* build next candidate id (tentativa de pular variantes ausentes) */
function buildCandidatesForState(stateInfo, originalNamespace) {
  const seen = new Set();
  const candidatesForState = [];
  const push = (id) => {
    if (id && !seen.has(id)) {
      seen.add(id);
      candidatesForState.push(id);
    }
  };

  const declaredId = stateInfo.id;
  const stripped = stateInfo.name;

  push(declaredId);

  for (const keyId of BLOCK_LOOKUP.keys()) {
    if (stripNamespace(keyId) === stripped) push(keyId);
  }

  push(`${originalNamespace}:${stripped}`);
  push(`minecraft:${stripped}`);
  push(`utilitycraft:${stripped}`);

  return candidatesForState;
}

/* tentativa segura de obter o próximo bloco disponível, pulando variantes inexistentes */
function tryApplyNextVariant(block) {
  const currentEntry = findEntryForBlockId(block.typeId) || BLOCK_LOOKUP.get(resolveAlias(block.typeId));
  if (!currentEntry) return false;

  const cycle = CYCLES[currentEntry.cycleIndex];
  const len = cycle.states.length;

  // garantia: não permitir mudança de material — só proceder se o token material existir no bloco atual
  const originalTokens = tokensOf(stripNamespace(block.typeId));
  if (!originalTokens.includes(cycle.material)) return false;

  const originalNamespace = (block.typeId && block.typeId.split && block.typeId.split(":")[0]) || "minecraft";

  const triedGlobal = new Set();
  for (let step = 1; step <= len; step++) {
    const idx = (currentEntry.stateIndex + step) % len;
    const stateInfo = cycle.states[idx];
    const candidates = buildCandidatesForState(stateInfo, originalNamespace);

    for (const candidateId of candidates) {
      if (triedGlobal.has(candidateId)) continue;
      triedGlobal.add(candidateId);
      try {
        block.setType(candidateId);
        return true;
      } catch (_) {
        continue;
      }
    }
  }

  return false;
}

/* dano/consumo do formão — mais robusto e tolerante:
   - tenta usar slot selecionado
   - se não, procura a primeira pilha no container com mesmo typeId
   - modifica o slot correto (remove se quebrar)
*/
function damageHeldChisel(player, eventItemStack) {
  system.run(() => {
    try {
      const inventoryComp = player.getComponent("minecraft:inventory");
      if (!inventoryComp) return;
      const container = inventoryComp.container;
      if (!container) return;

      let slot = (player.selectedSlotIndex !== undefined && player.selectedSlotIndex !== null)
        ? player.selectedSlotIndex
        : undefined;

      let stack = (slot !== undefined) ? container.getItem(slot) : undefined;

      if (!stack && eventItemStack) {
        const maxSlots = (typeof container.size === "number") ? container.size : 36;
        for (let i = 0; i < maxSlots; i++) {
          const s = container.getItem(i);
          if (!s) continue;
          if (s.typeId === eventItemStack.typeId) { stack = s; slot = i; break; }
        }
      }

      if (!stack || slot === undefined || slot === null) return;

      const durability = stack.getComponent?.("minecraft:durability");
      if (!durability) return;

      const broke = durability.damage(1);
      if (broke) {
        container.setItem(slot, undefined);
        return;
      }

      container.setItem(slot, stack);
    } catch (_) {
      // silencioso por design (removido debug)
    }
  });
}

/* registro do componente customizado */
system.beforeEvents.startup.subscribe((initEvent) => {
  initEvent.itemComponentRegistry.registerCustomComponent(CHISEL_COMPONENT_ID, {
    onUseOn(event) {
      try {
        const { block, source, itemStack } = event;
        if (!block || !source || !itemStack) return;

        const applied = tryApplyNextVariant(block);
        if (!applied) return;

        try {
          const dim = block.dimension;
          if (dim && typeof dim.playSound === "function") {
            dim.playSound("block.stonecutter.use", block.location, { volume: 1, pitch: 1 });
          } else if (typeof source.playSound === "function") {
            source.playSound("block.stonecutter.use");
          }
        } catch (_) {}

        damageHeldChisel(source, itemStack);
      } catch (_) {}
    },
  });
});
