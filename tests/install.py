import subprocess, sys, time
from playwright.sync_api import sync_playwright
import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SC = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out'); os.makedirs(SC, exist_ok=True)
os.chdir(os.path.dirname(os.path.abspath(__file__)))

srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8767', '-d', ROOT], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
errors = []
KEY = "localStorage.setItem('vos.settings', JSON.stringify({key:'sk-ant-x', guideSeen:true}));"
with sync_playwright() as p:
    b = p.chromium.launch()
    # Android, Chrome has not offered install yet -> manual instructions
    a = b.new_context(**p.devices['Pixel 7'], locale='es-UY'); a.add_init_script(KEY)
    pg = a.new_page(); pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.goto('http://localhost:8767/'); pg.wait_for_timeout(1000)
    assert pg.is_visible('#installbar') and 'Agregar a la pantalla principal' in pg.inner_text('#installbar')
    assert pg.query_selector('#ib-go') is None
    # Chrome offers install -> one-tap button that calls prompt()
    pg.evaluate("""() => { const e = new Event('beforeinstallprompt'); window.__prompted = 0;
      e.prompt = () => { window.__prompted++; }; e.userChoice = Promise.resolve({outcome:'accepted'}); window.dispatchEvent(e); }""")
    pg.wait_for_timeout(150)
    assert 'se abre al toque' in pg.inner_text('#installbar') and pg.is_visible('#ib-go')
    pg.screenshot(path=f'{SC}/i-android-install.png')
    pg.click('#ib-go'); pg.wait_for_timeout(200)
    assert pg.evaluate('window.__prompted') == 1 and not pg.is_visible('#installbar')
    # dismiss works; English follows the app language
    pg.reload(); pg.wait_for_timeout(800); assert pg.is_visible('#installbar')
    pg.click('#ib-x'); assert not pg.is_visible('#installbar')
    # iPhone in Safari -> Share instructions
    i = b.new_context(**p.devices['iPhone 13'], locale='es-UY'); i.add_init_script(KEY)
    ip = i.new_page(); ip.on('pageerror', lambda e: errors.append(str(e)))
    ip.goto('http://localhost:8767/'); ip.wait_for_timeout(1000)
    assert 'Agregar a inicio' in ip.inner_text('#installbar') and ip.query_selector('#ib-go') is None
    ip.screenshot(path=f'{SC}/j-iphone-install.png')
    # iPhone already installed (home screen) -> nothing
    j = b.new_context(**p.devices['iPhone 13'], locale='es-UY'); j.add_init_script(KEY + "Object.defineProperty(navigator,'standalone',{get:()=>true});")
    jp = j.new_page(); jp.goto('http://localhost:8767/'); jp.wait_for_timeout(800)
    assert not jp.is_visible('#installbar')
    # English interface
    e = b.new_context(**p.devices['iPhone 13'], locale='en-US'); e.add_init_script("localStorage.setItem('vos.settings', JSON.stringify({key:'sk-ant-x', guideSeen:true, ui:'en'}));")
    ep = e.new_page(); ep.goto('http://localhost:8767/'); ep.wait_for_timeout(800)
    assert 'Add to Home Screen' in ep.inner_text('#installbar')
    # desktop -> nothing
    d = b.new_context(viewport={'width': 1200, 'height': 800}); d.add_init_script(KEY)
    dp = d.new_page(); dp.goto('http://localhost:8767/'); dp.wait_for_timeout(800)
    assert not dp.is_visible('#installbar')
    b.close()
srv.terminate()
print('errors:', errors); print('INSTALL PASS' if not errors else 'ERRORS')
