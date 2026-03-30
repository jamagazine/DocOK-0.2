import pandas as pd
import re

def sanitize_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    df = df.fillna('').astype(str)
    for col in df.columns:
        df[col] = df[col].str.strip()

    col_pos, col_name = 0, 1
    new_rows = []
    last_dot_pos = ''
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
                last_dot_pos = match.group(1)
                new_rows.append(r)
                continue

        others = [v for i, v in enumerate(vals) if i not in [col_pos, col_name] and v != '']
        if (not pos or pos == 'nan') and name and not others:
            if not re.match(r'^\d', name):
                r[df.columns[col_pos]] = '§'
                last_dot_pos = ''
                new_rows.append(r)
                continue

        new_rows.append(r)

    return pd.DataFrame(new_rows)

df = pd.DataFrame({'Unnamed: 0': [''], 'Name': ['2. Электромонтажные изделия']})
print(sanitize_dataframe(df).to_dict('records'))
