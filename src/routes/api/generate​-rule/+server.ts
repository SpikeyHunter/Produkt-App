// src/routes/api/generate-rule/+server.ts

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import OpenAI from 'openai';
import { OPENAI_API_KEY } from '$env/static/private';

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

export const POST: RequestHandler = async ({ request }) => {
    const { selected_text, action_type, user_intent } = await request.json();

    if (!selected_text || !action_type || !user_intent) {
        throw error(400, 'Missing required fields: selected_text, action_type, user_intent');
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

Generate a reusable rule. Return ONLY valid JSON with this exact format:
{
  "rule_text": "...",
  "annotation_note": ${needsNote ? '"..."' : 'null'}
}`;

    try {
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o',
            temperature: 0.7,
            max_tokens: 500,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            response_format: { type: 'json_object' }
        });

        const content = completion.choices[0]?.message?.content;
        if (!content) {
            throw error(500, 'No response from AI');
        }

        const parsed = JSON.parse(content);

        return json({
            rule_text: parsed.rule_text,
            annotation_note: parsed.annotation_note ?? null
        });
    } catch (err: any) {
        if (err?.status) throw err; // re-throw SvelteKit errors
        console.error('generate-rule error:', err);
        throw error(500, err?.message || 'Failed to generate rule');
    }
};