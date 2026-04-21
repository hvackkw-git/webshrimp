#!/usr/bin/env python3
import argparse
import json
from pathlib import Path


def build_shrimp_svg(size: int, color: str) -> str:
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 100 100" role="img" aria-label="Shrimp asset">
  <title>Shrimp</title>
  <ellipse cx="45" cy="50" rx="28" ry="18" fill="{color}" />
  <circle cx="67" cy="45" r="3" fill="black" />
  <path d="M20 50 Q7 40 20 28" fill="none" stroke="{color}" stroke-width="6" stroke-linecap="round"/>
  <path d="M70 63 C85 75, 90 92, 76 95" fill="none" stroke="{color}" stroke-width="5" stroke-linecap="round"/>
</svg>
"""


def build_metadata(name: str, size: int, color: str, svg_filename: str) -> dict:
    return {
        "name": name,
        "type": "shrimp",
        "size": size,
        "color": color,
        "svg": svg_filename,
    }


def make_shrimp_assets(name: str, size: int, color: str, output_dir: Path) -> tuple[Path, Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    svg_path = output_dir / f"{name}.svg"
    metadata_path = output_dir / f"{name}.json"

    svg_path.write_text(build_shrimp_svg(size=size, color=color), encoding="utf-8")
    metadata = build_metadata(name=name, size=size, color=color, svg_filename=svg_path.name)
    metadata_path.write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
    return svg_path, metadata_path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Create shrimp SVG assets.")
    parser.add_argument("--name", default="shrimp", help="Asset file name without extension")
    parser.add_argument("--color", default="coral", help="Shrimp color value used in SVG")
    parser.add_argument("--size", type=int, default=64, help="Width/height of the generated SVG")
    parser.add_argument("--output-dir", default="assets", help="Directory where assets are generated")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.size <= 0:
        raise ValueError("--size must be a positive integer")

    make_shrimp_assets(
        name=args.name,
        size=args.size,
        color=args.color,
        output_dir=Path(args.output_dir),
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
