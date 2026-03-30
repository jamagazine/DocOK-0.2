import os
import re
import pandas as pd
import io
import pdfplumber

UNITS_MAP = {
    # базовые
    "шт": "штука", "шт.": "штука", "штук": "штука", "штуки": "штука",
    "м": "метр", "м.": "метр", "метр": "метр", "метры": "метр",
    "м2": "квадратный метр", "м²": "квадратный метр", "м2.": "квадратный метр",
    "м3": "кубический метр", "м³": "кубический метр",
    "кг": "килограмм", "кг.": "килограмм",
    "т": "тонна", "т.": "тонна", "тн": "тонна", "тн.": "тонна",
    "л": "литр", "л.": "литр",
    "компл": "комплект", "компл.": "комплект",
    "наб": "набор", "наб.": "набор",
    "рул": "рулон", "рул.": "рулон",
    "упак": "упаковка", "упак.": "упаковка", "пач": "пачка", "пач.": "пачка",
    "пог.м": "погонный метр", "п.м": "погонный метр", "погм": "погонный метр",
    "тыс.шт": "тысяча штук", "тыс.шт.": "тысяча штук",
    "mm": "миллиметр", "мм": "миллиметр", "мм.": "миллиметр",
    "cm": "сантиметр", "см": "сантиметр", "см.": "сантиметр",
    "km": "километр", "км": "километр", "км.": "километр",
    "ga": "гектар",
    "кв.м": "квадратный метр", "кв.м.": "квадратный метр",
    "куб.м": "кубический метр", "куб.м.": "кубический метр",
    # реже, но встречаются в стройке
    "пар": "пара", "пар.": "пара",
    "мест": "место", "мест.": "место",
    "секц": "секция", "секц.": "секция",
    "эл": "элемент", "эл.": "элемент",
    "бух": "бухта", "бух.": "бухта",
    "лист": "лист", "лист.": "лист",
    "кг/м": "килограмм на метр",
    "м/пог": "метр погонный",
    "кор": "коробка", "кор.": "коробка", "ящ": "ящик", "ящ.": "ящик",
    "банка": "банка", "б.": "банка"
}

def normalize_unit(unit_str: str) -> str:
    if not unit_str:
        return ""
    cleaned = unit_str.lower().strip()
    return UNITS_MAP.get(cleaned, unit_str)

def normalize_for_match(text: str) -> str:
    if not text: return ""
    t = text.lower().strip()
    t = re.sub(r'[^\w\sа-яё]', ' ', t)
    t = re.sub(r'\s+', ' ', t).strip()
    return t

def to_float(val) -> float:
    if not val: return 0.0
    val_str = str(val).replace(' ', '').replace(',', '.')
    match = re.search(r'-?\d+(\.\d+)?', val_str)
    return float(match.group(0)) if match else 0.0

def calculate_uncertainty(struct: dict, global_low_conf: bool):
    items = struct.get("items", [])
    for item in items:
        is_uncertain = global_low_conf
        raw_qty = str(item.get("quantity", "")).strip()
        match_qty = re.match(r'^([\d\.\,\s]+)(.*?)$', raw_qty)
        if match_qty and match_qty.group(2).strip():
            item["quantity"] = match_qty.group(1).strip()
            if not item.get("unit"): item["unit"] = match_qty.group(2).strip()
                
        if item.get("unit"): item["unit"] = normalize_unit(str(item.get("unit")))

        qty = to_float(item.get("quantity"))
        price = to_float(item.get("price"))
        total = to_float(item.get("total"))
        
        if qty > 0 and price > 0 and total > 0:
            if abs(qty * price - total) > (0.05 * total): is_uncertain = True
            if abs(qty * price - total) >= 0.1: item["math_error"] = True
                
        if not item.get("name"): is_uncertain = True
        item["isUncertain"] = is_uncertain
        
    return struct

