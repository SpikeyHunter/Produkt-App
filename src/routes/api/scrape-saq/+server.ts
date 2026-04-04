import { json } from '@sveltejs/kit';
import * as cheerio from 'cheerio';
import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import type { RequestEvent } from '@sveltejs/kit';

const supabaseAdmin = createClient(
    publicEnv.PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY
);

async function scrapePage(url: string) {
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
    });

    if (!response.ok) return null;

    const html = await response.text();
    const $ = cheerio.load(html);

    const name = $('h1.page-title').text().trim();
    let type = $('span.value[itemprop="identity"] strong.type').first().text().trim();
    
    const priceText = $('.price-box .price, .price-wrapper .price').first().text().replace(/[^\d.,]/g, '').replace(',', '.').trim();
    const price = priceText || "0.00";
    const description = $('.wrapper-description .wrapper-content-info p').text().trim();

    const tasting: Record<string, any> = {};
    const aromasKey = $('.tasting-container li span:contains("Arômes"), .tasting-container li span:contains("Aromas")');
    if (aromasKey.length) tasting['aromas'] = aromasKey.next('strong').text().trim();

    const agingKey = $('.aging-potential span:contains("Potentiel de garde"), .aging-potential span:contains("Aging potential")');
    if (agingKey.length) tasting['aging_potential'] = agingKey.siblings('.text').find('strong').text().trim();

    $('ul.tasting-container.half li:not(.text)').each((_, el) => {
        const key = $(el).find('span.in-line').text().trim().toLowerCase();
        const val = $(el).find('strong.in-line').text().trim();
        const level = $(el).find('.tasting-bar .active').length;
        if (key) tasting[key] = { value: val, level };
    });

    const tempKey = $('ul.tasting-container.half.text li span:contains("Température de service"), ul.tasting-container.half.text li span:contains("Serving temperature")');
    if (tempKey.length) tasting['serving_temperature'] = tempKey.next('strong').text().trim();

    const details: Record<string, string> = {};
    $('ul.list-attributs li').each((_, el) => {
        const key = $(el).find('span').first().text().trim();
        const val = $(el).find('strong').first().text().trim();
        if (key && val) details[key] = val;
    });

    const isOrangeWine = Object.values(details).some(val => 
        val.toLowerCase().includes('vin orange') || val.toLowerCase().includes('orange wine')
    );
    
    if (isOrangeWine) {
        type = url.includes('/fr/') ? 'Vin orange' : 'Orange wine';
    }

    const bottle_image = $('img[itemprop="image"]').attr('src') || '';

    return { name, type, price, description, tasting, details, bottle_image };
}

export async function POST({ request }: RequestEvent) {
    try {
        const { saq_code } = await request.json();

        if (!saq_code) {
            return json({ error: 'SAQ code is required' }, { status: 400 });
        }

        const frUrl = `https://www.saq.com/fr/${saq_code}`;
        const enUrl = `https://www.saq.com/en/${saq_code}`;

        const filePath = `bottles/${saq_code}.jpg`;
        const { data: publicUrlData } = supabaseAdmin.storage.from('bazart').getPublicUrl(filePath);
        const expectedImageUrl = publicUrlData.publicUrl;

        // 🚀 OPTIMIZATION: Create a promise for the HEAD request but DO NOT await it yet.
        const checkImagePromise = fetch(expectedImageUrl, { method: 'HEAD' })
            .then(res => res.ok)
            .catch(() => false);

        // 🚀 OPTIMIZATION: Run the FR scrape, EN scrape, AND the image check all at the same time.
        const [frData, enData, imageExists] = await Promise.all([
            scrapePage(frUrl),
            scrapePage(enUrl),
            checkImagePromise
        ]);

        if (!frData && !enData) {
            return json({ error: 'Failed to scrape data from SAQ' }, { status: 404 });
        }

        const safeFrData = frData || enData || {} as any;
        const safeEnData = enData || frData || {} as any;

        let uploadedImageUrl = imageExists ? expectedImageUrl : '';

        if (!imageExists) {
            const sourceImage = safeFrData.bottle_image || safeEnData.bottle_image;
            if (sourceImage) {
                try {
                    const cleanImageUrl = sourceImage.split('?')[0]; 
                    const imageRes = await fetch(cleanImageUrl);
                    
                    if (imageRes.ok) {
                        const arrayBuffer = await imageRes.arrayBuffer();
                        const buffer = Buffer.from(arrayBuffer);
                        
                        const { error } = await supabaseAdmin.storage
                            .from('bazart')
                            .upload(filePath, buffer, {
                                contentType: 'image/jpeg',
                                upsert: true
                            });

                        if (!error) {
                            uploadedImageUrl = expectedImageUrl;
                        }
                    }
                } catch (imgError) {
                    console.error('Failed to upload image:', imgError);
                }
            }
        }

        const combinedData = {
            saq_code,
            price: safeFrData.price, 
            bottle_image: uploadedImageUrl,
            name: { fr: safeFrData.name, en: safeEnData.name },
            type: { fr: safeFrData.type, en: safeEnData.type },
            description: { fr: safeFrData.description, en: safeEnData.description },
            details: { fr: safeFrData.details, en: safeEnData.details },
            tasting: { fr: safeFrData.tasting, en: safeEnData.tasting }
        };

        return json(combinedData);

    } catch (error: any) {
        console.error('Scraping error:', error);
        return json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}