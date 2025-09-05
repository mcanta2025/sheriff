import { supabase, startClock, bindHeaderAuth, requireAuthOrRedirect } from './common.js';

startClock();
await bindHeaderAuth();
await requireAuthOrRedirect(); // protège la page

// ====== LISTES RÉFÉRENCE ======
async function fetchEffectifsActifs(){ const {data}=await supabase.from("effectifs").select("matricule,nom").eq("actif",true).order("nom"); return data||[]; }
async function fetchVehicules(){ const {data}=await supabase.from("vehicules").select("code,modele").order("code"); return data||[]; }
async function fetchStatus(){ const {data}=await supabase.from("status").select("key,label").order("ordre"); return data||[]; }

// ====== TUILES ======
const TAGS = ["ADAM 01","ADAM 02","ADAM 03","ADAM 04","ADAM 05","ATR 17","LEAD"];

function tileTemplate(tag){
  const wrap=document.createElement('div'); wrap.className="card";
  wrap.innerHTML=`
    <h3>${tag}</h3>
    <div class="row">
      <div><label>Conducteur</label><select class="sel-conducteur"></select></div>
      <div><label>Opérateur radio</label><select class="sel-radio"></select></div>
    </div>
    <div class="row">
      <div><label>Coéquipier 1</label><select class="sel-coequipier1"></select></div>
      <div><label>Coéquipier 2</label><select class="sel-coequipier2"></select></div>
    </div>
    <div class="row">
      <div><label>Véhicule</label><select class="sel-vehicule"></select></div>
      <div><label>Statut</label><select class="sel-status"></select></div>
    </div>
    <div><label>Notes</label><textarea class="txt-notes" placeholder="Notes…"></textarea></div>
    <div class="spread" style="margin-top:8px">
      <span class="small muted">Valider pour partager en temps réel.</span>
      <div>
        <button class="btn" data-act="clear">Vider</button>
        <button class="btn gold" data-act="save">Enregistrer</button>
      </div>
    </div>`;
  return wrap;
}

function hydrateTile(tile,row){
  tile.querySelector(".sel-conducteur").value=row.conducteur||"";
  tile.querySelector(".sel-radio").value=row.radio||"";
  tile.querySelector(".sel-coequipier1").value=row.coequipier1||"";
  tile.querySelector(".sel-coequipier2").value=row.coequipier2||"";
  tile.querySelector(".sel-vehicule").value=row.vehicule||"";
  tile.querySelector(".sel-status").value=row.status||"";
  tile.querySelector(".txt-notes").value=row.notes||"";
}

async function buildTiles(){
  const cont=document.getElementById("tiles"); cont.innerHTML="";
  const [eff,veh,sts]=await Promise.all([fetchEffectifsActifs(),fetchVehicules(),fetchStatus()]);
  const effOpts='<option value="">— Choisir —</option>'+eff.map(e=>`<option value="${e.matricule}">${e.nom} (#${e.matricule})</option>`).join('');
  const vehOpts='<option value="">— Véhicule —</option>'+veh.map(v=>`<option value="${v.code}">${v.code} — ${v.modele}</option>`).join('');
  const stOpts ='<option value="">— Statut —</option>'+sts.map(s=>`<option value="${s.key}">${s.label}</option>`).join('');
  TAGS.forEach(tag=>{
    const t=tileTemplate(tag); cont.appendChild(t);
    t.querySelector(".sel-conducteur").innerHTML=effOpts;
    t.querySelector(".sel-radio").innerHTML=effOpts;
    t.querySelector(".sel-coequipier1").innerHTML=effOpts;
    t.querySelector(".sel-coequipier2").innerHTML=effOpts;
    t.querySelector(".sel-vehicule").innerHTML=vehOpts;
    t.querySelector(".sel-status").innerHTML=stOpts;
  });
}

// Save / Clear handlers
document.addEventListener("click", async (e)=>{
  const btn=e.target.closest("[data-act]"); if(!btn) return;
  const tile=btn.closest(".card"); const tag=tile.querySelector("h3").textContent;

  if(btn.dataset.act==="clear"){
    tile.querySelectorAll("select").forEach(s=>s.value=""); tile.querySelector(".txt-notes").value=""; return;
  }

  if(btn.dataset.act==="save"){
    const payload={
      p_tag:tag,
      p_conducteur: tile.querySelector(".sel-conducteur").value || null,
      p_radio:      tile.querySelector(".sel-radio").value      || null,
      p_coequipier1:tile.querySelector(".sel-coequipier1").value|| null,
      p_coequipier2:tile.querySelector(".sel-coequipier2").value|| null,
      p_vehicule:   tile.querySelector(".sel-vehicule").value   || null,
      p_status:     tile.querySelector(".sel-status").value     || null,
      p_notes:      tile.querySelector(".txt-notes").value      || null
    };
    const { error } = await supabase.rpc("save_equipe", payload);
    if (error) return alert("Erreur: "+error.message);
    btn.textContent="Enregistré ✓"; setTimeout(()=>btn.textContent="Enregistrer",1200);
    await loadEtat();
  }
});

// Tableau global
async function loadEtat(){
  const { data, error } = await supabase.from("v_equipes").select("*").order("tag");
  if (error) { console.error(error); return; }
  const tb=document.querySelector("#etat-table tbody"); tb.innerHTML="";
  (data||[]).forEach(r=>{
    const tr=document.createElement("tr");
    tr.innerHTML=`
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

    // Hydrate la tuile correspondante
    const tile=[...document.querySelectorAll("#tiles .card")]
      .find(t=>t.querySelector("h3").textContent===r.tag);
    if(tile) hydrateTile(tile,r);
  });
}

// Realtime
supabase.channel("rt-equipes")
  .on("postgres_changes",{event:"*",schema:"public",table:"equipes"},loadEtat)
  .subscribe();

// Init
await buildTiles();
await loadEtat();
