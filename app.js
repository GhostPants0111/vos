'use strict';

/* ============================================================
   Vos · Spanish reference tuned for Uruguay
   Conjugate (offline) · Word · Translate · Check (Claude API)
   ============================================================ */

const VERSION = '1.9.0';
// Fixed models. Change here, not in the app.
const CLAUDE_TEXT = 'claude-haiku-4-5';
const CLAUDE_PHOTO = 'claude-sonnet-5-5';
// Newest first. When Google says a model is busy (503/500), over quota (429) or
// unavailable (404), the next one is tried. All are on the free tier.
const GEMINI_MODELS = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite'];
let geminiFrom = 0;   // the model that last worked, so a busy one isn't retried every time this session
// Anthropic keys always start with sk-ant-. Everything else is treated as Google:
// AI Studio now issues AQ. keys; older keys start with AIza.
const providerOf = k => /^sk-ant-/.test((k || '').trim()) ? 'anthropic' : 'gemini';
const KNOWN_KEY = /^(sk-ant-|AQ\.|AIza)/;

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

const STORED = store.get('vos.settings', null);
const BROWSER_ES = /^es/i.test(navigator.language || '');
const FRESH_EN = !STORED && !BROWSER_ES;   // brand-new install on a non-Spanish phone
const DEFAULTS = {
  key: '', ui: FRESH_EN ? 'en' : 'es', explain: FRESH_EN ? 'en' : 'es', country: 'UY', guideSeen: false,
  vosotros: false, se: false, rare: false,
  byPerson: false, person: 'vos', mood: 'ind',
  trReg: 'casual', checkReg: 'formal', checkMode: 'push',
  view: 'conj', moreTab: 'saved'
};
const S = Object.assign({}, DEFAULTS, STORED || {});
delete S.model; delete S.readModel;   // model pickers were removed in 1.4
const saveSettings = () => store.set('vos.settings', S);

