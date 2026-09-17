import { builderAgent } from './builder';
import { strategistAgent } from './strategist';
import { contrarianAgent } from './contrarian';
import { DialogueLine, Emotion } from '@/types/court';

const ROSTER = [
  { speaker: 'baka' as const, label: 'Builder', agent: builderAgent },
  { speaker: 'ice' as const, label: 'Strategist', agent: strategistAgent },
  { speaker: 'child' as const, label: 'Contrarian', agent: contrarianAgent },
];

export const runDebate = async (topic: string, portfolioData: any): Promise<DialogueLine[]> => {
  let transcriptStr = '';
  const transcript: DialogueLine[] = [];
  let id = 1;
  const formattedData = formatPortfolioForAgents(portfolioData);

  for (let round = 1; round <= 3; round++) {
    for (const { speaker, label, agent } of ROSTER) {
      // No try/catch here on purpose. An agent that fails must fail the whole
      // run -- the old fallbacks quietly substituted filler text, which is how
      // 99 broken lines got written to disk without anyone noticing.
      const res = await agent(topic, formattedData, transcriptStr);
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
