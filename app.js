'use strict';

/* ============================================================
   Vos · Spanish reference tuned for Uruguay
   Conjugate (offline) · Word · Translate · Check (Claude API)
   ============================================================ */

const VERSION = '1.0.0';
const MODELS = {
  'claude-haiku-4-5': 'Haiku 4.5 (fast, cheapest)',
  'claude-sonnet-5-5': 'Sonnet 5.5 (sharper, pricier)'
};

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fold = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/* ---------------- storage ---------------- */
const mem = {};
const store = {
  get(k, d) {
    try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); }
    catch { return k in mem ? mem[k] : d; }
  },
  set(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); }
    catch { mem[k] = v; }
  }
};

const DEFAULTS = {
  key: '', model: 'claude-haiku-4-5',
  vosotros: false, se: false,
  trReg: 'casual', checkReg: 'formal', checkMode: 'push',
  view: 'conj'
};
const S = Object.assign({}, DEFAULTS, store.get('vos.settings', {}));
const saveSettings = () => store.set('vos.settings', S);

/* ---------------- toast ---------------- */
let toastT;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastT);
  toastT = setTimeout(() => (t.hidden = true), 2200);
}

/* ---------------- speech ---------------- */
let esVoice = null;
function pickVoice() {
  if (!('speechSynthesis' in window)) return;
  const vs = speechSynthesis.getVoices();
  const pref = ['es-UY', 'es-AR', 'es-419', 'es-US', 'es-MX', 'es-ES'];
  for (const p of pref) {
    const v = vs.find(v => v.lang.replace('_', '-').toLowerCase() === p.toLowerCase());
    if (v) { esVoice = v; return; }
  }
  esVoice = vs.find(v => v.lang.toLowerCase().startsWith('es')) || null;
}
if ('speechSynthesis' in window) {
  pickVoice();
  speechSynthesis.onvoiceschanged = pickVoice;
}
function say(text) {
  if (!('speechSynthesis' in window)) return toast('Speech is not available on this device.');
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(String(text).replace(/^no\s+/, 'no '));
  u.lang = esVoice ? esVoice.lang : 'es-UY';
  if (esVoice) u.voice = esVoice;
  u.rate = 0.95;
  speechSynthesis.speak(u);
}
document.addEventListener('click', e => {
  const el = e.target.closest('[data-say]');
  if (el) say(el.dataset.say);
});

/* ---------------- saved + history ---------------- */
let SAVED = store.get('vos.saved', []);
let HIST = store.get('vos.history', []);
const HIST_MAX = 80;

function isSaved(id) { return SAVED.some(s => s.id === id); }
function toggleSave(item) {
  if (isSaved(item.id)) {
    SAVED = SAVED.filter(s => s.id !== item.id);
    toast('Removed from saved');
  } else {
    SAVED.unshift(Object.assign({ ts: Date.now() }, item));
    toast('Saved');
  }
  store.set('vos.saved', SAVED);
  return isSaved(item.id);
}
function addHistory(item) {
  HIST = HIST.filter(h => h.id !== item.id);
  HIST.unshift(Object.assign({ ts: Date.now() }, item));
  if (HIST.length > HIST_MAX) HIST.length = HIST_MAX;
  store.set('vos.history', HIST);
}
const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/></svg>';
const SPEAKER = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9zM16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>';
const COPY = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>';

function starBtn(item) {
  const on = isSaved(item.id);
  const b = document.createElement('button');
  b.className = 'icon' + (on ? ' on' : '');
  b.setAttribute('aria-label', on ? 'Remove from saved' : 'Save');
  b.innerHTML = STAR;
  b.onclick = () => {
    const now = toggleSave(item);
    b.classList.toggle('on', now);
    b.setAttribute('aria-label', now ? 'Remove from saved' : 'Save');
  };
  return b;
}
function sayBtn(text) {
  return `<button class="icon" data-say="${esc(text)}" aria-label="Listen">${SPEAKER}</button>`;
}

/* ---------------- navigation ---------------- */
const VIEWS = ['conj', 'word', 'tr', 'check'];
function go(view, { focus = true } = {}) {
  if (!VIEWS.includes(view)) view = 'conj';
  for (const v of VIEWS) $(`[data-view="${v}"]`).hidden = v !== view;
  $$('.tabs button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.go === view)));
  S.view = view; saveSettings();
  if (location.hash !== '#' + view) history.replaceState(history.state, '', '#' + view);
  window.scrollTo(0, 0);
  if (focus) {
    const f = { conj: '#conj-q', word: '#word-q', tr: '#tr-q', check: '#check-q' }[view];
    setTimeout(() => $(f).focus({ preventScroll: true }), 30);
  }
}
$$('[data-go]').forEach(b => b.addEventListener('click', () => go(b.dataset.go)));

/* ---------------- segmented controls ---------------- */
function seg(el, value, onChange) {
  const paint = v => $$('button', el).forEach(b => {
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(b.dataset.v === v));
  });
  paint(value);
  $$('button', el).forEach(b => b.onclick = () => { paint(b.dataset.v); onChange(b.dataset.v); });
}

/* ============================================================
   CLAUDE API
   ============================================================ */
const UY = `Target variety: Uruguayan Spanish as used in Montevideo today. Not porteño, not generic Latin American, never Spain.
- Informal register uses voseo (vos tenés, vení, fijate). Formal register uses usted. Never use vosotros.
- Prefer Uruguayan vocabulary where it differs: ómnibus (bus), championes (sneakers), campera (jacket), gurí/gurisa (kid), liceo (secondary school), frutilla, boniato, morrón, remera, celular, auto, almacén, "ta" (ok).
- In casual text, Uruguayans often mix tú with voseo verbs ("tú sabés"). That is real usage here; do not treat it as an error in casual register.`;

