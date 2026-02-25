from __future__ import annotations

"""
Generate slab/stairs/three-step/vertical variants for uniform-texture full blocks.

What this tool does
-------------------
1. Maps full blocks in `Data/blocks/decorative/entire_blocks` that:
   - have a string texture entry in `Assets/blocks.json` (same texture on all faces), and
   - do not yet have slab and/or stairs variants.
2. Generates missing files for:
    - block definitions (`slabs` + `stairs` + `unique_stairs` + `vertical_slabs`)
   - culling definitions (`Assets/block_culling`)
   - stonecutter recipes (`Data/recipes/stonecutter`)
3. Updates:
    - `Assets/blocks.json` (sound + texture entries for new variants)
    - `Data/item_catalog/crafting_item_catalog.json` (removes accidental vanilla slab/stairs groups and syncs custom groups)
   - `Data/scripts/stairs.js` (STAIR_IDS list)
4. Writes a mapping report to:
   - `tools/generated/uniform_variant_targets.json`

Configuration arrays
--------------------
- FORCE_INCLUDE_IDS: always include these block identifiers.
- FORCE_EXCLUDE_IDS: always exclude these block identifiers.

Examples
--------
- Default (stone-only):
  python tools/generate_uniform_variants.py

- Include non-stone blocks too:
  python tools/generate_uniform_variants.py --include-non-stone

- Only map and print (no file changes):
  python tools/generate_uniform_variants.py --dry-run
"""

import argparse
import copy
import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]

FORCE_INCLUDE_IDS: list[str] = []
FORCE_EXCLUDE_IDS: list[str] = []

REPORT_PATH = ROOT / "tools/generated/uniform_variant_targets.json"

ENTIRE_BLOCKS_DIR = ROOT / "Data/blocks/decorative/entire_blocks"
SLABS_DIR = ROOT / "Data/blocks/decorative/slabs"
STAIRS_DIR = ROOT / "Data/blocks/decorative/stairs"
UNIQUE_STAIRS_DIR = ROOT / "Data/blocks/decorative/unique_stairs"
CULLING_DIR = ROOT / "Assets/block_culling"
STONECUTTER_DIR = ROOT / "Data/recipes/stonecutter"

ASSETS_BLOCKS_PATH = ROOT / "Assets/blocks.json"
CATALOG_PATH = ROOT / "Data/item_catalog/crafting_item_catalog.json"
STAIRS_SCRIPT_PATH = ROOT / "Data/scripts/stairs.js"

SLAB_TEMPLATE_PATH = SLABS_DIR / "andesite_tiles_slab.json"
STAIRS_TEMPLATE_PATH = STAIRS_DIR / "andesite_tiles_stairs.json"
THREE_STEP_STAIRS_TEMPLATE_PATH = UNIQUE_STAIRS_DIR / "andesite_tiles_three_steps_stairs.json"
VERTICAL_SLAB_TEMPLATE_PATH = ROOT / "Data/blocks/decorative/vertical_slabs/andesite_tiles_vertical_slab.json"
ENTIRE_BLOCK_TEMPLATE_PATH = ENTIRE_BLOCKS_DIR / "andesite_bricks.json"
SLAB_CULLING_TEMPLATE_PATH = CULLING_DIR / "andesite_tiles_slab.json"
STAIRS_CULLING_TEMPLATE_PATH = CULLING_DIR / "andesite_tiles_stairs.json"
THREE_STEP_STAIRS_CULLING_TEMPLATE_PATH = CULLING_DIR / "andesite_tiles_three_steps_stairs.json"

SLAB_GROUP_NAME = "minecraft:itemGroup.name.slab"
STAIRS_GROUP_NAME = "minecraft:itemGroup.name.stairs"
VERTICAL_SLABS_GROUP_NAME = "dorios:itemGroup.name.verticalSlabs"
THREE_STEP_STAIRS_GROUP_NAME = "dorios:itemGroup.name.threeStepStairs"

