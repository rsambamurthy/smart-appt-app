import logger from '../utils/logger';

/**
 * Anthropic Messages API, just enough of it.
 *
 * Deliberately not the SDK. One POST and a narrow response type is less to keep
 * current than a dependency, and it keeps the tool-use contract visible in this
 * file rather than behind a wrapper — which matters, because that contract is
 * how the assistant is prevented from inventing figures.
 *
 * Never throws for a model or network failure. The assistant degrades to "I
 * could not answer that"; it does not take a page down.
 */

const API = 'https://api.anthropic.com/v1/messages';

/**
 * Haiku, because this is high-volume, low-difficulty work: pick a tool, read a
 * result, write two sentences. Reasoning about a housing ledger is not the
 * hard part — the queries already did that.
 */
const MODEL = process.env.ASSISTANT_MODEL ?? 'claude-haiku-4-5-20251001';

export interface LlmTool {
  name:         string;
  description:  string;
  input_schema: Record<string, unknown>;
}

export type LlmContent =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean };

export interface LlmMessage {
  role:    'user' | 'assistant';
  content: string | LlmContent[];
}

export interface LlmReply {
  ok:          boolean;
  stop_reason: string | null;
  content:     LlmContent[];
  input_tokens:  number;
  output_tokens: number;
  model:       string;
  error?:      string;
}

function config() {
  const key = process.env.ANTHROPIC_API_KEY ?? '';
  return { key, enabled: !!key && !key.startsWith('<') };
}

export const llmEnabled = () => config().enabled;

export async function complete(opts: {
  system:     string;
  messages:   LlmMessage[];
  tools?:     LlmTool[];
  maxTokens?: number;
}): Promise<LlmReply> {
  const c = config();
  const empty: LlmReply = {
    ok: false, stop_reason: null, content: [],
    input_tokens: 0, output_tokens: 0, model: MODEL,
  };

  if (!c.enabled) {
    return { ...empty, error: 'ANTHROPIC_API_KEY is not set.' };
  }

  try {
    const res = await fetch(API, {
      method: 'POST',
      headers: {
        'x-api-key':         c.key,
        'anthropic-version': '2023-06-01',
        'content-type':      'application/json',
      },
      body: JSON.stringify({
        model:      MODEL,
        max_tokens: opts.maxTokens ?? 1024,
        system:     opts.system,
        messages:   opts.messages,
        ...(opts.tools?.length ? { tools: opts.tools } : {}),
      }),
    });

    const json = await res.json() as {
      content?: LlmContent[];
      stop_reason?: string;
      usage?: { input_tokens?: number; output_tokens?: number };
      error?: { message?: string; type?: string };
    };

    if (!res.ok) {
      const error = json.error?.message ?? `HTTP ${res.status}`;
      logger.error('LLM call failed', { status: res.status, type: json.error?.type, error });
      return { ...empty, error };
    }

    return {
      ok:            true,
      stop_reason:   json.stop_reason ?? null,
      content:       json.content ?? [],
      input_tokens:  json.usage?.input_tokens ?? 0,
      output_tokens: json.usage?.output_tokens ?? 0,
      model:         MODEL,
    };
  } catch (err) {
    const error = (err as Error).message;
    logger.error('LLM call threw', { error });
    return { ...empty, error };
  }
}