/* ---------------- interface language ---------------- */
const I18N = {
  es: {
    'tab.conj': 'Conjugar', 'tab.word': 'Palabra', 'tab.tr': 'Traducir', 'tab.check': 'Corregir', 'tab.more': 'Más',
    'chip.person': 'Por persona', 'chip.vosotros': 'Vosotros', 'chip.se': 'Formas en -se', 'chip.rare': 'Tiempos raros',
    'ph.word': 'una palabra, o una en inglés', 'btn.search': 'Buscar',
    'ph.tr': 'Escribí o dictá en español o inglés', 'btn.translate': 'Traducir',
    'ph.check': 'Escribí algo, dictalo o sacale una foto.', 'btn.check': 'Corregir',
    'reg.casual': 'Informal', 'reg.formal': 'Formal', 'mode.errors': 'Solo errores', 'mode.push': 'Exigime',
    'more.saved': 'Guardados', 'more.history': 'Historial', 'more.settings': 'Ajustes',
    'aria.swap': 'Cambiar dirección', 'aria.clear': 'Borrar', 'aria.photo': 'Sacar una foto', 'aria.gallery': 'Elegir una foto',
    'aria.dictate': 'Dictar', 'aria.stopDictate': 'Dejar de dictar', 'aria.reg': 'Registro', 'aria.strict': 'Qué tan estricto',
    'aria.section': 'Sección', 'aria.save': 'Guardar', 'aria.unsave': 'Quitar de guardados', 'aria.listen': 'Escuchar',
    'aria.copy': 'Copiar', 'aria.remove': 'Quitar', 'aria.person': 'Persona', 'aria.mood': 'Modo', 'aria.rotate': 'Girar',
    'aria.miclang': l => `Idioma del dictado: ${l === 'es' ? 'español' : 'inglés'}`,
    'alt.photo': 'Tu foto',
    'noTTS': 'Este dispositivo no puede leer en voz alta.',
    'saved': 'Guardado', 'unsaved': 'Quitado de guardados', 'copied': 'Copiado', 'copyFail': 'No se pudo copiar',
    'err.nokey': 'Primero agregá tu clave de API: Más → Ajustes.',
    'err.offline': 'Estás sin conexión. Conjugar funciona igual; esto necesita internet.',
    'err.net': 'No se pudo conectar con la API. Revisá la conexión y probá de nuevo.',
    'err.key': 'La clave de API fue rechazada. Revisala en Ajustes.',
    'err.rate': 'Demasiadas consultas seguidas. Esperá unos segundos y probá de nuevo.',
    'err.busy': 'La API está saturada. Probá de nuevo en un rato.',
    'err.credit': 'Tu cuenta de Anthropic se quedó sin crédito. Cargá saldo en la Console.',
    'err.geminiQuota': 'Llegaste al límite gratis de Gemini. Esperá un minuto, o hasta mañana si es el límite diario. Tus límites están en aistudio.google.com/rate-limit.',
    'err.api': (s, d) => `Error de la API ${s}${d ? ': ' + d : ''}`,
    'err.unexpected': 'Llegó una respuesta inesperada. Probá de nuevo.',
    'err.unreadable': 'Llegó una respuesta ilegible. Probá de nuevo.',
    'err.truncated': 'La respuesta quedó cortada. Probá con un texto más corto.',
    'err.notext': 'No encontré texto legible en esa foto.',
    'err.image': 'No se pudo abrir esa imagen.',
    'conj.loadFail': 'No se pudieron cargar los verbos. Abrí la app una vez con conexión.',
    'conj.loading': 'Cargando verbos…',
    'conj.empty': 'Escribí un infinitivo para ver todas sus formas, o pegá cualquier forma que te encontraste, como <b>dijeran</b>, <b>sos</b> o <b>andate</b>, para saber qué es. Tocá una forma para escucharla.',
    'conj.multi': r => `${r} puede ser de más de un verbo:`,
    'conj.notFound': r => `“${r}” no está entre los 638 verbos de la base.`,
    'conj.askAI': 'Pedirle a la IA que lo conjugue',
    'conj.working': w => `Conjugando ${w}…`,
    'conj.notVerb': w => `“${w}” no parece un verbo en español.`,
    'conj.aiWarn': 'Este verbo no está en la base, así que las tablas las generó la IA. Verificá lo que sea importante.',
    'vb.present': 'presente', 'vb.command': 'imperativo', 'vb.neg': 'negativo', 'vb.subj': 'subjuntivo', 'or': 'o',
    'conj.vosNote': s => `Por escrito, el subjuntivo con tú (${s}) es lo más seguro; la forma de vos es común al hablar.`,
    'conj.compNote': pp => `Todos se forman con haber + <b>${pp}</b>.`,
    'word.looking': q => `Buscando ${q}…`, 'word.none': q => `No hubo resultados para “${q}”.`,
    'word.inUy': () => `En ${cName()} se dice:`, 'word.syn': 'Sinónimos', 'word.ant': 'Antónimos', 'word.conj': v => `Conjugar ${v}`,
    'roots': 'Raíces', 'roots.origin': 'Origen', 'roots.family': 'Familia', 'roots.english': 'Inglés', 'roots.ff': 'falso amigo',
    'tag.uy': 'acá', 'tag.careful': 'ojo', 'tag.note': 'nota', 'tag.natural': 'más natural', 'tag.work': 'a practicar',
    'lang.es': 'Español', 'lang.en': 'Inglés',
    'tr.detect': 'Detectar', 'tr.detected': l => `Detectado: ${l}`, 'tr.other': 'el otro', 'tr.autoToast': 'Detectar idioma',
    'tr.reading': 'Leyendo la foto…', 'tr.working': 'Traduciendo…',
    'check.reading': 'Leyendo y corrigiendo tu foto…', 'check.working': 'Corrigiendo…',
    'check.readNote': n => `Arriba quedó lo que leí de tu foto, con tus errores tal cual. Si leí algo mal${n ? ` (buscá [?], ${n} ${n > 1 ? 'lugares' : 'lugar'})` : ''} y tocá <b>Corregir</b> de nuevo. Tocá la foto para verla grande.`,
    'check.count': n => `${n} ${n > 1 ? 'correcciones' : 'corrección'}`, 'check.none': 'Sin correcciones',
    'check.clean': 'No hay nada que corregir.', 'check.copy': 'Copiar corregido',
    'kind.conj': 'verbo', 'kind.verb': 'verbo', 'kind.word': 'palabra', 'kind.tr': 'traducción', 'kind.check': 'corrección',
    'more.aiGone': 'Ese verbo de la IA ya no está guardado.',
    'more.savedEmpty': 'Todavía no guardaste nada. Tocá la estrella en un verbo, una palabra o una traducción para guardarlo acá.',
    'more.copyList': 'Copiar la lista como texto', 'more.histEmpty': 'Todavía no hay historial.', 'more.clearHist': 'Borrar historial',
    'set.key': 'Clave de API', 'set.saveKey': 'Guardar clave', 'set.test': 'Probar', 'set.testing': 'Probando…', 'set.removeKey': 'Quitar',
    'set.keyNone': 'La necesitás para Palabra, Traducir y Corregir; Conjugar funciona sin clave. Sirve una clave de Anthropic (Claude, de pago) o de Google Gemini (tiene un nivel gratis). La app reconoce cuál es.',
    'set.keySaved': (m, p) => `Guardada en este teléfono: ${m} · ${p}.`,
    'set.keyWhere': 'La clave queda solo en este navegador y se manda únicamente a la API de su proveedor.',
    'set.getKeys': 'Conseguí una clave en',
    'set.anthropicTip': 'Poné un límite de gasto mensual en la Console de Anthropic.',
    'set.geminiTip': 'Ojo: en el nivel gratis de Gemini, Google puede usar lo que mandás para mejorar sus productos. No mandes nada privado.',
    'set.ui': 'Idioma de la app', 'set.explain': 'Idioma de las explicaciones de la IA',
    'set.explainHelp': 'Las definiciones de Palabra, el porqué de cada corrección y las notas de Traducir.',
    'set.stored': 'Guardado en este teléfono',
    'set.storedLine': (a, b, c) => `${a} guardados · ${b} en el historial · ${c} verbos conjugados por la IA`,
    'set.forgetAI': 'Olvidar verbos de la IA', 'set.about': 'Acerca de',
    'set.aboutText': v => `Vos ${v}. Conjugaciones de la base Spanish Verb Forms de Fred Jehle, compilada por Brian Ghidinelli, usada bajo <a href="https://creativecommons.org/licenses/by-nc-sa/3.0/" target="_blank" rel="noopener">CC BY-NC-SA 3.0</a>. Las formas de vos, el subjuntivo en -se y haber se derivan o agregan acá.`,
    'key.pasteFirst': 'Primero pegá una clave', 'key.unknown': 'No reconozco esa clave; la guardé igual',
    'key.saved': 'Clave guardada', 'key.removed': 'Clave quitada', 'key.works': 'La clave funciona',
    'explain.es': 'Explicaciones en español', 'explain.en': 'Explicaciones en inglés', 'ui.set': 'App en español',
    'prov.anthropic': 'Claude (Anthropic)', 'prov.gemini': 'Gemini (Google)',
    'stage.hint': 'Si el texto no está derecho, giralo antes de mandarlo.', 'stage.cancel': 'Cancelar',
    'stage.sendTr': 'Traducir foto', 'stage.sendRead': 'Leer foto',
    'dict.unsupported': 'Este navegador no permite dictar. Usá el micrófono del teclado.',
    'dict.perm': 'Permití el micrófono para poder dictar.', 'dict.net': 'Dictar necesita conexión.',
    'dict.silence': 'Dejé de escuchar después de un minuto en silencio.', 'dict.fail': 'No se pudo empezar a dictar.',
    'dict.lang': l => l === 'es' ? 'Dictado en español' : 'Dictado en inglés',
    'dict.iosFallback': 'En iPhone, si el micrófono de la app no anda, tocá el cuadro de texto y usá el micrófono del teclado.',
    'set.country': 'País / variante',
    'set.countryHelp': 'Vos está pensada para Uruguay. Otros países cambian el vocabulario, el voseo o tuteo, el dictado y la voz; las notas locales pueden ser menos precisas.',
    'country.set': n => `País: ${n}`,
    'ident.hint': '¿Qué es esto? Sacale una foto.',
    'stage.focusPh': 'Opcional: en qué fijarse (ej. solo la comida)',
    'stage.sendWord': 'Identificar', 'ident.working': 'Mirando la foto…',
    'ident.none': 'No reconocí nada en esa foto.', 'ident.general': 'en otros lados:',
    'ident.unsure': 'no estoy seguro', 'ident.look': 'Ver palabra', 'kind.ident': 'foto',
    'g.title': 'Bienvenido a Vos',
    'g.intro': 'Para que Vos funcione necesitás una clave de API. Con Google es gratis y se consigue en un par de minutos.',
    'g.desktop': 'Vos está hecha para el celular. Escaneá este código con la cámara de tu Android o iPhone, o abrí este link ahí:',
    'g.anyway': 'Usarla igual en esta computadora',
    'g.installIos': 'En iPhone, primero instalala: en Safari tocá Compartir (el cuadrado con la flecha) → <b>Agregar a inicio</b>. Si la usás solo dentro de Safari, el iPhone puede borrar tu clave y tus guardados.',
    'g.installAndroid': 'Para usarla como app: en Chrome tocá el menú ⋮ → <b>Agregar a la pantalla principal</b> (o <b>Instalar app</b>).',
    'g.freeTitle': 'Opción gratis: Google Gemini',
    'g.free1': 'Entrá a <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a> con tu cuenta de Google.',
    'g.free2': 'Aceptá los términos si te los pide y tocá <b>Create API key</b>.',
    'g.free3': 'Copiá la clave. Empieza con <b>AQ.</b> (las más viejas empiezan con <b>AIza</b>; también sirven).',
    'g.free4': 'Pegala acá abajo y tocá <b>Guardar y probar</b>.',
    'g.paidTitle': 'Opción de pago: Claude (Anthropic), mejor calidad',
    'g.paid1': 'Creá una cuenta en <a href="https://console.anthropic.com" target="_blank" rel="noopener">console.anthropic.com</a>.',
    'g.paid2': 'En <b>Billing</b>, cargá crédito. Con 5 dólares se empieza, y el uso normal cuesta centavos.',
    'g.paid3': 'En <b>API keys</b>, tocá <b>Create key</b> y copiala enseguida: empieza con <b>sk-ant-</b> y se muestra una sola vez.',
    'g.paid4': 'Poné un límite de gasto mensual en Billing y pegá la clave acá abajo.',
    'g.paste': 'Pegá tu clave', 'g.saveTest': 'Guardar y probar', 'g.later': 'Más tarde',
    'g.ready': 'Listo, la clave funciona.', 'g.open': '¿Cómo consigo una clave?', 'g.setup': 'Configurar clave',
    'g.close': 'Cerrar',
    'more.help': 'Ayuda', 'g.howto': 'Ver cómo se usa la app', 'help.try': 'Probalo',
    'help.filled': 'Ejemplo listo: tocá el botón azul.',
    'help.intro': 'Vos tiene cuatro herramientas. Conjugar funciona sin conexión; las otras usan IA con tu clave.',
    'help.conj': ['Escribí un infinitivo (hablar) para ver todas sus formas, o cualquier forma que te encontraste (dijeran, andate) para saber qué es.',
      'Por persona: elegí una persona (vos, yo…) y ves esa forma en todos los tiempos, en una sola pantalla.',
      'Vosotros, las formas en -se y los tiempos raros están ocultos; activalos con los botones de arriba.',
      'Tocá cualquier forma para escucharla. La estrella la guarda en Guardados.'],
    'help.word': ['Buscá una palabra en español para ver definiciones, ejemplos, sinónimos y notas locales, o una en inglés para saber cómo se dice acá.',
      'Raíces: tocala para ver de qué partes está hecha la palabra y su familia.',
      'Con la cámara o una foto te dice qué hay en la imagen y cómo se llama acá. Podés escribir en qué fijarse.',
      'Si es un verbo, el botón Conjugar te lleva a sus tablas.'],
    'help.tr': ['Escribí, dictá o sacale una foto a un texto, en español o inglés; el idioma se detecta solo. Las flechas fuerzan la dirección.',
      'Informal o Formal cambia cómo queda el español: vos con amigos, usted para un mail al banco.',
      'El micrófono dicta hasta que lo tocás de nuevo. ES / EN al lado elige el idioma en que hablás.'],
    'help.check': ['Escribí, pegá o dictá tu español y te marca cada error con una explicación corta.',
      'Solo errores corrige lo que está mal. Exigime también marca lo que suena poco natural.',
      'Sacale una foto a algo escrito a mano o impreso y lo lee y lo corrige de una. Lo que leyó queda en el cuadro: si leyó algo mal, arreglalo y tocá Corregir de nuevo.',
      'Si dictás, no te marca puntuación ni tildes, solo gramática y palabras.'],
    'help.more': ['Guardados: todo lo que marcaste con la estrella. Historial: tus últimas búsquedas; tocá una para volver a verla.',
      'Ajustes: país, idioma de la app, idioma de las explicaciones y tu clave.'],
    'help.ex.tr': 'Me tomo el ómnibus y voy para la rambla.',
    'help.ex.check': 'Ayer yo iba al almacén y compré dos frutillas muy rica.',
    'inst.android': 'Instalá Vos como app: se abre al toque, funciona sin conexión y no se pierden tus datos.',
    'inst.androidManual': 'Instalá Vos como app: en Chrome tocá el menú ⋮ → <b>Agregar a la pantalla principal</b> (o <b>Instalar app</b>).',
    'inst.ios': 'Instalá Vos en tu iPhone: tocá <b>Compartir</b> (el cuadrado con la flecha) → <b>Agregar a inicio</b>. Así no se borran tu clave ni tus guardados.',
    'inst.firefox': 'Instalá Vos como app: en Firefox tocá el menú ⋮ → <b>Instalar</b> (o <b>Agregar a la pantalla de inicio</b>). En Android, Vos anda mejor en Chrome: ahí el micrófono de la app funciona.',
    'inst.otherAndroid': 'Instalá Vos como app: en el menú de tu navegador buscá <b>Instalar</b> o <b>Agregar a la pantalla de inicio</b>. En Android, Vos anda mejor en Chrome.',
    'inst.btn': 'Instalar', 'inst.done': 'Vos quedó instalada. Abrila desde tu pantalla de inicio.', 'inst.close': 'Ahora no'
  },
  en: {
    'tab.conj': 'Conjugate', 'tab.word': 'Word', 'tab.tr': 'Translate', 'tab.check': 'Correct', 'tab.more': 'More',
    'chip.person': 'By person', 'chip.vosotros': 'Vosotros', 'chip.se': '-se forms', 'chip.rare': 'Rare tenses',
    'ph.word': 'a word, in Spanish or English', 'btn.search': 'Look up',
    'ph.tr': 'Type or dictate in Spanish or English', 'btn.translate': 'Translate',
    'ph.check': 'Write something, dictate it, or snap a photo.', 'btn.check': 'Correct',
    'reg.casual': 'Casual', 'reg.formal': 'Formal', 'mode.errors': 'Errors only', 'mode.push': 'Push me',
    'more.saved': 'Saved', 'more.history': 'History', 'more.settings': 'Settings',
    'aria.swap': 'Swap direction', 'aria.clear': 'Clear', 'aria.photo': 'Take a photo', 'aria.gallery': 'Choose a photo',
    'aria.dictate': 'Dictate', 'aria.stopDictate': 'Stop dictating', 'aria.reg': 'Register', 'aria.strict': 'How strict',
    'aria.section': 'Section', 'aria.save': 'Save', 'aria.unsave': 'Remove from saved', 'aria.listen': 'Listen',
    'aria.copy': 'Copy', 'aria.remove': 'Remove', 'aria.person': 'Person', 'aria.mood': 'Mood', 'aria.rotate': 'Rotate',
    'aria.miclang': l => `Dictation language: ${l === 'es' ? 'Spanish' : 'English'}`,
    'alt.photo': 'Your photo',
    'noTTS': "This device can't read aloud.",
    'saved': 'Saved', 'unsaved': 'Removed from saved', 'copied': 'Copied', 'copyFail': "Couldn't copy",
    'err.nokey': 'Add your API key first: More → Settings.',
    'err.offline': "You're offline. Conjugate still works; this needs a connection.",
    'err.net': "Couldn't reach the API. Check your connection and try again.",
    'err.key': 'The API key was rejected. Check it in Settings.',
    'err.rate': 'Too many requests in a row. Wait a few seconds and try again.',
    'err.busy': 'The API is overloaded right now. Try again in a moment.',
    'err.credit': 'Your Anthropic account is out of credit. Top up in the Console.',
    'err.geminiQuota': "You've hit Gemini's free limit. Wait a minute, or until tomorrow if it's the daily limit. Your limits are at aistudio.google.com/rate-limit.",
    'err.api': (s, d) => `API error ${s}${d ? ': ' + d : ''}`,
    'err.unexpected': 'Got an unexpected reply. Try again.',
    'err.unreadable': 'Got an unreadable reply. Try again.',
    'err.truncated': 'The reply got cut off. Try a shorter text.',
    'err.notext': "Couldn't find readable text in that photo.",
    'err.image': "Couldn't open that image.",
    'conj.loadFail': "Couldn't load the verbs. Open the app once while online.",
    'conj.loading': 'Loading verbs…',
    'conj.empty': 'Type an infinitive for all its forms, or paste any form you ran into, like <b>dijeran</b>, <b>sos</b> or <b>andate</b>, to find out what it is. Tap any form to hear it.',
    'conj.multi': r => `${r} could be from more than one verb:`,
    'conj.notFound': r => `“${r}” isn't one of the 638 verbs in the database.`,
    'conj.askAI': 'Ask AI to conjugate it',
    'conj.working': w => `Conjugating ${w}…`,
    'conj.notVerb': w => `“${w}” doesn't look like a Spanish verb.`,
    'conj.aiWarn': "This verb isn't in the database, so these tables are AI-generated. Double-check anything that matters.",
    'vb.present': 'present', 'vb.command': 'command', 'vb.neg': "don't", 'vb.subj': 'subjunctive', 'or': 'or',
    'conj.vosNote': s => `In writing, the tú subjunctive (${s}) is the safer choice; the vos form is common in speech.`,
    'conj.compNote': pp => `All of these are haber + <b>${pp}</b>.`,
    'word.looking': q => `Looking up ${q}…`, 'word.none': q => `Nothing came back for “${q}”.`,
    'word.inUy': () => `In ${cName()} you'd say:`, 'word.syn': 'Synonyms', 'word.ant': 'Opposites', 'word.conj': v => `Conjugate ${v}`,
    'roots': 'Roots', 'roots.origin': 'Origin', 'roots.family': 'Family', 'roots.english': 'English', 'roots.ff': 'false friend',
    'tag.uy': () => C().en, 'tag.careful': 'careful', 'tag.note': 'note', 'tag.natural': 'sounds native', 'tag.work': 'work on',
    'lang.es': 'Spanish', 'lang.en': 'English',
    'tr.detect': 'Auto', 'tr.detected': l => `Detected: ${l}`, 'tr.other': 'the other one', 'tr.autoToast': 'Auto-detect',
    'tr.reading': 'Reading the photo…', 'tr.working': 'Translating…',
    'check.reading': 'Reading and correcting your photo…', 'check.working': 'Correcting…',
    'check.readNote': n => `The box above has what I read from your photo, your mistakes kept as written. If I misread anything${n ? ` (look for [?], ${n} spot${n > 1 ? 's' : ''})` : ''}, then tap <b>Correct</b> again. Tap the photo to see it full size.`,
    'check.count': n => `${n} fix${n > 1 ? 'es' : ''}`, 'check.none': 'No fixes',
    'check.clean': 'Nothing to fix.', 'check.copy': 'Copy corrected',
    'kind.conj': 'verb', 'kind.verb': 'verb', 'kind.word': 'word', 'kind.tr': 'translation', 'kind.check': 'correction',
    'more.aiGone': 'That AI verb is no longer cached.',
    'more.savedEmpty': 'Nothing saved yet. Tap the star on a verb, word or translation to keep it here.',
    'more.copyList': 'Copy list as text', 'more.histEmpty': 'No history yet.', 'more.clearHist': 'Clear history',
    'set.key': 'API key', 'set.saveKey': 'Save key', 'set.test': 'Test', 'set.testing': 'Testing…', 'set.removeKey': 'Remove',
    'set.keyNone': 'Needed for Word, Translate and Correct; Conjugate works without it. Use an Anthropic key (Claude, paid) or a Google Gemini key (has a free tier). The app works out which one it is.',
    'set.keySaved': (m, p) => `Saved on this phone: ${m} · ${p}.`,
    'set.keyWhere': 'The key stays in this browser only and is sent nowhere except its provider’s API.',
    'set.getKeys': 'Get a key at',
    'set.anthropicTip': 'Set a monthly spend limit in the Anthropic Console.',
    'set.geminiTip': "Heads up: on Gemini's free tier, Google may use what you send to improve its products. Don't send anything private.",
    'set.ui': 'App language', 'set.explain': 'AI explanation language',
    'set.explainHelp': 'Word definitions, the why behind each correction, and Translate notes.',
    'set.stored': 'Stored on this phone',
    'set.storedLine': (a, b, c) => `${a} saved · ${b} in history · ${c} AI-conjugated verbs`,
    'set.forgetAI': 'Forget AI verbs', 'set.about': 'About',
    'set.aboutText': v => `Vos ${v}. Conjugations from the Spanish Verb Forms database by Fred Jehle, compiled by Brian Ghidinelli, used under <a href="https://creativecommons.org/licenses/by-nc-sa/3.0/" target="_blank" rel="noopener">CC BY-NC-SA 3.0</a>. Vos forms, the -se subjunctive and haber are derived or added here.`,
    'key.pasteFirst': 'Paste a key first', 'key.unknown': "That doesn't look like an Anthropic or Google key; saved anyway",
    'key.saved': 'Key saved', 'key.removed': 'Key removed', 'key.works': 'Key works',
    'explain.es': 'Explanations in Spanish', 'explain.en': 'Explanations in English', 'ui.set': 'App in English',
    'prov.anthropic': 'Claude (Anthropic)', 'prov.gemini': 'Gemini (Google)',
    'stage.hint': "If the text isn't upright, rotate it before sending.", 'stage.cancel': 'Cancel',
    'stage.sendTr': 'Translate photo', 'stage.sendRead': 'Read photo',
    'dict.unsupported': "This browser can't take dictation. Use your keyboard's mic instead.",
    'dict.perm': 'Allow the microphone to dictate.', 'dict.net': 'Dictation needs a connection.',
    'dict.silence': 'Stopped listening after a minute of silence.', 'dict.fail': "Couldn't start dictation.",
    'dict.lang': l => l === 'es' ? 'Dictating in Spanish' : 'Dictating in English',
    'dict.iosFallback': "On iPhone, if the app's mic doesn't work, tap the text box and use the keyboard's mic instead.",
    'set.country': 'Country / variety',
    'set.countryHelp': 'Vos is built for Uruguay. Other countries change the vocabulary, vos or tú, dictation and voice; local notes may be less precise.',
    'country.set': n => `Country: ${n}`,
    'ident.hint': 'What is this? Snap a photo.',
    'stage.focusPh': 'Optional: what to focus on (e.g. just the food)',
    'stage.sendWord': 'Identify', 'ident.working': 'Looking at the photo…',
    'ident.none': "Couldn't recognise anything in that photo.", 'ident.general': 'elsewhere:',
    'ident.unsure': 'not sure', 'ident.look': 'Look it up', 'kind.ident': 'photo',
    'g.title': 'Welcome to Vos',
    'g.intro': "To get Vos working you need an API key. With Google it's free and takes a couple of minutes.",
    'g.desktop': 'Vos is made for your phone. Scan this code with your Android or iPhone camera, or open this link there:',
    'g.anyway': 'Use it on this computer anyway',
    'g.installIos': 'On iPhone, install it first: in Safari tap Share (the square with the arrow) → <b>Add to Home Screen</b>. If you only use it inside Safari, the iPhone may erase your key and saved items.',
    'g.installAndroid': 'To use it as an app: in Chrome tap the ⋮ menu → <b>Add to Home screen</b> (or <b>Install app</b>).',
    'g.freeTitle': 'Free option: Google Gemini',
    'g.free1': 'Go to <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a> and sign in with your Google account.',
    'g.free2': 'Accept the terms if asked, then tap <b>Create API key</b>.',
    'g.free3': 'Copy the key. It starts with <b>AQ.</b> (older keys start with <b>AIza</b>; those work too).',
    'g.free4': 'Paste it below and tap <b>Save and test</b>.',
    'g.paidTitle': 'Paid option: Claude (Anthropic), better quality',
    'g.paid1': 'Create an account at <a href="https://console.anthropic.com" target="_blank" rel="noopener">console.anthropic.com</a>.',
    'g.paid2': 'Under <b>Billing</b>, add credit. $5 is enough to start; normal use costs cents.',
    'g.paid3': 'Under <b>API keys</b>, tap <b>Create key</b> and copy it right away: it starts with <b>sk-ant-</b> and is shown only once.',
    'g.paid4': 'Set a monthly spend limit under Billing, then paste the key below.',
    'g.paste': 'Paste your key', 'g.saveTest': 'Save and test', 'g.later': 'Later',
    'g.ready': 'All set, the key works.', 'g.open': 'How do I get a key?', 'g.setup': 'Set up key',
    'g.close': 'Close',
    'more.help': 'Help', 'g.howto': 'See how the app works', 'help.try': 'Try it',
    'help.filled': 'Example ready: tap the blue button.',
    'help.intro': 'Vos has four tools. Conjugate works offline; the others use AI with your key.',
    'help.conj': ['Type an infinitive (hablar) to see every form, or any form you ran into (dijeran, andate) to find out what it is.',
      'By person: pick one person (vos, yo…) and see that form across every tense on a single screen.',
      'Vosotros, -se forms and rare tenses are hidden; turn them on with the buttons at the top.',
      'Tap any form to hear it. The star keeps it in Saved.'],
    'help.word': ['Look up a Spanish word for definitions, examples, synonyms and local notes, or an English word to see how it is said here.',
      'Roots: tap it to see what parts the word is built from and its family.',
      'With the camera or a photo it tells you what is in the picture and what it is called here. You can type what to focus on.',
      'If it is a verb, the Conjugate button takes you to its tables.'],
    'help.tr': ['Type, dictate or photograph text in Spanish or English; the language is detected for you. The arrows force a direction.',
      'Casual or Formal changes how the Spanish comes out: vos with friends, usted for an email to the bank.',
      'The mic keeps dictating until you tap it again. ES / EN next to it picks the language you are speaking.'],
    'help.check': ['Type, paste or dictate your Spanish and every mistake is marked with a short reason.',
      'Errors only fixes what is wrong. Push me also marks what sounds unnatural.',
      'Snap or pick a photo of handwriting or print and it reads and corrects it in one go. What it read goes into the box: if it misread something, fix it and tap Correct again.',
      "If you dictate, punctuation and accents aren't marked, only grammar and word choice."],
    'help.more': ['Saved: everything you starred. History: your recent lookups; tap one to see it again.',
      'Settings: country, app language, explanation language and your key.'],
    'help.ex.tr': 'Me tomo el ómnibus y voy para la rambla.',
    'help.ex.check': 'Ayer yo iba al almacén y compré dos frutillas muy rica.',
    'inst.android': 'Install Vos as an app: it opens instantly, works offline and keeps your data safe.',
    'inst.androidManual': 'Install Vos as an app: in Chrome tap the ⋮ menu → <b>Add to Home screen</b> (or <b>Install app</b>).',
    'inst.ios': 'Install Vos on your iPhone: tap <b>Share</b> (the square with the arrow) → <b>Add to Home Screen</b>. That way your key and saved items are never erased.',
    'inst.firefox': "Install Vos as an app: in Firefox tap the ⋮ menu → <b>Install</b> (or <b>Add to Home screen</b>). On Android, Vos works best in Chrome, where the app's mic works.",
    'inst.otherAndroid': "Install Vos as an app: look for <b>Install</b> or <b>Add to Home screen</b> in your browser's menu. On Android, Vos works best in Chrome.",
    'inst.btn': 'Install', 'inst.done': 'Vos is installed. Open it from your home screen.', 'inst.close': 'Not now'
  }
};
function t(k, ...a) {
  const v = (I18N[S.ui] || I18N.es)[k] ?? I18N.es[k] ?? k;
  return typeof v === 'function' ? v(...a) : v;
}
function applyI18n() {
  document.documentElement.lang = S.ui === 'en' ? 'en' : 'es-UY';
  $$('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  $$('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
  $$('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
  $$('[data-i18n-alt]').forEach(el => { el.alt = t(el.dataset.i18nAlt); });
}

/* ---------------- countries (Uruguay first, always the default) ----------------
   mode: 'vos'   vos first, tú shown as the alternate
         'tuvos' tú first, vos still shown
         'cl'    tú first, plus a present-tense "tú (chileno)" row
         'tu'    tú only, vos hidden
         'es'    tú only, vosotros always shown                                  */
const COUNTRIES = [
  { k: 'UY', es: 'Uruguay', en: 'Uruguay', adj: 'Uruguayan', place: 'Montevideo', mode: 'vos', loc: 'es-UY',
    casual: 'voseo (vos tenés, vení, fijate)',
    notes: `- Informal register uses voseo (vos tenés, vení, fijate). Formal register uses usted. Never use vosotros.
- Prefer Uruguayan vocabulary where it differs: ómnibus (bus), championes (sneakers), campera (jacket), gurí/gurisa (kid), liceo (secondary school), frutilla, boniato, morrón, remera, celular, auto, almacén, "ta" (ok).
- In casual text, Uruguayans often mix tú with voseo verbs ("tú sabés"). That is real usage here; do not treat it as an error in casual register.`,
    head: 'Target variety: Uruguayan Spanish as used in Montevideo today. Not porteño, not generic Latin American, never Spain.' },
  { k: 'AR', es: 'Argentina', en: 'Argentina', adj: 'Argentine', place: 'Buenos Aires', mode: 'vos', loc: 'es-AR',
    casual: 'voseo (vos tenés, vení, fijate)',
    notes: `- Informal register uses voseo (vos tenés, vení, fijate). Formal register uses usted. Never use vosotros.
- Prefer Argentine vocabulary where it differs: colectivo (bus), pileta (pool), pibe/piba (kid), remera, campera, zapatillas, palta, frutilla, laburo (work), che, boliche (club).
- Vos subjunctive forms (que vengás) are common in speech; the tú subjunctive (que vengas) is the safer choice in writing.` },
  { k: 'BO', es: 'Bolivia', en: 'Bolivia', adj: 'Bolivian', place: 'La Paz, with Santa Cruz as the main regional variant', mode: 'tuvos', loc: 'es-BO',
    casual: 'tú (voseo is normal in Santa Cruz and Tarija)',
    notes: `- Informal register: tú in La Paz, Cochabamba and the highlands; voseo (vos tenés) is normal in Santa Cruz and Tarija. Formal: usted. Never use vosotros.
- Andean speech softens with pues, nomás, pero and diminutives (un ratito, cafecito).
- Vocabulary: micro (bus), wawa (baby), chompa (sweater), salteña, api, trufi (shared taxi).` },
  { k: 'CL', es: 'Chile', en: 'Chile', adj: 'Chilean', place: 'Santiago', mode: 'cl', loc: 'es-CL',
    casual: 'tú, with Chilean verbal voseo in relaxed speech (¿cómo estái?, ¿querís?, ¿cachai?)',
    notes: `- Informal register: tú as the pronoun, often with Chilean verbal voseo in relaxed speech (estái, querís, podís, cachai). Accept it in casual register; in formal register use standard tú or usted. The pronoun vos itself is very familiar or rude. Never use vosotros.
- Vocabulary: micro (bus), pololo/polola (boyfriend/girlfriend), cachar (to get it), al tiro (right away), fome (boring), bacán (cool), luca (1,000 pesos), guagua (baby), palta, once (evening snack).` },
  { k: 'CO', es: 'Colombia', en: 'Colombia', adj: 'Colombian', place: 'Bogotá, with Medellín, Cali and the Caribbean coast as regional variants', mode: 'tuvos', loc: 'es-CO',
    casual: 'tú in Bogotá and on the coast; usted even among friends in much of the country; vos in Medellín and Cali',
    notes: `- Address is regional: tú in Bogotá and on the Caribbean coast; usted is used even among friends and family in much of the country; vos in Medellín (paisa) and Cali. Treat all three as correct. Never use vosotros.
- Vocabulary: parce/parcero (friend), chévere, bacano, tinto (black coffee), plata (money), guayabo (hangover), ¿qué más? (how are you).` },
  { k: 'CR', es: 'Costa Rica', en: 'Costa Rica', adj: 'Costa Rican', place: 'San José', mode: 'vos', loc: 'es-CR',
    casual: 'usted, which Costa Ricans use even with friends and family, or vos among close friends',
    notes: `- Usted is used very widely, even among friends and family (ustedeo); vos among close friends; tú is uncommon. Treat usted as natural in casual register. Never use vosotros.
- Vocabulary: mae (dude), pura vida, tuanis (cool), diay, güila (kid), brete (work), tico/tica, casado (typical lunch plate).` },
  { k: 'CU', es: 'Cuba', en: 'Cuba', adj: 'Cuban', place: 'Havana', mode: 'tu', loc: 'es-CU',
    casual: 'tú',
    notes: `- Informal register: tú. Formal: usted. Plural: ustedes. Never use vosotros.
- Vocabulary: guagua (bus), asere (friend), ¿qué bolá? (what's up), jama (food), yuma (foreigner), fula (dollars).` },
  { k: 'EC', es: 'Ecuador', en: 'Ecuador', adj: 'Ecuadorian', place: 'Quito, with Guayaquil as the coastal variant', mode: 'tuvos', loc: 'es-EC',
    casual: 'tú on the coast; usted, and vos among friends, in the Sierra',
    notes: `- Address is regional: tú on the coast (Guayaquil); usted and vos in the Sierra (Quito). Treat all as correct. Never use vosotros.
- Vocabulary: chévere, ñaño/ñaña (brother/sister), guagua (child), ¿qué fue? (what's up), bacán, ¿mande?` },
  { k: 'SV', es: 'El Salvador', en: 'El Salvador', adj: 'Salvadoran', place: 'San Salvador', mode: 'vos', loc: 'es-SV',
    casual: 'vos among friends; usted is common',
    notes: `- Informal register: vos (vos tenés, vení) among friends; usted is common; tú is heard but less natural. Never use vosotros.
- Vocabulary: bicho/bicha (kid), cipote (kid), chivo (cool), pisto (money), guanaco (Salvadoran), pupusa, cabal (exactly).` },
  { k: 'ES', es: 'España', en: 'Spain', adj: 'Peninsular (Spain)', place: 'Madrid', mode: 'es', loc: 'es-ES',
    casual: 'tú, with vosotros for plural informal',
    notes: `- Informal register: tú, and vosotros for plural informal (vosotros tenéis, venid). Formal: usted / ustedes. vosotros is correct here; never flag it.
- Vocabulary: vale, coche, móvil, ordenador, zumo, gafas, conducir, guay, currar, tío/tía (mate).
- Leísmo with people (le vi a Juan) is accepted.` },
  { k: 'GT', es: 'Guatemala', en: 'Guatemala', adj: 'Guatemalan', place: 'Guatemala City', mode: 'vos', loc: 'es-GT',
    casual: 'vos among friends; usted is common',
    notes: `- Informal register: vos (vos tenés, vení) among friends; usted is common; tú is also heard. Never use vosotros.
- Vocabulary: patojo/patoja (kid), chucho (dog), chapín (Guatemalan), cabal (exactly), shute (nosy), pisto (money).` },
  { k: 'HN', es: 'Honduras', en: 'Honduras', adj: 'Honduran', place: 'Tegucigalpa', mode: 'vos', loc: 'es-HN',
    casual: 'vos among friends; usted is common',
    notes: `- Informal register: vos (vos tenés, vení) among friends; usted is common. Never use vosotros.
- Vocabulary: cipote/cipota (kid), maje (dude), catracho (Honduran), pisto (money), baleada, chele (light-skinned).` },
  { k: 'MX', es: 'México', en: 'Mexico', adj: 'Mexican', place: 'Mexico City', mode: 'tu', loc: 'es-MX',
    casual: 'tú',
    notes: `- Informal register: tú. Formal: usted. Plural: ustedes. Never use vosotros.
- Vocabulary: güey, chido, neta, padre (cool), camión (bus), chamba (work), lana (money), popote (straw), ¿mande?` },
  { k: 'NI', es: 'Nicaragua', en: 'Nicaragua', adj: 'Nicaraguan', place: 'Managua', mode: 'vos', loc: 'es-NI',
    casual: 'voseo (vos tenés, vení)',
    notes: `- Informal register: voseo (vos tenés, vení, mirá), used widely. Formal: usted. Never use vosotros.
- Vocabulary: chunche (thingamajig), tuani (cool), chele (light-skinned), chavalo/chavala (kid), ¡dale pues!, gallo pinto.` },
  { k: 'PA', es: 'Panamá', en: 'Panama', adj: 'Panamanian', place: 'Panama City', mode: 'tu', loc: 'es-PA',
    casual: 'tú',
    notes: `- Informal register: tú. Formal: usted. Never use vosotros.
- Vocabulary: ¡qué xopá! (what's up), pelao/pelada (kid), chantin (home), chuleta (wow), buco (a lot), chévere.` },
  { k: 'PY', es: 'Paraguay', en: 'Paraguay', adj: 'Paraguayan', place: 'Asunción', mode: 'vos', loc: 'es-PY',
    casual: 'voseo (vos tenés, vení)',
    notes: `- Informal register: voseo (vos tenés, vení). Formal: usted. Never use vosotros.
- Everyday speech mixes in Guaraní words and particles (jopará), such as che (my), nde, -pa, -na. Mention them when relevant; keep formal register in standard Spanish.
- Vocabulary: tereré, chipa, mitã (kid), ñembo (fake).` },
  { k: 'PE', es: 'Perú', en: 'Peru', adj: 'Peruvian', place: 'Lima', mode: 'tu', loc: 'es-PE',
    casual: 'tú',
    notes: `- Informal register: tú; usted is common in polite everyday exchanges. Never use vosotros.
- Vocabulary: chamba (work), pata (friend), jato (house), bacán, combi (minibus), chompa (sweater), palta, ají.` },
  { k: 'PR', es: 'Puerto Rico', en: 'Puerto Rico', adj: 'Puerto Rican', place: 'San Juan', mode: 'tu', loc: 'es-PR',
    casual: 'tú',
    notes: `- Informal register: tú. Formal: usted. Never use vosotros.
- Vocabulary: guagua (bus), chavos (money), janguear (to hang out), boricua, chévere, ¡wepa! Code-switching with English is common and not an error in casual register.` },
  { k: 'DO', es: 'República Dominicana', en: 'Dominican Republic', adj: 'Dominican', place: 'Santo Domingo', mode: 'tu', loc: 'es-DO',
    casual: 'tú',
    notes: `- Informal register: tú. Formal: usted. Never use vosotros.
- Vocabulary: guagua (bus), vaina (thing), un chin (a little), tíguere (street-smart guy), jevi (cool), concho (shared taxi), ¡qué lo que!` },
  { k: 'VE', es: 'Venezuela', en: 'Venezuela', adj: 'Venezuelan', place: 'Caracas', mode: 'tuvos', loc: 'es-VE',
    casual: 'tú (voseo in Zulia)',
    notes: `- Informal register: tú; voseo is used in Zulia (Maracaibo). Formal: usted. Never use vosotros.
- Vocabulary: chamo/chama (kid, friend), pana (friend), chévere, vaina (thing), cambur (banana), arepa.` }
];
const C = () => COUNTRIES.find(c => c.k === S.country) || COUNTRIES[0];
const cName = () => S.ui === 'en' ? C().en : C().es;
function VARIETY() {
  const c = C();
  const head = c.head || `Target variety: ${c.adj} Spanish as used in ${c.place} today. Not generic Latin American Spanish, and not Uruguayan unless it happens to match.`;
  return `${head}
${c.notes}
- Only point out usage that is genuinely characteristic of ${c.en}. If something is the same across the wider region or across Latin America, do not invent a local difference; say nothing.`;
}
/* Chilean verbal voseo, present indicative only, derived from the Rioplatense vos form. */
function chileanPresent(vosForm) {
  if (!vosForm) return null;
  const IRR = { sos: 'erís', vas: 'vai', has: 'habís', das: 'dai', ves: 'veís' };
  const parts = vosForm.split(' ');
  const verb = parts.pop();
  let f = IRR[verb];
  if (!f) {
    if (/ás$/.test(verb)) f = verb.slice(0, -2) + 'ái';
    else if (/és$/.test(verb)) f = verb.slice(0, -2) + 'ís';
    else if (/ís$/.test(verb)) f = verb;
    else return null;
  }
  return [...parts, f].join(' ');
}


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
  const pref = [C().loc, 'es-UY', 'es-AR', 'es-419', 'es-US', 'es-MX', 'es-ES'];
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
let voiceFor = null;
function say(text) {
  if (!('speechSynthesis' in window)) return toast(t('noTTS'));
  if (!esVoice || voiceFor !== S.country) { pickVoice(); voiceFor = S.country; }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(String(text).replace(/^no\s+/, 'no '));
  u.lang = esVoice ? esVoice.lang : C().loc;
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
    toast(t('unsaved'));
  } else {
    SAVED.unshift(Object.assign({ ts: Date.now() }, item));
    toast(t('saved'));
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
  b.setAttribute('aria-label', on ? t('aria.unsave') : t('aria.save'));
  b.innerHTML = STAR;
  b.onclick = () => {
    const now = toggleSave(item);
    b.classList.toggle('on', now);
    b.setAttribute('aria-label', now ? t('aria.unsave') : t('aria.save'));
  };
  return b;
}
function sayBtn(text) {
  return `<button class="icon" data-say="${esc(text)}" aria-label="${t('aria.listen')}">${SPEAKER}</button>`;
}

/* ---------------- navigation ---------------- */
const VIEWS = ['conj', 'word', 'tr', 'check', 'more'];
function go(view, { focus = true } = {}) {
  if (!VIEWS.includes(view)) view = 'conj';
  stopDictation();
  for (const v of VIEWS) $(`[data-view="${v}"]`).hidden = v !== view;
  $$('.tabs button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.go === view)));
  S.view = view; saveSettings();
  if (location.hash !== '#' + view) history.replaceState(history.state, '', '#' + view);
  window.scrollTo(0, 0);
  if (view === 'more') renderMore(S.moreTab);
  const f = { conj: '#conj-q', word: '#word-q', tr: '#tr-q', check: '#check-q' }[view];
  if (focus && f) setTimeout(() => $(f).focus({ preventScroll: true }), 30);
}
$$('[data-go]').forEach(b => b.addEventListener('click', () => go(b.dataset.go)));

/* ---------------- segmented controls ---------------- */
function paintSeg(el, v) { $$('button', el).forEach(b => b.setAttribute('aria-checked', String(b.dataset.v === v))); }
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
const EXPL = () => S.explain === 'en' ? 'English' : `Spanish (natural ${C().adj} Spanish)`;

async function ask({ system, content, maxTokens = 1200, photo = false }) {
  if (!S.key) { const e = new Error(t('err.nokey')); e.code = 'nokey'; throw e; }
  if (!navigator.onLine) throw new Error(t('err.offline'));
  const text = providerOf(S.key) === 'gemini'
    ? await askGemini(system, content, maxTokens, true)
    : await askClaude(system, content, maxTokens, photo ? CLAUDE_PHOTO : CLAUDE_TEXT);
  return parseJSON(text);
}

async function askClaude(system, content, maxTokens, model) {
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
      body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: 'user', content }] })
    });
  } catch { throw new Error(t('err.net')); }
  if (!r.ok) {
    let detail = '';
    try { detail = (await r.json()).error?.message || ''; } catch {}
    if (r.status === 401) throw new Error(t('err.key'));
    if (r.status === 429) throw new Error(t('err.rate'));
    if (r.status === 529 || r.status === 503) throw new Error(t('err.busy'));
    if (r.status === 400 && /credit/i.test(detail)) throw new Error(t('err.credit'));
    throw new Error(t('err.api', r.status, detail));
  }
  const d = await r.json();
  return (d.content || []).filter(c => c.type === 'text').map(c => c.text).join('');
}