async function ask({ system, content, maxTokens = 1200 }) {
  if (!S.key) throw new Error('Add your Anthropic API key in Settings first (gear icon, top right).');
  if (!navigator.onLine) throw new Error("You're offline. Conjugate still works; this needs a connection.");
  let r;
  try {
    r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': S.key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: S.model, max_tokens: maxTokens, system,
        messages: [{ role: 'user', content }]
      })
    });
  } catch {
    throw new Error("Couldn't reach the API. Check your connection and try again.");
  }
  if (!r.ok) {
    let detail = '';
    try { detail = (await r.json()).error?.message || ''; } catch {}
    if (r.status === 401) throw new Error('The API key was rejected. Check it in Settings.');
    if (r.status === 429) throw new Error('Rate limited. Wait a few seconds and try again.');
    if (r.status === 529 || r.status === 503) throw new Error('The API is overloaded right now. Try again in a moment.');
    if (r.status === 400 && /credit/i.test(detail)) throw new Error('Your Anthropic account is out of credit. Top up in the Console.');
    throw new Error(`API error ${r.status}${detail ? ': ' + detail : ''}`);
  }
  const d = await r.json();
  const text = (d.content || []).filter(c => c.type === 'text').map(c => c.text).join('');
  return parseJSON(text);
}
function parseJSON(text) {
  const a = text.indexOf('{'), b = text.lastIndexOf('}');
  if (a < 0 || b < a) throw new Error('Got an unexpected reply. Try again.');
  try { return JSON.parse(text.slice(a, b + 1)); }
  catch { throw new Error('Got an unreadable reply. Try again.'); }
}
function loading(el, msg) { el.innerHTML = `<p class="msg"><span class="spinner"></span>${esc(msg)}</p>`; }
function failed(el, e) { el.innerHTML = `<p class="msg err">${esc(e.message || e)}</p>`; }

/* ============================================================
   CONJUGATE
   ============================================================ */
let DATA = null, REV = null;
let AIVERBS = store.get('vos.aiverbs', {});

const PERSONS = ['yo', 'tú', 'él / ella / usted', 'nosotros', 'vosotros', 'ellos / ustedes'];
const IND = ['ind_pres', 'ind_pret', 'ind_imp', 'ind_fut', 'ind_cond', 'ind_pp', 'ind_plus', 'ind_futp', 'ind_condp', 'ind_ant'];
const SUB = ['sub_pres', 'sub_imp', 'sub_imp_se', 'sub_pp', 'sub_plus', 'sub_fut', 'sub_futp'];
const IMP = ['imp_aff', 'imp_neg'];
const COMPOUND = { ind_pp: 'ind_pres', ind_plus: 'ind_imp', ind_futp: 'ind_fut', ind_condp: 'ind_cond', ind_ant: 'ind_pret', sub_pp: 'sub_pres', sub_plus: 'sub_imp', sub_futp: 'sub_fut' };

async function loadVerbs() {
  try {
    const r = await fetch('data/verbs.json');
    DATA = await r.json();
    buildRev();
    runConj();
  } catch {
    $('#conj-out').innerHTML = `<p class="msg err">Couldn't load the verb data. Reload the app once while online.</p>`;
  }
}

function buildRev() {
  REV = new Map();
  const add = (form, inf, tense, i) => {
    if (!form) return;
    const k = fold(form.replace(/^no\s+/, ''));
    if (!k) return;
    let b = REV.get(k);
    if (!b) REV.set(k, b = []);
    if (!b.some(x => x.inf === inf)) b.push({ inf, tense, i });
  };
  for (const [inf, v] of Object.entries(DATA.verbs)) {
    for (const [tense, forms] of Object.entries(v.t)) {
      if (COMPOUND[tense]) continue;
      forms.forEach((f, i) => add(f, inf, tense, i));
    }
    for (const [tense, f] of Object.entries(v.vos)) add(f, inf, tense, 'vos');
    add(v.ger, inf, 'ger', -1);
    add(v.pp, inf, 'pp', -1);
  }
}

function tenseName(t) {
  if (t === 'ger') return ['Gerundio', 'Gerund'];
  if (t === 'pp') return ['Participio', 'Past participle'];
  return (DATA && DATA.tenses[t]) || [t, ''];
}
function moodOf(t) {
  if (t.startsWith('ind')) return 'indicative';
  if (t.startsWith('sub')) return 'subjunctive';
  if (t.startsWith('imp')) return 'imperative';
  return '';
}
function describeHit(h) {
  const [es, en] = tenseName(h.tense);
  const m = moodOf(h.tense);
  const WHO = ['yo', 'tú', 'él/usted', 'nosotros', 'vosotros', 'ellos/ustedes'];
  const who = h.i === 'vos' ? 'vos' : (h.i >= 0 ? WHO[h.i] : '');
  return `${en.toLowerCase()}${m ? ' ' + m : ''}${who ? ', ' + who : ''} of ${h.inf}`;
}

function vosFormFor(v, tense) {
  if (tense === 'ind_pres' || tense === 'imp_aff' || tense === 'sub_pres') return v.vos[tense] || null;
  if (tense === 'imp_neg') return v.vos.sub_pres ? 'no ' + v.vos.sub_pres : null;
  return null;
}

