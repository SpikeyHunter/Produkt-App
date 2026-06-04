// src/routes/api/contract-analyze/+server.ts
//
// POST { agency, pages:[{page,text}], rules:[{rule_number,rule_text,action_type,annotation_note}] }
// ->   { suggestions:[{ page, exact_text, action, note, rule_number, reason, confidence }] }

import { json, type RequestHandler } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

// Swap to 'gpt-5-nano' (cheapest) or 'gpt-4.1' (strongest) any time.
const MODEL = 'gpt-4.1-mini';

interface RulePayload {
  rule_number: number | null;
  rule_text: string;
  action_type: string;
  annotation_note: string | null;
}
interface PageText { page: number; text: string; }
interface AnalyzeBody { agency: string; pages: PageText[]; rules: RulePayload[]; }

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

export const POST: RequestHandler = async ({ request }) => {
  try {
    const apiKey = env.PUBLIC_OPENAI_API_KEY;
    if (!apiKey) {
      return json({ error: 'PUBLIC_OPENAI_API_KEY is not set on the server' }, { status: 500 });
    }

    const { agency, pages, rules } = (await request.json()) as AnalyzeBody;

    if (!Array.isArray(pages) || !Array.isArray(rules)) {
      return json({ error: 'pages and rules must be arrays' }, { status: 400 });
    }
    if (rules.length === 0) {
      return json({ suggestions: [] });
    }

    const rulesText = rules.map((r) =>
      `Rule #${r.rule_number ?? '-'} | action=${r.action_type}` +
      (r.annotation_note ? ` | note="${r.annotation_note}"` : '') +
      `\n${r.rule_text}`
    ).join('\n\n');

    const pagesText = pages.map((p) => `===== PAGE ${p.page} =====\n${p.text}`).join('\n\n');

    const system = [
      'You are a contracts paralegal marking up performance/booking agreements for a concert promoter.',
      'You receive the agency name, a list of redlining RULES, and the contract text split by page.',
      'Return one suggested markup per location where a rule applies.',
      '',
      'CRITICAL REQUIREMENTS:',
      '1. exact_text MUST be copied verbatim, character-for-character, from the given page text. Never paraphrase, reformat, fix typos, or add words. If you cannot quote it exactly, omit it.',
      '2. Keep exact_text as short as possible while still uniquely locating the target (a phrase or a single line, never a whole paragraph).',
      '3. page MUST be the 0-based index of the page the exact_text came from.',
      '4. action MUST come from the matching rule. If that rule has a note, put it in "note"; otherwise note = null.',
      '5. Only suggest markups a provided rule supports. Never invent rules. If nothing applies, return an empty suggestions array.',
      '6. confidence is a number from 0 to 1.'
    ].join('\n');

    const user = `AGENCY: ${agency}\n\nRULES:\n${rulesText}\n\nCONTRACT:\n${pagesText}`;

    const aiResp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ],
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'contract_markup', strict: true, schema: RESPONSE_SCHEMA }
        }
      })
    });

    if (!aiResp.ok) {
      const detail = await aiResp.text();
      return json({ error: `AI provider error ${aiResp.status}`, detail }, { status: 502 });
    }

    const data = await aiResp.json();
    const content: string = data?.choices?.[0]?.message?.content ?? '{"suggestions":[]}';

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      return json({ error: 'AI returned invalid JSON', raw: content }, { status: 502 });
    }

    return json(parsed);
  } catch (err) {
    return json({ error: String((err as Error)?.message ?? err) }, { status: 500 });
  }
};