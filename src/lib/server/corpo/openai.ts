// Thin OpenAI chat-completions helper for the corpo routes, following the hardened pattern
// of api/contract-analyze: raw fetch, hard timeout, provider bodies logged server-side only,
// and a CorpoHttpError(502|504) for the client.
import { env } from '$env/dynamic/private';
import { CorpoHttpError } from './auth';

/** Cheapest text+vision model already used elsewhere in this repo (w89-parse, contract-analyze). */
export const CORPO_OPENAI_MODEL = 'gpt-4.1-mini';

export type ChatContentPart =
	| { type: 'text'; text: string }
	| { type: 'image_url'; image_url: { url: string; detail?: 'low' | 'high' | 'auto' } }
	/** PDF input (Chat Completions): OpenAI extracts the text layer and rasterises the pages. */
	| { type: 'file'; file: { filename: string; file_data: string } };

export interface ChatMessage {
	role: 'system' | 'user';
	content: string | ChatContentPart[];
}

export interface ChatOptions {
	messages: ChatMessage[];
	timeoutMs: number;
	maxTokens: number;
	temperature?: number;
	jsonSchema?: { name: string; schema: Record<string, unknown> };
	model?: string;
	context: string;
}

export interface ChatResult {
	content: string;
	usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
	model: string;
}

export function requireOpenAIKey(): string {
	const key = env.OPENAI_API_KEY;
	if (!key) throw new CorpoHttpError(500, 'OPENAI_API_KEY is not set on the server', 'server_error');
	return key;
}

export async function chatCompletion(opts: ChatOptions): Promise<ChatResult> {
	const apiKey = requireOpenAIKey();
	const model = opts.model ?? CORPO_OPENAI_MODEL;

	const body: Record<string, unknown> = {
		model,
		temperature: opts.temperature ?? 0,
		max_tokens: opts.maxTokens,
		messages: opts.messages
	};
	if (opts.jsonSchema) {
		body.response_format = {
			type: 'json_schema',
			json_schema: { name: opts.jsonSchema.name, strict: true, schema: opts.jsonSchema.schema }
		};
	}

	let resp: Response;
	try {
		resp = await fetch('https://api.openai.com/v1/chat/completions', {
			method: 'POST',
			signal: AbortSignal.timeout(opts.timeoutMs),
			headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
			body: JSON.stringify(body)
		});
	} catch (err) {
		const e = err as { name?: string; message?: string };
		if (e?.name === 'TimeoutError' || e?.name === 'AbortError') {
			throw new CorpoHttpError(504, 'AI provider timed out', 'timeout');
		}
		console.error(`[${opts.context}] OpenAI network error:`, e?.message ?? err);
		throw new CorpoHttpError(502, 'AI provider unreachable', 'provider_error');
	}

	if (!resp.ok) {
		const detail = await resp.text().catch(() => '');
		console.error(`[${opts.context}] OpenAI ${resp.status}: ${detail.slice(0, 2000)}`);
		const hint =
			resp.status === 429 ? 'rate limit or quota' : resp.status === 401 ? 'invalid API key' : 'provider error';
		throw new CorpoHttpError(502, `AI provider error ${resp.status} (${hint})`, 'provider_error');
	}

	const data = (await resp.json()) as {
		choices?: Array<{ message?: { content?: string | null } }>;
		usage?: ChatResult['usage'];
	};
	if (data?.usage) {
		console.log(
			`[${opts.context}] ${model} prompt=${data.usage.prompt_tokens} completion=${data.usage.completion_tokens} total=${data.usage.total_tokens}`
		);
	}
	const content = data?.choices?.[0]?.message?.content ?? '';
	return { content, usage: data?.usage, model };
}
