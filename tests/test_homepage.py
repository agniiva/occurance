"""Homepage acceptance checks. Run: python3 -m unittest discover -s tests -v."""
import subprocess
import tempfile
import unittest
from pathlib import Path
from html.parser import HTMLParser

ROOT = Path(__file__).resolve().parents[1]


class Document(HTMLParser):
    def __init__(self):
        super().__init__()
        self.elements = []
        self.text = []

    def handle_starttag(self, tag, attrs):
        self.elements.append((tag, dict(attrs)))

    def handle_data(self, data):
        self.text.append(data)


class HomepageTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.output = tempfile.TemporaryDirectory()
        subprocess.run([
            'hugo', '--destination', cls.output.name,
            '--cacheDir', str(Path(cls.output.name) / '.cache'),
        ], cwd=ROOT, check=True, capture_output=True, text=True)
        cls.html = (Path(cls.output.name) / 'index.html').read_text()
        cls.document = Document()
        cls.document.feed(cls.html)

    @classmethod
    def tearDownClass(cls):
        cls.output.cleanup()

    def test_feed_identifies_agniva_not_the_old_theme_author(self):
        feed = (Path(self.output.name) / 'atom.xml').read_text()
        self.assertNotIn('Ronalds Vilcins', feed)
        self.assertIn('Agniva Mahata', feed)
        self.assertNotIn('simplica', self.html.lower())

    def test_public_pages_share_navigation_and_footer(self):
        for relative in ['writing/index.html', 'about/index.html', 'links/index.html',
                         'writing/no-map/index.html', '404.html']:
            with self.subTest(page=relative):
                document = Document()
                document.feed((Path(self.output.name) / relative).read_text())
                self.assertTrue(any(tag == 'header' and attrs.get('class') == 'site-header'
                                    for tag, attrs in document.elements), relative)
                self.assertTrue(any(attrs.get('class') == 'social-links'
                                    for _, attrs in document.elements), relative)
                self.assertEqual(sum(tag == 'h1' for tag, _ in document.elements), 1)

    def test_header_has_no_decorative_subtitles_or_sidebar(self):
        text = ' '.join(self.document.text)
        for label in ['A personal website', 'Business, technology & human life',
                      'Somewhere between', 'the human & the digital.']:
            self.assertNotIn(label, text)
        self.assertFalse(any(tag == 'aside' for tag, _ in self.document.elements))
        self.assertTrue(any(tag == 'header' and attrs.get('class') == 'site-header'
                            for tag, attrs in self.document.elements))

    def test_heading_preserves_word_spaces_without_visual_breaks(self):
        import re
        match = re.search(r'<h1[^>]*>(.*?)</h1>', self.html, re.S)
        assert match is not None, 'Homepage heading is missing'
        heading = match.group(1)
        text = re.sub(r'<[^>]+>', '', heading)
        self.assertIn('I build businesses and study how they work.', text)

    def test_homepage_has_an_accessible_personal_introduction(self):
        elements = self.document.elements
        self.assertEqual(sum(tag == 'h1' for tag, _ in elements), 1,
                         'The homepage needs one clear primary heading')
        self.assertTrue(any(tag == 'main' and attrs.get('id') == 'main'
                            for tag, attrs in elements))
        self.assertTrue(any(tag == 'nav' and attrs.get('aria-label') == 'Primary'
                            for tag, attrs in elements))
        text = ' '.join(self.document.text)
        self.assertIn('Agniva', text)
        self.assertIn('where markets are forming', text)
        self.assertNotIn('$1M ARR', text)


if __name__ == '__main__':
    unittest.main()