VARIANT_SUFFIXES = (
    "three_steps_stairs",
    "vertical_slab",
    "stairs",
    "slab",
)


@dataclass
class TargetBlock:
    identifier: str
    base_name: str
    texture: str
    sound: str
    is_stone: bool
    has_slab: bool
    has_stairs: bool
    has_three_steps_stairs: bool
    has_vertical_slab: bool
    source_components: dict[str, Any]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate slab/stairs/three-step/vertical variants for uniform-texture blocks.")
    parser.add_argument(
        "--include-non-stone",
        action="store_true",
        help="Also generate for non-stone blocks (default maps stone-tagged blocks only).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Only map and report targets, without writing files.",
    )
    parser.add_argument(
        "--import-vanilla-compatible",
        action="store_true",
        help="Import compatible vanilla decorative blocks from a vanilla blocks.json before generating variants.",
    )
    parser.add_argument(
        "--vanilla-blocks-json",
        type=Path,
        default=None,
        help="Path to vanilla resource_pack blocks.json used for texture/sound lookup.",
    )
    parser.add_argument(
        "--vanilla-list",
        type=Path,
        default=ROOT / "tools/vanilla_blocks_list.md",
        help="Path to markdown file containing minecraft:<block_id> entries.",
    )
    return parser.parse_args()


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=4) + "\n", encoding="utf-8")


def extract_vanilla_ids_from_markdown(markdown_text: str) -> list[str]:
    matches = re.findall(r"minecraft:[a-z0-9_]+", markdown_text)
    return sorted(set(matches))


def build_entire_block_from_template(
    template: dict[str, Any],
    identifier: str,
    texture: str,
) -> dict[str, Any]:
    data = copy.deepcopy(template)
    block = data["minecraft:block"]
    block["description"]["identifier"] = identifier

    components = block.get("components", {})
    material_instances = components.get("minecraft:material_instances")
    if isinstance(material_instances, dict) and "*" in material_instances:
        material_instances["*"]["texture"] = texture

    return data


def import_vanilla_compatible_blocks(
    vanilla_blocks_json_path: Path,
    vanilla_list_path: Path,
    dry_run: bool,
) -> dict[str, int]:
    if not vanilla_blocks_json_path.exists():
        raise FileNotFoundError(f"Vanilla blocks.json not found: {vanilla_blocks_json_path}")
    if not vanilla_list_path.exists():
        raise FileNotFoundError(f"Vanilla block list not found: {vanilla_list_path}")

    vanilla_blocks = read_json(vanilla_blocks_json_path)
    vanilla_ids = extract_vanilla_ids_from_markdown(vanilla_list_path.read_text(encoding="utf-8"))
    entire_template = read_json(ENTIRE_BLOCK_TEMPLATE_PATH)
    assets_data = read_json(ASSETS_BLOCKS_PATH)

    imported_entire_blocks = 0
    imported_assets_entries = 0
    skipped_missing_vanilla_entry = 0
    skipped_non_uniform_texture = 0
    skipped_already_existing = 0

    for vanilla_id in vanilla_ids:
        vanilla_name = vanilla_id.split(":", 1)[1]
        custom_id = f"utilitycraft:{vanilla_name}"
        custom_path = ENTIRE_BLOCKS_DIR / f"{vanilla_name}.json"

        vanilla_entry = vanilla_blocks.get(vanilla_name)
        if not isinstance(vanilla_entry, dict):
            skipped_missing_vanilla_entry += 1
            continue

        texture = vanilla_entry.get("textures")
        if not isinstance(texture, str):
            skipped_non_uniform_texture += 1
            continue

        if custom_path.exists() or custom_id in FORCE_EXCLUDE_IDS:
            skipped_already_existing += 1
        else:
            payload = build_entire_block_from_template(entire_template, custom_id, texture)
            if not dry_run:
                write_json(custom_path, payload)
            imported_entire_blocks += 1

        if custom_id not in assets_data:
            assets_data[custom_id] = {
                "sound": str(vanilla_entry.get("sound", "stone")),
                "textures": texture,
            }
            imported_assets_entries += 1

    if not dry_run and imported_assets_entries:
        write_json(ASSETS_BLOCKS_PATH, assets_data)

    return {
        "vanilla_ids_in_list": len(vanilla_ids),
        "imported_entire_blocks": imported_entire_blocks,
        "imported_assets_entries": imported_assets_entries,
        "skipped_missing_vanilla_entry": skipped_missing_vanilla_entry,
        "skipped_non_uniform_texture": skipped_non_uniform_texture,
        "skipped_already_existing": skipped_already_existing,
    }


