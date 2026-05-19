import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const builderAgent = async (topic: string, portfolioData: any, transcript: string) => {
  const prompt = `You are the Builder. You evaluate execution quality.
You look at tech stacks, whether things shipped or are just concepts, what's deployed vs what's a demo.
You speak bluntly and short. You use "shipped" as the highest compliment.
Your available emotions are: "point", "nervous", "happy".

Topic: ${topic}
Portfolio Data: ${JSON.stringify(portfolioData)}

Transcript so far:
${transcript}

Respond in JSON format:
{
  "emotion": "<one of: point, nervous, happy>",
  "text": "<your short blunt response>"
}`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 300,
    system: "You are the Builder agent in a portfolio review council. You must reply with raw valid JSON.",
    messages: [{ role: 'user', content: prompt }],
  });

  const content = (response.content[0] as any).text;
  try {
    const jsonStart = content.indexOf('{');
    const jsonEnd = content.lastIndexOf('}') + 1;
    return JSON.parse(content.substring(jsonStart, jsonEnd));
  } catch (e) {
    return { emotion: 'point', text: content };
  }
};