function fillCompounds(v) {
  const haber = DATA && DATA.verbs.haber;
  if (!haber || !v.pp) return;
  for (const [comp, base] of Object.entries(COMPOUND)) {
    if (v.t[comp] || !haber.t[base]) continue;
    const refl = v.t.ind_pres && /^me\s/.test(v.t.ind_pres[0] || '');
    const pron = ['me ', 'te ', 'se ', 'nos ', 'os ', 'se '];
    v.t[comp] = haber.t[base].map((h, i) => (refl ? pron[i] : '') + h + ' ' + v.pp);
  }
  if (v.t.sub_imp && !v.t.sub_imp_se) {
    v.t.sub_imp_se = v.t.sub_imp.map(f => f && f
      .replace(/ramos$/, 'semos').replace(/rais$/, 'seis').replace(/ras$/, 'ses')
      .replace(/ran$/, 'sen').replace(/ra$/, 'se'));
  }
}

function tenseTable(v, tense) {
  const forms = v.t[tense];
  if (!forms || !forms.some(Boolean)) return '';
  const [es, en] = tenseName(tense);
  const vos = vosFormFor(v, tense);
  const rows = [];
  if (forms[0]) rows.push(['yo', forms[0], '']);
  if (vos && vos !== forms[1]) {
    rows.push(['vos', vos, 'vos']);
    if (forms[1]) rows.push(['tú', forms[1], '']);
  } else if (forms[1]) {
    rows.push(['vos / tú', forms[1], 'vos']);
  }
  if (forms[2]) rows.push([PERSONS[2], forms[2], '']);
  if (forms[3]) rows.push([PERSONS[3], forms[3], '']);
  if (S.vosotros && forms[4]) rows.push([PERSONS[4], forms[4], '']);
  if (forms[5]) rows.push([PERSONS[5], forms[5], '']);
  return `<div class="tense"><h3>${esc(es)} <span>${esc(en)}</span></h3>` +
    rows.map(([p, f, c]) => `<div class="frow ${c}" data-say="${esc(f)}"><span class="p">${esc(p)}</span><span class="f">${esc(f)}</span></div>`).join('') +
    `</div>`;
}

function renderVerb(inf, { note = '', ai = false } = {}) {
  const v = ai ? AIVERBS[inf] : DATA.verbs[inf];
  if (!v) return;
  fillCompounds(v);
  const out = $('#conj-out');
  const vp = v.vos || {};
  const tuSub = v.t.sub_pres && v.t.sub_pres[1];
  const tuNeg = v.t.imp_neg && v.t.imp_neg[1];
  const vosNeg = vp.sub_pres ? 'no ' + vp.sub_pres : null;
  const cell = (label, f, alt) => f
    ? `<span class="k">${label}</span><span class="v speakable" data-say="${esc(f)}">${esc(f)}${alt && alt !== f ? `<span class="alt">or ${esc(alt)}</span>` : ''}</span>`
    : '';

  out.innerHTML = `
    ${note ? `<p class="found">${esc(note)}</p>` : ''}
    ${ai ? `<div class="aiwarn">Not in the verb database, so these tables are AI-generated. Double-check anything that matters.</div>` : ''}
    <div class="lemma-head">
      <div style="flex:1"><div class="lemma">${esc(inf)}</div><div class="gloss">${esc(v.en || '')}</div></div>
      ${sayBtn(inf)}<span id="conj-star"></span>
    </div>
    ${v.ger || v.pp ? `<p class="parts">gerundio <b class="speakable" data-say="${esc(v.ger)}">${esc(v.ger)}</b> &nbsp; participio <b class="speakable" data-say="${esc(v.pp)}">${esc(v.pp)}</b></p>` : ''}
    <div class="vosbox">
      ${cell('present', vp.ind_pres)}
      ${cell('command', vp.imp_aff)}
      ${cell("don't", vosNeg, tuNeg)}
      ${cell('subjunctive', vp.sub_pres, tuSub)}
    </div>
    ${vp.sub_pres && tuSub && vp.sub_pres !== tuSub ? `<p class="vosnote">The tú subjunctive (${esc(tuSub)}) is the safer choice in writing; the vos form is common in speech.</p>` : ''}
    <div class="mood">Indicativo</div>${IND.map(t => tenseTable(v, t)).join('')}
    <div class="mood">Subjuntivo</div>${SUB.filter(t => t !== 'sub_imp_se' || S.se).map(t => tenseTable(v, t)).join('')}
    <div class="mood">Imperativo</div>${IMP.map(t => tenseTable(v, t)).join('')}
  `;
  $('#conj-star').replaceWith(starBtn({ id: 'verb:' + inf, type: 'verb', key: inf, label: inf, sub: v.en || '', ai }));
  addHistory({ id: 'conj:' + inf, type: 'conj', key: inf, label: inf, sub: v.en || '', ai });
}

function looksLikeVerb(q) { return /^[a-záéíóúüñ\s]+$/i.test(q) && q.length > 1; }

