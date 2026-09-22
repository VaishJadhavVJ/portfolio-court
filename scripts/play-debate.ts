/**
 * Walks a debate from line 1 to the end card by clicking the dialogue box.
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
}

const BEGIN = '[data-testid="begin"]';
const BOX = '[data-testid="dialogue-box"]';
const END = '[data-testid="end-card"]';

export async function playDebate(page: Page, topic?: string): Promise<PlayResult> {
  // Every visit opens on the begin screen; it only needs pressing once per load.
  if (await page.isVisible(BEGIN)) {
    await page.click(BEGIN);
    await page.waitForSelector(BEGIN, { state: 'detached' });
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
  const fail = (problem: string): PlayResult => ({ topic: selected, reached: index, total, ok: false, problem });

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

  return { topic: selected, reached: index, total, ok: true };
}
