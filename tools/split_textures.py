from __future__ import annotations

import argparse
import sys
from pathlib import Path
import shutil

try:
    from PIL import Image
except ImportError:  # pragma: no cover - runtime dependency guard
    print("Pillow is required. Please install it in your Python environment.", file=sys.stderr)
    raise SystemExit(1)


SUPPORTED_SIZES = {(16, 16), (32, 16)}


def parse_args() -> argparse.Namespace:
    default_root = Path(__file__).resolve().parents[1] / "Assets" / "textures" / "blocks"
    parser = argparse.ArgumentParser(
        description="Split 32x16 textures into 16x16 top/side textures and back up originals."
    )
    parser.add_argument(
        "--root",
        type=Path,
        default=default_root,
        help="Root folder containing texture subfolders (default: Assets/textures/blocks).",
    )
    parser.add_argument(
        "--backup-folder",
        type=Path,
        default=Path("full"),
        help="Backup folder name or absolute path (default: full).",
    )
    return parser.parse_args()


def resolve_backup_root(root: Path, backup_folder: Path) -> Path:
    if backup_folder.is_absolute():
        return backup_folder
    return root / backup_folder


def should_skip(path: Path, backup_root: Path) -> bool:
    return backup_root in path.parents


def process_texture(path: Path, root: Path, backup_root: Path) -> None:
    with Image.open(path) as image:
        size = image.size

    backup_path = backup_root / path.relative_to(root)
    if backup_path.exists():
        print(f"SKIP: Backup already exists for {path}")
        return

    backup_path.parent.mkdir(parents=True, exist_ok=True)
    shutil.move(path, backup_path)

    if size == (32, 16):
        with Image.open(backup_path) as image:
            top = image.crop((0, 0, 16, 16))
            side = image.crop((16, 0, 32, 16))

        top_path = path.with_name(f"{path.stem}_top.png")
        side_path = path.with_name(f"{path.stem}_side.png")

        top.save(top_path)
        side.save(side_path)
        print(f"SPLIT: {path.name} -> {top_path.name}, {side_path.name}")
        return

    shutil.copy2(backup_path, path)
    if size == (16, 16):
        print(f"KEEP: {path.name} (16x16)")
        return

    print(f"KEEP: {path.name} (unsupported size {size[0]}x{size[1]})")


def main() -> int:
    args = parse_args()
    root = args.root
    if not root.exists():
        print(f"Root folder not found: {root}", file=sys.stderr)
        return 2

    backup_root = resolve_backup_root(root, args.backup_folder)
    if backup_root == root:
        print("Backup folder cannot be the same as the root folder.", file=sys.stderr)
        return 2

    textures = [path for path in root.rglob("*.png") if not should_skip(path, backup_root)]
    if not textures:
        print("No PNG textures found.")
        return 0

    for texture_path in textures:
        process_texture(texture_path, root, backup_root)

    print("Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
