import { supabase, startClock, bindHeaderAuth, requireAuthOrRedirect } from './common.js';

startClock();
await bindHeaderAuth();
await requireAuthOrRedirect();

/* ====== Lists ====== */
async function fetchEffectifsActifs(){ const {data}=await supabase.from("effectifs").select("matricule,nom").eq("actif",true).order("nom"); return data||[]; }
async function fetchVehicules(){ const {data}=await supabase.from("vehicules").select("code,modele").order("code"); return data||[]; }
async function fetchStatus(){ const {data}=await supabase.from("status").select("key,label").order("ordre"); return data||[]; }

/* ====== Tiles ====== */
const TAGS = ["LEAD","ADAM 01","ADAM 02","ADAM 03","ADAM 04","ADAM 05","ATR 17"];

function tileTemplate(tag){
  const el = document.createElement('div');
  el.className = "equipe-tile";
  el.innerHTML = `
    <h4>${tag}</h4>

    <div class="row2">
      <div><label class="small muted">Conducteur</label><select class="sel-conducteur"></select></div>
      <div><label class="small muted">Radio</label><select class="sel-radio"></select></div>
    </div>

    <div class="row2">
      <div><label class="small muted">C1</label><select class="sel-coequipier1"></select></div>
      <div><label class="small muted">C2</label><select class="sel-coequipier2"></select></div>
    </div>

    <div class="row2">
      <div><label class="small muted">Véhicule</label><select class="sel-vehicule"></select></div>
      <div><label class="small muted">Statut</label><select class="sel-status"></select></div>
    </div>

    <div>
      <label class="small muted">Notes</label>
      <textarea class="txt-notes" placeholder="Notes…"></textarea>
    </div>

    <div class="actions">
      <button class="btn" data-act="clear">Vider</button>
      <button class="btn gold" data-act="save">OK</button>
    </div>
  `;
  return el;
}
async function loadEtat(){
  const { data, error } = await supabase.from("v_equipes").select("*");
  if(error){ console.error(error); return; }

  const cont = document.getElementById("orga"); 
  cont.innerHTML = "";

  (data||[])
    .sort((a,b)=> (a.tag==="LEAD")? -1 : (b.tag==="LEAD")? 1 : a.tag.localeCompare(b.tag))
    .forEach(r=>{
      const card = document.createElement("div");
      card.className = "team-card";

      // statut coloré
      let stClass=""; 
      if(r.status==="DISPO") stClass="status-dispo";
      else if(r.status==="PATROL") stClass="status-patrol";
      else stClass="status-indispo";

      card.innerHTML = `
        <h4>${r.tag}</h4>
        <div class="status ${stClass}">${r.status_label||r.status||""}</div>
        <div><b>Conducteur:</b> ${r.conducteur_nom||""}</div>
        <div><b>Radio:</b> ${r.radio_nom||""}</div>
        <div><b>C1:</b> ${r.coequipier1_nom||""}</div>
        <div><b>C2:</b> ${r.coequipier2_nom||""}</div>
        <div><b>Véhicule:</b> ${r.vehicule||""} ${r.vehicule_modele||""}</div>
        <div class="muted small">${r.notes||""}</div>
      `;
      cont.appendChild(card);

      // Hydrate tuile si existante
      const tile=[...document.querySelectorAll(".equipe-tile")]
        .find(t=>t.querySelector("h4").textContent===r.tag);
      if(tile && !tile.contains(document.activeElement)){
        tile.querySelector(".sel-conducteur").value  = r.conducteur  || "";
        tile.querySelector(".sel-radio").value       = r.radio       || "";
        tile.querySelector(".sel-coequipier1").value = r.coequipier1 || "";
        tile.querySelector(".sel-coequipier2").value = r.coequipier2 || "";
        tile.querySelector(".sel-vehicule").value    = r.vehicule    || "";
        tile.querySelector(".sel-status").value      = r.status      || "";
        if (!tile.querySelector(".txt-notes").matches(':focus'))
          tile.querySelector(".txt-notes").value = r.notes || "";
      }
    });
}
async function buildTiles(){
  const cont = document.getElementById("tiles-col");
  cont.innerHTML = "";

  const [eff,veh,sts] = await Promise.all([fetchEffectifsActifs(), fetchVehicules(), fetchStatus()]);
  const effOpts = '<option value="">—</option>'+eff.map(e=>`<option value="${e.matricule}">${e.nom}</option>`).join('');
  const vehOpts = '<option value="">—</option>'+veh.map(v=>`<option value="${v.code}">${v.code} — ${v.modele}</option>`).join('');
  const stOpts  = '<option value="">—</option>'+sts.map(s=>`<option value="${s.key}">${s.label}</option>`).join('');

  TAGS.forEach(tag=>{
    const t = tileTemplate(tag);
    cont.appendChild(t);
    t.querySelector(".sel-conducteur").innerHTML  = effOpts;
    t.querySelector(".sel-radio").innerHTML       = effOpts;
    t.querySelector(".sel-coequipier1").innerHTML = effOpts;
    t.querySelector(".sel-coequipier2").innerHTML = effOpts;
    t.querySelector(".sel-vehicule").innerHTML    = vehOpts;
    t.querySelector(".sel-status").innerHTML      = stOpts;
  });
}

