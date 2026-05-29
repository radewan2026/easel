export type AiGatewayMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type AiGatewayRequest = {
  messages: AiGatewayMessage[];
  maxTokens?: number;
  temperature?: number;
  task?: string;
};

type AiGatewayResult = {
  content: string | null;
  source: 'gateway' | 'unconfigured' | 'error';
  error?: string;
};

type AiGatewayResponse = {
  content?: string;
  message?: string;
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

const DEFAULT_TIMEOUT_MS = 6000;

export function getAiGatewayEndpoint() {
  return (import.meta.env.VITE_AI_GATEWAY_URL as string | undefined)?.trim() || '';
}

export function hasAiGateway() {
  return Boolean(getAiGatewayEndpoint());
}

export async function callAiGateway(request: AiGatewayRequest): Promise<AiGatewayResult> {
  const endpoint = getAiGatewayEndpoint();
  if (!endpoint) {
    return { content: null, source: 'unconfigured' };
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task: request.task || 'assistant',
        messages: request.messages,
        max_tokens: request.maxTokens,
        temperature: request.temperature,
      }),
    });

    if (!response.ok) {
      return { content: null, source: 'error', error: `AI gateway returned ${response.status}` };
    }

    const data = (await response.json()) as AiGatewayResponse;
    const content =
      data.content ||
      data.message ||
      data.choices?.[0]?.message?.content ||
      null;

    return { content, source: 'gateway' };
  } catch (error) {
    const isAbort = error instanceof DOMException && error.name === 'AbortError';
    return {
      content: null,
      source: 'error',
      error: isAbort ? 'AI gateway timed out' : 'AI gateway request failed',
    };
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function verifyAiGateway() {
  const result = await callAiGateway({
    task: 'health_check',
    maxTokens: 20,
    messages: [
      { role: 'system', content: 'Reply with OK only.' },
      { role: 'user', content: 'Health check' },
    ],
  });

  return result.source === 'gateway' && Boolean(result.content);
}