function geminiParts(content) {
  if (typeof content === 'string') return [{ text: content }];
  return content.map(b => b.type === 'image'
    ? { inlineData: { mimeType: b.source.media_type, data: b.source.data } }
    : { text: b.text });
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function askGemini(system, content, maxTokens, lowThinking, viaQuery = false, mi = geminiFrom, trail = []) {
  if (mi >= GEMINI_MODELS.length) {
    // Every model refused. Say what Google actually said for each one.
    const limited = trail.some(x => x.status === 429);
    const why = trail.map(x => `${x.model.replace('gemini-', '')}: ${x.status}${x.detail ? ' ' + x.detail.slice(0, 170) : ''}`).join(' · ');
    geminiFrom = 0;
    throw new Error(t(limited ? 'err.geminiQuota' : 'err.busy') + (why ? ` (Google: ${why})` : ''));
  }
  const model = GEMINI_MODELS[mi];
  const generationConfig = { maxOutputTokens: Math.max(8192, maxTokens * 4), responseMimeType: 'application/json' };
  if (lowThinking) generationConfig.thinkingConfig = { thinkingLevel: 'low' };
  let r;
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent` +
      (viaQuery ? `?key=${encodeURIComponent(S.key.trim())}` : '');
    const headers = { 'content-type': 'application/json' };
    if (!viaQuery) headers['x-goog-api-key'] = S.key.trim();
    r = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: geminiParts(content) }],
        generationConfig
      })
    });
  } catch { throw new Error(t('err.net')); }
  if (!r.ok) {
    let detail = '';
    try { detail = (await r.json()).error?.message || ''; } catch {}
    // Some models don't accept the thinking setting; retry once without it.
    if (r.status === 400 && lowThinking && /thinking/i.test(detail)) return askGemini(system, content, maxTokens, false, viaQuery, mi, trail);
    const keyProblem = r.status === 401 || r.status === 403 || (r.status === 400 && /api key/i.test(detail));
    if (keyProblem && !viaQuery) return askGemini(system, content, maxTokens, lowThinking, true, mi, trail);
    if (keyProblem) throw new Error(t('err.key') + (detail ? ` (Google: ${detail.slice(0, 160)})` : ''));
    // Busy, over this model's free quota, or model not available: fall back to the next model.
    if ([429, 500, 503, 404].includes(r.status)) {
      trail.push({ model, status: r.status, detail });
      // A per-minute limit applies to every model in the project, so trying more only burns requests.
      if (r.status === 429 && /per.?minute|PerMinute|RPM/i.test(detail)) return askGemini(system, content, maxTokens, lowThinking, viaQuery, GEMINI_MODELS.length, trail);
      await sleep(400);
      return askGemini(system, content, maxTokens, lowThinking, viaQuery, mi + 1, trail);
    }
    throw new Error(t('err.api', r.status, detail));
  }
  geminiFrom = mi;
  const d = await r.json();
  const c = d.candidates && d.candidates[0];
  const text = ((c && c.content && c.content.parts) || []).filter(p => p.text && !p.thought).map(p => p.text).join('');
  if (!text && c && c.finishReason === 'MAX_TOKENS') throw new Error(t('err.truncated'));
  if (!text) throw new Error(t('err.unexpected'));
  return text;
}
function parseJSON(text) {
  const a = text.indexOf('{'), b = text.lastIndexOf('}');
  if (a < 0 || b < a) throw new Error(t('err.unexpected'));
  try { return JSON.parse(text.slice(a, b + 1)); }
  catch { throw new Error(t('err.unreadable')); }
}
function loading(el, msg) { el.innerHTML = `<p class="msg"><span class="spinner"></span>${esc(msg)}</p>`; }
function failed(el, e) {
  el.innerHTML = `<p class="msg err">${esc(e.message || e)}</p>` +
    (e && e.code === 'nokey' ? `<div class="row"><button class="primary" data-guide>${t('g.setup')}</button></div>` : '');
  const g = $('[data-guide]', el);
  if (g) g.onclick = () => openGuide({ direct: true });
}

/* ============================================================
   CONJUGATE
   ============================================================ */
let DATA = null, REV = null;
let AIVERBS = store.get('vos.aiverbs', {});

const PERSONS = ['yo', 'tú', 'él / ella / usted', 'nosotros', 'vosotros', 'ellos / ustedes'];
const COMPOUND = { ind_pp: 'ind_pres', ind_plus: 'ind_imp', ind_futp: 'ind_fut', ind_condp: 'ind_cond', ind_ant: 'ind_pret', sub_pp: 'sub_pres', sub_plus: 'sub_imp', sub_futp: 'sub_fut' };
const MOODS = {
  ind:  { label: 'Indicativo', tenses: ['ind_pres', 'ind_pret', 'ind_imp', 'ind_fut', 'ind_cond'] },
  sub:  { label: 'Subjuntivo', tenses: ['sub_pres', 'sub_imp', 'sub_imp_se', 'sub_fut'] },
  imp:  { label: 'Imperativo', tenses: ['imp_aff', 'imp_neg'] },
  comp: { label: 'Compuestos', tenses: ['ind_pp', 'ind_plus', 'ind_futp', 'ind_condp', 'ind_ant', 'sub_pp', 'sub_plus', 'sub_futp'] }
};
const RARE = new Set(['ind_ant', 'sub_fut', 'sub_futp']);
// Person keys used by the "By person" view. idx points into the 6-slot form arrays.
const PKEYS = [
  { k: 'yo', label: 'yo', idx: 0 },
  { k: 'vos', label: 'vos', idx: 1 },
  { k: 'tu', label: 'tú', idx: 1 },
  { k: 'el', label: 'él / usted', idx: 2 },
  { k: 'nos', label: 'nosotros', idx: 3 },
  { k: 'vosotros', label: 'vosotros', idx: 4 },
  { k: 'ellos', label: 'ellos / ustedes', idx: 5 }
];
const IDX_TO_KEY = ['yo', 'tu', 'el', 'nos', 'vosotros', 'ellos'];

function moodKeyOf(t) {
  for (const [k, m] of Object.entries(MOODS)) if (m.tenses.includes(t)) return k;
  return null;
}
function tenseVisible(t, force) {
  if (t === force) return true;
  if (RARE.has(t) && !S.rare) return false;
  if (t === 'sub_imp_se' && !S.se) return false;
  return true;
}

async function loadVerbs() {
  try {
    const r = await fetch('data/verbs.json');
    DATA = await r.json();
    buildRev();
    runConj();
  } catch {
    $('#conj-out').innerHTML = `<p class="msg err">${t('conj.loadFail')}</p>`;
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

const SUB_COMP = new Set(['sub_pp', 'sub_plus', 'sub_futp']);
function tenseLabel(t) {
  const [es, en] = tenseName(t);
  return SUB_COMP.has(t) ? [es + ' (subj.)', en + ' subjunctive'] : [es, en];
}
function tenseName(t) {
  if (t === 'ger') return ['Gerundio', 'Gerund'];
  if (t === 'pp') return ['Participio', 'Past participle'];
  return (DATA && DATA.tenses[t]) || [t, ''];
}
function moodOf(t) {
  if (t.startsWith('ind')) return 'indicativo';
  if (t.startsWith('sub')) return 'subjuntivo';
  if (t.startsWith('imp')) return 'imperativo';
  return '';
}
function describeHit(h) {
  const [es, en] = tenseName(h.tense);
  const m = COMPOUND[h.tense] ? '' : moodOf(h.tense);
  const WHO = ['yo', 'tú', 'él/usted', 'nosotros', 'vosotros', 'ellos/ustedes'];
  const who = h.i === 'vos' ? 'vos' : (h.i >= 0 ? WHO[h.i] : '');
  if (S.ui === 'en') {
    const me = { indicativo: 'indicative', subjuntivo: 'subjunctive', imperativo: 'imperative' }[m] || '';
    return `${en.toLowerCase()}${me ? ' ' + me : ''}${who ? ', ' + who : ''}, of ${h.inf}`;
  }
  return `${es.toLowerCase()}${m ? ' de ' + m : ''}${who ? ', ' + who : ''}, de ${h.inf}`;
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

/* The person/tense a reverse-lookup hit points at, in "By person" terms. */
const showVos = () => !['tu', 'es'].includes(C().mode);
const vosFirst = () => C().mode === 'vos';
const showVosotros = () => S.vosotros || C().mode === 'es';

function personForHit(v, h) {
  if (!h || h.i === -1 || h.i == null) return null;
  let k;
  if (h.i === 'vos') k = 'vos';
  else if (h.i === 1) {
    const vf = vosFormFor(v, h.tense);
    k = vf && vf !== v.t[h.tense][1] ? 'tu' : (vosFirst() ? 'vos' : 'tu');
  } else k = IDX_TO_KEY[h.i];
  if (k === 'vos' && !showVos()) k = 'tu';
  if (k === 'vosotros' && !showVosotros()) k = null;
  return k;
}

let lastQ = '';   // folded query, for highlighting the form you typed

function isHit(f) {
  return lastQ && f && fold(String(f).replace(/^no\s+/, '')) === lastQ;
}

function tenseTable(v, tense) {
  const forms = v.t[tense];
  if (!forms || !forms.some(Boolean)) return '';
  const [es, en] = tenseLabel(tense);
  const vos = vosFormFor(v, tense);
  const rows = [];
  if (forms[0]) rows.push(['yo', forms[0], '']);
  const tuRow = forms[1] ? ['tú', forms[1], vosFirst() ? '' : 'vos'] : null;
  if (!showVos()) {
    if (tuRow) rows.push(tuRow);
  } else if (vos && vos !== forms[1]) {
    const vosRow = ['vos', vos, vosFirst() ? 'vos' : ''];
    if (vosFirst()) { rows.push(vosRow); if (tuRow) rows.push(tuRow); }
    else { if (tuRow) rows.push(tuRow); rows.push(vosRow); }
  } else if (forms[1]) {
    rows.push([vosFirst() ? 'vos / tú' : 'tú / vos', forms[1], 'vos']);
  }
  if (C().mode === 'cl' && tense === 'ind_pres') {
    const cl = chileanPresent(v.vos && v.vos.ind_pres);
    if (cl && cl !== forms[1]) rows.push(['tú (chileno)', cl, '']);
  }
  if (forms[2]) rows.push([PERSONS[2], forms[2], '']);
  if (forms[3]) rows.push([PERSONS[3], forms[3], '']);
  if (showVosotros() && forms[4]) rows.push([PERSONS[4], forms[4], '']);
  if (forms[5]) rows.push([PERSONS[5], forms[5], '']);
  return `<div class="tense"><h3>${esc(es)} <span>${esc(en)}</span></h3>` +
    rows.map(([p, f, c]) => `<div class="frow ${c}${isHit(f) ? ' hit' : ''}" data-say="${esc(f)}"><span class="p">${esc(p)}</span><span class="f">${esc(f)}</span></div>`).join('') +
    `</div>`;
}

/* One person's form in one tense, plus an optional grey alternative. */
function personForm(v, tense, pk) {
  const forms = v.t[tense];
  if (!forms) return null;
  const p = PKEYS.find(x => x.k === pk);
  if (pk === 'vos') {
    const vf = vosFormFor(v, tense);
    if (vf && vf !== forms[1]) {
      const alt = tense === 'sub_pres' || tense === 'imp_neg' ? forms[1] : null;
      return { f: vf, alt };
    }
    return forms[1] ? { f: forms[1] } : null;
  }
  return forms[p.idx] ? { f: forms[p.idx] } : null;
}

function renderPersonView(v, force) {
  if (S.person === 'vosotros' && !showVosotros()) S.person = vosFirst() ? 'vos' : 'tu';
  if (S.person === 'vos' && !showVos()) S.person = 'tu';
  let keys = PKEYS.filter(p => (p.k !== 'vosotros' || showVosotros()) && (p.k !== 'vos' || showVos()));
  if (!vosFirst()) {
    const vi = keys.findIndex(p => p.k === 'vos'), ti = keys.findIndex(p => p.k === 'tu');
    if (vi >= 0 && ti >= 0) { const tmp = keys[vi]; keys[vi] = keys[ti]; keys[ti] = tmp; }
  }
  const chips = keys.map(p =>
    `<button class="pchip" data-p="${p.k}" aria-pressed="${p.k === S.person}">${esc(p.label)}</button>`).join('');
  const line = (label, f, alt) => `<div class="pline${isHit(f) || isHit(alt) ? ' hit' : ''}" data-say="${esc(f)}">
      <span class="t">${esc(label)}</span><span class="f">${esc(f)}${alt ? `<span class="alt">${t('or')} ${esc(alt)}</span>` : ''}</span></div>`;
  let html = `<div class="pchips" role="group" aria-label="${t('aria.person')}">${chips}</div>`;
  for (const [mk, m] of Object.entries(MOODS)) {
    let rows = '';
    if (mk === 'imp') {
      const a = personForm(v, 'imp_aff', S.person), n = personForm(v, 'imp_neg', S.person);
      if (a) rows += line('Afirmativo', a.f);
      if (n) rows += line('Negativo', n.f, n.alt);
    } else {
      for (const t of m.tenses) {
        if (!tenseVisible(t, force)) continue;
        const pf = personForm(v, t, S.person);
        if (!pf) continue;
        rows += line(tenseLabel(t)[0], pf.f, pf.alt);
      }
    }
    if (rows) html += `<div class="mood">${m.label}</div>${rows}`;
  }
  return html;
}

function renderTableView(v, force) {
  const tabs = Object.entries(MOODS).map(([k, m]) =>
    `<button data-v="${k}">${m.label}</button>`).join('');
  const m = MOODS[S.mood] || MOODS.ind;
  let body = m.tenses.filter(t => tenseVisible(t, force)).map(t => tenseTable(v, t)).join('');
  if (S.mood === 'comp' && v.pp) body = `<p class="vosnote" style="margin:12px 0 0">${t('conj.compNote', esc(v.pp))}</p>` + body;
  return `<div class="seg full moodtabs" id="mood-seg" role="radiogroup" aria-label="${t('aria.mood')}">${tabs}</div>${body}`;
}

let current = null;   // { inf, ai, note, force }

function renderVerb(inf, { note = '', ai = false, hit = null } = {}) {
  const v = ai ? AIVERBS[inf] : DATA.verbs[inf];
  if (!v) return;
  fillCompounds(v);
  const force = hit && hit.tense;
  if (hit) {
    const mk = moodKeyOf(hit.tense);
    if (mk) S.mood = mk;
    const pk = personForHit(v, hit);
    if (pk && S.byPerson) S.person = pk;
    saveSettings();
  }
  current = { inf, ai, note, force };
  const out = $('#conj-out');
  const vp = v.vos || {};
  const tuSub = v.t.sub_pres && v.t.sub_pres[1];
  const tuNeg = v.t.imp_neg && v.t.imp_neg[1];
  const vosNeg = vp.sub_pres ? 'no ' + vp.sub_pres : null;
  const cell = (label, f, alt) => f
    ? `<span class="k">${label}</span><span class="v speakable" data-say="${esc(f)}">${esc(f)}${alt && alt !== f ? `<span class="alt">${t('or')} ${esc(alt)}</span>` : ''}</span>`
    : '';

  out.innerHTML = `
    ${note ? `<p class="found">${esc(note)}</p>` : ''}
    ${ai ? `<div class="aiwarn">${t('conj.aiWarn')}</div>` : ''}
    <div class="lemma-head">
      <div style="flex:1"><div class="lemma">${esc(inf)}</div><div class="gloss">${esc(v.en || '')}</div></div>
      ${sayBtn(inf)}<span id="conj-star"></span>
    </div>
    ${v.ger || v.pp ? `<p class="parts">gerundio <b class="speakable" data-say="${esc(v.ger)}">${esc(v.ger)}</b> &nbsp; participio <b class="speakable" data-say="${esc(v.pp)}">${esc(v.pp)}</b></p>` : ''}
    ${S.byPerson || !vosFirst() ? '' : `<div class="vosbox">
      ${cell(t('vb.present'), vp.ind_pres)}
      ${cell(t('vb.command'), vp.imp_aff)}
      ${cell(t('vb.neg'), vosNeg, tuNeg)}
      ${cell(t('vb.subj'), vp.sub_pres, tuSub)}
    </div>
    ${vp.sub_pres && tuSub && vp.sub_pres !== tuSub ? `<p class="vosnote">${t('conj.vosNote', esc(tuSub))}</p>` : ''}`}
    <div id="conj-body">${S.byPerson ? renderPersonView(v, force) : renderTableView(v, force)}</div>
  `;
  $('#conj-star').replaceWith(starBtn({ id: 'verb:' + inf, type: 'verb', key: inf, label: inf, sub: v.en || '', ai }));
  wireConjBody();
  const h = $('#conj-body .hit');
  if (h && hit) setTimeout(() => h.scrollIntoView({ block: 'center', behavior: 'smooth' }), 60);
  addHistory({ id: 'conj:' + inf, type: 'conj', key: inf, label: inf, sub: v.en || '', ai });
}

function rerenderBody() {
  if (!current) return;
  const v = current.ai ? AIVERBS[current.inf] : DATA.verbs[current.inf];
  $('#conj-body').innerHTML = S.byPerson ? renderPersonView(v, current.force) : renderTableView(v, current.force);
  wireConjBody();
}
function wireConjBody() {
  const ms = $('#mood-seg');
  if (ms) seg(ms, S.mood, k => { S.mood = k; saveSettings(); rerenderBody(); });
  $$('.pchip').forEach(b => b.onclick = () => { S.person = b.dataset.p; saveSettings(); rerenderBody(); });
}

function looksLikeVerb(q) { return /^[a-záéíóúüñ\s]+$/i.test(q) && q.length > 1; }

function runConj() {
  const raw = $('#conj-q').value.trim();
  const out = $('#conj-out');
  current = null;
  if (!DATA) { loading(out, t('conj.loading')); return; }
  if (!raw) {
    lastQ = '';
    out.innerHTML = `<div class="empty">${t('conj.empty')}</div>`;
    return;
  }
  const q = fold(raw);
  const direct = Object.keys(DATA.verbs).find(k => fold(k) === q);
  lastQ = direct ? '' : q;
  if (direct) return renderVerb(direct);
  const aiDirect = Object.keys(AIVERBS).find(k => fold(k) === q);
  if (aiDirect) { lastQ = ''; return renderVerb(aiDirect, { ai: true }); }

  const hits = REV.get(q) || [];
  if (hits.length === 1) return renderVerb(hits[0].inf, { note: `${raw}: ${describeHit(hits[0])}`, hit: hits[0] });
  if (hits.length > 1) {
    out.innerHTML = `<p class="found">${t('conj.multi', esc(raw))}</p>` +
      hits.map((h, i) => `<button class="pick" data-h="${i}"><b>${esc(h.inf)}</b><span>${esc(describeHit(h))} · ${esc(DATA.verbs[h.inf].en)}</span></button>`).join('');
    $$('.pick', out).forEach(b => b.onclick = () => {
      const h = hits[+b.dataset.h];
      renderVerb(h.inf, { note: `${raw}: ${describeHit(h)}`, hit: h });
    });
    return;
  }
  out.innerHTML = `<div class="empty">${t('conj.notFound', esc(raw))}
    ${looksLikeVerb(raw) ? `<div class="row"><button class="ghost" id="ai-conj">${t('conj.askAI')}</button></div>` : ''}</div>`;
  const b = $('#ai-conj');
  if (b) b.onclick = () => aiConjugate(raw);
}

function conjSystem() { return `You conjugate Spanish verbs for a learner in ${C().en}.
${VARIETY()}
Reply with JSON only, no prose, no code fences.
If the input is a conjugated form, conjugate its infinitive. If it is not a Spanish verb, reply {"error":"not a verb"}.
Schema:
{"infinitive":str,"en":str (short English gloss, "to ..."),"ger":str,"pp":str,
 "t":{"ind_pres":[6],"ind_pret":[6],"ind_imp":[6],"ind_fut":[6],"ind_cond":[6],"sub_pres":[6],"sub_imp":[6],"sub_fut":[6],"imp_aff":[6],"imp_neg":[6]},
 "vos":{"ind_pres":str,"imp_aff":str,"sub_pres":str}}
Each [6] array is [yo, tú, él/usted, nosotros, vosotros, ellos/ustedes]. Imperative arrays use "" for yo; imp_neg entries start with "no ". Reflexive verbs include the pronoun ("me lavo", "lavate").
vos.sub_pres uses the Rioplatense stress (podás, not puedás). Always fill vos, even where voseo is not used locally.`; }

async function aiConjugate(word) {
  const out = $('#conj-out');
  loading(out, t('conj.working', word));
  try {
    const d = await ask({ system: conjSystem(), content: word, maxTokens: 2000 });
    if (d.error || !d.infinitive || !d.t) throw new Error(t('conj.notVerb', word));
    AIVERBS[d.infinitive] = { en: d.en, ger: d.ger, pp: d.pp, t: d.t, vos: d.vos || {}, g: {} };
    store.set('vos.aiverbs', AIVERBS);
    renderVerb(d.infinitive, { ai: true });
  } catch (e) { failed(out, e); }
}

let conjT;
$('#conj-q').addEventListener('input', () => { clearTimeout(conjT); conjT = setTimeout(runConj, 150); });
for (const [id, key] of [['opt-vosotros', 'vosotros'], ['opt-se', 'se'], ['opt-rare', 'rare'], ['opt-person', 'byPerson']]) {
  const el = $('#' + id);
  el.checked = !!S[key];
  el.onchange = e => { S[key] = e.target.checked; saveSettings(); runConj(); };
}

function openVerb(inf) {
  go('conj', { focus: false });
  $('#conj-q').value = inf;
  runConj();
}

/* ============================================================
   WORD
   ============================================================ */
function wordSystem() { return `You are a Spanish lexicographer writing for an English speaker who lives in ${C().en}, level B2 working toward C1.
${VARIETY()}
The input is a single word or short expression, in Spanish or English.
- Spanish input: explain that word. Give 2 entries only if it is a homograph with unrelated meanings (el/la capital, el/la cura).
- English input: give the 1 to 3 Spanish words people in ${C().en} would actually use for it, most natural first, one entry each.
Reply with JSON only, no prose, no code fences:
{"query_lang":"es"|"en","entries":[{
  "word":str,
  "gender":"el"|"la"|"el/la"|null,
  "pos":str (part of speech),
  "verb_infinitive":str|null (the infinitive if this entry is a verb),
  "senses":[{"def":str (short),"example":str (natural ${C().adj} Spanish sentence),"example_en":str|null}],
  "synonyms":[str],
  "antonyms":[str],
  "uruguay":str|null,
  "careful":str|null,
  "roots":{
    "parts":[{"part":str,"meaning":str}],
    "literal":str|null,
    "origin":str|null,
    "family":[{"word":str,"meaning":str}],
    "english":str|null,
    "false_friend":bool
  }|null
}]}
senses: 1 to 4, most common first.
gender: for nouns only; "el/la" when the same form is used for both (el/la periodista). For adjectives put the feminine in the word field like "cansado, cansada".
synonyms/antonyms: up to 6 each, words actually used in ${C().en}. Empty arrays if none fit.
uruguay: one sentence only if usage in ${C().en} genuinely differs from general Spanish (different word preferred, different meaning, regional connotation). Otherwise null. (The field is called uruguay for historical reasons; it is about ${C().en}.)
careful: one sentence only for a real false friend, vulgar/sexual double meaning in the Río de la Plata, or register trap. Otherwise null.
roots: help the learner decode and remember the word.
- parts: split into prefix / root / suffix with a short meaning for each (des- "undo", cubrir "to cover", -miento "the act of"). Only real, standard morphology. A simple word with no useful split gets a single part.
- literal: what the parts add up to, in a few words, only if it adds something; else null.
- origin: ONE short line (e.g. "Latin cooperire, to cover completely"; "Arabic al-mujadda, cushion"). Only when the origin is clear and well established. If you are not sure, use null. Never invent an etymology.
- family: 3 to 6 common related Spanish words sharing the root, each with a short meaning. Empty array if none.
- english: an English word sharing the root when it helps memory ("cover, discover"), else null. false_friend true if the resemblance is misleading.
Use null for roots only for interjections, slang like "ta", or proper nouns.
${S.explain === 'en'
  ? 'Language: write pos, def, example_en, literal, every meaning inside roots, and the "uruguay" and "careful" notes in English. pos uses English terms (noun, verb, adjective, adverb, expression).'
  : 'Language: write pos, def, literal, every meaning inside roots, and the "uruguay" and "careful" notes in clear, natural Spanish that a C1 learner can follow, like a good monolingual dictionary (${C().adj} usage). pos uses Spanish terms (sustantivo, verbo, adjetivo, adverbio, expresión). Set example_en to null. roots.english still names English words, since that line is about English cognates.'}`; }

async function runWord(q, cached) {
  const out = $('#word-out');
  if (!q) return;
  $('#word-q').value = q;
  if (cached) return renderWord(q, cached);
  loading(out, t('word.looking', q));
  $('#word-form button').disabled = true;
  try {
    const d = await ask({ system: wordSystem(), content: q, maxTokens: 2200 });
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
function rootsHTML(r) {
  if (!r || !((r.parts && r.parts.length) || (r.family && r.family.length) || r.origin)) return '';
  const parts = (r.parts || []).filter(p => p && p.part);
  return `<details class="roots"><summary>${t('roots')}</summary>
    ${parts.length ? `<p class="rparts">${parts.map(p => `<b>${esc(p.part)}</b> <span>${esc(p.meaning || '')}</span>`).join('<i>+</i>')}</p>` : ''}
    ${r.literal ? `<p class="rlit">→ ${esc(r.literal)}</p>` : ''}
    ${r.origin ? `<p class="rline"><span class="rk">${t('roots.origin')}</span>${esc(r.origin)}</p>` : ''}
    ${r.family && r.family.length ? `<p class="rline"><span class="rk">${t('roots.family')}</span>${r.family.map(f => `<b>${esc(f.word)}</b> <span class="rm">${esc(f.meaning || '')}</span>`).join('<span class="rm"> · </span>')}</p>` : ''}
    ${r.english ? `<p class="rline"><span class="rk">${t('roots.english')}</span>${esc(r.english)}${r.false_friend ? ` <span class="tag warn">${t('roots.ff')}</span>` : ''}</p>` : ''}
  </details>`;
}
function renderWord(q, d) {
  const out = $('#word-out');
  const entries = d.entries || [];
  if (!entries.length) { out.innerHTML = `<p class="msg">${t('word.none', esc(q))}</p>`; return; }
  out.innerHTML = (d.query_lang === 'en' ? `<p class="found">${t('word.inUy')}</p>` : '') +
    entries.map((e, i) => {
      const head = (e.gender && e.gender !== 'el/la' ? e.gender + ' ' : '') + e.word;
      const verb = e.verb_infinitive && (DATA?.verbs[e.verb_infinitive] || AIVERBS[e.verb_infinitive]) ? e.verb_infinitive : (e.verb_infinitive || null);
      return `<div class="card">
        <div class="head"><h3>${esc(head)}</h3>${sayBtn(e.word)}<span data-star="${i}"></span></div>
        <div class="pos">${esc(e.pos || '')}${e.gender === 'el/la' ? ' · el/la' : ''}</div>
        <ol>${(e.senses || []).map(s => `<li>${esc(s.def)}${s.example ? `<span class="ex speakable" data-say="${esc(s.example)}">${esc(s.example)}</span>` : ''}${s.example_en ? `<span class="ex" style="font-family:var(--sans);font-size:13px">${esc(s.example_en)}</span>` : ''}</li>`).join('')}</ol>
        ${e.synonyms && e.synonyms.length ? `<p class="syn">${t('word.syn')}: ${e.synonyms.map(w => `<b>${esc(w)}</b>`).join(', ')}</p>` : ''}
        ${e.antonyms && e.antonyms.length ? `<p class="syn">${t('word.ant')}: ${e.antonyms.map(w => `<b>${esc(w)}</b>`).join(', ')}</p>` : ''}
        ${e.uruguay ? `<div class="flag"><span class="tag">${t('tag.uy')}</span><span>${esc(e.uruguay)}</span></div>` : ''}
        ${e.careful ? `<div class="flag"><span class="tag warn">${t('tag.careful')}</span><span>${esc(e.careful)}</span></div>` : ''}
        ${rootsHTML(e.roots)}
        ${verb ? `<div class="row"><button class="ghost" data-conj="${esc(verb)}">${t('word.conj', esc(verb))}</button></div>` : ''}
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
const langName = c => t('lang.' + c);

function paintDir() {
  if (trDir === 'auto') {
    $('#tr-from').textContent = trLast ? t('tr.detected', langName(trLast)) : t('tr.detect');
    $('#tr-to').textContent = trLast ? langName(trLast === 'es' ? 'en' : 'es') : t('tr.other');
  } else {
    const [a, b] = trDir.split('-');
    $('#tr-from').textContent = langName(a);
    $('#tr-to').textContent = langName(b);
  }
}
$('#tr-swap').onclick = () => {
  if (trDir === 'auto') trDir = trLast === 'es' ? 'en-es' : 'es-en';
  else if (trDir === 'es-en') trDir = 'en-es';
  else trDir = 'auto';
  paintDir();
  toast(trDir === 'auto' ? t('tr.autoToast') : `${$('#tr-from').textContent} → ${$('#tr-to').textContent}`);
};
seg($('#tr-reg'), S.trReg, v => { S.trReg = v; saveSettings(); });

function trSystem() {
  const dir = trDir === 'auto'
    ? `Detect whether the source is Spanish or English. If it is ambiguous (a word valid in both, very short, or mixed), treat it as Spanish and translate into English.`
    : trDir === 'es-en' ? `The source is Spanish. Translate it into English.` : `The source is English. Translate it into Spanish.`;
  const reg = S.trReg === 'formal'
    ? `Register for Spanish output: formal (usted, polished written ${C().adj} Spanish, suitable for an email to a lawyer or a bank).`
    : `Register for Spanish output: casual (${C().casual}; how someone in ${C().place} would text a friend or talk to a neighbour).`;
  return `You are a translator between English and ${C().adj} Spanish for an English speaker who lives in ${C().en}.
${VARIETY()}
${dir}
${reg}
When translating into English, give natural American English and explain local slang or idioms in the note rather than translating them word for word.
Reply with JSON only, no prose, no code fences:
{"source_lang":"es"|"en","source_text":str,"translation":str,"alternatives":[{"text":str,"note":str}],"note":str|null}
source_text: the exact source (for a photo, the text you read in it, keeping line breaks).
alternatives: 0 to 2, only when there is a genuinely different natural option (more formal, more casual, a regional alternative). note says when to use it, under 15 words.
note: one sentence on anything a learner should know (idiom, slang, false friend, ambiguity), or null.
Write every note (alternatives[].note and note) in ${EXPL()}.
If a photo has no readable text, reply {"error":"no text"}.`;
}

async function runTranslate({ text, image }) {
  const out = $('#tr-out');
  const go = $('#tr-go');
  loading(out, image ? t('tr.reading') : t('tr.working'));
  go.disabled = true;
  try {
    const content = image
      ? [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image } },
         { type: 'text', text: 'Read the text in this photo and translate it.' }]
      : text;
    const d = await ask({ system: trSystem(), content, maxTokens: 2000, photo: !!image });
    if (d.error) throw new Error(image ? t('err.notext') : d.error);
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
    ${image ? `<img class="thumb zoomable" src="data:image/jpeg;base64,${image}" alt="${t('alt.photo')}">` : ''}
    ${image || d.source_text ? `<p class="tr-src">${esc(d.source_text || '')}</p>` : ''}
    <div class="head"><p class="tr-main" style="flex:1">${esc(d.translation)}</p>
      <button class="icon" id="tr-copy" aria-label="${t('aria.copy')}">${COPY}</button>
      ${sayBtn(spanish)}<span id="tr-star"></span></div>
    ${(d.alternatives || []).map(a => `<div class="alt-item"><div class="t ${toEs ? 'speakable' : ''}" ${toEs ? `data-say="${esc(a.text)}"` : ''}>${esc(a.text)}</div><div class="n">${esc(a.note || '')}</div></div>`).join('')}
    ${d.note ? `<div class="flag"><span class="tag">${t('tag.note')}</span><span>${esc(d.note)}</span></div>` : ''}
  </div>`;
  $('#tr-copy').onclick = async () => {
    try { await navigator.clipboard.writeText(d.translation); toast(t('copied')); }
    catch { toast(t('copyFail')); }
  };
  $('#tr-star').replaceWith(starBtn({
    id: 'tr:' + fold(d.source_text || '').slice(0, 120), type: 'tr',
    key: d.source_text, label: toEs ? d.translation : d.source_text, sub: toEs ? d.source_text : d.translation,
    data: Object.assign({}, d)
  }));
}
$('#tr-go').onclick = () => {
  stopDictation();
  const t = $('#tr-q').value.trim();
  if (t) { $('#tr-q').blur(); runTranslate({ text: t }); }
};
$('#tr-q').addEventListener('keydown', e => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) $('#tr-go').click();
});
$$('input[data-img]').forEach(inp => inp.addEventListener('change', e => {
  const f = e.target.files && e.target.files[0];
  const target = e.target.dataset.img;
  e.target.value = '';
  if (!f) return;
  if (target === 'word') return openStage(target, f);   // Palabra keeps the preview for its focus box
  sendPhoto(target, f);
}));
async function sendPhoto(target, f) {
  const out = target === 'tr' ? $('#tr-out') : $('#check-out');
  try {
    const { img, url } = await loadImage(f);
    const b64 = drawRotated(img, 0, 1568).toDataURL('image/jpeg', 0.85).split(',')[1];
    URL.revokeObjectURL(url);
    if (target === 'tr') runTranslate({ image: b64 });
    else readAndCorrect(b64);
  } catch { failed(out, new Error(t('err.image'))); }
}

/* ============================================================
   CHECK
   ============================================================ */
seg($('#check-reg'), S.checkReg, v => { S.checkReg = v; saveSettings(); });
seg($('#check-mode'), S.checkMode, v => { S.checkMode = v; saveSettings(); });

function checkSystem() {
  const reg = S.checkReg === 'formal'
    ? `Register: formal written ${C().adj} Spanish (usted, no slang, the standard a professional would use in an email to a lawyer, a bank or a prospective employer). In this register, flag mixed forms of address and casual slang.`
    : `Register: casual ${C().adj} Spanish (${C().casual}; the way someone in ${C().place} writes a WhatsApp message). Don't formalise it; keep contractions of speech and local slang that is correct.`;
  const mode = S.checkMode === 'push'
    ? `Strictness: push toward C1. Fix every error, and ALSO fix things that are grammatical but sound non-native, stiff, or like a translation from English (calques, wrong collocations, unnatural word order, weak verb choice). Mark those as kind "style".`
    : `Strictness: errors only. Fix grammar, spelling, accents, agreement, wrong prepositions, wrong mood/tense, and words that are actually wrong. Leave correct-but-plain phrasing alone.`;
  const spoken = checkDictated
    ? `This text was dictated by voice, so it has no reliable punctuation, capitalisation or accents. Fix those silently in "corrected" but do NOT list them in changes. List only real grammar and word-choice problems: agreement, gender, tense and mood, prepositions, calques, wrong or unnatural words.`
    : '';
  return `You correct Spanish written by an English speaker who lives in ${C().en} (B2, working toward C1).
${VARIETY()}
${reg}
${mode}
${spoken}
Keep their meaning and voice. Don't rewrite whole sentences when a small fix works.
Reply with JSON only, no prose, no code fences:
{"corrected":str,"changes":[{"from":str,"to":str,"why":str,"kind":"error"|"style"}],"pattern":str|null}
corrected: the full text with every fix applied, same line breaks.
changes: one per fix, in order of appearance. from/to are the short spans that changed (a few words). why is the rule in ${EXPL()}, plain and under 15 words.
pattern: one sentence in ${EXPL()} naming the single most useful thing to work on, based on these mistakes; null if the text was clean.
If nothing needs fixing, return the text unchanged and an empty changes array.`;
}

/* One call: read the photo exactly, then correct what was read. */
function photoCheckSystem() {
  return checkSystem() + `

The input is a PHOTO of the learner's writing (handwriting or print), not typed text. Do two things in one reply:
1. read: transcribe EXACTLY what is written. Do not correct anything here: keep spelling mistakes, missing or wrong accents, wrong genders, wrong verb forms, odd punctuation and capitalisation as they appear. Keep line breaks only where they mark a new paragraph or list item. If a word is genuinely illegible, write your best guess followed by [?]. If the page is marked up: leave out struck-through words, put words inserted above the line where they belong, and ignore corrections in a second ink colour.
2. Correct the text you read, following all the rules above. "corrected" must not contain [?] marks, and removing a [?] mark is not a change.
Reply with JSON only, no prose, no code fences:
{"read":str,"unsure":int (how many [?] marks are in read),"corrected":str,"changes":[{"from":str,"to":str,"why":str,"kind":"error"|"style"}],"pattern":str|null}
If there is no readable text, reply {"error":"no text"}.`;
}
async function readAndCorrect(b64) {
  const out = $('#check-out');
  const box = $('#check-read');
  box.innerHTML = '';
  stopDictation();
  loading(out, t('check.reading'));
  $('#check-go').disabled = true;
  try {
    const d = await ask({
      system: photoCheckSystem(), maxTokens: 3500, photo: true,
      content: [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } },
                { type: 'text', text: 'Read this exactly, then correct it.' }]
    });
    if (d.error || !d.read) throw new Error(t('err.notext'));
    const read = d.read.replace(/\s*\[\?\]/g, '');
    $('#check-q').value = d.read;
    checkDictated = false;
    paintClear('check');
    box.innerHTML = `<div class="readnote">
      <img class="thumb small zoomable" src="data:image/jpeg;base64,${b64}" alt="${t('alt.photo')}">
      <p>${t('check.readNote', d.unsure || 0)}</p>
    </div>`;
    renderCheck(read, d);
    addHistory({ id: 'check:' + Date.now(), type: 'check', key: read, label: read.slice(0, 80), sub: d.changes?.length ? t('check.count', d.changes.length) : t('check.none'), data: d });
  } catch (e) { failed(out, e); }
  $('#check-go').disabled = false;
}

