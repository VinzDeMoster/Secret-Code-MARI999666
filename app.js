import { LANGUAGES, getLanguage } from "./languages.js";
import { firebaseConfig } from "./firebase-config.js";

let A,Au,F,auth,db,user,profile={},maps=[];
const $=x=>document.getElementById(x),esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
async function boot(){try{A=await import("https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js");Au=await import("https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js");F=await import("https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js");if(firebaseConfig.apiKey.startsWith("GANTI_"))throw Error("Isi firebaseConfig dulu.");const app=A.initializeApp(firebaseConfig);auth=Au.getAuth(app);db=F.getFirestore(app);Au.onAuthStateChanged(auth,async u=>u?enter(u):showLogin())}catch(e){$("msg").innerHTML="<p>Firebase belum dikonfigurasi. Isi firebaseConfig di file ini.</p>"}}
function showLogin(){$("login").classList.remove("hidden");$("app").classList.add("hidden")}
async function enter(u){user=u;let key="sc_"+u.uid,s=JSON.parse(localStorage.getItem(key)||"null"),hours=u.isAnonymous?6:21;if(!s||Date.now()>s){s=Date.now()+hours*3600000;localStorage.setItem(key,JSON.stringify(s))}if(Date.now()>s)return Au.signOut(auth);$("login").classList.add("hidden");$("app").classList.remove("hidden");$("who").textContent=u.isAnonymous?"Guest":(u.displayName||u.email);let snap=await F.getDoc(F.doc(db,"users",u.uid));profile=snap.exists()?snap.data():{};if(profile.banned){$("notice").innerHTML="<div class='card'>Akun kamu dibanned. Hubungi admin.</div>";return}if(profile.isAdmin)$("adminTab").classList.remove("hidden");await loadCodes();await loadHistory()}
$("logout").onclick=()=>Au.signOut(auth);
$("google").onclick=async()=>{try{await Au.signInWithPopup(auth,new Au.GoogleAuthProvider())}catch(e){alert(e.message)}};
$("guest").onclick=async()=>{try{await Au.signInAnonymously(auth)}catch(e){alert(e.message)}};
const uname=n=>n.toLowerCase().replace(/[^a-z0-9._-]/g,"")+"@username.local";
$("register").onclick=async()=>{try{let n=$("username").value,p=$("password").value;if(!n||p.length<6)return alert("Username/password tidak valid.");let c=await Au.createUserWithEmailAndPassword(auth,uname(n),p);await F.setDoc(F.doc(db,"users",c.user.uid),{username:n,status:"active",isAdmin:false,createdAt:F.serverTimestamp()})}catch(e){alert(e.message)}};
$("loginUser").onclick=async()=>{try{await Au.signInWithEmailAndPassword(auth,uname($("username").value),$("password").value)}catch(e){alert(e.message)}};
async function loadCodes(){let s=await F.getDoc(F.doc(db,"users",user.uid,"data","settings"));maps=s.exists()?s.data().mappings||[]:[];renderMaps()}
function renderMaps(){$("maps").innerHTML=maps.map((m,i)=>`<div><input value="${esc(m.p)}" oninput="maps[${i}].p=this.value"><input value="${esc(m.s)}" oninput="maps[${i}].s=this.value"><button class="danger" onclick="maps.splice(${i},1);renderMaps()">×</button></div>`).join("")||"<p>Belum ada kode.</p>"}
window.maps=maps;window.renderMaps=renderMaps;
$("add").onclick=()=>{let p=$("mp").value.trim(),s=$("ms").value.trim();if(!p||!s)return;maps.push({p,s});$("mp").value="";$("ms").value="";renderMaps()};
$("saveCodes").onclick=async()=>{await F.setDoc(F.doc(db,"users",user.uid,"data","settings"),{mappings:maps});alert("Kode tersimpan.")};
function enc(s){let x=s;[...maps].sort((a,b)=>b.p.length-a.p.length).forEach(m=>x=x.split(m.p).join(m.s));return x}
function dec(s){let x=s;[...maps].sort((a,b)=>b.s.length-a.s.length).forEach(m=>x=x.split(m.s).join(m.p));return x}
$("plain").oninput=e=>$("encoded").textContent=e.target.value?enc(e.target.value):"—";$("secret").oninput=e=>$("decoded").textContent=e.target.value?dec(e.target.value):"—";
$("saveHistory").onclick=async()=>{if(!$("plain").value)return;await F.addDoc(F.collection(db,"users",user.uid,"history"),{plain:$("plain").value,secret:$("encoded").textContent,createdAt:F.serverTimestamp()});loadHistory()};
async function loadHistory(){let q=F.query(F.collection(db,"users",user.uid,"history"),F.orderBy("createdAt","desc"),F.limit(100)),s=await F.getDocs(q);$("hist").innerHTML=s.docs.map(d=>{let x=d.data();return `<div class="item"><b>${esc(x.plain)}</b><br>→ ${esc(x.secret)}<br><small>${x.createdAt?.toDate?.().toLocaleString()||""}</small></div>`}).join("")||"Belum ada."}
$("clear").onclick=async()=>{let s=await F.getDocs(F.collection(db,"users",user.uid,"history"));await Promise.all(s.docs.map(d=>F.deleteDoc(d.ref)));loadHistory()};
$("send").onclick=async()=>{let m=$("cmsg").value.trim();if(!m)return;await F.addDoc(F.collection(db,"supportMessages"),{uid:user.uid,type:$("ctype").value,message:m,createdAt:F.serverTimestamp(),status:"open"});$("cmsg").value="";$("sent").textContent="Pesan terkirim."};
document.querySelectorAll("[data-p]").forEach(b=>b.onclick=()=>{document.querySelectorAll(".page").forEach(x=>x.classList.add("hidden"));$(b.dataset.p).classList.remove("hidden");if(b.dataset.p==="admin")loadAdmin()});
async function loadAdmin(){if(!profile.isAdmin)return;let s=await F.getDocs(F.collection(db,"users"));$("users").innerHTML=s.docs.map(d=>{let x=d.data();return `<div class="item"><b>${esc(x.username||d.id)}</b> — ${esc(x.status||"active")}<br><button onclick="status('${d.id}','active')">Aktif</button><button onclick="status('${d.id}','suspended')">Suspend</button><button class="danger" onclick="status('${d.id}','banned')">Ban</button></div>`}).join("");let q=F.query(F.collection(db,"supportMessages"),F.orderBy("createdAt","desc"),F.limit(100)),m=await F.getDocs(q);$("messages").innerHTML=m.docs.map(d=>{let x=d.data();return `<div class="item"><b>${esc(x.type)}</b><p>${esc(x.message)}</p><small>${esc(x.uid)}</small></div>`}).join("")||"Belum ada."}
window.status=async uid=>{let s=prompt("Status: active / suspended / banned");if(!["active","suspended","banned"].includes(s))return;await F.setDoc(F.doc(db,"users",uid),{status:s,banned:s==="banned"},{merge:true});loadAdmin()};
const LANG={
 id:{title:"⌁ Secret Code Translator",sessionInfo:"Google/akun sendiri: 21 jam. Guest: 6 jam.",google:"🔵 Login Google",guest:"👤 Guest",register:"Buat akun",login:"Login",logout:"Keluar",navTranslate:"Penerjemah",navCodes:"Kode Saya",navHistory:"History",navContact:"Hubungi Admin",navAdmin:"Admin",translator:"🔐 Penerjemah",textToCode:"Teks → Kode",codeToText:"Kode → Teks",saveHistory:"Simpan ke History",myCodes:"⚙️ Kode Buatan Saya",codeHelp:"Contoh: A → @1. Kamu bebas menentukan aturan sendiri.",textChar:"Teks/huruf",secretCode:"Kode rahasia",add:"Tambah",save:"Simpan",history:"📜 History",clearHistory:"Hapus History",contact:"📩 Hubungi Admin",bug:"Bug / Error",question:"Pertanyaan",suggestion:"Saran",message:"Pesan",send:"Kirim",admin:"🛡️ Admin",adminHelp:"Admin dapat melihat pengguna dan mengubah status.",userMessages:"Pesan pengguna"},
 en:{title:"⌁ Secret Code Translator",sessionInfo:"Google/own account: 21 hours. Guest: 6 hours.",google:"🔵 Login with Google",guest:"👤 Guest",register:"Create account",login:"Login",logout:"Logout",navTranslate:"Translator",navCodes:"My Codes",navHistory:"History",navContact:"Contact Admin",navAdmin:"Admin",translator:"🔐 Translator",textToCode:"Text → Code",codeToText:"Code → Text",saveHistory:"Save to History",myCodes:"⚙️ My Custom Codes",codeHelp:"Example: A → @1. You can create your own rules.",textChar:"Text/letter",secretCode:"Secret code",add:"Add",save:"Save",history:"📜 History",clearHistory:"Clear History",contact:"📩 Contact Admin",bug:"Bug / Error",question:"Question",suggestion:"Suggestion",message:"Message",send:"Send",admin:"🛡️ Admin",adminHelp:"Admin can view users and change their status.",userMessages:"User messages"},
 ja:{title:"⌁ Secret Code Translator",sessionInfo:"Google/自分のアカウント：21時間。ゲスト：6時間。",google:"🔵 Googleでログイン",guest:"👤 ゲスト",register:"アカウント作成",login:"ログイン",logout:"ログアウト",navTranslate:"翻訳",navCodes:"マイコード",navHistory:"履歴",navContact:"管理者に連絡",navAdmin:"管理者",translator:"🔐 翻訳",textToCode:"テキスト → コード",codeToText:"コード → テキスト",saveHistory:"履歴に保存",myCodes:"⚙️ 自分のコード",codeHelp:"例：A → @1。自由にルールを設定できます。",textChar:"テキスト/文字",secretCode:"秘密コード",add:"追加",save:"保存",history:"📜 履歴",clearHistory:"履歴を削除",contact:"📩 管理者に連絡",bug:"バグ / エラー",question:"質問",suggestion:"提案",message:"メッセージ",send:"送信",admin:"🛡️ 管理者",adminHelp:"管理者はユーザーを確認し、ステータスを変更できます。",userMessages:"ユーザーメッセージ"},
 zh:{title:"⌁ Secret Code Translator",sessionInfo:"Google/账号：21小时。访客：6小时。",google:"🔵 使用 Google 登录",guest:"👤 访客",register:"创建账号",login:"登录",logout:"退出",navTranslate:"翻译器",navCodes:"我的代码",navHistory:"历史记录",navContact:"联系管理员",navAdmin:"管理员",translator:"🔐 翻译器",textToCode:"文本 → 代码",codeToText:"代码 → 文本",saveHistory:"保存到历史",myCodes:"⚙️ 我的自定义代码",codeHelp:"示例：A → @1。你可以自由设置规则。",textChar:"文本/字符",secretCode:"秘密代码",add:"添加",save:"保存",history:"📜 历史记录",clearHistory:"清除历史",contact:"📩 联系管理员",bug:"错误 / 故障",question:"问题",suggestion:"建议",message:"消息",send:"发送",admin:"🛡️ 管理员",adminHelp:"管理员可以查看用户并修改状态。",userMessages:"用户消息"},
 es:{title:"⌁ Secret Code Translator",sessionInfo:"Google/cuenta propia: 21 horas. Invitado: 6 horas.",google:"🔵 Iniciar con Google",guest:"👤 Invitado",register:"Crear cuenta",login:"Iniciar sesión",logout:"Cerrar sesión",navTranslate:"Traductor",navCodes:"Mis códigos",navHistory:"Historial",navContact:"Contactar al administrador",navAdmin:"Administrador",translator:"🔐 Traductor",textToCode:"Texto → Código",codeToText:"Código → Texto",saveHistory:"Guardar en historial",myCodes:"⚙️ Mis códigos personalizados",codeHelp:"Ejemplo: A → @1. Puedes crear tus propias reglas.",textChar:"Texto/letra",secretCode:"Código secreto",add:"Añadir",save:"Guardar",history:"📜 Historial",clearHistory:"Borrar historial",contact:"📩 Contactar al administrador",bug:"Error / Problema",question:"Pregunta",suggestion:"Sugerencia",message:"Mensaje",send:"Enviar",admin:"🛡️ Administrador",adminHelp:"El administrador puede ver usuarios y cambiar su estado.",userMessages:"Mensajes de usuarios"}
};
let currentLang=localStorage.getItem("sc_language")||"id";
function applyLanguage(lang){currentLang=LANG[lang]?lang:"id";localStorage.setItem("sc_language",currentLang);document.documentElement.lang=currentLang;document.querySelectorAll("[data-i18n]").forEach(el=>{let k=el.dataset.i18n;if(LANG[currentLang][k])el.textContent=LANG[currentLang][k]});document.querySelectorAll("[data-i18n-placeholder]").forEach(el=>{let k=el.dataset.i18nPlaceholder;if(LANG[currentLang][k])el.placeholder=LANG[currentLang][k]});["language","languageLogin"].forEach(id=>{let el=$(id);if(el)el.value=currentLang});let opts=$("ctype")?.options;if(opts){[...opts].forEach(o=>{let k=o.dataset.i18n;if(k&&LANG[currentLang][k])o.textContent=LANG[currentLang][k]})}}
["language","languageLogin"].forEach(id=>$(id)?.addEventListener("change",e=>applyLanguage(e.target.value)));
applyLanguage(currentLang);


