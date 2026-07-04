import { useState, useEffect } from "react";

// ── Storage: всё в localStorage, ключи с префиксом ──────────────────────────
const DB = {
  get: (k) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  remove: (k) => { try { localStorage.removeItem(k); } catch {} },
  keys: (prefix) => Object.keys(localStorage).filter(k => k.startsWith(prefix)),
};

// ── Аккаунты: {username: {passwordHash, isTeacher}} ──────────────────────────
function hashPass(p) {
  // простой хэш для хранения (не криптографический — достаточно для учебного приложения)
  let h = 0;
  for (let i = 0; i < p.length; i++) { h = ((h << 5) - h) + p.charCodeAt(i); h |= 0; }
  return h.toString(36);
}

const TEACHER_CODE = "lehrer2024"; // код при регистрации учителя

function getAccounts() { return DB.get("accounts") || {}; }
function saveAccounts(a) { DB.set("accounts", a); }

function getUserData(username) {
  return DB.get(`user_${username}`) || { words: [], folders: [], progress: {} };
}
function saveUserData(username, data) { DB.set(`user_${username}`, data); }

// Глобальные слова учителя
function getGlobalWords() { return DB.get("global_words") || []; }
function saveGlobalWords(w) { DB.set("global_words", w); }
function getGlobalFolders() { return DB.get("global_folders") || []; }
function saveGlobalFolders(f) { DB.set("global_folders", f); }

// ── SRS ──────────────────────────────────────────────────────────────────────
const INTERVALS = [0, 1, 3, 7, 14, 30];
function nextReview(level, knew) {
  const newLevel = knew ? Math.min(level + 1, INTERVALS.length - 1) : 0;
  return { level: newLevel, due: Date.now() + INTERVALS[newLevel] * 86400000 };
}
function isDue(p) { return !p?.due || Date.now() >= p.due; }
const lvlEmoji = (l) => ["🌱","🌿","🌲","⭐","🏆","💎"][l ?? 0] || "🌱";

