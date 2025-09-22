import { P as fallback, N as attr, M as attr_class, S as clsx, D as slot, Q as bind_props, B as pop, z as push } from "./index2.js";
/* empty css                                     */
function Button($$payload, $$props) {
  push();
  let classes;
  let variant = fallback($$props["variant"], "filled");
  let width = fallback($$props["width"], "w-auto");
  let height = fallback($$props["height"], "h-auto");
  let type = fallback($$props["type"], "button");
  let disabled = fallback($$props["disabled"], false);
  classes = [
    variant === "slim" ? "font-bold text-center rounded-xl px-3 py-1 text-xs transition-all duration-200" : variant === "gray" ? "font-bold text-center rounded-xl px-3 py-1 text-xs transition-all duration-200" : "font-bold text-center rounded-3xl px-6 py-3 transition-all duration-200",
    variant === "filled" && "bg-gray3 text-black hover:bg-lime hover:text-black cursor-pointer",
    variant === "outline" && "bg-transparent border-2 border-lime text-lime hover:bg-lime hover:!text-black cursor-pointer",
    variant === "slim" && "bg-transparent border border-lime text-lime hover:!text-black hover:bg-lime cursor-pointer",
    variant === "gray" && "bg-gray2 text-black hover:bg-lime hover:text-black cursor-pointer",
    variant === "blocked" && "bg-gray3 text-black cursor-not-allowed",
    variant === "loading" && "bg-lime text-black cursor-not-allowed",
    width,
    height,
    // Add height to classes
    disabled && "opacity-50 cursor-not-allowed hover:bg-gray2 hover:text-black"
  ].filter(Boolean).join(" ");
  $$payload.out.push(`<button${attr("type", type)}${attr_class(clsx(classes), "svelte-1f585wl")}${attr("disabled", disabled, true)}>`);
  if (variant === "loading") {
    $$payload.out.push("<!--[-->");
    $$payload.out.push(`<div class="flex items-center justify-center gap-2"><div class="spinner w-4 h-4 border-2 border-black border-t-transparent rounded-full svelte-1f585wl"></div> <!---->`);
    slot($$payload, $$props, "default", {});
    $$payload.out.push(`<!----></div>`);
  } else {
    $$payload.out.push("<!--[!-->");
    $$payload.out.push(`<!---->`);
    slot($$payload, $$props, "default", {});
    $$payload.out.push(`<!---->`);
  }
  $$payload.out.push(`<!--]--></button>`);
  bind_props($$props, { variant, width, height, type, disabled });
  pop();
}
export {
  Button as B
};