function runConj() {
  const raw = $('#conj-q').value.trim();
  const out = $('#conj-out');
  if (!DATA) { loading(out, 'Loading verbs…'); return; }
  if (!raw) {
    out.innerHTML = `<div class="empty">Type an infinitive for the full table, or paste any form you ran into, like <b>dijeran</b>, <b>sos</b> or <b>andate</b>, to find out what it is. Tap any form to hear it.</div>`;
    return;
  }
  const q = fold(raw);
  const direct = Object.keys(DATA.verbs).find(k => fold(k) === q);
  if (direct) return renderVerb(direct);
  const aiDirect = Object.keys(AIVERBS).find(k => fold(k) === q);
  if (aiDirect) return renderVerb(aiDirect, { ai: true });

  const hits = REV.get(q) || [];
  if (hits.length === 1) return renderVerb(hits[0].inf, { note: `${raw} is the ${describeHit(hits[0])}` });
  if (hits.length > 1) {
    out.innerHTML = `<p class="found">${esc(raw)} could be from more than one verb:</p>` +
      hits.map(h => `<button class="pick" data-inf="${esc(h.inf)}" data-note="${esc(raw + ' is the ' + describeHit(h))}"><b>${esc(h.inf)}</b><span>${esc(describeHit(h))} · ${esc(DATA.verbs[h.inf].en)}</span></button>`).join('');
    $$('.pick', out).forEach(b => b.onclick = () => renderVerb(b.dataset.inf, { note: b.dataset.note }));
    return;
  }
  out.innerHTML = `<div class="empty">“${esc(raw)}” isn't one of the 638 verbs in the database.
    ${looksLikeVerb(raw) ? `<div class="row"><button class="ghost" id="ai-conj">Ask AI to conjugate it</button></div>` : ''}</div>`;
  const b = $('#ai-conj');
  if (b) b.onclick = () => aiConjugate(raw);
}

const CONJ_SYS = `You conjugate Spanish verbs for a learner in Uruguay.
${UY}
Reply with JSON only, no prose, no code fences.
If the input is a conjugated form, conjugate its infinitive. If it is not a Spanish verb, reply {"error":"not a verb"}.
Schema:
{"infinitive":str,"en":str (short English gloss, "to ..."),"ger":str,"pp":str,
 "t":{"ind_pres":[6],"ind_pret":[6],"ind_imp":[6],"ind_fut":[6],"ind_cond":[6],"sub_pres":[6],"sub_imp":[6],"sub_fut":[6],"imp_aff":[6],"imp_neg":[6]},
 "vos":{"ind_pres":str,"imp_aff":str,"sub_pres":str}}
Each [6] array is [yo, tú, él/usted, nosotros, vosotros, ellos/ustedes]. Imperative arrays use "" for yo; imp_neg entries start with "no ". Reflexive verbs include the pronoun ("me lavo", "lavate").
vos.sub_pres uses the Rioplatense stress (podás, not puedás).`;

async function aiConjugate(word) {
  const out = $('#conj-out');
  loading(out, `Conjugating ${word}…`);
  try {
    const d = await ask({ system: CONJ_SYS, content: word, maxTokens: 2000 });
    if (d.error || !d.infinitive || !d.t) throw new Error(`“${word}” doesn't look like a Spanish verb.`);
    AIVERBS[d.infinitive] = { en: d.en, ger: d.ger, pp: d.pp, t: d.t, vos: d.vos || {}, g: {} };
    store.set('vos.aiverbs', AIVERBS);
    renderVerb(d.infinitive, { ai: true });
  } catch (e) { failed(out, e); }
}

let conjT;
$('#conj-q').addEventListener('input', () => { clearTimeout(conjT); conjT = setTimeout(runConj, 150); });
$('#opt-vosotros').checked = S.vosotros;
$('#opt-se').checked = S.se;
$('#opt-vosotros').onchange = e => { S.vosotros = e.target.checked; saveSettings(); runConj(); };
$('#opt-se').onchange = e => { S.se = e.target.checked; saveSettings(); runConj(); };

function openVerb(inf) {
  go('conj', { focus: false });
  $('#conj-q').value = inf;
  runConj();
}

/* ============================================================
   WORD
   ============================================================ */
const WORD_SYS = `You are a Spanish lexicographer writing for an English speaker who lives in Uruguay, level B2 working toward C1.
${UY}
The input is a single word or short expression, in Spanish or English.
- Spanish input: explain that word. Give 2 entries only if it is a homograph with unrelated meanings (el/la capital, el/la cura).
- English input: give the 1 to 3 Spanish words a Uruguayan would actually use for it, most natural first, one entry each.
Reply with JSON only, no prose, no code fences:
{"query_lang":"es"|"en","entries":[{
  "word":str,
  "gender":"el"|"la"|"el/la"|null,
  "pos":str (e.g. "noun", "verb", "adjective", "adverb", "expression"),
  "verb_infinitive":str|null (the infinitive if this entry is a verb),
  "senses":[{"def":str (English, short),"example":str (natural Uruguayan Spanish sentence),"example_en":str}],
  "synonyms":[str],
  "antonyms":[str],
  "uruguay":str|null,
  "careful":str|null
}]}
senses: 1 to 4, most common first.
gender: for nouns only; "el/la" when the same form is used for both (el/la periodista). For adjectives put the feminine in the word field like "cansado, cansada".
synonyms/antonyms: up to 6 each, words actually used in Uruguay. Empty arrays if none fit.
uruguay: one sentence only if usage in Uruguay differs from general Spanish (different word preferred, different meaning, regional connotation). Otherwise null.
careful: one sentence only for a real false friend, vulgar/sexual double meaning in the Río de la Plata, or register trap. Otherwise null.`;

