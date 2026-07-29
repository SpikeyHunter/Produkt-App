// src/routes/api/w89-parse/+server.ts
//
// POST { image: "<base64 png of page 1>", w_type_hint?: "W8" | "W9" }
// ->   { form_type, name, business_name, street, city_state_zip, country, foreign_tax_number }
//
// Vision-based W-8BEN / W-9 field extraction. The app sends page 1 rendered
// as a PNG; the model reads the ACTUAL layout — which works for typed
// AcroForms, flattened PDFs, scans, and PDFs whose text stream is mangled
// ("We stla k e Village") where label-anchored text parsing falls apart.

import { json, type RequestHandler } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

const MODEL = 'gpt-4.1-mini';
const TIMEOUT_MS = 60_000;

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    form_type:          { type: 'string', enum: ['W8', 'W9', 'unknown'] },
    name:               { type: ['string', 'null'] },
    business_name:      { type: ['string', 'null'] },
    street:             { type: ['string', 'null'] },
    city_state_zip:     { type: ['string', 'null'] },
    country:            { type: ['string', 'null'] },
    foreign_tax_number: { type: ['string', 'null'] }
  },
  required: ['form_type', 'name', 'business_name', 'street', 'city_state_zip', 'country', 'foreign_tax_number']
};

const PROMPT = [
  'This image is page 1 of an IRS form — either a W-8BEN or a W-9. Read the FILLED-IN values (typed or handwritten), never the printed label text.',
  '',
  'Extract:',
  '• form_type: "W8" for W-8BEN, "W9" for W-9.',
  '• name: W-8BEN line 1 (Name of individual who is the beneficial owner) or W-9 line 1 (Name).',
  '• business_name: W-9 line 2 (Business name/disregarded entity name) — null if empty or W-8BEN.',
  '• street: W-8BEN line 3 street portion, or W-9 line 5 (Address).',
  '• city_state_zip: W-8BEN line 3 city/town + state/province + postal code, or W-9 line 6 (City, state, ZIP).',
  '• country: W-8BEN line 3 Country — null for W-9.',
  '• foreign_tax_number: W-8BEN line 6 / 6a (Foreign tax identifying number) — null if empty or W-9. Never use line 5 (U.S. SSN/ITIN).',
  '',
  'Rules: copy values exactly as written but fix obvious extraction spacing artifacts (e.g. "We stla k e Village" → "Westlake Village"). If a field is blank, return null. Never invent values.'
].join('\n');

export const POST: RequestHandler = async ({ request }) => {
  try {
    const apiKey = env.OPENAI_API_KEY;
    if (!apiKey) {
      return json({ error: 'OPENAI_API_KEY is not set on the server' }, { status: 500 });
    }

    const { image, w_type_hint } = (await request.json()) as { image?: string; w_type_hint?: string };
    if (!image || typeof image !== 'string' || image.length < 100) {
      return json({ error: 'image (base64 PNG) is required' }, { status: 400 });
    }
    if (image.length > 15_000_000) {
      return json({ error: 'image too large' }, { status: 413 });
    }

    const hint = w_type_hint === 'W8' || w_type_hint === 'W9'
      ? `\nThe uploader classified this as a ${w_type_hint === 'W8' ? 'W-8BEN' : 'W-9'} — verify against the page.`
      : '';

    const aiResp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0,
        max_tokens: 500,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: `data:image/png;base64,${image}`, detail: 'high' } },
              { type: 'text', text: PROMPT + hint }
            ]
          }
        ],
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'w89_fields', strict: true, schema: SCHEMA }
        }
      })
    });

    if (!aiResp.ok) {
      const detail = await aiResp.text().catch(() => '');
      console.error(`[w89-parse] OpenAI ${aiResp.status}: ${detail.slice(0, 1500)}`);
      const hintMsg =
        aiResp.status === 429 ? 'quota or rate limit — check your OpenAI credit balance' : 'provider error';
      return json({ error: `AI provider error ${aiResp.status} (${hintMsg})` }, { status: 502 });
    }

    const data = await aiResp.json();
    if (data?.usage) {
      console.log(`[w89-parse] ${MODEL} prompt=${data.usage.prompt_tokens} completion=${data.usage.completion_tokens}`);
    }

    const content: string = data?.choices?.[0]?.message?.content ?? '{}';
    try {
      return json(JSON.parse(content));
    } catch {
      console.error(`[w89-parse] invalid JSON from model: ${content.slice(0, 300)}`);
      return json({ error: 'AI returned invalid JSON' }, { status: 502 });
    }
  } catch (err) {
    const e = err as Error & { name?: string };
    if (e?.name === 'TimeoutError' || e?.name === 'AbortError') {
      return json({ error: 'W8/9 parsing timed out — try again.' }, { status: 504 });
    }
    console.error('[w89-parse] unhandled:', e);
    return json({ error: String(e?.message ?? e) }, { status: 500 });
  }
};