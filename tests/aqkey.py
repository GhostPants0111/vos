import json, subprocess, sys, time
from playwright.sync_api import sync_playwright
import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SC = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out'); os.makedirs(SC, exist_ok=True)
os.chdir(os.path.dirname(os.path.abspath(__file__)))

srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8768', '-d', ROOT], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
hits = {'anthropic': 0, 'gemini_header': 0, 'gemini_query': 0}
MODE = {'refuse_header': False}
def anth(route):
    hits['anthropic'] += 1
    route.fulfill(status=401, content_type='application/json', headers={'access-control-allow-origin': '*'}, body='{"error":{"message":"invalid x-api-key"}}')
def gem(route):
    req = route.request
    if '?key=' in req.url: hits['gemini_query'] += 1
    else: hits['gemini_header'] += 1
    if MODE['refuse_header'] and '?key=' not in req.url:
        return route.fulfill(status=401, content_type='application/json', headers={'access-control-allow-origin': '*'}, body='{"error":{"message":"ACCESS_TOKEN_TYPE_UNSUPPORTED"}}')
    route.fulfill(status=200, content_type='application/json', headers={'access-control-allow-origin': '*'},
                  body=json.dumps({"candidates": [{"content": {"parts": [{"text": '{"ok":true}'}]}, "finishReason": "STOP"}]}))
errors = []
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_context(**p.devices['Pixel 7'], locale='es-UY').new_page()
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.route('https://api.anthropic.com/**', anth); pg.route('https://generativelanguage.googleapis.com/**', gem)
    pg.goto('http://localhost:8768/'); pg.wait_for_timeout(1000)
    assert 'AQ.' in pg.inner_text('#guide-body')
    pg.fill('#g-key', 'AQ.Ab8RN6Ltest-key_123'); pg.click('#g-save'); pg.wait_for_timeout(900)
    assert 'Listo' in pg.inner_text('#g-status'), pg.inner_text('#g-status')
    assert hits['anthropic'] == 0 and hits['gemini_header'] == 1, hits
    # if Google ever refuses the header form, it retries with ?key=
    MODE['refuse_header'] = True
    pg.click('#g-save'); pg.wait_for_timeout(900)
    assert 'Listo' in pg.inner_text('#g-status') and hits['gemini_query'] == 1, hits
    pg.click('#g-later')
    pg.click('.tabs [data-go=more]'); pg.click('#more-seg button[data-v=settings]'); pg.wait_for_timeout(150)
    assert 'Gemini (Google)' in pg.inner_text('#more-body')
    b.close()
srv.terminate()
print('errors:', errors); print('AQ PASS' if not errors else 'ERRORS')
