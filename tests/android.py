import json, subprocess, time, sys
from playwright.sync_api import sync_playwright

import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SC = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out'); os.makedirs(SC, exist_ok=True)
os.chdir(os.path.dirname(os.path.abspath(__file__)))

srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8766', '-d', ROOT], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
_src = open('smoke.py').read()
exec(_src[_src.index('MOCKS = {'):_src.index('errors = []')])
errors = []
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(**p.devices['Pixel 7'], locale='es-UY'); ctx.add_init_script(FAKE_SR)
    pg = ctx.new_page(); pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.route('https://api.anthropic.com/**', handle)
    pg.goto('http://localhost:8766/'); pg.wait_for_timeout(1200)
    assert 'Agregar a la pantalla principal' in pg.inner_text('#guide-body')
    pg.fill('#g-key', 'sk-ant-test'); pg.click('#g-save'); pg.wait_for_timeout(800); pg.click('#g-later'); pg.wait_for_timeout(100)
    # dictation keeps listening on Android (restart loop, one phrase at a time)
    pg.click('.tabs [data-go=check]'); pg.evaluate("window.__phrases = ['ayer iba', 'al almacén']")
    pg.click('[data-mic=check]'); pg.wait_for_timeout(600)
    assert pg.evaluate('window.__lastCont') is False and pg.evaluate('window.__srStarts') >= 3
    assert pg.input_value('#check-q') == 'ayer iba al almacén' and 'live' in pg.get_attribute('[data-mic=check]', 'class')
    pg.click('[data-mic=check]'); pg.wait_for_timeout(200)
    # camera, gallery, photo read, photo lookup, translate photo
    ins = pg.query_selector_all('#view-check input[data-img]'); ins[0].set_input_files('note.jpg'); pg.wait_for_timeout(300)
    pg.wait_for_timeout(900)
    assert pg.input_value('#check-q').startswith('Ayer iba al almacen')
    pg.click('.tabs [data-go=word]'); pg.query_selector_all('#view-word input[data-img]')[0].set_input_files('note.jpg'); pg.wait_for_timeout(300)
    pg.click('#word-stage [data-send]'); pg.wait_for_timeout(600); assert 'chivito' in pg.inner_text('#word-out')
    pg.click('.tabs [data-go=tr]'); pg.query_selector_all('#view-tr input[data-img]')[1].set_input_files('note.jpg'); pg.wait_for_timeout(300)
    pg.wait_for_timeout(900); assert 'ómnibus' in pg.inner_text('#tr-out')
    assert pg.get_attribute('.tabs', 'style') in (None, ''), 'iPhone keyboard lift must not run on Android'
    pg.click('.tabs [data-go=conj]'); pg.fill('#conj-q', 'decir'); pg.wait_for_timeout(400); assert 'decís' in pg.inner_text('#conj-out')
    b.close()
srv.terminate()
print('errors:', errors); print('ANDROID PASS' if not errors else 'ERRORS')
