import { supabase, startClock, bindHeaderAuth, requireAuthOrRedirect } from './common.js';

startClock();
await bindHeaderAuth();
await requireAuthOrRedirect();

const state = { raw: [], q: "" };

function formatDuration(sec){
  sec = Math.floor(sec || 0);
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${d}j ${h}h ${m}m ${s}s`;
}

async function fetchCompteurs(){
  // vue déjà triée par hiérarchie si elle existe
  const view = 'v_compteur_temps_hierarchie';
  const { data, error } = await supabase.from(view).select("*");
  if (error) { console.error(error); return []; }
  return data || [];
}

function render(){
  const tbody = document.querySelector('#tbl-compteurs tbody');
  tbody.innerHTML = "";
  const q = state.q.trim().toLowerCase();

  state.raw
    .filter(e=>{
      if(!q) return true;
      const hay = [e.prenom_nom||"", e.matricule||"", e.grade||""].join(" ").toLowerCase();
      return hay.includes(q);
    })
    .forEach(e=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${e.grade || ""}</td>
        <td>${e.matricule || ""}</td>
        <td>${e.prenom_nom || ""}</td>
        <td>${formatDuration(e.secondes_semaine)}</td>
        <td>${formatDuration(e.secondes_total)}</td>
        <td>${e.actif ? "✅" : "❌"}</td>
        <td>${e.derniere_maj ? new Date(e.derniere_maj).toLocaleString() : ""}</td>
      `;
      tbody.appendChild(tr);
    });
}

// Realtime sur les sessions
supabase.channel("rt-sessions")
  .on("postgres_changes",{event:"*",schema:"public",table:"compteur_sessions"}, async ()=>{
    state.raw = await fetchCompteurs();
    render();
  })
  .subscribe();

// Init
state.raw = await fetchCompteurs();
render();
function render(){
  const tbody = document.querySelector('#tbl-compteurs tbody');
  tbody.innerHTML = "";
  const q = state.q.trim().toLowerCase();

  state.raw
    .filter(e=>{
      if(!q) return true;
      const hay = [e.prenom_nom||"", e.matricule||"", e.grade||""].join(" ").toLowerCase();
      return hay.includes(q);
    })
    .forEach(e=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${e.grade || ""}</td>
        <td>${e.matricule || ""}</td>
        <td>${e.prenom_nom || ""}</td>
        <td>${formatDuration(e.secondes_semaine)}</td>
        <td>${formatDuration(e.secondes_total)}</td>
        <td class="${e.actif ? 'actif' : 'inactif'}">${e.actif ? "✔" : "✖"}</td>
        <td>${e.derniere_maj ? new Date(e.derniere_maj).toLocaleString() : ""}</td>
      `;
      tbody.appendChild(tr);
    });
}

// Recherche
document.getElementById('q').addEventListener('input', (e)=>{
  state.q = e.target.value;
  render();
});