async function runWord(q, cached) {
  const out = $('#word-out');
  if (!q) return;
  $('#word-q').value = q;
  if (cached) return renderWord(q, cached);
  loading(out, `Looking up ${q}…`);
  $('#word-form button').disabled = true;
  try {
    const d = await ask({ system: WORD_SYS, content: q, maxTokens: 1400 });
    renderWord(q, d);
    addHistory({ id: 'word:' + fold(q), type: 'word', key: q, label: q, sub: summarizeWord(d), data: d });
  } catch (e) { failed(out, e); }
  $('#word-form button').disabled = false;
}
function summarizeWord(d) {
  const e = (d.entries || [])[0];
  if (!e) return '';
  if (d.query_lang === 'en') return d.entries.map(x => x.word).join(', ');
  return (e.senses && e.senses[0] && e.senses[0].def) || '';
}
function renderWord(q, d) {
  const out = $('#word-out');
  const entries = d.entries || [];
  if (!entries.length) { out.innerHTML = `<p class="msg">Nothing came back for “${esc(q)}”.</p>`; return; }
  out.innerHTML = (d.query_lang === 'en' ? `<p class="found">In Uruguay you'd say:</p>` : '') +
    entries.map((e, i) => {
      const head = (e.gender && e.gender !== 'el/la' ? e.gender + ' ' : '') + e.word;
      const verb = e.verb_infinitive && (DATA?.verbs[e.verb_infinitive] || AIVERBS[e.verb_infinitive]) ? e.verb_infinitive : (e.verb_infinitive || null);
      return `<div class="card">
        <div class="head"><h3>${esc(head)}</h3>${sayBtn(e.word)}<span data-star="${i}"></span></div>
        <div class="pos">${esc(e.pos || '')}${e.gender === 'el/la' ? ' · el/la' : ''}</div>
        <ol>${(e.senses || []).map(s => `<li>${esc(s.def)}${s.example ? `<span class="ex speakable" data-say="${esc(s.example)}">${esc(s.example)}</span>` : ''}${s.example_en ? `<span class="ex" style="font-family:var(--sans);font-size:13px">${esc(s.example_en)}</span>` : ''}</li>`).join('')}</ol>
        ${e.synonyms && e.synonyms.length ? `<p class="syn">Synonyms: ${e.synonyms.map(w => `<b>${esc(w)}</b>`).join(', ')}</p>` : ''}
        ${e.antonyms && e.antonyms.length ? `<p class="syn">Opposites: ${e.antonyms.map(w => `<b>${esc(w)}</b>`).join(', ')}</p>` : ''}
        ${e.uruguay ? `<div class="flag"><span class="tag">acá</span><span>${esc(e.uruguay)}</span></div>` : ''}
        ${e.careful ? `<div class="flag"><span class="tag warn">ojo</span><span>${esc(e.careful)}</span></div>` : ''}
        ${verb ? `<div class="row"><button class="ghost" data-conj="${esc(verb)}">Conjugate ${esc(verb)}</button></div>` : ''}
      </div>`;
    }).join('');
  entries.forEach((e, i) => {
    const slot = $(`[data-star="${i}"]`, out);
    slot.replaceWith(starBtn({ id: 'word:' + fold(e.word), type: 'word', key: e.word, label: e.word, sub: e.senses?.[0]?.def || '', data: { query_lang: 'es', entries: [e] } }));
  });
  $$('[data-conj]', out).forEach(b => b.onclick = () => openVerb(b.dataset.conj));
}
$('#word-form').addEventListener('submit', e => {
  e.preventDefault();
  const q = $('#word-q').value.trim();
  if (q) { $('#word-q').blur(); runWord(q); }
});

/* ============================================================
   TRANSLATE
   ============================================================ */
let trDir = 'auto';          // 'auto' | 'es-en' | 'en-es'
let trLast = null;           // last detected source lang
const LANG = { es: 'Spanish', en: 'English' };

function paintDir() {
  if (trDir === 'auto') {
    $('#tr-from').textContent = trLast ? `Auto (${LANG[trLast]})` : 'Auto';
    $('#tr-to').textContent = trLast ? LANG[trLast === 'es' ? 'en' : 'es'] : 'the other one';
  } else {
    const [a, b] = trDir.split('-');
    $('#tr-from').textContent = LANG[a];
    $('#tr-to').textContent = LANG[b];
  }
}
$('#tr-swap').onclick = () => {
  if (trDir === 'auto') trDir = trLast === 'es' ? 'en-es' : 'es-en';
  else if (trDir === 'es-en') trDir = 'en-es';
  else trDir = 'auto';
  paintDir();
  toast(trDir === 'auto' ? 'Auto-detect' : `${$('#tr-from').textContent} → ${$('#tr-to').textContent}`);
};
seg($('#tr-reg'), S.trReg, v => { S.trReg = v; saveSettings(); });

function trSystem() {
  const dir = trDir === 'auto'
    ? `Detect whether the source is Spanish or English. If it is ambiguous (a word valid in both, very short, or mixed), treat it as Spanish and translate into English.`
    : trDir === 'es-en' ? `The source is Spanish. Translate it into English.` : `The source is English. Translate it into Spanish.`;
  const reg = S.trReg === 'formal'
    ? `Register for Spanish output: formal (usted, polished written Uruguayan Spanish, suitable for an email to a lawyer or a bank).`
    : `Register for Spanish output: casual (voseo, how a Montevideo local would text a friend or talk to a neighbour).`;
  return `You are a translator between English and Uruguayan Spanish for an English speaker who lives in Montevideo.
${UY}
${dir}
${reg}
When translating into English, give natural American English and explain Uruguayan slang or idioms in the note rather than translating them word for word.
Reply with JSON only, no prose, no code fences:
{"source_lang":"es"|"en","source_text":str,"translation":str,"alternatives":[{"text":str,"note":str}],"note":str|null}
source_text: the exact source (for a photo, the text you read in it, keeping line breaks).
alternatives: 0 to 2, only when there is a genuinely different natural option (more formal, more casual, a regional alternative). note says when to use it, under 15 words.
note: one sentence on anything a learner should know (idiom, slang, false friend, ambiguity), or null.
If a photo has no readable text, reply {"error":"no text"}.`;
}

