// @ts-nocheck
import type { PageLoad } from './$types';

export const load = async ({ params }: Parameters<PageLoad>[0]) => {
  return {
    event_param: params.event_param // This could be "151459" or "151459-Chase & Status"
  };
};