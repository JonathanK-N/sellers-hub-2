"""Explicit API startup and database-free maintenance. Author: Jonathan Kakesa."""
import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


class Maintenance(BaseHTTPRequestHandler):
    def respond(self):
        health = self.path == "/api/health"
        payload = json.dumps({"status": "maintenance", "emails": "disabled"}).encode()
        self.send_response(200 if health else 503)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Retry-After", "300")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(payload)

    do_GET = respond
    do_HEAD = respond
    do_POST = respond
    do_PUT = respond
    do_PATCH = respond
    do_DELETE = respond
    do_OPTIONS = respond

    def log_message(self, format, *args):
        pass


def main():
    mode = os.getenv("MAINTENANCE_MODE", "false")
    if mode not in ("true", "false"):
        raise ValueError("MAINTENANCE_MODE must be true or false")
    port = str(int(os.environ["PORT"]))
    if mode == "true":
        ThreadingHTTPServer(("0.0.0.0", int(port)), Maintenance).serve_forever()
    else:
        os.execvp("uvicorn", ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", port])


if __name__ == "__main__":
    main()
