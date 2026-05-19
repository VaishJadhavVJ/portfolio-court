import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const contrarianAgent = async (topic: string, portfolioData: any, transcript: string) => {
  const prompt = `You are the Contrarian. You challenge assumptions.
You question why a project exists, whether tech choices were right, and find the weakest project.
You speak mostly in questions. You are uncomfortable but necessary.
Your available emotions are: "confused", "amazed", "sleep".

Topic: ${topic}
Portfolio Data: ${JSON.stringify(portfolioData)}

Transcript so far:
${transcript}

Respond in JSON format:
{
  "emotion": "<one of: confused, amazed, sleep>",
  "text": "<your questioning response>"
}`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 300,
    system: "You are the Contrarian agent in a portfolio review council. You must reply with raw valid JSON.",
    messages: [{ role: 'user', content: prompt }],
  });

  const content = (response.content[0] as any).text;
  try {
    const jsonStart = content.indexOf('{');
    const jsonEnd = content.lastIndexOf('}') + 1;
    return JSON.parse(content.substring(jsonStart, jsonEnd));
  } catch (e) {
    return { emotion: 'confused', text: content };
  }
};
