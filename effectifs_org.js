import { supabase, startClock, bindHeaderAuth, requireAuthOrRedirect } from './common.js';

startClock();
await bindHeaderAuth();
await requireAuthOrRedirect();

/* Hiérarchie des grades (du plus haut au plus bas) */
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
  q: ""
};

async function fetchEffectifs(){
  const { data, error } = await supabase
    .from("effectifs")
    .select("matricule, prenom_nom, grade, actif, formation_initiale, formation_dea, formation_swat, formation_air17")
    .order("prenom_nom");
  if (error) { console.error(error); return []; }
  return data || [];
}

function filterData(list){
  const q = state.q.trim().toLowerCase();
  if(!q) return list;
  return list.filter(e=>{
    const hay = [e.prenom_nom||"", e.matricule||"", e.grade||""].join(" ").toLowerCase();
    return hay.includes(q);
  });
}

function groupByGrade(list){
  const map = new Map(GRADE_ORDER.map(g => [g, []]));
  list.forEach(e=>{
    const g = (e.grade || "AUTRE").toUpperCase();
    if(!map.has(g)) map.set(g, []);
    map.get(g).push(e);
  });
  return Array.from(map.entries())
    .filter(([,arr])=>arr.length)
    .map(([grade, items]) => ({ grade, items }));
}

/* rendu d'une "puce" personne (chip) */
function personChip(p){
  const chip = document.createElement('div');
  chip.className = "org-chip";
  chip.innerHTML = `
    <div class="org-chip-top">
      <span class="org-mat">#${p.matricule||"—"}</span>
      <span class="org-badge ${p.actif ? 'on' : 'off'}">${p.actif ? 'ACTIF' : 'INACTIF'}</span>
    </div>
    <div class="org-name">${p.prenom_nom||"(Sans nom)"}</div>
    <div class="org-tags">
      ${p.formation_initiale ? '<span class="tag ok">Initiale</span>' : ''}
      ${p.formation_dea      ? '<span class="tag ok">DEA</span>'      : ''}
      ${p.formation_swat     ? '<span class="tag ok">SWAT</span>'     : ''}
      ${p.formation_air17    ? '<span class="tag ok">AIR17</span>'    : ''}
    </div>
  `;
  return chip;
}

function render(){
  const cont = document.getElementById('org');
  cont.innerHTML = "";

  const list = filterData(state.raw);
  document.getElementById('count-total').textContent = list.length;

  const blocks = groupByGrade(list);

  // Conteneur "niveaux" (une rangée par grade)
  blocks.forEach((block, idx)=>{
    const level = document.createElement('div');
    level.className = "org-level";

    // entête du niveau
    const header = document.createElement('div');
    header.className = "org-level-header";
    header.innerHTML = `<h4>${block.grade}</h4><span class="grade-count">${block.items.length}</span>`;
    level.appendChild(header);

    // rangée des personnes
    const row = document.createElement('div');
    row.className = "org-row";

    block.items.forEach(p=>{
      row.appendChild(personChip(p));
    });

    level.appendChild(row);
    cont.appendChild(level);

    // Connecteur vertical entre les niveaux (sauf après le dernier)
    if (idx < blocks.length - 1){
      const connector = document.createElement('div');
      connector.className = "org-connector";
      cont.appendChild(connector);
    }
  });
}

/* Realtime : si effectifs change, on reconstruit */
supabase.channel("rt-effectifs")
  .on("postgres_changes",{event:"*",schema:"public",table:"effectifs"}, async ()=>{
    state.raw = await fetchEffectifs();
    render();
  })
  .subscribe();

/* Init + search */
state.raw = await fetchEffectifs();
render();

document.getElementById('q').addEventListener('input', e=>{
  state.q = e.target.value;
  render();
});
