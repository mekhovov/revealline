#!/usr/bin/env python3
"""Import reference originals without conversion, credentials in output, or game bindings."""
import argparse
import datetime as dt
import getpass
import gzip
import hashlib
import html.parser
import io
import json
import os
from pathlib import Path
import re
import struct
import sys
import urllib.error
import urllib.parse
import urllib.request

VERSION = "telegram-reference.v1"
MAX_BYTES = 20 * 1024 * 1024
FORMATS = {".png": "image/png", ".webp": "image/webp", ".tgs": "application/x-tgsticker", ".webm": "video/webm"}


class ImportFailure(ValueError):
    pass


def now():
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")


def pack_name(value):
    if value.startswith("https://"):
        parsed = urllib.parse.urlsplit(value)
        match = re.fullmatch(r"/addemoji/([A-Za-z][A-Za-z0-9_]{0,63})/?", parsed.path)
        if parsed.netloc != "t.me" or parsed.query or parsed.fragment or not match:
            raise ImportFailure("Use a public t.me/addemoji pack URL, or its short name")
        return match[1]
    if not re.fullmatch(r"[A-Za-z][A-Za-z0-9_]{0,63}", value):
        raise ImportFailure("Invalid pack short name")
    return value


def pack_url(name):
    return "https://t.me/addemoji/" + pack_name(name)


def new_output(value):
    path = Path(value)
    if path.is_symlink() or path.exists() and (not path.is_dir() or any(path.iterdir())):
        raise ImportFailure("Output must be a new or empty directory; existing imports are preserved")
    path.mkdir(parents=True, exist_ok=True)
    return path


def save_json(path, data):
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    temporary.replace(path)


def base_manifest(name, access):
    return {"version": VERSION, "importedAt": now(), "pack": {"name": name, "sourceUrl": pack_url(name)},
            "access": access, "rights": {"status": "unknown", "evidence": None}, "usage": "reference-only",
            "shippingEligible": False, "converted": False, "items": [], "errors": []}


