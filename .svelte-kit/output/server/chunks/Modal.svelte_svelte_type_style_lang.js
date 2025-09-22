import { E as store_get, R as ensure_array_like, M as attr_class, N as attr, G as escape_html, D as slot, I as unsubscribe_stores, Q as bind_props, B as pop, z as push, P as fallback } from "./index2.js";
import { p as page } from "./stores.js";
import "@sveltejs/kit/internal";
import "./exports.js";
import "./utils.js";
import "./state.svelte.js";
import "./supabase.js";
function html(value) {
  var html2 = String(value ?? "");
  var open = "<!---->";
  return open + html2 + "<!---->";
}
function MainLayout($$payload, $$props) {
  push();
  var $$store_subs;
  let pageTitle = fallback($$props["pageTitle"], "Dashboard");
  let activeSubMenu = null;
  let isLoading = false;
  let playAnimations = false;
  const icons = {
    dashboard: `<svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>`,
    marketing: `<svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"></path><path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"></path></svg>`,
    booking: `<svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>`,
    advancing: `<svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>`,
    production: `<svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"></path><path d="M2 17l10 5 10-5"></path><path d="M2 12l10 5 10-5"></path></svg>`,
    dataEditor: `<svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14,2 14,8 20,8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10,9 9,9 8,9"></polyline></svg>`,
    settings: `<svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1 1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`,
    arrow: `<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`,
    logout: `<svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>`,
    toggle: `<svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>`
  };
  const menuItems = [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: icons.dashboard,
      route: "/dashboard",
      subItems: []
    },
    {
      id: "marketing",
      label: "Marketing",
      icon: icons.marketing,
      subItems: [
        { label: "Comparehub", route: "/marketing/comparehub" },
        { label: "Events Info", route: "/marketing/eventsinfo" },
        { label: "Statistics", route: "/marketing/statistics" },
        { label: "Performance", route: "/marketing/performance" }
      ]
    },
    {
      id: "booking",
      label: "Booking",
      icon: icons.booking,
      subItems: [
        { label: "Set Times", route: "/booking/settimes" },
        { label: "Booking Tool", route: "/booking/tool" }
      ]
    },
    {
      id: "advancing",
      label: "Advancing",
      icon: icons.advancing,
      subItems: [
        { label: "Overview", route: "/advancing/overview" },
        { label: "Advance Gathered", route: "/advancing/gathered" }
      ]
    },
    {
      id: "production",
      label: "Production",
      icon: icons.production,
      subItems: [
        { label: "Overview", route: "/production/overview" },
        { label: "Backline", route: "/production/backline" }
      ]
    }
  ];
  function setActiveSubMenuFromRoute(pathname) {
    const activeParent = menuItems.find((item) => item.subItems.some((sub) => pathname.startsWith(sub.route)));
    activeSubMenu = activeParent ? activeParent.id : null;
  }
  function isActive(item) {
    const currentPath = store_get($$store_subs ??= {}, "$page", page).url.pathname;
    if ("subItems" in item) {
      if (item.route) return currentPath.startsWith(item.route);
      return item.subItems.some((sub) => currentPath.startsWith(sub.route));
    }
    return currentPath.startsWith(item.route);
  }
  store_get($$store_subs ??= {}, "$page", page).url.pathname, setActiveSubMenuFromRoute(store_get($$store_subs ??= {}, "$page", page).url.pathname);
  const each_array = ensure_array_like(
    // --- DATA ---
    // --- FUNCTIONS ---
    // CORRECTED: Replaced placeholder with actual logout logic
    // The logout function will handle navigation
    // Optionally, show an error to the user
    menuItems
  );
  $$payload.out.push(`<div class="flex h-screen bg-gray1 text-white font-sans"><nav${attr_class("navbar svelte-yr6doh", void 0, { "collapsed": false })}><div class="flex flex-col h-full"><div${attr_class("nav-header svelte-yr6doh", void 0, { "animate-in": playAnimations })}><div class="header-content-expanded svelte-yr6doh"><img src="/images/ProduktXX_LOGO1.png" alt="ProduktXX Logo" class="logo mb-2 svelte-yr6doh"/> <div class="welcome-text"><span class="text-sm text-gray2">Welcome back!</span></div></div> <button type="button" class="toggle-button-collapsed svelte-yr6doh" aria-label="Expand navigation">${html(icons.toggle)}</button></div> <div class="flex-1 nav-scroll-area flex flex-col svelte-yr6doh"><div class="flex-grow"><!--[-->`);
  for (let i = 0, $$length = each_array.length; i < $$length; i++) {
    let item = each_array[i];
    $$payload.out.push(`<div class="nav-item-container svelte-yr6doh"><button type="button"${attr_class("nav-button svelte-yr6doh", void 0, { "active": isActive(item) })}${attr("aria-haspopup", item.subItems.length > 0)}${attr("aria-expanded", activeSubMenu === item.id)}><span class="icon svelte-yr6doh">${html(item.icon)}</span> <span class="label svelte-yr6doh">${escape_html(item.label)}</span> `);
    if (item.subItems.length > 0) {
      $$payload.out.push("<!--[-->");
      $$payload.out.push(`<span${attr_class("arrow svelte-yr6doh", void 0, { "rotated": activeSubMenu === item.id })}>${html(icons.arrow)}</span>`);
    } else {
      $$payload.out.push("<!--[!-->");
    }
    $$payload.out.push(`<!--]--></button> `);
    if (item.subItems.length > 0) {
      $$payload.out.push("<!--[-->");
      const each_array_1 = ensure_array_like(item.subItems);
      $$payload.out.push(`<div${attr_class("submenu-container svelte-yr6doh", void 0, { "expanded": activeSubMenu === item.id })}><div class="submenu-content svelte-yr6doh"><!--[-->`);
      for (let $$index = 0, $$length2 = each_array_1.length; $$index < $$length2; $$index++) {
        let subItem = each_array_1[$$index];
        $$payload.out.push(`<button type="button"${attr_class("submenu-button svelte-yr6doh", void 0, { "active": isActive(subItem) })}>${escape_html(subItem.label)}</button>`);
      }
      $$payload.out.push(`<!--]--></div></div>`);
    } else {
      $$payload.out.push("<!--[!-->");
    }
    $$payload.out.push(`<!--]--></div>`);
  }
  $$payload.out.push(`<!--]--> <div class="nav-item-container svelte-yr6doh"><button type="button" class="nav-button disabled svelte-yr6doh"><span class="icon svelte-yr6doh">${html(icons.dataEditor)}</span> <span class="label svelte-yr6doh">Coming Soon</span></button></div></div> <div class="mt-auto"><div class="nav-separator svelte-yr6doh"></div> <div class="nav-item-container svelte-yr6doh"><button type="button"${attr_class("nav-button svelte-yr6doh", void 0, {
    "active": store_get($$store_subs ??= {}, "$page", page).url.pathname.startsWith("/settings")
  })}><span class="icon svelte-yr6doh">${html(icons.settings)}</span> <span class="label svelte-yr6doh">Settings</span></button></div> <div class="nav-item-container svelte-yr6doh"><button type="button" class="nav-button svelte-yr6doh"${attr("disabled", isLoading, true)}><span class="icon svelte-yr6doh">`);
  {
    $$payload.out.push("<!--[!-->");
    $$payload.out.push(`${html(icons.logout)}`);
  }
  $$payload.out.push(`<!--]--></span> <span class="label svelte-yr6doh">${escape_html("Logout")}</span></button></div></div></div></div></nav> <div class="main-content svelte-yr6doh"><header class="p-6 flex items-center justify-between flex-shrink-0 border-b border-gray2">`);
  {
    $$payload.out.push("<!--[!-->");
  }
  $$payload.out.push(`<!--]--></header> <main class="flex-1 overflow-y-auto overflow-x-hidden p-6"><!---->`);
  slot($$payload, $$props, "default", {});
  $$payload.out.push(`<!----></main></div></div>`);
  if ($$store_subs) unsubscribe_stores($$store_subs);
  bind_props($$props, { pageTitle });
  pop();
}
export {
  MainLayout as M
};
