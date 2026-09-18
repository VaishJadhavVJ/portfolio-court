/**
 * Visual + layout verification. Structural assertions against served HTML kept
 * missing real layout bugs, so this drives a real browser.
 *
 * Usage: npx tsx scripts/screenshots.ts [baseUrl]
 * Writes screenshots/<page>-<width>.png and fails (exit 1) on any 404, console
 * error, page-level scrolling, or dialogue text overflowing its fixed box.
 */
import { chromium, type ConsoleMessage, type Request } from 'playwright';
import * as fs from 'fs';
import debatesRaw from '../data/debates.json';
import { playDebate } from './play-debate';

const BASE = process.argv[2] ?? 'http://localhost:3000';
const OUT = 'screenshots';
const VIEWPORTS = [
  { w: 390, h: 844, label: '390' },
  { w: 768, h: 1024, label: '768' },
  { w: 1440, h: 900, label: '1440' },
];
const PAGES = [
  // fullscreen pages must not scroll; the landing page is long content and should.
  { path: '/', name: 'home', fullscreen: false },
  { path: '/court', name: 'court', fullscreen: true },
];

const allTexts = Object.values(debatesRaw as Record<string, { text: string }[]>)
  .flat()
  .map((l) => l.text)
  .filter((t) => t.trim());

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const problems: string[] = [];

  for (const vp of VIEWPORTS) {
    for (const page of PAGES) {
      const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 1 });
      const p = await ctx.newPage();

      const failed: string[] = [];
      const errors: string[] = [];
      p.on('requestfailed', (r: Request) => failed.push(`${r.url()} (${r.failure()?.errorText})`));
      p.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });
      p.on('console', (m: ConsoleMessage) => { if (m.type() === 'error') errors.push(m.text()); });

      await p.goto(BASE + page.path, { waitUntil: 'networkidle' });
      await p.waitForTimeout(600);

      const shot = `${OUT}/${page.name}-${vp.label}.png`;
      await p.screenshot({ path: shot });

      // Page-level scrolling: nothing should overflow the viewport.
      const scroll = await p.evaluate(() => ({
        scrollH: document.documentElement.scrollHeight,
        clientH: document.documentElement.clientHeight,
        scrollW: document.documentElement.scrollWidth,
        clientW: document.documentElement.clientWidth,
      }));
      const vScroll = scroll.scrollH - scroll.clientH;
      const hScroll = scroll.scrollW - scroll.clientW;

      let note = '';
      if (page.name === 'court') {
        // Play a debate to the last line first. A build that renders line 1 but
        // cannot advance used to pass every check here; it never clicked.
        const topics: string[] = await p.$$eval('select option', (os) => os.map((o) => (o as HTMLOptionElement).value));
        const sample = topics.slice(0, 3);
        for (const topic of sample) {
          const r = await playDebate(p, topic);
          if (!r.ok) problems.push(`${page.name}@${vp.label}: "${r.topic}" stuck at line ${r.stuckAt}/${r.total}`);
        }
        note += `  played ${sample.length} debates to the end`;
        await p.reload({ waitUntil: 'networkidle' });
        await p.waitForTimeout(400);
        await p.screenshot({ path: shot });

        // Does any line in the whole dataset overflow the fixed-height box?
        const overflow = await p.evaluate((texts: string[]) => {
          const box = document.querySelector('[data-testid="dialogue-text"]') as HTMLElement | null;
          if (!box) return { missing: true, worst: 0, count: 0, sample: '' };
          const para = box.querySelector('p') as HTMLElement;
          const original = para.textContent ?? '';
          let worst = 0, count = 0, sample = '';
          for (const t of texts) {
            para.textContent = t;
            const over = box.scrollHeight - box.clientHeight;
            if (over > 0) { count++; if (over > worst) { worst = over; sample = t.slice(0, 60); } }
          }
          para.textContent = original;
          return { missing: false, worst, count, sample };
        }, allTexts);

        if (overflow.missing) problems.push(`${page.name}@${vp.label}: dialogue box not found`);
        else if (overflow.count > 0) {
          problems.push(`${page.name}@${vp.label}: ${overflow.count}/${allTexts.length} lines overflow by up to ${overflow.worst}px ("${overflow.sample}...")`);
          note += `  | ${overflow.count} lines overflow (worst +${overflow.worst}px)`;
        } else {
          note += `  | all ${allTexts.length} lines fit`;
        }

        // Top bar must not overlap on narrow screens.
        const bar = await p.evaluate(() => {
          const sel = document.querySelector('select')?.getBoundingClientRect();
          const esc = document.querySelector('a[href="/"]')?.getBoundingClientRect();
          if (!sel || !esc) return null;
          return { gap: Math.round(esc.left - sel.right), selH: Math.round(sel.height), escH: Math.round(esc.height) };
        });
        if (bar) {
          if (bar.gap < 0) problems.push(`${page.name}@${vp.label}: top bar overlaps by ${-bar.gap}px`);
          if (bar.selH < 40 || bar.escH < 40) problems.push(`${page.name}@${vp.label}: tap targets under 40px (select ${bar.selH}, escape ${bar.escH})`);
          note += `  | topbar gap ${bar.gap}px, targets ${bar.selH}/${bar.escH}px`;
        }
      }

      if (page.fullscreen && vScroll > 0) problems.push(`${page.name}@${vp.label}: page scrolls vertically by ${vScroll}px`);
      if (hScroll > 0) problems.push(`${page.name}@${vp.label}: page scrolls horizontally by ${hScroll}px`);
      failed.forEach((f) => problems.push(`${page.name}@${vp.label}: request failed ${f}`));
      errors.forEach((e) => problems.push(`${page.name}@${vp.label}: console error ${e}`));

      console.log(
        `${(page.name + '@' + vp.label).padEnd(14)} ${shot.padEnd(30)} ` +
        `vscroll=${vScroll}px hscroll=${hScroll}px reqfail=${failed.length} err=${errors.length}${note}`
      );
      await ctx.close();
    }
  }

  await browser.close();

  if (problems.length) {
    console.error(`\n${problems.length} PROBLEM(S):`);
    problems.forEach((p) => console.error('  - ' + p));
    process.exit(1);
  }
  console.log('\nAll viewports clean: no scrolling, no failed requests, no console errors, no text overflow.');
}

main().catch((e) => { console.error(e); process.exit(1); });
