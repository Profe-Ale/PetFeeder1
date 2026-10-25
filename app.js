// PET FEEDER V4 WEB
// Reemplazá firebaseConfig con la configuración de TU aplicación Web de Firebase.
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getDatabase, ref, set, onValue } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyC-UgTsAkyeSFuOVK8zHBuvBD_TQ3HAicc",
  authDomain: "pet-feeder-d0486.firebaseapp.com",
  databaseURL: "https://pet-feeder-d0486-default-rtdb.firebaseio.com",
  projectId: "pet-feeder-d0486",
  appId: "PEGAR_APP_ID"
};

const DEVICE = "PF001";
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const $ = (s) => document.querySelector(s);

let seconds = 3;
let schedules = [];
let valveActive = false;
let currentWaterLevel = "ok";

// --- NOTIFICACIONES TOAST ---
function toast(texto) {
  const elem = $("#toast");
  if (!elem) return;
  elem.textContent = texto;
  elem.classList.add("show");
  setTimeout(() => {
    elem.classList.remove("show");
  }, 1800);
}

// --- RENDERIZADO DE HORARIOS ---
function render() {
  const box = $("#schedules");
  if (!box) return;
  box.innerHTML = "";

  schedules.forEach((s, i) => {
    const d = document.createElement("div");
    d.className = "schedule";
    d.innerHTML = `
      <input type="time" value="${s.time}" data-i="${i}" data-k="time">
      <input type="number" min="1" max="10" value="${s.seconds}" data-i="${i}" data-k="seconds">
      <label class="switch">
        <input type="checkbox" ${s.enabled ? "checked" : ""} data-i="${i}" data-k="enabled">
        <span class="slider"></span>
      </label>
      <button class="del" data-del="${i}">×</button>
    `;
    box.appendChild(d);
  });

  // Manejo de cambios en los inputs
  box.querySelectorAll("input").forEach((e) => {
    e.onchange = (ev) => {
      const i = +ev.target.dataset.i;
      const k = ev.target.dataset.k;

      if (k === "enabled") {
        schedules[i][k] = ev.target.checked;
      } else if (k === "seconds") {
        schedules[i][k] = Math.max(1, Math.min(10, +ev.target.value || 1));
      } else {
        schedules[i][k] = ev.target.value;
      }
      calcNext();
    };
  });

  // Botón para eliminar un horario
  box.querySelectorAll("[data-del]").forEach((e) => {
    e.onclick = () => {
      schedules.splice(+e.dataset.del, 1);
      render();
      calcNext();
    };
  });
}

// --- CÁLCULO DE LA PRÓXIMA COMIDA ---
function calcNext() {
  const now = new Date();
  let best = null;

  schedules
    .filter((s) => s.enabled)
    .forEach((s) => {
      const [h, m] = s.time.split(":").map(Number);
      const d = new Date(now);
      d.setHours(h, m, 0, 0);

      if (d <= now) {
        d.setDate(d.getDate() + 1);
      }

      if (!best || d < best.d) {
        best = { d, s };
      }
    });

  const nextEl = $("#next");
  const nextTextEl = $("#nextText");
  if (!nextEl || !nextTextEl) return;

  if (!best) {
    nextEl.textContent = "--:--";
    nextTextEl.textContent = "Sin horarios activos";
    return;
  }

  nextEl.textContent = best.s.time;
  const mins = Math.ceil((best.d - now) / 60000);
  const h = Math.floor(mins / 60);
  nextTextEl.textContent = h
    ? `en ${h} h ${mins % 60} min`
    : `en ${mins} min`;
}

// --- BOTONES DE DURACIÓN DE ALIMENTACIÓN ---
const btnMinus = $("#minus");
if (btnMinus) {
  btnMinus.onclick = () => {
    seconds = Math.max(1, seconds - 1);
    const secEl = $("#seconds");
    if (secEl) secEl.textContent = seconds;
  };
}

const btnPlus = $("#plus");
if (btnPlus) {
  btnPlus.onclick = () => {
    seconds = Math.min(10, seconds + 1);
    const secEl = $("#seconds");
    if (secEl) secEl.textContent = seconds;
  };
}

