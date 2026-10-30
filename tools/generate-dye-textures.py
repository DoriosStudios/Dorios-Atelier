"""Render individually authored 16x16 dye designs, using Dorios Pixel Art on write."""
import argparse
from hashlib import sha256
import json
from pathlib import Path
import sys
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent


def palette(hex_color):
    base = tuple(bytes.fromhex(hex_color[1:]))
    values = {key: tuple(round(v * factor) for v in base) for key, factor in [("a", .27), ("b", .43), ("c", .70), ("d", 1)]}
    for key, factor in [("e", .25), ("f", .49)]:
        values[key] = tuple(round(v + (255 - v) * factor) for v in base)
    values.update(g=(48, 36, 31), h=(125, 87, 53), i=(197, 151, 91), j=(184, 222, 234))
    return values


def make_plan(color, drawing, shared_references=None):
    pixels = []
    x0, y0 = drawing["offset"]
    for y, row in enumerate(drawing["rows"]):
        for x, value in enumerate(row):
            if value != ".":
                assert 1 <= x + x0 <= 14 and 1 <= y + y0 <= 14, (color["id"], x, y)
                pixels.append({"op": "pixel", "points": [[x + x0, y + y0]], "color": value})
    return {
        "size": [16, 16],
        "intent": {
            "identity": color["en"] + " dye: " + drawing["structure"],
            "usage": "crafting pigment for the matching concrete family",
            "material": "loose colored pigment with irregular mineral grains; the creator's wooden plate is composed separately underneath",
            "orientation": "authored inventory view; exact native pixel clusters",
            "lighting": "upper-left lit ridges; darker recesses and lower-right edges",
            "structure": [drawing["structure"], "unique authored silhouette", "restrained plane highlights"],
            "style": ["Minecraft-scale icon", "no antialiasing", "no resizing", "no shared recolored silhouette"],
        },
        "references": shared_references or drawing.get("references", [{
            "path": "tools/references/mojang/dye_powder_white.png",
            "sha256": "4e44ac3735fe264d695e448441896f754292958f8c3ce71ddb27a598a2946261",
            "purpose": "vanilla native scale, transparent framing and compact pigment clusters; not a tracing template",
            "approval": "Mojang source reference; new artwork has no recorded human approval",
        }]),
        "composition": {"min_margin": 1, "edge_contact": "forbid", "allow_clip": False},
        "palette": {**palette(color["hex"]), **drawing.get("palette", {})}, "base_color": "a",
        "silhouette": [{"op": p["op"], "points": p["points"]} for p in pixels],
        "layers": [{"name": "authored_clusters", "purpose": drawing["structure"] + "; exact material planes and folds", "commands": pixels}],
    }


