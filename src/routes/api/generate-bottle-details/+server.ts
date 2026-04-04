import { json } from '@sveltejs/kit';
import { env as publicEnv } from '$env/dynamic/public';
import type { RequestEvent } from '@sveltejs/kit';

export async function POST({ request }: RequestEvent) {
    try {
        const { name, type } = await request.json();

        if (!name || !type) {
            return json({ error: 'Name and Type are required' }, { status: 400 });
        }

        const prompt = `
            Act as a master sommelier and spirits expert. 
            Provide detailed tasting notes, descriptions, and details for the following product:
            Name: ${name}
            Type: ${type}

            Return ONLY a valid, raw JSON object (no markdown formatting, no code blocks) with the EXACT following structure, filling in realistic, highly accurate information in both English and French. If you don't know a specific detail (like exactly what region), provide a highly educated guess or leave it empty, but you must respect the keys.

            {
              "description": {
                "en": "A 3-4 sentence engaging description of the product.",
                "fr": "A 3-4 sentence engaging description of the product in French."
              },
              "details": {
                "en": {
                  "Country": "", "Region": "", "Regulated Designation": "", "Degree of alcohol": "", "Sugar content": "",
                  "Special feature": "", "Size": "", "Producer": ""
                },
                "fr": {
                  "Pays": "", "Région": "", "Désignation réglementée": "", "Degré d'alcool": "", "Taux de sucre": "",
                  "Particularité": "", "Format": "", "Producteur": ""
                }
              },
              "tasting": {
                "en": {
                  "Vintage tasted": "N/A", "aromas": "", "acidity": "", "sweetness": "", "body": "", "mouthfeel": "", "wood": "", "serving_temperature": ""
                },
                "fr": {
                  "Millésime dégusté": "N/A", "aromas": "", "acidité": "", "sucrosité": "", "corps": "", "bouche": "", "bois": "", "serving_temperature": ""
                }
              }
            }
        `;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${publicEnv.PUBLIC_OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.7,
                response_format: { type: "json_object" }
            })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error?.message || 'OpenAI API error');
        }

        const data = await response.json();
        const content = JSON.parse(data.choices[0].message.content);

        return json(content);

    } catch (error: any) {
        console.error('AI Generation error:', error);
        return json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}