const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const babel = require('@babel/core');

// Exercise the actual request and startup functions without loading native UI modules.
const source = fs.readFileSync(path.join(__dirname, '..', 'App.js'), 'utf8');
const ast = babel.parseSync(source, {
  babelrc: false,
  configFile: false,
  parserOpts: { sourceType: 'module', plugins: ['jsx'] },
});
const sourceFor = node => source.slice(node.start, node.end);
const apiNode = ast.program.body.find(node =>
  node.type === 'FunctionDeclaration' && node.id.name === 'api');
const apiConstants = ast.program.body.filter(node =>
  node.type === 'VariableDeclaration' &&
  node.declarations.some(declaration => ['API_URL', 'API_TIMEOUT_MS'].includes(declaration.id.name)));
const appNode = ast.program.body.find(node =>
  node.type === 'ExportDefaultDeclaration').declaration;
const bootEffect = appNode.body.body.find(node =>
  node.type === 'ExpressionStatement' &&
  node.expression.type === 'CallExpression' &&
  node.expression.callee.name === 'useEffect');
const bootNode = bootEffect.expression.arguments[0].body.body[0].expression;

function requestHarness(fetch) {
  let fireTimeout;
  let cleared = false;
  const context = vm.createContext({
    AbortController,
    process: { env: {} },
    fetch,
    setTimeout(callback, delay) {
      assert.ok(delay >= 20000 && delay <= 30000, 'requests must have a bounded timeout');
      fireTimeout = callback;
      return 1;
    },
    clearTimeout(id) {
      assert.equal(id, 1);
      cleared = true;
    },
  });
  vm.runInContext([...apiConstants.map(sourceFor), sourceFor(apiNode)].join('\n'), context);
  return {
    api: context.api,
    expire: () => fireTimeout(),
    timerCleared: () => cleared,
  };
}

async function bootHarness({ status, storageFailure, removeFailure } = {}) {
  const result = { removed: [], booted: false };
  const context = vm.createContext({
    checkTrial: async () => {
      if (storageFailure) throw new Error('Storage unavailable');
    },
    configurePurchases: async () => false,
    getSubscriptionStatus: async () => ({ active: false }),
    setSubActive(value) { result.active = value; },
    AsyncStorage: {
      getItem: async key => key === 'code' ? 'ABC123' : 'Sarah',
      removeItem: async key => {
        if (removeFailure) throw new Error('Storage removal failed');
        result.removed.push(key);
      },
    },
    CODE_KEY: 'code',
    NAME_KEY: 'name',
    api: async () => {
      if (status) throw Object.assign(new Error('Fetch failed'), { status });
      return { code: 'ABC123' };
    },
    setCircle(circle) { result.circle = circle; },
    setMemberName(name) { result.name = name; },
    registerForPushNotifications() { result.registered = true; },
    setBooted(value) { result.booted = value; },
    console: { warn() {} },
  });
  await vm.runInContext(sourceFor(bootNode), context);
  return result;
}

test('requests default to the hosted API, send JSON, and clear their timer', async () => {
  const harness = requestHarness(async (url, options) => {
    assert.equal(url, 'https://carecircle-app.onrender.com/api/circle');
    assert.equal(options.method, 'POST');
    assert.equal(options.body, '{"name":"Family"}');
    assert.equal(options.headers['Content-Type'], 'application/json');
    assert.ok(options.signal);
    return { ok: true, status: 201, json: async () => ({ code: 'ABC123' }) };
  });
  const circle = await harness.api('/api/circle', 'POST', { name: 'Family' });
  assert.equal(circle.code, 'ABC123');
  assert.ok(harness.timerCleared());
});

test('HTTP errors retain their status for missing-circle detection', async () => {
  const harness = requestHarness(async () => ({
    ok: false, status: 404, json: async () => ({ error: 'Circle not found' }),
  }));
  await assert.rejects(harness.api('/api/circle/ABC123'), error =>
    error.status === 404 && error.message === 'Circle not found');
  assert.ok(harness.timerCleared());
});

test('non-JSON server errors retain their HTTP status and clear the timer', async () => {
  const harness = requestHarness(async () => ({
    ok: false,
    status: 503,
    json: async () => { throw new Error('HTML response'); },
  }));
  await assert.rejects(harness.api('/health'), error => error.status === 503);
  assert.ok(harness.timerCleared());
});

test('a request timeout aborts fetch and returns a recoverable error', async () => {
  const harness = requestHarness(async (_, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error('Aborted')));
  }));
  const pending = harness.api('/health');
  harness.expire();
  await assert.rejects(pending, /took too long/);
  assert.ok(harness.timerCleared());
});

test('startup restores an existing circle and finishes loading', async () => {
  const result = await bootHarness();
  assert.equal(result.circle.code, 'ABC123');
  assert.equal(result.name, 'Sarah');
  assert.ok(result.registered);
  assert.ok(result.booted);
});

test('a temporary restore failure preserves the invite code and finishes loading', async () => {
  const result = await bootHarness({ status: 503 });
  assert.deepEqual(result.removed, []);
  assert.ok(result.booted);
});

test('a missing circle clears the saved code and finishes loading', async () => {
  const result = await bootHarness({ status: 404 });
  assert.deepEqual(result.removed, ['code']);
  assert.ok(result.booted);
});

test('storage initialization failure still exits the loading screen', async () => {
  assert.ok((await bootHarness({ storageFailure: true })).booted);
});

test('failed stale-code removal still exits the loading screen', async () => {
  assert.ok((await bootHarness({ status: 404, removeFailure: true })).booted);
});
