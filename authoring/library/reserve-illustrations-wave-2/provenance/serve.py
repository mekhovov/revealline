"""Serve only the retained wave comparison and its eight original images."""

import argparse
import json
import stat
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit


def main():
    cohort = Path(__file__).resolve().parent.parent
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--previous", type=Path,
        default=cohort.parent / "reserve-illustrations-wave-1",
        help="Wave 1 cohort directory, including its originals subdirectory",
    )
    args = parser.parse_args()
    manifest = json.loads((cohort / "manifest.json").read_text())
    routes = {"/": (cohort / "provenance/index.html", "text/html; charset=utf-8")}
    for row in manifest["entries"]:
        routes[f"/current/{row['id']}.png"] = (cohort / row["file"], "image/png")
    for name in (
        "fpv-sunflower-signal", "ukraine-potters-light",
        "retro-rooftop-radio", "spend-circular-workshop",
    ):
        routes[f"/previous/{name}.png"] = (
            args.previous / "originals" / f"{name}.png", "image/png"
        )
    for path, _ in routes.values():
        if not stat.S_ISREG(path.lstat().st_mode) or path.is_symlink():
            raise ValueError(f"Expected ordinary retained file: {path}")

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            item = routes.get(urlsplit(self.path).path)
            if item is None:
                self.send_error(404)
                return
            path, mime = item
            raw = path.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", mime)
            self.send_header("Content-Length", str(len(raw)))
            self.send_header("Cache-Control", "no-store")
            self.send_header(
                "Content-Security-Policy",
                "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; base-uri 'none'",
            )
            self.end_headers()
            self.wfile.write(raw)

    with ThreadingHTTPServer(("127.0.0.1", 0), Handler) as server:
        print(f"http://127.0.0.1:{server.server_port}/", flush=True)
        server.serve_forever()


if __name__ == "__main__":
    main()
