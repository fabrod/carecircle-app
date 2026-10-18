const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const babel = require('@babel/core');

test('the configured native entry registers the exported app with Expo', () => {
  const root = path.resolve(__dirname, '..');
  const entry = require('../package.json').main;
  const registrations = [];
  function App() {}
  const { code } = babel.transformSync(fs.readFileSync(path.join(root, entry), 'utf8'), {
    filename: path.join(root, entry),
    presets: [['babel-preset-expo', { lazyImports: false }]],
    babelrc: false,
    configFile: false,
  });
  vm.runInNewContext(code, {
    require(name) {
      if (name === 'expo') return { registerRootComponent: app => registrations.push(app) };
      if (name === './App') return { __esModule: true, default: App };
      if (name.startsWith('@babel/runtime/')) return require(name);
      throw new Error(`Unexpected entry import: ${name}`);
    },
  });
  assert.deepEqual(registrations, [App]);
});
