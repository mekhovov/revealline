"""Meaningful integrity and workflow tests; fixtures are tiny valid generated PNGs."""
from contextlib import redirect_stdout, redirect_stderr
from copy import deepcopy
import importlib.util
import io
import json
from pathlib import Path
import struct
import tempfile
import unittest
import zlib

SPEC = importlib.util.spec_from_file_location("media", Path(__file__).with_name("media.py"))
media = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(media)


def png(width=2, height=2, color=(20, 100, 240)):
    def chunk(kind, payload):
        return struct.pack(">I", len(payload)) + kind + payload + struct.pack(">I", zlib.crc32(kind + payload))
    raw = (b"\0" + bytes(color) * width) * height
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b""))


class MediaTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.library = self.root / "library"
        self.path = self.library / "theme.media.json"
        self.original = self.root / "photo-with-a-misleading-extension.jpg"
        self.original.write_bytes(png())
        self.styled = self.root / "styled.png"
        self.styled.write_bytes(png(3, 2, (180, 20, 90)))
        self.call("init", "--id", "test-library", "--theme", "test-theme")

    def call(self, command, *arguments, success=True):
        output, errors = io.StringIO(), io.StringIO()
        with redirect_stdout(output), redirect_stderr(errors):
            code = media.main([command, str(self.path), *map(str, arguments)])
        self.assertEqual(code, 0 if success else 1, errors.getvalue())
        return errors.getvalue() if code else json.loads(output.getvalue())

    def data(self):
        return media.load(self.path)

    def imported(self, asset="original"):
        self.call("import", "--asset", asset, "--source", self.original,
                  "--creator", "Test artist", "--rights", "Generated test fixture")
        return media.find_asset(self.data(), asset)

    def derived(self):
        self.call("derive", "--asset", "styled", "--source", self.styled, "--parent", "original",
                  "--creator", "Test artist", "--rights", "Generated fixture", "--method", "manual",
                  "--tool", "Fixture generator")
        return media.find_asset(self.data(), "styled")

    def rejects(self, manifest, message=None):
        with self.assertRaises(media.MediaError) as error:
            media.validate(manifest, self.library)
        if message:
            self.assertIn(message, str(error.exception))

    def test_preserves_original_bytes_even_after_external_source_changes(self):
        before = self.original.read_bytes()
        asset = self.imported()
        stored = self.library / asset["file"]["path"]
        self.assertEqual(self.original.read_bytes(), before)
        self.assertEqual(stored.read_bytes(), before)
        self.assertEqual(asset["file"]["format"], "png")
        self.assertEqual(asset["file"]["width"], 2)
        self.original.write_bytes(png(1, 1))
        self.assertEqual(stored.read_bytes(), before)
        self.call("validate")

    def test_produced_asset_id_cannot_be_overwritten(self):
        self.imported()
        before = self.path.read_bytes()
        self.call("import", "--asset", "original", "--source", self.styled, "--creator", "Other",
                  "--rights", "Fixture", success=False)
        self.assertEqual(self.path.read_bytes(), before)

    def test_non_destructive_derivative_and_parent_hash(self):
        original = self.imported()
        original_bytes = (self.library / original["file"]["path"]).read_bytes()
        derivative = self.derived()
        self.assertEqual(derivative["provenance"]["parentSha256"], original["file"]["sha256"])
        self.assertNotEqual(original["file"]["path"], derivative["file"]["path"])
        self.assertEqual((self.library / original["file"]["path"]).read_bytes(), original_bytes)
        self.assertEqual((self.library / derivative["file"]["path"]).read_bytes(), self.styled.read_bytes())
        self.call("validate")

    def test_ai_derivative_requires_explicit_prompt_and_model(self):
        self.imported()
        arguments = ["--asset", "ai-style", "--source", self.styled, "--parent", "original", "--creator", "Tester",
                     "--rights", "Fixture", "--method", "ai", "--tool", "Named external image tool"]
        before = self.path.read_bytes()
        self.call("derive", *arguments, success=False)
        self.assertEqual(self.path.read_bytes(), before)
        prompt = self.root / "effective-prompt.txt"
        prompt.write_text("Make the uploaded scene a restrained pixel illustration.\nPreserve composition.")
        self.call("derive", *arguments, "--model", "Recorded model version", "--prompt-file", prompt)
        prov = media.find_asset(self.data(), "ai-style")["provenance"]
        self.assertEqual(prov["effectivePrompt"], prompt.read_text())
        self.assertEqual(prov["model"], "Recorded model version")
        self.assertEqual(media.find_asset(self.data(), "ai-style")["status"], "imported")

    def test_cannot_claim_ai_provenance_for_manual_derivative(self):
        self.imported()
        derivative = self.derived()
        manifest = self.data()
        manifest["assets"][1]["provenance"]["model"] = "Unrelated AI model"
        self.rejects(manifest, "AI provenance belongs only")

    def test_derivative_parent_integrity(self):
        self.imported()
        self.derived()
        manifest = self.data()
        manifest["assets"][1]["provenance"]["parentSha256"] = "0" * 64
        self.rejects(manifest, "parent hash mismatch")
        manifest = self.data()
        manifest["assets"][1]["provenance"]["parentAssetId"] = "missing"
        self.rejects(manifest, "missing parent")

    def test_unproduced_parent_cannot_back_produced_derivative(self):
        self.call("plan", "--asset", "original", "--brief", "A future original")
        self.call("derive", "--asset", "styled", "--source", self.styled, "--parent", "original",
                  "--creator", "Tester", "--rights", "Fixture", "--method", "manual", "--tool", "Tool", success=False)
        self.assertEqual(len(self.data()["assets"]), 1)

    def test_planned_ancestry_cycle_fails(self):
        manifest = self.data()
        manifest["assets"] = [{"id": aid, "kind": "derivative", "status": "planned",
                               "provenance": {"method": "planned", "brief": "Future style", "parentAssetId": parent}}
                              for aid, parent in (("one", "two"), ("two", "one"))]
        self.rejects(manifest, "cycle")

    def test_planned_bindings_survive_fulfilment_without_fake_files(self):
        self.call("plan", "--asset", "original", "--brief", "Future drone")
        self.call("bind", "--role", "player.avatar", "--asset", "original", "--variant", "realistic")
        self.assertNotIn("file", self.data()["assets"][0])
        self.imported()
        self.assertEqual(self.data()["bindings"][0]["assetId"], "original")
        self.call("validate")

    def test_binding_variants_and_reference_checks(self):
        self.imported()
        self.derived()
        self.call("bind", "--role", "player.avatar", "--variant", "realistic", "--asset", "original")
        self.call("bind", "--role", "player.avatar", "--variant", "pixel-art", "--asset", "styled", "--sampling", "nearest")
        self.assertEqual(len(self.data()["bindings"]), 2)
        before = self.path.read_bytes()
        self.call("bind", "--role", "missing.role", "--asset", "original", success=False)
        self.call("bind", "--role", "player.avatar", "--asset", "missing", success=False)
        self.assertEqual(self.path.read_bytes(), before)
        self.call("bind", "--role", "player.avatar", "--variant", "realistic", "--asset", "styled")
        self.assertEqual(len(self.data()["bindings"]), 2)

    def test_author_supplied_allegiance_survives_fulfilment_and_invalid_label_fails(self):
        self.call("plan", "--asset", "original", "--brief", "Ukrainian FPV avatar", "--allegiance", "ukrainian")
        self.imported()
        self.assertEqual(self.data()["assets"][0]["subjectAllegiance"], "ukrainian")
        manifest = self.data()
        manifest["assets"][0]["subjectAllegiance"] = "guessed-from-colors"
        self.rejects(manifest, "invalid subjectAllegiance")
        self.call("import", "--asset", "equipment", "--source", self.styled, "--creator", "Test",
                  "--rights", "Fixture", "--allegiance", "hostile-military")
        self.assertEqual(media.find_asset(self.data(), "equipment")["subjectAllegiance"], "hostile-military")

    def test_valid_small_lossless_webp_import(self):
        # Real 28-byte transparent 1x1 VP8L fixture, independently decoded with macOS sips.
        image = self.root / "tiny.webp"
        image.write_bytes(bytes.fromhex("5249464614000000574542505650384c080000002f00000000888808"))
        self.call("import", "--asset", "small-webp", "--source", image, "--creator", "Fixture", "--rights", "Test fixture")
        meta = self.data()["assets"][0]["file"]
        self.assertEqual((meta["format"], meta["width"], meta["height"], meta["bytes"]), ("webp", 1, 1, 28))
        self.call("validate")

    def test_duplicate_binding_and_physics_fields_are_rejected(self):
        self.imported()
        self.call("bind", "--role", "player.avatar", "--asset", "original")
        manifest = self.data()
        manifest["bindings"].append(deepcopy(manifest["bindings"][0]))
        self.rejects(manifest, "Duplicate role/variant")
        manifest = self.data()
        manifest["bindings"][0]["presentation"]["collisionRadius"] = 50
        self.rejects(manifest, "unknown fields")

    def test_hash_byte_count_and_header_metadata_tampering_fail(self):
        asset = self.imported()
        manifest = self.data()
        manifest["assets"][0]["file"]["width"] = 900
        self.rejects(manifest, "header metadata mismatch")
        manifest = self.data()
        manifest["assets"][0]["file"]["bytes"] += 1
        self.rejects(manifest, "identity mismatch")
        (self.library / asset["file"]["path"]).write_bytes(png(color=(20, 100, 241)))
        self.call("validate", success=False)

    def test_paths_cannot_escape_or_alias_managed_identity(self):
        self.imported()
        for path in ("../outside.png", "/tmp/outside.png", "files/../outside.png", "files\\outside.png", "C:/outside.png"):
            with self.subTest(path=path):
                manifest = self.data()
                manifest["assets"][0]["file"]["path"] = path
                self.rejects(manifest)

    def test_symlink_directory_cannot_redirect_import(self):
        outside = self.root / "outside"
        outside.mkdir()
        (self.library / "files").symlink_to(outside, target_is_directory=True)
        self.call("import", "--asset", "original", "--source", self.original, "--creator", "Test",
                  "--rights", "Fixture", success=False)
        self.assertEqual(list(outside.iterdir()), [])
        self.assertEqual(self.data()["assets"], [])

    def test_symlink_stored_file_cannot_redirect_validation(self):
        asset = self.imported()
        stored = self.library / asset["file"]["path"]
        stored.unlink()
        stored.symlink_to(self.original)
        self.call("validate", success=False)

    def test_manifest_symlink_and_existing_manifest_are_not_overwritten(self):
        before = self.path.read_bytes()
        self.call("init", "--id", "replace", "--theme", "replace", success=False)
        self.assertEqual(self.path.read_bytes(), before)
        real = self.library / "real.json"
        self.path.rename(real)
        self.path.symlink_to(real)
        self.call("role", "--id", "custom.role", "--description", "Test", success=False)
        self.assertEqual(real.read_bytes(), before)

    def test_orphan_content_address_file_is_never_overwritten(self):
        data = self.original.read_bytes()
        destination = self.library / f"files/originals/{media.sha256(data)}.png"
        destination.parent.mkdir(parents=True)
        destination.write_bytes(b"Different bytes must survive")
        self.call("import", "--asset", "original", "--source", self.original, "--creator", "Test",
                  "--rights", "Fixture", success=False)
        self.assertEqual(destination.read_bytes(), b"Different bytes must survive")

    def test_fake_image_is_not_registered(self):
        fake = self.root / "fake.png"
        fake.write_text("This is not a PNG")
        self.call("import", "--asset", "fake", "--source", fake, "--creator", "Test", "--rights", "Fixture", success=False)
        self.assertEqual(self.data()["assets"], [])

    def test_ready_requires_explicit_review_and_bound_art(self):
        self.imported()
        self.call("bind", "--role", "reveal.original", "--asset", "original")
        self.call("validate", "--ready", success=False)
        self.call("review", "--asset", "original", "--reviewer", "Human reviewer", "--note", "Fixture inspected")
        self.call("validate", "--ready")
        self.assertEqual(self.data()["assets"][0]["status"], "reviewed")

    def test_lock_blocks_mutation_without_changing_manifest(self):
        before = self.path.read_bytes()
        lock = self.path.with_name(self.path.name + ".lock")
        lock.write_text("Other writer")
        self.call("role", "--id", "custom.role", "--description", "Test", success=False)
        self.assertEqual(self.path.read_bytes(), before)
        self.assertEqual(lock.read_text(), "Other writer")

    def test_duplicate_json_keys_and_unknown_version_fail(self):
        self.path.write_text('{"id":"first","id":"second"}')
        self.call("validate", success=False)
        manifest = {"mediaVersion": "2.0.0", "id": "test", "themeId": "test", "roles": media.DEFAULT_ROLES,
                    "assets": [], "bindings": []}
        self.rejects(manifest, "Unsupported mediaVersion")

    def test_four_theme_templates_are_honest_plans(self):
        templates = sorted(Path(__file__).with_name("examples").glob("*.media.json"))
        self.assertEqual(len(templates), 4)
        for path in templates:
            with self.subTest(theme=path.name):
                manifest = media.load(path)
                result = media.validate(manifest, path.parent)
                self.assertEqual(result["assets"], result["planned"])
                self.assertGreaterEqual(result["bindings"], 20)
                self.assertTrue(all("file" not in a for a in manifest["assets"]))
                with self.assertRaises(media.MediaError):
                    media.validate(manifest, path.parent, ready=True)


if __name__ == "__main__":
    unittest.main()
