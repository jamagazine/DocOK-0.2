import pandas as pd
import re

df = pd.DataFrame([{'Unnamed: 0': '', 'Unnamed: 1': '', 'Наименование': '2. Электромонтажные изделия'}])

col_pos, col_name = 0, 2
new_rows = []
for idx, row in df.iterrows():
    r = row.to_dict()
    vals = list(r.values())
    pos = str(vals[col_pos]).strip()
    name = str(vals[col_name]).strip()

    if (not pos or pos == 'nan') and name:
        match = re.match(r'^(\d+(?:\.\d+)*)\.?\s+(.*)', name)
        if match:
            r[df.columns[col_pos]] = match.group(1)
            r[df.columns[col_name]] = match.group(2)
            new_rows.append(r)
            continue
    new_rows.append(r)

out = pd.DataFrame(new_rows)
print(out.to_markdown(index=False, tablefmt='pipe'))
