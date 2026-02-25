from __future__ import annotations

import copy
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

MATERIALS_NEW = ["blackstone", "calcite", "diorite", "dripstone", "granite", "obsidian", "tuff"]
MATERIALS_ALL = ["andesite", "basalt", *MATERIALS_NEW]


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=4) + "\n", encoding="utf-8")


def configure_obsidian_common_components(components: dict) -> None:
    components["minecraft:destructible_by_mining"] = {"seconds_to_destroy": 40}
    components["minecraft:destructible_by_explosion"] = False
    if "tag:minecraft:stone_tier_destructible" in components:
        del components["tag:minecraft:stone_tier_destructible"]
    components["tag:minecraft:diamond_tier_destructible"] = {}


def generate_vertical_slabs() -> None:
    template_path = ROOT / "Data/blocks/decorative/vertical_slabs/andesite_tiles_vertical_slab.json"
    template = read_json(template_path)

    for material in MATERIALS_NEW:
        data = copy.deepcopy(template)
        block = data["minecraft:block"]
        block["description"]["identifier"] = f"utilitycraft:{material}_tiles_vertical_slab"
        block["components"]["minecraft:material_instances"]["*"]["texture"] = f"utilitycraft_{material}_tiles"

        if material == "obsidian":
            configure_obsidian_common_components(block["components"])

        out_path = ROOT / f"Data/blocks/decorative/vertical_slabs/{material}_tiles_vertical_slab.json"
        write_json(out_path, data)


def generate_three_step_stairs() -> None:
    template_path = ROOT / "Data/blocks/decorative/unique_stairs/andesite_tiles_three_steps_stairs.json"
    template = read_json(template_path)

    for material in MATERIALS_ALL:
        data = copy.deepcopy(template)
        block = data["minecraft:block"]
        block["description"]["identifier"] = f"utilitycraft:{material}_tiles_three_steps_stairs"
        block["description"]["menu_category"] = {"category": "construction"}
        block["components"]["minecraft:geometry"]["culling"] = f"utilitycraft:culling.{material}_tiles_three_steps_stairs"
        block["components"]["minecraft:material_instances"]["*"]["texture"] = f"utilitycraft_{material}_tiles"

        if material == "obsidian":
            configure_obsidian_common_components(block["components"])

        out_path = ROOT / f"Data/blocks/decorative/unique_stairs/{material}_tiles_three_steps_stairs.json"
        write_json(out_path, data)


def generate_three_step_culling() -> None:
    template_path = ROOT / "Assets/block_culling/andesite_tiles_three_steps_stairs.json"
    template = read_json(template_path)

    for material in MATERIALS_NEW:
        data = copy.deepcopy(template)
        data["minecraft:block_culling_rules"]["description"]["identifier"] = (
            f"utilitycraft:culling.{material}_tiles_three_steps_stairs"
        )
        out_path = ROOT / f"Assets/block_culling/{material}_tiles_three_steps_stairs.json"
        write_json(out_path, data)


def make_stonecutter_recipe(material: str, variant: str, count: int) -> dict:
    # variant: "three_steps_stairs" | "vertical_slab"
    return {
        "format_version": "1.21.100",
        "minecraft:recipe_shapeless": {
            "description": {
                "identifier": f"utilitycraft:sc_{material}_tiles_{variant}_from_{material}_tiles"
            },
            "tags": ["stonecutter"],
            "ingredients": [{"item": f"utilitycraft:{material}_tiles"}],
            "result": {"item": f"utilitycraft:{material}_tiles_{variant}", "count": count},
            "unlock": [{"item": f"utilitycraft:{material}_tiles"}],
        },
    }


def generate_custom_recipes() -> None:
    base_dir = ROOT / "Data/recipes/stonecutter"
    base_dir.mkdir(parents=True, exist_ok=True)

    for material in MATERIALS_NEW:
        three_steps = make_stonecutter_recipe(material, "three_steps_stairs", 1)
        vertical = make_stonecutter_recipe(material, "vertical_slab", 2)

        write_json(base_dir / f"{material}_tiles_three_steps_stairs_from_{material}_tiles.json", three_steps)
        write_json(base_dir / f"{material}_tiles_vertical_slab_from_{material}_tiles.json", vertical)


