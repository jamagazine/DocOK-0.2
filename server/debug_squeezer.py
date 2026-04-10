import sys, json
sys.path.insert(0, r'c:\Project\DocOK\DocOK_0.2.5\server')
from items_parser import clean_and_group_markdown_table

m = json.load(open(r'c:\Project\DocOK\DocOK_0.2.5\data\projects\novyj-proekt-6-10-04-2026\manifest.json', encoding='utf-8'))
for name, v in m.items():
    raw = v.get('raw_markdown', '')
    cleaned = clean_and_group_markdown_table(raw)
    lines = [l for l in cleaned.split('\n') if l.strip()]
    num_pos = max(0, len(lines) - 1)
    est = v.get('estimated_cost')
    fact = v.get('cost')
    tok = v.get('tokens')
    print(f"{name}")
    print(f"  raw_md_chars={len(raw)}, squeezer_rows={num_pos}")
    print(f"  est={est}, fact={fact}, fact_tokens={tok}")
    print()
