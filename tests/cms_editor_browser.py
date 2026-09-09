"""Real editor smoke test, using an automatically isolated local repository.
Requires the local Hugo build at http://127.0.0.1:8768 and Chrome.
Run: uv run --with playwright --with pyyaml python tests/cms_editor_browser.py
No production configuration or GitHub content is changed.
"""
import contextlib
import json
import os
from pathlib import Path
import re
import shutil
import signal
import socket
import subprocess
import tempfile
import time
import urllib.error
import urllib.request
import yaml
from playwright.sync_api import sync_playwright

REPO = Path(__file__).resolve().parents[1]
BASE = 'http://127.0.0.1:8768'


@contextlib.contextmanager
def isolated_proxy():
    with tempfile.TemporaryDirectory(prefix='cms-editor-') as directory:
        sandbox = Path(directory)
        for name in ['content', 'data', 'static', 'layouts', 'assets']:
            shutil.copytree(REPO/name, sandbox/name)
        shutil.copy2(REPO/'config.yaml', sandbox/'config.yaml')
        with socket.socket() as sock:
            sock.bind(('127.0.0.1', 0))
            port = sock.getsockname()[1]
        env = dict(os.environ, PORT=str(port), BIND_HOST='127.0.0.1', ORIGIN=BASE)
        with (sandbox/'proxy.log').open('w') as log:
            process = subprocess.Popen(['npx', '--yes', 'decap-server@3.9.0'], cwd=sandbox,
                                       env=env, stdout=log, stderr=subprocess.STDOUT,
                                       start_new_session=True)
            try:
                url = f'http://127.0.0.1:{port}/api/v1'
                deadline = time.monotonic()+60
                while True:
                    if process.poll() is not None:
                        raise RuntimeError((sandbox/'proxy.log').read_text())
                    try:
                        urllib.request.urlopen(url, timeout=1).close()
                        break
                    except urllib.error.HTTPError:
                        break
                    except urllib.error.URLError:
                        if time.monotonic()>deadline:
                            raise RuntimeError('Local CMS proxy did not start')
                        time.sleep(.2)
                yield sandbox, url
            finally:
                if process.poll() is None:
                    os.killpg(process.pid, signal.SIGTERM)
                    try:
                        process.wait(timeout=5)
                    except subprocess.TimeoutExpired:
                        os.killpg(process.pid, signal.SIGKILL)
                        process.wait()


with isolated_proxy() as (sandbox, proxy), sync_playwright() as p:
    config = yaml.safe_load((REPO/'static/admin/config.yml').read_text())
    config['backend'] = {'name': 'git-gateway'}
    config['local_backend'] = {'url': proxy}
    config['publish_mode'] = 'simple'  # Proxy does not implement GitHub PR workflow.
    browser = p.chromium.launch(channel='chrome', headless=True)
    page = browser.new_page(viewport={'width':1440,'height':1100})
    page.route('https://api.github.com/**', lambda route: route.abort())
    page.route('**/admin/config.yml', lambda route: route.fulfill(
        status=200, content_type='text/yaml', body=yaml.safe_dump(config)))
    page.goto(BASE+'/admin/', wait_until='domcontentloaded')
    page.get_by_role('button', name='Login', exact=True).click(timeout=60000)
    page.locator('a[href="#/collections/writing/new"]').click()
    page.locator('input[id^="title-field"]').fill('CMS editor smoke test')
    page.locator('input[id^="date-field"]').fill('2020-01-01')
    page.locator('textarea[id^="description-field"]').fill('Local-only editor verification.')
    page.locator('input[id^="slug-field"]').fill('cms-editor-smoke-test')
    page.locator('input[id^="image_alt-field"]').fill('CMS uploaded image')
    page.locator('[contenteditable="true"]').fill('A draft created through the actual editor, in an isolated local copy.')
    page.get_by_role('button', name='Choose an image', exact=True).click()
    page.locator('input[type="file"]').set_input_files({'name':'cms-upload-fixture.png',
        'mimeType':'image/png', 'buffer':(REPO/'static/images/tv-static.png').read_bytes()})
    page.get_by_text('cms-upload-fixture.png', exact=True).wait_for(timeout=20000)
    if page.get_by_role('button', name='Choose selected', exact=True).is_disabled():
        page.get_by_text('cms-upload-fixture.png', exact=True).click()
    page.get_by_role('button', name='Choose selected', exact=True).click()
    page.get_by_role('button', name='Publish', exact=True).click()
    page.get_by_text('Publish now', exact=True).click()
    page.wait_for_url('**/entries/cms-editor-smoke-test', timeout=20000)
    post = (sandbox/'content/writing/cms-editor-smoke-test.md').read_text()
    assert 'A draft created through the actual editor' in post
    assert '/uploads/cms-upload-fixture' in post
    assert (sandbox/'static/uploads/cms-upload-fixture.png').is_file()

    page.evaluate("window.location.hash='/collections/pages'")
    page.locator('a[href="#/collections/pages/entries/home"]').click()
    page.locator('input[id^="headline-field"]').fill('Editor checked headline')
    page.get_by_role('button',name=re.compile('^Publish')).click()
    page.get_by_text('Publish now',exact=True).click()
    page.wait_for_function('document.body.innerText.includes("CHANGES SAVED")')
    assert 'Editor checked headline' in (sandbox/'content/_index.md').read_text()

    page.evaluate("window.location.hash='/collections/settings'")
    page.locator('a[href="#/collections/settings/entries/site"]').click()
    page.locator('input[id^="contact_email-field"]').fill('editor-check@example.test')
    page.get_by_role('button',name=re.compile('^Publish')).click()
    page.get_by_text('Publish now',exact=True).click()
    page.wait_for_function('document.body.innerText.includes("CHANGES SAVED")')
    saved = yaml.safe_load((sandbox/'data/site.yaml').read_text())
    assert saved['contact_email']=='editor-check@example.test'
    assert saved['social']['github']=='https://github.com/agniiva'
    subprocess.run(['hugo', '--destination', str(sandbox/'public')], cwd=sandbox,
                   check=True, capture_output=True, text=True)
    html = (sandbox/'public/writing/cms-editor-smoke-test/index.html').read_text()
    assert '/uploads/cms-upload-fixture.png' in html
    assert 'CMS uploaded image' in html
    browser.close()
print(json.dumps({'backend':'disposable local proxy; no GitHub writes', 'post':'saved and read back',
                  'image':'uploaded and rendered', 'homepage_headline':'edited and saved',
                  'settings':'saved without losing social fields', 'resulting_hugo_build':'passed'}))
