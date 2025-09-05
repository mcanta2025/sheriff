// calculateur.js
import { supabase, startClock, bindHeaderAuth, requireAuthOrRedirect } from './common.js';

startClock();
await bindHeaderAuth();
await requireAuthOrRedirect();

const state = {
  all: [],            // toutes les infractions (DB ou fallback)
  filtered: [],       // après recherche/filtre
  selection: [],      // infractions choisies
  q: "",
  cat: "",
  cls: "",
};

/* ================== Chargement des données ================== */
async function loadInfractions() {
  // 1) Tenter via Supabase (table public.calculateur)
  try {
    const { data, error } = await supabase
      .from("calculateur")
      .select("category, infraction, classification, amende, garde_a_vue, audition, jour_fourriere, peine_compl")
      .limit(2000);
    if (!error && Array.isArray(data) && data.length) {
      return normalizeList(data);
    }
  } catch (e) {
    console.warn("Supabase indisponible ou table absente, on passe au fallback local.", e);
  }

  // 2) Fallback : fichier calculateur_data.js (doit définir window.INFRACTIONS = [ ... ])
  if (Array.isArray(window.INFRACTIONS) && window.INFRACTIONS.length) {
    return normalizeList(window.INFRACTIONS);
  }

  console.error("Aucune donnée d'infractions trouvée.");
  return [];
}

function normalizeList(list) {
  return list.map(x => ({
    category: (x.category || "").trim(),
    infraction: (x.infraction || "").trim(),
    classification: (x.classification || "").toUpperCase().replace("É", "E"),
    amende: Number(x.amende || 0),
    garde_a_vue: (x.garde_a_vue || "").toUpperCase(),  // NON | POSSIBLE | OBLIGATOIRE
    audition: (x.audition || "").toUpperCase(),        // NON | OUI
    jour_fourriere: Number(x.jour_fourriere || 0),
    peine_compl: (x.peine_compl || "").trim(),
  }));
}

/* ================== UI helpers ================== */
const elQ = document.getElementById("q");
const elCat = document.getElementById("filter-category");
const elCls = document.getElementById("filter-class");
const elList = document.getElementById("list-infractions");
const elSel = document.getElementById("selection-list");

const fmtMoney = n => "$" + (Number(n||0)).toLocaleString("fr-FR");
const classColor = cls => {
  const c = (cls || "").toUpperCase().replace("É","E");
  if (c === "CRIME") return "crime";
  if (c === "DELIT" || c === "DÉLIT") return "delit";
  return "contravention";
};

/* ================== Filtres & rendu ================== */
function applyFilters() {
  const q = (state.q || "").toLowerCase();
  const cat = (state.cat || "").toLowerCase();
  const cls = (state.cls || "").toUpperCase().replace("É","E");

  state.filtered = state.all.filter(x => {
    const okQ = !q || (x.infraction.toLowerCase().includes(q) || x.category.toLowerCase().includes(q));
    const okCat = !cat || x.category.toLowerCase() === cat;
    const okCls = !cls || x.classification === cls;
    return okQ && okCat && okCls;
  });

  renderList();
}

function renderFilters() {
  // Catégories uniques
  const cats = Array.from(new Set(state.all.map(x => x.category))).sort((a,b)=>a.localeCompare(b));
  elCat.innerHTML = `<option value="">Toutes catégories</option>` + cats.map(c => `<option value="${c}">${c}</option>`).join("");
}

function renderList() {
  elList.innerHTML = "";

  if (!state.filtered.length) {
    elList.innerHTML = `<div class="muted">Aucune infraction ne correspond à votre recherche.</div>`;
    return;
  }

  // Groupé par catégorie
  const byCat = new Map();
  state.filtered.forEach(x => {
    if (!byCat.has(x.category)) byCat.set(x.category, []);
    byCat.get(x.category).push(x);
  });

  byCat.forEach((items, cat) => {
    const sec = document.createElement("div");
    sec.className = "cat-section";

    const h = document.createElement("h4");
    h.textContent = cat;
    h.className = "cat-title";
    sec.appendChild(h);

    const grid = document.createElement("div");
    grid.className = "inf-grid";

    items.forEach(item => {
      const card = document.createElement("div");
      card.className = `inf-card ${classColor(item.classification)}`;
      card.innerHTML = `
        <div class="inf-head">
          <span class="badge inf-badge">${item.classification}</span>
          <span class="inf-amount">${fmtMoney(item.amende)}</span>
        </div>
        <div class="inf-name">${item.infraction}</div>
        <div class="inf-meta">
          ${item.garde_a_vue ? `<span class="pill">GAV: ${item.garde_a_vue}</span>` : ""}
          ${item.audition ? `<span class="pill">Audition: ${item.audition}</span>` : ""}
          ${Number.isFinite(item.jour_fourriere) ? `<span class="pill">Fourrière: ${item.jour_fourriere}</span>` : ""}
        </div>
        ${item.peine_compl ? `<div class="inf-note muted small">${item.peine_compl}</div>` : ""}
        <div class="inf-actions"><button class="btn add-btn">Ajouter</button></div>
      `;
      card.querySelector(".add-btn").addEventListener("click", () => addToSelection(item));
      grid.appendChild(card);
    });

    sec.appendChild(grid);
    elList.appendChild(sec);
  });
}

