import * as fs from 'fs';
import * as path from 'path';
import { DialogueLine } from '../types/court';

// Side-effect free on purpose: importing this must never start a generation,
// so the check can actually be tested before it is trusted.
export function assertPlayable(
  debates: Record<string, DialogueLine[]>,
  spriteDir: string = path.join(process.cwd(), 'public', 'agents')
): void {
  // Read the directory once instead of calling fs.existsSync per line.
  // existsSync returns false on ANY error -- including EMFILE after a long run
  // has exhausted file descriptors -- which silently reports every sprite as
  // missing. readdirSync throws instead, so a real problem looks like one.
  const available = new Set(fs.readdirSync(spriteDir).filter((f) => f.endsWith('.webp')));
  if (!available.size) throw new Error(`no sprites found in ${spriteDir}`);

  const failures: string[] = [];

  for (const [topic, lines] of Object.entries(debates)) {
    if (!lines.length) {
      failures.push(`[${topic}] produced no lines at all`);
      continue;
    }
    for (const line of lines) {
      const where = `[${topic}] line ${line.id} (${line.speaker}/${line.emotion})`;
      if (typeof line.text !== 'string' || !line.text.trim()) {
        failures.push(`${where}: empty text`);
      }
      const sprite = `${line.speaker}-${line.emotion}.webp`;
      if (!available.has(sprite)) {
        failures.push(`${where}: no art for this emotion -> public/agents/${sprite}`);
      }
    }
  }

  if (failures.length) {
    console.error(`\nFAILED: ${failures.length} bad line(s). data/debates.json was NOT written.\n`);
    failures.forEach((f) => console.error(`  - ${f}`));
    throw new Error(`${failures.length} bad line(s)`);
  }
}
