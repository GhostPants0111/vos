import subprocess, sys, time
from playwright.sync_api import sync_playwright
import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SC = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out'); os.makedirs(SC, exist_ok=True)
os.chdir(os.path.dirname(os.path.abspath(__file__)))

srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8769', '-d', ROOT], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
errors = []
with sync_playwright() as p:
    b = p.chromium.launch()
    # computer, English
    d = b.new_context(viewport={'width': 1200, 'height': 900}, locale='en-US').new_page()
    d.on('pageerror', lambda e: errors.append(str(e)))
    d.goto('http://localhost:8769/'); d.wait_for_timeout(1000)
    t = d.inner_text('#guide-body')
    assert 'made for your phone' in t and 'localhost:8769/' in t and d.query_selector('.gqr svg') is not None, t
    assert not d.is_visible('#g-steps') and 'Conjugate already works' not in t
    assert 'Add to Home screen' not in t, 'no Android steps on a computer'
    d.screenshot(path=f'{SC}/k-desktop.png')
    d.click('#g-anyway'); d.wait_for_timeout(300)
    assert d.is_visible('#g-steps') and "it's free" in d.inner_text('#g-steps') and not d.is_visible('#g-anyway')
    assert 'Add to Home screen' not in d.inner_text('#g-steps')
    d.screenshot(path=f'{SC}/l-desktop-anyway.png')
    # from Settings on a computer: straight to the steps
    d.click('#g-later'); d.click('.tabs [data-go=more]'); d.click('#more-seg button[data-v=settings]'); d.wait_for_timeout(150)
    d.click('#open-guide'); d.wait_for_timeout(200)
    assert d.is_visible('#g-steps') and d.query_selector('.gqr') is None
    # phone: no QR, install note + new intro
    a = b.new_context(**p.devices['Pixel 7'], locale='es-UY').new_page()
    a.on('pageerror', lambda e: errors.append(str(e)))
    a.goto('http://localhost:8769/'); a.wait_for_timeout(1000)
    t = a.inner_text('#guide-body')
    assert a.query_selector('.gqr') is None and 'Para que Vos funcione' in t and 'Agregar a la pantalla principal' in t and 'Conjugar ya funciona' not in t, t[:300]
    a.screenshot(path=f'{SC}/m-phone-guide.png')
    b.close()
srv.terminate()
print('errors:', errors); print('DESK PASS' if not errors else 'ERRORS')
