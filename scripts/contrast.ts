/**
 * WCAG contrast audit for every text run on a page.
 *
 * Two screenshots per scroll step: one normal, one with every glyph made
 * transparent. Differencing them yields a mask of the pixels a glyph actually
 * covers, and contrast is measured ONLY at those pixels. Sampling the whole
 * bounding box instead would charge text for a dark leaf sitting in the gap
 * between two words, which is not something a reader ever has to read through.
 *
 * Usage: npx tsx scripts/contrast.ts [url]
 */
import { chromium, type Page } from 'playwright';
import sharp from 'sharp';

const URL = process.argv[2] ?? 'http://localhost:3000/';
const VIEWPORTS = [
  { w: 390, h: 844 },
  { w: 768, h: 1024 },
  { w: 1440, h: 900 },
];
const HEADER_SAFE = 64; // don't measure under the sticky nav

interface Run { id: number; x: number; y: number; w: number; h: number; color: [number, number, number]; size: number; bold: boolean; text: string; }

const srgb = (c: number) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const lum = (r: number, g: number, b: number) => 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
const ratio = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

async function collect(page: Page): Promise<Run[]> {
  return page.evaluate(() => {
    const out: any[] = [];
    let id = 0;
    document.querySelectorAll<HTMLElement>('body *').forEach((el) => {
      const own = Array.from(el.childNodes).some((n) => n.nodeType === 3 && (n.textContent ?? '').trim().length > 1);
      if (!own) return;
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) return;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none' || parseFloat(cs.opacity) < 0.95) return;
      const m = cs.color.match(/\d+(\.\d+)?/g);
      if (!m) return;
      const size = parseFloat(cs.fontSize);
      const weight = parseInt(cs.fontWeight, 10) || 400;
      out.push({
        id: id++,
        x: Math.round(r.x + scrollX), y: Math.round(r.y + scrollY),
        w: Math.round(r.width), h: Math.round(r.height),
        color: [Number(m[0]), Number(m[1]), Number(m[2])],
        size, bold: weight >= 700,
        text: (el.textContent ?? '').trim().slice(0, 34),
      });
    });
    return out;
  });
}

async function main() {
  const browser = await chromium.launch();
  let totalFail = 0;

  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
    const page = await ctx.newPage();
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1400);

    const runs = await collect(page);
    const docH = await page.evaluate(() => document.documentElement.scrollHeight);
    const measured = new Map<number, number>();
    const dist = new Map<number, number[]>();
    const HIDE = '*, *::before, *::after { color: transparent !important; text-shadow: none !important; }';

    for (let top = 0; top < docH; top += Math.floor(vp.h * 0.7)) {
      await page.evaluate((y) => window.scrollTo(0, y), top);
      await page.waitForTimeout(160);
      const scrollY = await page.evaluate(() => window.scrollY);

      const withText = await page.screenshot();
      const tag = await page.addStyleTag({ content: HIDE });
      await page.waitForTimeout(90);
      const withoutText = await page.screenshot();
      await tag.evaluate((n) => (n as unknown as Element).remove());
      await page.waitForTimeout(60);

      for (const r of runs) {
        if (measured.has(r.id)) continue;
        const vy = r.y - scrollY;
        if (vy < HEADER_SAFE || vy + r.h > vp.h) continue;
        const region = {
          left: Math.max(0, Math.min(r.x, vp.w - 1)),
          top: Math.max(0, vy),
          width: Math.max(1, Math.min(r.w, vp.w - Math.max(0, Math.min(r.x, vp.w - 1)))),
          height: Math.max(1, r.h),
        };
        const a = await sharp(withText).extract(region).raw().toBuffer({ resolveWithObject: true });
        const b = await sharp(withoutText).extract(region).raw().toBuffer({ resolveWithObject: true });
        const ch = a.info.channels;
        const ink = lum(r.color[0], r.color[1], r.color[2]);

        const crs: number[] = [];
        for (let k = 0; k < a.data.length; k += ch) {
          // a glyph core pixel: painting the text changed this pixel a lot
          const delta = Math.abs(a.data[k] - b.data[k]) + Math.abs(a.data[k + 1] - b.data[k + 1]) + Math.abs(a.data[k + 2] - b.data[k + 2]);
          if (delta < 90) continue;
          crs.push(ratio(lum(b.data[k], b.data[k + 1], b.data[k + 2]), ink));
        }
        if (crs.length >= 8) {
          crs.sort((x, y) => x - y);
          dist.set(r.id, crs);
          measured.set(r.id, crs[0]);
        }
      }
    }

    const rows = runs.filter((r) => measured.has(r.id)).map((r) => {
      const need = r.size >= 24 || (r.bold && r.size >= 18.66) ? 3 : 4.5;
      const cr = measured.get(r.id)!;
      return { r, cr, need, pass: cr >= need };
    });
    const fails = rows.filter((x) => !x.pass);
    totalFail += fails.length;

    console.log(`\n=== ${vp.w}px — ${rows.length} text runs measured, ${fails.length} failing ===`);
    if (fails.length) {
      fails.sort((a, b) => a.cr - b.cr).slice(0, 12).forEach((x) => {
        const d = dist.get(x.r.id)!;
        const p = (q: number) => d[Math.min(d.length - 1, Math.floor(d.length * q))];
        const below = d.filter((v) => v < x.need).length;
        console.log(
          `  FAIL worst ${x.cr.toFixed(2)}:1  p05 ${p(0.05).toFixed(2)}  median ${p(0.5).toFixed(2)}  ` +
          `${((below / d.length) * 100).toFixed(1)}% of glyph pixels under ${x.need}   ${Math.round(x.r.size)}px  "${x.r.text}"`
        );
      });
    }
    const worstPass = rows.filter((x) => x.pass).sort((a, b) => a.cr - b.cr)[0];
    if (worstPass) console.log(`  tightest passing: ${worstPass.cr.toFixed(2)}:1 (needs ${worstPass.need})  "${worstPass.r.text}"`);
    if (runs.length !== rows.length) console.log(`  (${runs.length - rows.length} runs skipped: taller than the viewport, under the nav, or no glyph pixels found)`);
    await ctx.close();
  }

  await browser.close();
  console.log(totalFail ? `\n${totalFail} failing text run(s)` : '\nevery measured text run clears WCAG AA');
  process.exitCode = totalFail ? 1 : 0;
}

main().catch((e) => { console.error(e); process.exit(1); });
