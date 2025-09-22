import { z as push, P as fallback, J as copy_payload, K as assign_payload, Q as bind_props, B as pop, N as attr, M as attr_class, G as escape_html, R as ensure_array_like, S as clsx, O as stringify, F as head } from "../../../../chunks/index2.js";
import "@sveltejs/kit/internal";
import "../../../../chunks/exports.js";
import "../../../../chunks/utils.js";
import "../../../../chunks/state.svelte.js";
import { M as MainLayout } from "../../../../chunks/Modal.svelte_svelte_type_style_lang.js";
import { S as SearchBar, F as FilterButton } from "../../../../chunks/FilterButton.js";
import { s as supabase } from "../../../../chunks/supabase.js";
import { M as Modal } from "../../../../chunks/Modal.js";
/* empty css                                                      */
function EventEditModal($$payload, $$props) {
  push();
  let isFormValid;
  let isOpen = fallback($$props["isOpen"], false);
  let event = fallback($$props["event"], null);
  let artistName = "";
  let artistType = "";
  let selectedEvent = null;
  let searchValue = "";
  let isSubmitting = false;
  let showDeleteConfirm = false;
  let showDropdown = false;
  let showEventDropdown = false;
  let customArtistType = "";
  let isCustomEvent = false;
  let availableEvents = [];
  let filteredEvents = [];
  let hasLoadedEvents = false;
  const artistTypeOptions = ["Headliner", "Support", "Local", "Other"];
  async function loadEvents() {
    try {
      const { data, error } = await supabase.from("events").select("event_id, event_name, event_date, event_flyer").eq("event_status", "LIVE").order("event_date", { ascending: true });
      if (error) {
        console.error("Error loading events:", error);
        availableEvents = [];
        return;
      }
      availableEvents = data || [];
    } catch (error) {
      console.error("Error loading events:", error);
      availableEvents = [];
    }
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
  if (event && isOpen && !hasLoadedEvents) {
    artistName = event?.name || "";
    const currentEventId = event?.id?.split("-")[0] || "";
    const eventArtistType = event?.artist_type || "";
    loadEvents().then(() => {
      selectedEvent = availableEvents.find((e) => e.event_id.toString() === currentEventId) || null;
      if (selectedEvent) {
        searchValue = selectedEvent.event_name;
        isCustomEvent = false;
      } else {
        searchValue = "Custom Event";
        isCustomEvent = true;
      }
      hasLoadedEvents = true;
    }).catch(() => {
      searchValue = "Custom Event";
      isCustomEvent = true;
      hasLoadedEvents = true;
    });
    if (artistTypeOptions.includes(eventArtistType)) {
      artistType = eventArtistType;
      customArtistType = "";
    } else if (eventArtistType) {
      artistType = "Other";
      customArtistType = eventArtistType;
    } else {
      artistType = "";
      customArtistType = "";
    }
    showDeleteConfirm = false;
    showDropdown = false;
    showEventDropdown = false;
  }
  if (searchValue && !isCustomEvent) {
    filteredEvents = availableEvents.filter((event2) => event2.event_name.toLowerCase().includes(searchValue.toLowerCase()) || event2.event_id.toString().includes(searchValue));
  } else {
    filteredEvents = availableEvents;
  }
  isFormValid = artistName.trim().length > 0 && (selectedEvent || isCustomEvent) && (artistType !== "Other" || customArtistType.trim().length > 0);
  let $$settled = true;
  let $$inner_payload;
  function $$render_inner($$payload2) {
    Modal($$payload2, {
      title: "Edit Event",
      maxWidth: "max-w-xl",
      hasFooter: true,
      closeOnBackdropClick: true,
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
          $$payload3.out.push(`<div class="dropdown-container relative"><p class="font-normal text-lime mb-2">Select Event</p> <div class="relative"><input type="text" class="w-full bg-transparent border border-lime rounded-full px-4 py-3 text-white placeholder-gray2 focus:outline-none focus:border-lime focus:ring-1 focus:ring-lime pr-16"${attr("placeholder", selectedEvent ? selectedEvent.event_name : isCustomEvent ? "Custom Event" : "Search for an event")}${attr("value", searchValue)}/> <div class="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-2">`);
          if (selectedEvent || isCustomEvent || searchValue) {
            $$payload3.out.push("<!--[-->");
            $$payload3.out.push(`<button type="button" class="p-1 text-gray2 hover:text-lime rounded-full hover:bg-gray1 transition-colors cursor-pointer" aria-label="Clear selection"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>`);
          } else {
            $$payload3.out.push("<!--[!-->");
          }
          $$payload3.out.push(`<!--]--> <button type="button" class="cursor-pointer" aria-label="Toggle dropdown"><svg${attr_class(`w-4 h-4 text-lime transition-transform ${stringify(showEventDropdown ? "rotate-180" : "")}`)} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"></path></svg></button></div></div> `);
          if (showEventDropdown) {
            $$payload3.out.push("<!--[-->");
            const each_array = ensure_array_like(filteredEvents);
            $$payload3.out.push(`<div class="absolute top-full left-0 right-0 mt-1 bg-navbar border border-lime rounded-lg shadow-lg z-20 max-h-80 overflow-y-auto"><button type="button" class="w-full px-4 py-3 text-left text-white hover:bg-lime hover:text-black transition-colors cursor-pointer border-b border-gray1"><div class="flex items-center gap-3"><div class="w-12 h-12 bg-gray1 rounded-lg flex items-center justify-center"><svg class="w-6 h-6 text-lime" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg></div> <div><p class="font-medium">Custom Event</p> <p class="text-sm opacity-70">Event not in Tixr system</p></div></div></button> <!--[-->`);
            for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
              let eventOption = each_array[$$index];
              $$payload3.out.push(`<button type="button" class="w-full px-4 py-3 text-left text-white hover:bg-lime hover:text-black transition-colors cursor-pointer border-b border-gray1 last:border-b-0"><div class="flex items-center gap-3"><div class="w-12 h-12 rounded-lg overflow-hidden bg-gray1 flex-shrink-0">`);
              if (eventOption.event_flyer) {
                $$payload3.out.push("<!--[-->");
                $$payload3.out.push(`<img${attr("src", eventOption.event_flyer)}${attr("alt", eventOption.event_name)} class="w-full h-full object-cover"/>`);
              } else {
                $$payload3.out.push("<!--[!-->");
                $$payload3.out.push(`<div class="w-full h-full bg-gradient-to-br from-lime/40 to-lime/20 flex items-center justify-center"><svg class="w-4 h-4 text-lime" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg></div>`);
              }
              $$payload3.out.push(`<!--]--></div> <div class="flex-1 min-w-0"><p class="font-medium truncate">${escape_html(eventOption.event_name)}</p> <p class="text-sm opacity-70">${escape_html(formatEventDate(eventOption.event_date))} • ID: ${escape_html(eventOption.event_id)}</p></div></div></button>`);
            }
            $$payload3.out.push(`<!--]--> `);
            if (searchValue && filteredEvents.length === 0) {
              $$payload3.out.push("<!--[-->");
              $$payload3.out.push(`<div class="px-4 py-6 text-center text-gray2"><p>No events found matching "${escape_html(searchValue)}"</p></div>`);
            } else {
              $$payload3.out.push("<!--[!-->");
            }
            $$payload3.out.push(`<!--]--></div>`);
          } else {
            $$payload3.out.push("<!--[!-->");
          }
          $$payload3.out.push(`<!--]--></div> <div><p class="font-normal text-lime mb-2">Artist Name</p> <input type="text" class="w-full bg-transparent border border-lime rounded-full px-4 py-3 text-white placeholder-gray2 focus:outline-none focus:border-lime focus:ring-1 focus:ring-lime" placeholder="Enter artist name"${attr("value", artistName)}/></div> <div class="dropdown-container relative"><p class="font-normal text-lime mb-2">Artist Type</p> <button type="button" class="w-full bg-transparent border border-lime rounded-full px-4 py-3 text-white focus:outline-none focus:border-lime focus:ring-1 focus:ring-lime flex items-center justify-between cursor-pointer"><span${attr_class(clsx(artistType ? "text-white" : "text-gray2"))}>`);
          if (artistType === "Other" && customArtistType) {
            $$payload3.out.push("<!--[-->");
            $$payload3.out.push(`${escape_html(customArtistType)}`);
          } else {
            $$payload3.out.push("<!--[!-->");
            if (artistType) {
              $$payload3.out.push("<!--[-->");
              $$payload3.out.push(`${escape_html(artistType)}`);
            } else {
              $$payload3.out.push("<!--[!-->");
              $$payload3.out.push(`Select artist type`);
            }
            $$payload3.out.push(`<!--]-->`);
          }
          $$payload3.out.push(`<!--]--></span> <svg${attr_class(`w-4 h-4 text-lime transition-transform ${stringify(showDropdown ? "rotate-180" : "")}`)} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"></path></svg></button> `);
          if (showDropdown) {
            $$payload3.out.push("<!--[-->");
            const each_array_1 = ensure_array_like(artistTypeOptions);
            $$payload3.out.push(`<div class="absolute top-full left-0 right-0 mt-1 bg-navbar border border-lime rounded-lg shadow-lg z-10"><!--[-->`);
            for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
              let option = each_array_1[$$index_1];
              $$payload3.out.push(`<button type="button" class="w-full px-4 py-3 text-left text-white hover:bg-lime hover:text-black transition-colors cursor-pointer border-b border-gray1 last:border-b-0">${escape_html(option)}</button>`);
            }
            $$payload3.out.push(`<!--]--></div>`);
          } else {
            $$payload3.out.push("<!--[!-->");
          }
          $$payload3.out.push(`<!--]--></div> `);
          if (artistType === "Other") {
            $$payload3.out.push("<!--[-->");
            $$payload3.out.push(`<div><p class="font-normal text-lime mb-2">Custom Artist Type</p> <input type="text" class="w-full bg-transparent border border-lime rounded-full px-4 py-3 text-white placeholder-gray2 focus:outline-none focus:border-lime focus:ring-1 focus:ring-lime" placeholder="Enter custom artist type"${attr("value", customArtistType)}/></div>`);
          } else {
            $$payload3.out.push("<!--[!-->");
          }
          $$payload3.out.push(`<!--]--> `);
          if (showDeleteConfirm) {
            $$payload3.out.push("<!--[-->");
            $$payload3.out.push(`<div class="bg-red-900/20 border border-red-500/30 rounded-lg p-4"><div class="flex items-center gap-2 mb-2"><svg class="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path></svg> <h4 class="text-red-400 font-bold text-sm">Confirm Deletion</h4></div> <p class="text-red-300 text-sm mb-3">Are you sure you want to delete this event entry? This action cannot be undone.</p> <div class="flex gap-2"><button class="px-4 py-2 text-sm border border-gray2 text-gray2 rounded-full hover:bg-gray2 hover:text-black transition-colors cursor-pointer">Cancel</button> <button class="px-4 py-2 text-sm bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"${attr("disabled", isSubmitting, true)}>${escape_html("Delete")}</button></div></div>`);
          } else {
            $$payload3.out.push("<!--[!-->");
          }
          $$payload3.out.push(`<!--]-->`);
        } else {
          $$payload3.out.push("<!--[!-->");
        }
        $$payload3.out.push(`<!--]--></div>`);
      },
      $$slots: {
        default: true,
        footer: ($$payload3) => {
          $$payload3.out.push(`<div slot="footer" class="flex gap-3 justify-between">`);
          if (!showDeleteConfirm) {
            $$payload3.out.push("<!--[-->");
            $$payload3.out.push(`<button class="px-6 py-3 border border-red-500 text-red-500 rounded-full hover:bg-red-500 hover:text-white transition-colors disabled:opacity-50 cursor-pointer"${attr("disabled", isSubmitting, true)}>Delete Event</button>`);
          } else {
            $$payload3.out.push("<!--[!-->");
            $$payload3.out.push(`<div></div>`);
          }
          $$payload3.out.push(`<!--]--> <div class="flex gap-3"><button class="px-6 py-3 border border-gray2 text-gray2 rounded-full hover:bg-gray2 hover:text-black transition-colors cursor-pointer">Cancel</button> <button${attr_class("px-6 py-3 rounded-full transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed", void 0, {
            "bg-lime": isFormValid && !isSubmitting,
            "text-black": isFormValid && !isSubmitting,
            "bg-gray1": !isFormValid || isSubmitting,
            "text-gray2": !isFormValid || isSubmitting,
            "hover:bg-lime": isFormValid && !isSubmitting
          })}${attr("disabled", !isFormValid || isSubmitting || showDeleteConfirm, true)}>${escape_html("Save Changes")}</button></div></div>`);
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
function DatePicker($$payload, $$props) {
  push();
  let displayValue, buttonClasses;
  let value = fallback($$props["value"], "");
  let placeholder = fallback($$props["placeholder"], "Select date");
  let width = fallback($$props["width"], "w-full");
  let height = fallback($$props["height"], "h-auto");
  let variant = fallback($$props["variant"], "default");
  let disabled = fallback($$props["disabled"], false);
  const required = false;
  let minDate = fallback($$props["minDate"], "");
  let maxDate = fallback($$props["maxDate"], "");
  let format = fallback($$props["format"], "mm/dd/yyyy");
  let dbTable = fallback($$props["dbTable"], "");
  let dbColumn = fallback($$props["dbColumn"], "");
  let dbId = fallback($$props["dbId"], "");
  let autoSave = fallback($$props["autoSave"], false);
  function formatDisplayDate(dateString) {
    if (!dateString) return "";
    try {
      const date = new Date(dateString);
      const day = String(date.getDate() + 1).padStart(2, "0");
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const year = date.getFullYear();
      switch (format) {
        case "dd/mm/yyyy":
          return `${day}/${month}/${year}`;
        case "yyyy-mm-dd":
          return `${year}-${month}-${day}`;
        default:
          return `${month}/${day}/${year}`;
      }
    } catch (error) {
      return dateString;
    }
  }
  displayValue = value ? formatDisplayDate(value) : "";
  buttonClasses = [
    "bg-transparent border text-white focus:outline-none focus:ring-1 transition-all duration-200 cursor-pointer flex items-center justify-between",
    variant === "default" && "border-lime rounded-full px-4 py-3 focus:border-lime focus:ring-lime",
    variant === "slim" && "border-lime rounded-full px-3 py-2 text-sm focus:border-lime focus:ring-lime",
    variant === "outline" && "border-2 border-lime rounded-full px-4 py-3 focus:border-lime focus:ring-lime",
    width,
    height,
    disabled && "opacity-50 cursor-not-allowed"
  ].filter(Boolean).join(" ");
  $$payload.out.push(`<div class="datepicker-container relative"><input type="hidden" name="date"${attr("value", value)}/> <div${attr_class(clsx(buttonClasses))} role="button"${attr("tabindex", disabled ? -1 : 0)}${attr("aria-label", placeholder)}><div class="flex items-center gap-3 flex-1 min-w-0"><svg class="w-4 h-4 text-lime flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg> <span${attr_class(clsx(displayValue ? "text-white truncate" : "text-gray2 truncate"))}>${escape_html(displayValue || placeholder)}</span></div> <div class="flex items-center gap-2 flex-shrink-0">`);
  if (value && !disabled) {
    $$payload.out.push("<!--[-->");
    $$payload.out.push(`<div class="p-1 text-gray2 hover:text-lime rounded-full hover:bg-gray1 transition-colors cursor-pointer" role="button" tabindex="0" aria-label="Clear date"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></div>`);
  } else {
    $$payload.out.push("<!--[!-->");
  }
  $$payload.out.push(`<!--]--> <svg${attr_class(`w-4 h-4 text-lime transition-transform ${stringify("")}`)} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"></path></svg></div></div> `);
  {
    $$payload.out.push("<!--[!-->");
  }
  $$payload.out.push(`<!--]--></div>`);
  bind_props($$props, {
    value,
    placeholder,
    width,
    height,
    variant,
    disabled,
    minDate,
    maxDate,
    format,
    dbTable,
    dbColumn,
    dbId,
    autoSave,
    required
  });
  pop();
}
function EventAddModal($$payload, $$props) {
  push();
  let validArtists, isFormValid;
  let isOpen = fallback($$props["isOpen"], false);
  let searchValue = "";
  let showEventDropdown = false;
  let selectedEvent = null;
  let availableEvents = [];
  let filteredEvents = [];
  let artists = [];
  let venue = "";
  let customVenue = "";
  let showVenueDropdown = false;
  let customEventDate = "";
  let isSubmitting = false;
  let isCustomEvent = false;
  const artistTypeOptions = ["Headliner", "Support", "Local", "Other"];
  const venueOptions = ["New City Gas", "Bazart", "Other"];
  async function loadEvents() {
    try {
      const { data, error } = await supabase.from("events").select("event_id, event_name, event_date, event_flyer").eq("event_status", "LIVE").order("event_date", { ascending: true });
      if (error) {
        console.error("Error loading events:", error);
        return;
      }
      availableEvents = data || [];
    } catch (error) {
      console.error("Error loading events:", error);
    }
  }
  function resetForm() {
    searchValue = "";
    selectedEvent = null;
    artists = [createEmptyArtist()];
    venue = "";
    customVenue = "";
    customEventDate = "";
    isCustomEvent = false;
    showEventDropdown = false;
    showVenueDropdown = false;
    isSubmitting = false;
  }
  function createEmptyArtist() {
    return {
      id: Math.random().toString(36).substr(2, 9),
      name: "",
      type: "",
      customType: "",
      showTypeDropdown: false
    };
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
    loadEvents();
    resetForm();
  }
  if (searchValue && !isCustomEvent) {
    filteredEvents = availableEvents.filter((event) => event.event_name.toLowerCase().includes(searchValue.toLowerCase()) || event.event_id.toString().includes(searchValue));
  } else {
    filteredEvents = availableEvents;
  }
  validArtists = artists.filter((artist) => artist.name.trim() && (artist.type !== "Other" || artist.customType.trim()));
  isFormValid = (selectedEvent || isCustomEvent && searchValue.trim() && customEventDate.trim()) && validArtists.length > 0 && (venue !== "Other" || customVenue.trim()) && venue.trim();
  let $$settled = true;
  let $$inner_payload;
  function $$render_inner($$payload2) {
    Modal($$payload2, {
      title: "Select an event to advance",
      maxWidth: "max-w-4xl",
      hasFooter: true,
      closeOnBackdropClick: true,
      get isOpen() {
        return isOpen;
      },
      set isOpen($$value) {
        isOpen = $$value;
        $$settled = false;
      },
      children: ($$payload3) => {
        $$payload3.out.push(`<div class="space-y-6">`);
        if (!isCustomEvent) {
          $$payload3.out.push("<!--[-->");
          $$payload3.out.push(`<div class="dropdown-container relative"><p class="font-normal text-lime mb-2">Search Events</p> <div class="relative"><input type="text" class="w-full bg-transparent border border-lime rounded-full px-4 py-3 text-white placeholder-gray2 focus:outline-none focus:border-lime focus:ring-1 focus:ring-lime pr-16"${attr("placeholder", selectedEvent ? selectedEvent.event_name : "Search for an event or select custom")}${attr("value", searchValue)}/> <div class="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-2">`);
          if (selectedEvent || searchValue) {
            $$payload3.out.push("<!--[-->");
            $$payload3.out.push(`<button type="button" class="p-1 text-gray2 hover:text-lime rounded-full hover:bg-gray1 transition-colors cursor-pointer" aria-label="Clear selection"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>`);
          } else {
            $$payload3.out.push("<!--[!-->");
          }
          $$payload3.out.push(`<!--]--> <button type="button" class="cursor-pointer" aria-label="Toggle dropdown"><svg${attr_class(`w-4 h-4 text-lime transition-transform ${stringify(showEventDropdown ? "rotate-180" : "")}`)} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"></path></svg></button></div></div> `);
          if (showEventDropdown) {
            $$payload3.out.push("<!--[-->");
            const each_array = ensure_array_like(filteredEvents);
            $$payload3.out.push(`<div class="absolute top-full left-0 right-0 mt-1 bg-navbar border border-lime rounded-lg shadow-lg z-20 max-h-80 overflow-y-auto"><button type="button" class="w-full px-4 py-3 text-left text-white hover:bg-lime hover:text-black transition-colors cursor-pointer border-b border-gray1"><div class="flex items-center gap-3"><div class="w-12 h-12 bg-gray1 rounded-lg flex items-center justify-center"><svg class="w-6 h-6 text-lime" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg></div> <div><p class="font-medium">Custom Advance Event</p> <p class="text-sm opacity-70">Create advance without specific event</p></div></div></button> <!--[-->`);
            for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
              let event = each_array[$$index];
              $$payload3.out.push(`<button type="button" class="w-full px-4 py-3 text-left text-white hover:bg-lime hover:text-black transition-colors cursor-pointer border-b border-gray1 last:border-b-0"><div class="flex items-center gap-3"><div class="w-12 h-12 rounded-lg overflow-hidden bg-gray1 flex-shrink-0">`);
              if (event.event_flyer) {
                $$payload3.out.push("<!--[-->");
                $$payload3.out.push(`<img${attr("src", event.event_flyer)}${attr("alt", event.event_name)} class="w-full h-full object-cover"/>`);
              } else {
                $$payload3.out.push("<!--[!-->");
                $$payload3.out.push(`<div class="w-full h-full bg-gradient-to-br from-lime/40 to-lime/20 flex items-center justify-center"><svg class="w-4 h-4 text-lime" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg></div>`);
              }
              $$payload3.out.push(`<!--]--></div> <div class="flex-1 min-w-0"><p class="font-medium truncate">${escape_html(event.event_name)}</p> <p class="text-sm opacity-70">${escape_html(formatEventDate(event.event_date))} • ID: ${escape_html(event.event_id)}</p></div></div></button>`);
            }
            $$payload3.out.push(`<!--]--> `);
            if (searchValue && filteredEvents.length === 0) {
              $$payload3.out.push("<!--[-->");
              $$payload3.out.push(`<div class="px-4 py-6 text-center text-gray2"><p>No events found matching "${escape_html(searchValue)}"</p></div>`);
            } else {
              $$payload3.out.push("<!--[!-->");
            }
            $$payload3.out.push(`<!--]--></div>`);
          } else {
            $$payload3.out.push("<!--[!-->");
          }
          $$payload3.out.push(`<!--]--></div>`);
        } else {
          $$payload3.out.push("<!--[!-->");
          $$payload3.out.push(`<div class="space-y-4"><div class="flex items-center gap-3 mb-4"><button type="button" class="flex items-center justify-center w-8 h-8 border border-gray2 text-gray2 rounded-full hover:bg-gray2 hover:text-black transition-colors cursor-pointer" aria-label="Back to search"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5"></path><path d="M12 19l-7-7 7-7"></path></svg></button> <h3 class="text-lg font-bold text-white">Create a Custom Event</h3></div> <div><p class="font-normal text-lime mb-2">Event Name</p> <input type="text" class="w-full bg-transparent border border-lime rounded-full px-4 py-3 text-white placeholder-gray2 focus:outline-none focus:border-lime focus:ring-1 focus:ring-lime" placeholder="Enter custom event name"${attr("value", searchValue)}/></div> <div><p class="font-normal text-lime mb-2">Event Date</p> `);
          DatePicker($$payload3, {
            placeholder: "Select event date",
            variant: "slim",
            width: "w-64",
            height: "h-10",
            get value() {
              return customEventDate;
            },
            set value($$value) {
              customEventDate = $$value;
              $$settled = false;
            }
          });
          $$payload3.out.push(`<!----></div></div>`);
        }
        $$payload3.out.push(`<!--]--> `);
        if (selectedEvent || isCustomEvent) {
          $$payload3.out.push("<!--[-->");
          const each_array_1 = ensure_array_like(artists);
          $$payload3.out.push(`<div class="flex gap-6"><div class="w-1/3"><div class="w-full aspect-[3/4] rounded-xl overflow-hidden bg-gray1">`);
          if (selectedEvent?.event_flyer) {
            $$payload3.out.push("<!--[-->");
            $$payload3.out.push(`<img${attr("src", selectedEvent.event_flyer)}${attr("alt", selectedEvent.event_name)} class="w-full h-full object-cover"/>`);
          } else {
            $$payload3.out.push("<!--[!-->");
            $$payload3.out.push(`<div class="w-full h-full bg-gradient-to-br from-lime/40 to-lime/20 flex items-center justify-center"><svg class="w-12 h-12 text-lime" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg></div>`);
          }
          $$payload3.out.push(`<!--]--></div></div> <div class="w-2/3 space-y-6"><div><h3 class="text-xl font-bold text-white mb-2">${escape_html(isCustomEvent ? searchValue || "Custom Event" : selectedEvent?.event_name)}</h3> `);
          if (selectedEvent) {
            $$payload3.out.push("<!--[-->");
            $$payload3.out.push(`<p class="text-gray2">${escape_html(formatEventDate(selectedEvent.event_date))} • ID: ${escape_html(selectedEvent.event_id)}</p>`);
          } else {
            $$payload3.out.push("<!--[!-->");
            if (isCustomEvent && customEventDate) {
              $$payload3.out.push("<!--[-->");
              $$payload3.out.push(`<p class="text-gray2">${escape_html(formatEventDate(customEventDate))} • Custom Event</p>`);
            } else {
              $$payload3.out.push("<!--[!-->");
            }
            $$payload3.out.push(`<!--]-->`);
          }
          $$payload3.out.push(`<!--]--></div> <div><div class="flex items-center justify-between mb-4"><h4 class="text-lg font-bold text-white">Artists</h4> <button type="button" class="px-4 py-2 bg-lime text-black rounded-full font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"${attr("disabled", artists.length >= 5, true)}>Add Artist (${escape_html(artists.length)}/5)</button></div> <div class="space-y-4"><!--[-->`);
          for (let index = 0, $$length = each_array_1.length; index < $$length; index++) {
            let artist = each_array_1[index];
            $$payload3.out.push(`<div class="flex gap-3 items-center"><div class="flex-1"><input type="text" class="w-full bg-transparent border border-lime rounded-full px-4 py-2 text-white placeholder-gray2 focus:outline-none focus:border-lime focus:ring-1 focus:ring-lime" placeholder="Artist name"${attr("value", artist.name)}/></div> <div class="dropdown-container relative w-48">`);
            if (artist.type === "Other") {
              $$payload3.out.push("<!--[-->");
              $$payload3.out.push(`<div class="relative"><input type="text" class="w-full bg-transparent border border-lime rounded-full px-4 py-2 pr-10 text-white placeholder-gray2 focus:outline-none focus:border-lime focus:ring-1 focus:ring-lime" placeholder="Enter custom type"${attr("value", artist.customType)}/> <button type="button" class="absolute right-3 top-1/2 transform -translate-y-1/2 cursor-pointer" aria-label="Toggle dropdown"><svg${attr_class(`w-4 h-4 text-lime transition-transform ${stringify(artist.showTypeDropdown ? "rotate-180" : "")}`)} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"></path></svg></button></div>`);
            } else {
              $$payload3.out.push("<!--[!-->");
              $$payload3.out.push(`<button type="button" class="w-full bg-transparent border border-lime rounded-full px-4 py-2 text-white focus:outline-none focus:border-lime focus:ring-1 focus:ring-lime flex items-center justify-between cursor-pointer"><span${attr_class(clsx(artist.type ? "text-white" : "text-gray2"))}>${escape_html(artist.type || "Type")}</span> <svg${attr_class(`w-4 h-4 text-lime transition-transform ${stringify(artist.showTypeDropdown ? "rotate-180" : "")}`)} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"></path></svg></button>`);
            }
            $$payload3.out.push(`<!--]--> `);
            if (artist.showTypeDropdown) {
              $$payload3.out.push("<!--[-->");
              const each_array_2 = ensure_array_like(artistTypeOptions);
              $$payload3.out.push(`<div class="absolute top-full left-0 right-0 mt-1 bg-navbar border border-lime rounded-lg shadow-lg z-10"><!--[-->`);
              for (let $$index_1 = 0, $$length2 = each_array_2.length; $$index_1 < $$length2; $$index_1++) {
                let option = each_array_2[$$index_1];
                $$payload3.out.push(`<button type="button" class="w-full px-4 py-3 text-left text-white hover:bg-lime hover:text-black transition-colors cursor-pointer border-b border-gray1 last:border-b-0">${escape_html(option)}</button>`);
              }
              $$payload3.out.push(`<!--]--></div>`);
            } else {
              $$payload3.out.push("<!--[!-->");
            }
            $$payload3.out.push(`<!--]--></div> <button type="button" class="flex items-center justify-center w-8 h-8 text-red-500 hover:bg-red-500 hover:text-white rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"${attr("disabled", artists.length <= 1, true)} aria-label="Remove artist"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg></button></div>`);
          }
          $$payload3.out.push(`<!--]--></div></div> <div class="dropdown-container relative"><p class="font-normal text-lime mb-2">Venue</p> <button type="button" class="w-full bg-transparent border border-lime rounded-full px-4 py-3 text-white focus:outline-none focus:border-lime focus:ring-1 focus:ring-lime flex items-center justify-between cursor-pointer"><span${attr_class(clsx(venue ? "text-white" : "text-gray2"))}>`);
          if (venue) {
            $$payload3.out.push("<!--[-->");
            $$payload3.out.push(`${escape_html(venue)}`);
          } else {
            $$payload3.out.push("<!--[!-->");
            $$payload3.out.push(`Select venue`);
          }
          $$payload3.out.push(`<!--]--></span> <svg${attr_class(`w-4 h-4 text-lime transition-transform ${stringify(showVenueDropdown ? "rotate-180" : "")}`)} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"></path></svg></button> `);
          if (showVenueDropdown) {
            $$payload3.out.push("<!--[-->");
            const each_array_3 = ensure_array_like(venueOptions);
            $$payload3.out.push(`<div class="absolute top-full left-0 right-0 mt-1 bg-navbar border border-lime rounded-lg shadow-lg z-10"><!--[-->`);
            for (let $$index_3 = 0, $$length = each_array_3.length; $$index_3 < $$length; $$index_3++) {
              let option = each_array_3[$$index_3];
              $$payload3.out.push(`<button type="button" class="w-full px-4 py-3 text-left text-white hover:bg-lime hover:text-black transition-colors cursor-pointer border-b border-gray1 last:border-b-0">${escape_html(option)}</button>`);
            }
            $$payload3.out.push(`<!--]--></div>`);
          } else {
            $$payload3.out.push("<!--[!-->");
          }
          $$payload3.out.push(`<!--]--> `);
          if (venue === "Other") {
            $$payload3.out.push("<!--[-->");
            $$payload3.out.push(`<input type="text" class="w-full bg-transparent border border-lime rounded-full px-4 py-2 text-white placeholder-gray2 focus:outline-none focus:border-lime focus:ring-1 focus:ring-lime mt-2" placeholder="Enter custom venue"${attr("value", customVenue)}/>`);
          } else {
            $$payload3.out.push("<!--[!-->");
          }
          $$payload3.out.push(`<!--]--></div></div></div>`);
        } else {
          $$payload3.out.push("<!--[!-->");
        }
        $$payload3.out.push(`<!--]--></div>`);
      },
      $$slots: {
        default: true,
        footer: ($$payload3) => {
          $$payload3.out.push(`<div slot="footer" class="flex gap-3 justify-end"><button class="px-6 py-3 border border-gray2 text-gray2 rounded-full hover:bg-gray2 hover:text-black transition-colors cursor-pointer">Cancel</button> <button${attr_class("px-6 py-3 rounded-full transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed", void 0, {
            "bg-lime": isFormValid && !isSubmitting,
            "text-black": isFormValid && !isSubmitting,
            "bg-gray1": !isFormValid || isSubmitting,
            "text-gray2": !isFormValid || isSubmitting,
            "hover:bg-lime": isFormValid && !isSubmitting
          })}${attr("disabled", !isFormValid || isSubmitting, true)}>${escape_html(isSubmitting ? "Adding..." : "Add Event")}</button></div>`);
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
  bind_props($$props, { isOpen });
  pop();
}
function _page($$payload, $$props) {
  push();
  let searchValue = "";
  let currentFilter = "none";
  let loading = true;
  let events = [];
  let showEditModal = false;
  let selectedEvent = null;
  let showAddModal = false;
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
    const artistTypePriority = { "Headliner": 1, "Support": 2, "Local": 3 };
    const getArtistTypePriority = (artistType) => {
      if (!artistType) return 999;
      return artistTypePriority[artistType] || 999;
    };
    switch (filter) {
      case "a-z":
        return sorted.sort((a, b) => a.name.localeCompare(b.name));
      case "z-a":
        return sorted.sort((a, b) => b.name.localeCompare(a.name));
      case "date-asc":
        return sorted.sort((a, b) => parseEventDate(a.date).getTime() - parseEventDate(b.date).getTime());
      case "date-desc":
        return sorted.sort((a, b) => parseEventDate(b.date).getTime() - parseEventDate(a.date).getTime());
      case "none":
      default:
        return sorted.sort((a, b) => {
          const dateA = parseEventDate(a.date).getTime();
          const dateB = parseEventDate(b.date).getTime();
          if (dateA !== dateB) {
            return dateA - dateB;
          }
          const priorityA = getArtistTypePriority(a.artist_type);
          const priorityB = getArtistTypePriority(b.artist_type);
          return priorityA - priorityB;
        });
    }
  }
  sortEvents(events.filter((event) => event.name.toLowerCase().includes(searchValue.toLowerCase()) || event.tags.some((tag) => tag.toLowerCase().includes(searchValue.toLowerCase()))), currentFilter);
  let $$settled = true;
  let $$inner_payload;
  function $$render_inner($$payload2) {
    head($$payload2, ($$payload3) => {
      $$payload3.title = `<title>Advance Gathered</title>`;
    });
    MainLayout($$payload2, {
      pageTitle: "Advance Gathered",
      children: ($$payload3) => {
        $$payload3.out.push(`<div class="h-full overflow-auto"><div class="page-container svelte-1cpunf6"><div${attr_class(`fade-in ${stringify("")} mb-8`, "svelte-1cpunf6")} style="transition-delay: 0.1s;"><div class="controls-container svelte-1cpunf6"><div class="search-container svelte-1cpunf6">`);
        SearchBar($$payload3, {
          placeholder: "Search an artist",
          get value() {
            return searchValue;
          },
          set value($$value) {
            searchValue = $$value;
            $$settled = false;
          }
        });
        $$payload3.out.push(`<!----></div> <div class="buttons-container svelte-1cpunf6"><div class="buttons-left svelte-1cpunf6">`);
        FilterButton($$payload3, {
          get currentFilter() {
            return currentFilter;
          },
          set currentFilter($$value) {
            currentFilter = $$value;
            $$settled = false;
          }
        });
        $$payload3.out.push(`<!----> <button class="refresh-btn svelte-1cpunf6"${attr("disabled", loading, true)} title="Refresh events" aria-label="Refresh events"><svg${attr_class(`w-4 h-4 ${stringify("animate-spin")}`, "svelte-1cpunf6")} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path><path d="M21 3v5h-5"></path><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path><path d="M3 21v-5h5"></path></svg></button></div> <div class="buttons-right svelte-1cpunf6"><button class="add-event-btn svelte-1cpunf6"><span class="flex items-center gap-2"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg> Add Event</span></button></div></div></div></div> `);
        {
          $$payload3.out.push("<!--[-->");
          $$payload3.out.push(`<div class="flex flex-col items-center justify-center py-16 text-center"><div class="w-8 h-8 mb-4 animate-spin svelte-1cpunf6"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-lime"><path d="M21 12a9 9 0 11-6.219-8.56"></path></svg></div> <p class="text-gray2 text-base">Loading events...</p></div>`);
        }
        $$payload3.out.push(`<!--]--></div></div>`);
      },
      $$slots: { default: true }
    });
    $$payload2.out.push(`<!----> `);
    EventEditModal($$payload2, {
      event: selectedEvent,
      get isOpen() {
        return showEditModal;
      },
      set isOpen($$value) {
        showEditModal = $$value;
        $$settled = false;
      }
    });
    $$payload2.out.push(`<!----> `);
    EventAddModal($$payload2, {
      get isOpen() {
        return showAddModal;
      },
      set isOpen($$value) {
        showAddModal = $$value;
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