async function runTranslate({ text, image }) {
  const out = $('#tr-out');
  const go = $('#tr-go');
  loading(out, image ? 'Reading the photo…' : 'Translating…');
  go.disabled = true;
  try {
    const content = image
      ? [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image } },
         { type: 'text', text: 'Read the text in this photo and translate it.' }]
      : text;
    const d = await ask({ system: trSystem(), content, maxTokens: 2000 });
    if (d.error) throw new Error(image ? "Couldn't find readable text in that photo." : d.error);
    trLast = d.source_lang === 'en' ? 'en' : 'es';
    paintDir();
    renderTranslation(d, image);
    addHistory({ id: 'tr:' + fold(d.source_text || text || '').slice(0, 80) + ':' + Date.now(), type: 'tr', key: d.source_text, label: (d.source_text || '').slice(0, 80), sub: (d.translation || '').slice(0, 80), data: d });
  } catch (e) { failed(out, e); }
  go.disabled = false;
}
function renderTranslation(d, image) {
  const out = $('#tr-out');
  const toEs = d.source_lang === 'en';
  const spanish = toEs ? d.translation : d.source_text;
  out.innerHTML = `<div class="card">
    ${image ? `<img class="thumb" src="data:image/jpeg;base64,${image}" alt="Your photo">` : ''}
    ${image || d.source_text ? `<p class="tr-src">${esc(d.source_text || '')}</p>` : ''}
    <div class="head"><p class="tr-main" style="flex:1">${esc(d.translation)}</p>
      <button class="icon" id="tr-copy" aria-label="Copy">${COPY}</button>
      ${sayBtn(spanish)}<span id="tr-star"></span></div>
    ${(d.alternatives || []).map(a => `<div class="alt-item"><div class="t ${toEs ? 'speakable' : ''}" ${toEs ? `data-say="${esc(a.text)}"` : ''}>${esc(a.text)}</div><div class="n">${esc(a.note || '')}</div></div>`).join('')}
    ${d.note ? `<div class="flag"><span class="tag">nota</span><span>${esc(d.note)}</span></div>` : ''}
  </div>`;
  $('#tr-copy').onclick = async () => {
    try { await navigator.clipboard.writeText(d.translation); toast('Copied'); }
    catch { toast("Couldn't copy"); }
  };
  $('#tr-star').replaceWith(starBtn({
    id: 'tr:' + fold(d.source_text || '').slice(0, 120), type: 'tr',
    key: d.source_text, label: toEs ? d.translation : d.source_text, sub: toEs ? d.source_text : d.translation,
    data: Object.assign({}, d)
  }));
}
$('#tr-go').onclick = () => {
  const t = $('#tr-q').value.trim();
  if (t) { $('#tr-q').blur(); runTranslate({ text: t }); }
};
$('#tr-q').addEventListener('keydown', e => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) $('#tr-go').click();
});
$('#tr-cam').addEventListener('change', async e => {
  const f = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!f) return;
  try {
    const b64 = await shrinkImage(f, 1568, 0.85);
    runTranslate({ image: b64 });
  } catch { failed($('#tr-out'), new Error("Couldn't open that image.")); }
});
function shrinkImage(file, maxSide, quality) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const s = Math.min(1, maxSide / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', quality).split(',')[1]);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(); };
    img.src = url;
  });
}

/* ============================================================
   CHECK
   ============================================================ */
seg($('#check-reg'), S.checkReg, v => { S.checkReg = v; saveSettings(); });
seg($('#check-mode'), S.checkMode, v => { S.checkMode = v; saveSettings(); });

function checkSystem() {
  const reg = S.checkReg === 'formal'
    ? `Register: formal written Uruguayan Spanish (usted, no slang, the standard a professional would use in an email to a lawyer, a bank or a prospective employer). In this register, flag tú+voseo mixing and casual slang.`
    : `Register: casual Uruguayan Spanish (voseo, the way a Montevideo local writes a WhatsApp message). Don't formalise it; keep contractions of speech and local slang that is correct.`;
  const mode = S.checkMode === 'push'
    ? `Strictness: push toward C1. Fix every error, and ALSO fix things that are grammatical but sound non-native, stiff, or like a translation from English (calques, wrong collocations, unnatural word order, weak verb choice). Mark those as kind "style".`
    : `Strictness: errors only. Fix grammar, spelling, accents, agreement, wrong prepositions, wrong mood/tense, and words that are actually wrong. Leave correct-but-plain phrasing alone.`;
  return `You correct Spanish written by an English speaker who lives in Uruguay (B2, working toward C1).
${UY}
${reg}
${mode}
Keep their meaning and voice. Don't rewrite whole sentences when a small fix works.
Reply with JSON only, no prose, no code fences:
{"corrected":str,"changes":[{"from":str,"to":str,"why":str,"kind":"error"|"style"}],"pattern":str|null}
corrected: the full text with every fix applied, same line breaks.
changes: one per fix, in order of appearance. from/to are the short spans that changed (a few words). why is the rule in plain English, under 15 words.
pattern: one sentence naming the single most useful thing to work on, based on these mistakes; null if the text was clean.
If nothing needs fixing, return the text unchanged and an empty changes array.`;
}

