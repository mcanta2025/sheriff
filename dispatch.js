import { supabase, startClock, bindHeaderAuth, requireAuthOrRedirect } from './common.js';

startClock();
await bindHeaderAuth();
await requireAuthOrRedirect();

/* ====== Lists ====== */
async function fetchEffectifsActifs() {
  const { data, error } = await supabase
    .from("effectifs")
    .select("matricule,nom")
    .eq("actif", true)
    .order("nom");
  if (error) console.error("Erreur fetchEffectifs:", error.message);
  return data || [];
}

async function fetchVehicules() {
  const { data, error } = await supabase
    .from("vehicules")
    .select("code,modele")
    .order("code");
  if (error) console.error("Erreur fetchVehicules:", error.message);
  return data || [];
}

async function fetchStatus() {
  const { data, error } = await supabase
    .from("status")
    .select("key,label")
    .order("ordre");
  if (error) console.error("Erreur fetchStatus:", error.message);
  return data || [];
}

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

async function buildTiles(){
  const cont = document.getElementById("tiles-col");
  cont.innerHTML = "";

  const [eff,veh,sts] = await Promise.all([
    fetchEffectifsActifs(),
    fetchVehicules(),
    fetchStatus()
  ]);

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

/* Empêche les doublons dans une tuile */
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

/* Sauvegarde / Vider */
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

/* Ne pas écraser pendant édition */
let isEditing = false;
document.addEventListener('focusin', (e)=>{ if (e.target.closest('.equipe-tile')) isEditing = true; });
document.addEventListener('focusout', (e)=>{ if (e.target.closest('.equipe-tile')) isEditing = false; });

/* Organigramme (cartes), LEAD en premier */
function statusClass(k){
  if(!k) return "";
  const s = k.toUpperCase();
  if (["DISPONIBLE","DISPO","AVAILABLE"].includes(s)) return "status-dispo";
  if (["EN PATROUILLE","PATROL"].includes(s)) return "status-patrol";
  return "status-indispo";
}

async function loadEtat(){
  const { data, error } = await supabase.from("v_equipes").select("*");
  if(error){ console.error("Erreur loadEtat:", error.message); return; }

  const cont = document.getElementById("orga");
  cont.innerHTML = "";

  (data||[])
    .sort((a,b)=> (a.tag==="LEAD")? -1 : (b.tag==="LEAD")? 1 : a.tag.localeCompare(b.tag))
    .forEach(r=>{
      const card = document.createElement("div");
      card.className = "team-card";
      const stClass = statusClass(r.status);
      card.innerHTML = `
        <h4>${r.tag}</h4>
        <div class="status ${stClass}">${r.status_label||r.status||""}</div>
        <div><b>Conducteur:</b> ${r.conducteur_nom||""}</div>
        <div><b>Radio:</b> ${r.radio_nom||""}</div>
        <div><b>C1:</b> ${r.coequipier1_nom||""}</div>
        <div><b>C2:</b> ${r.coequipier2_nom||""}</div>
        <div><b>Véhicule:</b> ${r.vehicule||""} ${r.vehicule_modele||""}</div>
        <div class="muted small" style="margin-top:6px">${(r.notes||"")}</div>
      `;
      cont.appendChild(card);

      // hydrate la tuile à gauche si elle existe et si on n'édite pas
      const tile=[...document.querySelectorAll(".equipe-tile")]
        .find(t=>t.querySelector("h4").textContent===r.tag);
      if(tile && !isEditing && !tile.contains(document.activeElement)){
        tile.querySelector(".sel-conducteur").value  = r.conducteur  || "";
        tile.querySelector(".sel-radio").value       = r.radio       || "";
        tile.querySelector(".sel-coequipier1").value = r.coequipier1 || "";
        tile.querySelector(".sel-coequipier2").value = r.coequipier2 || "";
        tile.querySelector(".sel-vehicule").value    = r.vehicule    || "";
        tile.querySelector(".sel-status").value      = r.status      || "";
        const notesEl = tile.querySelector(".txt-notes");
        if (notesEl && !notesEl.matches(':focus')) notesEl.value = r.notes || "";
      }
    });
}

/* ====== Realtime abonnements ====== */
supabase
  .channel("rt-equipes")
  .on("postgres_changes", { event: "*", schema: "public", table: "equipes" }, (payload) => {
    console.log("Changement détecté sur EQUIPES:", payload);
    loadEtat();
  })
  .subscribe();

/* ====== Init ====== */
await buildTiles();
await loadEtat();
