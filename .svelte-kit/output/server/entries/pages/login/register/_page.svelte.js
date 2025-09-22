import { J as copy_payload, K as assign_payload, B as pop, z as push, F as head, M as attr_class, R as ensure_array_like, G as escape_html, O as stringify } from "../../../../chunks/index2.js";
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
  let firstName = "";
  let lastName = "";
  let email = "";
  let password = "";
  let confirmPassword = "";
  let registrationCode = "";
  let currentYear = (/* @__PURE__ */ new Date()).getFullYear();
  let errors = [];
  let isSubmitting = false;
  let showErrorPopup = false;
  let errorMessage = "";
  isFormValid = firstName.trim() && lastName.trim() && email.trim() && password.trim() && confirmPassword.trim() && registrationCode.trim();
  let $$settled = true;
  let $$inner_payload;
  function $$render_inner($$payload2) {
    head($$payload2, ($$payload3) => {
      $$payload3.title = `<title>Register – Produkt App</title>`;
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
    $$payload2.out.push(`<!----> <header class="p-4 header-fade svelte-6oieha"><div class="flex items-center"><img src="/images/ProduktXX_LOGO2.png" alt="ProduktXX" class="h-6"/></div></header> <div class="flex-1 flex items-center justify-center px-4"><div class="w-full max-w-xl"><div${attr_class(`bg-white rounded-2xl p-6 shadow-lg fade-in ${stringify("")}`, "svelte-6oieha")}><div class="text-center space-y-1 mb-4"><h1 class="text-3xl font-bold text-gray1">Produkt App</h1> <p class="text-gray2 text-sm">Register your account</p></div> `);
    if (errors.length > 0) {
      $$payload2.out.push("<!--[-->");
      const each_array = ensure_array_like(errors);
      $$payload2.out.push(`<div class="mb-4"><!--[-->`);
      for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
        let error = each_array[$$index];
        $$payload2.out.push(`<div class="error-popup svelte-6oieha">${escape_html(error)}</div>`);
      }
      $$payload2.out.push(`<!--]--></div>`);
    } else {
      $$payload2.out.push("<!--[!-->");
    }
    $$payload2.out.push(`<!--]--> <div class="space-y-2"><div class="grid grid-cols-2 gap-4">`);
    TypebarCredentials($$payload2, {
      variant: "text",
      label: "First Name",
      placeholder: "enter your first name",
      get value() {
        return firstName;
      },
      set value($$value) {
        firstName = $$value;
        $$settled = false;
      }
    });
    $$payload2.out.push(`<!----> `);
    TypebarCredentials($$payload2, {
      variant: "text",
      label: "Last Name",
      placeholder: "enter your last name",
      get value() {
        return lastName;
      },
      set value($$value) {
        lastName = $$value;
        $$settled = false;
      }
    });
    $$payload2.out.push(`<!----></div> `);
    TypebarCredentials($$payload2, {
      variant: "username",
      label: "Email",
      placeholder: "enter your email",
      get value() {
        return email;
      },
      set value($$value) {
        email = $$value;
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
    $$payload2.out.push(`<!----> `);
    TypebarCredentials($$payload2, {
      variant: "password",
      label: "Confirm Password",
      placeholder: "confirm your password",
      get value() {
        return confirmPassword;
      },
      set value($$value) {
        confirmPassword = $$value;
        $$settled = false;
      }
    });
    $$payload2.out.push(`<!----> `);
    TypebarCredentials($$payload2, {
      variant: "text",
      label: "Registration Code",
      placeholder: "enter your registration code",
      get value() {
        return registrationCode;
      },
      set value($$value) {
        registrationCode = $$value;
        $$settled = false;
      }
    });
    $$payload2.out.push(`<!----> <div class="pt-2 flex justify-center">`);
    Button($$payload2, {
      variant: !isFormValid ? "blocked" : "filled",
      width: "w-1/2 mb-0",
      type: "submit",
      disabled: !isFormValid || isSubmitting,
      children: ($$payload3) => {
        $$payload3.out.push(`<!---->${escape_html("Register")}`);
      },
      $$slots: { default: true }
    });
    $$payload2.out.push(`<!----></div> <div class="text-center pt-1"><button type="button" class="text-gray1 font-bold text-sm hover:text-lime transition-colors duration-200 cursor-pointer">Go Back to Login</button></div></div></div></div></div> <footer${attr_class(`p-4 footer-fade ${stringify("")}`, "svelte-6oieha")}><p class="text-gray2 text-xs">Copyright©${escape_html(currentYear)} Produkt</p></footer></div>`);
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