def find_targets(include_non_stone: bool) -> list[TargetBlock]:
    blocks_assets = read_json(ASSETS_BLOCKS_PATH)
    targets: list[TargetBlock] = []

    for source_path in sorted(ENTIRE_BLOCKS_DIR.glob("*.json")):
        source = read_json(source_path)
        source_block = source.get("minecraft:block", {})
        source_description = source_block.get("description", {})
        source_components = source_block.get("components", {})

        identifier = source_description.get("identifier")
        if not identifier or identifier in FORCE_EXCLUDE_IDS:
            continue

        asset_entry = blocks_assets.get(identifier)
        if not isinstance(asset_entry, dict):
            continue

        texture_value = asset_entry.get("textures")
        if isinstance(texture_value, dict):
            # Multi-face texture block: out of this tool's scope.
            continue
        if not isinstance(texture_value, str):
            continue

        is_stone = "tag:stone" in source_components
        if not is_stone and not include_non_stone and identifier not in FORCE_INCLUDE_IDS:
            continue

        base_name = identifier.split(":", 1)[1]
        slab_path = SLABS_DIR / f"{base_name}_slab.json"
        stairs_path = STAIRS_DIR / f"{base_name}_stairs.json"
        has_slab = slab_path.exists()
        has_stairs = stairs_path.exists()
        has_three_steps_stairs = (UNIQUE_STAIRS_DIR / f"{base_name}_three_steps_stairs.json").exists()
        has_vertical_slab = (ROOT / "Data/blocks/decorative/vertical_slabs" / f"{base_name}_vertical_slab.json").exists()

        if has_slab and has_stairs and has_three_steps_stairs and has_vertical_slab and identifier not in FORCE_INCLUDE_IDS:
            continue

        targets.append(
            TargetBlock(
                identifier=identifier,
                base_name=base_name,
                texture=texture_value,
                sound=str(asset_entry.get("sound", "stone")),
                is_stone=is_stone,
                has_slab=has_slab,
                has_stairs=has_stairs,
                has_three_steps_stairs=has_three_steps_stairs,
                has_vertical_slab=has_vertical_slab,
                source_components=source_components,
            )
        )

    return targets


def apply_source_behavior(target_components: dict[str, Any], source_components: dict[str, Any]) -> None:
    # Remove tag keys from template and re-apply tags from source.
    for key in [k for k in target_components.keys() if k.startswith("tag:")]:
        del target_components[key]

    if "minecraft:destructible_by_mining" in source_components:
        target_components["minecraft:destructible_by_mining"] = copy.deepcopy(
            source_components["minecraft:destructible_by_mining"]
        )

    for optional_key in (
        "minecraft:destructible_by_explosion",
        "minecraft:light_dampening",
        "minecraft:light_emission",
    ):
        if optional_key in source_components:
            target_components[optional_key] = copy.deepcopy(source_components[optional_key])
        elif optional_key in target_components:
            del target_components[optional_key]

    for key, value in source_components.items():
        if key.startswith("tag:"):
            target_components[key] = copy.deepcopy(value)


def generate_slab_block(template: dict[str, Any], target: TargetBlock) -> dict[str, Any]:
    data = copy.deepcopy(template)
    block = data["minecraft:block"]
    components = block["components"]

    block["description"]["identifier"] = f"utilitycraft:{target.base_name}_slab"
    components["minecraft:geometry"]["culling"] = f"utilitycraft:culling.{target.base_name}_slab"
    components["minecraft:material_instances"]["*"]["texture"] = target.texture

    apply_source_behavior(components, target.source_components)
    return data


