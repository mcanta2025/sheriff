import { supabase, startClock, bindHeaderAuth, requireAuthOrRedirect } from './common.js';

startClock();
await bindHeaderAuth();
await requireAuthOrRedirect();

// Hiérarchie des grades (ordre d'affichage)
const GRADE_ORDER = [
  "SHERIFF",
  "UNDER SHERIFF",
  "ASSISTANT SHERIFF",
  "COMMANDER",
  "INSPECTOR",
  "CAPTAIN",
  "LIEUTENANT",
  "SERGEANT",
  "CORPORAL",
  "DEPUTY FIRST CLASS",
  "DEPUTY 3",
  "DEPUTY 2",
  "DEPUTY 1",
  "CADET 1-2"
];

const state = {
  raw: [],
  q: "",
  actif: "all", // all | actif | inactif
};

// Charge les effectifs
async function fetchEffectifs(){
  const { data, error } = await supabase
    .from("effectifs")
    .select("matricule, prenom_nom, grade, date_embauche, sanction, formation_initiale, formation_dea, formation_swat, formation_air17, activite, actif")
    .order("prenom_nom");
  if (error) { console.error(error); return []; }
  return data || [];
}

// Filtrage local
function filterData(list){
  let out = [...list];
  // filtre actif
  if (state.actif === "actif") out = out.filter(e => !!e.actif);
  if (state.actif === "inactif") out = out.filter(e => !e.actif);
  // recherche
  const q = state.q.trim().toLowerCase();
  if (q) {
    out = out.filter(e => {
      const hay = [
        e.prenom_nom || "",
        e.matricule || "",
        e.grade || "",
        e.activite || "",
        e.sanction || ""
      ].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }
  return out;
}

// Regroupe par grade (dans l'ordre hiérarchique)
function groupByGrade(list){
  const grouped = {};
  list.forEach(e=>{
    const g = (e.grade || "AUTRE").toUpperCase();
    if (!grouped[g]) grouped[g] = [];
    grouped[g].push(e);
  });
  // retour ordonné
  return GRADE_ORDER
    .filter(g => grouped[g]?.length)      // ne garder que les grades présents
    .map(g => ({ grade: g, items: grouped[g] }));
}

// Rendu jolie cartes
function render(){
  const cont = document.getElementById("effectifs-container");
  cont.innerHTML = "";

  const filtered = filterData(state.raw);
  const blocks = groupByGrade(filtered);

  if (!blocks.length) {
    cont.innerHTML = `<div class="muted">Aucun effectif ne correspond aux filtres.</div>`;
    return;
  }

  blocks.forEach(block=>{
    // header de grade (repliable)
    const wrap = document.createElement("div");
    wrap.className = "grade-block";

    const header = document.createElement("div");
    header.className = "grade-header";
    header.innerHTML = `<h4>${block.grade}</h4><span class="grade-count">${block.items.length}</span>`;
    wrap.appendChild(header);

    const grid = document.createElement("div");
    grid.className = "cards";

    block.items.forEach(e=>{
      const card = document.createElement("div");
      card.className = "person-card";

      // badges formations
      const tags = [];
      if (e.formation_initiale) tags.push(`<span class="tag ok">Initiale</span>`);
      if (e.formation_dea)      tags.push(`<span class="tag ok">DEA</span>`);
      if (e.formation_swat)     tags.push(`<span class="tag ok">SWAT</span>`);
      if (e.formation_air17)    tags.push(`<span class="tag ok">AIR17</span>`);

      card.innerHTML = `
        <div class="person-top">
          <div class="matricule">#${e.matricule || "—"}</div>
          <div class="${e.actif ? 'badge-active' : 'badge-inactive'}">${e.actif ? 'ACTIF' : 'INACTIF'}</div>
        </div>
        <div style="font-weight:700;margin-bottom:4px">${e.prenom_nom || '(Sans nom)'}</div>
        <div class="person-meta">
          ${e.date_embauche ? `Embauché le ${e.date_embauche}` : 'Date embauche —'}
        </div>
        <div class="tags">${tags.join(" ") || '<span class="tag">Aucune formation</span>'}</div>
        ${e.activite ? `<div class="person-meta">Activité : ${e.activite}</div>` : ''}
        ${e.sanction ? `<div class="person-meta">Sanction : ${e.sanction}</div>` : '<div class="empty-note">Aucune sanction</div>'}
      `;
      grid.appendChild(card);
    });

    wrap.appendChild(grid);
    cont.appendChild(wrap);

    // repli/ouvre sur clic du header
    let collapsed = false;
    header.addEventListener('click', ()=>{
      collapsed = !collapsed;
      grid.style.display = collapsed ? 'none' : 'grid';
      header.querySelector('.grade-count').textContent = collapsed ? `▼ ${block.items.length}` : `${block.items.length}`;
    });
  });
}

// Realtime
supabase.channel("rt-effectifs")
  .on("postgres_changes",{event:"*",schema:"public",table:"effectifs"}, async ()=>{
    state.raw = await fetchEffectifs();
    render();
  })
  .subscribe();

// Init + filtres
state.raw = await fetchEffectifs();
render();

document.getElementById('q').addEventListener('input', (e)=>{
  state.q = e.target.value;
  render();
});
document.getElementById('flt-actif').addEventListener('change', (e)=>{
  state.actif = e.target.value;
  render();
});