const currentLang = () => localStorage.getItem("sc_language") || "id";
function setLanguage(lang){
  if(!LANGUAGES[lang]) return;
  localStorage.setItem("sc_language", lang);
  applyLanguage();
}
function applyLanguage(){
  const lang = currentLang();
  const t = LANGUAGES[lang] || LANGUAGES.id;
  document.documentElement.lang = lang;
  document.title = t.title;
  document.querySelectorAll("[data-i18n]").forEach(el=>{
    const key = el.dataset.i18n;
    if(t[key] !== undefined) el.textContent = t[key];
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el=>{
    const key = el.dataset.i18nPlaceholder;
    if(t[key] !== undefined) el.placeholder = t[key];
  });
  const sel = $("language");
  if(sel) sel.value = lang;
}
function addLanguageSelector(){
  const host = $("app") || $("login");
  if(!host || $("language")) return;
  const box = document.createElement("div");
  box.innerHTML = `<label>${LANGUAGES[currentLang()].language}: </label>
    <select id="language">
      <option value="id">🇮🇩 Indonesia</option>
      <option value="en">🇬🇧 English</option>
      <option value="ja">🇯🇵 日本語</option>
      <option value="zh">🇨🇳 中文</option>
      <option value="es">🇪🇸 Español</option>
    </select>`;
  (host.querySelector("header") || host).prepend(box);
  $("language").onchange = e => setLanguage(e.target.value);
}
addLanguageSelector();
applyLanguage();

boot();