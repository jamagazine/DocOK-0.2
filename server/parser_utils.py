import os
import re
import pandas as pd
import io
import pdfplumber
import cv2
import numpy as np
from PIL import Image

def deskew_image(pil_img):
    """
    Straightens a tilted scan (OCR Stage 1 Optimization).
    Uses OpenCV to find the text angle and rotate the image.
    """
    # 1. Convert PIL to OpenCV (BGR)
    cv_img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
    
    # 2. To Grayscale and Binarize
    gray = cv2.cvtColor(cv_img, cv2.COLOR_BGR2GRAY)
    gray = cv2.bitwise_not(gray)
    thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)[1]
    
    # 3. Find coordinates of all white pixels (text)
    coords = np.column_stack(np.where(thresh > 0))
    if len(coords) == 0: return pil_img

    # 4. Find the minAreaRect for the points
    rect = cv2.minAreaRect(coords)
    angle = rect[-1]
    
    # Normalize the angle (OpenCV returns -90 to 0)
    if angle < -45:
        angle = -(90 + angle)
    else:
        angle = -angle
        
    # Rotate if tilt is significant (> 0.5 deg)
    if abs(angle) > 0.5:
        (h, w) = cv_img.shape[:2]
        center = (w // 2, h // 2)
        M = cv2.getRotationMatrix2D(center, angle, 1.0)
        cv_img = cv2.warpAffine(cv_img, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
        # Convert back to PIL
        return Image.fromarray(cv2.cvtColor(cv_img, cv2.COLOR_BGR2RGB))
    
    return pil_img

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

def validate_and_clean_inn(text: str) -> str:
    """
    Validates Russian INN (10 or 12 digits).
    Includes logic for 11-digit OCR errors (stripping first/last char).
    """
    import re
    inn = re.sub(r'\D', '', str(text))
    
    # 1. Handle OCR ghosts (11 digits)
    if len(inn) == 11:
        candidates = [inn[1:], inn[:-1]]
        for cand in candidates:
            if validate_inn_logic(cand): return cand
    
    return inn if validate_inn_logic(inn) else ""

def validate_inn_logic(s: str) -> bool:
    """
    Strict Russian INN checksum validation (10 or 12 digits).
    """
    if not s or not s.isdigit(): return False
    if len(s) not in [10, 12]: return False
    
    if len(s) == 10:
        coeffs = [2, 4, 10, 3, 5, 9, 4, 6, 8]
        s_sum = sum(int(s[i]) * coeffs[i] for i in range(9))
        return (s_sum % 11) % 10 == int(s[9])
        
    if len(s) == 12:
        coeffs1 = [7, 2, 4, 10, 3, 5, 9, 4, 6, 8]
        s_sum1 = sum(int(s[i]) * coeffs1[i] for i in range(10))
        n11 = (s_sum1 % 11) % 10
        
        coeffs2 = [3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8]
        s_sum2 = sum(int(s[i]) * coeffs2[i] for i in range(11))
        n12 = (s_sum2 % 11) % 10
        
        return n11 == int(s[10]) and n12 == int(s[11])
    return False

def validate_and_clean_inn(text: str) -> str:
    import re
    inn = re.sub(r'\D', '', str(text))
    if len(inn) == 11:
        for cand in [inn[1:], inn[:-1]]:
            if validate_inn_logic(cand): return cand
    return inn if validate_inn_logic(inn) else ""

def validate_bank_details(bik: str, acc_settlement: str = "", acc_corr: str = ""):
    import re
    bik = re.sub(r'\D', '', str(bik))
    acc_s = re.sub(r'\D', '', str(acc_settlement))
    acc_c = re.sub(r'\D', '', str(acc_corr))
    is_bik_ok = len(bik) == 9 and bik.startswith('04')
    res_s = acc_s if len(acc_s) == 20 else ""
    res_c = acc_c if len(acc_c) == 20 and acc_c.startswith('301') else ""
    is_valid = is_bik_ok and res_c and bik[-3:] == res_c[-3:]
    return {"bik": bik if is_bik_ok else "", "settlement_account": res_s, 
            "correspondent_account": res_c, "is_valid": is_valid}

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
        
        if p.endswith(".1") and last.endswith(".9") and p[:-2]==last[:-2]: df.iloc[i, c_p] = p + "0"
        if re.match(r'^\d+(\.\d+)+$', p): last = p
        
    # Append technical ID column for AI patching
    df['__ID__'] = [f"idx_{i}" for i in range(len(df))]
    return df

def convert_df_to_items(df: pd.DataFrame) -> list:
    c_p, c_n, c_u, c_q, c_id = 0, 1, -1, -1, -1
    for i, c in enumerate(df.columns):
        cl = str(c).lower()
        if "поз" in cl or "№" in cl: c_p = i
        elif "наимен" in cl or "товар" in cl: c_n = i
        elif "ед" in cl and "изм" in cl: c_u = i
        elif "кол" in cl: c_q = i
        elif "__id__" in cl: c_id = i

    def is_empty_val(x):
        return str(x).strip().lower() in ("", "0", "0.0", "nan", "none")

    # ── Step 1: Classify every row as HEADER or ITEM ──────────────────────────
    # ITEM  = has a readable quantity
    # HEADER= name present, quantity absent
    raw_list = []
    for idx, row in df.iterrows():
        v = [str(x).strip() for x in row.values]
        if not any(v): continue
        # Skip the column-header row of the table itself (1, 2, 3, ...)
        if v[c_p] == "1" and v[c_n] == "2" and sum(1 for i, x in enumerate(v[:5]) if x == str(i+1)) >= 3:
            continue

        row_id   = v[c_id] if c_id != -1 else f"idx_{idx}"
        name_val = v[c_n]
        pos_val  = v[c_p]
        unit_val = v[c_u] if c_u != -1 else ""
        qty_val  = v[c_q] if c_q != -1 else ""

        name_clean = str(name_val).strip()
        # Step 1: Preliminary identification of potential headers
        # Potential header = No unit, no quantity, no mass (columns after c_q) + HAS NAME WITH LETTERS
        has_letters = any(c.isalpha() for c in str(name_val))
        is_potential = is_empty_val(unit_val) and is_empty_val(qty_val) and bool(str(name_val).strip()) and has_letters

        raw_list.append({
            "id":       row_id,
            "pos":      pos_val,
            "name":     name_clean,
            "unit":     unit_val,
            "quantity": qty_val,
            "is_item":  not is_potential,  # True = ITEM, False = potential HEADER
        })

    # ── Step 2: Split into Chunks [headers…, items…] ──────────────────────────
    # One Chunk = 1+ consecutive HEADER rows + 1+ consecutive ITEM rows.
    chunks = []
    cur_headers: list = []
    cur_items:   list = []

    for raw in raw_list:
        if raw["is_item"]:
            cur_items.append(raw)
        else:
            # New header block starts — flush accumulated items first
            if cur_items:
                chunks.append({"headers": cur_headers, "items": cur_items})
                cur_headers = []
                cur_items   = []
            cur_headers.append(raw)

    # Flush the final chunk
    if cur_headers or cur_items:
        chunks.append({"headers": cur_headers, "items": cur_items})

    # ── Step 3: Stack AST – build hierarchy ───────────────────────────────────
    # current_stack[idx] is an ancestor header; idx == hierarchy level (0,1,2).
    LEVEL_TYPES   = ["WORK_TYPE", "LOCATION", "GROUP"]
    current_stack: list = []
    items_out:     list = []
    emitted_ids:   set  = set()

    def is_global_section(name: str) -> bool:
        """Single ALL-CAPS word with letters (e.g. ВЕНТИЛЯЦИЯ, OTOPLENIE)."""
        parts = name.split()
        return (
            len(parts) == 1
            and len(name) > 2
            and all(ch.isupper() or not ch.isalpha() for ch in name)
            and any(ch.isalpha() for ch in name)
        )

    for chunk in chunks:
        hdrs = chunk["headers"]
        its  = chunk["items"]

        if not hdrs and not its:
            continue

        # ── Update the stack based on this chunk's headers ────────────────────
        if hdrs:
            if len(hdrs) >= 2:
                # Multiple headers → completely new branch, reset stack
                current_stack = list(hdrs)
            else:
                hdr    = hdrs[0]
                name_h = hdr["name"]
                if is_global_section(name_h):
                    # Global ALL-CAPS word → new L0 root, reset stack
                    current_stack = [hdr]
                else:
                    # Inherit: replace only the deepest slot in the stack
                    if current_stack:
                        current_stack[-1] = hdr
                    else:
                        current_stack = [hdr]

        # ── Emit header rows with assigned levels ─────────────────────────────
        for depth, hdr in enumerate(current_stack):
            if hdr["id"] in emitted_ids:
                continue  # already emitted in a previous chunk
            emitted_ids.add(hdr["id"])

            lvl    = min(depth, 2)
            r_type = LEVEL_TYPES[lvl]

            if lvl == 0:
                hdr["pos"] = ""
            elif lvl == 1:
                hdr["pos"]  = "§"
                hdr["name"] = re.sub(r'^[§\s]+|[§\s]+$', '', hdr["name"]).strip()

            parent_id = current_stack[depth - 1]["id"] if depth > 0 else None

            hdr["row_type"]        = r_type
            hdr["is_header"]       = True
            hdr["hierarchy_level"] = lvl
            hdr["parentId"]        = parent_id
            hdr["note"]            = ""
            hdr.pop("is_item", None)
            items_out.append(hdr)

        # Reset so the same chunk headers aren't emitted again on the next loop
        current_stack = list(current_stack)

        # ── Emit item rows, parented to the deepest header ────────────────────
        deepest_parent = current_stack[-1]["id"] if current_stack else None
        for item in its:
            item["row_type"]        = "ITEM"
            item["is_header"]       = False
            item["hierarchy_level"] = None
            item["parentId"]        = deepest_parent
            item["note"]            = ""
            item.pop("is_item", None)
            items_out.append(item)

    return items_out

def extract_text_from_pdf(path: str) -> str:
    ext_text = ""
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            t = page.extract_text(x_tolerance=2, y_tolerance=3)
            if t:
                ext_text += "\n".join([re.sub(r'\s{2,}', ' | ', l) for l in t.split('\n')]) + "\n"
    return ext_text

def extract_specification_summary(df: pd.DataFrame, parsed_rows: list, file_path: str = "") -> dict:
    """
    Extracts metadata from the GOST stamp using xlrd merged cells.
    The stamp data (Cipher, Destination) is stored in merged cells on the
    'Спецификация' sheet, which pandas does not read by default.
    Statistics (positions, suppliers) come from the parsed table data.
    """
    # ── 1. STATISTICS from parsed_rows (ITEMs only) ──────────────────────────
    items = [r for r in (parsed_rows or []) if r.get("row_type") == "ITEM"]
    total_positions = len(items)

    # Suppliers: Find the supplier column dynamically
    c_s = -1
    for i, c in enumerate(df.columns):
        cl = str(c).lower()
        if "поставщик" in cl or "изготовитель" in cl:
            c_s = i
            break
    
    if c_s == -1 and 4 < len(df.columns):
        c_s = 4 # Fallback to column 4 if not found but exists

    suppliers_map = {} # Case-insensitive map to preserve one of the casings
    for r in items:
        rid = r.get("id", "")
        if rid.startswith("idx_"):
            try:
                row_idx = int(rid[4:])
                if row_idx < len(df) and c_s != -1:
                    val = str(df.iloc[row_idx, c_s]).strip()
                    if val and val.lower() not in ("", "0", "0.0", "nan", "none"):
                        suppliers_map[val.lower()] = val
            except (ValueError, IndexError):
                pass
    suppliers_str = ", ".join(sorted(suppliers_map.values())) if suppliers_map else "Не определено"

    # ── 2. STAMP EXTRACTION via xlrd (merged cells) ──────────────────────────
    cipher = ""
    destination_parts = []
    debug_lines = []
    anchor_note = ""

    if file_path and file_path.lower().endswith(".xls"):
        try:
            import xlrd
            wb = xlrd.open_workbook(file_path, formatting_info=True)

            # Try to find the sheet with the stamp (prefer "Спецификация", fallback to any)
            stamp_sheet = None
            for sn in wb.sheet_names():
                if "специф" in sn.lower():
                    stamp_sheet = wb.sheet_by_name(sn)
                    break
            if not stamp_sheet and wb.nsheets > 1:
                stamp_sheet = wb.sheet_by_index(1)  # try second sheet
            if not stamp_sheet:
                stamp_sheet = wb.sheet_by_index(0)

            debug_lines.append(f"Sheet: '{stamp_sheet.name}', Rows: {stamp_sheet.nrows}, Merged: {len(stamp_sheet.merged_cells)}")

            # Scan merged cells for stamp data
            # Pattern: Cipher is in merged cells spanning columns 13-19 in the first 60 rows
            # Destination is in adjacent merged cells below the cipher
            stamp_merges = []
            for mc in stamp_sheet.merged_cells:
                r_lo, r_hi, c_lo, c_hi = mc
                if r_lo < 60:  # Only first page
                    val = stamp_sheet.cell_value(r_lo, c_lo)
                    if val:
                        val_str = str(val).strip()
                        stamp_merges.append({
                            "r_lo": r_lo, "r_hi": r_hi - 1,
                            "c_lo": c_lo, "c_hi": c_hi - 1,
                            "val": val_str
                        })

            # Sort by row for readability
            stamp_merges.sort(key=lambda x: (x["r_lo"], x["c_lo"]))

            # Visual Grid: Recreate the document slice around the anchor
            anchor_idx = -1
            for i in range(stamp_sheet.nrows):
                for j in range(stamp_sheet.ncols):
                    if "листов" in str(stamp_sheet.cell_value(i, j)).lower():
                        anchor_idx = i
                        break
                if anchor_idx != -1: break

            if anchor_idx != -1:
                debug_lines.append("")
                debug_lines.append("=== VISUAL GRID AROUND 'ЛИСТОВ' (STAMP AREA) ===")
                slice_top = max(0, anchor_idx - 15)
                slice_bot = min(stamp_sheet.nrows, anchor_idx + 5)
                for ri in range(slice_top, slice_bot):
                    row_cells = []
                    for ci in range(stamp_sheet.ncols):
                        # Ensure we see at least up to Column 20
                        if ci > 20: continue
                        val = str(stamp_sheet.cell_value(ri, ci)).strip()
                        if val == "nan": val = ""
                        row_cells.append(val or " ")
                    debug_lines.append(f"R{ri:03d} | {' | '.join(row_cells)} |")

            # ── CIPHER: Look for merged cells in columns 13+ with cipher pattern ──
            cipher_regex = r'(\d{2,}-\d{2,}-[А-Яа-яA-Za-z\.\d/_-]+)'
            for sm in stamp_merges:
                if sm["c_lo"] >= 13 and sm["r_lo"] < 60:
                    m = re.search(cipher_regex, sm["val"])
                    if m:
                        found = m.group(0)
                        if len(found) > len(cipher):
                            cipher = found

            # ── DESTINATION: Collect text from merged cells near cipher ──
            # Look for large text blocks in columns 13+ that are NOT the cipher
            noise_words = ["спецификац", "изм.", "лист", "стади", "архив", "инв.",
                           "формат", "дата", "подп", "разраб", "пров.", "н.контр",
                           "утв.", "копировал", "взам.", "№ док", "поз.", "наименован",
                           "код продукц", "поставщик", "ед. измер", "масса", "примечан",
                           "кол.", "взамен", "инв. №", "арх. №", "подпись", "дата", "инв.№"]
            for sm in stamp_merges:
                if sm["c_lo"] >= 13 and sm["r_lo"] < 60:
                    val = sm["val"]
                    if val == cipher:
                        continue
                    if len(val) < 6:
                        continue
                    if re.match(r'^[\d\.\,\s]+$', val):
                        continue
                    if any(nw in val.lower() for nw in noise_words):
                        continue
                    if val not in destination_parts:
                        destination_parts.append(val)

        except Exception as e:
            anchor_note = f"⚠ Ошибка чтения xlrd: {e}\n"
            debug_lines.append(anchor_note)

    elif file_path and file_path.lower().endswith(".xlsx"):
        # For .xlsx files, try openpyxl merged cells
        try:
            import openpyxl
            wbx = openpyxl.load_workbook(file_path, data_only=True)

            stamp_ws = None
            for sn in wbx.sheetnames:
                if "специф" in sn.lower():
                    stamp_ws = wbx[sn]
                    break
            if not stamp_ws and len(wbx.sheetnames) > 1:
                stamp_ws = wbx.worksheets[1]
            if not stamp_ws:
                stamp_ws = wbx.active

            debug_lines.append(f"Sheet: '{stamp_ws.title}', Merged: {len(stamp_ws.merged_cells.ranges)}")

            # Read merged cell ranges
            cipher_regex = r'(\d{2,}-\d{2,}-[А-Яа-яA-Za-z\.\d/_-]+)'
            for mr in stamp_ws.merged_cells.ranges:
                r_lo = mr.min_row - 1  # Convert to 0-indexed
                c_lo = mr.min_col - 1
                if r_lo < 60:
                    cell = stamp_ws.cell(mr.min_row, mr.min_col)
                    if cell.value:
                        val = str(cell.value).strip()
                        if c_lo >= 13:
                            m = re.search(cipher_regex, val)
                            if m and len(m.group(0)) > len(cipher):
                                cipher = m.group(0)
                            elif len(val) >= 6 and val != cipher:
                                if not re.match(r'^[\d\.\,\s]+$', val):
                                    if val not in destination_parts:
                                        destination_parts.append(val)
                        debug_lines.append(f"  R{r_lo:03d} C{c_lo:02d}: '{val[:70]}'")
        except Exception as e:
            anchor_note = f"⚠ Ошибка чтения openpyxl: {e}\n"
            debug_lines.append(anchor_note)

    else:
        # Fallback: no file path or unsupported format
        anchor_note = "⚠ Путь к файлу не указан или формат не поддерживается.\n"
        debug_lines.append(anchor_note)

        # Try anchor-based search in the pandas df as last resort
        anchor_idx = -1
        for i in range(min(len(df), 100)):
            for col_idx in range(len(df.columns)):
                cell = str(df.iloc[i, col_idx]).strip().lower()
                if "листов" in cell or "изм." in cell:
                    anchor_idx = i
                    break
            if anchor_idx != -1:
                break

        if anchor_idx != -1:
            slice_top = max(0, anchor_idx - 10)
            slice_bot = min(len(df), anchor_idx + 4)
            for ri in range(slice_top, slice_bot):
                cells = " | ".join(str(v).strip()[:40] for v in df.iloc[ri].values)
                debug_lines.append(f"R{ri:03d} | {cells} |")

    # --- Step 4: Extract general notes for the whole specification ---
    notes_parts = []
    extraction_log = "Init"
    if file_path and file_path.lower().endswith(".xls"):
        try:
            import xlrd
            wb_notes = xlrd.open_workbook(file_path, formatting_info=False)
            target_sheet = None
            for s in wb_notes.sheets():
                if "специф" in s.name.lower():
                    target_sheet = s
                    break
            if not target_sheet:
                target_sheet = wb_notes.sheet_by_index(min(1, wb_notes.nsheets - 1))

            if target_sheet:
                # 1. Identify "The Stamp Envelope" vertically
                # We use the row where the Cipher or Stamp Anchor was found
                stamp_top = -1
                stamp_bot = -1
                
                for r in range(target_sheet.nrows):
                    row_vals = [str(target_sheet.cell_value(r, c)).strip().lower() for c in range(target_sheet.ncols)]
                    row_str = " ".join(row_vals)
                    
                    # Top boundary: The Project Cipher or Name usually starts the stamp
                    if cipher and cipher.lower() in row_str:
                        if stamp_top == -1: stamp_top = r
                    
                    # Bottom boundary: Anchor "Листов" usually signals the end
                    if "листов" in row_str:
                        stamp_bot = r
                        if stamp_top == -1: stamp_top = max(0, r - 6) # Fallback if cipher not found
                        break
                
                if stamp_top != -1 and stamp_bot != -1:
                    extraction_log = f"Stamp range: R{stamp_top} to R{stamp_bot}"
                    # 2. Collect everything to the LEFT of signatures ONLY inside this envelope
                    # Scan from Cipher down to Stamp Bottom
                    for ri in range(stamp_top, stamp_bot + 2):
                        if ri >= target_sheet.nrows: break
                        row_vals = [str(target_sheet.cell_value(ri, ci)).strip() for ci in range(target_sheet.ncols)]
                        # Ignore columns where signatures usually reside (I-M)
                        left_zone = row_vals[:8]
                        for val in left_zone:
                            if len(val) > 15 or "примечание" in val.lower():
                                if val not in notes_parts:
                                    notes_parts.append(val)
                else:
                    extraction_log = f"Could not define stamp envelope (Top:{stamp_top}, Bot:{stamp_bot})"
        except Exception as e:
            extraction_log = f"Notes Error: {e}"

    # Concat into one sentence
    notes_str = " ".join(notes_parts) if notes_parts else "Отсутствуют"
    notes_str = re.sub(r'\s+', ' ', notes_str).strip()

    # ── 5. ASSEMBLE ──────────────────────────────────────────────────────────
    final_cipher = cipher or "В штампе не найден"
    final_dest = " — ".join(destination_parts) if destination_parts else "В штампе не найден"
    debug_grid = "\n".join(debug_lines)
    
    # Final debug report for user
    extraction_debug = f"\n\n=== NOTES EXTRACTION DEBUG ===\n"
    extraction_debug += f"Target Sheet: {target_sheet.name if 'target_sheet' in locals() and target_sheet else 'None'}\n"
    extraction_debug += f"Anchor Row: {anchor_row if 'anchor_row' in locals() else 'None'}\n"
    extraction_debug += f"Sig Start Column: {sig_col_idx if 'sig_col_idx' in locals() else 'None'}\n"
    extraction_debug += f"Raw fragments found: {notes_parts}\n"
    extraction_debug += f"Final string: {notes_str}\n"
    debug_grid += extraction_debug

    summary_md = f"### Общая сводка\n\n" \
                 f"**Номер спецификации:** {final_cipher}\n\n" \
                 f"**Назначение:** {final_dest}\n\n" \
                 f"**Позиций всего (объединённых):** {total_positions} шт.\n\n" \
                 f"**Поставщики в документе:** {suppliers_str}\n\n" \
                 f"**Примечания:**\n{notes_str}"

    return {
        "summary_md": summary_md,
        "debug_grid": debug_grid,
        "fields": {
            "cipher": final_cipher,
            "destination": final_dest,
            "total_positions": total_positions,
            "suppliers": suppliers_str,
            "notes": notes_str
        }
    }



def pdf_to_grid_markdown(file_path: str) -> str:
    """
    Converts a digital PDF invoice to Markdown using the Full Grid Method.
    Uses pdfplumber to extract tables and preserves document layout.
    """
    import pdfplumber
    rows_data = []
    max_w = 0

    try:
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                # Use extract_table with flexible settings for digital text alignment
                # Extracting all tables, joining them if they have consistent width
                tables = page.extract_tables({
                    "vertical_strategy": "text", 
                    "horizontal_strategy": "text",
                    "snap_tolerance": 3,
                    "join_tolerance": 3
                })
                
                if not tables:
                    # Fallback to simple line-based extraction if text-strategy found nothing
                    tables = page.extract_tables()
                
                for table in tables:
                    if not table: continue
                    page_max_w = len(table[0])
                    if page_max_w > max_w:
                        max_w = page_max_w
                        
                    for row in table:
                        clean_row = []
                        for cell in row:
                            if cell is None:
                                clean_row.append("")
                            else:
                                # Merge multi-line text into a single line with spaces
                                text = str(cell).replace("\r", " ").replace("\n", " ").strip()
                                clean_row.append(text)
                        
                        # Only add non-empty rows
                        if any(c for c in clean_row):
                            rows_data.append(clean_row)
                            
    except Exception as e:
        return f"Error reading PDF: {e}"

    if not rows_data:
        return ""

    # Format as Markdown Grid
    md_lines = []
    
    # Header
    header_row = [f"Col {i+1}" for i in range(max_w)]
    md_lines.append("| " + " | ".join(header_row) + " |")
    md_lines.append("| " + " | ".join(["---"] * max_w) + " |")
    
    # Content
    for r in rows_data:
        # Pad row to max_w if needed
        full_row = r + [""] * (max_w - len(r))
        row_str = [str(c).replace("|", "\\|") for c in full_row]
        md_lines.append("| " + " | ".join(row_str) + " |")
        
    return "\n".join(md_lines)


def excel_to_grid_markdown(file_path: str) -> str:
    """
    Converts an Excel invoice to Markdown using the Full Grid Method.
    Exports the entire sheet from row 0 up to max_row, with a fixed column count.
    Preserves merged cells and empty rows for a 1:1 visual representation.
    """
    filename = file_path.lower()
    rows_data = []
    max_w = 0

    # 1. Load Workbook
    if filename.endswith(".xls"):
        import xlrd
        try:
            wb = xlrd.open_workbook(file_path, formatting_info=True)
            sheet = None
            for sn in wb.sheet_names():
                if any(k in sn.lower() for k in ["счет", "invoice", "инвойс", "актуальн"]):
                    sheet = wb.sheet_by_name(sn)
                    break
            if not sheet: sheet = wb.sheet_by_index(0)
            
            merged = sheet.merged_cells
            max_w = sheet.ncols

            def is_merged_child(r, c):
                for rlo, rhi, clo, chi in merged:
                    if rlo <= r < rhi and clo <= c < chi:
                        if r == rlo and c == clo: return False
                        return True
                return False

            for r in range(sheet.nrows):
                row = []
                for c in range(sheet.ncols):
                    if is_merged_child(r, c):
                        row.append("")
                    else:
                        val = sheet.cell_value(r, c)
                        row.append(str(val).strip() if val is not None else "")
                rows_data.append(row)
        except Exception as e:
            return f"Error reading .xls: {e}"
            
    else: # .xlsx
        import openpyxl
        try:
            wb = openpyxl.load_workbook(file_path, data_only=True)
            sheet = None
            for sn in wb.sheetnames:
                if any(k in sn.lower() for k in ["счет", "invoice", "инвойс", "актуальн"]):
                    sheet = wb[sn]
                    break
            if not sheet: sheet = wb.active
            
            max_w = sheet.max_column
            
            merged_map = {}
            for m_range in sheet.merged_cells.ranges:
                for r in range(m_range.min_row, m_range.max_row + 1):
                    for c in range(m_range.min_col, m_range.max_col + 1):
                        if r == m_range.min_row and c == m_range.min_col:
                            merged_map[(r, c)] = False
                        else:
                            merged_map[(r, c)] = True

            for r in range(1, sheet.max_row + 1):
                row = []
                for c in range(1, sheet.max_column + 1):
                    if merged_map.get((r, c), False):
                        row.append("")
                    else:
                        val = sheet.cell(row=r, column=c).value
                        if val is None: val = ""
                        row.append(str(val).strip())
                rows_data.append(row)
        except Exception as e:
            return f"Error reading .xlsx: {e}"

    if not rows_data:
        return ""

    # 2. Find real data boundaries to avoid 1M empty rows if any
    # (Though sheet.max_row usually handles this, sometimes it's bloated)
    last_real_row = 0
    for idx, r in enumerate(rows_data):
        if any(str(c).strip() for c in r):
            last_real_row = idx + 1
            
    rows_data = rows_data[:last_real_row]
    if not rows_data: return ""

    # 3. Format as Markdown Grid
    md_lines = []
    
    # Header (just use indices for raw grid representation or first row)
    # The header line in markdown table is decorative in this "Raw Grid" case
    header_row = [f"Col {i+1}" for i in range(max_w)]
    md_lines.append("| " + " | ".join(header_row) + " |")
    md_lines.append("| " + " | ".join(["---"] * max_w) + " |")
    
    # All rows from 0 to last_real_row
    for r in rows_data:
        # Pad row to max_w if needed
        full_row = r + [""] * (max_w - len(r))
        row_str = [str(c).replace("|", "\\|").replace("\n", " ") for c in full_row]
        md_lines.append("| " + " | ".join(row_str) + " |")
        
    return "\n".join(md_lines)


def detect_pdf_type(file_path: str) -> str:
    """
    Detects if a PDF is text-based or a scan by checking the first page.
    """
    import pdfplumber
    try:
        with pdfplumber.open(file_path) as pdf:
            if not pdf.pages:
                return "SCAN_PDF"
            text = pdf.pages[0].extract_text() or ""
            # Threshold: more than 50 symbols of text = digital (TEXT_PDF)
            if len(text.strip()) > 50:
                return "TEXT_PDF"
            return "SCAN_PDF"
    except Exception as e:
        print(f"PDF Type Detection error: {e}")
        return "SCAN_PDF"


def ocr_to_grid_markdown(words: list) -> tuple:
    """
    STAGE 3.3 VERSION - UNIVERSAL MAGNETIC BUCKETS.
    1. Discovery: Finds Buyer (CLIENT_INN) and Supplier (Any other valid INN).
    2. Clustering: Magnetic Y-clustering (+/- 150px) around anchors.
    3. X-Separator: Physically split rows bridging two magnetic zones.
    4. Sanitizer: Full INN/BIK check + Trash filter.
    """
    if not words: return "", ""
    import re

    CLIENT_INN = "5905271743"
    
    # Discovery Phase
    supplier_y_anchors = []
    buyer_y_anchors = []
    
    # 1. Identify Anchor Points via Entity Validation
    for w in words:
        txt = w['text']
        if len(txt) >= 10:
            inn_cand = validate_and_clean_inn(txt)
            if inn_cand == CLIENT_INN:
                buyer_y_anchors.append(w['y'])
            elif inn_cand:
                supplier_y_anchors.append(w['y'])
        if "ММК-Пермь" in txt:
            buyer_y_anchors.append(w['y'])

    # 2. Row Grouping (Vertical normalization)
    words.sort(key=lambda w: w['y'])
    rows_grouped = []
    if words:
        current_row = [words[0]]
        for i in range(1, len(words)):
            if abs(words[i]['y'] - current_row[0]['y']) < 12: current_row.append(words[i])
            else:
                rows_grouped.append(current_row)
                current_row = [words[i]]
        rows_grouped.append(current_row)

    # 3. Magnetic Bucketing Logic
    s_lines, b_lines, tr_lines = [], [], []
    table_raw = ["### TABLE ###", "| № | Наименование товара | Кол-во | Ед. | Цена | Скидка | Сумма |", "| --- | --- | --- | --- | --- | --- | --- | --- |"]
    footer_raw = ["### FOOTER_DATA ###"]
    
    state = "HEADER"
    seen_unique = set()
    
    for row in rows_grouped:
        row.sort(key=lambda x: x['x'])
        row_y = row[0]['y']
        full_line = " ".join([w['text'] for w in row]).strip()
        l_line = full_line.lower()

        # Block Transitions
        if state == "HEADER" and any(k in l_line for k in ["наименование", "кол-во", "цена"]):
            state = "TABLE"
            continue
        elif state == "TABLE" and any(k in l_line for k in ["итого", "всего", "в том числе"]):
            state = "FOOTER"

        if state == "HEADER":
            # X-Split Logic: Identify split point if row spans zones
            # Use X of MMK anchor as split boundary if detected
            split_x = -1
            for ay in buyer_y_anchors:
                if abs(row_y - ay) < 150:
                    for w in row:
                        if CLIENT_INN in w['text'] or "ММК-Пермь" in w['text']:
                            split_x = w['x'] - 10
                            break
                    if split_x != -1: break
            
            # Divide row into two potential segments
            left_txt, right_txt = [], []
            if split_x != -1:
                for w in row:
                    if w['x'] < split_x: left_txt.append(w['text'])
                    else: right_txt.append(w['text'])
            else:
                left_txt = [w['text'] for w in row]

            for s_val in [" ".join(left_txt), " ".join(right_txt)]:
                s = s_val.strip()
                if not s or len(s) < 2: continue
                norm = re.sub(r'\W', '', s).lower()
                if norm in seen_unique: continue
                seen_unique.add(norm)

                # TRASH FILTER (Proximity check + Content check)
                is_buyer_prox = any(abs(row_y - ay) < 150 for ay in buyer_y_anchors)
                is_supplier_prox = any(abs(row_y - ay) < 150 for ay in supplier_y_anchors)
                
                has_digit = any(c.isdigit() for c in s)
                has_keys = any(k in s.upper() for k in ["ИНН", "КПП", "СЧЕТ", "АДРЕС", "БИК"])
                
                # Trash Rule: Short, no digits, no keys, and away from anchors
                if len(s) < 12 and not has_digit and not has_keys and not is_buyer_prox and not is_supplier_prox:
                    tr_lines.append(s)
                    continue

                # Final Magnetic Distribution
                if CLIENT_INN in s or "ММК-Пермь" in s:
                    b_lines.append(s)
                elif validate_and_clean_inn(s) or any(k in s.upper() for k in ["БИК", "КОРР.", "СЧ."]):
                    s_lines.append(s)
                elif is_buyer_prox:
                    b_lines.append(s)
                else: # Default or supplier proximity
                    s_lines.append(s)

        elif state == "TABLE":
            rd = {"№": "", "name": "", "qty": "", "un": "", "pr": "", "tot": ""}
            for w in row:
                x = int(w['x'])
                if x < 70: rd["№"] += " " + w['text']
                elif x < 500: rd["name"] += " " + w['text']
                elif x < 620: rd["qty"] += " " + w['text']
                elif x < 720: rd["un"] += " " + w['text']
                elif x < 870: rd["pr"] += " " + w['text']
                else: rd["tot"] += " " + w['text']
            
            def pk(v):
                m = re.findall(r'(\d+[\d\s,.]*)', v)
                return m[-1].strip() if m else v.strip()
            
            f_tot = pk(rd["tot"])
            if not f_tot and not any(c.isdigit() for c in rd["name"]) and len(rd["name"]) < 10: continue
            
            cols = [rd["№"].strip(), rd["name"].strip(), rd["qty"].strip(), rd["un"].strip(), pk(rd["pr"]), "", f_tot]
            table_raw.append("| " + " | ".join([c.replace("|", "") for c in cols]) + " |")

        elif state == "FOOTER":
            if full_line: footer_raw.append(full_line)

    res = [
        "### [SUPPLIER_DATA] ###", "\n".join(s_lines), "",
        "### [BUYER_DATA] ###", "\n".join(b_lines), "",
        "### [HEADER_TRASH] ###", "\n".join(tr_lines)
    ]
    return "\n".join(res), "\n".join(table_raw) + "\n\n" + "\n".join(footer_raw)

