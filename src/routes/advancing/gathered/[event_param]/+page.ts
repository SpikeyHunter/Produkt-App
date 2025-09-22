import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params }) => {
  return {
    event_param: params.event_param // This could be "151459" or "151459-Chase & Status"
  };
};