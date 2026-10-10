"""Static release checks. Does not certify browser/device installation."""
import json
import re
import struct
from pathlib import Path

root = Path(__file__).resolve().parents[1]
manifest = json.loads((root/'frontend/public/manifest.json').read_text())
assert manifest['theme_color'].lower() == '#085041'
assert manifest['start_url'] == manifest['scope'] == '/'
for icon in manifest['icons']:
    file = root/'frontend/public'/icon['src']
    assert file.exists(), file
    if icon['type'] == 'image/png':
        dimensions = struct.unpack('>II', file.read_bytes()[16:24])
        assert f'{dimensions[0]}x{dimensions[1]}' == icon['sizes'], file
for screenshot in manifest.get('screenshots', []):
    assert (root/'frontend/public'/screenshot['src']).exists()
css = (root/'frontend/src/index.css').read_text()
for name, value in {'primary':'#1d9e75','primary-hover':'#168260','secondary':'#085041','accent':'#ef9f27','success-bg':'#e1f5ee'}.items():
    assert f'--afri-{name}: {value}' in css
for file in (root/'frontend/src').rglob('*.jsx'):
    assert not re.search(r'#(?:f97316|ea580c|0b0b0d|17171a)', file.read_text(encoding='utf-8'), re.I), file
sw = (root/'frontend/public/service-worker.js').read_text()
assert 'afrimarket-green-rc2-v8' in sw and 'startsWith("afrimarket-")' in sw
config = json.loads((root/'frontend/capacitor.config.json').read_text())
assert config['appId'] == 'cd.cognito.afrimarket'
assert not config['server']['cleartext'] and not config['android']['allowMixedContent']
print('PASS: historical palette, JSX brand tokens, manifest icons/dimensions, scoped PWA cache update, Capacitor HTTPS settings')