def update_catalog() -> None:
    path = ROOT / "Data/item_catalog/crafting_item_catalog.json"
    data = read_json(path)

    construction = next(
        c for c in data["minecraft:crafting_items_catalog"]["categories"] if c["category_name"] == "construction"
    )
    groups = construction["groups"]

    stone_group = next(
        g for g in groups if g["group_identifier"]["name"] == "dorios:itemGroup.name.stoneBricks"
    )
    stone_group["items"] = [
        item
        for item in stone_group["items"]
        if not item.endswith("_tiles_vertical_slab") and not item.endswith("_tiles_three_steps_stairs")
    ]

    groups = [
        g
        for g in groups
        if g["group_identifier"]["name"]
        not in {"dorios:itemGroup.name.customVariants", "dorios:itemGroup.name.threeStepStairs", "dorios:itemGroup.name.verticalSlabs"}
    ]

    vertical_group = {
        "group_identifier": {
            "icon": "utilitycraft:andesite_tiles_vertical_slab",
            "name": "dorios:itemGroup.name.verticalSlabs",
        },
        "items": [f"utilitycraft:{m}_tiles_vertical_slab" for m in MATERIALS_ALL],
    }

    three_step_group = {
        "group_identifier": {
            "icon": "utilitycraft:andesite_tiles_three_steps_stairs",
            "name": "dorios:itemGroup.name.threeStepStairs",
        },
        "items": [f"utilitycraft:{m}_tiles_three_steps_stairs" for m in MATERIALS_ALL],
    }

    insert_index = 1 if groups else 0
    groups.insert(insert_index, vertical_group)
    groups.insert(insert_index + 1, three_step_group)

    construction["groups"] = groups
    write_json(path, data)


def ensure_lang_entries(path: Path, entries: dict[str, str]) -> None:
    text = path.read_text(encoding="utf-8")
    lines = text.splitlines()
    existing = {line.split("=", 1)[0] for line in lines if "=" in line and not line.startswith("##")}

    additions = [f"{k}={v}" for k, v in entries.items() if k not in existing]
    if not additions:
        return

    if text and not text.endswith("\n"):
        text += "\n"
    if text and not text.endswith("\n\n"):
        text += "\n"
    text += "\n".join(additions) + "\n"
    path.write_text(text, encoding="utf-8")


def update_lang_files() -> None:
    en_material = {
        "blackstone": "Blackstone",
        "calcite": "Calcite",
        "diorite": "Diorite",
        "dripstone": "Dripstone",
        "granite": "Granite",
        "obsidian": "Obsidian",
        "tuff": "Tuff",
    }
    pt_material = {
        "blackstone": "Pedra-Negra",
        "calcite": "Calcita",
        "diorite": "Diorito",
        "dripstone": "Espeleotema",
        "granite": "Granito",
        "obsidian": "Obsidiana",
        "tuff": "Tufo",
    }
    es_material = {
        "blackstone": "Blackstone",
        "calcite": "Calcita",
        "diorite": "Diorita",
        "dripstone": "Dripstone",
        "granite": "Granito",
        "obsidian": "Obsidiana",
        "tuff": "Tufo",
    }

    en_entries: dict[str, str] = {
        "dorios:itemGroup.name.threeStepStairs": "Three-Step Stairs",
        "dorios:itemGroup.name.verticalSlabs": "Vertical Slabs",
    }
    pt_entries: dict[str, str] = {
        "dorios:itemGroup.name.threeStepStairs": "Escadas de Três Degraus",
        "dorios:itemGroup.name.verticalSlabs": "Lajes Verticais",
    }
    es_entries: dict[str, str] = {
        "dorios:itemGroup.name.threeStepStairs": "Escaleras de Tres Peldaños",
        "dorios:itemGroup.name.verticalSlabs": "Losas Verticales",
    }

    for material, label in en_material.items():
        en_entries[f"tile.utilitycraft:{material}_tiles_vertical_slab.name"] = f"{label} Tiles Vertical Slab"
        en_entries[f"tile.utilitycraft:{material}_tiles_three_steps_stairs.name"] = f"{label} Tiles Three-Step Stairs"

    for material, label in pt_material.items():
        pt_entries[f"tile.utilitycraft:{material}_tiles_vertical_slab.name"] = f"Laje Vertical de Ladrilhos de {label}"
        pt_entries[f"tile.utilitycraft:{material}_tiles_three_steps_stairs.name"] = (
            f"Escada de Três Degraus de Ladrilhos de {label}"
        )

    for material, label in es_material.items():
        es_entries[f"tile.utilitycraft:{material}_tiles_vertical_slab.name"] = f"Losa Vertical de Losetas de {label}"
        es_entries[f"tile.utilitycraft:{material}_tiles_three_steps_stairs.name"] = (
            f"Escalera de Tres Peldaños de Losetas de {label}"
        )

    ensure_lang_entries(ROOT / "Assets/texts/en_US.lang", en_entries)
    ensure_lang_entries(ROOT / "Assets/texts/pt_BR.lang", pt_entries)
    ensure_lang_entries(ROOT / "Assets/texts/es_MX.lang", es_entries)


def main() -> None:
    generate_vertical_slabs()
    generate_three_step_stairs()
    generate_three_step_culling()
    generate_custom_recipes()
    update_catalog()
    update_lang_files()


if __name__ == "__main__":
    main()
