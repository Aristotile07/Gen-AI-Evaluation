import OpenAI from 'openai';

const MODEL = 'gpt-4.1-mini';

// Pricing as of setup — $ per 1M tokens. UPDATE THESE if OpenAI changes pricing,
// this directly drives the cost dashboard numbers.
const PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4.1-mini': { input: 0.4, output: 1.6 },
  'gpt-4.1': { input: 2.0, output: 8.0 },
};

export interface LLMResult {
  content: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  model: string;
}

// Lazily created — avoids throwing at build time (e.g. Vercel's page-data
// collection step) when OPENAI_API_KEY isn't in scope, only at actual request time.
let _client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _client;
}

export async function callLLM(systemPrompt: string, userPrompt: string): Promise<LLMResult> {
  const openai = getClient();
  const res = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.2,
  });

  const content = res.choices[0]?.message?.content || '';
  const inputTokens = res.usage?.prompt_tokens || 0;
  const outputTokens = res.usage?.completion_tokens || 0;
  const pricing = PRICING[MODEL] || PRICING['gpt-4.1-mini'];
  const costUsd = (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output;

  return { content, inputTokens, outputTokens, costUsd, model: MODEL };
}
