import { G as escape_html, B as pop, z as push } from "../../../../chunks/index2.js";
import "clsx";
import "@sveltejs/kit/internal";
import "../../../../chunks/exports.js";
import "../../../../chunks/utils.js";
import "../../../../chunks/state.svelte.js";
import "../../../../chunks/supabase.js";
function _page($$payload, $$props) {
  push();
  let status = "Processing verification...";
  $$payload.out.push(`<div class="min-h-screen bg-white flex flex-col items-center justify-center px-4"><div class="mb-8"><img src="/images/ProduktXX_LOGO2.png" alt="ProduktXX" class="h-8"/></div> <div class="bg-white rounded-2xl p-8 shadow-lg text-center max-w-md w-full"><div class="mb-6">`);
  {
    $$payload.out.push("<!--[-->");
    $$payload.out.push(`<div class="inline-block w-8 h-8 border-4 border-gray2 border-t-lime rounded-full animate-spin svelte-8n7o6"></div>`);
  }
  $$payload.out.push(`<!--]--></div> <h1 class="text-2xl font-bold text-gray1 mb-2">Email Verification</h1> <p class="text-gray2 text-sm leading-relaxed mb-4">${escape_html(status)}</p> `);
  {
    $$payload.out.push("<!--[!-->");
    {
      $$payload.out.push("<!--[!-->");
    }
    $$payload.out.push(`<!--]-->`);
  }
  $$payload.out.push(`<!--]--></div></div>`);
  pop();
}
export {
  _page as default
};