async function runCheck(text, cached) {
  const out = $('#check-out');
  if (cached) return renderCheck(text, cached);
  loading(out, t('check.working'));
  $('#check-go').disabled = true;
  try {
    const d = await ask({ system: checkSystem(), content: text, maxTokens: 2500 });
    renderCheck(text, d);
    addHistory({ id: 'check:' + Date.now(), type: 'check', key: text, label: text.slice(0, 80), sub: d.changes?.length ? t('check.count', d.changes.length) : t('check.none'), data: d });
  } catch (e) { failed(out, e); }
  $('#check-go').disabled = false;
}
function renderCheck(text, d) {
  const out = $('#check-out');
  const changes = d.changes || [];
  const clean = !changes.length;
  out.innerHTML = `<div class="card">
    ${clean ? `<p class="found" style="margin:0 0 10px">${t('check.clean')}</p>` : ''}
    <div class="diff">${diffHTML(text, d.corrected || text)}</div>
    <div class="row" style="margin:0 0 4px">
      <button class="ghost" id="ck-copy">${t('check.copy')}</button>
      ${sayBtn(d.corrected || text).replace('class="icon"', 'class="icon" style="margin-left:auto"')}
    </div>
    ${changes.map(c => `<div class="fix ${c.kind === 'style' ? 'style' : ''}">
      <div class="ft"><del>${esc(c.from)}</del><ins>${esc(c.to)}</ins></div>
      <div class="why">${c.kind === 'style' ? `<span class="tag sol" style="margin-right:6px">${t('tag.natural')}</span>` : ''}${esc(c.why)}</div>
    </div>`).join('')}
    ${d.pattern ? `<div class="flag"><span class="tag">${t('tag.work')}</span><span>${esc(d.pattern)}</span></div>` : ''}
  </div>`;
  $('#ck-copy').onclick = async () => {
    try { await navigator.clipboard.writeText(d.corrected || text); toast(t('copied')); }
    catch { toast(t('copyFail')); }
  };
}
$('#check-go').onclick = () => {
  const t = $('#check-q').value.trim();
  stopDictation();
  const clean = t.replace(/\s*\[\?\]/g, '');
  if (clean) { $('#check-q').blur(); $('#check-read').innerHTML = ''; runCheck(clean); }
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
   MORE: saved · history · settings
   ============================================================ */


function reopen(item) {
  if (item.type === 'conj' || item.type === 'verb') {
    if (item.ai && !AIVERBS[item.key]) return toast(t('more.aiGone'));
    return openVerb(item.key);
  }
  if (item.type === 'word') { go('word', { focus: false }); return runWord(item.key, item.data); }
  if (item.type === 'ident') { go('word', { focus: false }); return renderIdent(item.data, null); }
  if (item.type === 'tr') {
    go('tr', { focus: false });
    $('#tr-q').value = item.data?.source_text || item.key || '';
    paintClear('tr');
    return renderTranslation(item.data);
  }
  if (item.type === 'check') {
    go('check', { focus: false });
    $('#check-q').value = item.key;
    paintClear('check');
    return runCheck(item.key, item.data);
  }
}

function listHTML(items, empty, removable) {
  if (!items.length) return `<p class="empty">${empty}</p>`;
  return items.map((it, i) => `<div class="list-item">
    <span class="kind">${t('kind.' + it.type)}</span>
    <button class="main" data-i="${i}"><span class="t">${esc(it.label)}</span><span class="s">${esc(it.sub || '')}</span></button>
    ${removable ? `<button class="icon small" data-rm="${i}" aria-label="${t('aria.remove')}"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>` : ''}
  </div>`).join('');
}

function renderHelp(body) {
  const tabName = { conj: 'tab.conj', word: 'tab.word', tr: 'tab.tr', check: 'tab.check', more: 'tab.more' };
  const sec = k => `<div class="card help-sec">
      <h3>${t(tabName[k])}</h3>
      <ul>${t('help.' + k).map(x => `<li>${x}</li>`).join('')}</ul>
      ${k === 'more' ? '' : `<button class="ghost" data-try="${k}">${t('help.try')}</button>`}
    </div>`;
  body.innerHTML = `<p class="help-intro">${t('help.intro')}</p>` + ['conj', 'word', 'tr', 'check', 'more'].map(sec).join('');
  $$('[data-try]', body).forEach(b => b.onclick = () => tryExample(b.dataset.try));
}
function tryExample(k) {
  if (k === 'conj') { openVerb('dijeran'); return; }
  const box = { word: '#word-q', tr: '#tr-q', check: '#check-q' }[k];
  const ex = { word: 'campera', tr: t('help.ex.tr'), check: t('help.ex.check') }[k];
  go(k, { focus: false });
  $(box).value = ex;
  if (k === 'tr' || k === 'check') paintClear(k);
  toast(t('help.filled'));
}

function renderMore(kind) {
  const body = $('#more-body');
  if (kind === 'help') return renderHelp(body);
  if (kind === 'saved') {
    body.innerHTML = listHTML(SAVED, t('more.savedEmpty'), true) +
      (SAVED.length ? `<div class="settings-row"><button class="ghost" id="export">${t('more.copyList')}</button></div>` : '');
    $$('[data-i]', body).forEach(b => b.onclick = () => reopen(SAVED[+b.dataset.i]));
    $$('[data-rm]', body).forEach(b => b.onclick = () => {
      SAVED.splice(+b.dataset.rm, 1); store.set('vos.saved', SAVED); renderMore('saved');
    });
    const ex = $('#export', body);
    if (ex) ex.onclick = async () => {
      const txt = SAVED.map(s => `${s.label}${s.sub ? ' — ' + s.sub : ''}`).join('\n');
      try { await navigator.clipboard.writeText(txt); toast(t('copied')); } catch { toast(t('copyFail')); }
    };
  }
  if (kind === 'history') {
    body.innerHTML = listHTML(HIST, t('more.histEmpty'), false) +
      (HIST.length ? `<div class="settings-row"><button class="ghost" id="clear-h">${t('more.clearHist')}</button></div>` : '');
    $$('[data-i]', body).forEach(b => b.onclick = () => reopen(HIST[+b.dataset.i]));
    const c = $('#clear-h', body);
    if (c) c.onclick = () => { HIST = []; store.set('vos.history', HIST); renderMore('history'); };
  }
  if (kind === 'settings') {
    const masked = S.key ? S.key.slice(0, 8) + '…' + S.key.slice(-4) : '';
    const prov = providerOf(S.key);
    body.innerHTML = `
      <label class="field-label" for="set-country">${t('set.country')}</label>
      <select id="set-country">${COUNTRIES.map(c => `<option value="${c.k}" ${c.k === C().k ? 'selected' : ''}>${esc(S.ui === 'en' ? c.en : c.es)}</option>`).join('')}</select>
      <p class="help">${t('set.countryHelp')}</p>

      <label class="field-label" for="set-ui">${t('set.ui')}</label>
      <div class="seg" id="set-ui" role="radiogroup" aria-label="${t('set.ui')}">
        <button data-v="es">Español</button><button data-v="en">English</button>
      </div>

      <label class="field-label">${t('set.explain')}</label>
      <div class="seg" id="set-explain" role="radiogroup" aria-label="${t('set.explain')}">
        <button data-v="es">${t('lang.es')}</button><button data-v="en">${t('lang.en')}</button>
      </div>
      <p class="help">${t('set.explainHelp')}</p>

      <label class="field-label" for="set-key">${t('set.key')}</label>
      <input type="password" id="set-key" placeholder="${masked ? esc(masked) : 'AQ.…  /  sk-ant-…'}" autocomplete="off" autocapitalize="off" spellcheck="false">
      <div class="settings-row">
        <button class="primary" id="save-key">${t('set.saveKey')}</button>
        <button class="ghost" id="test-key" ${S.key ? '' : 'disabled'}>${t('set.test')}</button>
        ${S.key ? `<button class="ghost" id="del-key">${t('set.removeKey')}</button>` : ''}
      </div>
      <p class="help">${S.key ? t('set.keySaved', esc(masked), t('prov.' + prov)) : t('set.keyNone')} ${t('set.keyWhere')}
      ${t('set.getKeys')} <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">console.anthropic.com</a> · <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com</a>.</p>
      ${S.key ? `<p class="help ${prov === 'gemini' ? 'warnnote' : ''}">${prov === 'gemini' ? t('set.geminiTip') : t('set.anthropicTip')}</p>` : ''}
      <div class="settings-row"><button class="link" id="open-guide">${t('g.open')}</button></div>

      <label class="field-label">${t('set.stored')}</label>
      <p class="help">${t('set.storedLine', SAVED.length, HIST.length, Object.keys(AIVERBS).length)}</p>
      <div class="settings-row"><button class="ghost" id="clear-ai" ${Object.keys(AIVERBS).length ? '' : 'disabled'}>${t('set.forgetAI')}</button></div>

      <label class="field-label">${t('set.about')}</label>
      <p class="help">${t('set.aboutText', VERSION)}</p>`;
    $('#set-country').onchange = e => {
      S.country = e.target.value;
      S.person = vosFirst() ? 'vos' : 'tu';
      esVoice = null;
      saveSettings(); refreshLanguage(); toast(t('country.set', cName()));
    };
    $('#open-guide').onclick = () => openGuide({ direct: true });
    seg($('#set-ui'), S.ui, v => { S.ui = v; saveSettings(); refreshLanguage(); toast(t('ui.set')); });
    seg($('#set-explain'), S.explain, v => { S.explain = v; saveSettings(); toast(t('explain.' + v)); });
    $('#save-key').onclick = () => {
      const v = $('#set-key').value.trim();
      if (!v) return toast(t('key.pasteFirst'));
      if (!KNOWN_KEY.test(v)) toast(t('key.unknown'));
      S.key = v; saveSettings(); renderMore('settings'); toast(t('key.saved'));
    };
    const del = $('#del-key');
    if (del) del.onclick = () => { S.key = ''; saveSettings(); renderMore('settings'); toast(t('key.removed')); };
    $('#test-key').onclick = async () => {
      const b = $('#test-key'); b.disabled = true; b.textContent = t('set.testing');
      try {
        await ask({ system: 'Reply with JSON only.', content: 'Reply with {"ok":true}', maxTokens: 30 });
        toast(t('key.works'));
      } catch (e) { toast(e.message || String(e)); }
      b.disabled = false; b.textContent = t('set.test');
    };
    $('#clear-ai').onclick = () => { AIVERBS = {}; store.set('vos.aiverbs', AIVERBS); renderMore('settings'); };
  }
}

/* Re-render everything that shows interface text after the language changes. */
function refreshLanguage() {
  applyI18n();
  paintDir();
  paintMics();
  $('#tr-miclang').setAttribute('aria-label', t('aria.miclang', trMicLang));
  if (S.view === 'more') renderMore(S.moreTab);
  if (DATA) runConj();
  paintInstall();
}

/* ============================================================
   PHOTOS: preview, rotate, send · full-size viewer
   ============================================================ */
const STAGE = {};   // target -> { img, url, rot }

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => resolve({ img, url });
    img.onerror = () => { URL.revokeObjectURL(url); reject(); };
    img.src = url;
  });
}
function drawRotated(img, rot, maxSide) {
  const w = img.naturalWidth, h = img.naturalHeight;
  const s = Math.min(1, maxSide / Math.max(w, h));
  const sw = Math.round(w * s), sh = Math.round(h * s);
  const side = rot % 180 !== 0;
  const c = document.createElement('canvas');
  c.width = side ? sh : sw; c.height = side ? sw : sh;
  const x = c.getContext('2d');
  x.translate(c.width / 2, c.height / 2);
  x.rotate(rot * Math.PI / 180);
  x.drawImage(img, -sw / 2, -sh / 2, sw, sh);
  return c;
}
async function openStage(target, file) {
  closeStage(target);
  const box = $('#' + target + '-stage');
  try {
    const { img, url } = await loadImage(file);
    STAGE[target] = { img, url, rot: 0 };
    renderStage(target);
  } catch { failed(box, new Error(t('err.image'))); }
}
function renderStage(target) {
  const st = STAGE[target];
  const box = $('#' + target + '-stage');
  box.innerHTML = `<div class="stage">
    <div class="stage-img"></div>
    <p class="help" style="margin:8px 0 0">${t('stage.hint')}</p>
    ${target === 'word' ? `<input type="text" class="focusbox" id="word-focus" placeholder="${t('stage.focusPh')}" value="${esc(st.focus || '')}" autocomplete="off">` : ''}
    <div class="row">
      <button class="icon cam" data-rot aria-label="${t('aria.rotate')}">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.4-5.7M20 4v5h-5"/></svg>
      </button>
      <button class="ghost" data-cancel>${t('stage.cancel')}</button>
      <button class="primary grow" data-send>${target === 'tr' ? t('stage.sendTr') : target === 'word' ? t('stage.sendWord') : t('stage.sendRead')}</button>
    </div>
  </div>`;
  $('.stage-img', box).appendChild(drawRotated(st.img, st.rot, 900));
  const fb = $('#word-focus', box);
  if (fb) fb.oninput = () => { st.focus = fb.value; };
  $('[data-rot]', box).onclick = () => { st.rot = (st.rot + 90) % 360; renderStage(target); };
  $('[data-cancel]', box).onclick = () => closeStage(target);
  $('[data-send]', box).onclick = () => {
    const b64 = drawRotated(st.img, st.rot, 1568).toDataURL('image/jpeg', 0.85).split(',')[1];
    const focus = (st.focus || '').trim();
    closeStage(target);
    if (target === 'tr') runTranslate({ image: b64 });
    else if (target === 'word') runIdentify(b64, focus);
    else readAndCorrect(b64);
  };
  box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}