async function runCheck(text, cached) {
  const out = $('#check-out');
  if (cached) return renderCheck(text, cached);
  loading(out, 'Checking…');
  $('#check-go').disabled = true;
  try {
    const d = await ask({ system: checkSystem(), content: text, maxTokens: 2500 });
    renderCheck(text, d);
    addHistory({ id: 'check:' + Date.now(), type: 'check', key: text, label: text.slice(0, 80), sub: d.changes?.length ? `${d.changes.length} fix${d.changes.length > 1 ? 'es' : ''}` : 'No fixes', data: d });
  } catch (e) { failed(out, e); }
  $('#check-go').disabled = false;
}
function renderCheck(text, d) {
  const out = $('#check-out');
  const changes = d.changes || [];
  const clean = !changes.length;
  out.innerHTML = `<div class="card">
    ${clean ? `<p class="found" style="margin:0 0 10px">Nothing to fix.</p>` : ''}
    <div class="diff">${diffHTML(text, d.corrected || text)}</div>
    <div class="row" style="margin:0 0 4px">
      <button class="ghost" id="ck-copy">Copy corrected</button>
      ${sayBtn(d.corrected || text).replace('class="icon"', 'class="icon" style="margin-left:auto"')}
    </div>
    ${changes.map(c => `<div class="fix ${c.kind === 'style' ? 'style' : ''}">
      <div class="ft"><del>${esc(c.from)}</del><ins>${esc(c.to)}</ins></div>
      <div class="why">${c.kind === 'style' ? '<span class="tag sol" style="margin-right:6px">sounds native</span>' : ''}${esc(c.why)}</div>
    </div>`).join('')}
    ${d.pattern ? `<div class="flag"><span class="tag">work on</span><span>${esc(d.pattern)}</span></div>` : ''}
  </div>`;
  $('#ck-copy').onclick = async () => {
    try { await navigator.clipboard.writeText(d.corrected || text); toast('Copied'); }
    catch { toast("Couldn't copy"); }
  };
}
$('#check-go').onclick = () => {
  const t = $('#check-q').value.trim();
  if (t) { $('#check-q').blur(); runCheck(t); }
};

/* word-level diff (LCS) */
function tokens(s) { return s.match(/\s+|[\p{L}\p{N}]+|[^\s\p{L}\p{N}]/gu) || []; }
function diffHTML(a, b) {
  const A = tokens(a), B = tokens(b);
  const n = A.length, m = B.length;
  if (n * m > 400000) return `<ins>${esc(b)}</ins>`;
  const L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const ops = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) { ops.push(['=', A[i]]); i++; j++; }
    else if (L[i + 1][j] >= L[i][j + 1]) { ops.push(['-', A[i]]); i++; }
    else { ops.push(['+', B[j]]); j++; }
  }
  while (i < n) ops.push(['-', A[i++]]);
  while (j < m) ops.push(['+', B[j++]]);
  // merge runs, and absorb lone whitespace between two changes
  let html = '', del = '', ins = '';
  const flush = () => {
    if (del.trim()) html += `<del>${esc(del)}</del>`;
    if (ins.trim()) html += `<ins>${esc(ins)}</ins>`;
    if (!del.trim() && !ins.trim()) html += esc(ins || del);
    del = ins = '';
  };
  for (let k = 0; k < ops.length; k++) {
    const [op, t] = ops[k];
    if (op === '=') {
      const bridge = /^\s+$/.test(t) && (del || ins) && ops[k + 1] && ops[k + 1][0] !== '=';
      if (bridge) { del += t; ins += t; continue; }
      flush(); html += esc(t);
    } else if (op === '-') del += t;
    else ins += t;
  }
  flush();
  return html;
}

/* ============================================================
   SHEETS: saved · history · settings
   ============================================================ */
function openSheet(kind) {
  $('#sheet-title').textContent = { saved: 'Saved', history: 'History', settings: 'Settings' }[kind];
  renderSheet(kind);
  $('#scrim').hidden = false; $('#sheet').hidden = false;
  if (!history.state || !history.state.sheet) history.pushState({ sheet: kind }, '', location.hash);
  document.body.style.overflow = 'hidden';
}
function closeSheet(fromPop) {
  if ($('#sheet').hidden) return;
  $('#scrim').hidden = true; $('#sheet').hidden = true;
  document.body.style.overflow = '';
  if (!fromPop && history.state && history.state.sheet) history.back();
}
window.addEventListener('popstate', () => closeSheet(true));
$('#scrim').onclick = () => closeSheet();
$('#sheet-close').onclick = () => closeSheet();
$$('[data-sheet]').forEach(b => b.onclick = () => openSheet(b.dataset.sheet));

const KIND = { conj: 'verb', verb: 'verb', word: 'word', tr: 'translation', check: 'check' };

function reopen(item) {
  closeSheet();
  if (item.type === 'conj' || item.type === 'verb') {
    if (item.ai && !AIVERBS[item.key]) return toast('That AI verb is no longer cached.');
    return openVerb(item.key);
  }
  if (item.type === 'word') { go('word', { focus: false }); return runWord(item.key, item.data); }
  if (item.type === 'tr') {
    go('tr', { focus: false });
    $('#tr-q').value = item.data?.source_text || item.key || '';
    return renderTranslation(item.data);
  }
  if (item.type === 'check') {
    go('check', { focus: false });
    $('#check-q').value = item.key;
    return runCheck(item.key, item.data);
  }
}

