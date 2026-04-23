export type TicketItem = {
    id: string;
    ticket: string;
    category: string;
    tier: string;
    price: number | null;
    sold: number | null;
    scanned: number | null;
    allowPrice?: boolean;
    allowSold?: boolean;
    allowScanned?: boolean;
    allowEntry?: boolean;
};

export const BOX_OFFICE_CATEGORIES = ['online', 'door', 'table_tickets', 'comp', 'other'] as const;
export type BoxOfficeCategory = typeof BOX_OFFICE_CATEGORIES[number];

// 1. Enable/Disable the + Add Item button per section
export const CATEGORY_CONFIG: Record<BoxOfficeCategory, { allowAdd: boolean }> = {
    online: { allowAdd: true },
    door: { allowAdd: true },
    table_tickets: { allowAdd: true },
    comp: { allowAdd: true },
    other: { allowAdd: true }
};

export const DEFAULT_TICKETS: Record<BoxOfficeCategory, TicketItem[]> = {
    online: [], // Reserved for Tixr API
    
    // 2. Control default rows with allowPrice, allowSold, allowScanned, and allowEntry
    door: [
        { id: 'd1', ticket: 'Door - GA', category: '', tier: 'GA', price: 45, sold: null, scanned: null, allowPrice: true, allowSold: true, allowScanned: true, allowEntry: true },
        { id: 'd2', ticket: 'Door - VIP', category: '', tier: 'VIP', price: 75, sold: null, scanned: null, allowPrice: true, allowSold: true, allowScanned: true, allowEntry: true },
        { id: 'd3', ticket: 'Door - VIP Add-on', category: '', tier: 'VIP', price: 31.25, sold: null, scanned: null, allowPrice: true, allowSold: true, allowScanned: true, allowEntry: true }
    ],
    table_tickets: [
        { id: 't1', ticket: 'Table - Prepaid Online', category: '', tier: 'Tables', price: 62.50, sold: null, scanned: null, allowPrice: true, allowSold: true, allowScanned: true, allowEntry: true },
        { id: 't2', ticket: 'Table - Pay at the Door', category: '', tier: 'Tables', price: 37.50, sold: null, scanned: null, allowPrice: true, allowSold: true, allowScanned: true, allowEntry: true }
    ],
    comp: [
        { id: 'c1', ticket: 'Comp - GA', category: '', tier: 'COMP', price: 0, sold: null, scanned: null, allowPrice: false, allowSold: false, allowScanned: true, allowEntry: false },
        { id: 'c2', ticket: 'Comp - VIP', category: '', tier: 'COMP', price: 0, sold: null, scanned: null, allowPrice: false, allowSold: false, allowScanned: true, allowEntry: false },
        { id: 'c3', ticket: 'Comp - Guestlist', category: '', tier: 'GL', price: 0, sold: null, scanned: null, allowPrice: false, allowSold: false, allowScanned: true, allowEntry: false }
    ],
    other: [
        { id: 'o1', ticket: 'Prepaid Coatcheck', category: '', tier: 'Coat Check', price: 5.50, sold: null, scanned: null, allowPrice: true, allowSold: true, allowScanned: true, allowEntry: false },

    ]
};

export const COMPLETED_BY_NAMES = ['Gabriel', 'Yas', 'Charles', 'Mezz', 'Willis'];