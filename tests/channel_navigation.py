"""Browser acceptance test. Run against the local built preview:
uv run --with playwright python tests/channel_navigation.py
"""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = os.environ.get('PREVIEW_URL', 'http://127.0.0.1:8768')
OUT = Path(os.environ.get('PREVIEW_ARTIFACTS', str(Path(__file__).resolve().parents[1] / '.artifacts')))

with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    page = browser.new_page(viewport={'width':1440,'height':1000})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.add_init_script('''new MutationObserver(()=>{
      if(document.documentElement.classList.contains('channel-entering')) window.sawChannelEntry=true;
    }).observe(document,{subtree:true,attributes:true,attributeFilter:['class']});''')
    page.goto(BASE, wait_until='networkidle')
    # Vercel strips trailing slashes; the entry marker must survive this.
    page.evaluate("sessionStorage.setItem('agniva:next-channel', '/about')")
    page.goto(BASE+'/about/', wait_until='domcontentloaded')
    assert page.evaluate('window.sawChannelEntry === true'), 'Entry should tolerate canonical trailing-slash redirects'
    page.wait_for_function('!document.documentElement.classList.contains("channel-entering")')
    leaving = page.evaluate('''()=>{
      document.querySelector('nav a[href="/writing/"]').click();
      return document.documentElement.classList.contains('channel-leaving');
    }''')
    assert leaving, 'Normal navigation should start the TV closing animation'
    page.wait_for_url(BASE+'/writing/')
    page.wait_for_load_state('domcontentloaded')
    assert page.evaluate('window.sawChannelEntry === true'), 'Next page should open as a new channel'
    page.wait_for_function('!document.documentElement.classList.contains("channel-entering")')
    assert page.locator('nav a[aria-current="page"]').inner_text() == 'Writing'
    page.locator('.writing-list a').first.click()
    page.wait_for_url('**/writing/no-map/')
    page.wait_for_function('!document.documentElement.classList.contains("channel-entering")')
    assert page.locator('h1').inner_text() == 'No Map'
    page.go_back(wait_until='domcontentloaded')
    assert not page.evaluate('document.documentElement.classList.contains("channel-leaving")')

    # These links must retain native browser behavior. A final test-only listener
    # cancels their default action after observing whether our handler did so.
    page.goto(BASE,wait_until='networkidle')
    exemptions = page.evaluate('''()=>{
      const cases=[{href:'/about/',metaKey:true},{href:'/about/',ctrlKey:true},
        {href:'/about/',shiftKey:true},{href:'/about/',altKey:true},
        {href:'/about/',button:1},{href:'/about/',target:'_blank'},
        {href:'/about/',download:'copy.html'}, {href:'mailto:agniva@cows.wtf'},
        {href:'#main'},{href:'/atom.xml'},{href:'/admin/'}];
      return cases.map(c=>{
        const a=document.createElement('a'); a.href=c.href;
        if(c.target) a.target=c.target;
        if(c.download) a.download=c.download;
        document.body.append(a); let intercepted;
        document.addEventListener('click',e=>{intercepted=e.defaultPrevented;e.preventDefault()},{once:true});
        a.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,...c}));
        a.remove(); return {case:c,intercepted};
      });
    }''')
    assert all(not row['intercepted'] for row in exemptions), exemptions
    assert not page.evaluate('document.documentElement.classList.contains("channel-leaving")')

    # Keyboard navigation follows the same transition.
    page.locator('nav a[href="/about/"]').focus()
    page.keyboard.press('Enter')
    page.wait_for_url(BASE+'/about/')
    assert page.locator('h1').inner_text() == 'About'
    page.wait_for_function('!document.documentElement.classList.contains("channel-entering")')
    page.locator('#pause-effects').check()
    assert page.evaluate('localStorage.getItem("agniva:effects-paused")') == '1'
    paused = page.evaluate('''()=>{document.querySelector('nav a[href="/links/"]').click();return document.documentElement.classList.contains('channel-leaving')}''')
    assert not paused
    page.wait_for_url(BASE+'/links/')
    assert page.locator('#pause-effects').is_checked()
    page.locator('#pause-effects').uncheck()
    page.emulate_media(reduced_motion='reduce')
    reduced = page.evaluate('''()=>{document.querySelector('nav a[href="/writing/"]').click();return document.documentElement.classList.contains('channel-leaving')}''')
    assert not reduced
    page.wait_for_url(BASE+'/writing/')
    assert not errors, errors

    nojs = browser.new_context(java_script_enabled=False).new_page()
    nojs.goto(BASE)
    nojs.locator('nav a[href="/about/"]').click()
    nojs.wait_for_url(BASE+'/about/')
    assert nojs.locator('h1').is_visible()
    browser.close()

report={'normal_navigation':'passed','entry_animation':'passed','article_navigation':'passed',
        'back_navigation':'passed','keyboard_navigation':'passed','pause_persistence':'passed',
        'reduced_motion':'passed','no_javascript':'passed','exemptions':exemptions,'errors':errors}
OUT.mkdir(parents=True, exist_ok=True)
(OUT/'channel-tests.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
