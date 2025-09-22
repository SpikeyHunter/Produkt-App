import { E as store_get, F as head, I as unsubscribe_stores, B as pop, z as push, G as escape_html, M as attr_class, O as stringify } from "../../../../../chunks/index2.js";
import { p as page } from "../../../../../chunks/stores.js";
import "@sveltejs/kit/internal";
import "../../../../../chunks/exports.js";
import "../../../../../chunks/utils.js";
import "clsx";
import "../../../../../chunks/state.svelte.js";
import { M as MainLayout } from "../../../../../chunks/Modal.svelte_svelte_type_style_lang.js";
import "../../../../../chunks/supabase.js";
import { B as Button } from "../../../../../chunks/Button.js";
/* empty css                                                                */
function _page($$payload, $$props) {
  push();
  var $$store_subs;
  store_get($$store_subs ??= {}, "$page", page).params.event_param;
  head($$payload, ($$payload2) => {
    $$payload2.title = `<title>${escape_html("Event Details")}</title>`;
  });
  MainLayout($$payload, {
    pageTitle: "Advance Details",
    children: ($$payload2) => {
      $$payload2.out.push(`<div class="h-full overflow-y-auto overflow-x-hidden"><div class="page-container svelte-o8jd7d"><div${attr_class(`fade-in ${stringify("")} mb-4`, "svelte-o8jd7d")} style="transition-delay: 0.1s;">`);
      Button($$payload2, {
        variant: "gray",
        children: ($$payload3) => {
          $$payload3.out.push(`<span class="flex items-center gap-2"><svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5"></path><path d="M12 19l-7-7 7-7"></path></svg> Go Back</span>`);
        },
        $$slots: { default: true }
      });
      $$payload2.out.push(`<!----></div> `);
      {
        $$payload2.out.push("<!--[-->");
        $$payload2.out.push(`<div class="flex flex-col items-center justify-center py-16 text-center"><div class="w-8 h-8 mb-4 animate-spin"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-lime"><path d="M21 12a9 9 0 11-6.219-8.56"></path></svg></div> <p class="text-gray2 text-base">Loading event details...</p></div>`);
      }
      $$payload2.out.push(`<!--]--></div></div>`);
    },
    $$slots: { default: true }
  });
  if ($$store_subs) unsubscribe_stores($$store_subs);
  pop();
}
export {
  _page as default
};
