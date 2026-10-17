"""Render the official, escaped HTML library and its plain text equivalent."""
import json
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit

from jinja2 import Environment, FileSystemLoader, StrictUndefined, select_autoescape

ROOT = Path(__file__).parent
CATALOG = json.loads((ROOT / "catalog.json").read_text(encoding="utf-8"))
ENV = Environment(loader=FileSystemLoader(ROOT / "templates"),
                  undefined=StrictUndefined, autoescape=select_autoescape(["html"]))


def https_url(value):
    parsed = urlsplit(value)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError("A public HTTPS URL is required")
    if any(c in value for c in "\r\n"):
        raise ValueError("Invalid URL")
    return value


class PlainText(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []
        self.hidden = 0

    def handle_starttag(self, tag, attrs):
        if tag in ("style", "script", "head"):
            self.hidden += 1
        if not self.hidden:
            if tag in ("p", "tr", "h1", "br"):
                self.parts.append("\n")
            if tag == "a":
                self.parts.append(" " + dict(attrs).get("href", "") + " ")

    def handle_endtag(self, tag):
        if tag in ("style", "script", "head"):
            self.hidden -= 1

    def handle_data(self, data):
        if not self.hidden:
            self.parts.append(data)


def render(name, context):
    spec = CATALOG[name]
    missing = set(spec["required"]) - context.keys()
    if missing:
        raise ValueError("Missing template variables: " + ", ".join(sorted(missing)))
    for key in ("logo_url", "lien_action"):
        https_url(context[key])
    html = ENV.get_template(name + ".html").render(**context)
    parser = PlainText()
    parser.feed(html)
    text = "\n".join(line.strip() for line in "".join(parser.parts).splitlines() if line.strip())
    return spec["subject"], html, text
