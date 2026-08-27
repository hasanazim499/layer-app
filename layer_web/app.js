const ACCORDS = ["Woody", "Citrus", "Vanilla", "Oud", "Floral", "Fresh", "Spicy", "Gourmand"];
const OCCASIONS = [
  { id: "office", label: "Office" },
  { id: "dinnerIndoor", label: "Dinner indoor" },
  { id: "dinnerOutdoor", label: "Dinner outdoor" },
  { id: "club", label: "Club" },
  { id: "weddingIndoor", label: "Wedding indoor" },
  { id: "weddingOutdoor", label: "Wedding outdoor" },
  { id: "date", label: "Date" },
  { id: "casual", label: "Casual" },
];

const COMPLEMENT = {
  citrus: ["woody", "aromatic", "fresh", "green", "floral"],
  woody: ["citrus", "oriental", "spicy", "aromatic", "musk"],
  oriental: ["woody", "vanilla", "spicy", "floral", "amber"],
  floral: ["musk", "citrus", "oriental", "fresh"],
  fresh: ["citrus", "green", "aquatic", "woody"],
  spicy: ["oriental", "woody", "amber"],
  gourmand: ["vanilla", "oriental", "woody"],
  aquatic: ["fresh", "citrus", "green"],
};
const CLASH = {
  oud: ["aquatic", "green"],
  gourmand: ["green", "aquatic"],
  aquatic: ["oud", "gourmand"],
};

let catalog = [];
let state = {
  email: null,
  onboardingDone: false,
  liked: new Set(),
  owned: new Set(),
  weather: "mild",
  tempC: 34,
  humid: true,
  showOwnedOnly: false,
};

function loadState() {
  try {
    const raw = localStorage.getItem("layer_state");
    if (!raw) return;
    const s = JSON.parse(raw);
    state.email = s.email || null;
    state.onboardingDone = !!s.onboardingDone;
    state.liked = new Set(s.liked || []);
    state.owned = new Set(s.owned || []);
  } catch (_) {}
}
function saveState() {
  localStorage.setItem(
    "layer_state",
    JSON.stringify({
      email: state.email,
      onboardingDone: state.onboardingDone,
      liked: [...state.liked],
      owned: [...state.owned],
    })
  );
}

function weatherBucket(c, humid) {
  // humid alone is not enough to force "hot" if temp is mild
  if (c >= 30) return "hot";
  if (c >= 26 && humid) return "hot";
  if (c <= 16) return "cold";
  if (c <= 20) return "cool";
  return "mild";
}

/** 0 = very light … 5 = beast mode */
function intensityOf(p) {
  const f = `${p.family || ""} ${p.name || ""} ${p.concentration || ""}`.toLowerCase();
  let n = 2;
  if (/edt|cologne|legere|light|acqua|mist/.test(f)) n -= 1;
  if (/edp|parfum|extrait|intense|elixir|absolu|forte|noir/.test(f)) n += 1;
  if (/citrus|fresh|aquatic|green|ozonic|marine/.test(f)) n -= 1;
  if (/oud|amber|oriental|gourmand|vanilla|leather|tobacco|spicy|woody/.test(f)) n += 1;
  if (/most wanted|sauvage elixir|interlude|aventus|baccarat|ombi?re/.test(f)) n += 1;
  return Math.max(0, Math.min(5, n));
}

function familyOkWeather(p, w) {
  const f = (p.family || "").toLowerCase();
  const name = (p.name || "").toLowerCase();
  const heavy =
    /oud|amber|oriental|gourmand|vanilla|leather|tobacco/.test(f) ||
    /intense|elixir|absolu|parfum|extrait/.test(name + " " + (p.concentration || "").toLowerCase());

  if (w === "hot") {
    // only light / bright families; block pure woody-aromatic heavies
    if (heavy) return false;
    if (/woody/.test(f) && !/citrus|fresh|green|aquatic/.test(f)) return false;
    return /citrus|fresh|aquatic|green|floral|aromatic fougere|fougere/.test(f) ||
      /citrus|fresh|aquatic|green/.test(f);
  }
  if (w === "cool" || w === "cold") {
    return /oriental|woody|amber|vanilla|spicy|oud|gourmand|aromatic|floral/.test(f);
  }
  // mild: almost everything except ultra-beast in office-less default
  return true;
}

