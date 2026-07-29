// src/routes/api/contract-analyze/+server.ts
//
// POST { agency, pages:[{page,text}], rules:[{rule_number,rule_text,action_type,annotation_note}] }
// ->   { suggestions:[{ page, exact_text, action, note, rule_number, reason, confidence }] }
//
// Hardened version:
//   • Every OpenAI call carries a hard timeout — a slow/hung provider now returns
//     a clean JSON 504 instead of holding the socket until the reverse proxy
//     gives up and serves a Cloudflare HTML 502.
//   • Input is capped (per page + total) and big contracts are CHUNKED into
//     several smaller model calls whose suggestions get merged + deduped.
//     Smaller prompts are faster, cheaper, and quote `exact_text` far more
//     faithfully — long contexts are where models start paraphrasing.
//   • Provider errors are logged server-side; the client only ever receives a
//     short JSON message (never OpenAI's raw body).
//   • Token usage is logged per call so cost per contract shows up in logs.

import { json, type RequestHandler } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

// Swap to 'gpt-5-nano' (cheapest) or 'gpt-4.1' (strongest) any time.
const MODEL = 'gpt-4.1-mini';

// ── Budgets ────────────────────────────────────────────────────────────────
const OPENAI_TIMEOUT_MS   = 80_000;  // < the Swift client's 90s, > nginx's 60s is irrelevant since we abort ourselves
const MAX_PAGE_CHARS      = 12_000;  // one contract page of dense text is ~3–4k chars; 12k is generous
const MAX_CHUNK_CHARS     = 45_000;  // per model call — keeps prompts small enough to quote verbatim reliably
const MAX_TOTAL_CHARS     = 300_000; // absolute ceiling; beyond this the request is rejected as unreasonable
const MAX_COMPLETION_TOKENS = 4_096;

interface RulePayload {
  rule_number: number | null;
  rule_text: string;
  action_type: string;
  annotation_note: string | null;
}
interface PageText { page: number; text: string; }
interface AnalyzeBody { agency: string; pages: PageText[]; rules: RulePayload[]; }

interface Suggestion {
  page: number;
  exact_text: string;
  action: string;
  note: string | null;
  rule_number: number | null;
  reason: string;
  confidence: number;
}

const RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    suggestions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          page:        { type: 'integer' },
          exact_text:  { type: 'string' },
          action:      { type: 'string', enum: ['strikethrough', 'strikethrough_annotate', 'highlight', 'annotate', 'underline'] },
          note:        { type: ['string', 'null'] },
          rule_number: { type: ['integer', 'null'] },
          reason:      { type: 'string' },
          confidence:  { type: 'number' }
        },
        required: ['page', 'exact_text', 'action', 'note', 'rule_number', 'reason', 'confidence']
      }
    }
  },
  required: ['suggestions']
};

// ── Prompt pieces ──────────────────────────────────────────────────────────

const SYSTEM_PROMPT = [
  'You are a contracts paralegal marking up performance/booking agreements for a concert promoter.',
  'You receive the agency name, a list of redlining RULES, and the contract text split by page.',
  'Return one suggested markup per location where a rule applies.',
  '',
  'CRITICAL REQUIREMENTS:',
  '1. exact_text MUST be copied verbatim, character-for-character, from the given page text. Never paraphrase, reformat, fix typos, or add words. If you cannot quote it exactly, omit it.',
  '2. Keep exact_text as short as possible while still uniquely locating the target (a phrase or a single line, never a whole paragraph).',
  '3. page MUST be the page number printed in the ===== PAGE N ===== marker the exact_text came from.',
  '4. action MUST come from the matching rule. If that rule has a note, put it in "note"; otherwise note = null.',
  '5. Only suggest markups a provided rule supports. Never invent rules. If nothing applies, return an empty suggestions array.',
  '6. confidence is a number from 0 to 1.'
].join('\n');

function rulesBlock(rules: RulePayload[]): string {
  return rules.map((r) =>
    `Rule #${r.rule_number ?? '-'} | action=${r.action_type}` +
    (r.annotation_note ? ` | note="${r.annotation_note}"` : '') +
    `\n${r.rule_text}`
  ).join('\n\n');
}

// ── Chunking: split the page list into prompts of ≤ MAX_CHUNK_CHARS ────────
// Pages keep their ORIGINAL page numbers inside each chunk, so suggestions
// come back with correct indices no matter which chunk produced them.

