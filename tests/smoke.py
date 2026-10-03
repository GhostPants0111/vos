"""Headless smoke test for Vos v1.5: mocked Claude + Gemini APIs, fake speech recognizer, Android and iPhone emulation."""
import json, subprocess, time, sys
from playwright.sync_api import sync_playwright

import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SC = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out'); os.makedirs(SC, exist_ok=True)
os.chdir(os.path.dirname(os.path.abspath(__file__)))

srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8765', '-d', ROOT],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)

MOCKS = {
    'The input is a PHOTO': {"read": "Ayer iba al almacen y compre [?] pan.", "unsure": 1, "corrected": "Ayer fui al almacén y compré pan.",
        "changes": [{"from": "iba", "to": "fui", "why": "Acción puntual: pretérito.", "kind": "error"},
                    {"from": "almacen", "to": "almacén", "why": "Lleva tilde.", "kind": "error"}], "pattern": "Tildes."},
    'lexicographer': {"query_lang": "es", "entries": [{"word": "campera", "gender": "la", "pos": "sustantivo",
        "verb_infinitive": None, "senses": [{"def": "prenda de abrigo", "example": "Llevá la campera.", "example_en": None}],
        "synonyms": ["abrigo"], "antonyms": [], "uruguay": "Chaqueta suena a España.", "careful": None,
        "roots": {"parts": [{"part": "campo", "meaning": "campo"}], "literal": None, "origin": None,
                  "family": [{"word": "campesino", "meaning": "persona del campo"}], "english": "camp", "false_friend": False}}]},
    'translator': {"source_lang": "en", "source_text": "Take the bus", "translation": "Tomate el ómnibus", "alternatives": [], "note": None},
    'transcribe text from a photo': {"text": "Ayer iba al almacen y compre pan.", "unsure": 1},
    'correct Spanish': {"corrected": "Ayer fui al almacén y compré pan.",
        "changes": [{"from": "iba", "to": "fui", "why": "Acción puntual: pretérito.", "kind": "error"}], "pattern": "Pretérito vs imperfecto."},
    'identify what is in a photo': {"scene": "Un plato de comida.", "items": [
        {"word": "chivito", "article": "el", "general": None, "desc": "Sándwich uruguayo de lomo con jamón, queso y huevo.", "where": None, "unsure": False},
        {"word": "papas fritas", "article": "las", "general": None, "desc": None, "where": None, "unsure": False},
        {"word": "morrón", "article": "el", "general": "pimiento", "desc": None, "where": "las tiras rojas", "unsure": True}]},
}
calls, gcalls = [], []

def reply(sp):
    for k, v in MOCKS.items():
        if k in sp: return json.dumps(v, ensure_ascii=False)
    return '{"ok":true}'

def handle(route):
    body = json.loads(route.request.post_data)
    c = body['messages'][0]['content']
    calls.append({'sys': body.get('system', ''), 'model': body['model'], 'image': isinstance(c, list),
                  'text': c if isinstance(c, str) else ' '.join(x.get('text', '') for x in c)})
    route.fulfill(status=200, content_type='application/json', headers={'access-control-allow-origin': '*'},
                  body=json.dumps({"content": [{"type": "text", "text": reply(body.get('system', ''))}]}))

def ghandle(route):
    body = json.loads(route.request.post_data)
    sp = body['systemInstruction']['parts'][0]['text']
    gcalls.append({'sys': sp, 'url': route.request.url, 'image': any('inlineData' in x for x in body['contents'][0]['parts'])})
    route.fulfill(status=200, content_type='application/json', headers={'access-control-allow-origin': '*'},
                  body=json.dumps({"candidates": [{"content": {"parts": [{"text": reply(sp)}]}, "finishReason": "STOP"}]}))

FAKE_SR = """
window.__srStarts = 0;
class FakeSR {
  constructor(){ this.lang=''; this.continuous=false; this.interimResults=false; }
  start(){
    window.__srStarts++; window.__lastLang = this.lang; window.__lastCont = this.continuous;
    const phrase = (window.__phrases || []).shift();
    setTimeout(() => {
      if (phrase) this.onresult && this.onresult({ resultIndex: 0, results: [{ 0: { transcript: phrase }, isFinal: true, length: 1 }] });
      this.onend && this.onend();
    }, 60);
  }
  stop(){ setTimeout(() => this.onend && this.onend(), 10); }
}
window.webkitSpeechRecognition = FakeSR; window.SpeechRecognition = FakeSR;
"""

