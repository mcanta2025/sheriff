import { supabase, startClock, bindHeaderAuth, requireAuthOrRedirect } from './common.js';

startClock();
await bindHeaderAuth();
await requireAuthOrRedirect();

const state = { raw: [], q: "" };

// Charger depuis la vue hiérarchique
async function fetchCompteurs(){
  const { data, error } = await supabase
    .from("v_compteur_effectifs_hierarchie")
    .select("*");
  if(error){ console.error(error); return []; }
  return data || [];
}

// Filtrer par recherche
function filterData(list){
  const q = state.q.trim().toLowerCase();
  if(!q) return list;
  return list.filter(e=>{
    const hay = [e.prenom_nom||"", e.matricule||"", e.grade||""].join(" ").toLowerCase();
    return hay.includes(q);
  });
}

// Rendu
function render(){
  const cont = document.getElementById("compteurs-container");
  cont.innerHTML = "";

  const grouped = {};
  filterData(state.raw).forEach(e=>{
    const g = e.grade || "AUTRE";
    if(!grouped[g]) grouped[g] = [];
    grouped[g].push(e);
  });

  Object.entries(grouped).forEach(([grade, items])=>{
    const block = document.createElement("div");
    block.className = "grade-block";

    const header = document.createElement("div");
    header.className = "grade-header";
    header.innerHTML = `<h4>${grade}</h4><span class="grade-count">${items.length}</span>`;
    block.appendChild(header);

    const grid = document.createElement("div");
    grid.className = "cards";

    items.forEach(e=>{
      const card = document.createElement("div");
      card.className = "person-card";
      card.innerHTML = `
        <div class="person-top">
          <div class="matricule">#${e.matricule}</div>
          <div class="${e.actif ? 'badge-active' : 'badge-inactive'}">${e.actif ? 'ACTIF' : 'INACTIF'}</div>
        </div>
        <div style="font-weight:700;margin-bottom:4px">${e.prenom_nom||"(Sans nom)"}</div>
        <div class="person-meta">Semaine : ${e.total_semaine_courante||0}</div>
        <div class="person-meta">Total : ${e.total_global||0}</div>
        <div class="person-meta small muted">${e.derniere_maj ? "Maj " + new Date(e.derniere_maj).toLocaleString() : ""}</div>
      `;
      grid.appendChild(card);
    });

    block.appendChild(grid);
    cont.appendChild(block);
  });
}

// Realtime
supabase.channel("rt-compteur")
  .on("postgres_changes",{event:"*",schema:"public",table:"compteur_heures"}, async ()=>{
    state.raw = await fetchCompteurs();
    render();
  })
  .subscribe();

// Init
state.raw = await fetchCompteurs();
render();

// Filtre
document.getElementById('q').addEventListener('input', e=>{
  state.q = e.target.value;
  render();
});