// --- ALIMENTAR MANUAL (COMIDA) ---
const btnFeed = $("#feed");
if (btnFeed) {
  btnFeed.onclick = async () => {
    try {
      await set(ref(db, `devices/${DEVICE}/command`), {
        action: "feed",
        seconds: seconds
      });
      toast("🐾 Orden enviada");
    } catch (e) {
      toast("Error al enviar");
    }
  };
}

// --- AGREGAR Y GUARDAR HORARIOS ---
const btnAdd = $("#add");
if (btnAdd) {
  btnAdd.onclick = () => {
    if (schedules.length >= 5) {
      return toast("Máximo 5 horarios");
    }
    schedules.push({
      time: "12:00",
      seconds: 3,
      enabled: true
    });
    render();
    calcNext();
  };
}

const btnSave = $("#save");
if (btnSave) {
  btnSave.onclick = async () => {
    try {
      await set(ref(db, `devices/${DEVICE}/schedules`), schedules);
      toast("Horarios guardados");
    } catch (e) {
      toast("Error guardando");
    }
  };
}

// --- ACCIONAMIENTO MANUAL DE LA VÁLVULA DE AGUA ---
const btnValve = $("#btnValve");
if (btnValve) {
  btnValve.onclick = async () => {
    // Si no está activa e intentamos abrir estando lleno, bloquear acción
    if (!valveActive && currentWaterLevel === "full") {
      toast("⚠️ El recipiente ya está lleno");
      return;
    }

    try {
      const orden = valveActive ? "off" : "on";
      await set(ref(db, `devices/${DEVICE}/command/valve`), orden);
      toast(valveActive ? "Cerrando válvula..." : "Abriendo válvula...");
    } catch (e) {
      toast("Error al accionar válvula");
    }
  };
}

// --- LISTENERS EN TIEMPO REAL DESDE FIREBASE ---

// 1. Horarios
onValue(ref(db, `devices/${DEVICE}/schedules`), (snap) => {
  const v = snap.val();
  schedules = Array.isArray(v) ? v : Object.values(v || {});
  render();
  calcNext();
});

// 2. Estados de dispositivo, comida y agua
onValue(ref(db, `devices/${DEVICE}/status`), (snap) => {
  const s = snap.val() || {};

  // Estado de conexión
  const onlineEl = $("#online");
  if (onlineEl) {
    onlineEl.textContent = s.online ? "● Online" : "● Offline";
    onlineEl.classList.toggle("ok", !!s.online);
  }

  // Estado del motor de comida
  const motorEl = $("#motor");
  if (motorEl) motorEl.textContent = s.motor ? "Funcionando" : "Detenido";

  const lastFeedEl = $("#lastFeed");
  if (lastFeedEl) lastFeedEl.textContent = s.lastFeed || "--";

  // Nivel de agua
  currentWaterLevel = s.waterLevel || "ok";
  const wEl = $("#waterLevel");
  if (wEl) {
    if (currentWaterLevel === "low") {
      wEl.textContent = "⚠️ Nivel Bajo";
      wEl.style.color = "#ff7771";
    } else if (currentWaterLevel === "full") {
      wEl.textContent = "💧 Lleno";
      wEl.style.color = "#56b4ff";
    } else {
      wEl.textContent = "✅ Normal";
      wEl.style.color = "#4bdc9f";
    }
  }

  // Estado y botón de la electroválvula
  valveActive = !!s.valve;
  const vEl = $("#valveStatus");
  const btnV = $("#btnValve");

  if (vEl) {
    vEl.textContent = valveActive ? "Llenando..." : "Cerrada";
  }

  if (btnV) {
    if (valveActive) {
      btnV.disabled = false;
      btnV.textContent = "CERRAR VÁLVULA";
      btnV.style.background = "#633947";
      btnV.style.cursor = "pointer";
      btnV.title = "Cerrar válvula manualmente";
    } else if (currentWaterLevel === "full") {
      btnV.disabled = true;
      btnV.textContent = "RECIPIENTE LLENO";
      btnV.style.background = "#334155";
      btnV.style.cursor = "not-allowed";
      btnV.title = "No se puede abrir: el recipiente ya está lleno";
    } else {
      btnV.disabled = false;
      btnV.textContent = "ABRIR VÁLVULA (LLENAR)";
      btnV.style.background = "linear-gradient(90deg, #56b4ff, #387aff)";
      btnV.style.cursor = "pointer";
      btnV.title = "Abrir válvula manualmente";
    }
  }
});
