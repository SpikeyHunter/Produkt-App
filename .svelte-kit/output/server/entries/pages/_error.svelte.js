import { E as store_get, F as head, G as escape_html, I as unsubscribe_stores, B as pop, z as push } from "../../chunks/index2.js";
import { p as page } from "../../chunks/stores.js";
import "@sveltejs/kit/internal";
import "../../chunks/exports.js";
import "../../chunks/utils.js";
import "clsx";
import "../../chunks/state.svelte.js";
function _error($$payload, $$props) {
  push();
  var $$store_subs;
  let error, status;
  function getErrorTitle(status2) {
    switch (status2) {
      case 400:
        return "Bad Request";
      case 401:
        return "Unauthorized";
      case 403:
        return "Forbidden";
      case 404:
        return "Page Not Found";
      case 500:
        return "Internal Server Error";
      case 502:
        return "Bad Gateway";
      case 503:
        return "Service Unavailable";
      default:
        return "Error Occurred";
    }
  }
  function getErrorDescription(status2) {
    switch (status2) {
      case 400:
        return "The request was invalid or cannot be served.";
      case 401:
        return "You need to be authenticated to access this resource.";
      case 403:
        return "You don't have permission to access this resource.";
      case 404:
        return "The page you're looking for doesn't exist.";
      case 500:
        return "Something went wrong on our end. Please try again later.";
      case 502:
        return "The server received an invalid response from upstream.";
      case 503:
        return "The service is temporarily unavailable. Please try again later.";
      default:
        return error?.message || "An unexpected error occurred.";
    }
  }
  error = store_get($$store_subs ??= {}, "$page", page).error;
  status = store_get($$store_subs ??= {}, "$page", page).status;
  head($$payload, ($$payload2) => {
    $$payload2.title = `<title>Error ${escape_html(status)} – Produkt App</title>`;
  });
  $$payload.out.push(`<div class="min-h-screen bg-gray1 flex items-center justify-center p-6 svelte-rkbo5q"><div class="text-center max-w-lg w-full svelte-rkbo5q"><div class="mb-8 fade-in-up svelte-rkbo5q"><div class="text-[8rem] text-lime subtle-glow mb-6 leading-none fade-in-up svelte-rkbo5q">: (</div> <h1 class="text-6xl font-bold text-lime mb-2 fade-in-up svelte-rkbo5q">${escape_html(status)}</h1> <h2 class="text-3xl font-bold text-white mb-4 fade-in-up svelte-rkbo5q">${escape_html(getErrorTitle(status))}</h2> <p class="text-gray3 text-lg leading-relaxed fade-in-up svelte-rkbo5q">${escape_html(getErrorDescription(status))}</p></div> <div class="flex flex-col sm:flex-row gap-4 justify-center fade-in-up svelte-rkbo5q"><button class="button-hover bg-transparent border-2 border-lime text-lime px-8 py-4 rounded-2xl font-bold text-lg hover:bg-lime hover:text-black transition-all duration-300 flex items-center justify-center gap-2 svelte-rkbo5q"><svg class="w-5 h-5 svelte-rkbo5q" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" class="svelte-rkbo5q"></path></svg> Go Back</button> <button class="button-hover bg-lime text-black px-8 py-4 rounded-2xl font-bold text-lg hover:bg-opacity-90 transition-all duration-300 flex items-center justify-center gap-2 svelte-rkbo5q"><svg class="w-5 h-5 svelte-rkbo5q" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" class="svelte-rkbo5q"></path></svg> Go Home</button></div></div></div>`);
  if ($$store_subs) unsubscribe_stores($$store_subs);
  pop();
}
export {
  _error as default
};
