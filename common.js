import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* === REMPLACE ces 2 constantes par celles de TON projet === */
export const SUPABASE_URL = "https://lmlzvszgiugxypizuien.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxtbHp2c3pnaXVneHlwaXp1aWVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcwNTk5NjQsImV4cCI6MjA3MjYzNTk2NH0.z4E5aJ3mjU0KfYd-LUci-JM8u5sp6TjylSj3o_iWfVU";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* Header clock */
export function startClock(){
  const el = document.getElementById("clock");
  const pad2 = n=>String(n).padStart(2,"0");
  setInterval(()=>{const d=new Date(); if(el) el.textContent=`${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`},1000);
}

/* Header auth buttons */
export async function bindHeaderAuth(){
  const who = document.getElementById("who");
  const btnLogin = document.getElementById("btn-login");
  const btnLogout = document.getElementById("btn-logout");

  const setUI = (u)=>{
    if(who) who.textContent = u ? `Connecté : ${u.email || u.id}` : "Non connecté";
    if(btnLogin) btnLogin.classList.toggle("hidden", !!u);
    if(btnLogout) btnLogout.classList.toggle("hidden", !u);
  };

  const { data: { session } } = await supabase.auth.getSession();
  setUI(session?.user);
  supabase.auth.onAuthStateChange((_evt,sess)=> setUI(sess?.user));

  if(btnLogin) btnLogin.onclick = ()=> { document.location.href = "index.html#login"; };
  if(btnLogout) btnLogout.onclick = async ()=> { await supabase.auth.signOut(); document.location.href = "index.html"; };
}

/* Guard: require login */
export async function requireAuthOrRedirect(){
  const { data: { session } } = await supabase.auth.getSession();
  if(!session?.user){
    document.location.href = "index.html#login";
    throw new Error("not-authenticated");
  }
  return session.user;
}

