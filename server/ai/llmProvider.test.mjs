import { describe, expect, it, vi } from 'vitest';

import {
  buildAnthropicRequest,
  buildOpenAiRequest,
  createLlmProvider,
  parseAnthropicResponse,
  parseOpenAiResponse,
  resolveLlmConfig,
} from './llmProvider.mjs';

describe('LLM provider config', () => {
  it('defaults to openai and is unconfigured without a key', () => {
    const config = resolveLlmConfig({});
    expect(config.provider).toBe('openai');
    expect(config.model).toBe('gpt-4o-mini');
    expect(config.baseUrl).toBe('https://api.openai.com/v1');
    expect(config.configured).toBe(false);
  });

  it('is configured once a key is present and honours overrides for any provider', () => {
    const config = resolveLlmConfig({ LLM_PROVIDER: 'Anthropic', LLM_API_KEY: 'sk-x', LLM_MODEL: 'claude-opus', LLM_BASE_URL: 'https://gateway.example/v1/' });
    expect(config.provider).toBe('anthropic');
    expect(config.model).toBe('claude-opus');
    expect(config.baseUrl).toBe('https://gateway.example/v1'); // trailing slash trimmed
    expect(config.configured).toBe(true);
  });

  it('points an OpenAI-compatible custom base at any gateway', () => {
    const config = resolveLlmConfig({ LLM_API_KEY: 'sk', LLM_BASE_URL: 'http://localhost:11434/v1' });
    expect(config.baseUrl).toBe('http://localhost:11434/v1');
    expect(config.provider).toBe('openai');
  });
});

describe('request builders and parsers', () => {
  it('builds an OpenAI chat request with bearer auth and a system message', () => {
    const { url, init } = buildOpenAiRequest({ baseUrl: 'https://api.openai.com/v1', apiKey: 'sk', model: 'gpt', system: 'sys', prompt: 'hi', maxTokens: 100 });
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    expect(init.headers.authorization).toBe('Bearer sk');
    const body = JSON.parse(init.body);
    expect(body.messages).toEqual([{ role: 'system', content: 'sys' }, { role: 'user', content: 'hi' }]);
    expect(body.temperature).toBe(0);
  });

  it('builds an Anthropic messages request with x-api-key and top-level system', () => {
    const { url, init } = buildAnthropicRequest({ baseUrl: 'https://api.anthropic.com/v1', apiKey: 'sk', model: 'claude', system: 'sys', prompt: 'hi', maxTokens: 100 });
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(init.headers['x-api-key']).toBe('sk');
    const body = JSON.parse(init.body);
    expect(body.system).toBe('sys');
    expect(body.messages).toEqual([{ role: 'user', content: 'hi' }]);
  });

  it('extracts the text from each provider response shape', () => {
    expect(parseOpenAiResponse({ choices: [{ message: { content: '  answer ' } }] })).toBe('answer');
    expect(parseAnthropicResponse({ content: [{ type: 'text', text: 'answer' }] })).toBe('answer');
    expect(() => parseOpenAiResponse({})).toThrow();
  });
});

describe('provider.complete', () => {
  it('throws (not calls out) when unconfigured', async () => {
    const provider = createLlmProvider({}, vi.fn());
    expect(provider.configured).toBe(false);
    await expect(provider.complete({ prompt: 'hi' })).rejects.toThrow(/No language model/);
  });

  it('calls the OpenAI-compatible endpoint and returns the text', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: 'cash is 100' } }] }) });
    const provider = createLlmProvider({ LLM_API_KEY: 'sk', LLM_MODEL: 'gpt' }, fetchImpl);
    const text = await provider.complete({ prompt: 'what is my cash?', maxTokens: 50 });
    expect(text).toBe('cash is 100');
    expect(fetchImpl).toHaveBeenCalledWith('https://api.openai.com/v1/chat/completions', expect.objectContaining({ method: 'POST' }));
  });

  it('surfaces the provider error message on a non-OK response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ error: { message: 'Invalid API key' } }) });
    const provider = createLlmProvider({ LLM_API_KEY: 'bad' }, fetchImpl);
    await expect(provider.complete({ prompt: 'hi' })).rejects.toThrow(/Invalid API key/);
  });

  it('routes to the Anthropic Messages API when selected', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ content: [{ type: 'text', text: 'ok' }] }) });
    const provider = createLlmProvider({ LLM_PROVIDER: 'anthropic', LLM_API_KEY: 'sk' }, fetchImpl);
    await provider.complete({ prompt: 'hi' });
    expect(fetchImpl.mock.calls[0][0]).toBe('https://api.anthropic.com/v1/messages');
  });
});
