"""#25 tab hints: visible on an empty tab, hidden with input, photo or result; back when cleared with no result."""
import json, subprocess, time, sys
from playwright.sync_api import sync_playwright
import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SC = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out'); os.makedirs(SC, exist_ok=True)
os.chdir(os.path.dirname(os.path.abspath(__file__)))

srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8772', '-d', ROOT], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
TR = {"source_lang": "en", "source_text": "Take the bus", "translation": "Tomate el ómnibus", "alternatives": [], "note": None}
def handle(route):
    route.fulfill(status=200, content_type='application/json', headers={'access-control-allow-origin': '*'},
                  body=json.dumps({"content": [{"type": "text", "text": json.dumps(TR)}]}))
errors = []
try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        ctx = b.new_context(viewport={'width': 400, 'height': 860}, is_mobile=True, has_touch=True, locale='es-UY', user_agent=p.devices['Pixel 7']['user_agent'])
        pg = ctx.new_page()
        pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.route('https://api.anthropic.com/**', handle)
        pg.goto('http://localhost:8772/'); pg.wait_for_timeout(1200)
        pg.fill('#g-key', 'sk-ant-test'); pg.click('#g-save'); pg.wait_for_timeout(600); pg.click('#g-later')
        vis = lambda k: pg.is_visible(f'#{k}-hint')
        for k in ['word', 'tr', 'check']:
            pg.click(f'.tabs [data-go={k}]'); pg.wait_for_timeout(150)
            assert vis(k), k
        assert 'sacale una foto a algo' in pg.inner_text('#word-hint'), pg.inner_text('#word-hint')
        # Palabra: typing hides, clearing restores
        pg.click('.tabs [data-go=word]'); pg.fill('#word-q', 'cam'); pg.wait_for_timeout(100)
        assert not vis('word')
        pg.fill('#word-q', ''); pg.wait_for_timeout(100)
        assert vis('word')
        # Traducir: typing hides; result keeps it hidden after clearing the box
        pg.click('.tabs [data-go=tr]'); pg.fill('#tr-q', 'Take the bus'); pg.wait_for_timeout(100)
        assert not vis('tr')
        pg.screenshot(path=f'{SC}/p-hint-typed.png')
        pg.click('#tr-go'); pg.wait_for_timeout(600)
        assert 'ómnibus' in pg.inner_text('#tr-out')
        pg.click('[data-clear=tr]'); pg.wait_for_timeout(100)
        assert not vis('tr'), 'result still showing, hint should stay hidden'
        # Corregir: try-example fill hides it
        pg.click('.tabs [data-go=check]'); pg.wait_for_timeout(100)
        pg.screenshot(path=f'{SC}/p-hint-check.png')
        pg.fill('#check-q', 'hola'); pg.wait_for_timeout(100); assert not vis('check')
        pg.click('[data-clear=check]'); pg.wait_for_timeout(100); assert vis('check')
        # English UI
        pg.evaluate("S.ui='en'; refreshLanguage()"); pg.wait_for_timeout(200)
        t = pg.inner_text('#check-hint'); assert 'Push me' in t and '<b>' not in t, t
        pg.screenshot(path=f'{SC}/p-hint-en.png')
        assert not errors, errors
        print('hints OK')
finally:
    srv.terminate()
