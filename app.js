const app = document.querySelector('#app');
const STORE_KEY = 'bebe-jura-progress-v1';
const todayKey = () => new Date().toISOString().slice(0, 10);
const addDays = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};
const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);

let questions = [];
let state = {
  screen: 'home',
  queue: [],
  current: null,
  selected: new Set(),
  checked: false,
  lastCorrect: false,
  mcSinceRecall: 0,
  recallQueue: [],
  currentRecall: null,
  showModel: false,
  recallText: ''
};
let progress = loadProgress();

init();

async function init() {
  registerServiceWorker();
  try {
    const res = await fetch('./data/questions.json', { cache: 'no-store' });
    questions = await res.json();
    renderHome();
  } catch (err) {
    app.innerHTML = `<main class="screen fade-in"><section class="card"><h2>Fragen konnten nicht geladen werden.</h2><p class="kicker">Starte die App über eine Webadresse oder einen lokalen Server, nicht direkt per Datei.</p></section></main>`;
  }
}

function loadProgress() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; }
  catch { return {}; }
}
function saveProgress() { localStorage.setItem(STORE_KEY, JSON.stringify(progress)); }
function getRecord(id) {
  if (!progress[id]) progress[id] = { mc: {}, recall: {} };
  return progress[id];
}
function isDue(q, kind = 'mc') {
  const rec = getRecord(q.id)[kind];
  return !rec.next || rec.next <= todayKey();
}
function nextInterval(oldInterval, rating) {
  if (rating === 'again') return 1;
  if (rating === 'partial') return 3;
  if (!oldInterval) return 7;
  if (oldInterval < 7) return 7;
  if (oldInterval < 21) return 21;
  return Math.min(90, Math.round(oldInterval * 1.7));
}
function updateSchedule(id, kind, rating) {
  const rec = getRecord(id)[kind];
  const interval = nextInterval(rec.interval || 0, rating);
  rec.interval = interval;
  rec.next = addDays(interval);
  rec.last = todayKey();
  rec.rating = rating;
  rec.repetitions = (rec.repetitions || 0) + 1;
  saveProgress();
}
function buildQueue() {
  const due = questions.filter(q => isDue(q, 'mc'));
  return shuffle(due.length ? due : questions);
}
function startSession() {
  state = { ...state, screen: 'question', queue: buildQueue(), current: null, selected: new Set(), checked: false, mcSinceRecall: 0, recallQueue: [], currentRecall: null, showModel: false, recallText: '' };
  nextQuestion();
}
function nextQuestion() {
  if (state.mcSinceRecall >= 3 && state.recallQueue.length) return startRecall();
  const q = state.queue.shift();
  if (!q) return renderDone();
  state.current = q;
  state.selected = new Set();
  state.checked = false;
  state.lastCorrect = false;
  renderQuestion();
}
function startRecall() {
  const due = state.recallQueue.filter(q => isDue(q, 'recall'));
  state.currentRecall = due[0] || state.recallQueue[0];
  state.recallQueue = state.recallQueue.filter(q => q.id !== state.currentRecall.id);
  state.mcSinceRecall = 0;
  state.showModel = false;
  state.recallText = '';
  renderRecall();
}
function toggleOption(id) {
  if (state.checked) return;
  if (state.current.typ === 'single') state.selected = new Set([id]);
  else state.selected.has(id) ? state.selected.delete(id) : state.selected.add(id);
  renderQuestion();
}
function checkAnswer() {
  const correct = new Set(state.current.antworten.filter(a => a.richtig).map(a => a.id));
  state.lastCorrect = correct.size === state.selected.size && [...correct].every(id => state.selected.has(id));
  state.checked = true;
  renderQuestion();
}
function finishMC(rating) {
  const effective = state.lastCorrect ? rating : 'again';
  updateSchedule(state.current.id, 'mc', effective);
  state.recallQueue.push(state.current);
  state.mcSinceRecall += 1;
  nextQuestion();
}
function finishRecall(rating) {
  updateSchedule(state.currentRecall.id, 'recall', rating);
  nextQuestion();
}
function resetProgress() {
  const ok = confirm('Lokalen Lernfortschritt wirklich löschen? Der Fragenkatalog bleibt erhalten.');
  if (!ok) return;
  progress = {};
  saveProgress();
  renderHome();
}

