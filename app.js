import { LANGUAGES } from "./languages.js";

const DEFAULT_MAPS = [
  { plain: "A", secret: "&#" }, { plain: "B", secret: "✓@" },
  { plain: "C", secret: "{#" }, { plain: "D", secret: "•$" },
  { plain: "E", secret: "%•" }, { plain: "F", secret: "÷&" },
  { plain: "G", secret: "√*" }, { plain: "H", secret: "+[" },
  { plain: "I", secret: "あ=" }, { plain: "J", secret: "/√" },
  { plain: "K", secret: "::" }, { plain: "L", secret: "!!" },
  { plain: "M", secret: "た?" }, { plain: "N", secret: "^^" },
  { plain: "O", secret: "さか~" }, { plain: "P", secret: "@%" },
  { plain: "Q", secret: "%我" }, { plain: "R", secret: "#@" },
  { plain: "S", secret: "私#" }, { plain: "T", secret: "#$" },
  { plain: "U", secret: "&@" }, { plain: "V", secret: "@&" },
  { plain: "W", secret: "*#" }, { plain: "X", secret: "#*" },
  { plain: "Y", secret: "+#" }, { plain: "Z", secret: "#+" },
  { plain: "1", secret: "#kntl+" }, { plain: "0", secret: "mmk" },
  { plain: "2", secret: "kntl" }, { plain: "3", secret: "mari" },
  { plain: "4", secret: "÷@1" }, { plain: "5", secret: "∆" },
  { plain: "6", secret: "sakい" }, { plain: "7", secret: "hiな" },
  { plain: "8", secret: "🌹" }, { plain: "9", secret: "9" },
  { plain: "10", secret: "∞" }, { plain: "∞", secret: "®©" },
];

import { firebaseConfig } from "./firebase-config.js";

let A, Au, F, auth, db, user = null, profile = {}, maps = DEFAULT_MAPS.map(x => ({...x}));
const $ = id => document.getElementById(id);
const esc = x => String(x ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));

let currentLang = localStorage.getItem("sc_language") || "id";
const t = key => (LANGUAGES[currentLang] || LANGUAGES.id)[key] || key;

function applyLanguage(lang = currentLang) {
  currentLang = LANGUAGES[lang] ? lang : "id";
  localStorage.setItem("sc_language", currentLang);
  document.documentElement.lang = currentLang;
  document.title = t("title");

  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.dataset.i18n;
    if (t(key)) el.textContent = t(key);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
    const key = el.dataset.i18nPlaceholder;
    if (t(key)) el.placeholder = t(key);
  });
  ["language", "languageLogin", "languageRegister"].forEach(id => {
    if ($(id)) $(id).value = currentLang;
  });
  if ($("ctype")) {
    [...$("ctype").options].forEach(o => { if (o.dataset.i18n) o.textContent = t(o.dataset.i18n); });
  }
  renderMaps();
}

function showView(view) {
  $("login").classList.toggle("hidden", view !== "login");
  $("registerPage").classList.toggle("hidden", view !== "register");
  $("app").classList.toggle("hidden", view !== "app");
}

function setMessage(id, text, type = "info") {
  const el = $(id);
  if (!el) return;
  el.innerHTML = text ? `<div class="message ${type}">${esc(text)}</div>` : "";
}

function usernameEmail(name) {
  return `${name.toLowerCase()}@username.local`;
}

function normalizeUsername(value) {
  return value.trim().toLowerCase();
}

function validUsername(name) {
  return /^[a-z0-9._-]{3,24}$/.test(name);
}

async function boot() {
  try {
    A = await import("https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js");
    Au = await import("https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js");
    F = await import("https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js");

    if (!firebaseConfig?.apiKey || String(firebaseConfig.apiKey).startsWith("GANTI_")) {
      throw new Error("Firebase config belum diisi.");
    }

    const app = A.initializeApp(firebaseConfig);
    auth = Au.getAuth(app);
    db = F.getFirestore(app);

    Au.onAuthStateChanged(auth, async u => {
      if (!u) {
        user = null;
        profile = {};
        showView("login");
        return;
      }
      await enter(u);
    });
  } catch (e) {
    console.error(e);
    showView("login");
    setMessage("msg", "Firebase gagal dimuat. Periksa firebase-config.js dan koneksi internet.", "error");
  }
}

async function enter(u) {
  user = u;
  try {
    const snap = await F.getDoc(F.doc(db, "users", u.uid));
    profile = snap.exists() ? snap.data() : {};

    if (profile.status === "banned" || profile.banned === true) {
      setMessage("msg", "Akun ini diblokir. Hubungi admin.", "error");
      await Au.signOut(auth);
      return;
    }
    if (profile.status === "suspended") {
      setMessage("msg", "Akun ini sedang disuspend. Hubungi admin.", "error");
      await Au.signOut(auth);
      return;
    }

    const key = "sc_session_" + u.uid;
    let expires = Number(localStorage.getItem(key) || 0);
    if (!expires || Date.now() > expires) {
      expires = Date.now() + 21 * 60 * 60 * 1000;
      localStorage.setItem(key, String(expires));
    }
    if (Date.now() > expires) {
      await Au.signOut(auth);
      return;
    }

    $("who").textContent = profile.username || u.displayName || u.email || "User";
    $("adminTab").classList.toggle("hidden", profile.isAdmin !== true);
    $("notice").innerHTML = "";
    showView("app");
    await loadCodes();
    await loadHistory();
  } catch (e) {
    console.error(e);
    setMessage("msg", "Gagal memuat data akun: " + (e.message || e), "error");
    await Au.signOut(auth);
  }
}

