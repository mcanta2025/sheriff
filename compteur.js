import { supabase, startClock, bindHeaderAuth, requireAuthOrRedirect } from './common.js';

startClock();
await bindHeaderAuth();
await requireAuthOrRedirect();

const state = {
  raw: [],
  q: "",
  sortKey: "grade_ordre",
  sortDir: "asc",
};

function formatDuration(sec){
  sec = Math.floor(sec || 0);
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${d}j ${h}h ${m}m ${s}s`;
}
const cmpText = (a,b)=> (a||"").localeCompare(b||"", undefined, {sensitivity:"base"});
const cmpNum  = (a,b)=> (Number(a)||0) - (Number(b)||0);

async function fetchCompteurs(){
  const VIEW = "v_compteur_temps_hierarchie";
  const { data, error } = await supabase.from(VIEW).select("*");
  if(error){ console.error("fetchCompteurs", error); return []; }
  return data || [];
}

function filtered(){
  const q = state.q.trim().toLowerCase();
  let arr = [...state.raw];
  if(q){
    arr = arr.filter(e=>{
      const hay = [ e.prenom_nom||"", e.matricule||"", e.grade||"" ].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }
  return arr;
}

function sorted(list){
  const { sortKey, sortDir } = state;
  const dir = sortDir === "desc" ? -1 : 1;
  return list.sort((A,B)=>{
    const a = A?.[sortKey];
    const b = B?.[sortKey];
    if (sortKey === "secondes_semaine" || sortKey === "derniere_maj" || sortKey === "grade_ordre")
      return dir * cmpNum(a,b);
    if (sortKey === "actif")
      return dir * ((b?1:0) - (a?1:0));
    if (sortKey === "grade" || sortKey === "matricule" || sortKey === "prenom_nom")
      return dir * cmpText(a,b);
    return 0;
  });
}

function render(){
  const tbody = document.querySelector('#tbl-compteurs tbody');
  if(!tbody) return;
  tbody.innerHTML = "";

  const rows = sorted(filtered());
  rows.forEach(e=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${e.grade || ""}</td>
      <td>${e.matricule || ""}</td>
      <td>${e.prenom_nom || ""}</td>
      <td style="text-align:center;font-weight:600">${formatDuration(e.secondes_semaine)}</td>
      <td class="${e.actif ? 'actif' : 'inactif'}" style="text-align:center;font-weight:600">${e.actif ? "✔" : "✖"}</td>
      <td>${e.derniere_maj ? new Date(e.derniere_maj).toLocaleString() : ""}</td>
    `;
    tbody.appendChild(tr);
  });

  decorateSortedHeader();
}

const headerMap = [
  { thIndex: 0, key: "grade" },
  { thIndex: 1, key: "matricule" },
  { thIndex: 2, key: "prenom_nom" },
  { thIndex: 3, key: "secondes_semaine" },
  { thIndex: 4, key: "actif" },
  { thIndex: 5, key: "derniere_maj" },
];

function bindHeaderSorting(){
  const ths = document.querySelectorAll('#tbl-compteurs thead th');
  ths.forEach((th, i)=>{
    const map = headerMap.find(m=>m.thIndex===i);
    if(!map) return;
    th.style.cursor = "pointer";
    th.title = "Cliquer pour trier";
    th.addEventListener('click', ()=>{
      if(state.sortKey === map.key){
        state.sortDir = (state.sortDir === "asc") ? "desc" : "asc";
      } else {
        state.sortKey = map.key;
        state.sortDir = "asc";
      }
      render();
    });
  });
}

function decorateSortedHeader(){
  const ths = document.querySelectorAll('#tbl-compteurs thead th');
  ths.forEach((th, i)=>{
    const map = headerMap.find(m=>m.thIndex===i);
    if(!map) return;
    const isActive = state.sortKey === map.key;
    th.innerHTML = th.textContent.replace(/[▲▼]\s*$/,'').trim();
    if(isActive){
      const marker = state.sortDir === "asc" ? " ▲" : " ▼";
      th.innerHTML = `${th.textContent}${marker}`;
    }
  });
}

async function init(){
  state.raw = await fetchCompteurs();
  render();

  const inputQ = document.getElementById('q');
  if(inputQ){
    inputQ.addEventListener('input', (e)=>{
      state.q = e.target.value;
      render();
    });
  }

  bindHeaderSorting();
  decorateSortedHeader();

  supabase.channel("rt-sessions")
    .on("postgres_changes",{event:"*",schema:"public",table:"compteur_sessions"}, async ()=>{
      state.raw = await fetchCompteurs();
      render();
    })
    .subscribe();

  setInterval(async ()=>{
    state.raw = await fetchCompteurs();
    render();
  }, 30000);
}
init();
