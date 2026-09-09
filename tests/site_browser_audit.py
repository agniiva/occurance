"""Audit all generated public HTML, excluding the separate CMS and redirects."""
import json
import os
import urllib.request
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright

REPO = Path(__file__).resolve().parents[1]
ROOT = Path(os.environ.get('PREVIEW_BUILD_DIR', str(REPO / 'public')))
OUT = Path(os.environ.get('PREVIEW_ARTIFACTS', str(REPO / '.artifacts')))
OUT.mkdir(parents=True, exist_ok=True)
BASE = os.environ.get('PREVIEW_URL', 'http://127.0.0.1:8768')
manifest = []
for path in sorted(ROOT.rglob('*.html')):
    relative = path.relative_to(ROOT).as_posix()
    text = path.read_text()
    if relative.startswith('admin/') or 'http-equiv="refresh"' in text or 'http-equiv=refresh' in text:
        continue
    route = '/' + relative.removesuffix('index.html') if relative.endswith('index.html') else '/' + relative
    manifest.append({'file':relative,'route':route})
(OUT/'public-pages.json').write_text(json.dumps(manifest,indent=2))
rows=[]
links=set()
errors=[]
with sync_playwright() as p:
    browser=p.chromium.launch(channel='chrome',headless=True)
    page=browser.new_page(viewport={'width':1440,'height':1000})
    page.on('pageerror',lambda e:errors.append(str(e)))
    for item in manifest:
        route=item['route']
        for width in [1440,320]:
            page.set_viewport_size({'width':width,'height':1000})
            response=page.goto(BASE+route,wait_until='load')
            page.evaluate('document.fonts.ready')
            assert response.status==200,(route,response.status)
            assert page.locator('h1').count()==1,route
            assert page.locator('nav[aria-label="Primary"] a').count()==5,route
            assert page.locator('.social-links a').count()==4,route
            assert page.locator('.channel-overlay').count()==1,route
            assert page.evaluate('document.documentElement.scrollWidth===innerWidth'),(route,width)
            body=page.locator('body').inner_text()
            assert 'A personal website' not in body
            assert page.locator('h1').evaluate('(e)=>getComputedStyle(e).animationName')=='none'
            if width==1440:
                for href in page.locator('a[href]').evaluate_all('(els)=>els.map(e=>e.getAttribute("href"))'):
                    if href.startswith('/'):
                        links.add(urlsplit(href).path)
                if route in ['/writing/','/about/','/links/','/writing/no-map/']:
                    page.screenshot(path=str(OUT/('page-'+route.strip('/').replace('/','-')+'.png')))
            rows.append({'route':route,'width':width,'status':'passed'})
    assert not errors,errors
    # Inspect the real channel-close composition at its midpoint without leaving.
    page.set_viewport_size({'width':1440,'height':1000})
    page.goto(BASE,wait_until='networkidle')
    page.evaluate('''()=>{
      document.documentElement.classList.add('channel-leaving');
      document.getAnimations().forEach(a=>{a.pause();a.currentTime=165});
    }''')
    page.screenshot(path=str(OUT/'channel-midpoint.png'))
    browser.close()
for path in sorted(links):
    assert urllib.request.urlopen(BASE+path).status==200,path
report={'public_page_count':len(manifest),'viewport_checks':len(rows),'internal_link_count':len(links),'errors':errors,'checks':rows}
(OUT/'all-pages-audit.json').write_text(json.dumps(report,indent=2))
print(json.dumps({k:v for k,v in report.items() if k!='checks'},indent=2))
