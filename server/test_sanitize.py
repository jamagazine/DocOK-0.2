import pandas as pd
import re

def sanitize_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    df = df.fillna("").astype(str)
    for col in df.columns:
        df[col] = df[col].str.strip()

    col_pos, col_name = 0, 1
    for i, col in enumerate(df.columns):
        c_low = str(col).lower()
        if "поз" in c_low or "№" in c_low or "unnamed: 0" in c_low:
            col_pos = i
        elif "наименован" in c_low or "названи" in c_low or "unnamed: 1" in c_low:
            col_name = i

    new_rows = []
    last_dot_pos = ""
    for idx, row in df.iterrows():
        r = row.to_dict()
        vals = list(r.values())
        pos = str(vals[col_pos]).strip()
        name = str(vals[col_name]).strip()

        if pos.endswith(".1") and last_dot_pos.endswith(".9"):
            if pos[:-2] == last_dot_pos[:-2]:
                pos = pos + "0"
                r[df.columns[col_pos]] = pos

        if re.match(r'^\d+(\.\d+)+$', pos):
            last_dot_pos = pos
        new_rows.append(r)

    return pd.DataFrame(new_rows)

df = pd.DataFrame({'Unnamed: 0': ['1.8', '1.9', '1.1', '1.11'], 'Name': ['A', 'B', 'C', 'D']})
print("Original:")
print(df)
print("Sanitized:")
print(sanitize_dataframe(df))