function closeStage(target) {
  const st = STAGE[target];
  if (st) URL.revokeObjectURL(st.url);
  delete STAGE[target];
  const box = $('#' + target + '-stage');
  if (box) box.innerHTML = '';
}

document.addEventListener('click', e => {
  const z = e.target.closest('img.zoomable');
  if (!z) return;
  const v = $('#viewer');
  $('img', v).src = z.src;
  v.hidden = false;
});
$('#viewer').onclick = () => { $('#viewer').hidden = true; };

/* ============================================================
   TEXT BOXES: clear button
   ============================================================ */
const BOX = { tr: '#tr-q', check: '#check-q' };
function paintClear(target) {
  const btn = $(`[data-clear="${target}"]`);
  if (btn) btn.hidden = !$(BOX[target]).value;
}
for (const target of Object.keys(BOX)) {
  $(BOX[target]).addEventListener('input', () => paintClear(target));
  $(`[data-clear="${target}"]`).onclick = () => {
    if (dict && dict.target === target) stopDictation();
    const ta = $(BOX[target]);
    ta.value = '';
    paintClear(target);
    if (target === 'check') { checkDictated = false; $('#check-read').innerHTML = ''; }
    ta.focus();
  };
}

/* ============================================================
   PALABRA: "¿Qué es esto?" photo lookup
   ============================================================ */
