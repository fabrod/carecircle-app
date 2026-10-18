const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const babel = require('@babel/core');

const filename = path.join(__dirname, '..', 'lib', 'purchases.js');
const { code } = babel.transformSync(fs.readFileSync(filename, 'utf8'), {
  filename,
  presets: [['babel-preset-expo', { lazyImports: false }]],
  caller: { name: 'carecircle-tests', isDev: true, preserveEnvVars: true },
  babelrc: false,
  configFile: false,
});

function purchasesHarness({ key, environment = 'standalone', configureError } = {}) {
  const calls = [];
  const exports = {};
  vm.runInNewContext(code, {
    exports,
    __DEV__: true,
    process: { env: { EXPO_PUBLIC_REVENUECAT_API_KEY: key } },
    console: { log() {}, warn() {} },
    require(name) {
      if (name === 'expo-constants') {
        return {
          __esModule: true,
          default: { executionEnvironment: environment },
          ExecutionEnvironment: { StoreClient: 'storeClient' },
        };
      }
      if (name === 'react-native-purchases') {
        return {
          __esModule: true,
          LOG_LEVEL: { DEBUG: 'DEBUG' },
          default: {
            async setLogLevel(level) { calls.push(['setLogLevel', level]); },
            async configure(options) {
              calls.push(['configure', { ...options }]);
              if (configureError) throw configureError;
            },
          },
        };
      }
      if (name.startsWith('@babel/runtime/')) return require(name);
      throw new Error(`Unexpected purchases import: ${name}`);
    },
  });
  return { purchases: exports, calls };
}

test('Expo Go skips a real App Store key without calling the native SDK', async () => {
  const { purchases, calls } = purchasesHarness({
    key: 'appl_unit_test_key', environment: 'storeClient',
  });
  assert.equal(await purchases.configurePurchases(), false);
  assert.equal(purchases.isPurchasesConfigured(), false);
  assert.deepEqual(calls, []);
});

test('standalone builds configure purchases with an App Store key', async () => {
  const { purchases, calls } = purchasesHarness({ key: 'appl_unit_test_key' });
  assert.equal(await purchases.configurePurchases(), true);
  assert.equal(purchases.isPurchasesConfigured(), true);
  assert.deepEqual(calls, [
    ['setLogLevel', 'DEBUG'],
    ['configure', { apiKey: 'appl_unit_test_key' }],
  ]);
});

test('Expo Go permits RevenueCat test keys for its preview adapter', async () => {
  const { purchases, calls } = purchasesHarness({
    key: 'test_unit_test_key', environment: 'storeClient',
  });
  assert.equal(await purchases.configurePurchases(), true);
  assert.equal(purchases.isPurchasesConfigured(), true);
  assert.deepEqual(calls, [
    ['setLogLevel', 'DEBUG'],
    ['configure', { apiKey: 'test_unit_test_key' }],
  ]);
});

test('an absent purchases key skips SDK configuration', async () => {
  const { purchases, calls } = purchasesHarness();
  assert.equal(await purchases.configurePurchases(), false);
  assert.equal(purchases.isPurchasesConfigured(), false);
  assert.deepEqual(calls, []);
});

test('the placeholder purchases key skips SDK configuration', async () => {
  const { purchases, calls } = purchasesHarness({ key: 'REVENUECAT_KEY_GOES_HERE' });
  assert.equal(await purchases.configurePurchases(), false);
  assert.equal(purchases.isPurchasesConfigured(), false);
  assert.deepEqual(calls, []);
});

test('a native configuration failure returns false without rejecting startup', async () => {
  const { purchases, calls } = purchasesHarness({
    key: 'appl_unit_test_key', configureError: new Error('Native SDK unavailable'),
  });
  assert.equal(await purchases.configurePurchases(), false);
  assert.equal(purchases.isPurchasesConfigured(), false);
  assert.equal(calls.filter(([name]) => name === 'configure').length, 1);
});