/* Prevent duplicate roles in same team (UI) */
function enforceUniqueSelects(tile){
  const sels = [
    tile.querySelector(".sel-conducteur"),
    tile.querySelector(".sel-radio"),
    tile.querySelector(".sel-coequipier1"),
    tile.querySelector(".sel-coequipier2"),
  ].filter(Boolean);

  const set = new Set();
  for(const s of sels){
    const v = s.value || "";
    if(v && set.has(v)){
      s.value = "";
      alert("La même personne ne peut pas occuper deux rôles dans la même équipe.");
    } else if (v){ set.add(v); }
  }
}
document.addEventListener("change", (e)=>{
  const tile = e.target.closest(".equipe-tile");
  if(!tile) return;
  if(e.target.matches(".sel-conducteur,.sel-radio,.sel-coequipier1,.sel-coequipier2")){
    enforceUniqueSelects(tile);
  }
});

/* Save / Clear */
document.addEventListener("click", async (e)=>{
  const btn = e.target.closest("[data-act]");
  if(!btn) return;
  const tile = btn.closest(".equipe-tile");
  const tag  = tile.querySelector("h4").textContent;

  if(btn.dataset.act==="clear"){
    tile.querySelectorAll("select").forEach(s=>s.value="");
    tile.querySelector(".txt-notes").value="";
    return;
  }

  if(btn.dataset.act==="save"){
    const payload = {
      p_tag: tag,
      p_conducteur:  tile.querySelector(".sel-conducteur").value || null,
      p_radio:       tile.querySelector(".sel-radio").value || null,
      p_coequipier1: tile.querySelector(".sel-coequipier1").value || null,
      p_coequipier2: tile.querySelector(".sel-coequipier2").value || null,
      p_vehicule:    tile.querySelector(".sel-vehicule").value || null,
      p_status:      tile.querySelector(".sel-status").value || null,
      p_notes:       tile.querySelector(".txt-notes").value || null
    };
    const { error } = await supabase.rpc("save_equipe", payload);
    if (error) return alert("Erreur: " + error.message);
    btn.textContent = "Enregistré ✓";
    setTimeout(()=>btn.textContent="OK", 1000);
    await loadEtat();
  }
});

/* Table (Lead en premier) */
async function loadEtat(){
  const { data, error } = await supabase.from("v_equipes").select("*");
  if(error){ console.error(error); return; }
  const tb = document.querySelector("#etat-table tbody"); tb.innerHTML = "";
  (data||[])
    .sort((a,b)=> (a.tag==="LEAD")? -1 : (b.tag==="LEAD")? 1 : a.tag.localeCompare(b.tag))
    .forEach(r=>{
      const tr=document.createElement("tr");
      tr.innerHTML = `
        <td>${r.tag}</td>
        <td>${r.conducteur_nom||""}</td>
        <td>${r.radio_nom||""}</td>
        <td>${r.coequipier1_nom||""}</td>
        <td>${r.coequipier2_nom||""}</td>
        <td>${r.vehicule?`${r.vehicule} — ${r.vehicule_modele||""}`:""}</td>
        <td>${r.status_label||r.status||""}</td>
        <td>${r.notes||""}</td>
        <td>${new Date(r.updated_at).toLocaleTimeString()}</td>`;
      tb.appendChild(tr);

      // Hydrate tile if exists
      const tile=[...document.querySelectorAll(".equipe-tile")]
        .find(t=>t.querySelector("h4").textContent===r.tag);
      if(tile){
        tile.querySelector(".sel-conducteur").value  = r.conducteur  || "";
        tile.querySelector(".sel-radio").value       = r.radio       || "";
        tile.querySelector(".sel-coequipier1").value = r.coequipier1 || "";
        tile.querySelector(".sel-coequipier2").value = r.coequipier2 || "";
        tile.querySelector(".sel-vehicule").value    = r.vehicule    || "";
        tile.querySelector(".sel-status").value      = r.status      || "";
        tile.querySelector(".txt-notes").value       = r.notes       || "";
      }
    });
}

/* Realtime */
supabase.channel("rt-equipes")
  .on("postgres_changes",{event:"*",schema:"public",table:"equipes"},loadEtat)
  .subscribe();

/* Init */
await buildTiles();
await loadEtat();