/* ================== Sélection & résumé ================== */
function addToSelection(item) {
  state.selection.push(item);
  renderSelection();
}

function removeFromSelection(idx) {
  state.selection.splice(idx,1);
  renderSelection();
}

function clearSelection() {
  state.selection = [];
  renderSelection();
}

function aggregateSelection() {
  const sel = state.selection;

  // Total amendes
  const totalAmende = sel.reduce((s, x) => s + (Number(x.amende)||0), 0);

  // Jours de fourrière : si un 999 présent, on affiche "999" (illimité)
  const has999 = sel.some(x => Number(x.jour_fourriere) === 999);
  const fourriere = has999
    ? "999"
    : sel.reduce((s, x) => s + (Number.isFinite(x.jour_fourriere) ? Number(x.jour_fourriere) : 0), 0);

  // GAV : OBLIGATOIRE > POSSIBLE > NON
  const hasGavObl = sel.some(x => (x.garde_a_vue||"").toUpperCase() === "OBLIGATOIRE");
  const hasGavPos = sel.some(x => (x.garde_a_vue||"").toUpperCase() === "POSSIBLE");
  const gav = hasGavObl ? "OBLIGATOIRE" : (hasGavPos ? "POSSIBLE" : "NON");

  // Audition : OUI si au moins une
  const auditionOui = sel.some(x => (x.audition||"").toUpperCase() === "OUI") ? "OUI" : "NON";

  return { totalAmende, fourriere, gav, auditionOui };
}

function renderSelection() {
  // Résumé
  const agg = aggregateSelection();
  document.getElementById("resume-amende").textContent = fmtMoney(agg.totalAmende);
  document.getElementById("resume-fourriere").textContent = String(agg.fourriere);
  const gavEl = document.getElementById("resume-gav");
  gavEl.textContent = agg.gav;
  gavEl.className = "resume-value badge " + (
    agg.gav === "OBLIGATOIRE" ? "badge-red" : agg.gav === "POSSIBLE" ? "badge-orange" : "badge-green"
  );
  const audEl = document.getElementById("resume-audition");
  audEl.textContent = agg.auditionOui;
  audEl.className = "resume-value badge " + (agg.auditionOui === "OUI" ? "badge-orange" : "badge-green");

  // Liste sélectionnée
  elSel.innerHTML = "";
  if (!state.selection.length) {
    elSel.innerHTML = `<div class="muted small">Aucune infraction sélectionnée.</div>`;
    return;
  }

  state.selection.forEach((it, i) => {
    const row = document.createElement("div");
    row.className = `sel-row ${classColor(it.classification)}`;
    row.innerHTML = `
      <div class="sel-left">
        <span class="badge sel-badge">${it.classification}</span>
        <div class="sel-title">${it.infraction}</div>
        ${it.peine_compl ? `<div class="sel-note muted small">${it.peine_compl}</div>` : ""}
      </div>
      <div class="sel-right">
        <div class="sel-pill">${fmtMoney(it.amende)}</div>
        <div class="sel-pill">F: ${it.jour_fourriere}</div>
        <div class="sel-pill">GAV: ${it.garde_a_vue}</div>
        <button class="btn ghost sel-del">×</button>
      </div>
    `;
    row.querySelector(".sel-del").addEventListener("click", ()=>removeFromSelection(i));
    elSel.appendChild(row);
  });
}

/* ================== Events ================== */
document.getElementById("btn-clear").addEventListener("click", clearSelection);
elQ.addEventListener("input", e => { state.q = e.target.value; applyFilters(); });
elCat.addEventListener("change", e => { state.cat = e.target.value; applyFilters(); });
elCls.addEventListener("change", e => { state.cls = e.target.value; applyFilters(); });

/* ================== Go ================== */
state.all = await loadInfractions();
renderFilters();
applyFilters();
renderSelection();
