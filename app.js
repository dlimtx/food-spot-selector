const DAY_CODES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

// SHA-256 of the shared password. Change password by updating this hash.
const PASSWORD_HASH =
  "615fb40b1393a20b5ca90457e8e36dbbaaf1068de221e5e2e38fdaefcffee26d";
const AUTH_KEY = "eat-where-unlocked";

const gateForm = document.getElementById("gateForm");
const passwordInput = document.getElementById("password");
const gateError = document.getElementById("gateError");
const pickerEl = document.getElementById("picker");

const daySelect = document.getElementById("day");
const timeSelect = document.getElementById("time");
const locationSelect = document.getElementById("location");
const cuisineSelect = document.getElementById("cuisine");
const dishSelect = document.getElementById("dish");
const suggestBtn = document.getElementById("suggestBtn");
const resultEl = document.getElementById("result");
const resultKicker = document.getElementById("resultKicker");
const resultList = document.getElementById("resultList");
const emptyEl = document.getElementById("empty");
const dayNote = document.getElementById("dayNote");

/** @type {ReturnType<typeof createMultiSelect>[]} */
const multiSelects = [];
/** @type {ReturnType<typeof createMultiSelect> | null} */
let locationSelectApi = null;
/** @type {ReturnType<typeof createMultiSelect> | null} */
let cuisineSelectApi = null;
/** @type {ReturnType<typeof createMultiSelect> | null} */
let dishSelectApi = null;

/** @type {Array<{place:string,cuisine:string,dishes:string[],open:number,close:number,closingDays:string[],locations:string[]}>} */
let spots = [];

function formatHour(hour) {
  const h = ((hour % 24) + 24) % 24;
  if (h === 0) return "12:00 AM";
  if (h === 12) return "12:00 PM";
  if (h < 12) return `${h}:00 AM`;
  return `${h - 12}:00 PM`;
}

function formatHours(spot) {
  if (spot.open === 0 && spot.close === 24) return "Open 24 hours";
  return `${formatHour(spot.open)} – ${formatHour(spot.close)}`;
}

function isOpenAt(spot, hour) {
  const open = spot.open;
  const close = spot.close;

  if (open === 0 && close === 24) return true;
  if (open === close) return true;

  // Overnight window, e.g. 17 → 5 or 12 → 0
  if (close < open) {
    return hour >= open || hour < close;
  }

  return hour >= open && hour < close;
}

function matchesAny(selected, values) {
  if (selected.length === 0) return true;
  return selected.some((value) => values.includes(value));
}

function matchesFilters(spot, hour, locations, cuisines, dishes, dayCode) {
  if (spot.closingDays.includes(dayCode)) return false;
  if (!isOpenAt(spot, hour)) return false;
  if (!matchesAny(locations, spot.locations)) return false;
  if (!matchesAny(cuisines, [spot.cuisine])) return false;
  if (!matchesAny(dishes, spot.dishes)) return false;
  return true;
}

function fillSelect(select, options, selectedValue) {
  select.innerHTML = "";
  for (const option of options) {
    const el = document.createElement("option");
    el.value = option.value;
    el.textContent = option.label;
    if (option.value === selectedValue) el.selected = true;
    select.appendChild(el);
  }
}

