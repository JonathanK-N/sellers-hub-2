"""One-time provenance-based restoration. Run against the original ui-ux tree."""
import difflib
import json
import re
import subprocess
from pathlib import Path

color = re.compile(r'#[0-9a-fA-F]{6}|(?:bg|text|border)-(?:orange|emerald|green|amber)-\d+|hover:bg-black')
introduced = re.compile(r'#(?:f97316|ea580c|0b0b0d|17171a|1f2937)|(?:bg|text|border)-orange-\d+|hover:bg-black', re.I)
def masked(line):
    return color.sub('COLOR', line).strip()
evidence = []
for path in Path('frontend/src').rglob('*.jsx'):
    name = path.as_posix()
    original_name = name
    if '/components/auth/LoginForm' in name:
        original_name = 'frontend/src/pages/auth/Login.jsx'
    elif '/components/auth/RegisterForm' in name:
        original_name = 'frontend/src/pages/auth/Register.jsx'
    result = subprocess.run(['git', 'show', f'origin/main:{original_name}'], capture_output=True)
    original = result.stdout.decode('utf-8').splitlines() if result.returncode == 0 else []
    candidates = [line for line in original if color.search(line)]
    lines = path.read_text(encoding='utf-8').splitlines()
    for i, line in enumerate(lines):
        if not introduced.search(line):
            continue
        colors = color.findall(line)
        matches = [(difflib.SequenceMatcher(None, masked(line), masked(old)).ratio(), old) for old in candidates if len(color.findall(old)) == len(colors)]
        score, old = max(matches, default=(0, ''), key=lambda item: item[0])
        if score >= .94:
            prior = iter(color.findall(old))
            restored = color.sub(lambda m: next(prior), line)
            if restored != line:
                evidence.append({'file': name, 'line': i+1, 'method': 'main correspondence', 'similarity': score, 'before': line.strip(), 'after': restored.strip()})
                lines[i] = restored
    path.write_text('\n'.join(lines)+'\n', encoding='utf-8')
Path('release-evidence/theme-correspondence.json').write_text(json.dumps(evidence, indent=2, ensure_ascii=False)+'\n', encoding='utf-8')
print(f'Restored {len(evidence)} corresponding lines; remaining uses require component review.')
