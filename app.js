// PET FEEDER V4 WEB
// Reemplazá firebaseConfig con la configuración de TU aplicación Web de Firebase.
// Firebase Console -> Configuración del proyecto -> Tus apps -> Web (</>)
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getDatabase, ref, set, onValue } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyC-UgTsAkyeSFuOVK8zHBuvBD_TQ3HAicc",
  authDomain: "pet-feeder-d0486.firebaseapp.com",
  databaseURL: "https://pet-feeder-d0486-default-rtdb.firebaseio.com",
  projectId: "pet-feeder-d0486",
  appId: "PEGAR_APP_ID"
};

const DEVICE="PF001";
const app=initializeApp(firebaseConfig);
const db=getDatabase(app);
const $=s=>document.querySelector(s);
let seconds=3, schedules=[];

function toast(t){const e=$("#toast");e.textContent=t;e.classList.add("show");setTimeout(()=>e.classList.remove("show"),1800)}
function render(){
  const box=$("#schedules");box.innerHTML="";
  schedules.forEach((s,i)=>{
    const d=document.createElement("div");d.className="schedule";
    d.innerHTML=`<input type="time" value="${s.time}" data-i="${i}" data-k="time"><input type="number" min="1" max="10" value="${s.seconds}" data-i="${i}" data-k="seconds"><label class="switch"><input type="checkbox" ${s.enabled?"checked":""} data-i="${i}" data-k="enabled"><span class="slider"></span></label><button class="del" data-del="${i}">×</button>`;
    box.appendChild(d);
  });
  box.querySelectorAll("input").forEach(e=>e.onchange=ev=>{let i=+ev.target.dataset.i,k=ev.target.dataset.k;schedules[i][k]=k==="enabled"?ev.target.checked:k==="seconds"?Math.max(1,Math.min(10,+ev.target.value||1)):ev.target.value;calcNext()});
  box.querySelectorAll("[data-del]").forEach(e=>e.onclick=()=>{schedules.splice(+e.dataset.del,1);render();calcNext()});
}
function calcNext(){
  const now=new Date();let best=null;
  schedules.filter(s=>s.enabled).forEach(s=>{let[h,m]=s.time.split(":").map(Number),d=new Date(now);d.setHours(h,m,0,0);if(d<=now)d.setDate(d.getDate()+1);if(!best||d<best.d)best={d,s}});
  if(!best){$("#next").textContent="--:--";$("#nextText").textContent="Sin horarios activos";return}
  $("#next").textContent=best.s.time;let mins=Math.ceil((best.d-now)/60000),h=Math.floor(mins/60);$("#nextText").textContent=h?`en ${h} h ${mins%60} min`:`en ${mins} min`;
}
$("#minus").onclick=()=>$("#seconds").textContent=seconds=Math.max(1,seconds-1);
$("#plus").onclick=()=>$("#seconds").textContent=seconds=Math.min(10,seconds+1);
$("#feed").onclick=async()=>{try{await set(ref(db,`devices/${DEVICE}/command`),{action:"feed",seconds});toast("🐾 Orden enviada")}catch(e){toast("Error al enviar")}};
$("#add").onclick=()=>{if(schedules.length>=5)return toast("Máximo 5 horarios");schedules.push({time:"12:00",seconds:3,enabled:true});render();calcNext()};
$("#save").onclick=async()=>{try{await set(ref(db,`devices/${DEVICE}/schedules`),schedules);toast("Horarios guardados")}catch(e){toast("Error guardando")}};

onValue(ref(db,`devices/${DEVICE}/schedules`),snap=>{const v=snap.val();schedules=Array.isArray(v)?v:Object.values(v||{});render();calcNext()});
onValue(ref(db,`devices/${DEVICE}/status`),snap=>{const s=snap.val()||{};$("#online").textContent=s.online?"● Online":"● Offline";$("#online").classList.toggle("ok",!!s.online);$("#motor").textContent=s.motor?"Funcionando":"Detenido";$("#lastFeed").textContent=s.lastFeed||"--"});
setInterval(calcNext,1000);