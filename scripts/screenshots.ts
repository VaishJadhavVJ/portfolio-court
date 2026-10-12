/**
 * Visual + layout verification. Structural assertions against served HTML kept
 * missing real layout bugs, so this drives a real browser.
 *
 * Usage: npx tsx scripts/screenshots.ts [baseUrl]
 * Writes screenshots/<page>-<width>.png and fails (exit 1) on any 404, console
 * warning,
 * error, page-level scrolling, or dialogue text overflowing its fixed box.
 */
import { chromium, type ConsoleMessage, type Request, type Page } from 'playwright';
import * as fs from 'fs';
import debatesRaw from '../data/debates.json';
import courtRecord from '../data/court-record.json';
import verdictsRaw from '../data/verdicts.json';

const verdicts = verdictsRaw as Record<string, { title: string; verdict: string }>;

/** Title card, verdict line and end card, in that order, or what went wrong. */
function caseShape(r: { topic: string; ok: boolean; titleCard?: string | null; verdict?: boolean }): string | null {
  const want = verdicts[r.topic]?.title;
  if (!want) return 'has no entry in data/verdicts.json';
  if (r.titleCard !== want) return `title card was ${JSON.stringify(r.titleCard)}, expected ${JSON.stringify(want)}`;
  if (r.ok && !r.verdict) return 'last line was not the narrator verdict';
  return null;
}
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
  { path: '/readings', name: 'readings', fullscreen: false },
];
const NAV_WIDTHS = [320, 390, 768, 1440];
const LINE = 32; // pleading paper baseline grid

/** Navbar: three zones, logo dead centre, nothing overlapping or off-screen. */
async function checkNav(p: Page, where: string, problems: string[]) {
  // A string, not a function: tsx wraps named helpers in __name(), which does not exist in the page.
  const r = (await p.evaluate(`(() => {
    const box = (el) => (el ? el.getBoundingClientRect() : null);
    const visible = (el) => { if (!el) return false; const b = el.getBoundingClientRect(); return b.width > 0 && b.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };
    const zone = (id) => {
      const kids = [...document.querySelectorAll('[data-testid="' + id + '"] > *')].flatMap((k) => (getComputedStyle(k).display === 'contents' ? [...k.children] : [k]));
      const rects = kids.filter(visible).map((k) => k.getBoundingClientRect());
      if (!rects.length) return null;
      return { left: Math.min(...rects.map((b) => b.left)), right: Math.max(...rects.map((b) => b.right)) };
    };
    const logo = box(document.querySelector('[data-testid="nav-logo"]'));
    const vw = document.documentElement.clientWidth;
    const all = [...document.querySelectorAll('[data-testid="site-nav"] a, [data-testid="site-nav"] button')].filter(visible).map((e) => e.getBoundingClientRect());
    return {
      vw, left: zone('nav-left'), right: zone('nav-right'), logo: logo && { left: logo.left, right: logo.right },
      offscreen: all.filter((b) => b.left < -0.5 || b.right > vw + 0.5).length,
      menuButton: visible(document.querySelector('[data-testid="nav-menu-button"]')),
      sectionLinks: [...document.querySelectorAll('[data-testid="nav-left"] ul a')].filter(visible).length,
      icons: [...document.querySelectorAll('[data-testid="nav-right"] ul a')].filter(visible).map((a) => a.getAttribute('aria-label')),
    };
  })()`)) as {
    vw: number;
    left: { left: number; right: number } | null;
    right: { left: number; right: number } | null;
    logo: { left: number; right: number } | null;
    offscreen: number;
    menuButton: boolean;
    sectionLinks: number;
    icons: (string | null)[];
  };
  if (!r.logo || !r.left || !r.right) return problems.push(`${where}: navbar zones missing`);
  const centre = (r.logo.left + r.logo.right) / 2;
  if (Math.abs(centre - r.vw / 2) > 1) problems.push(`${where}: logo centre ${centre.toFixed(1)} vs viewport centre ${r.vw / 2}`);
  if (r.left.right > r.logo.left) problems.push(`${where}: left zone overlaps the logo by ${(r.left.right - r.logo.left).toFixed(1)}px`);
  if (r.logo.right > r.right.left) problems.push(`${where}: right zone overlaps the logo by ${(r.logo.right - r.right.left).toFixed(1)}px`);
  if (r.offscreen) problems.push(`${where}: ${r.offscreen} navbar control(s) off-screen`);
  if (!r.menuButton && (r.sectionLinks !== 4 || r.icons.some((l) => !l))) problems.push(`${where}: desktop nav shows ${r.sectionLinks} section links, icons ${JSON.stringify(r.icons)}`);
  if (r.menuButton) {
    // Keyboard: open with Enter, Tab into the panel, Escape closes and returns focus.
    await p.focus('[data-testid="nav-menu-button"]');
    await p.keyboard.press('Enter');
    const opened = await p.isVisible('[data-testid="nav-menu"]');
    await p.keyboard.press('Tab');
    const inside = await p.evaluate(() => !!document.activeElement?.closest('#site-menu'));
    const menuOff = await p.evaluate(() => [...document.querySelectorAll('#site-menu a')].filter((a) => { const b = a.getBoundingClientRect(); return b.right > document.documentElement.clientWidth + 0.5 || b.left < -0.5; }).length);
    await p.keyboard.press('Escape');
    const closed = !(await p.isVisible('[data-testid="nav-menu"]'));
    const back = await p.evaluate(() => document.activeElement?.getAttribute('data-testid'));
    if (!opened || !inside || !closed || back !== 'nav-menu-button' || menuOff) {
      problems.push(`${where}: dropdown keyboard (open ${opened}, tab inside ${inside}, escape closes ${closed}, focus back ${back}, off-screen items ${menuOff})`);
    }
  }
  return null;
}

