import json, subprocess, sys, time
from playwright.sync_api import sync_playwright
import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SC = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out'); os.makedirs(SC, exist_ok=True)
os.chdir(os.path.dirname(os.path.abspath(__file__)))

srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8770', '-d', ROOT], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
seen = []
BUSY = {'gemini-3.8-flash': 503}
def gem(route):
    model = route.request.url.split('/models/')[1].split(':')[0]
    seen.append(model)
    if model in BUSY:
        return route.fulfill(status=BUSY[model], content_type='application/json', headers={'access-control-allow-origin': '*'},
                             body='{"error":{"message":"The model is overloaded. Please try again later."}}')
    route.fulfill(status=200, content_type='application/json', headers={'access-control-allow-origin': '*'},
                  body=json.dumps({"candidates": [{"content": {"parts": [{"text": '{"ok":true}'}]}, "finishReason": "STOP"}]}))
errors = []
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_context(**p.devices['Pixel 7'], locale='es-UY').new_page()
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.route('https://generativelanguage.googleapis.com/**', gem)
    pg.goto('http://localhost:8770/'); pg.wait_for_timeout(1000)
    pg.fill('#g-key', 'AQ.testkey'); pg.click('#g-save'); pg.wait_for_timeout(1500)
    assert 'Listo' in pg.inner_text('#g-status'), pg.inner_text('#g-status')
    assert seen == ['gemini-3.8-flash', 'gemini-3.6-flash'], seen
    # next call goes straight to the model that worked
    seen.clear(); pg.click('#g-save'); pg.wait_for_timeout(900)
    assert seen == ['gemini-3.6-flash'], seen
    # everything busy -> clear "overloaded" message, no endless loop
    BUSY.update({m: 503 for m in ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite']})
    seen.clear(); pg.click('#g-save'); pg.wait_for_timeout(2500)
    msg = pg.inner_text('#g-status')
    assert 'saturada' in msg and '3.6-flash: 503' in msg and '3.5-flash-lite: 503' in msg and len(seen) <= 4, (seen, msg)
    # per-minute rate limit: stop after the first 429 instead of burning more requests
    BUSY.clear(); BUSY['gemini-3.8-flash'] = 429
    def gem429(route):
        seen.append(route.request.url.split('/models/')[1].split(':')[0])
        route.fulfill(status=429, content_type='application/json', headers={'access-control-allow-origin': '*'},
                      body='{"error":{"message":"Quota exceeded for metric: generate_content_free_tier_requests, limit: 10, GenerateRequestsPerMinutePerProjectPerModel-FreeTier"}}')
    pg.unroute('https://generativelanguage.googleapis.com/**'); pg.route('https://generativelanguage.googleapis.com/**', gem429)
    seen.clear(); pg.click('#g-save'); pg.wait_for_timeout(1200)
    msg = pg.inner_text('#g-status')
    assert len(seen) == 1 and 'límite gratis' in msg and 'PerMinute' in msg, (seen, msg)
    b.close()
srv.terminate()
print('errors:', errors); print('BUSY PASS' if not errors else 'ERRORS')
