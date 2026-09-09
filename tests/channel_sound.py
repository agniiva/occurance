import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE=os.environ.get('PREVIEW_URL', 'http://127.0.0.1:8768')
OUT=Path(os.environ.get('PREVIEW_ARTIFACTS', str(Path(__file__).resolve().parents[1] / '.artifacts')))
OUT.mkdir(parents=True, exist_ok=True)
with sync_playwright() as p:
    browser=p.chromium.launch(channel='chrome',headless=True)
    page=browser.new_page(viewport={'width':1440,'height':1000})
    page.add_init_script('''(() => {
      const play=HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play=function(...args){
        this.addEventListener('playing',()=>sessionStorage.setItem('test:sound-playing','1'),{once:true});
        return play.apply(this,args);
      };
    })();''')
    page.goto(BASE,wait_until='networkidle')
    assert page.locator('#channel-sound').count()==1,'Sound toggle should exist'
    assert page.locator('#channel-sound').get_attribute('aria-pressed')=='true'
    assert page.evaluate('sessionStorage.getItem("test:sound-playing")') is None,'No autoplay'
    page.locator('nav a[href="/writing/"]').click()
    page.wait_for_url(BASE+'/writing/')
    assert page.evaluate('sessionStorage.getItem("test:sound-playing")')=='1','Actual audio playback must start after the click'
    page.wait_for_function('!document.documentElement.classList.contains("channel-entering")')
    page.locator('#channel-sound').click()
    assert page.locator('#channel-sound').get_attribute('aria-pressed')=='false'
    page.evaluate('sessionStorage.removeItem("test:sound-playing")')
    page.locator('nav a[href="/about/"]').click()
    page.wait_for_url(BASE+'/about/')
    assert page.locator('#channel-sound').get_attribute('aria-pressed')=='false'
    assert page.evaluate('sessionStorage.getItem("test:sound-playing")') is None,'Mute should persist'
    page.wait_for_function('!document.documentElement.classList.contains("channel-entering")')
    page.evaluate('''()=>{
      document.documentElement.classList.add('channel-leaving');
      document.getAnimations().forEach(a=>{a.pause();a.currentTime=65});
    }''')
    shadow=page.locator('.page').evaluate('(e)=>getComputedStyle(e).textShadow')
    assert shadow=='none','Transition must not add colored ghosts to text'
    assert page.locator('.page').evaluate('(e)=>getComputedStyle(e).filter')=='none'
    screen=page.locator('.channel-overlay').evaluate('(e)=>getComputedStyle(e,"::before").backgroundImage')
    assert 'gradient' in screen,'RGB interference belongs in the screen overlay'
    page.screenshot(path=str(OUT/'channel-rgb.png'))
    page.evaluate('document.documentElement.classList.remove("channel-leaving")')
    assert page.locator('.page').evaluate('(e)=>getComputedStyle(e).textShadow')=='none'
    browser.close()
print(json.dumps({'audio':'real playing event observed','autoplay':'none','mute':'persisted across pages','transition_rgb':'verified','resting_text':'unchanged'}))