function identSystem() {
  return `You identify what is in a photo for a Spanish learner who lives in ${C().en}, naming things the way people there say them.
${VARIETY()}
List the distinct objects, foods, dishes, drinks, animals, plants or places you can see, most prominent first, at most 8. Skip background filler (walls, floor, sky, a plain table) unless it is the point of the photo or the user asked about it.
Reply with JSON only, no prose, no code fences:
{"items":[{"word":str,"article":"el"|"la"|"los"|"las"|null,"general":str|null,"desc":str|null,"where":str|null,"unsure":bool}],"scene":str|null}
word: the term used in ${C().en}, singular unless the plural is the natural way to name it (papas fritas).
article: the definite article that goes with word; null for proper names.
general: the more widespread Spanish term only if it differs from word (fresa for frutilla); else null.
desc: for dishes, drinks, or anything a learner might not recognise, one short line in ${EXPL()}; else null.
where: a short position hint in ${EXPL()} only when needed to tell similar things apart ("the small round green one, front left"); else null.
unsure: true if you are not confident about the identification or the local name.
scene: one short sentence in ${EXPL()} describing the photo, or null.
If nothing is identifiable, reply {"items":[]}.`;
}
async function runIdentify(b64, focus) {
  const out = $('#word-out');
  loading(out, t('ident.working'));
  try {
    const d = await ask({
      system: identSystem(), maxTokens: 1600, photo: true,
      content: [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } },
                { type: 'text', text: focus ? `Focus on: ${focus}` : 'Name what you see.' }]
    });
    const items = (d.items || []).filter(x => x && x.word);
    if (!items.length) throw new Error(t('ident.none'));
    d.items = items;
    renderIdent(d, b64);
    addHistory({ id: 'ident:' + Date.now(), type: 'ident', key: items[0].word,
      label: items.map(x => x.word).join(', ').slice(0, 90), sub: d.scene || '', data: d });
  } catch (e) { failed(out, e); }
}
function renderIdent(d, b64) {
  const out = $('#word-out');
  const items = d.items || [];
  out.innerHTML = `<div class="card">
    ${b64 ? `<img class="thumb zoomable" src="data:image/jpeg;base64,${b64}" alt="${t('alt.photo')}">` : ''}
    ${d.scene ? `<p class="tr-src">${esc(d.scene)}</p>` : ''}
    ${items.map((x, i) => `<div class="ident">
      <div class="head">
        <div style="flex:1">
          <div class="iw">${x.article ? `<span class="art">${esc(x.article)}</span> ` : ''}${esc(x.word)}${x.unsure ? ` <span class="tag warn">${t('ident.unsure')}</span>` : ''}</div>
          ${x.general ? `<div class="ig">${t('ident.general')} ${esc(x.general)}</div>` : ''}
          ${x.desc ? `<div class="idesc">${esc(x.desc)}</div>` : ''}
          ${x.where ? `<div class="ig">${esc(x.where)}</div>` : ''}
        </div>
        ${sayBtn((x.article ? x.article + ' ' : '') + x.word)}<span data-istar="${i}"></span>
      </div>
      <button class="link" data-look="${i}">${t('ident.look')}</button>
    </div>`).join('')}
  </div>`;
  items.forEach((x, i) => {
    $(`[data-istar="${i}"]`, out).replaceWith(starBtn({ id: 'word:' + fold(x.word), type: 'word', key: x.word,
      label: x.word, sub: x.desc || x.general || '' }));
    $(`[data-look="${i}"]`, out).onclick = () => { window.scrollTo(0, 0); runWord(x.word); };
  });
}

