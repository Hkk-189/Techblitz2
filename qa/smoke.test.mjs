// TECH BLITZ frontend — automated checks. Run: npm test   (first time: npm run test:install)
// Runs fully OFFLINE: every http(s) request is blocked, so it also proves the bundled fonts work.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = join(ROOT, 'tech-blitz-jane-protocol.html');
const URL0 = pathToFileURL(PAGE).href;
const HTML = readFileSync(PAGE, 'utf8');
const PUBLIC = JSON.parse(readFileSync(join(ROOT, 'puzzles/puzzles.public.json'), 'utf8')).puzzles;
const ANSWERS = JSON.parse(readFileSync(join(ROOT, 'puzzles/server-only/puzzles.answers.json'), 'utf8')).answers;
const AXE = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');

let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log(`PASS  ${name}`); }
  catch (e) { failed++; console.log(`FAIL  ${name}\n      ${String(e.message).split('\n')[0]}`); }
}
const sha = b => createHash('sha256').update(b).digest('hex');
const walk = d => readdirSync(d).flatMap(f => statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]);

// ---------------- static checks ----------------
await test('answer key, hints and reveal text are not in the page', () => {
  const publicText = JSON.stringify(PUBLIC).toUpperCase();
  const leaks = [];
  for (const a of ANSWERS) {
    for (const ans of a.accepted_answers) {
      // distinctive answers only; words that are legitimately part of a puzzle's own prompt are skipped
      if (ans.length >= 4 && !/^\d+$/.test(ans) && !publicText.includes(ans.toUpperCase()) && HTML.toUpperCase().includes(ans.toUpperCase())) leaks.push(`${a.puzzle_id}: ${ans}`);
    }
    if (a.hint && HTML.includes(a.hint.slice(0, 40))) leaks.push(`${a.puzzle_id}: hint text`);
  }
  for (const k of ['Results walkthrough', 'UMOOUBQ', 'Use the same reveal']) if (HTML.includes(k)) leaks.push(k);
  assert.deepEqual(leaks, []);
});
await test('embedded puzzle data matches puzzles/puzzles.public.json', () => {
  const m = HTML.match(/const PUZZLES = (\[[\s\S]*?\n\]);/);
  assert.ok(m, 'PUZZLES block not found');
  assert.deepEqual(JSON.parse(m[1]), PUBLIC);
});
await test('every embedded image/font is byte-identical to a file in assets/', () => {
  const files = new Map(walk(join(ROOT, 'assets')).filter(f => /\.(webp|woff2)$/.test(f)).map(f => [sha(readFileSync(f)), f]));
  const embedded = [...HTML.matchAll(/data:(?:image\/webp|font\/woff2);base64,([A-Za-z0-9+/=]+)/g)].map(m => sha(Buffer.from(m[1], 'base64')));
  const unmatched = embedded.filter(h => !files.has(h));
  assert.ok(embedded.length >= 17, `only ${embedded.length} embedded assets found`);
  assert.equal(unmatched.length, 0, `${unmatched.length} embedded asset(s) have no source file`);
});
await test('no local, temporary or private paths referenced', () => {
  assert.equal((HTML.match(/(\/mnt\/|\/tmp\/|\/home\/|[A-Z]:\\\\|localhost|127\.0\.0\.1)/g) || []).length, 0);
});

// ---------------- browser checks (offline) ----------------
const browser = await chromium.launch();
async function newPage(viewport = { width: 1440, height: 900 }) {
  const pg = await browser.newPage({ viewport });
  pg.errors = []; pg.on('pageerror', e => pg.errors.push(String(e)));
  await pg.route(/^https?:/, r => r.abort());          // offline: no Google Fonts, no anything
  return pg;
}
const DET = ['cho', 'rigsby', 'van-pelt', 'lisbon'];
const ROUTES = ['#/', '#/briefing', '#/evidence', '#/suspects', '#/investigation', ...DET.map(d => `#/investigation/${d}`),
  ...PUBLIC.map(p => `#/challenge/${p.id}`), '#/final-deduction', '#/results'];

