import "@sveltejs/kit";
const handle = async ({ event, resolve }) => {
  const { url } = event;
  const pathname = url.pathname;
  if (pathname.startsWith("/api/")) {
    return resolve(event);
  }
  return resolve(event);
};
export {
  handle
};
