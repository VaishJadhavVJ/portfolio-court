/**
 * Walks a debate from line 1 to the end card by clicking the dialogue box,
 * playing through the first-visit intro first if it appears.
 * Shared by the screenshot harness so a build that renders the first line but
 * cannot advance, or that loops back to line 1 instead of ending, can never
 * pass again.
 */
import type { Page } from 'playwright';

export interface PlayResult {
  topic: string;
  reached: number;
  total: number;
  ok: boolean;
  problem?: string;
  /** Intro lines clicked through before the debate (0 = no intro shown). */
  introLines: number;
}

const BEGIN = '[data-testid="begin"]';
const BOX = '[data-testid="dialogue-box"]';
const END = '[data-testid="end-card"]';
const SKIP = '[data-testid="skip-intro"]';

/** Clicks through the intro until it hands over to the debate. Returns lines seen, or -1 if it never ends. */
export async function playIntro(page: Page): Promise<number> {
  if (!(await page.isVisible(SKIP))) return 0;
  let seen = 0;
  for (let i = 0; i < 40; i++) {
    if (!(await page.isVisible(SKIP))) return seen;
    const t = (await page.textContent('[data-testid="line-counter"]')) ?? '';
    seen = Math.max(seen, Number(t.split('/')[0]));
    await page.click(BOX);
    await page.waitForTimeout(150);
  }
  return -1;
}

export async function playDebate(page: Page, topic?: string): Promise<PlayResult> {
  // Every visit opens on the title screen; it only needs pressing once per load.
  // Its options appear once the page has read the URL, so wait briefly for them.
  await page.waitForSelector(BEGIN, { timeout: 5000 }).catch(() => null);
  if (await page.isVisible(BEGIN)) {
    await page.click(BEGIN);
    await page.waitForSelector(BEGIN, { state: 'detached' });
    await page.waitForTimeout(1600); // audio warm-up before line 1
  }
  const introLines = await playIntro(page);
  if (introLines < 0) {
    return { topic: topic ?? '', reached: 0, total: 0, ok: false, problem: 'intro never handed over to the debate', introLines };
  }
  if (topic) {
    await page.selectOption('select', topic);
    await page.waitForTimeout(250);
  }

  const read = async () => {
    const t = (await page.textContent('[data-testid="line-counter"]')) ?? '0/0';
    const [i, n] = t.trim().split('/').map(Number);
    return { index: i, total: n };
  };

  const selected = topic ?? (await page.inputValue('select'));
  const start = await read();
  let index = start.index;
  const total = start.total;
  const fail = (problem: string): PlayResult => ({ topic: selected, reached: index, total, ok: false, problem, introLines });

  // Target total + 1 is the end card. Each step may need two clicks: one to
  // skip the typewriter, one to advance.
  for (let target = index + 1; target <= total + 1; target++) {
    let advanced = false;
    for (let attempt = 0; attempt < 12 && !advanced; attempt++) {
      await page.click(BOX);
      await page.waitForTimeout(120);
      if (target > total && (await page.isVisible(END))) {
        advanced = true;
        continue;
      }
      const now = await read();
      if (now.index < index) return fail(`looped from line ${index} back to ${now.index}`);
      if (now.index >= target) {
        index = now.index;
        advanced = true;
      }
    }
    if (!advanced) return fail(target > total ? `no end card after line ${total}` : `stuck at line ${index}/${total}`);
  }

  // The end card must stay put: another press must not restart the debate.
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(150);
  if ((await read()).index !== total) return fail('advanced past the end card');

  return { topic: selected, reached: index, total, ok: true, introLines };
}
