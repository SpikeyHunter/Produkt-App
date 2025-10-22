// src/routes/api/booking/piknic/cancel/+server.ts

import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';

let isCancelled = false;

export const POST: RequestHandler = async () => {
  isCancelled = true;
  console.log('🛑 Scraping cancellation requested');
  
  return json({ 
    success: true, 
    message: 'Cancellation requested' 
  });
};

export const GET: RequestHandler = async () => {
  return json({ isCancelled });
};