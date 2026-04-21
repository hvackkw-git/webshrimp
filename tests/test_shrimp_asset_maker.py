import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from shrimp_asset_maker import build_metadata, build_shrimp_svg, main, make_shrimp_assets


class ShrimpAssetMakerTests(unittest.TestCase):
    def test_build_shrimp_svg_includes_size_and_color(self) -> None:
        svg = build_shrimp_svg(size=96, color="pink")
        self.assertIn('width="96"', svg)
        self.assertIn('height="96"', svg)
        self.assertIn('fill="pink"', svg)

    def test_build_metadata_fields(self) -> None:
        metadata = build_metadata("hero", 80, "orange", "hero.svg")
        self.assertEqual(
            metadata,
            {
                "name": "hero",
                "type": "shrimp",
                "size": 80,
                "color": "orange",
                "svg": "hero.svg",
            },
        )

    def test_make_shrimp_assets_writes_files(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            svg_path, metadata_path = make_shrimp_assets(
                name="test-shrimp",
                size=64,
                color="coral",
                output_dir=Path(temp_dir),
            )

            self.assertTrue(svg_path.exists())
            self.assertTrue(metadata_path.exists())
            metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
            self.assertEqual(metadata["svg"], "test-shrimp.svg")

    def test_main_rejects_non_positive_size(self) -> None:
        with patch(
            "sys.argv",
            ["shrimp_asset_maker.py", "--size", "0", "--output-dir", "/tmp/ignored"],
        ):
            with self.assertRaises(ValueError):
                main()


if __name__ == "__main__":
    unittest.main()
