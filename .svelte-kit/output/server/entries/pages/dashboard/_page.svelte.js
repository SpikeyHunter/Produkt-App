import { E as store_get, J as copy_payload, K as assign_payload, I as unsubscribe_stores, B as pop, z as push, F as head, M as attr_class, G as escape_html, R as ensure_array_like, O as stringify } from "../../../chunks/index2.js";
import { w as writable } from "../../../chunks/index.js";
import { s as supabase } from "../../../chunks/supabase.js";
import { M as MainLayout } from "../../../chunks/Modal.svelte_svelte_type_style_lang.js";
import { P as PopupNotification, T as TypebarCredentials } from "../../../chunks/PopupNotification.js";
import { B as Button } from "../../../chunks/Button.js";
import { M as Modal } from "../../../chunks/Modal.js";
const user = writable(null);
function _page($$payload, $$props) {
  push();
  var $$store_subs;
  let userProfile = null;
  let isLoading = true;
  let showModal = false;
  let teamCode = "";
  let isSubmitting = false;
  let showPopup = false;
  let popupMessage = "";
  async function fetchUserProfile() {
    if (!store_get($$store_subs ??= {}, "$user", user)) {
      isLoading = false;
      return;
    }
    isLoading = true;
    try {
      const { data, error } = await supabase.from("user_profiles").select("first_name, last_name, main_permission, secondary_permission").eq("id", store_get($$store_subs ??= {}, "$user", user).id).single();
      if (error) {
        console.error("Error fetching user profile:", error.message);
        return;
      }
      userProfile = data;
    } catch (error) {
      console.error("Catched error fetching user profile:", error);
    } finally {
      isLoading = false;
    }
  }
  function formatPermissions(main, secondary) {
    if (!main) return null;
    let permissions = [main];
    if (secondary) {
      const secondaryPerms = Array.isArray(secondary) ? secondary : secondary.split(",").map((p) => p.trim());
      permissions = permissions.concat(secondaryPerms);
    }
    return permissions.join(", ");
  }
  if (store_get($$store_subs ??= {}, "$user", user) && !userProfile) {
    fetchUserProfile();
  }
  let $$settled = true;
  let $$inner_payload;
  function $$render_inner($$payload2) {
    head($$payload2, ($$payload3) => {
      $$payload3.title = `<title>Dashboard – Produkt App</title>`;
    });
    MainLayout($$payload2, {
      pageTitle: "Dashboard",
      children: ($$payload3) => {
        PopupNotification($$payload3, {
          message: popupMessage,
          duration: 3e3,
          variant: "navbar",
          get show() {
            return showPopup;
          },
          set show($$value) {
            showPopup = $$value;
            $$settled = false;
          }
        });
        $$payload3.out.push(`<!----> <div class="h-full p-6 overflow-auto"><div class="max-w-7xl mx-auto h-full"><div class="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full"><div class="flex flex-col gap-6"><div${attr_class(`fade-in ${stringify("")}`, "svelte-11245tj")} style="transition-delay: 0.1s;"><div class="bg-navbar rounded-2xl p-6"><div class="space-y-4">`);
        if (store_get($$store_subs ??= {}, "$user", user)) {
          $$payload3.out.push("<!--[-->");
          $$payload3.out.push(`<p class="text-white text-xl font-bold">`);
          if (userProfile?.first_name) {
            $$payload3.out.push("<!--[-->");
            $$payload3.out.push(`Welcome back, <span class="text-lime">${escape_html(userProfile.first_name)}</span>`);
          } else {
            $$payload3.out.push("<!--[!-->");
            if (!isLoading) {
              $$payload3.out.push("<!--[-->");
              $$payload3.out.push(`Welcome back`);
            } else {
              $$payload3.out.push("<!--[!-->");
            }
            $$payload3.out.push(`<!--]-->`);
          }
          $$payload3.out.push(`<!--]--></p> `);
          if (!userProfile?.first_name && !isLoading) {
            $$payload3.out.push("<!--[-->");
            $$payload3.out.push(`<p class="text-white text-base pl-6 font-bold">You're signed in as, <span class="text-gray3">${escape_html(store_get($$store_subs ??= {}, "$user", user).email)}</span></p>`);
          } else {
            $$payload3.out.push("<!--[!-->");
          }
          $$payload3.out.push(`<!--]-->`);
        } else {
          $$payload3.out.push("<!--[!-->");
        }
        $$payload3.out.push(`<!--]--> <div class="pl-7">`);
        if (isLoading) {
          $$payload3.out.push("<!--[-->");
          $$payload3.out.push(`<p class="text-gray2 text-sm">Loading your profile...</p>`);
        } else {
          $$payload3.out.push("<!--[!-->");
          if (userProfile) {
            $$payload3.out.push("<!--[-->");
            if (!userProfile.main_permission) {
              $$payload3.out.push("<!--[-->");
              $$payload3.out.push(`<div class="flex items-center gap-2"><span class="text-white text-sm">You don't have a team yet?</span> `);
              Button($$payload3, {
                variant: "slim",
                width: "w-auto",
                children: ($$payload4) => {
                  $$payload4.out.push(`<!---->Join a team`);
                },
                $$slots: { default: true }
              });
              $$payload3.out.push(`<!----></div>`);
            } else {
              $$payload3.out.push("<!--[!-->");
              const each_array = ensure_array_like(formatPermissions(userProfile.main_permission, userProfile.secondary_permission)?.split(", ") || []);
              $$payload3.out.push(`<div class="text-white text-sm mb-2"><p class="mb-2">You're in the following team:</p> <ul class="list-disc list-inside text-lime space-y-1 ml-4"><!--[-->`);
              for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
                let permission = each_array[$$index];
                $$payload3.out.push(`<li>${escape_html(permission)}</li>`);
              }
              $$payload3.out.push(`<!--]--></ul></div> `);
              if (!userProfile.secondary_permission || (Array.isArray(userProfile.secondary_permission) ? userProfile.secondary_permission.length < 3 : userProfile.secondary_permission.split(",").length < 2)) {
                $$payload3.out.push("<!--[-->");
                $$payload3.out.push(`<div class="flex items-center gap-2"><span class="text-white text-sm">Wanna join another team?</span> `);
                Button($$payload3, {
                  variant: "slim",
                  width: "w-auto",
                  children: ($$payload4) => {
                    $$payload4.out.push(`<!---->Join a new team`);
                  },
                  $$slots: { default: true }
                });
                $$payload3.out.push(`<!----></div>`);
              } else {
                $$payload3.out.push("<!--[!-->");
              }
              $$payload3.out.push(`<!--]-->`);
            }
            $$payload3.out.push(`<!--]-->`);
          } else {
            $$payload3.out.push("<!--[!-->");
            $$payload3.out.push(`<p class="text-gray2 text-sm">Unable to load permissions</p>`);
          }
          $$payload3.out.push(`<!--]-->`);
        }
        $$payload3.out.push(`<!--]--></div></div></div></div> <div${attr_class(`fade-in ${stringify("")}`, "svelte-11245tj")} style="transition-delay: 0.2s;"><div class="bg-navbar rounded-2xl p-6"><div class="flex items-baseline gap-2 mb-4"><h2 class="text-xl font-bold text-white -translate-y-0.5">Latest Updates</h2></div> <div class="pl-7 space-y-2"><div class="text-white text-sm"><span class="text-white">Version:</span> <span class="text-lime">v1.2.3</span></div> <div class="text-white text-sm"><span class="text-white">Changes:</span></div> <ul class="text-gray2 text-sm space-y-1 ml-4"><li>• Improved dashboard performance</li> <li>• Added new team collaboration features</li> <li>• Fixed notification system bugs</li></ul></div></div></div></div> <div class="lg:col-span-2"></div></div></div></div>`);
      },
      $$slots: { default: true }
    });
    $$payload2.out.push(`<!----> `);
    Modal($$payload2, {
      title: "Request to join a Team!",
      maxWidth: "max-w-xl",
      hasFooter: true,
      get isOpen() {
        return showModal;
      },
      set isOpen($$value) {
        showModal = $$value;
        $$settled = false;
      },
      children: ($$payload3) => {
        $$payload3.out.push(`<div class="space-y-4"><p class="font-normal text-gray2">To join a team, please enter your access code. If you don't have one, reach out to an admin.</p> <p class="font-normal text-lime">Team Access Code</p> `);
        TypebarCredentials($$payload3, {
          variant: "clear-lime",
          placeholder: "enter your team access code",
          get value() {
            return teamCode;
          },
          set value($$value) {
            teamCode = $$value;
            $$settled = false;
          }
        });
        $$payload3.out.push(`<!----></div>`);
      },
      $$slots: {
        default: true,
        footer: ($$payload3) => {
          $$payload3.out.push(`<div slot="footer" class="flex gap-3 justify-end">`);
          Button($$payload3, {
            variant: "outline",
            children: ($$payload4) => {
              $$payload4.out.push(`<!---->Cancel`);
            },
            $$slots: { default: true }
          });
          $$payload3.out.push(`<!----> `);
          Button($$payload3, {
            variant: !teamCode.trim() ? "blocked" : "filled",
            disabled: !teamCode.trim() || isSubmitting,
            children: ($$payload4) => {
              $$payload4.out.push(`<!---->${escape_html("Join Team")}`);
            },
            $$slots: { default: true }
          });
          $$payload3.out.push(`<!----></div>`);
        }
      }
    });
    $$payload2.out.push(`<!---->`);
  }
  do {
    $$settled = true;
    $$inner_payload = copy_payload($$payload);
    $$render_inner($$inner_payload);
  } while (!$$settled);
  assign_payload($$payload, $$inner_payload);
  if ($$store_subs) unsubscribe_stores($$store_subs);
  pop();
}
export {
  _page as default
};
