# QA report: TECH BLITZ frontend

Audit and handoff verification, 13 Oct 2026. **Final status after fixes.** Every result below was observed by running a tool or a browser; nothing is marked PASS from reading code alone.

## Environment

| Tool | Version |
|---|---|
| Chromium (via Playwright) | Playwright 1.56.0 |
| Node.js / npm | 22.22.2 |
| ESLint + eslint-plugin-html | 8.57.1 / 8.1.3 |
| html-validate | 8.29.0 |
| axe-core | 4.14.0 |

Commands run against a **fresh copy of this folder** (installed with `npm ci` from the lockfile):

```
npm ci            → added 153 packages
npm run lint      → exit 0 (0 problems)
npm run validate  → exit 0
npm test          → 13 passed, 0 failed (fully offline)
npm start         → serves app, public data, fonts, images (200); puzzles/server-only → 403; path traversal → 404
```

## Results

| Area | What was tested | Result | Evidence |
|---|---|---|---|
| Build | Production build, TypeScript | NOT APPLICABLE | Single static HTML file; no build or TS by design |
| JavaScript | Syntax + ESLint recommended | PASS | 0 problems (5 found and fixed during audit) |
| HTML | html-validate on source; rendered markup of 22 routes | PASS (source) / PARTIAL (rendered) | Source: 0 errors. Rendered: 0 accessibility errors; style-rule findings remain (inline styles, `<button>` without `type`), none affecting behaviour |
| Routes | 19 app routes + 3 unknown | PASS | All render, 0 page/console errors; unknowns show "File not found" |
| Navigation | CTAs, 11 sidebar links, Next/Back step bar, browser Back, deep links | PASS | e.g. `#/evidence?open=EV-02` opens that record |
| Interactions | 34 asserted checks (dialogs, drawer, search/filter/empty state, submit/cancel/confirm, hints, deduction, mobile menu, ID card hover/click/keyboard) | PARTIAL | 33 pass. Fails: state survives reload (not implemented; needs backend) |
| Case clock | Reading time → auto-unlock; case windows; hint gating | PASS | Unlock happens on the timer tick, no click needed |
| Responsive | Every route at 1920, 1440, 1280, 1024, 768, 390 px | PASS | No horizontal overflow, with fallback **and** bundled fonts |
| Images | 13 rendered images; all assets | PASS | 0 broken, proportions exact (ID card's apparent drift = its 5° tilt). Every embedded image/font byte-identical to `assets/` |
| Fonts | Load with no internet | PASS | All 7 bundled faces load offline. Was **FAIL** before fix (0 faces; Google unreachable) |
| Accessibility | axe WCAG 2.1 A/AA (12 routes); keyboard (84 tab stops); reduced motion | PASS | 0 violations (14 contrast + 1 landmark fixed); focus always visible; 0 animations under `reduce` |
| Security | Answers, hints, reveal, credentials, temp paths | PASS | None in the page; leak scan is part of `npm test` |
| Data integrity | Embedded `PUZZLES` vs `puzzles.public.json` | PASS | Identical |
| Backend readiness | API seam, state, clock | PARTIAL | Clean seam (`API`), but state and clock are client-side (see README §10) |

**Not tested:** Firefox, Safari, physical phones/tablets, a real screen reader, performance on the lab PCs, Google Fonts over a live network (the fallback path was tested with a simulated host).

## Changes made during the audit and handoff

**`tech-blitz-jane-protocol.html`**
- `[, '']` → `[null, '']` in `topicOf()` (ESLint: sparse array)
- `status()` → `statusChip()` (ESLint: shadowed the browser's `window.status`)
- Removed unused `allSubmitted`, `prev` (in `fieldCard`), `initials`
- `--red-ink` `#E0484E` → `#E5535A`; locked-row label opacity `.45` → `.62` (WCAG contrast)
- Bottom step bar renamed "Previous and next step" (duplicate landmark name)
- `#main` focus ring hidden (stray amber line after route changes; controls keep theirs)
- **Fonts bundled:** 7 OFL font files embedded; font stacks now bundled → Google → system

**`assets/`**
- Added `fonts/` (7 × `.woff2` + 3 OFL licence texts)
- 8 WebP files replaced with the exact bytes the page embeds (pixel-identical; only container bytes differed)

**New tooling:** `package.json`, `package-lock.json`, `.eslintrc.json`, `.htmlvalidate.json`, `.gitignore`, `qa/serve.mjs`, `qa/smoke.test.mjs`, `README.md`, this report.

Unchanged: `puzzles/puzzles.public.json`, `puzzles/server-only/puzzles.answers.json`.

## Open items

Real gaps (details in README §11):
1. **Reload resets state.** Needs backend persistence.
2. **Prototype time controls are visible to players.** Hide before the event.
3. **Closing-panel copy assumes submissions.** Product decision.

Intentional placeholders: the mock `API`, the client-side clock, participant `P-DEMO-001`, hint text, results and reveal.

## Handoff readiness

**Ready for backend integration.** The frontend is complete, tested, offline-capable, and has a single documented integration seam. The three open items above should be closed before the live event; none block integration work.
