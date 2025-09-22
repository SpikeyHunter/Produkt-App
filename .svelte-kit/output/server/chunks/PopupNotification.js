import { z as push, P as fallback, N as attr, G as escape_html, M as attr_class, S as clsx, Q as bind_props, B as pop, O as stringify } from "./index2.js";
import { o as onDestroy } from "./PopupNotification.svelte_svelte_type_style_lang.js";
function TypebarCredentials($$payload, $$props) {
  push();
  let inputType, classes;
  let variant = fallback($$props["variant"], "username");
  let placeholder = fallback($$props["placeholder"], "");
  let value = fallback($$props["value"], "");
  let label = fallback($$props["label"], "");
  let width = fallback($$props["width"], "w-full");
  let height = fallback($$props["height"], "py-3");
  let disabled = fallback($$props["disabled"], false);
  let inputId = `input-${Math.random().toString(36).substr(2, 9)}`;
  inputType = variant === "password" && true ? "password" : "text";
  classes = [
    `px-6 ${height} border-2 rounded-full transition-all duration-200 font-bold pr-12`,
    variant === "clear-lime" ? "border-lime text-lime placeholder-gray2 bg-transparent" : "border-gray2 text-black placeholder-gray2 bg-white ",
    width,
    disabled && "opacity-50 cursor-not-allowed bg-gray3"
  ].filter(Boolean).join(" ");
  $$payload.out.push(`<div class="space-y-2">`);
  if (label) {
    $$payload.out.push("<!--[-->");
    $$payload.out.push(`<label${attr("for", inputId)} class="block text-gray1 font-medium text-lg">${escape_html(label)}</label>`);
  } else {
    $$payload.out.push("<!--[!-->");
  }
  $$payload.out.push(`<!--]--> <div class="relative"><input${attr("id", inputId)}${attr("type", inputType)}${attr("placeholder", placeholder)}${attr("value", value)}${attr_class(clsx(classes))}${attr("disabled", disabled, true)}/> `);
  if (variant === "password") {
    $$payload.out.push("<!--[-->");
    $$payload.out.push(`<button type="button" class="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray2 hover:text-gray1 transition-colors duration-200">`);
    {
      $$payload.out.push("<!--[!-->");
      $$payload.out.push(`<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clip-rule="evenodd"></path><path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z"></path></svg>`);
    }
    $$payload.out.push(`<!--]--></button>`);
  } else {
    $$payload.out.push("<!--[!-->");
  }
  $$payload.out.push(`<!--]--></div></div>`);
  bind_props($$props, { variant, placeholder, value, label, width, height, disabled });
  pop();
}
function PopupNotification($$payload, $$props) {
  push();
  let notificationClasses;
  let message = fallback($$props["message"], "");
  let show = fallback($$props["show"], false);
  let duration = fallback($$props["duration"], 3e3);
  let variant = fallback($$props["variant"], "white");
  let iconType = fallback($$props["iconType"], "success");
  let timeoutId;
  let isLeaving = false;
  const typeStyles = {
    success: { text: "text-lime", bg: "bg-lime", border: "border-lime" },
    login: { text: "text-black", bg: "bg-lime", border: "border-lime" },
    error: {
      text: "text-problem",
      bg: "bg-problem",
      border: "border-problem"
    },
    warning: {
      text: "text-tentatif",
      bg: "bg-tentatif",
      border: "border-tentatif"
    },
    info: { text: "text-info", bg: "bg-info", border: "border-info" },
    question: {
      text: "text-question",
      bg: "bg-question",
      border: "border-question"
    }
  };
  function getNotificationClasses(variant2, iconType2) {
    const baseBgClass = {
      navbar: "bg-navbar",
      gray1: "bg-gray1",
      white: "bg-transparent",
      lime: "bg-lime"
    }[variant2];
    const styles = typeStyles[iconType2];
    return {
      container: `${baseBgClass} ${styles.border}`,
      icon: styles.bg,
      text: styles.text
    };
  }
  function startLeaving() {
    isLeaving = true;
    setTimeout(
      () => {
        show = false;
        isLeaving = false;
      },
      300
    );
  }
  onDestroy(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
  notificationClasses = getNotificationClasses(variant, iconType);
  if (show && duration > 0) {
    if (timeoutId) clearTimeout(timeoutId);
    isLeaving = false;
    timeoutId = setTimeout(
      () => {
        startLeaving();
      },
      duration
    );
  }
  if (show) {
    $$payload.out.push("<!--[-->");
    $$payload.out.push(`<div${attr_class(`popup-notification ${stringify(isLeaving ? "slide-out" : "slide-in")}`, "svelte-c2txk2")}><div${attr_class(`${stringify(notificationClasses.container)} rounded-lg px-3 py-2 shadow-lg flex items-center border`, "svelte-c2txk2")}><div${attr_class(`${stringify(notificationClasses.icon)} rounded p-2 mr-3 flex-shrink-0`, "svelte-c2txk2")}>`);
    if (iconType === "success") {
      $$payload.out.push("<!--[-->");
      $$payload.out.push(`<svg class="w-3 h-3 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"></path></svg>`);
    } else {
      $$payload.out.push("<!--[!-->");
      if (iconType === "login") {
        $$payload.out.push("<!--[-->");
        $$payload.out.push(`<svg class="w-3 h-3 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"></path></svg>`);
      } else {
        $$payload.out.push("<!--[!-->");
        if (iconType === "error") {
          $$payload.out.push("<!--[-->");
          $$payload.out.push(`<svg class="w-3 h-3 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"></path></svg>`);
        } else {
          $$payload.out.push("<!--[!-->");
          if (iconType === "warning") {
            $$payload.out.push("<!--[-->");
            $$payload.out.push(`<svg class="w-3 h-3 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"></path></svg>`);
          } else {
            $$payload.out.push("<!--[!-->");
            if (iconType === "info") {
              $$payload.out.push("<!--[-->");
              $$payload.out.push(`<svg class="w-3 h-3 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"></path></svg>`);
            } else {
              $$payload.out.push("<!--[!-->");
              if (iconType === "question") {
                $$payload.out.push("<!--[-->");
                $$payload.out.push(`<svg class="w-3 h-3 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008Z"></path></svg>`);
              } else {
                $$payload.out.push("<!--[!-->");
              }
              $$payload.out.push(`<!--]-->`);
            }
            $$payload.out.push(`<!--]-->`);
          }
          $$payload.out.push(`<!--]-->`);
        }
        $$payload.out.push(`<!--]-->`);
      }
      $$payload.out.push(`<!--]-->`);
    }
    $$payload.out.push(`<!--]--></div> <div class="flex-1"><p${attr_class(`${stringify(notificationClasses.text)} font-bold text-sm`, "svelte-c2txk2")}>${escape_html(message)}</p></div></div></div>`);
  } else {
    $$payload.out.push("<!--[!-->");
  }
  $$payload.out.push(`<!--]-->`);
  bind_props($$props, { message, show, duration, variant, iconType });
  pop();
}
export {
  PopupNotification as P,
  TypebarCredentials as T
};