def generate_stairs_block(template: dict[str, Any], target: TargetBlock) -> dict[str, Any]:
    data = copy.deepcopy(template)
    block = data["minecraft:block"]
    components = block["components"]

    block["description"]["identifier"] = f"utilitycraft:{target.base_name}_stairs"
    components["minecraft:geometry"]["culling"] = f"utilitycraft:culling.{target.base_name}_stairs"
    components["minecraft:material_instances"]["*"]["texture"] = target.texture

    apply_source_behavior(components, target.source_components)
    return data


def generate_three_steps_stairs_block(template: dict[str, Any], target: TargetBlock) -> dict[str, Any]:
    data = copy.deepcopy(template)
    block = data["minecraft:block"]
    components = block["components"]

    block["description"]["identifier"] = f"utilitycraft:{target.base_name}_three_steps_stairs"
    components["minecraft:geometry"]["culling"] = f"utilitycraft:culling.{target.base_name}_three_steps_stairs"
    components["minecraft:material_instances"]["*"]["texture"] = target.texture

    apply_source_behavior(components, target.source_components)
    return data


def generate_vertical_slab_block(template: dict[str, Any], target: TargetBlock) -> dict[str, Any]:
    data = copy.deepcopy(template)
    block = data["minecraft:block"]
    components = block["components"]

    block["description"]["identifier"] = f"utilitycraft:{target.base_name}_vertical_slab"
    components["minecraft:material_instances"]["*"]["texture"] = target.texture

    apply_source_behavior(components, target.source_components)
    return data


def generate_slab_culling(template: dict[str, Any], base_name: str) -> dict[str, Any]:
    data = copy.deepcopy(template)
    data["minecraft:block_culling_rules"]["description"]["identifier"] = f"utilitycraft:culling.{base_name}_slab"
    return data


def generate_stairs_culling(template: dict[str, Any], base_name: str) -> dict[str, Any]:
    data = copy.deepcopy(template)
    data["minecraft:block_culling_rules"]["description"]["identifier"] = f"utilitycraft:culling.{base_name}_stairs"
    return data


def generate_three_steps_stairs_culling(template: dict[str, Any], base_name: str) -> dict[str, Any]:
    data = copy.deepcopy(template)
    data["minecraft:block_culling_rules"]["description"]["identifier"] = f"utilitycraft:culling.{base_name}_three_steps_stairs"
    return data


def make_stonecutter_recipe(base_name: str, variant_suffix: str, result_count: int) -> dict[str, Any]:
    source_id = f"utilitycraft:{base_name}"
    result_id = f"utilitycraft:{base_name}_{variant_suffix}"
    return {
        "format_version": "1.21.100",
        "minecraft:recipe_shapeless": {
            "description": {
                "identifier": f"utilitycraft:sc_{base_name}_{variant_suffix}_from_{base_name}"
            },
            "tags": ["stonecutter"],
            "ingredients": [{"item": source_id}],
            "result": {"item": result_id, "count": result_count},
            "unlock": [{"item": source_id}],
        },
    }


def split_variant_item_name(item_name: str) -> tuple[str, str] | None:
    for suffix in VARIANT_SUFFIXES:
        marker = f"_{suffix}"
        if item_name.endswith(marker):
            return item_name[: -len(marker)], suffix
    return None


def make_reverse_stonecutter_recipe(base_item_id: str, variant_item_id: str, variant_suffix: str) -> dict[str, Any]:
    ingredient_count = 2 if variant_suffix in {"slab", "vertical_slab"} else 1
    ingredients = [{"item": variant_item_id} for _ in range(ingredient_count)]

    base_name = base_item_id.split(":", 1)[1]
    variant_name = variant_item_id.split(":", 1)[1]

    return {
        "format_version": "1.21.100",
        "minecraft:recipe_shapeless": {
            "description": {
                "identifier": f"utilitycraft:sc_{base_name}_from_{variant_name}"
            },
            "tags": ["stonecutter"],
            "ingredients": ingredients,
            "result": {"item": base_item_id, "count": 1},
            "unlock": [{"item": variant_item_id}],
        },
    }


