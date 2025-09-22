import { D as slot, B as pop, z as push } from "../../chunks/index2.js";
import "@sveltejs/kit/internal";
import "../../chunks/exports.js";
import "../../chunks/utils.js";
import "clsx";
import "../../chunks/state.svelte.js";
import "../../chunks/supabase.js";
function _layout($$payload, $$props) {
  push();
  $$payload.out.push(`<!---->`);
  slot($$payload, $$props, "default", {});
  $$payload.out.push(`<!---->`);
  pop();
}
export {
  _layout as default
};
