import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import crypto from 'crypto';

function getTixrUrl(pathAndQuery: string) {
    const secret = env.TIXR_SECRET_KEY || 'ii39nQ4ALcqAYEZ3UIyM';
    const hash = crypto.createHmac('sha256', secret).update(pathAndQuery).digest('hex');
    return `https://studio.tixr.com${pathAndQuery}&hash=${hash}`;
}

export async function GET({ url }: RequestEvent) {
    const eventId = url.searchParams.get('eventId');
    if (!eventId) {
        return json({ error: 'Event ID is required' }, { status: 400 });
    }

    const groupId = env.TIXR_GROUP_ID || '980';
    const cpk = encodeURIComponent(env.TIXR_CPK || 'si8rzJCwnGHC5lCPnbqM');

    try {
        // ==========================================
        // 1. FETCH EVENT INFO
        // ==========================================
        const tEvent = encodeURIComponent(Date.now().toString());
        // Parameters MUST be alphabetical for the Tixr Hash to be valid (cpk -> t)
        const eventPath = `/v1/groups/${groupId}/events/${eventId}?cpk=${cpk}&t=${tEvent}`;
        const eventRes = await fetch(getTixrUrl(eventPath));
        const eventData = await eventRes.json();
        
        if (!eventRes.ok) throw new Error(eventData.message || 'Failed to fetch event');

        // ==========================================
        // 2. FETCH ALL ORDERS (Parallel Batching)
        // ==========================================
        let allOrders: any[] = [];
        let page = 1;
        let hasMore = true;
        const CHUNK_SIZE = 5; // 5 concurrent requests

        while (hasMore) {
            const batchPromises = [];
            
            for (let i = 0; i < CHUNK_SIZE; i++) {
                const currentPage = page + i;
                // FIX: Proper mathematical addition before converting to string
                const tOrder = encodeURIComponent((Date.now() + i).toString());
                
                // FIX: Strict alphabetical sorting for Tixr hashing requirement
                // cpk -> page_number -> page_size -> start_date -> t
                const ordersPath = `/v1/groups/${groupId}/events/${eventId}/orders?cpk=${cpk}&page_number=${currentPage}&page_size=100&start_date=2020-01-01&t=${tOrder}`;
                
                batchPromises.push(
                    fetch(getTixrUrl(ordersPath))
                        .then(async res => {
                            if (!res.ok) {
                                const errText = await res.text();
                                console.error(`[TIXR] API Error on page ${currentPage}:`, res.status, errText);
                                return [];
                            }
                            return res.json();
                        })
                        .catch(err => {
                            console.error(`[TIXR] Network Error on page ${currentPage}:`, err);
                            return [];
                        })
                );
            }

            const results = await Promise.all(batchPromises);
            let hitEnd = false;

            for (const orderData of results) {
                const orders = Array.isArray(orderData) ? orderData : [];
                allOrders.push(...orders);

                // If any page returned less than max size, we've hit the end
                if (orders.length < 100) {
                    hitEnd = true;
                }
            }

            if (hitEnd) {
                hasMore = false;
            } else {
                page += CHUNK_SIZE;
            }
        }

        console.log(`[TIXR] Successfully fetched ${allOrders.length} total historical orders for event ${eventId}`);

        // ==========================================
        // 3. AGGREGATE NET ISSUED TICKETS
        // ==========================================
        const validTicketCounts: Record<string, number> = {};

        for (const order of allOrders) {
            if (['CANCELED', 'REFUNDED', 'VOID', 'CANCELLED'].includes(order.status)) continue;

            for (const item of (order.sale_items || [])) {
                let validCount = 0;

                if (item.tickets && item.tickets.length > 0) {
                    validCount = item.tickets.filter((t: any) => t.status === 'VALID').length;
                } else if (['COMPLETE', 'COMPLETED', 'CHARGEBACK_WON', 'PREARB_WON'].includes(order.status)) {
                    validCount = item.quantity || 0;
                }

                if (validCount > 0) {
                    const idKey = item.tier_id ? `tier_${item.tier_id.toString()}` : `sale_${item.sale_id?.toString()}`;
                    validTicketCounts[idKey] = (validTicketCounts[idKey] || 0) + validCount;
                }
            }
        }

        // ==========================================
        // 4. MAP COUNTS TO EVENT TIERS
        // ==========================================
        const sales = eventData.sales || [];
        let items: any[] = [];

        sales.forEach((sale: any) => {
            if (sale.tiers && sale.tiers.length > 0) {
                sale.tiers.forEach((tier: any) => {
                    const tierKey = `tier_${tier.id?.toString()}`;
                    items.push({
                        originalName: `${sale.name} - ${tier.name}`,
                        tixrCategory: sale.category || '',
                        price: tier.price !== null && tier.price !== undefined ? tier.price : sale.current_price,
                        net_issued: validTicketCounts[tierKey] || 0
                    });
                });
            } else {
                const saleKey = `sale_${sale.id?.toString()}`;
                items.push({
                    originalName: sale.name,
                    tixrCategory: sale.category || '',
                    price: sale.current_price || 0,
                    net_issued: validTicketCounts[saleKey] || 0
                });
            }
        });

        // ==========================================
        // 5. CLASSIFY & FILTER
        // ==========================================
        let processed = items.filter(item => {
            let nameLower = item.originalName.toLowerCase();
            let isCoatCheck = nameLower.includes('vestiare') || nameLower.includes('vestiaire') || nameLower.includes('coat check');
            let isUpgrade = nameLower.includes('upgrade');
            
            if (isCoatCheck || isUpgrade) return false;
            return true;
        }).map(item => {
            let nameLower = item.originalName.toLowerCase();

            let isSideStage = nameLower.includes('side stage') || nameLower.includes('side-stage');
            let isVIP = nameLower.includes('vip') || nameLower.includes('line-bypass') || nameLower.includes('line bypass');
            let isTable = nameLower.includes('table');
            
            let mainCategory = 'GA';
            if (isSideStage) mainCategory = 'VIP Side Stage';
            else if (isVIP) mainCategory = 'VIP';
            if (isTable) mainCategory = 'Tables';

            let isPack = nameLower.match(/4\s*(x|entries|pack|entrées|entrees)/i) || nameLower.includes('forfait');
            let isPresale = nameLower.includes('presale') || nameLower.includes('prévente') || nameLower.includes('prevente') || nameLower.includes('pre-sale') || nameLower.includes('early bird');
            
            let isComp = nameLower.includes('comp');
            let isPhysical = nameLower.includes('billet physique') || nameLower.includes('physical');

            let ticketName = 'Sale - General Admission';
            
            if (mainCategory === 'GA') {
                if (isPresale) ticketName = 'Presale - GA';
                else if (isPack) ticketName = 'Sale - GA 4x';
                else ticketName = 'Sale - General Admission';
            } else if (mainCategory === 'VIP') {
                if (isPresale) ticketName = 'Presale - VIP';
                else if (isPack) ticketName = 'Sale - VIP 4x';
                else ticketName = 'Sale - VIP';
            } else if (mainCategory === 'VIP Side Stage') {
                if (isPresale) ticketName = 'Presale - VIP Side Stage';
                else if (isPack) ticketName = 'Sale - VIP Side Stage 4x';
                else ticketName = 'Sale - VIP Side Stage';
            } else {
                ticketName = item.originalName.split(' - ')[0] || item.originalName;
            }

            if (isComp) ticketName = `COMP - ${ticketName}`;
            else if (isPhysical) ticketName = `Physical - ${ticketName}`;

            return { ...item, mainCategory, ticketName };
        });

        // 6. Sort logic
        const catWeight: Record<string, number> = { 'GA': 1, 'VIP': 2, 'VIP Side Stage': 3, 'Tables': 4, 'Other': 5 };
        
        processed.sort((a, b) => {
            let weightA = catWeight[a.mainCategory] || 99;
            let weightB = catWeight[b.mainCategory] || 99;
            if (weightA !== weightB) return weightA - weightB;

            if (a.ticketName.includes('Presale') && !b.ticketName.includes('Presale')) return -1;
            if (!a.ticketName.includes('Presale') && b.ticketName.includes('Presale')) return 1;

            if (a.ticketName < b.ticketName) return -1;
            if (a.ticketName > b.ticketName) return 1;

            return (a.price || 0) - (b.price || 0);
        });

        // 7. Assign Sequential Tiers (Hidden applies to $0 OR 0 tickets sold)
        let currentGroup = '';
        let currentPrice = -1;
        let tierCounter = 0;

        const finalResults = processed.map(item => {
            const isHidden = item.price === 0 || item.net_issued === 0;

            if (isHidden) {
                return {
                    id: crypto.randomUUID(),
                    originalName: item.originalName,
                    ticket: item.originalName,
                    category: item.mainCategory,
                    tier: '',
                    price: item.price,
                    sold: item.net_issued,
                    isHidden: true,
                    selected: false
                };
            }

            let groupKey = `${item.mainCategory}-${item.ticketName}`;
            
            if (groupKey !== currentGroup) {
                currentGroup = groupKey;
                currentPrice = item.price;
                tierCounter = 1;
            } else if (item.price > currentPrice) {
                tierCounter++;
                currentPrice = item.price;
            }

            return {
                id: crypto.randomUUID(),
                originalName: item.originalName,
                ticket: item.ticketName,
                category: item.mainCategory,
                tier: `Tier ${tierCounter}`,
                price: item.price,
                sold: item.net_issued,
                isHidden: false,
                selected: true 
            };
        });

        return json({ success: true, tickets: finalResults });

    } catch (err: any) {
        console.error("TIXR FETCH ERROR:", err);
        return json({ error: err.message }, { status: 500 });
    }
}