"""Offline importer contract checks; no Telegram token or network is required."""
import base64
import contextlib
import gzip
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import urllib.error

spec = importlib.util.spec_from_file_location("telegram_reference", Path(__file__).with_name("telegram-reference.py"))
subject = importlib.util.module_from_spec(spec)
spec.loader.exec_module(subject)
PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jN1sAAAAASUVORK5CYII=")
TOKEN = "123456:" + "synthetic_test_token_only_123456"


class ImportTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)

    def tearDown(self):
        self.temp.cleanup()

    def out(self, name="import"):
        return subject.new_output(self.root / name)

    def api(self, files=True, broken_path=False):
        calls = []

        def fake(url, limit, payload=None):
            calls.append(url)
            if url.endswith("/getStickerSet"):
                result = {"title": "Fixture", "sticker_type": "custom_emoji", "stickers": [
                    {"file_id": "one", "file_unique_id": "stable-one", "custom_emoji_id": "42", "is_animated": False, "width": 100, "height": 100},
                    {"file_id": "two", "file_unique_id": "stable-two", "is_animated": True}]}
            elif url.endswith("/getFile"):
                result = {"file_path": "../escape.png" if broken_path else "stickers/fixture.png", "file_size": len(PNG)}
            else:
                self.assertTrue(files)
                return PNG
            return json.dumps({"ok": True, "result": result}).encode()
        return fake, calls

    def test_pack_url_validation_rejects_external_hosts_credentials_and_paths(self):
        self.assertEqual(subject.pack_name("https://t.me/addemoji/vector_monitorwar"), "vector_monitorwar")
        for value in ("https://evil.test/addemoji/name", "https://t.me@evil.test/addemoji/name", "../../name", "https://t.me/addemoji/name?token=private", "https://t.me/addstickers/name"):
            with self.subTest(value=value), self.assertRaises(subject.ImportFailure):
                subject.pack_name(value)

    def test_public_preview_does_not_misidentify_generic_logo_or_invent_members(self):
        raw = b'<meta property="og:title" content="Vector @monitoringwar"><meta property="og:image" content="https://telegram.org/img/t_logo_2x.png"><a href="tg://addemoji?set=vector_monitorwar">Add</a>'
        result = subject.inspect_preview(raw, "vector_monitorwar")
        self.assertTrue(result["socialImage"]["genericPlatformLogo"])
        self.assertEqual(result["items"], [])
        self.assertEqual(result["previewCandidates"], [])
        self.assertIsNone(result["memberCount"])
        self.assertFalse(result["inventoryComplete"])

    def test_preview_reports_candidates_without_claiming_pack_membership(self):
        result = subject.inspect_preview(b'<img src="https://cdn.test/pic.webp">', "fixture")
        self.assertEqual(len(result["previewCandidates"]), 1)
        self.assertEqual(result["items"], [])
        self.assertFalse(result["shippingEligible"])

    def test_original_is_byte_identical_hashed_and_reference_only(self):
        output = self.out()
        result = subject.store_original(output, PNG, {"originalName": "plane.png"})
        self.assertEqual((output / result["path"]).read_bytes(), PNG)
        self.assertEqual(result["inspection"]["width"], 1)
        self.assertEqual(result["rightsStatus"], "unknown")
        self.assertEqual(result["usage"], "reference-only")
        self.assertFalse(result["converted"])
        self.assertFalse(result["shippingEligible"])

    def test_duplicate_bytes_share_storage_but_keep_each_source_record(self):
        output = self.out()
        first = subject.store_original(output, PNG, {"originalName": "first.png"})
        second = subject.store_original(output, PNG, {"originalName": "second.png"})
        self.assertEqual(first["path"], second["path"])
        self.assertNotEqual(first["source"], second["source"])
        self.assertEqual(len(list((output / "originals").iterdir())), 1)

    def test_tgs_is_preserved_and_only_metadata_is_inspected(self):
        data = gzip.compress(json.dumps({"v": "5.5", "fr": 60, "w": 100, "h": 100, "layers": []}).encode())
        output = self.out()
        record = subject.store_original(output, data, {"originalName": "flight.tgs"})
        self.assertEqual(record["format"], "tgs")
        self.assertEqual(record["inspection"]["frameRate"], 60)
        self.assertEqual((output / record["path"]).read_bytes(), data)

    def test_format_mismatch_and_bounded_decompression_are_rejected(self):
        with self.assertRaises(subject.ImportFailure):
            subject.store_original(self.out(), PNG, {"originalName": "wrong.webp"})
        with self.assertRaises(subject.ImportFailure):
            subject.format_info(gzip.compress(b" " * (2 * 1024 * 1024 + 1)))
        with self.assertRaises(subject.ImportFailure):
            subject.format_info(b"not media")

    def test_existing_import_is_never_overwritten(self):
        output = self.out()
        (output / "manifest.json").write_text("keep")
        with self.assertRaises(subject.ImportFailure):
            subject.new_output(output)
        self.assertEqual((output / "manifest.json").read_text(), "keep")

    def test_local_partial_failure_keeps_successful_provenance_and_unknown_membership(self):
        valid = self.root / "provided.png"
        valid.write_bytes(PNG)
        result = subject.import_local([valid, self.root / "missing.tgs"], "fixture", self.out())
        self.assertEqual(len(result["items"]), 1)
        self.assertEqual(len(result["errors"]), 1)
        self.assertEqual(result["items"][0]["source"]["packMembership"], "user-asserted")
        self.assertFalse(result["inventoryComplete"])

    def test_api_metadata_only_does_not_download_or_expose_token(self):
        fake, calls = self.api(files=False)
        result = subject.bot_import(TOKEN, "fixture", self.out(), fetch=fake)
        self.assertEqual(len(calls), 1)
        self.assertEqual(result["memberCount"], 2)
        self.assertEqual(result["items"], [])
        self.assertNotIn(TOKEN, json.dumps(result))

    def test_api_download_preserves_original_and_reports_truncation(self):
        fake, calls = self.api()
        output = self.out()
        result = subject.bot_import(TOKEN, "fixture", output, True, 1, fake)
        self.assertEqual(len(calls), 3)
        self.assertEqual(len(result["items"]), 1)
        self.assertFalse(result["inventoryComplete"])
        self.assertFalse(result["originalsComplete"])
        self.assertEqual((output / result["items"][0]["path"]).read_bytes(), PNG)
        self.assertNotIn(TOKEN, json.dumps(result))

    def test_api_path_traversal_is_rejected_before_download(self):
        fake, calls = self.api(broken_path=True)
        result = subject.bot_import(TOKEN, "fixture", self.out(), True, 1, fake)
        self.assertEqual(len(calls), 2)
        self.assertEqual(result["items"], [])
        self.assertEqual(len(result["errors"]), 1)

    def test_malformed_api_members_and_file_metadata_report_partial_errors(self):
        def fake(url, limit, payload=None):
            result = {"title": "Fixture", "sticker_type": "custom_emoji", "stickers": [None, {"file_id": "valid", "file_unique_id": "stable"}]} if url.endswith("getStickerSet") else []
            return json.dumps({"ok": True, "result": result}).encode()
        result = subject.bot_import(TOKEN, "fixture", self.out(), True, 200, fake)
        self.assertEqual(len(result["errors"]), 2)
        self.assertEqual(result["items"], [])
        self.assertFalse(result["originalsComplete"])

    def test_api_write_failure_keeps_prior_success_record(self):
        fake, calls = self.api()
        original_store = subject.store_original
        count = 0

        def store(*args):
            nonlocal count
            count += 1
            if count == 2:
                raise OSError("Synthetic disk failure")
            return original_store(*args)
        with patch.object(subject, "store_original", side_effect=store):
            result = subject.bot_import(TOKEN, "fixture", self.out(), True, 200, fake)
        self.assertEqual(len(result["items"]), 1)
        self.assertEqual(len(result["errors"]), 1)
        self.assertFalse(result["originalsComplete"])

    def test_http_failure_does_not_echo_secret_url(self):
        url = "https://api.telegram.org/bot" + TOKEN + "/getStickerSet"
        exception = urllib.error.HTTPError(url, 401, "Unauthorized", {}, None)
        with patch.object(subject.urllib.request.OpenerDirector, "open", side_effect=exception):
            with self.assertRaises(subject.ImportFailure) as caught:
                subject.fetch_bytes(url)
        self.assertNotIn(TOKEN, str(caught.exception))

    def test_cli_reads_only_explicit_token_variable_and_does_not_seek_credentials(self):
        with patch.object(subject.os.environ, "get", return_value="") as read, contextlib.redirect_stderr(io.StringIO()):
            status = subject.main(["api", "--pack", "fixture", "--out", str(self.root / "api"), "--token-env", "MY_CHOSEN_TOKEN"])
        self.assertEqual(status, 2)
        # argparse/gettext may inspect standard locale settings; no credential namespace is searched.
        non_locale = [call.args for call in read.call_args_list if call.args[0] not in ("LANGUAGE", "LC_ALL", "LC_MESSAGES", "LANG")]
        self.assertEqual(non_locale, [("MY_CHOSEN_TOKEN", "")])


if __name__ == "__main__":
    unittest.main()
