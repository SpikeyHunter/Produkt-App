import { z as push, P as fallback, J as copy_payload, K as assign_payload, Q as bind_props, B as pop, N as attr, R as ensure_array_like, G as escape_html, M as attr_class, O as stringify, F as head } from "../../../../chunks/index2.js";
import "@sveltejs/kit/internal";
import "../../../../chunks/exports.js";
import "../../../../chunks/utils.js";
import "../../../../chunks/state.svelte.js";
import { M as MainLayout } from "../../../../chunks/Modal.svelte_svelte_type_style_lang.js";
/* empty css                                                      */
import "@sveltejs/vite-plugin-svelte";
import { M as Modal } from "../../../../chunks/Modal.js";
import { s as supabase } from "../../../../chunks/supabase.js";
function EventsInfoSearch($$payload, $$props) {
  push();
  let liveEvents, pastEvents;
  let isOpen = fallback($$props["isOpen"], false);
  let searchValue = "";
  let allEvents = [];
  let filteredEvents = [];
  let loading = false;
  let filterStatus = "LIVE";
  let sortBy = "date";
  let availableGenres = [];
  async function loadAllEvents() {
    loading = true;
    try {
      const { data, error } = await supabase.from("events").select("event_id, event_name, event_date, event_flyer, event_status, event_genre").order("event_date", { ascending: false });
      if (error) {
        console.error("Error loading events:", error);
        return;
      }
      const excludeKeywords = [
        "test",
        "réservations",
        "pass",
        "event",
        "template",
        "produktworld",
        "piknic",
        "oktoberfest"
      ];
      const filteredData = (data || []).filter((event) => !excludeKeywords.some((keyword) => event.event_name.toLowerCase().includes(keyword)));
      allEvents = filteredData;
      const genres = /* @__PURE__ */ new Set();
      allEvents.forEach((event) => {
        if (event.event_genre) {
          genres.add(event.event_genre);
        }
      });
      availableGenres = Array.from(genres).sort();
      applyFilters();
    } catch (error) {
      console.error("Error loading events:", error);
    } finally {
      loading = false;
    }
  }
  function applyFilters() {
    let results = [...allEvents];
    if (searchValue.trim()) {
      results = results.filter((event) => event.event_name.toLowerCase().includes(searchValue.toLowerCase()) || event.event_id.toString().includes(searchValue) || event.event_genre && event.event_genre.toLowerCase().includes(searchValue.toLowerCase()));
    }
    {
      results = results.filter((event) => event.event_status === filterStatus);
    }
    results.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case "name":
          comparison = a.event_name.localeCompare(b.event_name);
          break;
        case "genre":
          const genreA = a.event_genre || "zzz";
          const genreB = b.event_genre || "zzz";
          comparison = genreA.localeCompare(genreB);
          break;
        case "date":
        default:
          comparison = new Date(a.event_date).getTime() - new Date(b.event_date).getTime();
          break;
      }
      return comparison * 1;
    });
    filteredEvents = results;
  }
  function formatEventDate(dateString) {
    try {
      const date = new Date(dateString);
      date.setDate(date.getDate() + 1);
      return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    } catch (error) {
      return dateString;
    }
  }
  if (isOpen) {
    loadAllEvents();
  }
  applyFilters();
  liveEvents = filteredEvents.filter((e) => e.event_status === "LIVE");
  pastEvents = filteredEvents.filter((e) => e.event_status === "PAST");
  let $$settled = true;
  let $$inner_payload;
  function $$render_inner($$payload2) {
    Modal($$payload2, {
      title: "Select an event",
      maxWidth: "max-w-5xl",
      hasFooter: false,
      closeOnBackdropClick: true,
      get isOpen() {
        return isOpen;
      },
      set isOpen($$value) {
        isOpen = $$value;
        $$settled = false;
      },
      children: ($$payload3) => {
        $$payload3.out.push(`<div class="grid grid-cols-1 sm:grid-cols-3 gap-x-8 gap-y-6 h-[80vh] sm:h-[600px]"><div class="sm:col-span-2 flex flex-col min-w-0 h-full overflow-hidden"><div class="mb-4 relative"><input type="text" class="w-full bg-transparent border border-lime rounded-full px-4 pr-10 py-2 text-white placeholder-gray2 focus:outline-none focus:ring-1 focus:ring-lime" placeholder="Search events by name, ID, or genre..."${attr("value", searchValue)}/> `);
        {
          $$payload3.out.push("<!--[!-->");
        }
        $$payload3.out.push(`<!--]--></div> <div class="flex-1 overflow-y-auto pr-2">`);
        if (loading) {
          $$payload3.out.push("<!--[-->");
          $$payload3.out.push(`<div class="flex flex-col items-center justify-center h-full"><div class="animate-spin w-8 h-8 border-3 border-lime border-t-transparent rounded-full svelte-1rdhchr"></div> <p class="text-gray2 mt-4">Loading events...</p></div>`);
        } else {
          $$payload3.out.push("<!--[!-->");
          if (filteredEvents.length === 0) {
            $$payload3.out.push("<!--[-->");
            $$payload3.out.push(`<div class="flex flex-col items-center justify-center h-full text-center"><svg class="w-16 h-16 text-gray2 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.35-4.35"></path></svg> <p class="text-gray2">No events found matching your filters</p> <button class="mt-4 px-4 py-2 bg-lime text-black rounded-full text-sm font-medium hover:opacity-90 transition-opacity">Clear All Filters</button></div>`);
          } else {
            $$payload3.out.push("<!--[!-->");
            if (liveEvents.length > 0) {
              $$payload3.out.push("<!--[-->");
              const each_array = ensure_array_like(liveEvents);
              $$payload3.out.push(`<div class="mb-6"><h3 class="text-lg font-bold text-white mb-3 px-2">Upcoming Events (${escape_html(liveEvents.length)})</h3> <div class="grid grid-cols-1 gap-3"><!--[-->`);
              for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
                let event = each_array[$$index];
                $$payload3.out.push(`<button type="button" class="group flex items-center gap-3 p-3 bg-gray1/50 text-white rounded-lg hover:bg-lime hover:cursor-pointer hover:text-black transition-colors text-left"><div class="w-16 h-16 rounded-lg overflow-hidden bg-navbar flex-shrink-0">`);
                if (event.event_flyer) {
                  $$payload3.out.push("<!--[-->");
                  $$payload3.out.push(`<img${attr("src", event.event_flyer)}${attr("alt", event.event_name)} class="w-full h-full object-cover"/>`);
                } else {
                  $$payload3.out.push("<!--[!-->");
                  $$payload3.out.push(`<div class="w-full h-full bg-gradient-to-br from-lime/40 to-lime/20 flex items-center justify-center"><svg class="w-6 h-6 text-lime" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg></div>`);
                }
                $$payload3.out.push(`<!--]--></div> <div class="flex-1 min-w-0"><p class="font-medium truncate">${escape_html(event.event_name)}</p> <p class="text-sm opacity-80">${escape_html(formatEventDate(event.event_date))} `);
                if (event.event_genre) {
                  $$payload3.out.push("<!--[-->");
                  $$payload3.out.push(`• ${escape_html(event.event_genre)}`);
                } else {
                  $$payload3.out.push("<!--[!-->");
                }
                $$payload3.out.push(`<!--]--></p> <p class="text-xs opacity-70">ID: ${escape_html(event.event_id)}</p></div> <span class="px-2 py-1 bg-lime/20 text-lime text-xs rounded-full flex-shrink-0 transition-colors group-hover:bg-black/20 group-hover:text-black">LIVE</span></button>`);
              }
              $$payload3.out.push(`<!--]--></div></div>`);
            } else {
              $$payload3.out.push("<!--[!-->");
            }
            $$payload3.out.push(`<!--]--> `);
            if (pastEvents.length > 0) {
              $$payload3.out.push("<!--[-->");
              const each_array_1 = ensure_array_like(pastEvents);
              $$payload3.out.push(`<div><h3 class="text-lg font-bold text-white mb-3 px-2">Past Events (${escape_html(pastEvents.length)})</h3> <div class="grid grid-cols-1 gap-3"><!--[-->`);
              for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
                let event = each_array_1[$$index_1];
                $$payload3.out.push(`<button type="button" class="group flex items-center gap-3 p-3 bg-gray1/30 text-white rounded-lg hover:bg-lime hover:cursor-pointer hover:text-black transition-colors text-left"><div class="w-16 h-16 rounded-lg overflow-hidden bg-navbar flex-shrink-0">`);
                if (event.event_flyer) {
                  $$payload3.out.push("<!--[-->");
                  $$payload3.out.push(`<img${attr("src", event.event_flyer)}${attr("alt", event.event_name)} class="w-full h-full object-cover"/>`);
                } else {
                  $$payload3.out.push("<!--[!-->");
                  $$payload3.out.push(`<div class="w-full h-full bg-gradient-to-br from-gray2/40 to-gray2/20 flex items-center justify-center"><svg class="w-6 h-6 text-gray2" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg></div>`);
                }
                $$payload3.out.push(`<!--]--></div> <div class="flex-1 min-w-0"><p class="font-medium truncate">${escape_html(event.event_name)}</p> <p class="text-sm opacity-80">${escape_html(formatEventDate(event.event_date))} `);
                if (event.event_genre) {
                  $$payload3.out.push("<!--[-->");
                  $$payload3.out.push(`• ${escape_html(event.event_genre)}`);
                } else {
                  $$payload3.out.push("<!--[!-->");
                }
                $$payload3.out.push(`<!--]--></p> <p class="text-xs opacity-70">ID: ${escape_html(event.event_id)}</p></div> <span class="px-2 py-1 bg-gray1 text-gray2 text-xs rounded-full flex-shrink-0 transition-colors group-hover:bg-black/20 group-hover:cursor-pointer group-hover:text-black">PAST</span></button>`);
              }
              $$payload3.out.push(`<!--]--></div></div>`);
            } else {
              $$payload3.out.push("<!--[!-->");
            }
            $$payload3.out.push(`<!--]-->`);
          }
          $$payload3.out.push(`<!--]-->`);
        }
        $$payload3.out.push(`<!--]--></div></div> <div class="sm:col-span-1 space-y-5 sm:border-l sm:border-gray1/50 sm:pl-8 overflow-y-auto"><h3 class="text-lg font-bold text-white sm:-ml-2">Filters</h3> <div><h4 class="text-sm font-medium text-gray3 mb-2">Status</h4> <div class="flex gap-1 bg-gray1 p-1 rounded-full text-sm font-bold"><button${attr_class(`flex-1 py-1 rounded-full transition-colors ${stringify(
          "bg-lime text-black"
        )}`)}>Live</button> <button${attr_class(`flex-1 py-1 rounded-full transition-colors ${stringify("text-white hover:bg-gray2 hover:cursor-pointer hover:text-black")}`)}>Past</button> <button${attr_class(`flex-1 py-1 rounded-full transition-colors ${stringify("text-white hover:bg-gray2 hover:cursor-pointer hover:text-black")}`)}>All</button></div></div> <div><h4 class="text-sm font-medium text-gray3 mb-2">Sort By</h4> <div class="flex gap-1 bg-gray1 p-1 rounded-full text-sm font-bold"><button${attr_class(`flex-1 py-1 rounded-full transition-colors ${stringify(
          "bg-lime text-black"
        )}`)}>Date ↑</button> <button${attr_class(`flex-1 py-1 rounded-full transition-colors ${stringify("text-white hover:bg-gray2 hover:cursor-pointer hover:text-black")}`)}>Date ↓</button> <button${attr_class(`flex-1 py-1 rounded-full transition-colors ${stringify("text-white hover:bg-gray2 hover:cursor-pointer hover:text-black")}`)}>A-Z</button> <button${attr_class(`flex-1 py-1 rounded-full transition-colors ${stringify("text-white hover:bg-gray2 hover:cursor-pointer hover:text-black")}`)}>Z-A</button></div></div> <div><h4 class="text-sm font-medium text-gray3 mb-2">Filter by Date</h4> <div class="flex gap-1 bg-gray1 p-1 rounded-full text-sm font-bold"><button${attr_class(`flex-1 py-1 rounded-full transition-colors ${stringify("text-white hover:bg-gray2 hover:cursor-pointer hover:text-black")}`)}>Day</button> <button${attr_class(`flex-1 py-1 rounded-full transition-colors ${stringify("text-white hover:bg-gray2 hover:cursor-pointer hover:text-black")}`)}>Month</button> <button${attr_class(`flex-1 py-1 rounded-full transition-colors ${stringify("text-white hover:bg-gray2 hover:cursor-pointer hover:text-black")}`)}>Year</button></div> `);
        {
          $$payload3.out.push("<!--[!-->");
        }
        $$payload3.out.push(`<!--]--></div> <div class="pt-4"><button type="button" class="w-full px-3 py-2 text-sm bg-gray1 text-white rounded-full hover:cursor-pointer hover:bg-gray2 hover:text-black transition-colors">Clear Filters</button></div></div></div>`);
      },
      $$slots: { default: true }
    });
  }
  do {
    $$settled = true;
    $$inner_payload = copy_payload($$payload);
    $$render_inner($$inner_payload);
  } while (!$$settled);
  assign_payload($$payload, $$inner_payload);
  bind_props($$props, { isOpen });
  pop();
}
function _page($$payload, $$props) {
  push();
  let loading = true;
  let showSearchModal = false;
  let $$settled = true;
  let $$inner_payload;
  function $$render_inner($$payload2) {
    head($$payload2, ($$payload3) => {
      $$payload3.title = `<title>Events Info</title>`;
    });
    MainLayout($$payload2, {
      pageTitle: "Events Info",
      children: ($$payload3) => {
        $$payload3.out.push(`<div class="h-full overflow-auto"><div class="p-6"><div${attr_class(`fade-in ${stringify("")} mb-8`, "svelte-17jv876")} style="transition-delay: 0.1s;"><div class="flex justify-start"><div class="flex items-center gap-3"><button class="h-7 px-3 flex items-center justify-center gap-1.5 rounded-full bg-lime text-black border-none cursor-pointer transition-all duration-200 text-sm font-semibold hover:opacity-90 hover:-translate-y-0.5" title="Select an event" aria-label="Select an event"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg> <span>Select an event</span></button> <button class="h-7 w-7 flex items-center justify-center rounded-full bg-gray1 text-white border-none cursor-pointer transition-all duration-200 hover:bg-gray2 hover:text-lime disabled:opacity-50 disabled:cursor-not-allowed"${attr("disabled", loading, true)} title="Refresh events" aria-label="Refresh events"><svg${attr_class(`w-4 h-4 ${stringify("animate-spin")}`, "svelte-17jv876")} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path><path d="M21 3v5h-5"></path><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path><path d="M3 21v-5h5"></path></svg></button></div></div></div> `);
        {
          $$payload3.out.push("<!--[-->");
          $$payload3.out.push(`<div class="flex flex-col items-center justify-center py-16 text-center"><div class="w-8 h-8 mb-4 animate-spin svelte-17jv876"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-lime"><path d="M21 12a9 9 0 11-6.219-8.56"></path></svg></div> <p class="text-gray2 text-base">Loading events info...</p></div>`);
        }
        $$payload3.out.push(`<!--]--></div></div>`);
      },
      $$slots: { default: true }
    });
    $$payload2.out.push(`<!----> `);
    EventsInfoSearch($$payload2, {
      get isOpen() {
        return showSearchModal;
      },
      set isOpen($$value) {
        showSearchModal = $$value;
        $$settled = false;
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
  pop();
}
export {
  _page as default
};