function familyOkOccasion(p, o) {
  const f = (p.family || "").toLowerCase();
  const inten = intensityOf(p);
  const map = {
    office: () => inten <= 2 && /citrus|woody|aromatic|fresh|musk|green|floral/.test(f) && !/oud|gourmand|oriental/.test(f),
    club: () => inten >= 2 && /gourmand|oriental|amber|woody|spicy|oud/.test(f),
    date: () => /floral|oriental|vanilla|musk|amber|woody/.test(f),
    weddingIndoor: () => /floral|oriental|vanilla|musk|amber/.test(f) && inten <= 3,
    dinnerOutdoor: () => /citrus|fresh|floral|woody|green|aromatic/.test(f) && inten <= 3,
    casual: () => /citrus|fresh|floral|woody|green|aromatic/.test(f) && inten <= 3,
    weddingOutdoor: () => /citrus|fresh|floral|woody|green/.test(f) && inten <= 3,
    dinnerIndoor: () => /floral|oriental|woody|aromatic|spicy/.test(f) && inten <= 3,
  };
  return (map[o] || (() => true))();
}

function prefScore(p, liked) {
  if (!liked.size) return 0;
  let s = 0;
  const notes = [...(p.top || []), ...(p.heart || []), ...(p.base || [])];
  for (const n of notes) {
    const low = n.toLowerCase();
    for (const l of liked) if (low.includes(l.toLowerCase())) s += 2;
  }
  const fam = (p.family || "").toLowerCase();
  for (const l of liked) if (fam.includes(l.toLowerCase())) s += 3;
  return s;
}

function weatherFitScore(p, w) {
  const inten = intensityOf(p);
  const f = (p.family || "").toLowerCase();
  if (w === "hot") {
    let s = 0;
    if (/citrus|fresh|aquatic|green/.test(f)) s += 6;
    if (/floral/.test(f)) s += 3;
    if (/aromatic fougere|fougere/.test(f)) s += 2;
    s += Math.max(0, 3 - inten) * 2; // lighter wins
    return s;
  }
  if (w === "cold") {
    let s = 0;
    if (/oriental|oud|amber|gourmand|vanilla/.test(f)) s += 6;
    if (/woody|spicy/.test(f)) s += 4;
    s += inten; // richer wins
    return s;
  }
  if (w === "cool") {
    let s = 0;
    if (/woody|aromatic|spicy|floral/.test(f)) s += 4;
    if (inten >= 1 && inten <= 3) s += 2;
    return s;
  }
  // mild
  return 3 - Math.abs(inten - 2);
}

function complements(a, b) {
  const fa = (a.family || "").toLowerCase();
  const fb = (b.family || "").toLowerCase();
  for (const [k, bad] of Object.entries(CLASH)) {
    if (fa.includes(k) && bad.some((x) => fb.includes(x))) return false;
  }
  // block two heavy hitters stacked
  if (intensityOf(a) >= 4 && intensityOf(b) >= 4) return false;
  if (fa.split(/\s+/).some((t) => t && fb.includes(t))) return true;
  for (const [k, good] of Object.entries(COMPLEMENT)) {
    if (fa.includes(k) && good.some((x) => fb.includes(x))) return true;
  }
  return true;
}

function suggestLayer(occasion = null) {
  const owned = catalog.filter((p) => state.owned.has(p.id));
  if (owned.length < 2) return null;

  let candidates = owned.filter((p) => {
    if (!familyOkWeather(p, state.weather)) return false;
    if (occasion && !familyOkOccasion(p, occasion)) return false;
    return true;
  });
  // soft fallback: if filter wiped everything, relax occasion first, then weather
  if (candidates.length < 2 && occasion) {
    candidates = owned.filter((p) => familyOkWeather(p, state.weather));
  }
  if (candidates.length < 2) candidates = owned;

  let best = null;
  for (let i = 0; i < candidates.length; i++) {
    for (let j = 0; j < candidates.length; j++) {
      if (i === j) continue;
      const a = candidates[i];
      const b = candidates[j];
      if (!complements(a, b)) continue;

      const scoreA =
        weatherFitScore(a, state.weather) * 3 +
        prefScore(a, state.liked) * 2 +
        (occasion ? (familyOkOccasion(a, occasion) ? 2 : -5) : 0);
      const scoreB =
        weatherFitScore(b, state.weather) * 2 +
        prefScore(b, state.liked) +
        (occasion ? (familyOkOccasion(b, occasion) ? 1 : -3) : 0);

      // primary = better weather fit (not just prefs)
      const primary = scoreA >= scoreB ? a : b;
      const support = primary === a ? b : a;
      const total = scoreA + scoreB + (a.family === b.family ? 0 : 2);

      if (!best || total > best.score) {
        best = { primary, support, score: total };
      }
    }
  }
  return best;
}

function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 1800);
}

function showScreen(id) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");
}

function goPage(name) {
  document.querySelectorAll(".page").forEach((p) => p.classList.add("hidden"));
  document.getElementById("page-" + name).classList.remove("hidden");
  document.querySelectorAll(".tab").forEach((t) => {
    t.classList.toggle("active", t.dataset.page === name);
  });
  if (name === "home") renderHome();
  if (name === "collection") renderCollection();
  if (name === "occasions") renderOccasions();
  if (name === "profile") renderProfile();
}