function chunkPages(pages: PageText[]): PageText[][] {
  const chunks: PageText[][] = [];
  let current: PageText[] = [];
  let size = 0;
  for (const p of pages) {
    const len = p.text.length;
    if (current.length > 0 && size + len > MAX_CHUNK_CHARS) {
      chunks.push(current);
      current = [];
      size = 0;
    }
    current.push(p);
    size += len;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

// ── One model call for one chunk ───────────────────────────────────────────

async function analyzeChunk(
  apiKey: string,
  agency: string,
  rulesText: string,
  chunk: PageText[]
): Promise<Suggestion[]> {
  const pagesText = chunk.map((p) => `===== PAGE ${p.page} =====\n${p.text}`).join('\n\n');
  const user = `AGENCY: ${agency}\n\nRULES:\n${rulesText}\n\nCONTRACT:\n${pagesText}`;

  const aiResp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    signal: AbortSignal.timeout(OPENAI_TIMEOUT_MS),
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0,
      max_tokens: MAX_COMPLETION_TOKENS,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: user }
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'contract_markup', strict: true, schema: RESPONSE_SCHEMA }
      }
    })
  });

  if (!aiResp.ok) {
    // Log the full provider body server-side; never forward it to the client.
    const detail = await aiResp.text().catch(() => '');
    console.error(`[contract-analyze] OpenAI ${aiResp.status}: ${detail.slice(0, 2000)}`);
    const hint =
      aiResp.status === 429 ? 'quota or rate limit — check your OpenAI credit balance' :
      aiResp.status === 401 ? 'invalid API key' :
      'provider error';
    throw Object.assign(new Error(`AI provider error ${aiResp.status} (${hint})`), { status: 502 });
  }

  const data = await aiResp.json();
  if (data?.usage) {
    console.log(
      `[contract-analyze] ${MODEL} pages=${chunk.map((p) => p.page).join(',')} ` +
      `prompt=${data.usage.prompt_tokens} completion=${data.usage.completion_tokens} total=${data.usage.total_tokens}`
    );
  }

  const content: string = data?.choices?.[0]?.message?.content ?? '{"suggestions":[]}';
  try {
    const parsed = JSON.parse(content);
    return Array.isArray(parsed?.suggestions) ? parsed.suggestions : [];
  } catch {
    console.error(`[contract-analyze] invalid JSON from model: ${content.slice(0, 500)}`);
    throw Object.assign(new Error('AI returned invalid JSON'), { status: 502 });
  }
}

// ── Handler ────────────────────────────────────────────────────────────────

export const POST: RequestHandler = async ({ request }) => {
  try {
    const apiKey = env.OPENAI_API_KEY;
    if (!apiKey) {
      return json({ error: 'OPENAI_API_KEY is not set on the server' }, { status: 500 });
    }

    const { agency, pages, rules } = (await request.json()) as AnalyzeBody;

    if (!Array.isArray(pages) || !Array.isArray(rules)) {
      return json({ error: 'pages and rules must be arrays' }, { status: 400 });
    }
    if (rules.length === 0) {
      return json({ suggestions: [] });
    }

    // Cap + clean the input: drop empty pages, truncate absurdly long ones.
    const cleanPages: PageText[] = pages
      .map((p) => ({ page: p.page, text: (p.text ?? '').slice(0, MAX_PAGE_CHARS) }))
      .filter((p) => p.text.trim().length > 0);

    if (cleanPages.length === 0) {
      return json({ suggestions: [] });
    }

    const totalChars = cleanPages.reduce((n, p) => n + p.text.length, 0);
    if (totalChars > MAX_TOTAL_CHARS) {
      return json({ error: `Contract too large to analyze (${totalChars} chars)` }, { status: 413 });
    }

    const rulesText = rulesBlock(rules);
    const chunks = chunkPages(cleanPages);

    // Sequential on purpose: parallel chunk calls trip requests-per-minute
    // limits on lower OpenAI tiers, and chunks are individually fast.
    const all: Suggestion[] = [];
    for (const chunk of chunks) {
      const part = await analyzeChunk(apiKey, agency, rulesText, chunk);
      all.push(...part);
    }

    // Dedupe across chunk boundaries (same target, same action).
    const seen = new Set<string>();
    const suggestions = all.filter((s) => {
      const key = `${s.page}|${s.action}|${s.exact_text}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return json({ suggestions, meta: { model: MODEL, chunks: chunks.length, pages: cleanPages.length } });
  } catch (err) {
    const e = err as Error & { status?: number; name?: string };
    if (e?.name === 'TimeoutError' || e?.name === 'AbortError') {
      return json({ error: 'Analysis timed out — the AI took too long. Try again.' }, { status: 504 });
    }
    console.error('[contract-analyze] unhandled:', e);
    return json({ error: String(e?.message ?? e) }, { status: e?.status ?? 500 });
  }
};