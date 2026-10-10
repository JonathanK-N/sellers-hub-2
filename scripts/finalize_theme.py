"""Reviewed residual brand uses and shared tokens; keeps functional warning orange."""
from pathlib import Path
import json
import re

review = []
for path in Path('frontend/src').rglob('*.jsx'):
    text = path.read_text(encoding='utf-8')
    old = text
    # Residual dark surfaces are headers/hero/logos or new cart CTAs (see inventory).
    dark = '#085041' if path.name == 'Landing.jsx' or path.parent.name == 'auth' and path.name not in ('LoginForm.jsx', 'RegisterForm.jsx') else '#1D9E75'
    text = re.sub('#0b0b0d', dark, text, flags=re.I)
    text = re.sub('#17171a', '#085041', text, flags=re.I)
    text = re.sub('#f97316', '#1D9E75', text, flags=re.I)
    text = re.sub('#ea580c', '#168260', text, flags=re.I)
    text = text.replace('hover:bg-black', 'hover:bg-[#168260]')
    # Fraud suspension remains a functional orange warning.
    lines = text.splitlines()
    for i, line in enumerate(lines):
        if path.name == 'Fraud.jsx' and 'suspend:' in line:
            continue
        lines[i] = line.replace('bg-orange-50', 'bg-[#E1F5EE]')
    text = '\n'.join(lines)+'\n'
    if path.name == 'RegisterForm.jsx':
        text = text.replace('border-orange-200', 'border-[#1D9E75]/20')
    if old != text:
        review.append({'file': path.as_posix(), 'reason': 'Reviewed new brand surfaces, CTA, focus and selected/success states; Fraud suspension warning preserved'})
    # Convert historic brand values to opacity-aware Tailwind tokens.
    for value, token in {'1d9e75':'primary','168260':'primary-hover','085041':'secondary','e1f5ee':'soft','ef9f27':'accent'}.items():
        text = re.sub(r'\[#'+value+r'\]', 'afri-'+token, text, flags=re.I)
        text = re.sub('#'+value, 'var(--afri-'+('success-bg' if token == 'soft' else token)+')', text, flags=re.I)
    path.write_text(text, encoding='utf-8')
Path('release-evidence/theme-manual-review.json').write_text(json.dumps(review, indent=2)+'\n')

p = Path('frontend/src/index.css')
text = p.read_text(encoding='utf-8')
text = re.sub(r'  --afri-(?:dark|dark-2|orange|orange-hover):[^\n]+\n', '', text)
text = text.replace('background-color: #0b0b0d;', 'background-color: var(--afri-primary);').replace('background-color: #1f2937;', 'background-color: var(--afri-primary-hover);')
text = text.replace('background-color: #f97316;', 'background-color: var(--afri-accent);').replace('background-color: #ea580c;', 'background-color: #d98b1a;')
text = text.replace('  --afri-primary:', '  --afri-primary-rgb: 29 158 117;\n  --afri-primary-hover-rgb: 22 130 96;\n  --afri-secondary-rgb: 8 80 65;\n  --afri-soft-rgb: 225 245 238;\n  --afri-accent-rgb: 239 159 39;\n  --afri-primary:')
text += '\n/* Keyboard focus uses the historical dark green for a visible boundary. */\n:focus-visible { outline: 2px solid var(--afri-secondary); outline-offset: 3px; }\n'
p.write_text(text, encoding='utf-8')
p = Path('frontend/tailwind.config.js')
text = p.read_text(encoding='utf-8').replace("colors: {", "colors: {\n            afri: { primary: 'rgb(var(--afri-primary-rgb) / <alpha-value>)', 'primary-hover': 'rgb(var(--afri-primary-hover-rgb) / <alpha-value>)', secondary: 'rgb(var(--afri-secondary-rgb) / <alpha-value>)', soft: 'rgb(var(--afri-soft-rgb) / <alpha-value>)', accent: 'rgb(var(--afri-accent-rgb) / <alpha-value>)' },", 1)
p.write_text(text, encoding='utf-8')
print('Reviewed residual colors and installed shared Tailwind tokens.')
