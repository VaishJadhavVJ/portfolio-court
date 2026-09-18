/**
 * Walks a debate from line 1 to the last line by clicking the dialogue box.
 * Shared by the screenshot harness so a build that renders the first line but
 * cannot advance can never pass again.
 */
import type { Page } from 'playwright';

export interface PlayResult {
  topic: string;
  reached: number;
  total: number;
  ok: boolean;
  stuckAt?: number;
}

export async function playDebate(page: Page, topic?: string): Promise<PlayResult> {
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
  let { index, total } = await read();

  for (let target = index + 1; target <= total; target++) {
    let advanced = false;
    // Each step may need two clicks: one to skip the typewriter, one to advance.
    for (let attempt = 0; attempt < 12 && !advanced; attempt++) {
      await page.click('[data-testid="dialogue-box"]');
      await page.waitForTimeout(120);
      const now = await read();
      if (now.index >= target) {
        index = now.index;
        advanced = true;
      }
    }
    if (!advanced) {
      return { topic: selected, reached: index, total, ok: false, stuckAt: index };
    }
  }

  return { topic: selected, reached: index, total, ok: index === total };
}