def transliterate(text: str) -> str:
    ru = "абвгдёезийклмнопрстуфхцчшщъыьэюяАБВГДЁЕЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ"
    en = ["a", "b", "v", "g", "d", "yo", "e", "z", "i", "j", "k", "l", "m", "n", "o", "p", "r", "s", "t", "u", "f", "h", "ts", "ch", "sh", "shch", "", "y", "", "e", "yu", "ya", "A", "B", "V", "G", "D", "Yo", "E", "Z", "I", "J", "K", "L", "M", "N", "O", "P", "R", "S", "T", "U", "F", "H", "Ts", "Ch", "Sh", "Shch", "", "Y", "", "E", "Yu", "Ya"]
    return "".join({ru[i]: en[i] for i in range(len(ru))}.get(c, c) for c in text)

def secure_filename(filename: str) -> str:
    return re.sub(r'[^a-zA-Z0-9._-]', '_', filename)

def sanitize_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    df = df.fillna("").astype(str)
    c_p, c_n = 0, 1
    # Fix Column Mapping: Added break to fix first match
    for i, c in enumerate(df.columns):
        cl = str(c).lower()
        if any(x in cl for x in ["поз", "№", "unnamed: 0"]): 
            c_p = i
            break
    for i, c in enumerate(df.columns):
        cl = str(c).lower()
        if any(x in cl for x in ["наименован", "названи", "товар"]):
            c_n = i
            break

    last = ""
    for i in range(len(df)):
        p, n = df.iloc[i, c_p].strip(), df.iloc[i, c_n].strip()
        
        # Merged Cells Support: Check neighbor column if c_n is empty
        if not n and c_n != 1:
            n_alt = df.iloc[i, 1].strip()
            if n_alt:
                n = n_alt
                df.iloc[i, c_n] = n
        
        if (not p or p=="nan") and n:
            # Regex Update: Use \s* instead of \s+ for missing spaces
            m = re.match(r'^(\d+(?:\.\d+)*)\.?\s*(.*)', n)
            if m:
                df.iloc[i, c_p], df.iloc[i, c_n], p = m.group(1), m.group(2), m.group(1)
        
        # Location Marking: Mark as § if position is empty but technical columns are also empty
        if (not p or p=="nan") and n:
            other_cols_empty = True
            for k in range(len(df.columns)):
                if k != c_p and k != c_n:
                    if df.iloc[i, k].strip():
                        other_cols_empty = False
                        break
            if other_cols_empty:
                p = "§"
                df.iloc[i, c_p] = p

        if p.endswith(".1") and last.endswith(".9") and p[:-2]==last[:-2]: df.iloc[i, c_p] = p + "0"
        if re.match(r'^\d+(\.\d+)+$', p): last = p
    return df

def convert_df_to_items(df: pd.DataFrame) -> list:
    c_p, c_n, c_u, c_q = 0, 1, -1, -1
    for i, c in enumerate(df.columns):
        cl = str(c).lower()
        if "поз" in cl or "№" in cl: c_p = i
        elif "наимен" in cl or "товар" in cl: c_n = i
        elif "ед" in cl and "изм" in cl: c_u = i
        elif "кол" in cl: c_q = i
    items = []
    for idx, row in df.iterrows():
        v = [str(x).strip() for x in row.values]
        if v[c_p]=="1" and v[c_n]=="2" and sum(1 for i, x in enumerate(v[:5]) if x==str(i+1))>=3: continue
        if not v[c_p] and not v[c_n]: continue
        items.append({"id": f"idx_{idx}", "pos": v[c_p], "name": v[c_n], "unit": v[c_u] if c_u!=-1 else "", "quantity": v[c_q] if c_q!=-1 else "1", "row_type": "ITEM", "is_header": False})
    return items

def extract_text_from_pdf(path: str) -> str:
    ext_text = ""
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            t = page.extract_text(x_tolerance=2, y_tolerance=3)
            if t:
                ext_text += "\n".join([re.sub(r'\s{2,}', ' | ', l) for l in t.split('\n')]) + "\n"
    return ext_text
