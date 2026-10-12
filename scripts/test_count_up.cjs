// Author: Jonathan Kakesa (JonathanK-N). Formatting and animation regressions.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync('frontend/src/components/reactbits/CountUp.jsx', 'utf8')
  .replace(/import \{ useEffect, useRef \} from 'react';/, '')
  .replace('export default function CountUp', 'function CountUp')
  .replace(/return <span[^\n]+<\/span>;/, 'return ref;');
function mount(props, suppressed = true) {
  const element = {textContent: ''};
  let constructors = 0, starts = 0, ends = 0;
  const context = {
    useRef: () => ({current: element}), useEffect: effect => effect(),
    window: {matchMedia: () => ({matches: suppressed})},
    Intl: {NumberFormat: function(...args) {constructors++; return new Intl.NumberFormat(...args);}},
    setTimeout: callback => {callback(); return 1;}, clearTimeout() {}, cancelAnimationFrame() {},
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  context.CountUp({...props, onStart: () => starts++, onEnd: () => ends++});
  return {text: element.textContent, constructors, starts, ends};
}
for (const value of [0, 5, 1234, -42, Number.MAX_SAFE_INTEGER]) {
  assert.deepEqual(mount({to: value}), {text: String(value), constructors: 0, starts: 0, ends: 0});
}
assert.equal(mount({to: 1.25}).text, '1.25');
assert.equal(mount({to: 1234, separator: ' '}).text, '1 234');
assert.equal(mount({to: -0}).text, '-0');
assert.equal(mount({to: Number.MAX_SAFE_INTEGER + 1}).constructors, 1);
assert.deepEqual(mount({from: 9, to: 20, direction: 'down'}), {text: '9', constructors: 0, starts: 0, ends: 0});
assert.deepEqual(mount({to: 5, startWhen: false}), {text: '', constructors: 0, starts: 0, ends: 0});
assert.deepEqual(mount({to: 5, duration: 0}, false), {text: '5', constructors: 1, starts: 1, ends: 1});
console.log('PASS: static integer counter avoids locale initialization; decimal, grouping, signed zero, unsafe integers, direction, disabled start and desktop callbacks preserved');
