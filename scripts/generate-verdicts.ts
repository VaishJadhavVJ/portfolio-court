/**
 * Narrator pass. Reads every transcript in data/debates.json and makes one LLM
 * call per case for the Kaguya-sama style narrator: a title card and a verdict.
 * Writes data/verdicts.json keyed by topic. Never modifies data/debates.json.
 *
 * Usage: npx tsx scripts/generate-verdicts.ts
 *
 * Same fail-loudly design as the debate generator: each case gets one retry,
 * then the run throws, and nothing is written unless every case has both a
 * title card and a verdict.
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import * as fs from 'fs';
import { callLLM } from '../lib/llm';
import type { DialogueLine } from '../types/court';

export interface Verdict {
  title: string;
  winner: 'Builder' | 'Strategist' | 'Contrarian';
  verdict: string;
  emotion: 'idle' | 'point';
}

const OUT = 'data/verdicts.json';
const LABEL: Record<string, string> = { baka: 'Builder', ice: 'Strategist', child: 'Contrarian' };
const WINNERS = ['Builder', 'Strategist', 'Contrarian'] as const;
const EMOTIONS = ['idle', 'point'] as const;

const SYSTEM = `You are the narrator of Kaguya-sama: Love is War, now presiding over a courtroom inside Vaishnavi Jadhav's head. Three of her inner voices have just argued about one of her projects: the Builder (cares whether it shipped), the Strategist (cares whether it matters) and the Contrarian (asks why it exists at all).

Your voice is formal, deadpan and grandly dramatic about trivial things, as if a minor argument were a battle of wits that will decide the fate of nations. You announce results the way the show does: "Today's battle result: ..."

Example verdict, to show the voice only (do not copy it):
"Today's battle result: the Strategist wins, having let the others exhaust themselves in silence. The Builder's pride has been reduced to a footnote."

Produce these fields about this case:
- "character": "Builder", "Strategist" or "Contrarian": whichever one's desire drives this particular argument.
- "wish": what that character wants, as a short verb phrase in Title Case that completes the episode title "The [Character] Wants to ___". It must start with a verb, be specific to something actually said in this transcript, and be a little absurd. Never about shipping or winning. Examples of the shape only: "Know Who Asked", "Say Nothing at All", "Audit the Auditors".
- "winner": which of the three won this case.
- "verdict": who won and why, in one or two sentences, under 200 characters, in the narrator's grand deadpan voice. It must begin with "Today's battle result: ". Name the winner in the text. Judge honestly on the arguments in this transcript; any of the three can win.
- "emotion": "point" when the verdict is a triumphant declaration, "idle" when it is dry and matter-of-fact.

Rules: English only. No em dashes. Plain punctuation only.

Respond with valid JSON only:
{"character": "...", "wish": "...", "winner": "...", "verdict": "...", "emotion": "idle" | "point"}`;

const SHAPE_EXAMPLES = ['Know Who Asked', 'Say Nothing at All', 'Audit the Auditors'];

/** Validates one reply. `used` holds titles already given to other cases. */
function validate(raw: string, used: Set<string>): Verdict {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}') + 1;
  if (start < 0 || end <= start) throw new Error(`no JSON object: ${raw.slice(0, 120)}`);
  const v = JSON.parse(raw.slice(start, end)) as Partial<Verdict> & { character?: string; wish?: string };
  const character = v.character as Verdict['winner'];
  const wish = typeof v.wish === 'string' ? v.wish.trim().replace(/[.!]+$/, '') : '';
  const verdict = typeof v.verdict === 'string' ? v.verdict.trim() : '';
  if (!WINNERS.includes(character)) throw new Error(`bad character: ${v.character}`);
  if (!/^[A-Z][a-z]+\b/.test(wish)) throw new Error(`wish must start with a capitalised verb: "${wish}"`);
  if (/^(Ship|Win)\b/i.test(wish)) throw new Error(`wish "${wish}" is about shipping or winning`);
  if (SHAPE_EXAMPLES.includes(wish)) throw new Error(`wish "${wish}" copies an example`);
  // The show's episode title pattern, built here so it cannot drift.
  const title = `The ${character} Wants to ${wish}`;
  if (title.length >= 60) throw new Error(`title is ${title.length} chars: ${title}`);
  if (used.has(title)) throw new Error(`title "${title}" is already used by another case`);
  if (!verdict) throw new Error('empty verdict');
  if (!verdict.startsWith("Today's battle result: ")) throw new Error(`verdict must begin with "Today's battle result: "`);
  if (verdict.length >= 200) throw new Error(`verdict is ${verdict.length} chars (limit 199)`);
  const sentences = verdict.split(/(?<=[.!?])\s+(?=[A-Z"])/).filter(Boolean);
  if (sentences.length > 2) throw new Error(`verdict has ${sentences.length} sentences`);
  if (!WINNERS.includes(v.winner as Verdict['winner'])) throw new Error(`bad winner: ${v.winner}`);
  if (!verdict.includes(v.winner as string)) throw new Error(`verdict does not name the winner (${v.winner})`);
  if (!EMOTIONS.includes(v.emotion as Verdict['emotion'])) throw new Error(`bad emotion: ${v.emotion}`);
  if (/\u2014/.test(title + verdict)) throw new Error('contains an em dash');
  // GLM occasionally drifts into another script mid-sentence ("...Contrarian's \u8d28\u7591").
  if (/[^\x20-\x7E\u2018\u2019\u201C\u201D\u2026]/.test(title + verdict)) throw new Error(`non-English characters: ${verdict}`);
  return { title, winner: v.winner as Verdict['winner'], verdict, emotion: v.emotion as Verdict['emotion'] };
}

async function verdictFor(topic: string, lines: DialogueLine[], used: Set<string>): Promise<Verdict> {
  const transcript = lines.map((l) => `${LABEL[l.speaker] ?? l.speaker}: ${l.text}`).join('\n');
  const user = `Case: ${topic}\n\nTranscript:\n${transcript}`;
  let last: Error | undefined;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      // The retry says what was wrong; resending the same prompt mostly repeats the mistake.
      const prompt = last ? `${user}\n\nYour previous answer was rejected: ${last.message}. Fix that.` : user;
      return validate(await callLLM(SYSTEM, prompt), used);
    } catch (e) {
      last = e as Error;
      console.warn(`    attempt ${attempt}/2 failed: ${last.message}`);
    }
  }
  throw new Error(`"${topic}": narrator call failed after 2 attempts: ${last?.message}`);
}

async function main() {
  const debates = JSON.parse(fs.readFileSync('data/debates.json', 'utf8')) as Record<string, DialogueLine[]>;
  const out: Record<string, Verdict> = {};
  const used = new Set<string>();
  for (const [topic, lines] of Object.entries(debates)) {
    console.log(`Narrating: ${topic}`);
    out[topic] = await verdictFor(topic, lines, used);
    used.add(out[topic].title);
    console.log(`    ${out[topic].title}  |  ${out[topic].winner}: ${out[topic].verdict}`);
  }
  const incomplete = Object.keys(debates).filter((t) => !out[t]?.title || !out[t]?.verdict);
  if (incomplete.length) throw new Error(`refusing to write: no title card or verdict for ${incomplete.join(', ')}`);
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');
  console.log(`Wrote ${OUT}: ${Object.keys(out).length} cases.`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
