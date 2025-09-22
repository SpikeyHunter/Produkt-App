import { J as copy_payload, K as assign_payload, B as pop, z as push, F as head, M as attr_class, G as escape_html, O as stringify } from "../../../../chunks/index2.js";
import { P as PopupNotification, T as TypebarCredentials } from "../../../../chunks/PopupNotification.js";
import { B as Button } from "../../../../chunks/Button.js";
import "@sveltejs/kit/internal";
import "../../../../chunks/exports.js";
import "../../../../chunks/utils.js";
import "clsx";
import "../../../../chunks/state.svelte.js";
function _page($$payload, $$props) {
  push();
  let isFormValid;
  let password = "";
  let confirmPassword = "";
  let currentYear = (/* @__PURE__ */ new Date()).getFullYear();
  let isSubmitting = false;
  let showPopup = false;
  let popupMessage = "";
  isFormValid = password.trim() && confirmPassword.trim();
  let $$settled = true;
  let $$inner_payload;
  function $$render_inner($$payload2) {
    head($$payload2, ($$payload3) => {
      $$payload3.title = `<title>Reset Password – Produkt App</title>`;
    });
    $$payload2.out.push(`<div class="min-h-screen bg-white flex flex-col">`);
    PopupNotification($$payload2, {
      message: popupMessage,
      variant: "white",
      iconType: "login",
      get show() {
        return showPopup;
      },
      set show($$value) {
        showPopup = $$value;
        $$settled = false;
      }
    });
    $$payload2.out.push(`<!----> <header class="p-4 header-fade svelte-1ls77ga"><div class="flex items-center"><img src="/images/ProduktXX_LOGO2.png" alt="ProduktXX" class="h-6"/></div></header> <div class="flex-1 flex items-center justify-center px-4"><div class="w-full max-w-xl"><div${attr_class(`bg-white rounded-2xl p-6 shadow-lg fade-in ${stringify("")}`, "svelte-1ls77ga")}><div class="text-center space-y-1 mb-6"><h1 class="text-3xl font-bold text-gray1">Reset Password</h1> <p class="text-gray2 text-sm">Enter your new password</p></div> <div class="space-y-4">`);
    TypebarCredentials($$payload2, {
      variant: "password",
      label: "New Password",
      placeholder: "enter your new password",
      get value() {
        return password;
      },
      set value($$value) {
        password = $$value;
        $$settled = false;
      }
    });
    $$payload2.out.push(`<!----> `);
    TypebarCredentials($$payload2, {
      variant: "password",
      label: "Confirm New Password",
      placeholder: "confirm your new password",
      get value() {
        return confirmPassword;
      },
      set value($$value) {
        confirmPassword = $$value;
        $$settled = false;
      }
    });
    $$payload2.out.push(`<!----> <div class="pt-2 flex justify-center">`);
    Button($$payload2, {
      variant: !isFormValid ? "blocked" : "filled",
      width: "w-2/3 mb-0",
      type: "submit",
      disabled: !isFormValid || isSubmitting,
      children: ($$payload3) => {
        $$payload3.out.push(`<!---->${escape_html("Update Password")}`);
      },
      $$slots: { default: true }
    });
    $$payload2.out.push(`<!----></div> <div class="text-center pt-1"><button type="button" class="text-gray1 font-bold text-sm hover:text-lime transition-colors duration-200 cursor-pointer">Go Back to Login</button></div></div></div></div></div> <footer${attr_class(`p-4 footer-fade ${stringify("")}`, "svelte-1ls77ga")}><p class="text-gray2 text-xs">Copyright©${escape_html(currentYear)} Produkt</p></footer></div>`);
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