$("showRegister").onclick = () => {
  $("registerMsg").innerHTML = "";
  $("newUsername").value = $("username").value.trim();
  $("newPassword").value = "";
  $("confirmPassword").value = "";
  showView("register");
};

$("backToLogin").onclick = () => showView("login");

$("createAccountBtn").onclick = async () => {
  const name = normalizeUsername($("newUsername").value);
  const password = $("newPassword").value;
  const confirm = $("confirmPassword").value;

  if (!validUsername(name)) {
    setMessage("registerMsg", "Username harus 3–24 karakter dan hanya boleh memakai huruf a-z, angka, titik, garis bawah, atau tanda minus.", "error");
    return;
  }
  if (password.length < 6) {
    setMessage("registerMsg", "Password minimal 6 karakter.", "error");
    return;
  }
  if (password !== confirm) {
    setMessage("registerMsg", "Konfirmasi password tidak sama.", "error");
    return;
  }

  const btn = $("createAccountBtn");
  btn.disabled = true;
  try {
    const credential = await Au.createUserWithEmailAndPassword(auth, usernameEmail(name), password);
    await F.setDoc(F.doc(db, "users", credential.user.uid), {
      username: name,
      status: "active",
      isAdmin: false,
      createdAt: F.serverTimestamp()
    });

    await Au.signOut(auth);
    $("username").value = name;
    $("password").value = "";
    setMessage("msg", "Akun berhasil dibuat. Silakan login menggunakan username dan password tadi.", "success");
    showView("login");
  } catch (e) {
    console.error(e);
    let msg = e.message || "Gagal membuat akun.";
    if (e.code === "auth/email-already-in-use") msg = "Username tersebut sudah digunakan.";
    if (e.code === "auth/operation-not-allowed") msg = "Email/Password belum diaktifkan di Firebase Authentication.";
    setMessage("registerMsg", msg, "error");
  } finally {
    btn.disabled = false;
  }
};

$("loginUser").onclick = async () => {
  const name = normalizeUsername($("username").value);
  const password = $("password").value;
  if (!name || !password) {
    setMessage("msg", "Masukkan username dan password.", "error");
    return;
  }

  const btn = $("loginUser");
  btn.disabled = true;
  setMessage("msg", "", "info");
  try {
    await Au.signInWithEmailAndPassword(auth, usernameEmail(name), password);
  } catch (e) {
    console.error(e);
    let msg = "Username atau password salah.";
    if (e.code === "auth/too-many-requests") msg = "Terlalu banyak percobaan. Coba lagi nanti.";
    if (e.code === "auth/network-request-failed") msg = "Tidak ada koneksi internet.";
    setMessage("msg", msg, "error");
  } finally {
    btn.disabled = false;
  }
};

$("password").addEventListener("keydown", e => { if (e.key === "Enter") $("loginUser").click(); });
$("confirmPassword").addEventListener("keydown", e => { if (e.key === "Enter") $("createAccountBtn").click(); });
$("logout").onclick = () => Au.signOut(auth);

["language", "languageLogin", "languageRegister"].forEach(id => {
  $(id).addEventListener("change", e => applyLanguage(e.target.value));
});

async function loadCodes() {
  const s = await F.getDoc(F.doc(db, "users", user.uid, "data", "settings"));
  maps = s.exists() ? (s.data().mappings || DEFAULT_MAPS.map(x => ({...x}))) : [];
  renderMaps();
}

function renderMaps() {
  if (!$ ("maps")) return;
  $("maps").innerHTML = maps.map((m, i) => `
    <div class="map-row">
      <input class="map-p" data-index="${i}" value="${esc(m.p)}">
      <input class="map-s" data-index="${i}" value="${esc(m.s)}">
      <button class="danger remove-map" data-index="${i}">×</button>
    </div>`).join("") || `<p class="muted">${esc(t("noCodes"))}</p>`;

  document.querySelectorAll(".map-p").forEach(el => el.oninput = e => { maps[Number(e.target.dataset.index)].p = e.target.value; });
  document.querySelectorAll(".map-s").forEach(el => el.oninput = e => { maps[Number(e.target.dataset.index)].s = e.target.value; });
  document.querySelectorAll(".remove-map").forEach(el => el.onclick = e => { maps.splice(Number(e.target.dataset.index), 1); renderMaps(); });
}

