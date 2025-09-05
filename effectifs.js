import { supabase, startClock, bindHeaderAuth, requireAuthOrRedirect } from './common.js';

startClock();
await bindHeaderAuth();
await requireAuthOrRedirect();

async function loadEffectifs(){
  const { data, error } = await supabase.from("effectifs").select("matricule,nom,grade,actif").order("nom");
  if(error){ console.error(error); return; }

  const tb = document.querySelector("#effectifs-table tbody");
  tb.innerHTML = "";

  (data||[]).forEach(e=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${e.matricule}</td>
      <td>${e.nom}</td>
      <td>${e.grade||""}</td>
      <td>${e.actif ? "✅ Actif" : "❌ Inactif"}</td>
    `;
    tb.appendChild(tr);
  });
}

// écoute en temps réel les changements sur effectifs
supabase.channel("rt-effectifs")
  .on("postgres_changes",{event:"*",schema:"public",table:"effectifs"},loadEffectifs)
  .subscribe();

await loadEffectifs();
