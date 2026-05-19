import { builderAgent } from './builder';
import { strategistAgent } from './strategist';
import { contrarianAgent } from './contrarian';
import { DialogueLine } from '@/types/court';

export const runDebate = async (topic: string, portfolioData: any): Promise<DialogueLine[]> => {
  let transcriptStr = '';
  const transcript: DialogueLine[] = [];
  let id = 1;

  for (let round = 1; round <= 3; round++) {
    // 1. Builder (baka)
    const builderRes = await builderAgent(topic, portfolioData, transcriptStr);
    const builderLine: DialogueLine = {
      id: id++,
      speaker: 'baka',
      emotion: builderRes.emotion as any,
      text: builderRes.text,
    };
    transcript.push(builderLine);
    transcriptStr += `Builder: ${builderLine.text}\n`;

    // 2. Strategist (ice)
    const strategistRes = await strategistAgent(topic, portfolioData, transcriptStr);
    const strategistLine: DialogueLine = {
      id: id++,
      speaker: 'ice',
      emotion: strategistRes.emotion as any,
      text: strategistRes.text,
    };
    transcript.push(strategistLine);
    transcriptStr += `Strategist: ${strategistLine.text}\n`;

    // 3. Contrarian (child)
    const contrarianRes = await contrarianAgent(topic, portfolioData, transcriptStr);
    const contrarianLine: DialogueLine = {
      id: id++,
      speaker: 'child',
      emotion: contrarianRes.emotion as any,
      text: contrarianRes.text,
    };
    transcript.push(contrarianLine);
    transcriptStr += `Contrarian: ${contrarianLine.text}\n`;
  }

  return transcript;
};
