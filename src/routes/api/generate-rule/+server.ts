// src/routes/api/generate-rule/+server.ts

import { json, type RequestHandler } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

const MODEL = 'gpt-4.1-mini';
const OPENAI_TIMEOUT_MS = 30_000;

export const POST: RequestHandler = async ({ request }) => {
    try {
        const apiKey = env.OPENAI_API_KEY;
        if (!apiKey) {
            return json({ error: 'OPENAI_API_KEY is not set on the server' }, { status: 500 });
        }

        const { selected_text, action_type, user_intent } = await request.json();

        if (!selected_text || !action_type || !user_intent) {
            return json({ error: 'Missing required fields: selected_text, action_type, user_intent' }, { status: 400 });
        }

        const actionDescriptions: Record<string, string> = {
            strikethrough: 'Strike through the matching text (redline)',
            strikethrough_annotate: 'Strike through the matching text and add a red annotation note above it',
            highlight: 'Highlight the matching text in red to flag it',
            annotate: 'Add a red annotation note on the matching text',
            underline: 'Underline the matching text in red'
        };

        const actionDesc = actionDescriptions[action_type] || action_type;
        const needsNote = action_type === 'strikethrough_annotate' || action_type === 'annotate';

        const systemPrompt = `You are a contract redlining assistant for a music/entertainment agency management tool called Produkt Red.
Your job is to help create reusable rules that the AI contract analyzer will use to automatically detect and mark up clauses in artist contracts.

A rule consists of:
1. "rule_text" — A clear, generalized description of what the AI should look for in ANY contract (not just this specific text). It should be broad enough to catch variations of the same clause across different contracts, but specific enough to avoid false positives.
2. "annotation_note" — ${needsNote ? 'A short note (2-6 words) that will appear as red text on the contract next to the markup. Keep it concise and actionable.' : 'null (not needed for this action type)'}

The action type for this rule is: ${actionDesc}

Important guidelines:
- The rule_text should describe WHAT to look for, not the specific verbatim text
- Use general language like "clauses that..." or "provisions where..." or "any mention of..."
- The rule should work across different contracts from different agencies
- Be specific about the problematic pattern, not the exact wording`;

        const userPrompt = `Here is the selected contract text the user wants to create a rule from:

"""
${selected_text}
"""

The user's description of what they want this rule to do:
"${user_intent}"

Generate a reusable rule.`;

        const RESPONSE_SCHEMA = {
            type: 'object',
            additionalProperties: false,
            properties: {
                rule_text: { type: 'string' },
                annotation_note: { type: ['string', 'null'] }
            },
            required: ['rule_text', 'annotation_note']
        };

        const aiResp = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            signal: AbortSignal.timeout(OPENAI_TIMEOUT_MS),
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: MODEL,
                temperature: 0.7,
                max_tokens: 500,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                response_format: {
                    type: 'json_schema',
                    json_schema: { name: 'generate_rule', strict: true, schema: RESPONSE_SCHEMA }
                }
            })
        });

        if (!aiResp.ok) {
            const detail = await aiResp.text().catch(() => '');
            console.error(`[generate-rule] OpenAI ${aiResp.status}: ${detail.slice(0, 2000)}`);
            const hint =
                aiResp.status === 429 ? 'quota or rate limit' :
                aiResp.status === 401 ? 'invalid API key' :
                'provider error';
            return json({ error: `AI provider error ${aiResp.status} (${hint})` }, { status: 502 });
        }

        const data = await aiResp.json();
        if (data?.usage) {
            console.log(`[generate-rule] ${MODEL} prompt=${data.usage.prompt_tokens} completion=${data.usage.completion_tokens}`);
        }

        const content: string = data?.choices?.[0]?.message?.content ?? '{}';
        try {
            const parsed = JSON.parse(content);
            return json({
                rule_text: parsed.rule_text ?? '',
                annotation_note: parsed.annotation_note ?? null
            });
        } catch {
            console.error(`[generate-rule] invalid JSON from model: ${content.slice(0, 500)}`);
            return json({ error: 'AI returned invalid JSON' }, { status: 502 });
        }
    } catch (err) {
        const e = err as Error & { status?: number; name?: string };
        if (e?.name === 'TimeoutError' || e?.name === 'AbortError') {
            return json({ error: 'Rule generation timed out — try again.' }, { status: 504 });
        }
        console.error('[generate-rule] unhandled:', e);
        return json({ error: String(e?.message ?? e) }, { status: e?.status ?? 500 });
    }
};