def preview(entries, destination, silhouettes=False):
    cols, cw, ch = 6, 240, 208
    sheet = Image.new("RGBA", (cols * cw, ((len(entries) + cols - 1) // cols) * ch), (31, 32, 37, 255))
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default(size=14)
    for index, (color, drawing, icon) in enumerate(entries):
        x, y = (index % cols) * cw, (index // cols) * ch
        draw.text((x + 8, y + 8), color["en"], font=font, fill="white")
        draw.text((x + 8, y + 28), drawing["structure"][:31], font=font, fill=(184, 185, 193))
        if silhouettes:
            shape = Image.new("RGBA", icon.size, "white")
            shape.putalpha(icon.getchannel("A"))
            icon = shape
        for dx, bg in [(8, (48, 49, 55)), (128, (213, 211, 203))]:
            tile = Image.new("RGBA", (16, 16), (*bg, 255))
            tile.alpha_composite(icon)
            sheet.alpha_composite(tile.resize((96, 96), Image.Resampling.NEAREST), (x + dx, y + 54))
        sheet.alpha_composite(icon, (x + 12, y + 174))
        draw.text((x + 40, y + 174), color["hex"] + " / 16x16", font=font, fill=(184, 185, 193))
    destination.parent.mkdir(parents=True, exist_ok=True)
    sheet.convert("RGB").save(destination)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--write", action="store_true")
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--only", nargs="+", help="Limit generated texture writes/checks to these color IDs; previews still show current files.")
    parser.add_argument("--skill", type=Path, default=Path.home() / ".codex/skills/dorios-pixel-art-skill")
    args = parser.parse_args()
    spec = json.loads((ROOT / "content/concrete-colors.json").read_text(encoding="utf-8"))
    art = json.loads((ROOT / "content/dye-art.json").read_text(encoding="utf-8"))
    assert set(art["designs"]) == {c["id"] for c in spec["colors"]}, "Drawing/color mismatch"
    if args.only:
        assert set(args.only) <= set(art["designs"]), "Unknown color selection"
    base_spec = art["baseLayer"]
    base_path = ROOT / base_spec["path"]
    assert sha256(base_path.read_bytes()).hexdigest() == base_spec["sha256"], "Creator plate changed; inspect it before regenerating."
    base_plate = Image.open(base_path).convert("RGBA")
    assert base_plate.size == (16, 16) and base_spec["offset"] == [0, 0]
    shared_references = [art["styleReference"], {
        "path": base_spec["path"], "sha256": base_spec["sha256"],
        "purpose": "creator-authored wooden plate, copied at native size as an unchanged lower layer",
        "approval": "explicitly supplied by the creator for this composition",
    }, *art.get("vanillaReferences", [])]
    wood_palette = {}
    wood_commands = []
    for y in range(16):
        for x in range(16):
            rgba = base_plate.getpixel((x, y))
            if rgba[3]:
                key = next((key for key, rgb in wood_palette.items() if tuple(rgb) == rgba[:3]), None)
                if key is None:
                    key = f"wood_{len(wood_palette)}"
                    wood_palette[key] = list(rgba[:3])
                wood_commands.append({"op": "pixel", "points": [[x, y]], "color": key, "alpha": rgba[3]})
    if args.write:
        sys.path.insert(0, str(args.skill / "scripts"))
        from pixel_design import artistic_patch, composition, palette_analysis, render
    entries, changes, masks, manual, layer_changes = [], [], set(), [], []
    for color in spec["colors"]:
        drawing = art["designs"][color["id"]]
        plan = make_plan(color, drawing, shared_references)
        pigment = Image.new("RGBA", (16, 16))
        for command in plan["layers"][0]["commands"]:
            pigment.putpixel(tuple(command["points"][0]), (*plan["palette"][command["color"]], 255))
        icon = base_plate.copy()
        icon.alpha_composite(pigment)
        file = ROOT / f"RP/textures/items/dyes/{color['id']}_dye.png"
        report_dir = ROOT / "tools/generated/dyes"
        record_path = report_dir / f"{color['id']}.design.json"
        selected = args.only is None or color["id"] in args.only
        same = False
        edited = False
        current_icon = None
        if file.exists():
            with Image.open(file) as existing:
                current_icon = existing.convert("RGBA")
                assert current_icon.size == (16, 16), f"Unexpected dye size: {file}"
                alpha = current_icon.getchannel("A")
                alpha_values = alpha.get_flattened_data() if hasattr(alpha, "get_flattened_data") else alpha.getdata()
                assert set(alpha_values) <= {0, 255}, f"Partial alpha: {file}"
                same = current_icon.tobytes() == icon.tobytes()
            # The skill digest includes the native size as well as RGBA bytes.
            current_digest = sha256(str(current_icon.size).encode() + current_icon.tobytes()).hexdigest()
            recorded_digest = json.loads(record_path.read_text(encoding="utf-8")).get("pixel_sha256") if record_path.exists() else None
            edited = current_digest != recorded_digest
        edited = edited or color["id"] in art.get("protectedIcons", [])
        pigment_path = ROOT / f"tools/generated/dye-layers/{color['id']}_pigment.png"
        layer_same = False
        if pigment_path.exists():
            with Image.open(pigment_path) as existing_layer:
                layer_same = existing_layer.size == pigment.size and existing_layer.convert("RGBA").tobytes() == pigment.tobytes()
        if edited:
            manual.append(color["id"])
        if not same and selected and not edited:
            changes.append(str(file.relative_to(ROOT)))
        if not layer_same and selected and not edited:
            layer_changes.append(color["id"])
        if args.write and selected and not edited and (not same or not layer_same):
            rendered_pigment, record = render(plan, ROOT)
            assert rendered_pigment.tobytes() == pigment.tobytes(), "Pigment render mismatch"
            rendered = base_plate.copy()
            rendered.alpha_composite(rendered_pigment)
            assert rendered.tobytes() == icon.tobytes(), "Layer composition mismatch"
            record["pigment_pixel_sha256"] = record["pixel_sha256"]
            record["pixel_sha256"] = sha256(str(rendered.size).encode() + rendered.tobytes()).hexdigest()
            record["base_layer"] = base_spec
            record["pigment_composition"] = record["composition"]
            record["composition"] = composition(rendered, {"min_margin": 0, "edge_contact": "allow", "allow_clip": False})
            record["palette_analysis"] = palette_analysis(rendered)
            if current_icon is not None and not same and drawing.get("correction"):
                action = {
                    "op": "artistic_patch", **drawing["correction"],
                    "revised_intent": plan["intent"],
                    "patch": {
                        "size": [16, 16], "palette": {**plan["palette"], **wood_palette, "clear": [0, 0, 0]},
                        "layers": [{"commands": [
                            {"op": "rectangle", "points": [[0, 0], [15, 15]], "color": "clear", "alpha": 0},
                            *wood_commands,
                            *plan["layers"][0]["commands"],
                        ]}],
                    },
                }
                corrected = artistic_patch(current_icon, action, Image.new("L", (16, 16), 255))
                assert corrected.tobytes() == rendered.tobytes(), "Artistic correction mismatch"
                report_dir.mkdir(parents=True, exist_ok=True)
                (report_dir / f"{color['id']}.artistic-patch.json").write_text(json.dumps({
                    "permission_region": [0, 0, 16, 16], "action": action,
                    "source_pixel_sha256": sha256(str(current_icon.size).encode() + current_icon.tobytes()).hexdigest(),
                    "output_pixel_sha256": record["pixel_sha256"],
                    "status": "artistic_edit_applied_requires_review",
                }, indent=2) + "\n", encoding="utf-8")
            file.parent.mkdir(parents=True, exist_ok=True)
            if not same:
                rendered.save(file)
            with Image.open(file) as decoded:
                assert decoded.convert("RGBA").tobytes() == icon.tobytes()
            record["alpha_sha256"] = sha256(icon.getchannel("A").tobytes()).hexdigest()
            pigment_path.parent.mkdir(parents=True, exist_ok=True)
            if not layer_same:
                rendered_pigment.save(pigment_path)
            record["pigment_layer"] = str(pigment_path.relative_to(ROOT))
            report_dir.mkdir(parents=True, exist_ok=True)
            (report_dir / f"{color['id']}.plan.json").write_text(json.dumps(plan, indent=2) + "\n", encoding="utf-8")
            record_path.write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
        if current_icon is not None and (edited or not selected):
            icon = current_icon
        mask_hash = sha256(icon.getchannel("A").tobytes()).hexdigest()
        assert mask_hash not in masks, "Repeated dye silhouette: " + color["id"]
        masks.add(mask_hash)
        entries.append((color, {**drawing, "structure": "creator-edited / preserved"} if edited else drawing, icon))
    if args.write:
        preview(entries, ROOT / "tools/generated/dyes-preview.png")
        preview(entries, ROOT / "tools/generated/dyes-silhouettes.png", silhouettes=True)
    print(f"Dye art: {len(entries)} native icons, {len(masks)} unique silhouettes, {len(changes)} changed texture(s).")
    print(f"Pigment layers: {len(layer_changes)} changed; shared creator plate preserved.")
    if manual:
        print("Preserved manual edits:", ", ".join(manual))
    if args.check and (changes or layer_changes):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
