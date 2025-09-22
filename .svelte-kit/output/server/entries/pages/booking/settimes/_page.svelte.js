import { z as push, P as fallback, J as copy_payload, K as assign_payload, Q as bind_props, B as pop, O as stringify, N as attr, G as escape_html, R as ensure_array_like, M as attr_class, S as clsx, F as head } from "../../../../chunks/index2.js";
import { M as MainLayout } from "../../../../chunks/Modal.svelte_svelte_type_style_lang.js";
import { S as SearchBar, F as FilterButton } from "../../../../chunks/FilterButton.js";
import { o as onDestroy } from "../../../../chunks/PopupNotification.svelte_svelte_type_style_lang.js";
import "../../../../chunks/supabase.js";
/* empty css                                                      */
import { M as Modal } from "../../../../chunks/Modal.js";
import { B as Button } from "../../../../chunks/Button.js";
/* empty css                                                             */
function SetTimesModal($$payload, $$props) {
  push();
  let isOpen = fallback($$props["isOpen"], false);
  let event = fallback($$props["event"], null);
  let entries = [];
  let isDeleting = false;
  let dropdownState = { show: false, index: -1 };
  let showDeleteConfirm = false;
  const statusOptions = ["Default", "Problem", "Tentative", "Proposed", "Confirmed"];
  function calculateLengths() {
    const hadError = /* @__PURE__ */ new Set();
    entries.forEach((entry) => {
      if (entry.status === "Problem") hadError.add(entry.id);
    });
    const doorsEntry = entries.find((e) => e.artist === "DOORS");
    const doorsTime = doorsEntry ? parseTime(doorsEntry.time) : null;
    const doorsIndex = doorsEntry ? entries.indexOf(doorsEntry) : -1;
    for (let i = 0; i < entries.length; i++) {
      let isProblem = false;
      const currentEntry = entries[i];
      const currentTime = parseTime(currentEntry.time);
      if (doorsTime && i === doorsIndex + 1 && currentTime) {
        const diffFromDoors = currentTime.hours * 60 + currentTime.minutes - (doorsTime.hours * 60 + doorsTime.minutes);
        if (diffFromDoors < 0) {
          isProblem = true;
        }
      }
      let nextTime = null;
      if (i < entries.length - 1) {
        nextTime = parseTime(entries[i + 1].time);
        if (currentTime && nextTime) {
          const diff = nextTime.hours * 60 + nextTime.minutes - (currentTime.hours * 60 + currentTime.minutes);
          if (diff < 0) {
            isProblem = true;
          }
        }
      }
      if (isProblem) {
        currentEntry.status = "Problem";
      } else {
        if (hadError.has(currentEntry.id)) {
          currentEntry.status = "Default";
        }
      }
      if (i === entries.length - 1 || currentEntry.artist === "DOORS" || currentEntry.artist === "CURFEW") {
        currentEntry.length = "";
        continue;
      }
      if (currentEntry.status === "Problem") {
        currentEntry.length = "Error";
      } else if (currentTime && nextTime) {
        const diff = nextTime.hours * 60 + nextTime.minutes - (currentTime.hours * 60 + currentTime.minutes);
        const hours = Math.floor(diff / 60);
        const mins = diff % 60;
        if (hours > 0 && mins > 0) currentEntry.length = `${hours}h ${mins}m`;
        else if (hours > 0) currentEntry.length = `${hours}h`;
        else currentEntry.length = `${mins}m`;
      } else {
        currentEntry.length = "";
      }
    }
    entries = [...entries];
  }
  function generateTimeOptions() {
    const times = [];
    for (let hour = 22; hour < 24; hour++) {
      for (let min = 0; min < 60; min += 15) {
        const displayHour = hour > 12 ? hour - 12 : hour;
        times.push(`${displayHour}:${min.toString().padStart(2, "0")}PM`);
      }
    }
    for (let hour = 0; hour <= 3; hour++) {
      for (let min = 0; min < 60; min += 15) {
        const displayHour = hour === 0 ? 12 : hour;
        times.push(`${displayHour}:${min.toString().padStart(2, "0")}AM`);
      }
    }
    return times;
  }
  generateTimeOptions();
  function getStatusStyles(status) {
    switch (status) {
      case "Problem":
        return "border-problem bg-problem/10 hover:bg-problem/20";
      case "Tentative":
        return "border-tentatif bg-tentatif/10 hover:bg-tentatif/20";
      case "Proposed":
        return "border-proposed bg-proposed/10 hover:bg-proposed/20";
      case "Confirmed":
        return "border-confirmed bg-confirmed/10 hover:bg-confirmed/20";
      default:
        return "border-gray1 bg-gray1/10 hover:bg-gray1/20";
    }
  }
  onDestroy(() => {
    if (typeof window !== "undefined") document.body.classList.remove("modal-open");
  });
  function loadExistingTimetable() {
    if (!event) return;
    showDeleteConfirm = false;
    if (event.timetable && Array.isArray(event.timetable) && event.timetable.length > 0) {
      entries = event.timetable.map((entry) => ({ ...entry }));
    } else {
      resetToDefault();
    }
    calculateLengths();
  }
  function createEntry(time, artist = "", notes = "", status = "Default") {
    return {
      id: Math.random().toString(36).substr(2, 9),
      time,
      artist,
      notes,
      status,
      length: ""
    };
  }
  function resetToDefault() {
    if (!event) return;
    entries = [
      createEntry("10:00PM", "DOORS", "", "Default"),
      createEntry("10:00PM", "", "Local", "Default"),
      createEntry("11:30PM", "", "Support", "Default"),
      createEntry("1:00AM", "", "Headliner", "Default"),
      createEntry("3:00AM", "CURFEW", "", "Default")
    ];
    calculateLengths();
  }
  function parseTime(timeStr) {
    const match = timeStr.match(/^(\d{1,2}):(\d{2})(AM|PM)$/i);
    if (!match) return null;
    let hours = parseInt(match[1]);
    const minutes = parseInt(match[2]);
    const period = match[3].toUpperCase();
    if (period === "PM" && hours !== 12) hours += 12;
    if (period === "AM" && hours === 12) hours = 0;
    if (hours < 10) hours += 24;
    return { hours, minutes };
  }
  if (typeof window !== "undefined") {
    document.body.classList.toggle("modal-open", isOpen);
    if (!isOpen) dropdownState.show = false;
  }
  if (event && isOpen) loadExistingTimetable();
  let $$settled = true;
  let $$inner_payload;
  function $$render_inner($$payload2) {
    Modal($$payload2, {
      title: `Set Times - ${stringify(event?.event_name || "Event")}`,
      maxWidth: "max-w-4xl",
      hasFooter: true,
      get isOpen() {
        return isOpen;
      },
      set isOpen($$value) {
        isOpen = $$value;
        $$settled = false;
      },
      children: ($$payload3) => {
        $$payload3.out.push(`<div class="space-y-4">`);
        if (event) {
          $$payload3.out.push("<!--[-->");
          const each_array = ensure_array_like(entries);
          $$payload3.out.push(`<div class="flex items-center justify-between mb-2"><h3 class="text-base font-bold text-white">Run of Show</h3> <div class="flex gap-2"><button class="px-3 py-1.5 bg-gray1 text-white rounded-full font-bold text-xs border border-gray1 hover:border-lime hover:text-lime transition-colors cursor-pointer">Clear</button> <button class="px-3 py-1.5 bg-lime text-black rounded-full font-bold text-xs hover:brightness-110 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"${attr("disabled", entries.length >= 7, true)}>Add Line</button></div></div> <div class="grid grid-cols-13 gap-x-3 px-3 py-2 text-xs font-bold text-gray2 items-center"><div class="col-span-1"></div> <div class="col-span-2">Time</div> <div class="col-span-2 text-center">Length</div> <div class="col-span-3">Artist</div> <div class="col-span-2">Notes</div> <div class="col-span-2">Status</div> <div class="col-span-1"></div></div> <div class="space-y-2 pr-2"><!--[-->`);
          for (let index = 0, $$length = each_array.length; index < $$length; index++) {
            let entry = each_array[index];
            const formInputClasses = "w-full bg-transparent border border-gray1 rounded-md px-2 py-1.5 text-white text-xs focus:outline-none focus:border-lime focus:ring-1 focus:ring-lime transition-all duration-200";
            const isSpecialRow = entry.artist === "DOORS" || entry.artist === "CURFEW";
            $$payload3.out.push(`<div role="listitem"${attr_class(`grid grid-cols-13 gap-x-3 items-center p-2.5 border rounded-lg transition-all duration-200 ${stringify(getStatusStyles(entry.status))}`, "svelte-1y0rnyd")}${attr("draggable", !isSpecialRow)}><div class="col-span-1 grid grid-cols-2 gap-1 items-center"><div class="flex items-center justify-center">`);
            if (!isSpecialRow) {
              $$payload3.out.push("<!--[-->");
              $$payload3.out.push(`<button class="cursor-move text-gray-400 hover:text-white" aria-label="Drag to reorder"><svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M9 5h2v2H9zm4 0h2v2h-2zM9 9h2v2H9zm4 0h2v2h-2zm-4 4h2v2H9zm4 0h2v2h-2zm-4 4h2v2H9zm4 0h2v2h-2z"></path></svg></button>`);
            } else {
              $$payload3.out.push("<!--[!-->");
            }
            $$payload3.out.push(`<!--]--></div> <div class="flex flex-col"><button class="text-gray2 hover:text-lime cursor-pointer" aria-label="Increase time"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M18 15l-6-6-6 6"></path></svg></button> <button class="text-gray2 hover:text-lime cursor-pointer" aria-label="Decrease time"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M6 9l6 6 6-6"></path></svg></button></div></div> <div class="col-span-2"><input type="text"${attr_class(clsx(formInputClasses), "svelte-1y0rnyd")}${attr("value", entry.time)}/></div> <div class="col-span-2 text-center"><span class="text-gray2 text-xs">${escape_html(entry.length)}</span></div> <div class="col-span-3">`);
            if (isSpecialRow) {
              $$payload3.out.push("<!--[-->");
              $$payload3.out.push(`<span class="px-2.5 py-1.5 text-white font-bold text-xs">${escape_html(entry.artist)}</span>`);
            } else {
              $$payload3.out.push("<!--[!-->");
              $$payload3.out.push(`<input type="text"${attr_class(clsx(formInputClasses), "svelte-1y0rnyd")}${attr("value", entry.artist)} placeholder="Enter name"/>`);
            }
            $$payload3.out.push(`<!--]--></div> <div class="col-span-2">`);
            if (!isSpecialRow) {
              $$payload3.out.push("<!--[-->");
              $$payload3.out.push(`<input type="text"${attr_class(clsx(formInputClasses), "svelte-1y0rnyd")}${attr("value", entry.notes)} placeholder="Add"/>`);
            } else {
              $$payload3.out.push("<!--[!-->");
            }
            $$payload3.out.push(`<!--]--></div> <div class="col-span-2 relative">`);
            if (!isSpecialRow) {
              $$payload3.out.push("<!--[-->");
              $$payload3.out.push(`<button type="button"${attr_class(`${stringify(formInputClasses)} status-button flex items-center justify-between text-left`, "svelte-1y0rnyd")}><span>${escape_html(entry.status)}</span> <svg class="w-3 h-3 text-gray2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"></path></svg></button> `);
              if (dropdownState.show && dropdownState.index === index) {
                $$payload3.out.push("<!--[-->");
                const each_array_1 = ensure_array_like(statusOptions);
                $$payload3.out.push(`<div class="dropdown-portal absolute top-full mt-1 w-full bg-navbar border border-lime rounded-lg shadow-lg z-20 overflow-hidden" role="listbox"><!--[-->`);
                for (let $$index = 0, $$length2 = each_array_1.length; $$index < $$length2; $$index++) {
                  let option = each_array_1[$$index];
                  $$payload3.out.push(`<button type="button" class="w-full px-3 py-2 text-left text-white hover:bg-lime hover:text-black transition-colors cursor-pointer text-xs font-bold whitespace-nowrap">${escape_html(option)}</button>`);
                }
                $$payload3.out.push(`<!--]--></div>`);
              } else {
                $$payload3.out.push("<!--[!-->");
              }
              $$payload3.out.push(`<!--]-->`);
            } else {
              $$payload3.out.push("<!--[!-->");
            }
            $$payload3.out.push(`<!--]--></div> <div class="col-span-1 flex items-center justify-center">`);
            if (!isSpecialRow) {
              $$payload3.out.push("<!--[-->");
              $$payload3.out.push(`<button type="button" class="text-red-500/70 hover:text-red-500 transition-colors cursor-pointer" aria-label="Remove entry"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg></button>`);
            } else {
              $$payload3.out.push("<!--[!-->");
            }
            $$payload3.out.push(`<!--]--></div></div>`);
          }
          $$payload3.out.push(`<!--]--></div>`);
        } else {
          $$payload3.out.push("<!--[!-->");
        }
        $$payload3.out.push(`<!--]--></div>`);
      },
      $$slots: {
        default: true,
        footer: ($$payload3) => {
          $$payload3.out.push(`<div slot="footer" class="w-full flex justify-between items-center pt-2"><div class="flex-1">`);
          if (showDeleteConfirm) {
            $$payload3.out.push("<!--[-->");
            $$payload3.out.push(`<div class="flex items-center gap-2"><button class="px-6 py-3 text-sm border border-gray2 text-gray2 rounded-full hover:bg-gray2 hover:text-black transition-colors cursor-pointer">Cancel</button> <button class="px-6 py-3 text-sm bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors disabled:opacity-50 cursor-pointer"${attr("disabled", isDeleting, true)}>${escape_html("Confirm")}</button></div>`);
          } else {
            $$payload3.out.push("<!--[!-->");
            $$payload3.out.push(`<button class="px-6 py-3 border border-red-500 text-red-500 rounded-full hover:bg-red-500 hover:text-white transition-colors disabled:opacity-50 cursor-pointer"${attr("disabled", isDeleting, true)}>Delete</button>`);
          }
          $$payload3.out.push(`<!--]--></div> <div class="flex gap-2"><button class="px-6 py-3 border border-gray2 text-gray2 rounded-full hover:bg-gray2 hover:text-black transition-colors cursor-pointer"${attr("disabled", showDeleteConfirm, true)}>Cancel</button> `);
          Button($$payload3, {
            variant: "filled",
            disabled: showDeleteConfirm,
            children: ($$payload4) => {
              $$payload4.out.push(`<!---->${escape_html("Done")}`);
            },
            $$slots: { default: true }
          });
          $$payload3.out.push(`<!----></div></div>`);
        }
      }
    });
  }
  do {
    $$settled = true;
    $$inner_payload = copy_payload($$payload);
    $$render_inner($$inner_payload);
  } while (!$$settled);
  assign_payload($$payload, $$inner_payload);
  bind_props($$props, { isOpen, event });
  pop();
}
function _page($$payload, $$props) {
  push();
  let events;
  let searchValue = "";
  let currentFilter = "none";
  let loading = true;
  let showSetTimesModal = false;
  let selectedEventForModal = null;
  const EXCLUDE_WORDS = [
    "TEST",
    "TESTING",
    "PASS",
    "RÉSERVATIONS",
    "RÉSERVATION",
    "TEMPLATE"
  ];
  let allEvents = [];
  function parseEventDate(dateString) {
    const currentYear = (/* @__PURE__ */ new Date()).getFullYear();
    try {
      const date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        return date;
      }
    } catch (e) {
    }
    return /* @__PURE__ */ new Date(`${dateString}, ${currentYear}`);
  }
  function sortEvents(events2, filter) {
    const sorted = [...events2];
    switch (filter) {
      case "a-z":
        return sorted.sort((a, b) => a.event_name.localeCompare(b.event_name));
      case "z-a":
        return sorted.sort((a, b) => b.event_name.localeCompare(a.event_name));
      case "date-asc":
        return sorted.sort((a, b) => parseEventDate(a.event_date).getTime() - parseEventDate(b.event_date).getTime());
      case "date-desc":
        return sorted.sort((a, b) => parseEventDate(b.event_date).getTime() - parseEventDate(a.event_date).getTime());
      case "none":
      default:
        return sorted.sort((a, b) => parseEventDate(a.event_date).getTime() - parseEventDate(b.event_date).getTime());
    }
  }
  events = allEvents.filter((event) => {
    const eventNameUpper = event.event_name.toUpperCase();
    return !EXCLUDE_WORDS.some((word) => eventNameUpper.includes(word));
  }).filter((event) => {
    {
      return event.timetable_active !== false;
    }
  });
  sortEvents(events.filter((event) => event.event_name.toLowerCase().includes(searchValue.toLowerCase())), currentFilter);
  let $$settled = true;
  let $$inner_payload;
  function $$render_inner($$payload2) {
    head($$payload2, ($$payload3) => {
      $$payload3.title = `<title>Set Times</title>`;
    });
    MainLayout($$payload2, {
      pageTitle: "Set Times",
      children: ($$payload3) => {
        $$payload3.out.push(`<div class="h-full overflow-auto"><div class="page-container svelte-hvrhq9"><div${attr_class(`fade-in ${stringify("")} mb-8`, "svelte-hvrhq9")} style="transition-delay: 0.1s;"><div class="controls-container svelte-hvrhq9"><div class="search-container svelte-hvrhq9">`);
        SearchBar($$payload3, {
          placeholder: "Search an event",
          get value() {
            return searchValue;
          },
          set value($$value) {
            searchValue = $$value;
            $$settled = false;
          }
        });
        $$payload3.out.push(`<!----></div> <div class="buttons-container svelte-hvrhq9"><div class="buttons-left svelte-hvrhq9">`);
        FilterButton($$payload3, {
          get currentFilter() {
            return currentFilter;
          },
          set currentFilter($$value) {
            currentFilter = $$value;
            $$settled = false;
          }
        });
        $$payload3.out.push(`<!----> <button class="refresh-btn svelte-hvrhq9"${attr("disabled", loading, true)} title="Refresh events" aria-label="Refresh events"><svg${attr_class(`w-4 h-4 ${stringify("animate-spin")}`, "svelte-hvrhq9")} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path><path d="M21 3v5h-5"></path><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path><path d="M3 21v-5h5"></path></svg></button></div> <div class="buttons-right svelte-hvrhq9"><div class="tooltip-container svelte-hvrhq9"><button${attr_class(`eye-toggle-btn ${stringify("")}`, "svelte-hvrhq9")}${attr(
          "aria-label",
          "Viewing active, click to see inactive"
        )}>`);
        {
          $$payload3.out.push("<!--[!-->");
          $$payload3.out.push(`<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`);
        }
        $$payload3.out.push(`<!--]--></button> <span class="custom-tooltip svelte-hvrhq9">${escape_html("Active")}</span></div></div></div></div></div> `);
        {
          $$payload3.out.push("<!--[-->");
          $$payload3.out.push(`<div class="flex flex-col items-center justify-center py-16 text-center"><div class="w-8 h-8 mb-4 animate-spin svelte-hvrhq9"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-lime"><path d="M21 12a9 9 0 11-6.219-8.56"></path></svg></div> <p class="text-gray2 text-base">Loading Live Events...</p></div>`);
        }
        $$payload3.out.push(`<!--]--></div></div>`);
      },
      $$slots: { default: true }
    });
    $$payload2.out.push(`<!----> `);
    SetTimesModal($$payload2, {
      event: selectedEventForModal,
      get isOpen() {
        return showSetTimesModal;
      },
      set isOpen($$value) {
        showSetTimesModal = $$value;
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
