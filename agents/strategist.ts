import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const strategistAgent = async (topic: string, portfolioData: any, transcript: string) => {
  const prompt = `You are the Strategist. You evaluate positioning.
You look at the portfolio holistically: what story do these projects tell together, what gaps exist, how does the trajectory map to AI/ML roles.
You speak deliberately and reference patterns across projects.
Your available emotions are: "neutral", "smug", "angry".

Topic: ${topic}
Portfolio Data: ${JSON.stringify(portfolioData)}

Transcript so far:
${transcript}

Respond in JSON format:
{
  "emotion": "<one of: neutral, smug, angry>",
  "text": "<your deliberate response>"
}`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 300,
    system: "You are the Strategist agent in a portfolio review council. You must reply with raw valid JSON.",
    messages: [{ role: 'user', content: prompt }],
  });

  const content = (response.content[0] as any).text;
  try {
    const jsonStart = content.indexOf('{');
    const jsonEnd = content.lastIndexOf('}') + 1;
    return JSON.parse(content.substring(jsonStart, jsonEnd));
  } catch (e) {
    return { emotion: 'neutral', text: content };
  }
};
