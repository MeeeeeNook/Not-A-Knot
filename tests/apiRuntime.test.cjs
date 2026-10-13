const test = require('node:test');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ts = require('typescript');

test('deployable API wrappers and CommonJS bundles start in Node without a TypeScript loader', () => {
  const output = fs.mkdtempSync(path.join(path.resolve('node_modules'), '.api-runtime-'));
  const files = ['api/affiliate.ts', 'api/orders/create.ts', 'api/orders/track.ts'];
  try {
    fs.writeFileSync(path.join(output, 'package.json'), JSON.stringify({ type: 'module' }));
    for (const file of files) {
      const emitted = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
      const target = path.join(output, file.replace(/\.ts$/, '.js'));
      fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, emitted);
    }
    fs.cpSync('server/compiled', path.join(output, 'server/compiled'), { recursive: true });
    const script = `
      import assert from 'node:assert/strict';
      import affiliate from './api/affiliate.js';
      import createOrder from './api/orders/create.js';
      const response = { code: 0, setHeader() {}, status(code) { this.code = code; return this; }, json() { return this; } };
      await affiliate({ method: 'GET', query: { code: 'x' } }, response);
      assert.equal(response.code, 400);
      await createOrder({ method: 'GET' }, response);
      assert.equal(response.code, 405);
      console.log('compiled API startup passed');
    `;
    const result = execFileSync(process.execPath, ['--input-type=module', '-e', script], { cwd: output, timeout: 5000, encoding: 'utf8' });
    assert.match(result, /compiled API startup passed/);
  } finally { fs.rmSync(output, { recursive: true, force: true }); }
});
