import OpenAI from 'openai';

// ponytail: built on first call, not at import time. Import statements are
// hoisted above dotenv.config(), so a module-level client reads the env before
// .env.local has loaded and dies with "Missing credentials".
let client: OpenAI | undefined;
function getClient(): OpenAI {
  if (!client) {
    // Named for the provider it is actually for. Checked here because the
    // OpenAI SDK would otherwise fall back to OPENAI_API_KEY on its own.
    if (!process.env.GLM_API_KEY) throw new Error('GLM_API_KEY is not set (expected in .env.local)');
    client = new OpenAI({
      apiKey: process.env.GLM_API_KEY,
      baseURL: 'https://open.bigmodel.cn/api/paas/v4/',
    });
  }
  return client;
}

export interface AgentReply {
  emotion: string;
  text: string;
}

export async function callLLM(systemPrompt: string, userPrompt: string): Promise<string> {
  // GLM-4.5-Flash bills reasoning_content against the same completion budget as
  // the answer. Left on, its reasoning alone exhausted max_tokens and returned
  // empty content with finish_reason "length" -- the failure that killed three
  // generation runs. Disabled, the same prompt answers in ~47 completion tokens
  // instead of ~323. `thinking` is a GLM extension the OpenAI types don't model.
  const params = {
    model: 'GLM-4.5-Flash',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    max_tokens: 600,
    response_format: { type: 'json_object' },
    thinking: { type: 'disabled' },
  };
  const response = await getClient().chat.completions.create(
    params as unknown as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming
  );

  const choice = response.choices[0];
  const content = choice.message.content || '';

  // GLM-4.5-Flash is a reasoning model: its reasoning_content is billed against
  // the same completion budget as the answer. At max_tokens 300 the reasoning
  // consumed the whole budget and content came back "" with finish_reason
  // "length" -- that is what silently wrote 73 empty dialogue lines.
  if (!content.trim()) {
    throw new Error(
      `empty content from LLM (finish_reason: ${choice.finish_reason}, completion_tokens: ${response.usage?.completion_tokens})`
    );
  }
  return content;
}

// ponytail: the retry lives here rather than duplicated in all three agent
// files -- every agent routes through this one call, so one guard covers them
// all. One retry, then throw. Never a silent fallback.
export async function callLLMJson(systemPrompt: string, userPrompt: string): Promise<AgentReply> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const content = await callLLM(systemPrompt, userPrompt);
      const start = content.indexOf('{');
      const end = content.lastIndexOf('}') + 1;
      if (start < 0 || end <= start) throw new Error(`no JSON object in response: ${content.slice(0, 120)}`);

      const parsed = JSON.parse(content.slice(start, end)) as Partial<AgentReply>;
      if (typeof parsed.text !== 'string' || !parsed.text.trim()) throw new Error('reply has empty "text"');
      if (typeof parsed.emotion !== 'string' || !parsed.emotion.trim()) throw new Error('reply has empty "emotion"');

      return { emotion: parsed.emotion.trim(), text: parsed.text.trim() };
    } catch (error) {
      lastError = error as Error;
      console.warn(`    attempt ${attempt}/2 failed: ${lastError.message}`);
    }
  }

  throw new Error(`LLM call failed after 2 attempts: ${lastError?.message}`);
}