function optionId(prefix, value, index) {
  const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${prefix}-${slug || "option"}-${index}`;
}

function summarizeSelection(values, emptyLabel) {
  if (values.length === 0) return emptyLabel;
  if (values.length <= 2) return values.join(", ");
  return `${values.length} selected`;
}

function closeAllMultiSelects(except) {
  for (const ms of multiSelects) {
    if (ms !== except) ms.close();
  }
}

function createMultiSelect(container, options) {
  const emptyLabel = container.dataset.emptyLabel || "Any";
  const searchable = container.dataset.searchable === "true";
  const searchPlaceholder = container.dataset.searchPlaceholder || "Search";
  const labelledBy = container.previousElementSibling?.id;

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.id = `${container.id}Toggle`;
  toggle.className = "multiselect__toggle";
  toggle.setAttribute("aria-haspopup", "true");
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-controls", `${container.id}Panel`);

  const valueEl = document.createElement("span");
  valueEl.className = "multiselect__value";
  valueEl.textContent = emptyLabel;
  toggle.append(valueEl);

  const panel = document.createElement("div");
  panel.id = `${container.id}Panel`;
  panel.className = "multiselect__panel";
  panel.hidden = true;

  let searchInput = null;
  if (searchable) {
    searchInput = document.createElement("input");
    searchInput.type = "search";
    searchInput.className = "multiselect__search";
    searchInput.placeholder = searchPlaceholder;
    searchInput.setAttribute("aria-label", searchPlaceholder);
    searchInput.autocomplete = "off";
    panel.append(searchInput);
  }

  const toolbar = document.createElement("div");
  toolbar.className = "multiselect__toolbar";
  const clearBtn = document.createElement("button");
  clearBtn.type = "button";
  clearBtn.className = "multiselect__clear";
  clearBtn.textContent = "Clear";
  clearBtn.disabled = true;
  toolbar.append(clearBtn);
  panel.append(toolbar);

  const list = document.createElement("ul");
  list.className = "multiselect__options";
  list.setAttribute("role", "group");
  if (labelledBy) list.setAttribute("aria-labelledby", labelledBy);

  const emptySearch = document.createElement("p");
  emptySearch.className = "multiselect__empty";
  emptySearch.textContent = "No matches";
  emptySearch.hidden = true;

  options.forEach((option, index) => {
    const item = document.createElement("li");
    item.className = "multiselect__option";

    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = option;
    input.id = optionId(container.id, option, index);
    const text = document.createElement("span");
    text.textContent = option;
    label.append(input, text);
    item.append(label);
    list.append(item);
  });

  const listWrap = document.createElement("div");
  listWrap.className = "multiselect__list-wrap";
  listWrap.append(list, emptySearch);
  panel.append(listWrap);
  container.replaceChildren(toggle, panel);

  function getValues() {
    return [...list.querySelectorAll('input[type="checkbox"]:checked')].map(
      (input) => input.value
    );
  }

  function syncSummary() {
    const values = getValues();
    valueEl.textContent = summarizeSelection(values, emptyLabel);
    clearBtn.disabled = values.length === 0;
  }

  function setOpen(open) {
    if (open) closeAllMultiSelects(api);
    panel.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    container.classList.toggle("is-open", open);
    if (open && searchInput) searchInput.focus();
  }

  function filterOptions() {
    if (!searchInput) return;
    const query = searchInput.value.trim().toLowerCase();
    let visible = 0;
    for (const item of list.children) {
      const match =
        query === "" || item.textContent.toLowerCase().includes(query);
      item.hidden = !match;
      if (match) visible += 1;
    }
    emptySearch.hidden = visible > 0;
  }

  toggle.addEventListener("click", (event) => {
    event.stopPropagation();
    setOpen(panel.hidden);
  });

  panel.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  list.addEventListener("change", syncSummary);

  clearBtn.addEventListener("click", () => {
    for (const input of list.querySelectorAll('input[type="checkbox"]')) {
      input.checked = false;
    }
    syncSummary();
    if (searchInput) {
      searchInput.value = "";
      filterOptions();
    }
  });

  if (searchInput) {
    searchInput.addEventListener("input", filterOptions);
  }

  const api = {
    getValues,
    close() {
      setOpen(false);
    },
  };

  multiSelects.push(api);
  syncSummary();
  return api;
}

function populateControls(data) {
  const now = new Date();
  const currentHour = now.getHours();
  const dayCode = DAY_CODES[now.getDay()];

  const days = DAY_CODES.map((code, index) => ({
    value: code,
    label: DAY_NAMES[index],
  }));

  const hours = Array.from({ length: 24 }, (_, hour) => ({
    value: String(hour),
    label: formatHour(hour),
  }));

  const locations = [...new Set(data.flatMap((s) => s.locations))].sort();
  const cuisines = [...new Set(data.map((s) => s.cuisine))].sort();
  const dishes = [...new Set(data.flatMap((s) => s.dishes))].sort((a, b) =>
    a.localeCompare(b)
  );

  fillSelect(daySelect, days, dayCode);
  fillSelect(timeSelect, hours, String(currentHour));
  multiSelects.length = 0;
  locationSelectApi = createMultiSelect(locationSelect, locations);
  cuisineSelectApi = createMultiSelect(cuisineSelect, cuisines);
  dishSelectApi = createMultiSelect(dishSelect, dishes);
}

function showEmpty() {
  resultEl.hidden = true;
  resultKicker.textContent = "";
  resultList.replaceChildren();
  emptyEl.hidden = false;
}

function metaItem(label, value) {
  const wrap = document.createElement("div");
  const dt = document.createElement("dt");
  dt.textContent = label;
  const dd = document.createElement("dd");
  dd.textContent = value;
  wrap.append(dt, dd);
  return wrap;
}

function renderSpotCard(spot) {
  const item = document.createElement("li");
  item.className = "result-card";

  const place = document.createElement("h2");
  place.className = "result-card__place";
  place.textContent = spot.place;

  const meta = document.createElement("dl");
  meta.className = "result__meta";
  meta.append(
    metaItem("Cuisine", spot.cuisine),
    metaItem(
      "Dish",
      spot.dishes.length > 0 ? spot.dishes.join(", ") : "None listed"
    ),
    metaItem("Area", spot.locations.join(", ")),
    metaItem("Hours", formatHours(spot)),
    metaItem(
      "Closed",
      spot.closingDays.length > 0 ? spot.closingDays.join(", ") : "None listed"
    )
  );

  item.append(place, meta);
  return item;
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function showResults(matches) {
  emptyEl.hidden = true;
  resultEl.hidden = false;
  resultEl.classList.remove("is-refreshing");
  void resultEl.offsetWidth;
  resultEl.classList.add("is-refreshing");

  const count = matches.length;
  resultKicker.textContent =
    count === 1 ? "1 matching spot" : `${count} matching spots`;
  resultList.replaceChildren(...matches.map(renderSpotCard));
}

function suggest() {
  const hour = Number(timeSelect.value);
  const locations = locationSelectApi.getValues();
  const cuisines = cuisineSelectApi.getValues();
  const dishes = dishSelectApi.getValues();
  const dayCode = daySelect.value;

  const matches = shuffle(
    spots.filter((spot) =>
      matchesFilters(spot, hour, locations, cuisines, dishes, dayCode)
    )
  );

  if (matches.length === 0) {
    showEmpty();
    return;
  }

  showResults(matches);
}

async function hashPassword(value) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function unlockApp() {
  sessionStorage.setItem(AUTH_KEY, "1");
  gateForm.hidden = true;
  pickerEl.hidden = false;
}

function isUnlocked() {
  return sessionStorage.getItem(AUTH_KEY) === "1";
}

async function startApp() {
  const response = await fetch("./data/food_spots.json");
  if (!response.ok) {
    throw new Error("Could not load food spots data.");
  }

  spots = await response.json();
  populateControls(spots);

  suggestBtn.addEventListener("click", suggest);

  document.addEventListener("click", () => closeAllMultiSelects());
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeAllMultiSelects();
  });
}

async function init() {
  gateForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    gateError.hidden = true;

    const hash = await hashPassword(passwordInput.value);
    if (hash !== PASSWORD_HASH) {
      gateError.hidden = false;
      passwordInput.select();
      return;
    }

    unlockApp();
    await startApp();
  });

  if (isUnlocked()) {
    unlockApp();
    await startApp();
    return;
  }

  passwordInput.focus();
}

init().catch((error) => {
  unlockApp();
  dayNote.hidden = false;
  dayNote.textContent = error.message;
  console.error(error);
});