def create_reverse_variant_recipes(dry_run: bool) -> tuple[int, int]:
    created_reverse_recipes = 0
    skipped_non_variant_recipes = 0

    for recipe_path in sorted(STONECUTTER_DIR.glob("*.json")):
        payload = read_json(recipe_path)
        recipe = payload.get("minecraft:recipe_shapeless", {})

        tags = recipe.get("tags", [])
        if "stonecutter" not in tags:
            continue

        ingredients = recipe.get("ingredients", [])
        result = recipe.get("result", {})
        result_item = result.get("item")
        if not isinstance(result_item, str):
            continue

        if not isinstance(ingredients, list) or not ingredients:
            continue

        first_ingredient = ingredients[0] if isinstance(ingredients[0], dict) else {}
        ingredient_item = first_ingredient.get("item")
        if not isinstance(ingredient_item, str):
            continue

        if not result_item.startswith("utilitycraft:") or not ingredient_item.startswith("utilitycraft:"):
            continue

        result_name = result_item.split(":", 1)[1]
        parsed_variant = split_variant_item_name(result_name)
        if parsed_variant is None:
            skipped_non_variant_recipes += 1
            continue

        base_name, variant_suffix = parsed_variant
        base_item_id = f"utilitycraft:{base_name}"
        variant_item_id = result_item

        reverse_file_name = f"{base_name}_from_{result_name}.json"
        reverse_path = STONECUTTER_DIR / reverse_file_name

        if reverse_path.exists():
            continue

        reverse_payload = make_reverse_stonecutter_recipe(base_item_id, variant_item_id, variant_suffix)
        if not dry_run:
            write_json(reverse_path, reverse_payload)
        created_reverse_recipes += 1

    return created_reverse_recipes, skipped_non_variant_recipes


def update_assets_blocks(targets: list[TargetBlock], dry_run: bool) -> tuple[int, int, int, int]:
    data = read_json(ASSETS_BLOCKS_PATH)
    created_slab_entries = 0
    created_stairs_entries = 0
    created_three_step_stairs_entries = 0
    created_vertical_slab_entries = 0

    for target in targets:
        slab_id = f"utilitycraft:{target.base_name}_slab"
        stairs_id = f"utilitycraft:{target.base_name}_stairs"
        three_steps_stairs_id = f"utilitycraft:{target.base_name}_three_steps_stairs"
        vertical_slab_id = f"utilitycraft:{target.base_name}_vertical_slab"

        if slab_id not in data:
            data[slab_id] = {"sound": target.sound, "textures": target.texture}
            created_slab_entries += 1
        if stairs_id not in data:
            data[stairs_id] = {"sound": target.sound, "textures": target.texture}
            created_stairs_entries += 1
        if three_steps_stairs_id not in data:
            data[three_steps_stairs_id] = {"sound": target.sound, "textures": target.texture}
            created_three_step_stairs_entries += 1
        if vertical_slab_id not in data:
            data[vertical_slab_id] = {"sound": target.sound, "textures": target.texture}
            created_vertical_slab_entries += 1

    if not dry_run and (
        created_slab_entries
        or created_stairs_entries
        or created_three_step_stairs_entries
        or created_vertical_slab_entries
    ):
        write_json(ASSETS_BLOCKS_PATH, data)

    return (
        created_slab_entries,
        created_stairs_entries,
        created_three_step_stairs_entries,
        created_vertical_slab_entries,
    )


