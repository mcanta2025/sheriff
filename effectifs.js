import { supabase, startClock, bindHeaderAuth, requireAuthOrRedirect } from './common.js';

startClock();
await bindHeaderAuth();
await requireAuthOrRedirect();

// Ordre des grades (Sheriff en haut)
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

function sortByGrade(a, b){
  const ai = GRADE_ORDER.indexOf((a.grade||"").toUpperCase());
  const bi = GRADE_ORDER.indexOf((b.grade||"").toUpperCase());
  return ai - bi;
}

async function loadEffectifs(){
  const { data, error } = await supabase.from("effectifs")
    .select("matricule,prenom_nom,grade,date_embauche,sanction,formation_initiale,formation_dea,formation_swat,formation_air17,activite,actif")
    .order("prenom_nom");

  if(error){ console.error(error); return; }
  const cont = document.getElementById("effectifs-container");
  cont.innerHTML = "";

  const grouped = {};
  (data||[]).sort(sortByGrade).forEach(e=>{
    const g = (e.grade||"AUTRE").toUpperCase();
    if(!grouped[g]) grouped[g] = [];
    grouped[g].push(e);
  });

  // afficher par grade
  GRADE_ORDER.forEach(g=>{
    if(!grouped[g]) return;
    const section = document.createElement("div");
    section.innerHTML = `<h4 style="margin-top:20px;color:var(--gold)">${g}</h4>`;
    const table = document.createElement("table");
    table.className = "table";
    table.innerHTML = `
      <thead>
        <tr>
          <th>Matricule</th>
          <th>Prénom/Nom</th>
          <th>Date d'embauche</th>
          <th>Sanction</th>
          <th>Formation Init.</th>
          <th>DEA</th>
          <th>SWAT</th>
          <th>AIR17</th>
          <th>Activité</th>
          <th>Statut</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;
    const tb = table.querySelector("tbody");

    grouped[g].forEach(e=>{
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${e.matricule||""}</td>
        <td>${e.prenom_nom||""}</td>
        <td>${e.date_embauche||""}</td>
        <td>${e.sanction||""}</td>
        <td>${e.formation_initiale ? "✅" : ""}</td>
        <td>${e.formation_dea ? "✅" : ""}</td>
        <td>${e.formation_swat ? "✅" : ""}</td>
        <td>${e.formation_air17 ? "✅" : ""}</td>
        <td>${e.activite||""}</td>
        <td>${e.actif ? "✅ Actif" : "❌ Inactif"}</td>
      `;
      tb.appendChild(tr);
    });

    section.appendChild(table);
    cont.appendChild(section);
  });
}

// Realtime
supabase.channel("rt-effectifs")
  .on("postgres_changes",{event:"*",schema:"public",table:"effectifs"},loadEffectifs)
  .subscribe();

await loadEffectifs();
