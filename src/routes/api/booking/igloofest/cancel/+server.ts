import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

let isCancelled = false;

export const POST: RequestHandler = async () => {
    isCancelled = true;
    console.log('🛑 Igloofest scraping cancellation requested');
    return json({
        success: true,
        message: 'Cancellation requested'
    });
};

// Export helper functions to be used by the main scraper
export function _resetCancellation() {
    isCancelled = false;
}

export function _isCancelled() {
    return isCancelled;
}