class PreviewParser(html.parser.HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.metadata = {}
        self.images = []
        self.deep_links = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "meta":
            key = attrs.get("property", attrs.get("name"))
            if key and attrs.get("content"):
                self.metadata[key] = attrs["content"]
        if tag in ("img", "video", "source"):
            for key in ("src", "poster", "data-src", "data-tgs", "data-webm"):
                if attrs.get(key):
                    self.images.append({"tag": tag, "attribute": key, "url": attrs[key]})
        if tag == "a" and attrs.get("href", "").startswith("tg://"):
            self.deep_links.append(attrs["href"])


def inspect_preview(data, name):
    parser = PreviewParser()
    parser.feed(data.decode("utf-8"))
    result = base_manifest(name, "public-preview")
    image = parser.metadata.get("og:image")
    generic = bool(image and urllib.parse.urlsplit(image).hostname == "telegram.org" and "/img/t_logo" in image)
    result.update({"title": parser.metadata.get("og:title"), "deepLinks": sorted(set(parser.deep_links)),
                   "pageSha256": hashlib.sha256(data).hexdigest(), "memberCount": None,
                   "inventoryComplete": False, "previewCandidates": parser.images,
                   "socialImage": {"url": image, "genericPlatformLogo": generic},
                   "observation": "Public page candidates are not a verified member inventory. No images are downloaded by preview."})
    return result


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def fetch_bytes(url, limit=MAX_BYTES, payload=None):
    """TLS remains verified. Never expose exception URLs, which may contain a bot token."""
    request = urllib.request.Request(url, data=payload, headers={"User-Agent": "XonixReferenceImporter/1.0"})
    if payload is not None:
        request.add_header("Content-Type", "application/json")
    try:
        with urllib.request.build_opener(NoRedirect).open(request, timeout=30) as response:
            data = response.read(limit + 1)
    except urllib.error.HTTPError as error:
        raise ImportFailure("Remote request failed (HTTP %s); no credential URL was logged" % error.code) from None
    except (urllib.error.URLError, TimeoutError, OSError):
        raise ImportFailure("Network/TLS request failed; check connectivity and the Python trust store. TLS verification stays enabled") from None
    if len(data) > limit:
        raise ImportFailure("Remote file exceeds the import size limit")
    return data


def format_info(data):
    if data.startswith(b"\x89PNG\r\n\x1a\n") and len(data) >= 24 and data[12:16] == b"IHDR":
        width, height = struct.unpack(">II", data[16:24])
        return ".png", {"width": width, "height": height, "validation": "header-only"}
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return ".webp", {"validation": "container-signature-only"}
    if data.startswith(b"\x1a\x45\xdf\xa3"):
        return ".webm", {"validation": "EBML-signature-only"}
    if data.startswith(b"\x1f\x8b"):
        try:
            with gzip.GzipFile(fileobj=io.BytesIO(data)) as source:
                decoded = source.read(2 * 1024 * 1024 + 1)
            if len(decoded) > 2 * 1024 * 1024:
                raise ImportFailure("TGS inspection exceeds the bounded JSON limit")
            obj = json.loads(decoded)
            if not isinstance(obj, dict) or not all(key in obj for key in ("v", "fr", "layers")):
                raise ImportFailure("Gzip content does not identify a Lottie/TGS animation")
            return ".tgs", {"width": obj.get("w"), "height": obj.get("h"), "frameRate": obj.get("fr"), "validation": "bounded-lottie-json-only"}
        except (OSError, EOFError, UnicodeError, json.JSONDecodeError):
            raise ImportFailure("Invalid TGS archive") from None
    raise ImportFailure("Unsupported or unrecognized PNG/WEBP/TGS/WEBM original")


def store_original(output, data, provenance):
    if not data or len(data) > MAX_BYTES:
        raise ImportFailure("Original must be nonempty and at most 20 MiB")
    extension, details = format_info(data)
    declared = Path(provenance.get("originalName", "")).suffix.lower()
    if declared and declared in FORMATS and declared != extension:
        raise ImportFailure("Filename extension does not match the original format")
    digest = hashlib.sha256(data).hexdigest()
    relative = Path("originals") / (digest + extension)
    destination = output / relative
    destination.parent.mkdir(exist_ok=True)
    if destination.exists():
        if destination.read_bytes() != data:
            raise ImportFailure("Existing original does not match its content hash")
    else:
        with destination.open("xb") as stream:
            stream.write(data)
    return {"sha256": digest, "path": relative.as_posix(), "bytes": len(data), "mimeType": FORMATS[extension],
            "format": extension[1:], "inspection": details, "source": provenance,
            "rightsStatus": "unknown", "usage": "reference-only", "shippingEligible": False, "converted": False}


def import_local(files, name, output):
    result = base_manifest(name, "user-provided-originals")
    for value in files:
        path = Path(value)
        try:
            if path.suffix.lower() not in FORMATS or not path.is_file() or path.stat().st_size > MAX_BYTES:
                raise ImportFailure("Input must be a PNG/WEBP/TGS/WEBM file at most 20 MiB")
            with path.open("rb") as stream:
                data = stream.read(MAX_BYTES + 1)
            result["items"].append(store_original(output, data, {"originalName": path.name, "packSource": pack_url(name),
                 "packMembership": "user-asserted", "importMethod": "local-file"}))
        except (ImportFailure, OSError):
            result["errors"].append({"originalName": path.name, "reason": "Original not imported; unsupported format, size, missing file or local read/write failure"})
    result["inventoryComplete"] = False
    result["memberCount"] = None
    return result


def api_call(token, method, parameters, fetch=fetch_bytes):
    if method not in ("getStickerSet", "getFile"):
        raise ImportFailure("Only read-only sticker/file methods are supported")
    data = fetch("https://api.telegram.org/bot" + token + "/" + method, 5 * 1024 * 1024,
                 json.dumps(parameters).encode("utf-8"))
    try:
        response = json.loads(data)
    except (UnicodeError, json.JSONDecodeError):
        raise ImportFailure("Telegram returned invalid JSON") from None
    if not isinstance(response, dict) or response.get("ok") is not True or "result" not in response:
        raise ImportFailure("Telegram API rejected the request; response text is withheld to avoid credential leakage")
    return response["result"]


def bot_import(token, name, output, download=False, max_items=200, fetch=fetch_bytes):
    if not re.fullmatch(r"\d+:[A-Za-z0-9_-]{20,}", token):
        raise ImportFailure("Invalid explicitly supplied bot token format")
    data = api_call(token, "getStickerSet", {"name": name}, fetch)
    if not isinstance(data, dict) or not isinstance(data.get("stickers"), list):
        raise ImportFailure("Telegram did not return a sticker set")
    if data.get("sticker_type") != "custom_emoji":
        raise ImportFailure("This importer expects a custom emoji set, not an ordinary sticker pack")
    result = base_manifest(name, "official-bot-api")
    result.update({"title": data.get("title"), "stickerType": data.get("sticker_type"),
                   "memberCount": len(data["stickers"]), "inventoryComplete": len(data["stickers"]) <= max_items,
                   "originalsRequested": download, "metadata": []})
    for index, sticker in enumerate(data["stickers"][:max_items]):
        if not isinstance(sticker, dict) or not isinstance(sticker.get("file_id"), str) or not sticker["file_id"]:
            result["errors"].append({"index": index, "reason": "Malformed sticker metadata; no original requested"})
            continue
        safe = {key: sticker[key] for key in ("file_id", "file_unique_id", "custom_emoji_id", "emoji", "type", "width", "height", "is_animated", "is_video", "needs_repainting", "file_size") if key in sticker}
        result["metadata"].append(safe)
        if not download:
            continue
        try:
            file = api_call(token, "getFile", {"file_id": sticker["file_id"]}, fetch)
            if not isinstance(file, dict):
                raise ImportFailure("API returned invalid file metadata")
            path = file.get("file_path", "")
            if not isinstance(path, str) or not re.fullmatch(r"[A-Za-z0-9_./-]+", path) or path.startswith("/") or ".." in path.split("/"):
                raise ImportFailure("API returned an invalid file path")
            if file.get("file_size", 0) > MAX_BYTES:
                raise ImportFailure("API file exceeds the import limit")
            original = fetch("https://api.telegram.org/file/bot" + token + "/" + path, MAX_BYTES)
            record = store_original(output, original, {"packSource": pack_url(name), "packMembership": "official-api",
                "fileUniqueId": sticker.get("file_unique_id"), "customEmojiId": sticker.get("custom_emoji_id"),
                "originalName": Path(path).name, "importMethod": "getStickerSet/getFile"})
            result["items"].append(record)
        except (ImportFailure, KeyError, TypeError, OSError):
            result["errors"].append({"fileUniqueId": sticker.get("file_unique_id"), "reason": "Original not imported; invalid metadata, file format, size or network response"})
    result["originalsComplete"] = download and result["inventoryComplete"] and not result["errors"] and len(result["items"]) == result["memberCount"]
    return result


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    for name in ("preview", "local", "api"):
        command = commands.add_parser(name)
        command.add_argument("--pack", required=True, type=pack_name)
        command.add_argument("--out", required=True)
        if name == "preview":
            command.add_argument("--html-file", type=Path, help="Inspect a supplied public page snapshot without a network call")
        elif name == "local":
            command.add_argument("files", nargs="+")
        else:
            credentials = command.add_mutually_exclusive_group(required=True)
            credentials.add_argument("--token-prompt", action="store_true")
            credentials.add_argument("--token-env", metavar="EXPLICIT_VARIABLE", help="Read only this explicitly named environment variable")
            command.add_argument("--download", action="store_true", help="Import original bytes, in addition to metadata")
            command.add_argument("--max-items", type=int, default=200)
    args = parser.parse_args(argv)
    try:
        if args.command == "api" and not 1 <= args.max_items <= 1000:
            raise ImportFailure("max-items must be between 1 and 1000")
        output = new_output(args.out)
        if args.command == "preview":
            data = args.html_file.read_bytes() if args.html_file else fetch_bytes(pack_url(args.pack), 2 * 1024 * 1024)
            if len(data) > 2 * 1024 * 1024:
                raise ImportFailure("Preview exceeds 2 MiB")
            result = inspect_preview(data, args.pack)
            (output / "preview.html").write_bytes(data)
        elif args.command == "local":
            result = import_local(args.files, args.pack, output)
        else:
            token = getpass.getpass("Telegram bot token (not saved): ") if args.token_prompt else os.environ.get(args.token_env, "")
            if not token:
                raise ImportFailure("No token supplied; use preview or local import, or explicitly supply your token")
            result = bot_import(token, args.pack, output, args.download, args.max_items)
        save_json(output / "manifest.json", result)
        print(json.dumps({"manifest": str(output / "manifest.json"), "originals": len(result["items"]), "errors": len(result["errors"]), "usage": result["usage"]}))
        return 1 if result["errors"] else 0
    except (ImportFailure, OSError, UnicodeError) as error:
        # Network helpers deliberately discard exception URLs. Filesystem messages are also not echoed.
        message = str(error) if isinstance(error, ImportFailure) else "Local file operation failed; check paths and permissions"
        print("Reference import failed: " + message, file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
