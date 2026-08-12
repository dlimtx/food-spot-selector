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
const againBtn = document.getElementById("againBtn");
const resultEl = document.getElementById("result");
const emptyEl = document.getElementById("empty");
const dayNote = document.getElementById("dayNote");

const resultPlace = document.getElementById("resultPlace");
const resultCuisine = document.getElementById("resultCuisine");
const resultLocation = document.getElementById("resultLocation");
const resultHours = document.getElementById("resultHours");
const resultClosed = document.getElementById("resultClosed");

/** @type {Array<{place:string,cuisine:string,dishes:string[],open:number,close:number,closingDays:string[],locations:string[]}>} */
let spots = [];
/** @type {string|null} */
let lastSuggestion = null;

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

function matchesFilters(spot, hour, location, cuisine, dish, dayCode) {
  if (spot.closingDays.includes(dayCode)) return false;
  if (!isOpenAt(spot, hour)) return false;
  if (location !== "Any" && !spot.locations.includes(location)) return false;
  if (cuisine !== "Any" && spot.cuisine !== cuisine) return false;
  if (dish !== "Any" && !spot.dishes.includes(dish)) return false;
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

  const locations = [
    { value: "Any", label: "Any area" },
    ...[...new Set(data.flatMap((s) => s.locations))]
      .sort()
      .map((loc) => ({ value: loc, label: loc })),
  ];

  const cuisines = [
    { value: "Any", label: "Any cuisine" },
    ...[...new Set(data.map((s) => s.cuisine))]
      .sort()
      .map((cuisine) => ({ value: cuisine, label: cuisine })),
  ];

  const dishes = [
    { value: "Any", label: "Any dish" },
    ...[...new Set(data.flatMap((s) => s.dishes))]
      .sort((a, b) => a.localeCompare(b))
      .map((dish) => ({ value: dish, label: dish })),
  ];

  fillSelect(daySelect, days, dayCode);
  fillSelect(timeSelect, hours, String(currentHour));
  fillSelect(locationSelect, locations, "Any");
  fillSelect(cuisineSelect, cuisines, "Any");
  fillSelect(dishSelect, dishes, "Any");
}

function pickSuggestion(candidates) {
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  const pool =
    lastSuggestion == null
      ? candidates
      : candidates.filter((spot) => spot.place !== lastSuggestion);

  const choices = pool.length > 0 ? pool : candidates;
  return choices[Math.floor(Math.random() * choices.length)];
}

function showEmpty() {
  resultEl.hidden = true;
  emptyEl.hidden = false;
}

function showResult(spot) {
  emptyEl.hidden = true;
  resultEl.hidden = false;
  resultEl.classList.remove("is-refreshing");
  // Retrigger animation on repeat suggestions
  void resultEl.offsetWidth;
  resultEl.classList.add("is-refreshing");

  resultPlace.textContent = spot.place;
  resultCuisine.textContent = spot.cuisine;
  resultLocation.textContent = spot.locations.join(", ");
  resultHours.textContent = formatHours(spot);
  resultClosed.textContent =
    spot.closingDays.length > 0 ? spot.closingDays.join(", ") : "None listed";

  lastSuggestion = spot.place;
}

function suggest() {
  const hour = Number(timeSelect.value);
  const location = locationSelect.value;
  const cuisine = cuisineSelect.value;
  const dish = dishSelect.value;
  const dayCode = daySelect.value;

  const matches = spots.filter((spot) =>
    matchesFilters(spot, hour, location, cuisine, dish, dayCode)
  );
  const pick = pickSuggestion(matches);

  if (!pick) {
    showEmpty();
    return;
  }

  showResult(pick);
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
  againBtn.addEventListener("click", suggest);
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