function listHTML(items, empty, removable) {
  if (!items.length) return `<p class="empty">${empty}</p>`;
  return items.map((it, i) => `<div class="list-item">
    <span class="kind">${KIND[it.type] || it.type}</span>
    <button class="main" data-i="${i}"><span class="t">${esc(it.label)}</span><span class="s">${esc(it.sub || '')}</span></button>
    ${removable ? `<button class="icon small" data-rm="${i}" aria-label="Remove"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>` : ''}
  </div>`).join('');
}

function renderSheet(kind) {
  const body = $('#sheet-body');
  if (kind === 'saved') {
    body.innerHTML = listHTML(SAVED, 'Nothing saved yet. Tap the star on a verb, word or translation to keep it here.', true) +
      (SAVED.length ? `<div class="settings-row"><button class="ghost" id="export">Copy list as text</button></div>` : '');
    $$('[data-i]', body).forEach(b => b.onclick = () => reopen(SAVED[+b.dataset.i]));
    $$('[data-rm]', body).forEach(b => b.onclick = () => {
      SAVED.splice(+b.dataset.rm, 1); store.set('vos.saved', SAVED); renderSheet('saved');
    });
    const ex = $('#export', body);
    if (ex) ex.onclick = async () => {
      const txt = SAVED.map(s => `${s.label}${s.sub ? ' — ' + s.sub : ''}`).join('\n');
      try { await navigator.clipboard.writeText(txt); toast('Copied'); } catch { toast("Couldn't copy"); }
    };
  }
  if (kind === 'history') {
    body.innerHTML = listHTML(HIST, 'No history yet.', false) +
      (HIST.length ? `<div class="settings-row"><button class="ghost" id="clear-h">Clear history</button></div>` : '');
    $$('[data-i]', body).forEach(b => b.onclick = () => reopen(HIST[+b.dataset.i]));
    const c = $('#clear-h', body);
    if (c) c.onclick = () => { HIST = []; store.set('vos.history', HIST); renderSheet('history'); };
  }
  if (kind === 'settings') {
    const masked = S.key ? S.key.slice(0, 10) + '…' + S.key.slice(-4) : '';
    body.innerHTML = `
      <label class="field-label" for="set-key">Anthropic API key</label>
      <input type="password" id="set-key" placeholder="${masked ? esc(masked) : 'sk-ant-…'}" autocomplete="off" autocapitalize="off" spellcheck="false">
      <div class="settings-row">
        <button class="primary" id="save-key">Save key</button>
        <button class="ghost" id="test-key" ${S.key ? '' : 'disabled'}>Test</button>
        ${S.key ? `<button class="ghost" id="del-key">Remove</button>` : ''}
      </div>
      <p class="help">${S.key ? `Saved on this phone: ${esc(masked)}.` : 'Needed for Word, Translate and Check. Conjugate works without it.'}
      The key stays in this browser only and is sent nowhere except Anthropic's API. Create one at <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">console.anthropic.com</a>, and set a monthly spend limit there.</p>

      <label class="field-label" for="set-model">Model</label>
      <select id="set-model">${Object.entries(MODELS).map(([id, n]) => `<option value="${id}" ${id === S.model ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>
      <p class="help">Haiku is plenty for most things. Switch to Sonnet if corrections feel shallow.</p>

      <label class="field-label">Stored on this phone</label>
      <p class="help">${SAVED.length} saved · ${HIST.length} in history · ${Object.keys(AIVERBS).length} AI-conjugated verbs</p>
      <div class="settings-row"><button class="ghost" id="clear-ai" ${Object.keys(AIVERBS).length ? '' : 'disabled'}>Forget AI verbs</button></div>

      <label class="field-label">About</label>
      <p class="help">Vos ${VERSION}. Conjugations from the Spanish Verb Forms database by Fred Jehle, compiled by Brian Ghidinelli, used under
      <a href="https://creativecommons.org/licenses/by-nc-sa/3.0/" target="_blank" rel="noopener">CC BY-NC-SA 3.0</a>. Vos forms, the -se subjunctive and haber are derived or added here.</p>`;
    $('#save-key').onclick = () => {
      const v = $('#set-key').value.trim();
      if (!v) return toast('Paste a key first');
      if (!/^sk-ant-/.test(v)) toast("That doesn't look like an Anthropic key, saved anyway");
      S.key = v; saveSettings(); renderSheet('settings'); toast('Key saved');
    };
    const del = $('#del-key');
    if (del) del.onclick = () => { S.key = ''; saveSettings(); renderSheet('settings'); toast('Key removed'); };
    $('#test-key').onclick = async () => {
      const b = $('#test-key'); b.disabled = true; b.textContent = 'Testing…';
      try {
        const r = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-api-key': S.key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
          body: JSON.stringify({ model: S.model, max_tokens: 5, messages: [{ role: 'user', content: 'Decí "ta".' }] })
        });
        toast(r.ok ? 'Key works' : r.status === 401 ? 'Key rejected' : `Error ${r.status}`);
      } catch { toast("Couldn't reach the API"); }
      b.disabled = false; b.textContent = 'Test';
    };
    $('#set-model').onchange = e => { S.model = e.target.value; saveSettings(); toast('Model updated'); };
    $('#clear-ai').onclick = () => { AIVERBS = {}; store.set('vos.aiverbs', AIVERBS); renderSheet('settings'); };
  }
}

/* ============================================================
   BOOT
   ============================================================ */
paintDir();
go(VIEWS.includes(location.hash.slice(1)) ? location.hash.slice(1) : S.view, { focus: false });
runConj();
loadVerbs();

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
