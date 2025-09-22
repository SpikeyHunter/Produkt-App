import { z as push, P as fallback, M as attr_class, N as attr, G as escape_html, D as slot, Q as bind_props, B as pop, O as stringify } from "./index2.js";
import "./Modal.svelte_svelte_type_style_lang.js";
function Modal($$payload, $$props) {
  push();
  let isOpen = fallback($$props["isOpen"], false);
  let title = fallback($$props["title"], "");
  let maxWidth = fallback(
    $$props["maxWidth"],
    "max-w-lg"
    // 'max-w-sm', 'max-w-md', 'max-w-lg', 'max-w-xl', 'max-w-2xl', etc.
  );
  let showHeader = fallback($$props["showHeader"], true);
  let showCloseButton = fallback($$props["showCloseButton"], true);
  let closeOnBackdropClick = fallback($$props["closeOnBackdropClick"], true);
  let hasFooter = fallback(
    $$props["hasFooter"],
    false
    // New prop to control footer visibility
  );
  if (isOpen) {
    $$payload.out.push("<!--[-->");
    $$payload.out.push(`<div${attr_class(`modal-backdrop ${stringify("backdrop-enter")} flex items-center justify-center p-4 overflow-y-auto`, "svelte-1v7x1qh")} role="dialog" aria-modal="true"${attr("aria-labelledby", title ? "modal-title" : void 0)} tabindex="-1"><div${attr_class(`bg-navbar rounded-2xl shadow-2xl ${stringify(maxWidth)} w-full flex flex-col ${stringify("modal-enter")} border border-gray1 my-auto`, "svelte-1v7x1qh")}>`);
    if (showHeader && (title || showCloseButton)) {
      $$payload.out.push("<!--[-->");
      $$payload.out.push(`<div class="flex items-center justify-between p-6 border-b border-gray1 flex-shrink-0">`);
      if (title) {
        $$payload.out.push("<!--[-->");
        $$payload.out.push(`<h2 id="modal-title" class="text-xl font-bold text-white">${escape_html(title)}</h2>`);
      } else {
        $$payload.out.push("<!--[!-->");
        $$payload.out.push(`<div></div>`);
      }
      $$payload.out.push(`<!--]--> `);
      if (showCloseButton) {
        $$payload.out.push("<!--[-->");
        $$payload.out.push(`<button class="p-2 text-gray2 hover:text-white hover:bg-gray1 rounded-lg transition-colors cursor-pointer" aria-label="Close modal"><svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>`);
      } else {
        $$payload.out.push("<!--[!-->");
      }
      $$payload.out.push(`<!--]--></div>`);
    } else {
      $$payload.out.push("<!--[!-->");
    }
    $$payload.out.push(`<!--]--> <div class="p-6"><!---->`);
    slot($$payload, $$props, "default", {});
    $$payload.out.push(`<!----></div> `);
    if (hasFooter) {
      $$payload.out.push("<!--[-->");
      $$payload.out.push(`<div class="px-6 pb-6 border-t border-gray1 pt-4"><!---->`);
      slot($$payload, $$props, "footer", {});
      $$payload.out.push(`<!----></div>`);
    } else {
      $$payload.out.push("<!--[!-->");
    }
    $$payload.out.push(`<!--]--></div></div>`);
  } else {
    $$payload.out.push("<!--[!-->");
  }
  $$payload.out.push(`<!--]-->`);
  bind_props($$props, {
    isOpen,
    title,
    maxWidth,
    showHeader,
    showCloseButton,
    closeOnBackdropClick,
    hasFooter
  });
  pop();
}
export {
  Modal as M
};