/** Pleading paper: every line and gap on the 32px grid, margin numbers aligned (hidden on phones). */
async function checkPleading(p: Page, where: string, problems: string[]) {
  const r = await p.evaluate((L) => {
    const art = document.querySelector('[data-testid="pleading"]');
    if (!art) return { missing: true, off: [] as string[], numbers: '', vw: 0 };
    const top = art.getBoundingClientRect().top;
    const off: string[] = [];
    for (const el of art.querySelectorAll('p, h1, h2, h3, li, pre, blockquote, nav')) {
      const b = el.getBoundingClientRect();
      const dt = (b.top - top) % L, dh = b.height % L;
      if (Math.min(dt, L - dt) > 0.5 || Math.min(dh, L - dh) > 0.5) off.push(`${el.tagName.toLowerCase()} top+${(b.top - top).toFixed(1)} h${b.height.toFixed(1)}`);
    }
    const nums = art.querySelector('[data-testid="line-numbers"]');
    const shown = nums && getComputedStyle(nums).display !== 'none';
    let numbers = shown ? 'shown' : 'hidden';
    if (shown) {
      const spans = [...nums!.children].slice(0, 20);
      const bad = spans.filter((sp, i) => Math.abs(sp.getBoundingClientRect().top - top - i * L) > 0.5).length;
      if (bad) numbers += ` (${bad} misaligned)`;
      if (nums!.getAttribute('aria-hidden') !== 'true') numbers += ' (not aria-hidden)';
    }
    return { missing: false, off, numbers, vw: document.documentElement.clientWidth };
  }, LINE);
  if (r.missing) return problems.push(`${where}: no pleading paper`);
  if (r.off.length) problems.push(`${where}: ${r.off.length} element(s) off the 32px grid: ${r.off.slice(0, 4).join('; ')}`);
  if (r.numbers.includes('misaligned') || r.numbers.includes('not aria-hidden')) problems.push(`${where}: line numbers ${r.numbers}`);
  if (r.vw < 640 && r.numbers !== 'hidden') problems.push(`${where}: line numbers should be hidden on phones`);
  return null;
}

