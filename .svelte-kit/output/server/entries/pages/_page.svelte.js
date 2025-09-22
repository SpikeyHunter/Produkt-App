import { J as copy_payload, K as assign_payload, B as pop, z as push, F as head, M as attr_class, N as attr, G as escape_html, O as stringify } from "../../chunks/index2.js";
import { P as PopupNotification, T as TypebarCredentials } from "../../chunks/PopupNotification.js";
import { B as Button } from "../../chunks/Button.js";
import "@sveltejs/kit/internal";
import "../../chunks/exports.js";
import "../../chunks/utils.js";
import "../../chunks/state.svelte.js";
import "../../chunks/supabase.js";
function _page($$payload, $$props) {
  push();
  let bothFieldsFilled, buttonVariant;
  let username = "";
  let password = "";
  let rememberMe = false;
  let currentYear = (/* @__PURE__ */ new Date()).getFullYear();
  let isLoaded = false;
  let showErrorPopup = false;
  let showSuccessPopup = false;
  let errorMessage = "";
  let successMessage = "";
  let isLoading = false;
  let skipLogoAnimation = false;
  bothFieldsFilled = username.trim() !== "" && password.trim() !== "";
  buttonVariant = bothFieldsFilled ? "filled" : "blocked";
  let $$settled = true;
  let $$inner_payload;
  function $$render_inner($$payload2) {
    head($$payload2, ($$payload3) => {
      $$payload3.title = `<title>Login – Produkt App</title>`;
    });
    $$payload2.out.push(`<div class="min-h-screen bg-white flex flex-col">`);
    PopupNotification($$payload2, {
      message: errorMessage,
      variant: "white",
      iconType: "error",
      get show() {
        return showErrorPopup;
      },
      set show($$value) {
        showErrorPopup = $$value;
        $$settled = false;
      }
    });
    $$payload2.out.push(`<!----> `);
    PopupNotification($$payload2, {
      message: successMessage,
      variant: "white",
      iconType: "login",
      get show() {
        return showSuccessPopup;
      },
      set show($$value) {
        showSuccessPopup = $$value;
        $$settled = false;
      }
    });
    $$payload2.out.push(`<!----> <header${attr_class("svelte-1rk3tg1", void 0, {
      "p-4": true,
      "header-fade": !skipLogoAnimation,
      "no-animation": skipLogoAnimation,
      "loaded": isLoaded
    })}><div class="flex items-center"><img src="/images/ProduktXX_LOGO2.png" alt="ProduktXX" class="h-6"/></div></header> <div class="flex-1 flex items-center justify-center px-4"><div class="w-full max-w-lg"><div${attr_class(`bg-white rounded-2xl p-8 shadow-lg fade-in ${stringify("")}`, "svelte-1rk3tg1")}><div class="text-center space-y-1 mb-6"><h1 class="text-3xl font-bold text-gray1">Produkt App</h1> <p class="text-gray2 text-sm">Enter your login credentials</p></div> <form><div class="space-y-3">`);
    TypebarCredentials($$payload2, {
      variant: "username",
      label: "Email",
      placeholder: "enter your email",
      get value() {
        return username;
      },
      set value($$value) {
        username = $$value;
        $$settled = false;
      }
    });
    $$payload2.out.push(`<!----> `);
    TypebarCredentials($$payload2, {
      variant: "password",
      label: "Password",
      placeholder: "enter your password",
      get value() {
        return password;
      },
      set value($$value) {
        password = $$value;
        $$settled = false;
      }
    });
    $$payload2.out.push(`<!----> <div class="flex items-center justify-between pt-2"><label class="flex items-center cursor-pointer"><input type="checkbox"${attr("checked", rememberMe, true)} class="custom-checkbox w-4 h-4 border-2 border-gray2 rounded focus:ring-lime focus:ring-1 focus:outline-none"/> <span class="ml-2 text-gray1 font-bold text-sm">Remember username</span></label> <button type="button" class="text-gray1 font-bold text-sm hover:text-lime transition-colors duration-200 underline cursor-pointer">Forgot Password?</button></div> <div class="pt-4 flex justify-center">`);
    Button($$payload2, {
      variant: buttonVariant,
      width: "w-1/2 mb-0",
      type: "submit",
      disabled: isLoading,
      children: ($$payload3) => {
        $$payload3.out.push(`<!---->${escape_html("Login")}`);
      },
      $$slots: { default: true }
    });
    $$payload2.out.push(`<!----></div> <div class="text-center pt-2"><button type="button" class="text-gray1 font-bold text-sm hover:text-lime transition-colors duration-200 cursor-pointer">Need to register?</button></div></div></form></div></div></div> <footer${attr_class(`p-4 footer-fade ${stringify("")}`, "svelte-1rk3tg1")}><p class="text-gray2 text-xs">Copyright©${escape_html(currentYear)} Produkt</p></footer></div>`);
  }
  do {
    $$settled = true;
    $$inner_payload = copy_payload($$payload);
    $$render_inner($$inner_payload);
  } while (!$$settled);
  assign_payload($$payload, $$inner_payload);
  pop();
}
export {
  _page as default
};
