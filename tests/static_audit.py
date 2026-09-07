from pathlib import Path
from html.parser import HTMLParser
import hashlib, re

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / 'relationship-os.html'
INDEX = ROOT / 'index.html'

class AuditParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.external = []
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        for key in ('src','href','action'):
            val = attrs.get(key)
            if val and (val.startswith('http://') or val.startswith('https://') or val.startswith('//')):
                self.external.append((tag,key,val))

def main():
    text = HTML.read_text(encoding='utf-8')
    assert '<html lang="ru">' in text
    assert '<meta name="viewport"' in text
    assert 'localStorage' in text
    assert 'RelationshipOSCore' in text
    assert not re.search(r'\bfetch\s*\(', text), 'network fetch() found in standalone artifact'
    assert 'XMLHttpRequest' not in text
    assert 'WebSocket' not in text
    parser = AuditParser(); parser.feed(text)
    assert parser.external == [], f'external resources found: {parser.external}'
    assert HTML.read_bytes() == INDEX.read_bytes(), 'relationship-os.html and index.html differ'
    print('Static audit: PASS')
    print('Bytes:', len(HTML.read_bytes()))
    print('SHA256:', hashlib.sha256(HTML.read_bytes()).hexdigest())

if __name__ == '__main__':
    main()
