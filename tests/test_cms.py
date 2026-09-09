"""CMS configuration path must work at /admin and /admin/."""
import subprocess
import tempfile
import unittest
from pathlib import Path
from html.parser import HTMLParser

ROOT = Path(__file__).resolve().parents[1]


class Elements(HTMLParser):
    def __init__(self):
        super().__init__()
        self.items = []

    def handle_starttag(self, tag, attrs):
        self.items.append((tag, dict(attrs)))


class EditorTests(unittest.TestCase):
    def test_home_and_contact_fields_render_from_editor_content(self):
        import shutil
        with tempfile.TemporaryDirectory() as directory:
            site = Path(directory)
            for name in ['layouts', 'assets', 'content', 'static']:
                shutil.copytree(ROOT / name, site / name)
            shutil.copy2(ROOT / 'config.yaml', site / 'config.yaml')
            (site / 'data').mkdir()
            (site / 'data/site.yaml').write_text(
                'contact_email: editor@example.test\ncontact_label: Write to me\n'
                'social:\n  linkedin: https://www.linkedin.com/in/editor-test/\n'
                '  x: https://x.com/editor-test\n  github: https://github.com/editor-test\n'
                '  newsletter: https://editor.example.test\n')
            (site / 'content/_index.md').write_text(
                '---\ntitle: Home\nheadline: Edited headline\nsubheading: Edited subheading\n'
                'writing_heading: Edited writing label\n---\n\nEdited body text.\n')
            subprocess.run(['hugo', '--destination', str(site / 'public')], cwd=site,
                           check=True, capture_output=True, text=True)
            html = (site / 'public/index.html').read_text()
            for expected in ['Edited headline', 'Edited subheading', 'Edited body text.',
                             'Edited writing label', 'Write to me', 'editor@example.test',
                             'https://x.com/editor-test', 'https://github.com/editor-test']:
                self.assertIn(expected, html, expected)

    def test_uploaded_and_external_images_build_without_manual_assets(self):
        import shutil
        with tempfile.TemporaryDirectory() as directory:
            site = Path(directory)
            for name in ['layouts', 'assets', 'content', 'static', 'data']:
                shutil.copytree(ROOT / name, site / name)
            shutil.copy2(ROOT / 'config.yaml', site / 'config.yaml')
            (site / 'static/uploads').mkdir(exist_ok=True)
            shutil.copy2(ROOT / 'static/images/tv-static.png', site / 'static/uploads/editor-fixture.png')
            (site / 'content/writing/editor-fixture.md').write_text(
                '---\ntitle: Editor fixture\ndate: 2020-01-01\n'
                'image: /uploads/editor-fixture.png\nimage_alt: Uploaded cover\n---\n\n'
                '![Uploaded image](/uploads/editor-fixture.png)\n\n'
                '![Linked image](https://images.example.test/picture.jpg)\n')
            (site / 'content/writing/no-cover-fixture.md').write_text(
                '---\ntitle: No cover fixture\ndate: 2020-01-01\n---\n\nA new post without a cover.\n')
            build = subprocess.run(['hugo', '--destination', str(site / 'public')], cwd=site,
                                   capture_output=True, text=True)
            self.assertEqual(build.returncode, 0, build.stderr[-1500:])
            fallback = Elements()
            fallback.feed((site / 'public/writing/no-cover-fixture/index.html').read_text())
            self.assertTrue(any(tag == 'meta' and attrs.get('property') == 'og:image'
                                and attrs.get('content', '').endswith('/og/home.png')
                                for tag, attrs in fallback.items))
            page = Elements()
            page.feed((site / 'public/writing/editor-fixture/index.html').read_text())
            images = [attrs for tag, attrs in page.items if tag == 'img']
            self.assertTrue(any(img.get('alt') == 'Uploaded cover' for img in images))
            self.assertTrue(any(img.get('src') == 'https://images.example.test/picture.jpg' for img in images))
            self.assertTrue(any(tag == 'meta' and attrs.get('property') == 'og:image'
                                and attrs.get('content', '').endswith('/uploads/editor-fixture.png')
                                for tag, attrs in page.items))

    def test_config_url_is_absolute(self):
        page = Elements()
        page.feed((ROOT / 'static/admin/index.html').read_text())
        configs = [attrs.get('href') for tag, attrs in page.items
                   if tag == 'link' and attrs.get('rel') == 'cms-config-url']
        self.assertEqual(configs, ['/admin/config.yml'])


if __name__ == '__main__':
    unittest.main()
