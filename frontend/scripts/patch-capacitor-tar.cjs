// Capacitor CLI 6 imports tar's removed default export. Keep the corrected tar
// version and adapt this one import until the native platform upgrade is tested.
const fs = require('node:fs');
const path = require('node:path');
const cli = path.dirname(require.resolve('@capacitor/cli/package.json'));
const version = JSON.parse(fs.readFileSync(path.join(cli, 'package.json'), 'utf8')).version;
if (version !== '6.2.2') throw Error('Revalidate tar compatibility before changing Capacitor CLI');
const target = path.join(cli, 'dist/util/template.js');
const original = fs.readFileSync(target, 'utf8');
const importLine = 'const tar_1 = tslib_1.__importDefault(require("tar"));';
const correctedImport = 'const tar_1 = require("tar");';
if (original.includes(correctedImport) && original.includes('await tar_1.extract(')) {
  console.log('PASS: Capacitor tar compatibility already applied');
} else {
  if (!original.includes(importLine) || !original.includes('await tar_1.default.extract(')) throw Error('Unexpected Capacitor template source');
  fs.writeFileSync(target, original.replace(importLine, correctedImport).replace('await tar_1.default.extract(', 'await tar_1.extract('));
  console.log('PASS: Capacitor uses the corrected tar named export');
}