function doAuth(provider) {
  const email =
    provider === "google"
      ? "google@layer.app"
      : provider === "apple"
      ? "apple@layer.app"
      : provider === "yahoo"
      ? "yahoo@layer.app"
      : document.getElementById("auth-email").value.trim() || "user@layer.app";
  state.email = email;
  saveState();
  showScreen("screen-prefs");
  renderPrefs();
}

function renderPrefs() {
  const box = document.getElementById("pref-chips");
  box.innerHTML = ACCORDS.map(
    (a) =>
      `<button class="chip ${state.liked.has(a) ? "on" : ""}" data-a="${a}">${a}</button>`
  ).join("");
  box.querySelectorAll(".chip").forEach((btn) => {
    btn.onclick = () => {
      const a = btn.dataset.a;
      if (state.liked.has(a)) state.liked.delete(a);
      else state.liked.add(a);
      renderPrefs();
      document.getElementById("prefs-continue").disabled = state.liked.size === 0;
    };
  });
  document.getElementById("prefs-continue").disabled = state.liked.size === 0;
}

function savePrefs() {
  state.onboardingDone = true;
  saveState();
  enterApp();
}

function enterApp() {
  state.weather = weatherBucket(state.tempC, state.humid);
  showScreen("screen-shell");
  goPage("home");
}

function bottleCard(p, tag) {
  return `
    <div class="card bottle-row" onclick="openDetail('${p.id}')">
      <div class="avatar-sm">${(p.brand || "?")[0]}</div>
      <div class="bottle-meta">
        <strong>${p.brand} — ${p.name}</strong>
        <span>${p.family || ""} · ${p.concentration || ""}</span>
      </div>
      ${tag ? `<span class="tag">${tag}</span>` : ""}
    </div>`;
}

function renderHome() {
  document.getElementById("home-weather").textContent =
    `Today · ${state.tempC}°C · ${state.weather}`;
  const layer = suggestLayer();
  const cards = document.getElementById("layer-cards");
  const hint = document.getElementById("home-hint");
  const wear = document.getElementById("wear-btn");
  if (!layer) {
    cards.innerHTML = "";
    hint.textContent =
      state.owned.size < 2
        ? "Add at least 2 bottles in Collection to get a layer."
        : "No matching pair for this weather — try adding more bottles.";
    wear.classList.add("hidden");
  } else {
    hint.textContent = "2-bottle layer matched to weather + your taste.";
    cards.innerHTML =
      bottleCard(layer.primary, "Primary") + bottleCard(layer.support, "Support");
    wear.classList.remove("hidden");
  }
  const chips = document.getElementById("occasion-chips");
  chips.innerHTML = OCCASIONS.map(
    (o) => `<button class="chip" data-o="${o.id}">${o.label}</button>`
  ).join("");
  chips.querySelectorAll(".chip").forEach((btn) => {
    btn.onclick = () => {
      const pair = suggestLayer(btn.dataset.o);
      if (!pair) return toast("Add 2+ bottles first");
      toast(`${btn.textContent}: ${pair.primary.name} + ${pair.support.name}`);
    };
  });
}

function wearLayer() {
  toast("Layer saved for today");
}

let currentBrand = null;

function brandsByLetter() {
  const map = {};
  for (const p of catalog) {
    const b = p.brand || "Other";
    map[b] = (map[b] || 0) + 1;
  }
  const groups = {};
  Object.keys(map)
    .sort((a, b) => a.localeCompare(b))
    .forEach((n) => {
      const L = n[0].toUpperCase();
      const key = /[A-Z]/.test(L) ? L : "#";
      if (!groups[key]) groups[key] = [];
      groups[key].push({ name: n, count: map[n] });
    });
  return groups;
}

function openBrandIndex() {
  const groups = brandsByLetter();
  const letters = Object.keys(groups).sort();
  document.getElementById("letter-bar").innerHTML = letters
    .map((L) => `<button onclick="document.getElementById('letter-${L}').scrollIntoView()">${L}</button>`)
    .join("");
  document.getElementById("brand-list").innerHTML = letters
    .map((L) => {
      const rows = groups[L]
        .map((b) => {
          const safe = b.name.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
          return `<div class="brand-row" onclick="openBrand('${safe}')"><strong>${b.name}</strong><span>${b.count}</span></div>`;
        })
        .join("");
      return `<div id="letter-${L}" class="letter-head">${L}</div>${rows}`;
    })
    .join("");
  showScreen("screen-brands");
}