$("add").onclick = () => {
  const p = $("mp").value.trim();
  const s = $("ms").value.trim();
  if (!p || !s) return;
  maps.push({ p, s });
  $("mp").value = "";
  $("ms").value = "";
  renderMaps();
};

$("saveCodes").onclick = async () => {
  if (!user) return;
  try {
    await F.setDoc(F.doc(db, "users", user.uid, "data", "settings"), { mappings: maps });
    alert(t("saved"));
  } catch (e) {
    alert(e.message || "Gagal menyimpan.");
  }
};

function enc(s) {
  let x = s;
  [...maps].sort((a,b) => b.p.length - a.p.length).forEach(m => { if (m.p) x = x.split(m.p).join(m.s); });
  return x;
}
function dec(s) {
  let x = s;
  [...maps].sort((a,b) => b.s.length - a.s.length).forEach(m => { if (m.s) x = x.split(m.s).join(m.p); });
  return x;
}

$("plain").oninput = e => $("encoded").textContent = e.target.value ? enc(e.target.value) : "—";
$("secret").oninput = e => $("decoded").textContent = e.target.value ? dec(e.target.value) : "—";

$("saveHistory").onclick = async () => {
  if (!user || !$("plain").value) return;
  try {
    await F.addDoc(F.collection(db, "users", user.uid, "history"), {
      plain: $("plain").value,
      secret: $("encoded").textContent,
      createdAt: F.serverTimestamp()
    });
    await loadHistory();
  } catch (e) { alert(e.message || "Gagal menyimpan history."); }
};

async function loadHistory() {
  if (!user) return;
  const q = F.query(F.collection(db, "users", user.uid, "history"), F.orderBy("createdAt", "desc"), F.limit(100));
  const s = await F.getDocs(q);
  $("hist").innerHTML = s.docs.map(d => {
    const x = d.data();
    return `<div class="item"><b>${esc(x.plain)}</b><br>→ ${esc(x.secret)}<br><small>${x.createdAt?.toDate?.().toLocaleString() || ""}</small></div>`;
  }).join("") || `<p class="muted">${esc(t("noHistory"))}</p>`;
}

$("clear").onclick = async () => {
  if (!user) return;
  const s = await F.getDocs(F.collection(db, "users", user.uid, "history"));
  await Promise.all(s.docs.map(d => F.deleteDoc(d.ref)));
  await loadHistory();
};

$("send").onclick = async () => {
  const m = $("cmsg").value.trim();
  if (!m || !user) return;
  try {
    await F.addDoc(F.collection(db, "supportMessages"), {
      uid: user.uid,
      username: profile.username || "",
      type: $("ctype").value,
      message: m,
      createdAt: F.serverTimestamp(),
      status: "open"
    });
    $("cmsg").value = "";
    $("sent").textContent = t("sent");
  } catch (e) { alert(e.message || "Gagal mengirim pesan."); }
};

document.querySelectorAll("[data-p]").forEach(b => b.onclick = () => {
  document.querySelectorAll(".page").forEach(x => x.classList.add("hidden"));
  $(b.dataset.p).classList.remove("hidden");
  if (b.dataset.p === "admin") loadAdmin();
});

async function loadAdmin() {
  if (!profile.isAdmin) return;
  try {
    const s = await F.getDocs(F.collection(db, "users"));
    $("users").innerHTML = s.docs.map(d => {
      const x = d.data();
      const status = x.status || "active";
      return `<div class="item admin-user">
        <b>${esc(x.username || d.id)}</b> — ${esc(status)}
        <div class="admin-buttons">
          <button data-uid="${esc(d.id)}" data-status="active">${esc(t("active"))}</button>
          <button data-uid="${esc(d.id)}" data-status="suspended">${esc(t("suspended"))}</button>
          <button class="danger" data-uid="${esc(d.id)}" data-status="banned">${esc(t("banned"))}</button>
        </div>
      </div>`;
    }).join("") || `<p class="muted">${esc(t("noHistory"))}</p>`;

    document.querySelectorAll("#users [data-status]").forEach(btn => btn.onclick = () => setUserStatus(btn.dataset.uid, btn.dataset.status));

    const q = F.query(F.collection(db, "supportMessages"), F.orderBy("createdAt", "desc"), F.limit(100));
    const m = await F.getDocs(q);
    $("messages").innerHTML = m.docs.map(d => {
      const x = d.data();
      return `<div class="item"><b>${esc(x.username || x.uid || "User")}</b> — ${esc(x.type || "")}<p>${esc(x.message || "")}</p><small>${x.createdAt?.toDate?.().toLocaleString() || ""}</small></div>`;
    }).join("") || `<p class="muted">${esc(t("noHistory"))}</p>`;
  } catch (e) { console.error(e); }
}

async function setUserStatus(uid, status) {
  if (!profile.isAdmin) return;
  try {
    await F.setDoc(F.doc(db, "users", uid), { status, banned: status === "banned" }, { merge: true });
    await loadAdmin();
  } catch (e) { alert(e.message || "Gagal mengubah status."); }
}

applyLanguage();
boot();
