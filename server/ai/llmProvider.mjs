/**
 * Provider-agnostic LLM gateway.
 *
 * The model provider is chosen entirely by environment — no code change is needed to switch. Most
 * providers (OpenAI, Groq, Together, OpenRouter, Azure OpenAI, local Ollama, …) speak the OpenAI
 * chat-completions shape, so the `openai` adapter plus a configurable `LLM_BASE_URL` covers them; the
 * `anthropic` adapter is provided for Claude's native Messages API.
 *
 *   LLM_PROVIDER   openai (default; also any OpenAI-compatible endpoint) | anthropic
 *   LLM_API_KEY    the provider key (absent = feature disabled, callers fall back to deterministic mode)
 *   LLM_MODEL      model id (sensible per-provider default when unset)
 *   LLM_BASE_URL   override the API base — point it at any compatible gateway
 */

const DEFAULT_MODELS = { openai: 'gpt-4o-mini', anthropic: 'claude-3-5-haiku-latest' };
const DEFAULT_BASES = { openai: 'https://api.openai.com/v1', anthropic: 'https://api.anthropic.com/v1' };

/** Resolve the effective provider config from env, without exposing the key to callers of `health`. */
export function resolveLlmConfig(env = process.env) {
  const provider = (env.LLM_PROVIDER || 'openai').trim().toLowerCase();
  const apiKey = (env.LLM_API_KEY || '').trim();
  const model = (env.LLM_MODEL || DEFAULT_MODELS[provider] || DEFAULT_MODELS.openai).trim();
  const baseUrl = (env.LLM_BASE_URL || DEFAULT_BASES[provider] || DEFAULT_BASES.openai).replace(/\/+$/, '');
  return { provider, apiKey, model, baseUrl, configured: apiKey.length > 0 };
}

export function buildOpenAiRequest({ baseUrl, apiKey, model, system, prompt, maxTokens }) {
  return {
    url: `${baseUrl}/chat/completions`,
    init: {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [...(system ? [{ role: 'system', content: system }] : []), { role: 'user', content: prompt }],
        max_tokens: maxTokens,
        temperature: 0,
      }),
    },
  };
}

export function parseOpenAiResponse(payload) {
  const text = payload?.choices?.[0]?.message?.content;
  if (typeof text !== 'string') throw new Error('The language model returned an unexpected response.');
  return text.trim();
}

export function buildAnthropicRequest({ baseUrl, apiKey, model, system, prompt, maxTokens }) {
  return {
    url: `${baseUrl}/messages`,
    init: {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: maxTokens, ...(system ? { system } : {}), messages: [{ role: 'user', content: prompt }] }),
    },
  };
}

export function parseAnthropicResponse(payload) {
  const block = payload?.content?.find((entry) => entry?.type === 'text') ?? payload?.content?.[0];
  const text = block?.text;
  if (typeof text !== 'string') throw new Error('The language model returned an unexpected response.');
  return text.trim();
}

/**
 * Build a provider whose `complete()` calls the configured model. `fetchImpl` is injectable for tests.
 * When no key is configured, `configured` is false and `complete()` throws — callers should degrade to
 * their deterministic path rather than surfacing an error.
 */
export function createLlmProvider(env = process.env, fetchImpl = globalThis.fetch) {
  const config = resolveLlmConfig(env);
  return {
    configured: config.configured,
    provider: config.provider,
    model: config.model,
    async complete({ system, prompt, maxTokens = 512, timeoutMs = 20000 } = {}) {
      if (!config.configured) throw new Error('No language model is configured. Set LLM_API_KEY in .env.server.');
      if (!prompt || typeof prompt !== 'string') throw new Error('A prompt is required.');
      const isAnthropic = config.provider === 'anthropic';
      const build = isAnthropic ? buildAnthropicRequest : buildOpenAiRequest;
      const { url, init } = build({ ...config, system, prompt, maxTokens });
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(url, { ...init, signal: controller.signal });
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(payload?.error?.message || `The language model request failed (${response.status}).`);
        }
        return isAnthropic ? parseAnthropicResponse(payload) : parseOpenAiResponse(payload);
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
