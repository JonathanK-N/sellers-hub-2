"""Restore original brand text accidentally neutralized by the UI redesign.

Only exact correspondence after masking color utilities is accepted.
"""
from pathlib import Path
import re
import json
import subprocess

pattern = re.compile(r'(?:text|bg|border|fill|from|to|ring|accent)-(?:\[#[0-9a-fA-F]{6}\]|afri-[a-z-]+|(?:gray|green|amber|orange|emerald)-[0-9]+|white|black)')
tokens = {'1d9e75':'primary','168260':'primary-hover','085041':'secondary','e1f5ee':'soft','ef9f27':'accent'}
evidence = []
for path in Path('frontend/src').rglob('*.jsx'):
    original = subprocess.run(['git','show','origin/main:'+path.as_posix()],capture_output=True)
    if original.returncode:
        continue
    candidates = {}
    for line in original.stdout.decode('utf-8').splitlines():
        if any('#'+value in line.lower() for value in tokens):
            candidates.setdefault(pattern.sub('COLOR',line.strip()), []).append(line)
    lines = path.read_text(encoding='utf-8').splitlines()
    for i,line in enumerate(lines):
        if 'text-gray-900' not in line:
            continue
        matches = candidates.get(pattern.sub('COLOR',line.strip()), [])
        if len(matches) != 1:
            continue
        old_colors = pattern.findall(matches[0])
        new_colors = pattern.findall(line)
        if len(old_colors) != len(new_colors):
            continue
        replacements = iter(old_colors)
        def replace(match):
            old = next(replacements)
            hex_match = re.search(r'#([0-9a-fA-F]{6})',old)
            if match.group(0) == 'text-gray-900' and hex_match and hex_match[1].lower() in tokens:
                return 'text-afri-'+tokens[hex_match[1].lower()]
            return match.group(0)
        restored = pattern.sub(replace,line)
        if restored != line:
            evidence.append({'file':path.as_posix(),'line':i+1,'before':line.strip(),'after':restored.strip(),'method':'exact main correspondence after masking color utilities'})
            lines[i] = restored
    path.write_text('\n'.join(lines)+'\n',encoding='utf-8')
Path('release-evidence/neutralized-brand-restoration.json').write_text(json.dumps(evidence,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
print(f'Restored {len(evidence)} original brand text lines without altering neutral text elsewhere.')