function layout(inner) {
  app.innerHTML = `<main class="screen fade-in">${inner}</main>`;
}
function header(sub = 'Europarecht I') {
  return `<div class="brand"><div><p class="kicker">${sub}</p><h2>Bebe Jura</h2></div><div class="logo">B</div></div>`;
}
function renderHome() {
  layout(`${header('Private Prüfungsvorbereitung')}
    <section class="card hero">
      <div class="hero-text">
        <h1>Wiederholen. Erinnern. Bestehen.</h1>
        <p>Fokussierter Lernmodus mit MC-Fragen und Active Recall. Lokal gespeichert, ohne sichtbare Statistik.</p>
      </div>
      <div class="actions">
        <button class="btn primary" id="start">Wiederholung starten</button>
        <button class="btn" id="all">Alle Fragen neu mischen</button>
        <button class="btn ghost small" id="reset">Lokalen Fortschritt zurücksetzen</button>
      </div>
    </section>`);
  document.querySelector('#start').onclick = startSession;
  document.querySelector('#all').onclick = () => { state.queue = shuffle(questions); state.mcSinceRecall = 0; nextQuestion(); };
  document.querySelector('#reset').onclick = resetProgress;
}
function renderQuestion() {
  const q = state.current;
  const correctIds = new Set(q.antworten.filter(a => a.richtig).map(a => a.id));
  const options = q.antworten.map(a => {
    const selected = state.selected.has(a.id);
    const cls = ['option'];
    if (selected) cls.push('selected');
    if (state.checked && a.richtig) cls.push('correct');
    if (state.checked && selected && !a.richtig) cls.push('wrong');
    return `<div class="${cls.join(' ')}" data-option="${a.id}"><div class="bubble">${a.id}</div><div class="option-text">${escapeHtml(a.text)}</div></div>`;
  }).join('');
  const feedback = state.checked ? `<section class="card">
    <div class="feedback-title"><span class="status-dot ${state.lastCorrect ? 'ok' : 'bad'}"></span><strong>${state.lastCorrect ? 'Richtig.' : 'Nicht ganz.'}</strong></div>
    <p class="kicker">Richtige Lösung: ${[...correctIds].join(', ')}</p>
    <div class="actions">
      <button class="btn primary" id="known">Sicher gewusst</button>
      <button class="btn" id="partial">Unsicher</button>
      <button class="btn ghost" id="again">Nicht gewusst</button>
    </div>
  </section>` : `<button class="btn primary" id="check" ${state.selected.size ? '' : 'disabled'}>Antwort prüfen</button>`;
  layout(`${header(q.typ === 'single' ? 'Single Choice' : 'Multiple Choice')}
    <section class="card">
      <div class="meta"><span class="pill">${escapeHtml(q.gebiet || 'Jura')}</span><span class="pill">${q.typ === 'single' ? 'eine Antwort' : 'mehrere Antworten'}</span></div>
      <p class="question-text" style="margin-top:16px">${escapeHtml(q.frage)}</p>
      <div class="options">${options}</div>
    </section>
    ${feedback}`);
  document.querySelectorAll('[data-option]').forEach(el => el.onclick = () => toggleOption(el.dataset.option));
  const check = document.querySelector('#check');
  if (check) check.onclick = checkAnswer;
  const known = document.querySelector('#known');
  if (known) known.onclick = () => finishMC('good');
  const partial = document.querySelector('#partial');
  if (partial) partial.onclick = () => finishMC('partial');
  const again = document.querySelector('#again');
  if (again) again.onclick = () => finishMC('again');
}
function renderRecall() {
  const q = state.currentRecall;
  layout(`${header('Active Recall')}
    <section class="card">
      <div class="meta"><span class="pill">Freitext</span><span class="pill">Selbstkontrolle</span></div>
      <p class="question-text" style="margin-top:16px">${escapeHtml(q.activeRecall?.frage || 'Gib die richtige Lösung ohne Antwortoptionen wieder.')}</p>
      <textarea id="recallInput" placeholder="Antwort aus dem Gedächtnis formulieren …">${escapeHtml(state.recallText)}</textarea>
      ${state.showModel ? `<div class="answer-box"><strong>Musterantwort</strong><br>${escapeHtml(q.activeRecall?.musterantwort || '')}</div>` : ''}
    </section>
    <section class="actions">
      ${state.showModel ? `
        <button class="btn primary" id="rGood">Gewusst</button>
        <button class="btn" id="rPartial">Teilweise</button>
        <button class="btn ghost" id="rAgain">Nicht gewusst</button>` : `<button class="btn primary" id="showModel">Musterantwort anzeigen</button>`}
    </section>`);
  const input = document.querySelector('#recallInput');
  input.oninput = (e) => { state.recallText = e.target.value; };
  const show = document.querySelector('#showModel');
  if (show) show.onclick = () => { state.showModel = true; renderRecall(); };
  const rGood = document.querySelector('#rGood');
  if (rGood) rGood.onclick = () => finishRecall('good');
  const rPartial = document.querySelector('#rPartial');
  if (rPartial) rPartial.onclick = () => finishRecall('partial');
  const rAgain = document.querySelector('#rAgain');
  if (rAgain) rAgain.onclick = () => finishRecall('again');
}
function renderDone() {
  layout(`${header('Fertig')}
    <section class="card hero">
      <div class="hero-text"><h1>Für heute erledigt.</h1><p>Die nächsten Wiederholungen werden lokal vorgemerkt.</p></div>
      <div class="actions"><button class="btn primary" id="home">Zur Startseite</button><button class="btn" id="again">Weiter mischen</button></div>
    </section>`);
  document.querySelector('#home').onclick = renderHome;
  document.querySelector('#again').onclick = () => { state.queue = shuffle(questions); nextQuestion(); };
}
function escapeHtml(str = '') {
  return String(str).replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
}
function registerServiceWorker() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./service-worker.js').catch(() => {});
}
