const test = require('node:test');
const { execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');

test('API modules start in native Node without importing browser Firebase utilities', () => {
  const script = `
    import assert from 'node:assert/strict';
    import affiliate from './api/affiliate.ts';
    import createOrder from './api/orders/create.ts';
    const response = { code: 0, setHeader() {}, status(code) { this.code = code; return this; }, json() { return this; } };
    await affiliate({ method: 'GET', query: { code: 'x' } }, response);
    assert.equal(response.code, 400);
    await createOrder({ method: 'GET' }, response);
    assert.equal(response.code, 405);
    console.log('native API startup passed');
  `;
  const output = execFileSync(process.execPath, ['--input-type=module', '-e', script], { cwd: process.cwd(), timeout: 5000, encoding: 'utf8' });
  assert.match(output, /native API startup passed/);
});
