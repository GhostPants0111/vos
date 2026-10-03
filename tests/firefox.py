import subprocess, sys, time
from playwright.sync_api import sync_playwright
import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SC = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out'); os.makedirs(SC, exist_ok=True)
os.chdir(os.path.dirname(os.path.abspath(__file__)))

srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8771', '-d', ROOT], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
FF_UA = 'Mozilla/5.0 (Android 14; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0'
NO_SR = "delete window.SpeechRecognition; delete window.webkitSpeechRecognition; window.SpeechRecognition = undefined; window.webkitSpeechRecognition = undefined;"
KEY = "localStorage.setItem('vos.settings', JSON.stringify({key:'sk-ant-x', guideSeen:true}));"
errors = []
with sync_playwright() as p:
    b = p.chromium.launch()
    c = b.new_context(viewport={'width': 412, 'height': 860}, is_mobile=True, has_touch=True, user_agent=FF_UA, locale='es-UY')
    c.add_init_script(NO_SR + KEY)
    pg = c.new_page(); pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.goto('http://localhost:8771/'); pg.wait_for_timeout(900)
    t = pg.inner_text('#installbar')
    assert 'Firefox' in t and 'Chrome' in t and 'pantalla de inicio' in t, t
    pg.click('.tabs [data-go=check]'); pg.wait_for_timeout(100)
    assert pg.is_visible('[data-mic=check]'), 'mic should stay visible in Firefox'
    pg.click('[data-mic=check]'); pg.wait_for_timeout(200)
    assert 'micrófono del teclado' in pg.inner_text('#toast')
    assert pg.evaluate("document.activeElement.id") == 'check-q'
    pg.click('.tabs [data-go=tr]'); assert not pg.is_visible('#tr-miclang')
    pg.screenshot(path=f'{SC}/o-firefox.png')
    # fresh Firefox user sees Firefox steps in the guide too
    g = b.new_context(viewport={'width': 412, 'height': 860}, is_mobile=True, user_agent=FF_UA, locale='es-UY').new_page()
    g.goto('http://localhost:8771/'); g.wait_for_timeout(900)
    assert 'Firefox' in g.inner_text('#guide-body')
    b.close()
srv.terminate()
print('errors:', errors); print('FIREFOX PASS' if not errors else 'ERRORS')