def sync_or_create_group_items(
    groups: list[dict[str, Any]],
    group_name: str,
    icon: str,
    items: list[str],
) -> int:
    desired_items = sorted(set(items))
    for group in groups:
        current_name = group.get("group_identifier", {}).get("name")
        if current_name == group_name:
            current_items = group.get("items", [])
            if current_items != desired_items:
                group["items"] = desired_items
                return 1
            return 0

    groups.append(
        {
            "group_identifier": {
                "icon": icon,
                "name": group_name,
            },
            "items": desired_items,
        }
    )
    return 1


def collect_identifiers_from_dir(directory: Path) -> list[str]:
    identifiers: list[str] = []
    for path in sorted(directory.glob("*.json")):
        payload = read_json(path)
        identifier = payload.get("minecraft:block", {}).get("description", {}).get("identifier")
        if isinstance(identifier, str):
            identifiers.append(identifier)
    return identifiers


def update_crafting_catalog(dry_run: bool) -> tuple[int, int, int, int]:
    data = read_json(CATALOG_PATH)
    categories = data["minecraft:crafting_items_catalog"]["categories"]
    construction = next(category for category in categories if category["category_name"] == "construction")
    groups = construction["groups"]

    filtered_groups: list[dict[str, Any]] = []
    removed_slab_groups = 0
    removed_stairs_groups = 0

    for group in groups:
        group_name = group.get("group_identifier", {}).get("name")
        if group_name == SLAB_GROUP_NAME:
            removed_slab_groups += 1
            continue
        if group_name == STAIRS_GROUP_NAME:
            removed_stairs_groups += 1
            continue
        filtered_groups.append(group)

    construction["groups"] = filtered_groups

    vertical_slab_ids = collect_identifiers_from_dir(ROOT / "Data/blocks/decorative/vertical_slabs")
    three_step_stairs_ids = collect_identifiers_from_dir(UNIQUE_STAIRS_DIR)

    catalog_updates = 0
    catalog_updates += sync_or_create_group_items(
        construction["groups"],
        VERTICAL_SLABS_GROUP_NAME,
        "utilitycraft:andesite_tiles_vertical_slab",
        vertical_slab_ids,
    )
    catalog_updates += sync_or_create_group_items(
        construction["groups"],
        THREE_STEP_STAIRS_GROUP_NAME,
        "utilitycraft:andesite_tiles_three_steps_stairs",
        three_step_stairs_ids,
    )

    if not dry_run and (removed_slab_groups or removed_stairs_groups or catalog_updates):
        write_json(CATALOG_PATH, data)

    return removed_slab_groups, removed_stairs_groups, len(vertical_slab_ids), len(three_step_stairs_ids)


def update_stairs_script(dry_run: bool) -> int:
    stairs_ids = collect_identifiers_from_dir(STAIRS_DIR) + collect_identifiers_from_dir(UNIQUE_STAIRS_DIR)
    stairs_ids = sorted(set(stairs_ids))

    script = STAIRS_SCRIPT_PATH.read_text(encoding="utf-8")
    replacement_lines = ["const STAIR_IDS = new Set(["]
    for identifier in stairs_ids:
        replacement_lines.append(f'    "{identifier}",')
    replacement_lines.append("]);")
    replacement_block = "\n".join(replacement_lines)

    pattern = r"const STAIR_IDS = new Set\(\[(?:.|\n)*?\]\);"
    updated = re.sub(pattern, replacement_block, script, count=1)

    if updated != script and not dry_run:
        STAIRS_SCRIPT_PATH.write_text(updated, encoding="utf-8")

    return len(stairs_ids)


def build_report(targets: list[TargetBlock]) -> dict[str, Any]:
    return {
        "target_count": len(targets),
        "targets": [
            {
                "identifier": target.identifier,
                "base_name": target.base_name,
                "is_stone": target.is_stone,
                "has_slab": target.has_slab,
                "has_stairs": target.has_stairs,
                "has_three_steps_stairs": target.has_three_steps_stairs,
                "has_vertical_slab": target.has_vertical_slab,
                "texture": target.texture,
            }
            for target in targets
        ],
    }


