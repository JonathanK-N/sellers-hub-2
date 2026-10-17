"""Generate synthetic previews; never sends mail or connects to a database."""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
from communications.render import CATALOG, render, https_url


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--origin", required=True, help="HTTPS origin for preview links, not evidence of hosting")
    args = parser.parse_args()
    origin = https_url(args.origin).rstrip("/")
    args.output.mkdir(parents=True, exist_ok=True)
    base = {field: "Exemple synthétique" for spec in CATALOG.values() for field in spec["required"]}
    base.update(prenom="Camille", email="delivered@resend.dev", commande="DEMO-001", montant="25 000 FC",
                boutique="Boutique de démonstration", livreur="Livreur de démonstration", vendeur="Équipe de démonstration",
                logo_url=origin + "/assets/email/afrimarket-official.png", lien_action=origin + "/auth/login")
    for name in CATALOG:
        subject, html, text = render(name, base)
        (args.output / (name + ".html")).write_text(html, encoding="utf-8")
        (args.output / (name + ".txt")).write_text(subject + "\n\n" + text, encoding="utf-8")
    (args.output / "manifest.json").write_text(json.dumps({"synthetic_only": True,
        "hosting_verified": False, "templates": list(CATALOG)}, indent=2), encoding="utf-8")
    print(f"Rendered {len(CATALOG)} synthetic HTML/text previews; no mail sent")


if __name__ == "__main__":
    main()