// ── CSS ───────────────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;1,400&family=Inter:wght@400;500;600&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --ink: #1a1a2e; --ink-soft: #3d3d5c; --ivory: #f8f5ef; --ivory-dark: #ede9e0;
    --sage: #5a7a6a; --sage-light: #8aaa96; --sage-pale: #e8f0eb;
    --accent: #c8773a; --accent-pale: #f5ebe0;
    --red-soft: #c0392b; --red-pale: #fdecea;
    --shadow: 0 4px 24px rgba(26,26,46,0.10); --radius: 14px;
  }
  body { background: var(--ivory); color: var(--ink); font-family: 'Inter', system-ui, sans-serif; min-height: 100vh; }
  h1,h2,h3 { font-family: 'Lora', Georgia, serif; }
  .app { max-width: 700px; margin: 0 auto; padding: 24px 16px 60px; }

  /* Header */
  .header { display:flex; align-items:center; justify-content:space-between; padding-bottom:18px; border-bottom:1.5px solid var(--ivory-dark); margin-bottom:24px; }
  .brand h1 { font-size:21px; letter-spacing:-0.5px; }
  .brand span { font-size:12px; color:var(--sage); font-style:italic; font-family:'Lora',serif; }
  .user-pill { display:flex; align-items:center; gap:8px; background:var(--sage-pale); border-radius:99px; padding:6px 14px 6px 10px; cursor:pointer; border:none; font-size:13px; color:var(--sage); font-family:inherit; transition:background .15s; }
  .user-pill:hover { background:#d4e4da; }
  .dot { width:8px; height:8px; border-radius:50%; background:var(--sage); }
  .teacher-badge { background:var(--accent-pale); color:var(--accent); font-size:11px; padding:2px 8px; border-radius:99px; font-weight:600; }

  /* Auth */
  .auth-wrap { display:flex; flex-direction:column; align-items:center; padding:40px 0 24px; }
  .auth-wrap h2 { font-size:26px; margin-bottom:6px; }
  .auth-wrap p { color:var(--ink-soft); font-size:14px; margin-bottom:28px; }
  .auth-box { background:white; border-radius:var(--radius); box-shadow:var(--shadow); padding:28px; width:100%; max-width:360px; }
  .auth-box label { display:block; font-size:12px; font-weight:600; color:var(--ink-soft); margin-bottom:5px; letter-spacing:.3px; text-transform:uppercase; }
  .auth-box input { width:100%; padding:10px 13px; border:1.5px solid var(--ivory-dark); border-radius:8px; font-size:14px; color:var(--ink); background:var(--ivory); outline:none; font-family:inherit; margin-bottom:14px; transition:border-color .15s; }
  .auth-box input:focus { border-color:var(--sage); background:white; }
  .btn-main { width:100%; padding:11px; background:var(--ink); color:white; border:none; border-radius:8px; font-size:14px; font-weight:600; cursor:pointer; font-family:inherit; transition:background .15s; }
  .btn-main:hover { background:var(--ink-soft); }
  .btn-main:disabled { opacity:.4; cursor:not-allowed; }
  .auth-switch { margin-top:16px; font-size:13px; color:var(--sage); cursor:pointer; background:none; border:none; text-decoration:underline; font-family:inherit; display:block; width:100%; text-align:center; }
  .err { color:var(--red-soft); font-size:13px; margin-top:4px; }
  .ok { color:var(--sage); font-size:13px; margin-top:4px; }

  /* Nav */
  .nav { display:flex; gap:4px; background:var(--ivory-dark); border-radius:10px; padding:4px; margin-bottom:22px; }
  .nav-tab { flex:1; padding:8px 6px; border:none; border-radius:7px; font-size:13px; font-weight:500; cursor:pointer; background:transparent; color:var(--ink-soft); font-family:inherit; transition:all .15s; }
  .nav-tab.active { background:white; color:var(--ink); box-shadow:0 1px 4px rgba(0,0,0,.10); }

  /* Stats */
  .stats-bar { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-bottom:20px; }
  .stat { background:white; border-radius:10px; padding:13px 10px; text-align:center; box-shadow:0 1px 4px rgba(0,0,0,.06); }
  .stat-n { font-family:'Lora',serif; font-size:24px; font-weight:600; line-height:1; }
  .stat-l { font-size:10px; color:var(--ink-soft); margin-top:3px; text-transform:uppercase; letter-spacing:.5px; }
  .stat-n.due { color:var(--accent); } .stat-n.ok { color:var(--sage); }

  /* Direction toggle */
  .dir-toggle { display:flex; align-items:center; gap:0; background:var(--ivory-dark); border-radius:99px; padding:3px; margin: 0 auto 16px; width:fit-content; }
  .dir-btn { padding:6px 16px; border:none; border-radius:99px; font-size:13px; font-weight:500; cursor:pointer; background:transparent; color:var(--ink-soft); font-family:inherit; transition:all .15s; }
  .dir-btn.active { background:white; color:var(--ink); box-shadow:0 1px 4px rgba(0,0,0,.10); font-weight:600; }

  /* Progress bar */
  .prog-wrap { margin-bottom:14px; }
  .prog-bar { height:4px; background:var(--ivory-dark); border-radius:99px; overflow:hidden; margin-bottom:6px; }
  .prog-fill { height:100%; background:var(--sage); border-radius:99px; transition:width .3s; }
  .prog-text { font-size:11px; color:var(--ink-soft); text-align:right; }

  /* Flashcard */
  .fc-wrap { margin:0 auto 18px; }
  .fc { background:white; border-radius:var(--radius); box-shadow:var(--shadow); padding:36px 28px; min-height:210px; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; cursor:pointer; transition:transform .15s, box-shadow .15s; position:relative; user-select:none; }
  .fc:hover { transform:translateY(-2px); box-shadow:0 8px 32px rgba(26,26,46,.13); }
  .fc-hint { font-size:10px; color:var(--sage-light); text-transform:uppercase; letter-spacing:.8px; margin-bottom:14px; }
  .fc-article { font-size:17px; color:var(--accent); font-family:'Lora',serif; font-style:italic; }
  .fc-word { font-family:'Lora',serif; font-size:34px; font-weight:600; color:var(--ink); line-height:1.2; }
  .fc-ru { font-size:18px; color:var(--ink-soft); margin-top:10px; }
  .fc-example { font-size:13px; color:var(--ink-soft); margin-top:8px; font-style:italic; border-top:1px solid var(--ivory-dark); padding-top:8px; max-width:340px; }
  .fc-tap { font-size:11px; color:#ccc; margin-top:18px; }
  .fc-lvl { position:absolute; top:13px; right:13px; font-size:11px; color:var(--sage-light); }
  .fc-folder { position:absolute; top:13px; left:13px; font-size:11px; color:var(--accent); background:var(--accent-pale); padding:2px 8px; border-radius:99px; }

  /* Answer btns */
  .ans-btns { display:flex; gap:10px; margin-top:2px; }
  .btn-knew { flex:1; padding:13px; background:var(--sage-pale); color:var(--sage); border:none; border-radius:10px; font-size:14px; font-weight:600; cursor:pointer; font-family:inherit; transition:background .15s; }
  .btn-knew:hover { background:#c4dccb; }
  .btn-forgot { flex:1; padding:13px; background:var(--red-pale); color:var(--red-soft); border:none; border-radius:10px; font-size:14px; font-weight:600; cursor:pointer; font-family:inherit; transition:background .15s; }
  .btn-forgot:hover { background:#fad5d2; }

  /* Empty */
  .empty { text-align:center; padding:40px 16px; color:var(--ink-soft); }
  .empty .emoji { font-size:44px; margin-bottom:14px; }
  .empty h3 { font-size:18px; margin-bottom:6px; color:var(--ink); }

  /* Word list */
  .word-list { display:flex; flex-direction:column; gap:8px; }
  .word-item { background:white; border-radius:10px; padding:13px 14px; display:flex; align-items:center; gap:10px; box-shadow:0 1px 4px rgba(0,0,0,.06); }
  .wi-text { flex:1; }
  .wi-de { font-weight:600; font-size:15px; }
  .wi-article { color:var(--accent); font-style:italic; font-size:13px; margin-right:3px; }
  .wi-ru { font-size:13px; color:var(--ink-soft); margin-top:2px; }
  .wi-folder { font-size:10px; background:var(--accent-pale); color:var(--accent); padding:2px 7px; border-radius:99px; font-weight:600; white-space:nowrap; }
  .wi-badge { font-size:10px; padding:2px 7px; border-radius:99px; font-weight:600; text-transform:uppercase; }
  .badge-g { background:var(--sage-pale); color:var(--sage); }
  .badge-p { background:var(--accent-pale); color:var(--accent); }
  .btn-del { background:none; border:none; cursor:pointer; color:#ccc; font-size:15px; padding:3px 5px; border-radius:6px; transition:color .15s, background .15s; }
  .btn-del:hover { color:var(--red-soft); background:var(--red-pale); }

  /* Add form */
  .add-form { background:white; border-radius:var(--radius); padding:22px; box-shadow:var(--shadow); margin-bottom:18px; }
  .add-form h3 { font-size:16px; margin-bottom:14px; }
  .form-row { display:flex; gap:8px; margin-bottom:10px; flex-wrap:wrap; }
  .form-row input, .add-form input, .add-form select, .add-form textarea { flex:1; padding:9px 12px; border:1.5px solid var(--ivory-dark); border-radius:8px; font-size:13px; color:var(--ink); background:var(--ivory); outline:none; font-family:inherit; transition:border-color .15s; min-width:80px; }
  .form-row input:focus, .add-form input:focus, .add-form select:focus, .add-form textarea:focus { border-color:var(--sage); background:white; }
  .in-sm { width:80px; flex:none !important; }
  .btn-add { padding:9px 18px; background:var(--sage); color:white; border:none; border-radius:8px; font-size:13px; font-weight:600; cursor:pointer; font-family:inherit; transition:background .15s; white-space:nowrap; }
  .btn-add:hover { background:var(--ink); }
  .btn-add:disabled { opacity:.4; cursor:not-allowed; }
  .sec-label { font-size:11px; font-weight:600; color:var(--ink-soft); text-transform:uppercase; letter-spacing:.5px; margin-bottom:9px; margin-top:2px; }

  /* Folders */
  .folder-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(150px,1fr)); gap:10px; margin-bottom:20px; }
  .folder-card { background:white; border-radius:12px; padding:16px 14px; box-shadow:0 1px 4px rgba(0,0,0,.06); cursor:pointer; border:2px solid transparent; transition:all .15s; }
  .folder-card:hover { border-color:var(--sage-light); transform:translateY(-1px); }
  .folder-card.active { border-color:var(--sage); }
  .folder-card.all { border-color:var(--ivory-dark); }
  .folder-icon { font-size:22px; margin-bottom:6px; }
  .folder-name { font-size:14px; font-weight:600; color:var(--ink); }
  .folder-count { font-size:11px; color:var(--ink-soft); margin-top:2px; }
  .folder-actions { display:flex; gap:6px; align-items:center; margin-bottom:4px; }
  .btn-sm { padding:5px 12px; border:1.5px solid var(--ivory-dark); background:white; border-radius:7px; font-size:12px; font-weight:500; cursor:pointer; font-family:inherit; color:var(--ink-soft); transition:all .15s; }
  .btn-sm:hover { border-color:var(--sage); color:var(--sage); }
  .btn-sm.danger:hover { border-color:var(--red-soft); color:var(--red-soft); }
  select { appearance:none; background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%238aaa96' stroke-width='1.5' fill='none'/%3E%3C/svg%3E"); background-repeat:no-repeat; background-position:right 10px center; padding-right:28px !important; }

  /* Filter bar */
  .filter-bar { display:flex; gap:8px; margin-bottom:14px; flex-wrap:wrap; align-items:center; }
  .filter-bar select { flex:1; min-width:120px; max-width:200px; }
  .filter-bar input { flex:2; min-width:120px; }
`;

// ── App root ──────────────────────────────────────────────────────────────────
export default function App() {
  const [session, setSession] = useState(null); // {username, isTeacher}
  const [tab, setTab] = useState("learn");

  useEffect(() => {
    const s = DB.get("session");
    if (s) setSession(s);
  }, []);

  function login(username, isTeacher) {
    const s = { username, isTeacher };
    DB.set("session", s);
    setSession(s);
    setTab("learn");
  }
  function logout() { DB.remove("session"); setSession(null); }

  if (!session) return <><style>{css}</style><div className="app"><AuthScreen onLogin={login} /></div></>;

  return (
    <><style>{css}</style><div className="app">
      <header className="header">
        <div className="brand">
          <h1>Wörterkarten</h1>
          <span>Deutsch lernen</span>
        </div>
        <button className="user-pill" onClick={logout}>
          <span className="dot" />
          {session.username}
          {session.isTeacher && <span className="teacher-badge">Lehrerin</span>}
        </button>
      </header>
      <nav className="nav">
        <button className={`nav-tab${tab==="learn"?" active":""}`} onClick={()=>setTab("learn")}>🃏 Lernen</button>
        <button className={`nav-tab${tab==="words"?" active":""}`} onClick={()=>setTab("words")}>📋 Wörter</button>
        <button className={`nav-tab${tab==="folders"?" active":""}`} onClick={()=>setTab("folders")}>📁 Ordner</button>
        {session.isTeacher && <button className={`nav-tab${tab==="manage"?" active":""}`} onClick={()=>setTab("manage")}>✏️ Verwalten</button>}
      </nav>
      {tab==="learn" && <LearnTab session={session} />}
      {tab==="words" && <WordsTab session={session} />}
      {tab==="folders" && <FoldersTab session={session} />}
      {tab==="manage" && session.isTeacher && <ManageTab />}
    </div></>
  );
}

// ── Auth ──────────────────────────────────────────────────────────────────────
function AuthScreen({ onLogin }) {
  const [mode, setMode] = useState("login"); // login | register
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [teacherCode, setTeacherCode] = useState("");
  const [err, setErr] = useState("");

  function handleSubmit() {
    setErr("");
    const u = username.trim();
    if (!u || !password) { setErr("Fehlende Angaben."); return; }
    const accounts = getAccounts();

    if (mode === "login") {
      const acc = accounts[u];
      if (!acc) { setErr("Benutzer nicht gefunden."); return; }
      if (acc.passwordHash !== hashPass(password)) { setErr("Falsches Passwort."); return; }
      onLogin(u, acc.isTeacher);
    } else {
      if (accounts[u]) { setErr("Benutzername vergeben."); return; }
      if (password.length < 4) { setErr("Passwort mindestens 4 Zeichen."); return; }
      const isTeacher = teacherCode === TEACHER_CODE;
      if (teacherCode && !isTeacher) { setErr("Falscher Lehrerinnen-Code."); return; }
      accounts[u] = { passwordHash: hashPass(password), isTeacher };
      saveAccounts(accounts);
      onLogin(u, isTeacher);
    }
  }

  return (
    <div className="auth-wrap">
      <h2>{mode==="login" ? "Willkommen zurück 👋" : "Konto erstellen 🌱"}</h2>
      <p>{mode==="login" ? "Melde dich mit deinem Konto an." : "Wähle einen Namen und ein Passwort."}</p>
      <div className="auth-box">
        <label>Benutzername</label>
        <input placeholder="z. B. Maria" value={username} onChange={e=>setUsername(e.target.value)} autoFocus onKeyDown={e=>e.key==="Enter"&&handleSubmit()} />
        <label>Passwort</label>
        <input type="password" placeholder="••••••" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleSubmit()} />
        {mode==="register" && <>
          <label>Lehrerinnen-Code (optional)</label>
          <input placeholder="Nur für die Lehrerin" value={teacherCode} onChange={e=>setTeacherCode(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleSubmit()} />
        </>}
        {err && <p className="err">{err}</p>}
        <button className="btn-main" style={{marginTop:6}} onClick={handleSubmit} disabled={!username.trim()||!password}>
          {mode==="login" ? "Einloggen" : "Registrieren"}
        </button>
        <button className="auth-switch" onClick={()=>{setMode(m=>m==="login"?"register":"login");setErr("");}}>
          {mode==="login" ? "Noch kein Konto? Registrieren →" : "← Zurück zum Login"}
        </button>
      </div>
    </div>
  );
}

// ── Helpers: merge global + personal words ────────────────────────────────────
function getAllWords(username) {
  const gw = getGlobalWords();
  const ud = getUserData(username);
  return [...gw, ...ud.words];
}
function getGlobalFolderList() { return getGlobalFolders(); }
function getUserFolderList(username) { return getUserData(username).folders || []; }
function getAllFolders(username) {
  const gf = getGlobalFolderList().map(f=>({...f, source:"global"}));
  const uf = getUserFolderList(username).map(f=>({...f, source:"personal"}));
  return [...gf, ...uf];
}

// ── Learn tab ─────────────────────────────────────────────────────────────────
function LearnTab({ session }) {
  const [revealed, setRevealed] = useState(false);
  const [idx, setIdx] = useState(0);
  const [direction, setDirection] = useState(() => localStorage.getItem("dw_dir") || "de2ru");
  const [filterFolder, setFilterFolder] = useState("all");
  const [ud, setUd] = useState(() => getUserData(session.username));

  const setDir = (d) => { setDirection(d); localStorage.setItem("dw_dir", d); setRevealed(false); setIdx(0); };

  const allWords = getAllWords(session.username);
  const folders = getAllFolders(session.username);

  const filteredWords = filterFolder === "all" ? allWords
    : allWords.filter(w => w.folderId === filterFolder);

  const dueCards = filteredWords.filter(w => isDue(ud.progress[w.id]));
  const total = filteredWords.length;
  const learned = filteredWords.filter(w => (ud.progress[w.id]?.level||0) >= 3).length;
  const card = dueCards[idx % Math.max(dueCards.length,1)] || null;

  async function answer(knew) {
    if (!card) return;
    const p = ud.progress[card.id] || { level: 0 };
    const newProg = { ...ud.progress, [card.id]: nextReview(p.level, knew) };
    const newUd = { ...ud, progress: newProg };
    setUd(newUd);
    saveUserData(session.username, newUd);
    setRevealed(false);
    setIdx(i => i >= dueCards.length - 1 ? 0 : i + 1);
  }

  const front = card ? (direction==="de2ru"
    ? { hint:"Deutsch → ?", article: card.article, word: card.de, isDE: true }
    : { hint:"Muttersprache → ?", word: card.ru, isDE: false }) : null;
  const back = card ? (direction==="de2ru"
    ? { word: card.ru, isDE: false }
    : { article: card.article, word: card.de, isDE: true }) : null;

  const cardFolder = card ? folders.find(f=>f.id===card.folderId) : null;

  return (<>
    <div className="stats-bar">
      <div className="stat"><div className="stat-n">{total}</div><div className="stat-l">Gesamt</div></div>
      <div className="stat"><div className={`stat-n${dueCards.length>0?" due":""}`}>{dueCards.length}</div><div className="stat-l">Zu lernen</div></div>
      <div className="stat"><div className="stat-n ok">{learned}</div><div className="stat-l">Gelernt</div></div>
    </div>
    {total>0 && <div className="prog-wrap">
      <div className="prog-bar"><div className="prog-fill" style={{width:`${Math.round(learned/total*100)}%`}} /></div>
      <div className="prog-text">{Math.round(learned/total*100)}% gemeistert</div>
    </div>}

    {/* Filter by folder */}
    {folders.length>0 && <div className="filter-bar">
      <select value={filterFolder} onChange={e=>{setFilterFolder(e.target.value);setIdx(0);setRevealed(false);}}>
        <option value="all">📂 Alle Ordner</option>
        {folders.map(f=><option key={f.id} value={f.id}>{f.icon} {f.name}</option>)}
      </select>
    </div>}

    {total>0 && <div className="dir-toggle">
      <button className={`dir-btn${direction==="de2ru"?" active":""}`} onClick={()=>setDir("de2ru")}>Deutsch</button>
      <span style={{color:"var(--sage-light)",padding:"0 2px"}}>⇄</span>
      <button className={`dir-btn${direction==="ru2de"?" active":""}`} onClick={()=>setDir("ru2de")}>Muttersprache</button>
    </div>}

    {!card ? (
      <div className="empty">
        <div className="emoji">{total===0?"📭":"🎉"}</div>
        <h3>{total===0?"Noch keine Wörter":"Alle Karten gelernt!"}</h3>
        <p style={{fontSize:14}}>{total===0?"Die Lehrerin fügt bald Wörter hinzu.":"Komm später wieder zurück."}</p>
      </div>
    ) : (<>
      <div className="fc-wrap">
        <div className="fc" onClick={()=>!revealed&&setRevealed(true)}>
          {cardFolder && <div className="fc-folder">{cardFolder.icon} {cardFolder.name}</div>}
          <div className="fc-lvl">{lvlEmoji(ud.progress[card.id]?.level)}</div>
          <div className="fc-hint">{front.hint}</div>
          {front.isDE && front.article && <div className="fc-article">{front.article}</div>}
          <div className="fc-word" style={front.isDE?{}:{fontFamily:"'Inter',sans-serif",fontSize:28}}>{front.word}</div>
          {revealed ? (<>
            {back.isDE && back.article && <div className="fc-article" style={{marginTop:10}}>{back.article}</div>}
            <div className={back.isDE?"fc-word":"fc-ru"} style={back.isDE?{marginTop:6,fontSize:28}:{}}>{back.word}</div>
            {card.example && <div className="fc-example">„{card.example}"</div>}
          </>) : <div className="fc-tap">Tippe, um {direction==="de2ru"?"die Übersetzung":"das deutsche Wort"} zu sehen</div>}
        </div>
      </div>
      {revealed && <div className="ans-btns">
        <button className="btn-forgot" onClick={()=>answer(false)}>😬 Nochmal</button>
        <button className="btn-knew" onClick={()=>answer(true)}>✓ Wusste ich</button>
      </div>}
    </>)}
  </>);
}

// ── Words tab ─────────────────────────────────────────────────────────────────
function WordsTab({ session }) {
  const [de, setDe] = useState(""); const [article, setArticle] = useState("");
  const [ru, setRu] = useState(""); const [example, setExample] = useState("");
  const [folderId, setFolderId] = useState("");
  const [search, setSearch] = useState("");
  const [filterFolder, setFilterFolder] = useState("all");
  const [ud, setUd] = useState(() => getUserData(session.username));

  const folders = getAllFolders(session.username);
  const allWords = getAllWords(session.username);

  function saveUD(newUd) { setUd(newUd); saveUserData(session.username, newUd); }

  function addWord() {
    if (!de.trim()||!ru.trim()) return;
    const w = { id:`p_${Date.now()}_${Math.random().toString(36).slice(2)}`, de:de.trim(), article:article.trim(), ru:ru.trim(), example:example.trim(), folderId:folderId||null, addedBy:session.username, source:"personal" };
    saveUD({ ...ud, words: [...ud.words, w] });
    setDe(""); setArticle(""); setRu(""); setExample(""); setFolderId("");
  }

  function deleteWord(id) {
    // can only delete own personal words
    saveUD({ ...ud, words: ud.words.filter(w=>w.id!==id) });
  }

  const visible = allWords.filter(w => {
    const matchFolder = filterFolder==="all" || w.folderId===filterFolder;
    const matchSearch = !search || w.de.toLowerCase().includes(search.toLowerCase()) || w.ru.toLowerCase().includes(search.toLowerCase());
    return matchFolder && matchSearch;
  });

  return (<>
    <div className="add-form">
      <h3>+ Eigenes Wort hinzufügen</h3>
      <div className="form-row">
        <input className="in-sm" placeholder="der/die/das" value={article} onChange={e=>setArticle(e.target.value)} />
        <input placeholder="Deutsches Wort" value={de} onChange={e=>setDe(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addWord()} />
        <input placeholder="Muttersprache" value={ru} onChange={e=>setRu(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addWord()} />
      </div>
      <div className="form-row">
        <input placeholder="Beispielsatz (optional)" value={example} onChange={e=>setExample(e.target.value)} />
        <select value={folderId} onChange={e=>setFolderId(e.target.value)} style={{flex:"none",width:160}}>
          <option value="">📂 Kein Ordner</option>
          {folders.filter(f=>f.source==="personal").map(f=><option key={f.id} value={f.id}>{f.icon} {f.name}</option>)}
        </select>
        <button className="btn-add" onClick={addWord} disabled={!de.trim()||!ru.trim()}>+</button>
      </div>
    </div>

    <ImportBlock username={session.username} onImport={()=>window.location.reload()} />

    <div className="filter-bar">
      <input placeholder="🔍 Suchen…" value={search} onChange={e=>setSearch(e.target.value)} />
      <select value={filterFolder} onChange={e=>setFilterFolder(e.target.value)}>
        <option value="all">Alle Ordner</option>
        {folders.map(f=><option key={f.id} value={f.id}>{f.icon} {f.name}</option>)}
      </select>
    </div>

    <div className="sec-label">Wörter ({visible.length})</div>
    <div className="word-list">
      {visible.length===0 && <div className="empty" style={{padding:24}}><p>Keine Wörter gefunden.</p></div>}
      {visible.map(w=>{
        const folder = folders.find(f=>f.id===w.folderId);
        const isOwn = w.source==="personal" && w.addedBy===session.username;
        return (
          <div className="word-item" key={w.id}>
            <div className="wi-text">
              <div className="wi-de">{w.article&&<span className="wi-article">{w.article}</span>}{w.de}</div>
              <div className="wi-ru">{w.ru}{w.example&&<span style={{fontStyle:"italic",color:"#aaa"}}> — {w.example}</span>}</div>
            </div>
            {folder && <span className="wi-folder">{folder.icon} {folder.name}</span>}
            <span className={`wi-badge ${w.source==="global"?"badge-g":"badge-p"}`}>{w.source==="global"?"Kurs":"Ich"}</span>
            <span style={{fontSize:13}}>{lvlEmoji(getUserData(session.username).progress[w.id]?.level)}</span>
            {isOwn && <button className="btn-del" onClick={()=>deleteWord(w.id)}>✕</button>}
          </div>
        );
      })}
    </div>
  </>);
}

// ── Folders tab ───────────────────────────────────────────────────────────────
function FoldersTab({ session }) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("📁");
  const [selected, setSelected] = useState(null);
  const [ud, setUd] = useState(() => getUserData(session.username));

  function saveUD(newUd) { setUd(newUd); saveUserData(session.username, newUd); }

  const personalFolders = ud.folders || [];
  const globalFolders = getGlobalFolderList();
  const allFolders = [
    ...globalFolders.map(f=>({...f,source:"global"})),
    ...personalFolders.map(f=>({...f,source:"personal"}))
  ];
  const allWords = getAllWords(session.username);

  function addFolder() {
    if (!name.trim()) return;
    const f = { id:`pf_${Date.now()}`, name:name.trim(), icon };
    saveUD({ ...ud, folders:[...personalFolders, f] });
    setName(""); setIcon("📁");
  }
  function deleteFolder(id) {
    // remove folder and unassign words
    const newWords = ud.words.map(w=>w.folderId===id?{...w,folderId:null}:w);
    saveUD({ ...ud, folders:personalFolders.filter(f=>f.id!==id), words:newWords });
    if (selected===id) setSelected(null);
  }

  const wordsInFolder = (fid) => allWords.filter(w=>w.folderId===fid);

  const icons = ["📁","⭐","🔤","🏠","🍎","🚗","🌍","💼","📚","🎭","🌿","🔢"];

  return (<>
    <div className="add-form">
      <h3>+ Eigenen Ordner erstellen</h3>
      <div className="form-row">
        <select value={icon} onChange={e=>setIcon(e.target.value)} style={{flex:"none",width:80}}>
          {icons.map(ic=><option key={ic} value={ic}>{ic}</option>)}
        </select>
        <input placeholder="Ordnername, z. B. Lektion 3" value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addFolder()} />
        <button className="btn-add" onClick={addFolder} disabled={!name.trim()}>Erstellen</button>
      </div>
    </div>

    <div className="sec-label">Ordner</div>
    <div className="folder-grid">
      <div className={`folder-card all${selected===null?" active":""}`} onClick={()=>setSelected(null)}>
        <div className="folder-icon">📂</div>
        <div className="folder-name">Alle Wörter</div>
        <div className="folder-count">{allWords.length} Wörter</div>
      </div>
      {allFolders.map(f=>(
        <div key={f.id} className={`folder-card${selected===f.id?" active":""}`} onClick={()=>setSelected(s=>s===f.id?null:f.id)}>
          <div className="folder-icon">{f.icon}</div>
          <div className="folder-name">{f.name}</div>
          <div className="folder-count">{wordsInFolder(f.id).length} Wörter · {f.source==="global"?"Kurs":"Mein"}</div>
        </div>
      ))}
    </div>

    {selected && (() => {
      const folder = allFolders.find(f=>f.id===selected);
      const words = wordsInFolder(selected);
      const isOwn = folder?.source==="personal";
      return (<>
        <div className="folder-actions">
          <span style={{fontWeight:600,fontSize:15}}>{folder?.icon} {folder?.name}</span>
          {isOwn && <button className="btn-sm danger" onClick={()=>deleteFolder(selected)}>Löschen</button>}
        </div>
        <div className="word-list" style={{marginTop:10}}>
          {words.length===0 && <div className="empty" style={{padding:20}}><p>Noch keine Wörter in diesem Ordner.</p></div>}
          {words.map(w=>(
            <div className="word-item" key={w.id}>
              <div className="wi-text">
                <div className="wi-de">{w.article&&<span className="wi-article">{w.article}</span>}{w.de}</div>
                <div className="wi-ru">{w.ru}</div>
              </div>
              <span className={`wi-badge ${w.source==="global"?"badge-g":"badge-p"}`}>{w.source==="global"?"Kurs":"Ich"}</span>
            </div>
          ))}
        </div>
      </>);
    })()}
  </>);
}


// ── Import block (for students) ───────────────────────────────────────────────
function ImportBlock({ username, onImport }) {
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");
  const [open, setOpen] = useState(false);

  function doImport() {
    try {
      const str = decodeURIComponent(escape(atob(code.trim())));
      const data = JSON.parse(str);
      if (!data.words || !Array.isArray(data.words)) throw new Error("bad");
      // Save as global words (overwrite with merge)
      const existing = getGlobalWords();
      const existingIds = new Set(existing.map(w=>w.id));
      const newWords = data.words.filter(w=>!existingIds.has(w.id));
      saveGlobalWords([...existing, ...newWords]);
      // Folders
      if (data.folders) {
        const ef = getGlobalFolderList();
        const efIds = new Set(ef.map(f=>f.id));
        const newF = data.folders.filter(f=>!efIds.has(f.id));
        saveGlobalFolders([...ef, ...newF]);
      }
      setMsg(`✓ ${newWords.length} neue Wörter importiert!`);
      setCode("");
      setTimeout(()=>{ setMsg(""); setOpen(false); onImport(); }, 1500);
    } catch {
      setMsg("⚠ Ungültiger Code.");
    }
  }

  if (!open) return (
    <div style={{marginBottom:14}}>
      <button className="btn-sm" onClick={()=>setOpen(true)} style={{width:"100%",padding:"10px",textAlign:"center",borderStyle:"dashed"}}>
        📥 Code von Lehrerin importieren
      </button>
    </div>
  );

  return (
    <div className="add-form" style={{marginBottom:14,background:"var(--accent-pale)",border:"1.5px solid #e8c4a0"}}>
      <h3>📥 Code importieren</h3>
      <p style={{fontSize:13,color:"var(--ink-soft)",marginBottom:10}}>Füge den Code ein, den du von deiner Lehrerin bekommen hast.</p>
      <div className="form-row">
        <input placeholder="Code hier einfügen…" value={code} onChange={e=>setCode(e.target.value)} />
        <button className="btn-add" onClick={doImport} disabled={!code.trim()} style={{background:"var(--accent)"}}>Importieren</button>
        <button className="btn-sm" onClick={()=>setOpen(false)}>✕</button>
      </div>
      {msg && <p className={msg.startsWith("✓")?"ok":"err"}>{msg}</p>}
    </div>
  );
}

// ── Manage tab (teacher) ──────────────────────────────────────────────────────
function ManageTab() {
  const [de, setDe] = useState(""); const [article, setArticle] = useState("");
  const [ru, setRu] = useState(""); const [example, setExample] = useState("");
  const [folderId, setFolderId] = useState("");
  const [bulk, setBulk] = useState("");
  const [msg, setMsg] = useState("");
  const [folderName, setFolderName] = useState("");
  const [folderIcon, setFolderIcon] = useState("📁");
  const [words, setWords] = useState(getGlobalWords);
  const [folders, setFolders] = useState(getGlobalFolderList);
  const icons = ["📁","⭐","🔤","🏠","🍎","🚗","🌍","💼","📚","🎭","🌿","🔢"];

  function saveW(w) { setWords(w); saveGlobalWords(w); }
  function saveF(f) { setFolders(f); saveGlobalFolders(f); }

  function addWord() {
    if (!de.trim()||!ru.trim()) return;
    const w = { id:`g_${Date.now()}_${Math.random().toString(36).slice(2)}`, de:de.trim(), article:article.trim(), ru:ru.trim(), example:example.trim(), folderId:folderId||null, addedBy:"Lehrerin", source:"global" };
    saveW([...words, w]);
    setDe(""); setArticle(""); setRu(""); setExample("");
    flash("✓ Wort hinzugefügt");
  }

  function bulkAdd() {
    const lines = bulk.split("\n").map(l=>l.trim()).filter(Boolean);
    const newW = [];
    for (const line of lines) {
      const parts = line.split(/[–\-—|]/).map(s=>s.trim());
      if (parts.length < 2) continue;
      let de_=parts[0], art_="", ru_=parts[1], ex_=parts[2]||"";
      const m = de_.match(/^(der|die|das|ein|eine)\s+(.+)$/i);
      if (m) { art_=m[1]; de_=m[2]; }
      newW.push({ id:`g_${Date.now()}_${Math.random().toString(36).slice(2)}_${newW.length}`, de:de_, article:art_, ru:ru_, example:ex_, folderId:folderId||null, addedBy:"Lehrerin", source:"global" });
    }
    if (!newW.length) { flash("⚠ Format: Wort – Übersetzung"); return; }
    saveW([...words, ...newW]);
    setBulk(""); flash(`✓ ${newW.length} Wörter hinzugefügt`);
  }

  function addFolder() {
    if (!folderName.trim()) return;
    const f = { id:`gf_${Date.now()}`, name:folderName.trim(), icon:folderIcon };
    saveF([...folders, f]);
    setFolderName(""); setFolderIcon("📁");
    flash("✓ Ordner erstellt");
  }

  function flash(m) { setMsg(m); setTimeout(()=>setMsg(""),2500); }

  function doExport() {
    const data = { words, folders, exported: new Date().toLocaleDateString("de-DE") };
    const str = btoa(unescape(encodeURIComponent(JSON.stringify(data))));
    navigator.clipboard.writeText(str)
      .then(()=>flash("✓ Code kopiert! Jetzt an Schüler senden."))
      .catch(()=>{ window.prompt("Kopiere diesen Code:", str); });
  }

  return (<>
    {/* Export */}
    <div className="add-form" style={{background:"var(--sage-pale)",border:"1.5px solid var(--sage-light)"}}>
      <h3>📤 Wörter exportieren</h3>
      <p style={{fontSize:13,color:"var(--ink-soft)",marginBottom:12,lineHeight:1.5}}>
        Exportiere alle Kurswörter als Code — schicke ihn an Schüler per WhatsApp oder Telegram. Sie fügen ihn einmal ein und haben sofort alle Wörter.
      </p>
      <button className="btn-add" onClick={doExport} disabled={words.length===0} style={{background:"var(--sage)"}}>
        📋 Code kopieren ({words.length} Wörter, {folders.length} Ordner)
      </button>
      {msg && <p className="ok" style={{marginTop:8}}>{msg}</p>}
    </div>

    {/* Folder creation */}
    <div className="add-form">
      <h3>📁 Kurs-Ordner erstellen</h3>
      <div className="form-row">
        <select value={folderIcon} onChange={e=>setFolderIcon(e.target.value)} style={{flex:"none",width:80}}>
          {icons.map(ic=><option key={ic} value={ic}>{ic}</option>)}
        </select>
        <input placeholder="Ordnername, z. B. Lektion 1" value={folderName} onChange={e=>setFolderName(e.target.value)} />
        <button className="btn-add" onClick={addFolder} disabled={!folderName.trim()}>Erstellen</button>
      </div>
      {folders.length>0 && <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:8}}>
        {folders.map(f=><span key={f.id} style={{background:"var(--sage-pale)",color:"var(--sage)",padding:"3px 10px",borderRadius:99,fontSize:12,display:"flex",alignItems:"center",gap:6}}>
          {f.icon} {f.name}
          <button style={{background:"none",border:"none",cursor:"pointer",color:"#aaa",fontSize:12,padding:0}} onClick={()=>saveF(folders.filter(x=>x.id!==f.id))}>✕</button>
        </span>)}
      </div>}
    </div>

    {/* Single word */}
    <div className="add-form">
      <h3>Einzelnes Wort hinzufügen</h3>
      <div className="form-row">
        <input className="in-sm" placeholder="der/die/das" value={article} onChange={e=>setArticle(e.target.value)} />
        <input placeholder="Deutsches Wort" value={de} onChange={e=>setDe(e.target.value)} />
        <input placeholder="Muttersprache" value={ru} onChange={e=>setRu(e.target.value)} />
      </div>
      <div className="form-row">
        <input placeholder="Beispielsatz (optional)" value={example} onChange={e=>setExample(e.target.value)} />
        <select value={folderId} onChange={e=>setFolderId(e.target.value)} style={{flex:"none",width:160}}>
          <option value="">📂 Kein Ordner</option>
          {folders.map(f=><option key={f.id} value={f.id}>{f.icon} {f.name}</option>)}
        </select>
        <button className="btn-add" onClick={addWord} disabled={!de.trim()||!ru.trim()}>+</button>
      </div>
      {msg && <p className="ok">{msg}</p>}
    </div>

    {/* Bulk */}
    <div className="add-form">
      <h3>Mehrere Wörter auf einmal</h3>
      <p style={{fontSize:12,color:"var(--ink-soft)",marginBottom:10}}>Format: <code>der Hund – собака</code> oder <code>arbeiten – работать – Ich arbeite gern.</code></p>
      <div className="form-row" style={{marginBottom:10}}>
        <select value={folderId} onChange={e=>setFolderId(e.target.value)}>
          <option value="">📂 Kein Ordner</option>
          {folders.map(f=><option key={f.id} value={f.id}>{f.icon} {f.name}</option>)}
        </select>
      </div>
      <textarea value={bulk} onChange={e=>setBulk(e.target.value)} rows={5}
        placeholder={"der Hund – собака\ndie Katze – кошка\narbeiten – работать – Ich arbeite gern."}
        style={{width:"100%",padding:"9px 12px",border:"1.5px solid var(--ivory-dark)",borderRadius:8,fontSize:13,fontFamily:"inherit",resize:"vertical",background:"var(--ivory)",outline:"none",marginBottom:10}} />
      <button className="btn-add" onClick={bulkAdd} disabled={!bulk.trim()}>Alle hinzufügen</button>
    </div>

    {/* Word list */}
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
      <div className="sec-label" style={{margin:0}}>Kurswörter ({words.length})</div>
      {words.length>0 && <button className="btn-sm danger" onClick={()=>{if(window.confirm("Alle Kurswörter löschen?"))saveW([])}}>Alle löschen</button>}
    </div>
    <div className="word-list">
      {words.length===0 && <div className="empty" style={{padding:20}}><p>Noch keine Kurswörter.</p></div>}
      {words.map(w=>{
        const folder = folders.find(f=>f.id===w.folderId);
        return (
          <div className="word-item" key={w.id}>
            <div className="wi-text">
              <div className="wi-de">{w.article&&<span className="wi-article">{w.article}</span>}{w.de}</div>
              <div className="wi-ru">{w.ru}{w.example&&<span style={{fontStyle:"italic",color:"#aaa"}}> — {w.example}</span>}</div>
            </div>
            {folder && <span className="wi-folder">{folder.icon} {folder.name}</span>}
            <button className="btn-del" onClick={()=>saveW(words.filter(x=>x.id!==w.id))}>✕</button>
          </div>
        );
      })}
    </div>
  </>);
}