function openBrand(name) {
  currentBrand = name;
  document.getElementById("brand-title").textContent = name;
  const bottles = catalog
    .filter((p) => p.brand === name)
    .sort((a, b) => a.name.localeCompare(b.name));
  document.getElementById("brand-bottles").innerHTML = bottles
    .map((p) => {
      const on = state.owned.has(p.id);
      return `
      <div class="bottle-row" onclick="openDetail('${p.id}')">
        <div class="avatar-sm">${(p.name || "?")[0]}</div>
        <div class="bottle-meta">
          <strong>${p.name}</strong>
          <span>${p.family || ""} · ${p.concentration || ""}</span>
        </div>
        ${on ? '<span class="tag">owned</span>' : ""}
      </div>`;
    })
    .join("");
  showScreen("screen-brand-bottles");
}

function renderCollection() {
  const owned = catalog.filter((p) => state.owned.has(p.id));
  document.getElementById("owned-count").textContent =
    owned.length === 0 ? "Nothing yet. Add your bottles." : `${owned.length} owned`;
  document.getElementById("owned-list").innerHTML = owned
    .map(
      (p) => `
      <div class="bottle-row" onclick="openDetail('${p.id}')">
        <div class="avatar-sm">${(p.brand || "?")[0]}</div>
        <div class="bottle-meta">
          <strong>${p.brand} — ${p.name}</strong>
          <span>${p.family || ""} · ${p.concentration || ""}</span>
        </div>
      </div>`
    )
    .join("");
}

function closeToCollection() {
  showScreen("screen-shell");
  goPage("collection");
}

function toggleOwn(id, e) {
  if (e) e.stopPropagation();
  if (state.owned.has(id)) state.owned.delete(id);
  else state.owned.add(id);
  saveState();
}

function renderOccasions() {
  document.getElementById("occasion-grid").innerHTML = OCCASIONS.map(
    (o) => `<div class="grid-card" onclick="pickOccasion('${o.id}','${o.label}')">${o.label}</div>`
  ).join("");
}

function pickOccasion(id, label) {
  const pair = suggestLayer(id);
  if (!pair) return toast("Add 2+ bottles first");
  toast(`${label}: ${pair.primary.name} + ${pair.support.name}`);
}

function renderProfile() {
  document.getElementById("profile-email").textContent = state.email || "Guest";
  document.getElementById("profile-weather").textContent = state.weather;
  document.getElementById("profile-likes").textContent =
    state.liked.size ? [...state.liked].join(", ") : "None";
  document.getElementById("profile-owned").textContent = state.owned.size;
}

function openDetail(id) {
  const p = catalog.find((x) => x.id === id);
  if (!p) return;
  document.getElementById("detail-title").textContent = p.name;
  const notes = (label, arr) =>
    arr && arr.length
      ? `<div class="notes"><h4>${label}</h4>${arr
          .map((n) => `<span class="note-chip">${n}</span>`)
          .join("")}</div>`
      : "";
  const on = state.owned.has(p.id);
  document.getElementById("detail-body").innerHTML = `
    <div class="avatar-sm" style="width:64px;height:64px;font-size:1.4rem;margin-bottom:12px">${(p.brand || "?")[0]}</div>
    <h2>${p.brand}</h2>
    <h3 style="font-weight:500;margin-bottom:8px">${p.name}</h3>
    <p class="muted">${p.family || ""} · ${p.concentration || ""} · ${p.gender || ""}</p>
    ${notes("Top", p.top)}
    ${notes("Heart", p.heart)}
    ${notes("Base", p.base)}
    <button class="btn primary" onclick="toggleOwnFromDetail('${p.id}')">${on ? "In collection ✓" : "Add to my collection"}</button>
  `;
  showScreen("screen-detail");
}

function toggleOwnFromDetail(id) {
  if (state.owned.has(id)) state.owned.delete(id);
  else state.owned.add(id);
  saveState();
  toast(state.owned.has(id) ? "Added to collection" : "Removed");
  openDetail(id);
}

function backFromDetail() {
  if (currentBrand) openBrand(currentBrand);
  else closeToCollection();
}

function resetAll() {
  localStorage.removeItem("layer_state");
  state = {
    email: null,
    onboardingDone: false,
    liked: new Set(),
    owned: new Set(),
    weather: "mild",
    tempC: 34,
    humid: true,
    showOwnedOnly: false,
  };
  showScreen("screen-auth");
}

async function boot() {
  loadState();
  catalog = window.CATALOG || [];
  if (!catalog.length) toast("Catalog failed to load");
  if (state.onboardingDone && state.email) enterApp();
  else if (state.email) {
    showScreen("screen-prefs");
    renderPrefs();
  } else showScreen("screen-auth");
}

boot();
