import 'server-only';
import OpenAI from 'openai';

let _client: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (_client) return _client;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set. Copy .env.local.example to .env.local and fill it in.');
  }
  _client = new OpenAI({ apiKey });
  return _client;
}

export const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL ?? 'gpt-4.1-mini';