const allTexts = [
  ...Object.values(debatesRaw as Record<string, { text: string }[]>).flat().map((l) => l.text),
  ...Object.values(verdictsRaw as Record<string, { verdict: string }>).map((v) => v.verdict),
].filter((t) => t.trim());

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
      if (page.name === 'home') {
        // Chicago time, in the browser, in the "7:42 PM · Chicago" format.
        const clock = ((await p.textContent('[data-testid="chicago-clock"]')) ?? '').trim();
        const expect = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', hour: 'numeric', minute: '2-digit' }).format(new Date());
        if (!/^\d{1,2}:\d{2} (AM|PM) · Chicago$/.test(clock)) problems.push(`${page.name}@${vp.label}: clock reads "${clock}"`);
        else if (!clock.startsWith(expect.split(':')[0] + ':')) problems.push(`${page.name}@${vp.label}: clock "${clock}" is not Chicago time (${expect})`);
        else note += `  clock "${clock}"`;
      }
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
          const shape = caseShape(r);
          if (shape) problems.push(`${page.name}@${vp.label}: "${topic}" ${shape}`);
          if (r.ok && !shape) ended++;
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
        note += `  ${ended}/${sample.length} cases: title card, verdict, end card | ${evidenceShown} evidence cards`;

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
        // Returning visit opens straight on the case's title card; clear it.
        const card = await p.waitForSelector('[data-testid="title-card"]', { timeout: 4000 }).catch(() => null);
        if (card) await card.click();
        else problems.push(`${page.name}@${vp.label}: returning visit showed no title card`);
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

  // Navbar at 320/390/768/1440 on every site page, and every reading entry.
  {
    const probe = await browser.newPage();
    await probe.goto(BASE + '/readings', { waitUntil: 'networkidle' });
    const entryPaths = await probe.$$eval('[data-testid="entry-line"] a', (as) => as.map((a) => a.getAttribute('href') ?? ''));
    const empty = await probe.isVisible('[data-testid="collection-empty"]');
    await probe.close();
    if (!entryPaths.length && !empty) problems.push('readings: no entries and no empty-state message');
    const sitePaths = ['/', '/readings', ...entryPaths];
    let checks = 0;
    for (const w of NAV_WIDTHS) {
      const ctx = await browser.newContext({ viewport: { width: w, height: 800 } });
      const p = await ctx.newPage();
      p.on('console', (m: ConsoleMessage) => { if (m.type() === 'error' || m.type() === 'warning') problems.push(`nav@${w}: console ${m.type()}: ${m.text()}`); });
      p.on('response', (r) => { if (r.status() >= 400) problems.push(`nav@${w}: ${r.status()} ${r.url()}`); });
      for (const path of sitePaths) {
        await p.goto(BASE + path, { waitUntil: 'load' });
        await p.waitForTimeout(300);
        const where = `${path}@${w}`;
        await checkNav(p, where, problems);
        const h = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        if (h > 0) problems.push(`${where}: page scrolls horizontally by ${h}px`);
        if (path.startsWith('/readings/')) {
          await checkPleading(p, where, problems);
          if (w === 390) await p.screenshot({ path: `${OUT}/reading-entry-390.png`, fullPage: true });
          if (w === 1440) await p.screenshot({ path: `${OUT}/reading-entry-1440.png`, fullPage: true });
        }
        checks++;
      }
      await ctx.close();
    }
    console.log(`nav+readings   ${checks} page checks at ${NAV_WIDTHS.join('/')} | ${entryPaths.length} reading entr${entryPaths.length === 1 ? 'y' : 'ies'}${empty ? ' (empty state shown)' : ''}`);
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
    // Not networkidle: the navbar's prefetches can hold a request open for ~30s.
    const home = async () => {
      await p.goto(BASE + '/', { waitUntil: 'load' });
      await p.waitForSelector('[data-testid="take-to-court"]');
    };
    await home();
    const links = await p.$$eval('[data-testid="take-to-court"]', (as) =>
      as.map((a) => ({ href: a.getAttribute('href'), title: a.closest('li')?.querySelector('h3')?.textContent?.replace(/\s*↗\s*$/, '').trim() ?? '' }))
    );
    const debated = new Set(Object.keys(debatesRaw));
    const cards = await p.$$eval('#projects li h3', (hs) => hs.map((h) => h.textContent?.replace(/\s*↗\s*$/, '').trim() ?? ''));
    const expected = cards.filter((t) => debated.has(t));
    if (links.length !== expected.length) problems.push(`${where}: ${links.length} take-it-to-court links for ${expected.length} debated projects`);
    let played = 0;
    for (let i = 0; i < links.length; i++) {
      if (i > 0) await home();
      await p.click(`[data-testid="take-to-court"] >> nth=${i}`);
      await p.waitForURL(/\/court\?topic=/);
      const r = await playDebate(p);
      const shape = caseShape(r);
      if (shape) problems.push(`${where}: ${links[i].href} ${shape}`);
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