def run_generation(targets: list[TargetBlock], dry_run: bool) -> dict[str, int]:
    slab_template = read_json(SLAB_TEMPLATE_PATH)
    stairs_template = read_json(STAIRS_TEMPLATE_PATH)
    three_step_stairs_template = read_json(THREE_STEP_STAIRS_TEMPLATE_PATH)
    vertical_slab_template = read_json(VERTICAL_SLAB_TEMPLATE_PATH)
    slab_culling_template = read_json(SLAB_CULLING_TEMPLATE_PATH)
    stairs_culling_template = read_json(STAIRS_CULLING_TEMPLATE_PATH)
    three_step_stairs_culling_template = read_json(THREE_STEP_STAIRS_CULLING_TEMPLATE_PATH)

    created_slab_blocks = 0
    created_stairs_blocks = 0
    created_three_steps_stairs_blocks = 0
    created_vertical_slabs = 0
    created_slab_culling = 0
    created_stairs_culling = 0
    created_three_steps_stairs_culling = 0
    created_slab_recipes = 0
    created_stairs_recipes = 0
    created_three_steps_stairs_recipes = 0
    created_vertical_slab_recipes = 0

    for target in targets:
        slab_block_path = SLABS_DIR / f"{target.base_name}_slab.json"
        stairs_block_path = STAIRS_DIR / f"{target.base_name}_stairs.json"
        three_step_stairs_block_path = UNIQUE_STAIRS_DIR / f"{target.base_name}_three_steps_stairs.json"
        vertical_slab_block_path = ROOT / "Data/blocks/decorative/vertical_slabs" / f"{target.base_name}_vertical_slab.json"
        slab_culling_path = CULLING_DIR / f"{target.base_name}_slab.json"
        stairs_culling_path = CULLING_DIR / f"{target.base_name}_stairs.json"
        three_step_stairs_culling_path = CULLING_DIR / f"{target.base_name}_three_steps_stairs.json"
        slab_recipe_path = STONECUTTER_DIR / f"{target.base_name}_slab_from_{target.base_name}.json"
        stairs_recipe_path = STONECUTTER_DIR / f"{target.base_name}_stairs_from_{target.base_name}.json"
        three_step_stairs_recipe_path = STONECUTTER_DIR / f"{target.base_name}_three_steps_stairs_from_{target.base_name}.json"
        vertical_slab_recipe_path = STONECUTTER_DIR / f"{target.base_name}_vertical_slab_from_{target.base_name}.json"

        if not slab_block_path.exists():
            if not dry_run:
                write_json(slab_block_path, generate_slab_block(slab_template, target))
            created_slab_blocks += 1

        if not stairs_block_path.exists():
            if not dry_run:
                write_json(stairs_block_path, generate_stairs_block(stairs_template, target))
            created_stairs_blocks += 1

        if not three_step_stairs_block_path.exists():
            if not dry_run:
                write_json(three_step_stairs_block_path, generate_three_steps_stairs_block(three_step_stairs_template, target))
            created_three_steps_stairs_blocks += 1

        if not vertical_slab_block_path.exists():
            if not dry_run:
                write_json(vertical_slab_block_path, generate_vertical_slab_block(vertical_slab_template, target))
            created_vertical_slabs += 1

        if not slab_culling_path.exists():
            if not dry_run:
                write_json(slab_culling_path, generate_slab_culling(slab_culling_template, target.base_name))
            created_slab_culling += 1

        if not stairs_culling_path.exists():
            if not dry_run:
                write_json(stairs_culling_path, generate_stairs_culling(stairs_culling_template, target.base_name))
            created_stairs_culling += 1

        if not three_step_stairs_culling_path.exists():
            if not dry_run:
                write_json(
                    three_step_stairs_culling_path,
                    generate_three_steps_stairs_culling(three_step_stairs_culling_template, target.base_name),
                )
            created_three_steps_stairs_culling += 1

        if not slab_recipe_path.exists():
            if not dry_run:
                write_json(slab_recipe_path, make_stonecutter_recipe(target.base_name, "slab", 2))
            created_slab_recipes += 1

        if not stairs_recipe_path.exists():
            if not dry_run:
                write_json(stairs_recipe_path, make_stonecutter_recipe(target.base_name, "stairs", 1))
            created_stairs_recipes += 1

        if not three_step_stairs_recipe_path.exists():
            if not dry_run:
                write_json(three_step_stairs_recipe_path, make_stonecutter_recipe(target.base_name, "three_steps_stairs", 1))
            created_three_steps_stairs_recipes += 1

        if not vertical_slab_recipe_path.exists():
            if not dry_run:
                write_json(vertical_slab_recipe_path, make_stonecutter_recipe(target.base_name, "vertical_slab", 2))
            created_vertical_slab_recipes += 1

    created_reverse_recipes, skipped_non_variant_recipes = create_reverse_variant_recipes(dry_run)

    (
        assets_slab_entries,
        assets_stairs_entries,
        assets_three_step_stairs_entries,
        assets_vertical_slab_entries,
    ) = update_assets_blocks(targets, dry_run)
    (
        removed_vanilla_slab_groups,
        removed_vanilla_stairs_groups,
        catalog_vertical_slab_items,
        catalog_three_step_stairs_items,
    ) = update_crafting_catalog(dry_run)
    tracked_stairs_ids = update_stairs_script(dry_run)

    return {
        "created_slab_blocks": created_slab_blocks,
        "created_stairs_blocks": created_stairs_blocks,
        "created_three_steps_stairs_blocks": created_three_steps_stairs_blocks,
        "created_vertical_slabs": created_vertical_slabs,
        "created_slab_culling": created_slab_culling,
        "created_stairs_culling": created_stairs_culling,
        "created_three_steps_stairs_culling": created_three_steps_stairs_culling,
        "created_slab_recipes": created_slab_recipes,
        "created_stairs_recipes": created_stairs_recipes,
        "created_three_steps_stairs_recipes": created_three_steps_stairs_recipes,
        "created_vertical_slab_recipes": created_vertical_slab_recipes,
        "created_reverse_variant_recipes": created_reverse_recipes,
        "skipped_non_variant_stonecutter_recipes": skipped_non_variant_recipes,
        "assets_slab_entries": assets_slab_entries,
        "assets_stairs_entries": assets_stairs_entries,
        "assets_three_step_stairs_entries": assets_three_step_stairs_entries,
        "assets_vertical_slab_entries": assets_vertical_slab_entries,
        "removed_vanilla_slab_groups": removed_vanilla_slab_groups,
        "removed_vanilla_stairs_groups": removed_vanilla_stairs_groups,
        "catalog_vertical_slab_items": catalog_vertical_slab_items,
        "catalog_three_step_stairs_items": catalog_three_step_stairs_items,
        "tracked_stairs_ids": tracked_stairs_ids,
    }


def main() -> None:
    args = parse_args()

    if args.import_vanilla_compatible:
        if args.vanilla_blocks_json is None:
            raise ValueError("--vanilla-blocks-json is required when --import-vanilla-compatible is used.")

        import_stats = import_vanilla_compatible_blocks(
            vanilla_blocks_json_path=args.vanilla_blocks_json,
            vanilla_list_path=args.vanilla_list,
            dry_run=args.dry_run,
        )

        print("Vanilla import summary:")
        for key, value in import_stats.items():
            print(f"- {key}: {value}")

    targets = find_targets(include_non_stone=args.include_non_stone)

    report = build_report(targets)
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    write_json(REPORT_PATH, report)

    print(f"Mapped targets: {len(targets)}")
    print(f"Report: {REPORT_PATH.relative_to(ROOT)}")

    if args.dry_run:
        print("Dry run enabled. No files were changed.")
        return

    stats = run_generation(targets, dry_run=False)
    print("Generation summary:")
    for key, value in stats.items():
        print(f"- {key}: {value}")


if __name__ == "__main__":
    main()