/* ============================================================
   SETUP GUIDE (first launch with no key, or on request)
   ============================================================ */
const IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const STANDALONE = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
const PHONE = IOS || /Android/i.test(navigator.userAgent);
function appLink() { return location.origin + location.pathname; }
function qrSVG(text) {
  try { const q = qrcode(0, 'M'); q.addData(text); q.make(); return q.createSvgTag({ cellSize: 5, margin: 2, scalable: true }); }
  catch { return ''; }
}
/* opts.direct: skip the "open it on your phone" screen (used from Ajustes and the no-key button). */
function openGuide(opts = {}) {
  const g = $('#guide');
  const gate = !PHONE && !opts.direct;
  const install = PHONE && !STANDALONE() ? `<div class="gnote">${IOS ? t('g.installIos') : androidInstallText()}</div>` : '';
  $('#guide-body').innerHTML = `
    <div class="ghead"><h2>${t('g.title')}</h2>
      <button class="icon" id="g-close" aria-label="${t('g.close')}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
    ${gate ? `<div class="gdesk">
      <p>${t('g.desktop')}</p>
      <div class="gqr">${qrSVG(appLink())}</div>
      <p class="glink"><a href="${esc(appLink())}">${esc(appLink().replace(/^https?:\/\//, ''))}</a></p>
      <button class="link" id="g-anyway">${t('g.anyway')}</button>
    </div>` : ''}
    <div id="g-steps" ${gate ? 'hidden' : ''}>
    <p>${t('g.intro')}</p>
    ${install}
    <h3>${t('g.freeTitle')}</h3>
    <ol><li>${t('g.free1')}</li><li>${t('g.free2')}</li><li>${t('g.free3')}</li><li>${t('g.free4')}</li></ol>
    <p class="help warnnote">${t('set.geminiTip')}</p>
    <h3>${t('g.paidTitle')}</h3>
    <ol><li>${t('g.paid1')}</li><li>${t('g.paid2')}</li><li>${t('g.paid3')}</li><li>${t('g.paid4')}</li></ol>
    <label class="field-label" for="g-key">${t('g.paste')}</label>
    <input type="password" id="g-key" placeholder="AQ.…  /  sk-ant-…" autocomplete="off" autocapitalize="off" spellcheck="false">
    <div class="settings-row">
      <button class="primary" id="g-save">${t('g.saveTest')}</button>
      <button class="ghost" id="g-later">${t('g.later')}</button>
    </div>
    <p class="msg" id="g-status" hidden></p>
    <div class="settings-row"><button class="link" id="g-howto">${t('g.howto')}</button></div>
    </div>`;
  const anyway = $('#g-anyway');
  if (anyway) anyway.onclick = () => { $('#g-steps').hidden = false; anyway.hidden = true; $('#g-steps').scrollIntoView({ block: 'start', behavior: 'smooth' }); };
  g.hidden = false;
  document.body.style.overflow = 'hidden';
  $('#g-close').onclick = closeGuide;
  $('#g-later').onclick = closeGuide;
  $('#g-howto').onclick = () => { closeGuide(); S.moreTab = 'help'; saveSettings(); go('more', { focus: false }); paintSeg($('#more-seg'), 'help'); };
  $('#g-save').onclick = async () => {
    const v = $('#g-key').value.trim();
    const st = $('#g-status');
    if (!v) return toast(t('key.pasteFirst'));
    if (!KNOWN_KEY.test(v)) toast(t('key.unknown'));
    S.key = v; saveSettings();
    const b = $('#g-save'); b.disabled = true;
    st.hidden = false; st.className = 'msg'; st.innerHTML = `<span class="spinner"></span>${t('set.testing')}`;
    try {
      await ask({ system: 'Reply with JSON only.', content: 'Reply with {"ok":true}', maxTokens: 30 });
      st.textContent = t('g.ready');
      toast(t('key.works'));
      st.innerHTML = `${esc(t('g.ready'))} <button class="link" id="g-howto2">${t('g.howto')}</button>`;
      $('#g-howto2').onclick = () => $('#g-howto').click();
      $('#g-later').textContent = t('g.close');
    } catch (e) { st.className = 'msg err'; st.textContent = e.message || String(e); }
    b.disabled = false;
  };
}
function closeGuide() {
  $('#guide').hidden = true;
  document.body.style.overflow = '';
  S.guideSeen = true; saveSettings();
  if (S.view === 'more') renderMore(S.moreTab);
}

/* iPhone: fixed bars stay under the keyboard, so lift the tab bar above it. */
if (IOS && window.visualViewport) {
  const lift = () => {
    const kb = Math.max(0, window.innerHeight - visualViewport.height - visualViewport.offsetTop);
    $('.tabs').style.transform = kb > 80 ? `translateY(-${kb}px)` : '';
  };
  visualViewport.addEventListener('resize', lift);
  visualViewport.addEventListener('scroll', lift);
}

/* ============================================================
   INSTALL PROMPT (phones only, when opened in the browser)
   ============================================================ */
let installEvent = null;
let installDismissed = false;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();          // keep Chrome's mini-bar away; we show our own
  installEvent = e;
  paintInstall();
});
window.addEventListener('appinstalled', () => {
  installEvent = null;
  $('#installbar').hidden = true;
  toast(t('inst.done'));
});
const UA = navigator.userAgent;
const ANDROID_BROWSER = /Firefox|FxiOS/i.test(UA) ? 'firefox' : /SamsungBrowser/i.test(UA) ? 'samsung'
  : /EdgA|OPR|Opera|Brave|DuckDuckGo|YaBrowser/i.test(UA) ? 'other' : 'chrome';
function androidInstallText() {
  if (ANDROID_BROWSER === 'chrome') return t('g.installAndroid');
  return t(ANDROID_BROWSER === 'firefox' ? 'inst.firefox' : 'inst.otherAndroid');
}
function paintInstall() {
  const bar = $('#installbar');
  const phone = IOS || /Android/i.test(navigator.userAgent);
  if (!phone || STANDALONE() || installDismissed) { bar.hidden = true; return; }
  const text = IOS ? t('inst.ios') : installEvent ? t('inst.android') : ANDROID_BROWSER === 'chrome' ? t('inst.androidManual') : androidInstallText();
  bar.innerHTML = `
    <img src="icons/icon-192.png" alt="" width="36" height="36">
    <p>${text}</p>
    <div class="ib-actions">
      ${!IOS && installEvent ? `<button class="primary" id="ib-go">${t('inst.btn')}</button>` : ''}
      <button class="icon small" id="ib-x" aria-label="${t('inst.close')}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
    </div>`;
  bar.hidden = false;
  $('#ib-x').onclick = () => { installDismissed = true; bar.hidden = true; };
  const go = $('#ib-go');
  if (go) go.onclick = async () => {
    const ev = installEvent; if (!ev) return;
    ev.prompt();
    try { await ev.userChoice; } catch {}
    // Accepted or declined, the native prompt is spent; don't nag again this session.
    installEvent = null;
    installDismissed = true;
    bar.hidden = true;
  };
}

/* ============================================================
   DICTATION (Chrome speech recognition, free, needs signal)
   ============================================================ */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const ANDROID = /Android/i.test(navigator.userAgent);
let dict = null;          // { target, rec, want, lastHeard, langs }
let checkDictated = false;
let trMicLang = 'es';     // resets to Spanish every time the app opens

function paintMics() {
  $$('[data-mic]').forEach(b => {
    const on = !!dict && dict.target === b.dataset.mic;
    b.classList.toggle('live', on);
    b.setAttribute('aria-label', on ? t('aria.stopDictate') : t('aria.dictate'));
  });
}
function showInterim(target, text) {
  const el = $('#' + target + '-interim');
  el.textContent = text;
  el.hidden = !text;
}
function appendDictated(target, text) {
  const ta = $(BOX[target]);
  text = text.trim();
  if (!text) return;
  const cur = ta.value;
  ta.value = cur + (cur && !/\s$/.test(cur) ? ' ' : '') + text;
  paintClear(target);
  if (target === 'check') checkDictated = true;
}
function startDictation(target) {
  if (!SR) { $(BOX[target]).focus(); return toast(t('dict.unsupported')); }
  if (dict) { const same = dict.target === target; stopDictation(); if (same) return; }
  const langs = target === 'tr' && trMicLang === 'en' ? ['en-US'] : [...new Set([C().loc, 'es-419', 'es-ES'])];
  const d = { target, want: true, lastHeard: Date.now(), langs };
  dict = d;
  const begin = () => {
    const rec = new SR();
    d.rec = rec;
    rec.lang = d.langs[0];
    // Android Chrome repeats text in continuous mode, so there we listen one
    // phrase at a time and restart; elsewhere continuous mode is fine.
    rec.continuous = IOS || !ANDROID;
    rec.interimResults = true;
    rec.onresult = e => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) appendDictated(target, r[0].transcript);
        else interim += r[0].transcript;
      }
      showInterim(target, interim);
      d.lastHeard = Date.now();
    };
    rec.onerror = e => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        d.want = false;
        if (IOS) { toast(t('dict.iosFallback')); setTimeout(() => $(BOX[target]).focus(), 50); }
        else toast(t('dict.perm'));
      }
      else if (e.error === 'network') { d.want = false; toast(t('dict.net')); }
      else if (e.error === 'language-not-supported' && d.langs.length > 1) d.langs.shift();
    };
    rec.onend = () => {
      showInterim(target, '');
      if (dict !== d) return;
      if (d.want && !IOS && Date.now() - d.lastHeard < 60000) {
        try { begin(); return; } catch {}
      }
      if (d.want && !IOS && Date.now() - d.lastHeard >= 60000) toast(t('dict.silence'));
      dict = null; paintMics();
    };
    rec.start();
  };
  try { begin(); } catch { dict = null; toast(t('dict.fail')); }
  paintMics();
}
function stopDictation() {
  if (!dict) return;
  const d = dict;
  dict = null;
  d.want = false;
  try { d.rec && d.rec.stop(); } catch {}
  showInterim(d.target, '');
  paintMics();
}
$$('[data-mic]').forEach(b => b.onclick = () => startDictation(b.dataset.mic));
$('#tr-miclang').onclick = () => {
  trMicLang = trMicLang === 'es' ? 'en' : 'es';
  const b = $('#tr-miclang');
  b.textContent = trMicLang.toUpperCase();
  b.setAttribute('aria-label', t('aria.miclang', trMicLang));
  if (dict && dict.target === 'tr') { stopDictation(); startDictation('tr'); }
  toast(t('dict.lang', trMicLang));
};

/* ============================================================
   BOOT
   ============================================================ */
applyI18n();
$('#tr-miclang').setAttribute('aria-label', t('aria.miclang', trMicLang));
paintDir();
paintClear('tr'); paintClear('check');
if (!SR) $('#tr-miclang').hidden = true;   // mic stays: it points to the keyboard's mic
seg($('#more-seg'), S.moreTab, v => { S.moreTab = v; saveSettings(); renderMore(v); });
go(VIEWS.includes(location.hash.slice(1)) ? location.hash.slice(1) : S.view, { focus: false });
if (!S.key && !S.guideSeen) setTimeout(openGuide, 300);
paintInstall();
runConj();
loadVerbs();

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