await test(`all ${ROUTES.length} routes render with no page errors`, async () => {
  const pg = await newPage(); const bad = [];
  await pg.goto(URL0 + '#/briefing'); await pg.evaluate('S.t0 = now() - 2e8');   // clock far past: every screen shows real content
  for (const r of ROUTES) { await pg.goto(URL0 + r); await pg.waitForTimeout(150); if (!(await pg.textContent('h1'))) bad.push(r); }
  assert.deepEqual(bad, []); assert.deepEqual(pg.errors, []); await pg.close();
});
await test('unknown routes show "File not found"', async () => {
  const pg = await newPage();
  for (const r of ['#/nope', '#/investigation/nobody', '#/challenge/zzz']) { await pg.goto(URL0 + r); assert.equal((await pg.textContent('h1')).trim(), 'File not found'); }
  await pg.close();
});
await test('bundled fonts load and render with no internet', async () => {
  const pg = await newPage(); await pg.goto(URL0 + '#/investigation'); await pg.waitForTimeout(500);
  const r = await pg.evaluate(async () => {
    await Promise.all(['400','500','600','700'].map(w => document.fonts.load(`${w} 16px "TB Inter"`)).concat(
      [document.fonts.load('16px "TB Bebas Neue"'), document.fonts.load('400 16px "TB IBM Plex Mono"'), document.fonts.load('500 16px "TB IBM Plex Mono"')]));
    const c = document.createElement('canvas').getContext('2d'); const w = f => { c.font = f; return c.measureText('TECH BLITZ').width; };
    return { loaded: [...document.fonts].filter(f => f.status === 'loaded').length, bebas: w('100px "TB Bebas Neue"'), impact: w('100px Impact') };
  });
  assert.equal(r.loaded, 7, `${r.loaded}/7 font faces loaded`);
  assert.ok(r.bebas < r.impact * 0.85, 'Bebas Neue is not actually rendering');
  await pg.close();
});
await test('no horizontal overflow at 1440 / 1024 / 390 px', async () => {
  const bad = [];
  for (const width of [1440, 1024, 390]) {
    const pg = await newPage({ width, height: 900 });
    await pg.goto(URL0 + '#/briefing'); await pg.evaluate('S.t0 = now() - 2e8');
    for (const r of ROUTES) { await pg.goto(URL0 + r); await pg.waitForTimeout(80);
      const ov = await pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (ov > 1) bad.push(`${width}px ${r} (+${ov}px)`); }
    await pg.close();
  }
  assert.deepEqual(bad, []);
});
await test('case clock: reading time locks Cho, then unlocks him on its own', async () => {
  const pg = await newPage();
  await pg.goto(URL0 + '#/investigation/cho'); assert.equal(await pg.locator('.field-card').count(), 1);
  await pg.goto(URL0 + '#/briefing'); await pg.evaluate('S.skew = windows()[0].open - Date.now() - 1200');
  await pg.waitForTimeout(2600);
  await pg.goto(URL0 + '#/investigation/cho'); assert.equal(await pg.locator('.field-card').count(), 0, 'Cho still locked');
  await pg.close();
});
await test('submit flow: confirm → receipt → locked, no correctness shown, Part B opens', async () => {
  const pg = await newPage();
  await pg.goto(URL0 + '#/briefing'); await pg.evaluate('S.t0 = now() - 6*60000');
  await pg.goto(URL0 + '#/challenge/cho-b'); assert.equal(await pg.locator('.story').count(), 0, 'Part B visible before Part A');
  await pg.goto(URL0 + '#/challenge/cho-a');
  await pg.click('#submit'); assert.equal(await pg.getAttribute('#ans', 'aria-invalid'), 'true', 'empty submit not blocked');
  await pg.fill('#ans', '9'); await pg.fill('#ans-m', '43'); await pg.click('#submit');
  assert.equal((await pg.textContent('.answer-preview')).trim(), '9:43');
  await pg.click('#confirm-sub'); await pg.waitForTimeout(1000);
  assert.notEqual(await pg.getAttribute('#ans', 'readonly'), null, 'input not locked');
  const body = await pg.textContent('body');
  for (const w of ['Correct', 'Incorrect', 'Not quite', 'Try again']) assert.ok(!body.includes(w), `verdict word shown: ${w}`);
  await pg.goto(URL0 + '#/challenge/cho-b'); assert.equal(await pg.locator('.story').count(), 1, 'Part B did not open');
  await pg.close();
});
await test('evidence: search, filter, detail drawer, Esc', async () => {
  const pg = await newPage(); await pg.goto(URL0 + '#/evidence');
  await pg.fill('#evq', 'thermostat'); assert.equal(await pg.locator('#ev-list .ev').count(), 1);
  await pg.fill('#evq', 'zzzz'); assert.equal(await pg.locator('#ev-list .empty').count(), 1);
  await pg.fill('#evq', ''); await pg.click('.ev[data-ev="EV-02"]'); await pg.waitForTimeout(300);
  assert.equal(await pg.locator('.drawer.open').count(), 1);
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(300); assert.equal(await pg.locator('.drawer.open').count(), 0);
  await pg.close();
});
await test('final deduction: locked until cases close, then one final accusation', async () => {
  const pg = await newPage(); await pg.goto(URL0 + '#/briefing'); await pg.evaluate('S.t0 = now() - 6*60000');
  await pg.goto(URL0 + '#/final-deduction'); assert.match(await pg.textContent('.feedback h3'), /Opens once/);
  await pg.evaluate("PUZZLES.forEach(p => S.subs[p.id] = { answer:'x', recorded_at:new Date().toISOString() })");
  await pg.goto(URL0 + '#/investigation'); await pg.goto(URL0 + '#/final-deduction');
  assert.ok(await pg.locator('#review').isDisabled());
  await pg.click('.pick label:has-text("Lena Fischer")'); await pg.click('#review'); await pg.click('#confirm'); await pg.waitForTimeout(1200);
  assert.ok(pg.url().endsWith('#/results'));
  await pg.goto(URL0 + '#/final-deduction'); assert.equal(await pg.locator('.pick').count(), 0, 'could accuse twice');
  await pg.close();
});
await test('accessibility: 0 axe WCAG 2.1 A/AA violations on 8 key screens', async () => {
  const pg = await newPage(); const out = [];
  await pg.goto(URL0 + '#/briefing'); await pg.evaluate('S.t0 = now() - 2e8');
  for (const r of ['#/', '#/briefing', '#/evidence', '#/suspects', '#/investigation', '#/challenge/cho-a', '#/challenge/van-pelt-b', '#/results']) {
    await pg.goto(URL0 + r); await pg.waitForTimeout(250); await pg.addScriptTag({ content: AXE });
    const v = await pg.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21a','wcag21aa'] } }).then(x => x.violations.map(v => v.id)));
    if (v.length) out.push(`${r}: ${v.join(', ')}`);
  }
  assert.deepEqual(out, []); await pg.close();
});

await browser.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
