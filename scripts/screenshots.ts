/**
 * Visual + layout verification. Structural assertions against served HTML kept
 * missing real layout bugs, so this drives a real browser.
 *
 * Usage: npx tsx scripts/screenshots.ts [baseUrl]
 * Writes screenshots/<page>-<width>.png and fails (exit 1) on any 404, console
 * warning,
 * error, page-level scrolling, or dialogue text overflowing its fixed box.
 */
import { chromium, type ConsoleMessage, type Request } from 'playwright';
import * as fs from 'fs';
import debatesRaw from '../data/debates.json';
import courtRecord from '../data/court-record.json';
import { playDebate, playIntro } from './play-debate';

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
      p.on('requestfailed', (r: Request) => {
        const err = r.failure()?.errorText ?? '';
        // Next aborts its own speculative route prefetches (?_rsc=...) when they
        // are superseded. In production those show up as net::ERR_ABORTED; they
        // are not broken requests.
        if (err === 'net::ERR_ABORTED' && new URL(r.url()).searchParams.has('_rsc')) return;
        failed.push(`${r.url()} (${err})`);
      });
      p.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });
      // Warnings count too. Counting only errors let ~47 AudioContext warnings per
      // courtroom load pass this harness unnoticed.
      p.on('console', (m: ConsoleMessage) => {
        if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`);
      });

      // Every audio request, in order. Nothing may load before the begin click.
      const audio: string[] = [];
      p.on('request', (r) => { if (/\/sounds\/|\.(mp3|m4a|ogg|wav)(\?|$)/.test(r.url())) audio.push(r.url()); });

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
        // Every debate, not a sample: a broken topic only fails when it is played.
        const sample = topics;
        if (audio.length) problems.push(`${page.name}@${vp.label}: ${audio.length} audio file(s) loaded before the begin click: ${audio.join(', ')}`);
        let ended = 0;
        let evidenceShown = 0;
        let first = true;
        for (const topic of sample) {
          const r = await playDebate(p, topic);
          if (r.ok) ended++;
          const ev = r.evidence;
          const wantEvidence = courtRecord.some((c) => c.title === topic);
          if (wantEvidence && !ev?.shown) problems.push(`${page.name}@${vp.label}: "${topic}" showed no evidence card`);
          if (!wantEvidence && ev?.shown) problems.push(`${page.name}@${vp.label}: "${topic}" showed an evidence card it has no record for`);
          if (ev?.shown && ev.overlapsDialogue) problems.push(`${page.name}@${vp.label}: "${topic}" evidence card overlaps the dialogue box`);
          if (ev?.shown && !ev.dismissedOnAdvance) problems.push(`${page.name}@${vp.label}: "${topic}" evidence card stayed after advancing`);
          if (ev?.shown) evidenceShown++;
          // Fresh context = first visit: the intro must play, all of it.
          if (first && r.introLines < 6) problems.push(`${page.name}@${vp.label}: first visit showed ${r.introLines} intro lines, expected 6`);
          if (first) note += `  intro ${r.introLines} lines |`;
          if (first && !audio.some((u) => u.includes('/sounds/bgm.mp3'))) problems.push(`${page.name}@${vp.label}: music did not load after the begin click`);
          first = false;
          if (!r.ok) problems.push(`${page.name}@${vp.label}: "${r.topic}" ${r.problem}`);
        }
        note += `  ${ended}/${sample.length} debates reached the end card, ${evidenceShown} evidence cards`;

        // The end card's REPLAY INTRO must bring the intro back and hand over again.
        if (await p.isVisible('[data-testid="end-replay-intro"]')) {
          await p.click('[data-testid="end-replay-intro"]');
          await p.waitForTimeout(300);
          const again = await playIntro(p);
          if (again < 6) problems.push(`${page.name}@${vp.label}: REPLAY INTRO played ${again} lines, expected 6`);
          else note += ` | replay intro ok`;
        }
        // Not networkidle: on a reload, Next re-sends its route prefetches and the
        // duplicates hold their response open for ~30s before aborting.
        await p.reload({ waitUntil: 'load' });
        // Every visit must open on the begin screen (it is what unlocks audio).
        const begin = await p.waitForSelector('[data-testid="begin"]', { timeout: 5000 }).catch(() => null);
        if (begin) await begin.click();
        else problems.push(`${page.name}@${vp.label}: no begin screen`);
        // Returning visitor (the intro flag is now saved): straight to the debate.
        await p.waitForTimeout(1600);
        if (await p.isVisible('[data-testid="skip-intro"]')) problems.push(`${page.name}@${vp.label}: intro replayed for a returning visitor`);
        else note += ` | returning visit skips intro`;
        await p.waitForTimeout(1200);
        await p.screenshot({ path: shot });

        // Does any line in the whole dataset overflow the fixed-height box?
        const overflow = await p.evaluate((texts: string[]) => {
          const box = document.querySelector('[data-testid="dialogue-text"]') as HTMLElement | null;
          const para = box?.querySelector('[data-testid="dialogue-line"]') as HTMLElement | null;
          if (!box || !para) return { missing: true, worst: 0, count: 0, sample: '' };
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
          const els = ['select', '[data-testid="mute-toggle"]', '[data-testid="music-toggle"]', 'header a[href="/"]']
            .map((q) => document.querySelector(q)?.getBoundingClientRect());
          if (els.some((e) => !e)) return null;
          const r = els as DOMRect[];
          return {
            gap: Math.round(Math.min(...r.slice(1).map((e, i) => (Math.abs(e.top - r[i].top) < 4 ? e.left - r[i].right : Infinity)))),
            minH: Math.round(Math.min(...r.map((e) => e.height))),
            selW: Math.round(r[0].width),
          };
        });
        if (!bar) problems.push(`${page.name}@${vp.label}: top bar controls missing`);
        else {
          if (bar.gap < 0) problems.push(`${page.name}@${vp.label}: top bar overlaps by ${-bar.gap}px`);
          if (bar.minH < 40) problems.push(`${page.name}@${vp.label}: tap target under 40px (${bar.minH}px)`);
          if (bar.selW < 120) problems.push(`${page.name}@${vp.label}: topic select squeezed to ${bar.selW}px`);
          note += `  | topbar gap ${bar.gap}px, min target ${bar.minH}px, select ${bar.selW}px`;
        }

        // Both sound switches survive a reload.
        await p.click('[data-testid="mute-toggle"]');
        await p.click('[data-testid="music-toggle"]');
        await p.reload({ waitUntil: 'load' });
        await p.waitForSelector('[data-testid="begin"]');
        const pressed = await p.evaluate(() =>
          ['mute-toggle', 'music-toggle'].map((t) => document.querySelector(`[data-testid="${t}"]`)?.getAttribute('aria-pressed'))
        );
        if (pressed.join() !== 'false,false') problems.push(`${page.name}@${vp.label}: toggles did not persist (sfx/music pressed = ${pressed.join('/')})`);
        else note += ' | toggles persist';
      }

      if (page.fullscreen && vScroll > 0) problems.push(`${page.name}@${vp.label}: page scrolls vertically by ${vScroll}px`);
      if (hScroll > 0) problems.push(`${page.name}@${vp.label}: page scrolls horizontally by ${hScroll}px`);
      failed.forEach((f) => problems.push(`${page.name}@${vp.label}: request failed ${f}`));
      errors.forEach((e) => problems.push(`${page.name}@${vp.label}: console ${e}`));

      console.log(
        `${(page.name + '@' + vp.label).padEnd(14)} ${shot.padEnd(30)} ` +
        `vscroll=${vScroll}px hscroll=${hScroll}px reqfail=${failed.length} console=${errors.length}${note}`
      );
      await ctx.close();
    }
  }

  // Doorways into the courtroom: title menu, deep links, "take it to court".
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const p = await ctx.newPage();
    const where = 'doorways@390';
    p.on('console', (m: ConsoleMessage) => {
      if (m.type() === 'error' || m.type() === 'warning') problems.push(`${where}: console ${m.type()}: ${m.text()}`);
    });
    p.on('response', (r) => { if (r.status() >= 400) problems.push(`${where}: ${r.status()} ${r.url()}`); });

    // Menu: focus starts on the first option; arrows move; Enter picks.
    await p.goto(BASE + '/court', { waitUntil: 'load' });
    await p.waitForSelector('[data-testid="menu-intro"]');
    const focus0 = await p.evaluate(() => document.activeElement?.getAttribute('data-testid'));
    await p.keyboard.press('ArrowDown');
    const focus1 = await p.evaluate(() => document.activeElement?.getAttribute('data-testid'));
    await p.keyboard.press('Enter');
    const introShown = await p.waitForSelector('[data-testid="skip-intro"]', { timeout: 5000 }).then(() => true, () => false);
    if (focus0 !== 'begin' || focus1 !== 'menu-intro' || !introShown) {
      problems.push(`${where}: title menu keyboard (focus ${focus0} -> ${focus1}, intro via Enter: ${introShown})`);
    }

    // Unknown slug: the menu, no error.
    await p.goto(BASE + '/court?topic=no-such-case', { waitUntil: 'load' });
    if (!(await p.waitForSelector('[data-testid="menu-intro"]', { timeout: 5000 }).then(() => true, () => false))) {
      problems.push(`${where}: unknown topic slug did not fall back to the menu`);
    }

    // Every "take it to court" link, clicked from the landing page, lands on
    // its own case and plays to the end card.
    await p.goto(BASE + '/', { waitUntil: 'networkidle' });
    const links = await p.$$eval('[data-testid="take-to-court"]', (as) =>
      as.map((a) => ({ href: a.getAttribute('href'), title: a.closest('li')?.querySelector('h3')?.textContent?.replace(/\s*↗\s*$/, '').trim() ?? '' }))
    );
    const debated = new Set(Object.keys(debatesRaw));
    const cards = await p.$$eval('#projects li h3', (hs) => hs.map((h) => h.textContent?.replace(/\s*↗\s*$/, '').trim() ?? ''));
    const expected = cards.filter((t) => debated.has(t));
    if (links.length !== expected.length) problems.push(`${where}: ${links.length} take-it-to-court links for ${expected.length} debated projects`);
    let played = 0;
    for (let i = 0; i < links.length; i++) {
      if (i > 0) await p.goto(BASE + '/', { waitUntil: 'networkidle' });
      await p.click(`[data-testid="take-to-court"] >> nth=${i}`);
      await p.waitForURL(/\/court\?topic=/);
      const r = await playDebate(p);
      if (r.topic !== links[i].title) problems.push(`${where}: ${links[i].href} opened "${r.topic}", expected "${links[i].title}"`);
      else if (!r.ok) problems.push(`${where}: ${links[i].href} ${r.problem}`);
      else played++;
    }
    console.log(`${where.padEnd(14)} menu focus ${focus0}->${focus1}, intro via keyboard ${introShown} | ${played}/${links.length} take-it-to-court links played to the end card`);
    await ctx.close();
  }

  await browser.close();

  if (problems.length) {
    console.error(`\n${problems.length} PROBLEM(S):`);
    problems.forEach((p) => console.error('  - ' + p));
    process.exit(1);
  }
  console.log('\nAll viewports clean: no scrolling, no failed requests, no console errors or warnings, no text overflow.');
}

main().catch((e) => { console.error(e); process.exit(1); });
