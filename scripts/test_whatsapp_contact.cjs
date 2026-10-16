// Author: Jonathan Kakesa (JonathanK-N).
const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
(async () => {
  const {legacyBusinessPhone, whatsappLink} = await import(pathToFileURL(path.join(__dirname, '../frontend/src/lib/whatsapp_contact.mjs')).href);
  const phone = '+243810000001';
  for (const value of [phone, '00243 810 000 001', '243810000001', 'https://wa.me/243810000001?text=commande%20123456', 'https://api.whatsapp.com/send?phone=243810000001&text=123456']) {
    assert.equal(legacyBusinessPhone(value), phone);
  }
  for (const value of [null, {}, 'https://example.invalid/243810000001', 'https://wa.me.evil.invalid/243810000001', 'https://user:password@wa.me/243810000001', 'https://wa.me/243810000001/123', 'abc243810000001', '0810000001']) {
    assert.equal(legacyBusinessPhone(value), '');
  }
  for (const contact of [null, {phone}, {phone, verified: true}, {phone, verified: false, visible: true}, {phone, verified: true, visible: false}, {phone, verified: 'false', visible: true}]) {
    assert.equal(whatsappLink(contact), null, 'Legacy or unconsented contacts must never become public links');
  }
  const link = new URL(whatsappLink({phone, verified: true, visible: true}, 'AF-123/456'));
  assert.equal(link.origin, 'https://wa.me');
  assert.equal(link.pathname, '/243810000001');
  assert.ok(link.searchParams.get('text').includes('AF-123/456'));
  console.log('PASS: legacy number extraction, no URL/query digit corruption, strict consent and verification, encoded WhatsApp draft');
})().catch(error => { console.error(error); process.exitCode = 1; });
