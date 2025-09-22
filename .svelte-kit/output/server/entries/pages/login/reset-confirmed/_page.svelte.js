import { F as head, M as attr_class, G as escape_html, B as pop, z as push, O as stringify } from "../../../../chunks/index2.js";
import { B as Button } from "../../../../chunks/Button.js";
import "@sveltejs/kit/internal";
import "../../../../chunks/exports.js";
import "../../../../chunks/utils.js";
import "clsx";
import "../../../../chunks/state.svelte.js";
function _page($$payload, $$props) {
  push();
  let currentYear = (/* @__PURE__ */ new Date()).getFullYear();
  let countdown = 5;
  head($$payload, ($$payload2) => {
    $$payload2.title = `<title>Password Reset Confirmed – Produkt App</title>`;
  });
  $$payload.out.push(`<div class="min-h-screen bg-white flex flex-col svelte-ud153a"><header class="p-4 header-fade svelte-ud153a"><div class="flex items-center svelte-ud153a"><img src="/images/ProduktXX_LOGO2.png" alt="ProduktXX" class="h-6 svelte-ud153a"/></div></header> <div class="flex-1 flex items-center justify-center px-4 svelte-ud153a"><div class="w-full max-w-xl svelte-ud153a"><div${attr_class(`bg-white rounded-2xl p-8 shadow-lg fade-in ${stringify("")}`, "svelte-ud153a")}><div class="success-icon svelte-ud153a"><svg class="checkmark svelte-ud153a" viewBox="0 0 52 52"><path d="M14 27l8 8 16-16" class="svelte-ud153a"></path></svg></div> <div class="text-center space-y-4 mb-6 svelte-ud153a"><h1 class="text-3xl font-bold text-gray1 svelte-ud153a">Password Reset Successful!</h1> <p class="text-gray2 text-base svelte-ud153a">Your password has been updated successfully. You can now log in with your new password.</p> <p class="text-gray2 text-sm svelte-ud153a">Redirecting to login in <span class="font-bold text-lime svelte-ud153a">${escape_html(countdown)}</span> seconds...</p></div> <div class="space-y-4 svelte-ud153a"><div class="flex justify-center svelte-ud153a">`);
  Button($$payload, {
    variant: "filled",
    width: "w-2/3 mb-0",
    children: ($$payload2) => {
      $$payload2.out.push(`<!---->Go to Login Now`);
    },
    $$slots: { default: true }
  });
  $$payload.out.push(`<!----></div></div></div></div></div> <footer${attr_class(`p-4 footer-fade ${stringify("")}`, "svelte-ud153a")}><p class="text-gray2 text-xs svelte-ud153a">Copyright©${escape_html(currentYear)} Produkt</p></footer></div>`);
  pop();
}
export {
  _page as default
};
