export type TicketItem = {
    id: string;
    ticket: string;
    category: string;
    tier: string;
    price: number;
    sold: number;
    scanned: number;
};

export const BOX_OFFICE_CATEGORIES = ['online', 'door', 'table_tickets', 'comp', 'other'] as const;
export type BoxOfficeCategory = typeof BOX_OFFICE_CATEGORIES[number];

export const DEFAULT_TICKETS: Record<BoxOfficeCategory, TicketItem[]> = {
    online: [], // Reserved for Tixr API
    door: [
        { id: 'd1', ticket: 'Door Sale - GA', category: 'GA', tier: 'Tier 1', price: 40, sold: 0, scanned: 0 },
        { id: 'd2', ticket: 'Door Sale - VIP', category: 'VIP', tier: 'Tier 1', price: 60, sold: 0, scanned: 0 }
    ],
    table_tickets: [
        { id: 't1', ticket: 'Table Service Base', category: 'TABLE', tier: 'Base', price: 0, sold: 0, scanned: 0 }
    ],
    comp: [
        { id: 'c1', ticket: 'Guestlist - Artist', category: 'COMP', tier: 'GL', price: 0, sold: 0, scanned: 0 },
        { id: 'c2', ticket: 'Guestlist - Staff', category: 'COMP', tier: 'GL', price: 0, sold: 0, scanned: 0 }
    ],
    other: []
};

export const COMPLETED_BY_NAMES = ['Gabriel', 'Yas', 'Charles', 'Mezz', 'Willis'];