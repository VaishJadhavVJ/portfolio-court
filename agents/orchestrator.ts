import { builderAgent } from './builder';
import { strategistAgent } from './strategist';
import { contrarianAgent } from './contrarian';
import { AgentName, DialogueLine, Emotion } from '@/types/court';

const ROSTER = [
  { speaker: 'baka' as const, label: 'Builder', agent: builderAgent },
  { speaker: 'ice' as const, label: 'Strategist', agent: strategistAgent },
  { speaker: 'child' as const, label: 'Contrarian', agent: contrarianAgent },
];

/**
 * Per-round beat, appended to the user prompt only. The characters are written
 * to never concede, so their reactive emotions (nervous, shocked, angry, sleep)
 * were unreachable -- the conditions simply never came up. Structuring the
 * debate into opening / escalation / resolution creates those moments without
 * softening the personalities.
 */
const ROUND_BEATS: Record<number, string> = {
  1: '',
  2: 'Someone in this debate has made a point that genuinely lands. React to it honestly before making your own. You may be rattled, annoyed, or caught off guard, and your emotion should reflect that.',
  3: 'This is the final round. Land your closing position. Do not restate an earlier line.',
};

const norm = (text: string) => text.trim().toLowerCase();

export const runDebate = async (topic: string, portfolioData: any): Promise<DialogueLine[]> => {
  let transcriptStr = '';
  const transcript: DialogueLine[] = [];
  let id = 1;
  const formattedData = formatPortfolioForAgents(portfolioData);

  // What each agent has already said, so a verbatim repeat can be caught here
  // rather than relied on the prompt to prevent. The system prompt cannot check
  // this reliably: the rule lives there, but the transcript it must compare
  // against sits in the user prompt and grows past the point of being honoured.
  const saidBy = new Map<AgentName, Set<string>>(ROSTER.map((r) => [r.speaker, new Set<string>()]));

  for (let round = 1; round <= 3; round++) {
    const beat = ROUND_BEATS[round] ?? '';

    for (const { speaker, label, agent } of ROSTER) {
      const said = saidBy.get(speaker)!;

      // No try/catch here on purpose. An agent that fails must fail the whole
      // run -- the old fallbacks quietly substituted filler text, which is how
      // 99 broken lines got written to disk without anyone noticing.
      let res = await agent(topic, formattedData, transcriptStr, beat);

      if (said.has(norm(res.text))) {
        console.warn(`    ${label} repeated an earlier line; retrying once`);
        const retryBeat = [
          beat,
          `You already used this exact line earlier in this debate:\n"${res.text}"\n` +
            'Do not repeat it or rephrase it. Make a different point that advances your position.',
        ]
          .filter(Boolean)
          .join('\n\n');

        res = await agent(topic, formattedData, transcriptStr, retryBeat);

        if (said.has(norm(res.text))) {
          throw new Error(`${label} repeated the same line twice for topic "${topic}" -- giving up rather than writing a duplicate`);
        }
      }

      said.add(norm(res.text));

      const line: DialogueLine = {
        id: id++,
        speaker,
        emotion: res.emotion as Emotion,
        text: res.text,
      };
      transcript.push(line);
      transcriptStr += `${label}: ${line.text}\n`;
    }
  }

  return transcript;
};

function formatPortfolioForAgents(data: any): string {
  let result = "PROJECTS:\n";
  if (data.projects) {
    for (const p of data.projects) {
      result += `- ${p.title}: ${p.description} [Tech: ${p.tech.join(', ')}]\n`;
    }
  }
  result += "\nWORK EXPERIENCE:\n";
  if (data.work) {
    for (const w of data.work) {
      result += `- ${w.title} @ ${w.company} (${w.startDate ? w.startDate : ''} - ${w.endDate ? w.endDate : 'Present'})\n`;
    }
  }
  result += "\nSKILLS:\n";
  if (data.skills) {
    for (const s of data.skills) {
      result += `- ${s.name} [${s.category.join(', ')}]\n`;
    }
  }
  result += "\nCOURSEWORK:\n";
  if (data.coursework) {
    for (const c of data.coursework) {
      result += `- ${c.name} @ ${c.institution} (${c.termYear.join(', ')})\n`;
    }
  }
  return result;
}
