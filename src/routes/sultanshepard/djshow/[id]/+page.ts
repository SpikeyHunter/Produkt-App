import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params }) => {
    return {
        show_id: params.id
    };
};