errors = []
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 400, 'height': 860}, device_scale_factor=2, is_mobile=True, has_touch=True, locale='es-UY', user_agent=p.devices['Pixel 7']['user_agent'])
    ctx.add_init_script(FAKE_SR)
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.on('console', lambda m: m.type == 'error' and errors.append(m.text))
    pg.route('https://api.anthropic.com/**', handle)
    pg.route('https://generativelanguage.googleapis.com/**', ghandle)
    pg.goto('http://localhost:8765/')
    pg.wait_for_timeout(1500)

    # #17 setup guide on first launch
    assert pg.is_visible('#guide'), 'guide should open with no key'
    t = pg.inner_text('#guide-body')
    assert 'Bienvenido' in t and 'aistudio.google.com' in t and 'Agregar a la pantalla principal' in t, t[:500]
    pg.screenshot(path=f'{SC}/a-guide.png', full_page=True)
    pg.fill('#g-key', 'sk-ant-test'); pg.click('#g-save'); pg.wait_for_timeout(800)
    assert 'Listo' in pg.inner_text('#g-status') and pg.inner_text('#g-later') == 'Cerrar'
    pg.click('#g-howto2'); pg.wait_for_timeout(300)
    assert not pg.is_visible('#guide') and pg.is_visible('#view-more')
    t = pg.inner_text('#more-body')
    assert 'cuatro herramientas' in t and 'Exigime' in t and pg.get_attribute('#more-seg button[data-v=help]', 'aria-checked') == 'true', t[:300]
    pg.screenshot(path=f'{SC}/e-help.png', full_page=True)
    pg.click('[data-try=conj]'); pg.wait_for_timeout(500)
    assert pg.input_value('#conj-q') == 'dijeran' and 'de decir' in pg.inner_text('#conj-out')
    pg.click('#mood-seg button[data-v=ind]')   # mood is sticky; reset for the checks below
    pg.click('.tabs [data-go=more]'); pg.wait_for_timeout(100)
    pg.click('[data-try=check]'); pg.wait_for_timeout(200)
    assert 'frutillas muy rica' in pg.input_value('#check-q') and pg.is_visible('[data-clear=check]')
    pg.click('.tabs [data-go=more]'); pg.click('#more-seg button[data-v=saved]'); pg.wait_for_timeout(100)
    assert calls and calls[-1]['model'] == 'claude-haiku-4-5'
    pg.reload(); pg.wait_for_timeout(1200)
    assert not pg.is_visible('#guide'), 'guide must not reopen once a key is saved'

    def conj(q):
        if not pg.is_visible('#conj-q'): pg.click('.tabs [data-go=conj]')
        pg.fill('#conj-q', q); pg.wait_for_timeout(450)
        return pg.inner_text('#conj-out')

    def set_country(k):
        pg.click('.tabs [data-go=more]'); pg.click('#more-seg button[data-v=settings]'); pg.wait_for_timeout(150)
        pg.select_option('#set-country', k); pg.wait_for_timeout(200)
        pg.click('.tabs [data-go=conj]')

    # Uruguay default
    t = conj('decir'); assert 'decís' in t and pg.query_selector('.vosbox') is not None
    rows = pg.evaluate("[...document.querySelector('#conj-body .tense').querySelectorAll('.frow .p')].map(e => e.textContent)")
    assert rows[:3] == ['yo', 'vos', 'tú'], rows

    # #16 countries
    pg.click('.tabs [data-go=more]'); pg.click('#more-seg button[data-v=settings]'); pg.wait_for_timeout(150)
    opts = pg.eval_on_selector_all('#set-country option', 'els => els.map(e => e.value)')
    assert opts[0] == 'UY' and len(opts) == 20 and 'US' not in opts, opts
    set_country('MX'); t = conj('decir')
    rows = pg.evaluate("[...document.querySelector('#conj-body .tense').querySelectorAll('.frow .p')].map(e => e.textContent)")
    assert 'vos' not in rows and rows[1] == 'tú' and pg.query_selector('.vosbox') is None, rows
    set_country('ES'); conj('decir')
    rows = pg.evaluate("[...document.querySelector('#conj-body .tense').querySelectorAll('.frow .p')].map(e => e.textContent)")
    assert 'vosotros' in rows and 'vos' not in rows, rows
    set_country('CL'); t = conj('hablar'); assert 'hablái' in t, t[:400]
    rows = pg.evaluate("[...document.querySelector('#conj-body .tense').querySelectorAll('.frow .p')].map(e => e.textContent)")
    assert rows[1] == 'tú' and 'tú (chileno)' in rows, rows
    t = conj('ser'); assert 'erís' in t
    set_country('BO'); conj('decir')
    rows = pg.evaluate("[...document.querySelector('#conj-body .tense').querySelectorAll('.frow .p')].map(e => e.textContent)")
    assert rows[1:3] == ['tú', 'vos'], rows
    pg.check('#opt-person', force=True); conj('decir')
    chips = pg.eval_on_selector_all('.pchip', 'els => els.map(e => e.dataset.p)')
    assert chips[1:3] == ['tu', 'vos'], chips
    pg.uncheck('#opt-person', force=True)
    set_country('AR')
    pg.click('.tabs [data-go=word]'); pg.fill('#word-q', 'campera'); pg.press('#word-q', 'Enter'); pg.wait_for_timeout(500)
    assert 'Argentine Spanish' in calls[-1]['sys'] and 'do not invent a local difference' in calls[-1]['sys']
    set_country('UY')
    pg.click('.tabs [data-go=word]'); pg.fill('#word-q', 'campera'); pg.press('#word-q', 'Enter'); pg.wait_for_timeout(500)
    assert 'Montevideo today' in calls[-1]['sys'] and 'ómnibus (bus)' in calls[-1]['sys']

    # #15 photo lookup on Palabra
    ins = pg.query_selector_all('#view-word input[data-img]')
    assert len(ins) == 2 and ins[0].get_attribute('capture') == 'environment'
    ins[1].set_input_files(f'note.jpg'); pg.wait_for_timeout(400)
    assert pg.is_visible('#word-focus')
    pg.fill('#word-focus', 'solo la comida')
    pg.click('#word-stage [data-send]'); pg.wait_for_timeout(700)
    assert calls[-1]['model'] == 'claude-sonnet-5-5' and calls[-1]['image'] and 'solo la comida' in calls[-1]['text']
    t = pg.inner_text('#word-out')
    assert 'chivito' in t and 'pimiento' in t and 'no estoy seguro' in t and 'Ver palabra' in t, t
    pg.screenshot(path=f'{SC}/b-ident.png', full_page=True)
    pg.click('[data-look="0"]'); pg.wait_for_timeout(500)
    assert calls[-1]['text'] == 'chivito' and 'lexicographer' in calls[-1]['sys']
    pg.click('.tabs [data-go=more]'); pg.click('#more-seg button[data-v=history]'); pg.wait_for_timeout(150)
    assert 'foto' in pg.inner_text('#more-body')

    # guide reachable from Settings, and from the no-key error
    pg.click('#more-seg button[data-v=settings]'); pg.wait_for_timeout(150)
    pg.click('#open-guide'); pg.wait_for_timeout(200); assert pg.is_visible('#guide')
    pg.click('#g-later'); pg.wait_for_timeout(100); assert not pg.is_visible('#guide')
    pg.click('#del-key'); pg.wait_for_timeout(100)
    pg.click('.tabs [data-go=tr]'); pg.fill('#tr-q', 'hola'); pg.click('#tr-go'); pg.wait_for_timeout(300)
    assert pg.is_visible('#tr-out [data-guide]'); pg.click('#tr-out [data-guide]'); pg.wait_for_timeout(200)
    assert pg.is_visible('#guide')
    pg.fill('#g-key', 'AIzaTestKey123'); pg.click('#g-save'); pg.wait_for_timeout(800)
    assert gcalls and 'gemini-3.8-flash' in gcalls[-1]['url']
    pg.click('#g-later'); pg.wait_for_timeout(100); assert not pg.is_visible('#guide')

    # Gemini also does the photo lookup
    pg.click('.tabs [data-go=word]')
    pg.query_selector_all('#view-word input[data-img]')[1].set_input_files(f'note.jpg'); pg.wait_for_timeout(300)
    pg.click('#word-stage [data-send]'); pg.wait_for_timeout(600)
    assert gcalls[-1]['image'] and 'identify' in gcalls[-1]['sys'] and 'chivito' in pg.inner_text('#word-out')

    # #23 one-step photo correction (Corregir) and translation (Traducir): no preview screen
    pg.click('.tabs [data-go=check]'); pg.wait_for_timeout(100)
    n0 = len(gcalls)
    pg.query_selector_all('#view-check input[data-img]')[0].set_input_files(f'note.jpg'); pg.wait_for_timeout(900)
    assert pg.query_selector('#check-stage .stage') is None, 'no preview screen on Corregir'
    assert len(gcalls) == n0 + 1 and gcalls[-1]['image'] and 'The input is a PHOTO' in gcalls[-1]['sys']
    assert pg.input_value('#check-q') == 'Ayer iba al almacen y compre [?] pan.'
    t = pg.inner_text('#check-out'); assert 'almacén' in t and 'Lleva tilde' in t and '[?]' not in t, t
    assert 'Si leí algo mal' in pg.inner_text('#check-read')
    pg.screenshot(path=f'{SC}/n-onestep.png', full_page=True)
    pg.click('#check-go'); pg.wait_for_timeout(600)
    assert '[?]' not in gcalls[-1].get('sys', '')  # sanity: retyped check is a normal text call
    pg.click('.tabs [data-go=tr]'); pg.wait_for_timeout(100)
    pg.query_selector_all('#view-tr input[data-img]')[1].set_input_files(f'note.jpg'); pg.wait_for_timeout(800)
    assert pg.query_selector('#tr-stage .stage') is None and 'ómnibus' in pg.inner_text('#tr-out')

    # English UI still fine
    pg.click('.tabs [data-go=more]'); pg.click('#more-seg button[data-v=settings]'); pg.wait_for_timeout(150)
    pg.click('#set-ui button[data-v=en]'); pg.wait_for_timeout(150)
    assert 'Country / variety' in pg.inner_text('#more-body')
    assert 'Correct' in pg.inner_text('.tabs') and 'Check' not in pg.inner_text('.tabs')
    pg.click('#more-seg button[data-v=help]'); pg.wait_for_timeout(100)
    assert 'four tools' in pg.inner_text('#more-body') and 'Try it' in pg.inner_text('#more-body')
    pg.click('#more-seg button[data-v=settings]'); pg.wait_for_timeout(100)
    pg.click('#set-ui button[data-v=es]'); pg.wait_for_timeout(100)

    # #18 iPhone emulation
    iphone = p.devices['iPhone 13']
    ictx = b.new_context(**iphone, locale='es-UY')
    ictx.add_init_script(FAKE_SR)
    ip = ictx.new_page()
    ip.on('pageerror', lambda e: errors.append('iphone: ' + str(e)))
    ip.route('https://api.anthropic.com/**', handle)
    ip.goto('http://localhost:8765/'); ip.wait_for_timeout(1200)
    assert 'Agregar a inicio' in ip.inner_text('#guide-body'), 'iPhone install hint missing'
    ip.screenshot(path=f'{SC}/c-iphone-guide.png')
    ip.click('#g-later'); ip.wait_for_timeout(100)
    for inp in ip.query_selector_all('input[data-img]'):
        assert inp.get_attribute('hidden') is None and 'vh' in inp.get_attribute('class')
    ip.click('.tabs [data-go=check]'); ip.wait_for_timeout(100)
    ip.evaluate("window.__phrases = ['hola', 'segunda frase']")
    ip.click('[data-mic=check]'); ip.wait_for_timeout(500)
    assert ip.evaluate('window.__srStarts') == 1, 'iPhone must not auto-restart the mic'
    assert ip.evaluate('window.__lastCont') is True
    assert ip.input_value('#check-q') == 'hola'
    assert 'live' not in ip.get_attribute('[data-mic=check]', 'class')
    ip.screenshot(path=f'{SC}/d-iphone-check.png')

    # fresh English phone still defaults to Uruguay, in English
    e = b.new_context(viewport={'width': 400, 'height': 860}, locale='en-US').new_page()
    e.goto('http://localhost:8765/'); e.wait_for_timeout(900)
    assert 'Welcome to Vos' in e.inner_text('#guide-body') and 'Conjugate' in e.inner_text('.tabs')
    b.close()

srv.terminate()
print('Claude calls:', [(c['model'][7:13], 'img' if c['image'] else 'txt', c['sys'][:28]) for c in calls])
print('Gemini calls:', [('img' if c['image'] else 'txt', c['sys'][:28]) for c in gcalls])
print('errors:', errors)
print('ALL PASS' if not errors else 'ERRORS')
