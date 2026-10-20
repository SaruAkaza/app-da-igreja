import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runMobileChecks } from './browser/mobile.mjs';
import { runAdminChecks } from './browser/admin.mjs';

// A API deve usar DATA_DIR temporário e DEMO_MODE=true. O teste cria contas fictícias.
const url = new URL(process.env.COMUNHAO_TEST_URL || 'http://127.0.0.1:3017');
assert(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname), 'Use somente uma API local isolada (loopback).');
assert(['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash, 'COMUNHAO_TEST_URL deve conter somente a origem HTTP/HTTPS.');
const base = url.origin;
const response = await fetch(base + '/api/health', { redirect: 'error', signal: AbortSignal.timeout(10000) });
assert(response.ok, 'A API local não respondeu à verificação de saúde.');
assert.equal((await response.json()).demo_mode, true, 'A API precisa usar um banco isolado em modo demonstração.');

let playwright;
try {
  playwright = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
} catch {
  throw new Error('Playwright não encontrado. Instale sem alterar o lock: npm install --no-save --package-lock=false playwright. Depois execute npx playwright install chromium. Também é possível definir PLAYWRIGHT_MODULE e PLAYWRIGHT_CHROMIUM_PATH.');
}
const artifacts = process.env.COMUNHAO_TEST_ARTIFACTS
  ? path.resolve(process.env.COMUNHAO_TEST_ARTIFACTS)
  : fs.mkdtempSync(path.join(os.tmpdir(), 'comunhao-browser-'));
fs.mkdirSync(artifacts, { recursive: true });
const browser = await playwright.chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {}),
  args: ['--no-sandbox'],
});
try {
  const mobile = await runMobileChecks(browser, base, artifacts);
  const admin = await runAdminChecks(browser, base, artifacts);
  console.log(JSON.stringify({ ok: true, mobile, admin, artifacts }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error), artifacts }, null, 2));
  process.exitCode = 1;
} finally {
  await browser.close();
}
