const load = async ({ params }) => {
  return {
    event_param: params.event_param
    // This could be "151459" or "151459-Chase & Status"
  };
};
export {
  load
};
