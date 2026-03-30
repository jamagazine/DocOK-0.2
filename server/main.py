from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks, Body, Request, Header, Form
from fastapi.responses import FileResponse, PlainTextResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import json
import os
import shutil
import base64
import httpx
import re
import math
import tempfile
import asyncio
import pandas as pd, io
import pdfplumber
import datetime
from urllib.parse import quote
import rapidfuzz

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

app = FastAPI()

@app.get("/api/health")
async def health_check():
    return {"status": "ok"}

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

CONFIG_FILE = os.path.join(os.path.dirname(__file__), "config.json")
STORAGE_DIR = os.path.join(os.path.dirname(__file__), "storage")

os.makedirs(STORAGE_DIR, exist_ok=True)

MANIFEST_FILE = os.path.join(STORAGE_DIR, "manifest.json")
HISTORY_FILE = os.path.join(STORAGE_DIR, "history.json")

def _load_manifest():
    if not os.path.exists(MANIFEST_FILE):
        return {}
    try:
        with open(MANIFEST_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except:
        return {}

def _save_manifest(manifest):
    try:
        with open(MANIFEST_FILE, "w", encoding="utf-8") as f:
            json.dump(manifest, f, ensure_ascii=False, indent=4)
    except Exception as e:
        print(f"Error saving manifest: {e}")

def append_history(action_data: dict):
    history = []
    if os.path.exists(HISTORY_FILE):
        try:
            with open(HISTORY_FILE, "r", encoding="utf-8") as f:
                history = json.load(f)
        except Exception:
            pass
            
    if "timestamp" not in action_data:
        action_data["timestamp"] = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
    history.append(action_data)
    
    with open(HISTORY_FILE, "w", encoding="utf-8") as f:
        json.dump(history, f, ensure_ascii=False, indent=2)

def get_yandex_keys():
    if not os.path.exists(CONFIG_FILE):
        return None, None
    try:
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            keys = data.get("keys", data)
            api_key = keys.get("YANDEX_API_KEY", "").strip()
            folder_id = keys.get("YANDEX_FOLDER_ID", "").strip()
            if not api_key or not folder_id:
                return None, None
            return api_key, folder_id
    except:
        return None, None

@app.get("/api/storage/history/export")
async def export_history():
    if not os.path.exists(HISTORY_FILE):
        return PlainTextResponse("История пуста")
        
    try:
        with open(HISTORY_FILE, "r", encoding="utf-8") as f:
            history = json.load(f)
            
        lines = ["Дата | Файл | Модель | Режим | Цена | Токены | Статус"]
        for row in history:
            ts = row.get('timestamp', '')
            fn = row.get('fileName', '')
            model = row.get('model', '')
            method = row.get('method', '')
            cost = row.get('cost', 0)
            tokens = row.get('tokens', 0)
            status = row.get('status', '')
            lines.append(f"{ts} | {fn} | {model} | {method} | {cost} ₽ | {tokens} | {status}")
            
        return PlainTextResponse("\n".join(lines))
    except Exception as e:
        return PlainTextResponse(f"Ошибка чтения: {e}")

@app.get("/api/storage/history/export_xlsx")
async def export_history_xlsx():
    if not os.path.exists(HISTORY_FILE):
        return PlainTextResponse("История пуста")
        
    try:
        with open(HISTORY_FILE, "r", encoding="utf-8") as f:
            history = json.load(f)
            
        if not history:
            return PlainTextResponse("История пуста")
            
        df = pd.DataFrame(history)
        
        rename_map = {
            'timestamp': 'Дата',
            'fileName': 'Файл',
            'model': 'Модель',
            'method': 'Режим',
            'cost': 'Цена',
            'tokens': 'Токены',
            'status': 'Статус'
        }
        df = df.rename(columns=rename_map)
        
        cols = [c for c in rename_map.values() if c in df.columns]
        df = df[cols]
        
        if 'Цена' in df.columns:
            df['Цена'] = pd.to_numeric(df['Цена'], errors='coerce').fillna(0)
            total_cost = df['Цена'].sum()
            
            total_row = {col: '' for col in df.columns}
            total_row['Дата'] = 'ИТОГО'
            total_row['Цена'] = total_cost
            
            df = pd.concat([df, pd.DataFrame([total_row])], ignore_index=True)
            
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='История')
            
        output.seek(0)
        
        now = datetime.datetime.now()
        filename = f"Детализация по API - {now.strftime('%d.%m.%y')} - {now.strftime('%H-%M')}.xlsx"
        
        headers = {
            "Content-Disposition": f"attachment; filename*=utf-8''{quote(filename)}"
        }
        
        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers=headers
        )
            
    except Exception as e:
        import traceback
        traceback.print_exc()
        return PlainTextResponse(f"Ошибка создания XLSX: {e}")

@app.get("/api/config")
async def get_config():
    if not os.path.exists(CONFIG_FILE):
        return {"keys": {}}
    try:
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            if isinstance(data, dict) and "keys" in data:
                return data
            return {"keys": data if isinstance(data, dict) else {}}
    except Exception:
        return {"keys": {}}

@app.post("/api/config")
async def save_config(request: Request):
    data = await request.json()
    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=4)
    return {"status": "success", "saved": True}


async def ocr_yandex(b64_img: str, api_key: str, folder_id: str):
    url = "https://vision.api.cloud.yandex.net/vision/v1/batchAnalyze"
    headers = {
        "Authorization": f"Api-Key {api_key}",
        "x-folder-id": folder_id,
        "Content-Type": "application/json"
    }
    payload = {
        "folderId": folder_id,
        "analyze_specs": [{
            "content": b64_img,
            "features": [{
                "type": "TEXT_DETECTION",
                "text_detection_config": {
                    "language_codes": ["*"]
                }
            }]
        }]
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(url, headers=headers, json=payload)
        resp.raise_for_status()
        data = resp.json()

    text_parts = []
    has_low_confidence = False

    for result in data.get('results', []):
        for res2 in result.get('results', []):
            text_detection = res2.get('textDetection', {})
            for page in text_detection.get('pages', []):
                for block in page.get('blocks', []):
                    for line in block.get('lines', []):
                        for word in line.get('words', []):
                            conf = word.get('confidence', 1.0)
                            if conf < 0.8:
                                has_low_confidence = True
                            text_parts.append(word.get('text', ''))
                        text_parts.append('\n')

    return "".join(text_parts), has_low_confidence

async def gpt_yandex(text: str, api_key: str, folder_id: str, model_type: str = "lite", doc_type: str = "invoice"):
    url = "https://llm.api.cloud.yandex.net/foundationModels/v1/completion"
    headers = {
        "Authorization": f"Api-Key {api_key}",
        "x-folder-id": folder_id,
        "Content-Type": "application/json"
    }

    INVOICE_PROMPT = """Ты — интеллектуальный редакторТабличных данных. Тебе подана Markdown-таблица.
1. ВЕРНИ СТРОГО JSON: {"items": [...]}.
2. ТОЛЬКО ТОВАРЫ. Игнорируй заголовки, разделители, Итого.
3. МАТЕМАТИКА: quantity = total / price если количество пустое.
4. РАЗДЕЛЯЙ quantity и unit (напр. '10 кг' -> 10 и 'кг').
5. МАРКИРОВКА: коды систем ПЕ1, В1 и т.д. должны быть в name.
"""

    SPEC_PROMPT = """Ты — эксперт-корректор спецификаций. Markdown-таблица.
Колонки: 1:pos, 2:name, 3:brand, 4:code, 5:supplier, 6:unit, 7:quantity, 8:mass, 9:note.
1. ВЕРНИ JSON: {"items": [...]}.
2. row_type: LOCATION, GROUP или ITEM.
3. НУМЕРАЦИЯ: Соблюдай иерархию (1.1, 1.2...).
4. ИГНОРИРУЙ технические строки (1 | 2 | 3...).
"""

    system_prompt = SPEC_PROMPT if doc_type == "spec" else INVOICE_PROMPT
    user_text = f"Текст документа:\n{text}"
    
    # Отладка промпта
    try:
        with open(os.path.join(STORAGE_DIR, "last_prompt.txt"), "w", encoding="utf-8") as f:
            f.write(f"=== SYSTEM ({doc_type}) ===\n{system_prompt}\n\n=== USER ===\n{user_text}")
    except: pass

    model_uri = f"gpt://{folder_id}/yandexgpt-lite/latest" if model_type == "lite" else f"gpt://{folder_id}/yandexgpt/latest"
    payload = {
        "modelUri": model_uri,
        "completionOptions": {"stream": False, "temperature": 0.1, "maxTokens": "8000"},
        "messages": [
            {"role": "system", "text": system_prompt},
            {"role": "user", "text": user_text}
        ]
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(url, headers=headers, json=payload)
        resp.raise_for_status()
        data = resp.json()
        
    usage = data.get('result', {}).get('usage', {})
    total_tokens = int(usage.get('totalTokens', 0))
    return data['result']['alternatives'][0]['message']['text'], total_tokens


async def get_token_count(text: str, model_type: str, api_key: str, folder_id: str) -> int:
    url = "https://llm.api.cloud.yandex.net/foundationModels/v1/tokenize"
    headers = {
        "Authorization": f"Api-Key {api_key}",
        "x-folder-id": folder_id,
        "Content-Type": "application/json"
    }
    model_uri = f"gpt://{folder_id}/yandexgpt-lite/latest" if model_type == "lite" else f"gpt://{folder_id}/yandexgpt/latest"
    payload = {"modelUri": model_uri, "text": text}
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(url, headers=headers, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                return len(data.get("tokens", []))
    except: pass
    return 0


def parse_gpt_json(text: str):
    try:
        text = re.sub(r'```json|```', '', text).strip()
        match = re.search(r'(\[.*\]|\{.*\})', text, re.DOTALL)
        if match:
            return json.loads(match.group(1))
        return json.loads(text.strip())
    except:
        return None

async def process_chunks_with_gpt(full_text: str, api_key: str, folder_id: str, model_type: str = "lite", doc_type: str = "invoice"):
    lines = full_text.split('\n')
    header_block = "\n".join(lines[:2]) if len(lines) >= 2 else (lines[0] if lines else "")
    data_lines = lines[2:] if len(lines) >= 2 else []
    
    CHUNK_SIZE = 30
    all_items = []
    total_tokens = 0
    main_doc = {}

    chunks = [data_lines[i:i + CHUNK_SIZE] for i in range(0, len(data_lines), CHUNK_SIZE)]
    sem = asyncio.Semaphore(5)
    
    async def process_single_chunk(i, chunk):
        async with sem:
            chunk_text = header_block + "\n" + "\n".join(chunk)
            try:
                raw_res, tokens = await gpt_yandex(chunk_text, api_key, folder_id, model_type, doc_type)
                parsed = parse_gpt_json(raw_res)
                if parsed:
                    return i, True, parsed, tokens, None
                return i, False, None, tokens, "Невалидный JSON"
            except Exception as e:
                return i, False, None, 0, str(e)

    tasks = [process_single_chunk(i, chunk) for i, chunk in enumerate(chunks)]
    results = []
    for coro in asyncio.as_completed(tasks):
        res = await coro
        results.append(res)
        yield {"type": "progress", "index": res[0]+1, "total": len(chunks)}
    
    results.sort(key=lambda x: x[0])
    
    for i, ok, parsed, tokens, err_msg in results:
        total_tokens += tokens
        if ok and parsed:
            items_to_add = []
            if isinstance(parsed, list):
                items_to_add = parsed
            elif isinstance(parsed, dict):
                items_to_add = parsed.get('items', [])
            all_items.extend(items_to_add)
            if not main_doc and isinstance(parsed, dict) and parsed.get('document'):
                main_doc = parsed.get('document', {})
        else:
            all_items.append({"pos": "ERR", "name": f"Ошибка чанка {i+1}", "note": err_msg, "is_error_chunk": True})
            
    yield {"type": "result", "items": all_items, "tokens": total_tokens, "main_doc": main_doc, "chunks_report": []}

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


@app.post("/api/process-invoice")
async def process_invoice(
    file: UploadFile | None = File(None),
    file_id: str | None = Form(None),
    doc_type: str = Form("invoice"),
    parse_method: str = Form("auto"), 
    x_api_key: str | None = Header(None),
    x_folder_id: str | None = Header(None)
):
    api_key, folder_id = get_yandex_keys()
    if x_api_key: api_key = x_api_key
    if x_folder_id: folder_id = x_folder_id

    if not api_key or not folder_id:
        raise HTTPException(status_code=400, detail="Yandex API keys not configured.")

    if file_id:
        disk_name = file_id
        manifest = _load_manifest()
        original_name = manifest.get(disk_name, {}).get("originalName", disk_name)
    elif file:
        original_name = file.filename
        secured_name = secure_filename(transliterate(original_name))
        manifest = _load_manifest()
        disk_name = secured_name
        for k, v in manifest.items():
            if isinstance(v, dict) and (v.get("originalName") == original_name or v.get("original_name") == original_name):
                disk_name = k; break
    else:
        raise HTTPException(status_code=400, detail="Require file or file_id")

    filename = original_name.lower()
    temp_path = os.path.join(STORAGE_DIR, disk_name)
    cache_path = os.path.join(STORAGE_DIR, f"{disk_name}.json")
    is_spreadsheet = filename.endswith((".xlsx", ".xls", ".csv"))

    if file and not os.path.exists(temp_path):
        with open(temp_path, "wb") as f: shutil.copyfileobj(file.file, f)

    async def event_generator():
        yield f"data: {{json.dumps({{'status': 'stage', 'step': 'prep'}}, ensure_ascii=False)}}\n\n"
        if os.path.exists(cache_path):
            try:
                with open(cache_path, "r", encoding="utf-8") as f:
                    cached = json.load(f)
                cached["method"] = "CACHED"
                yield f"data: {json.dumps({'status': 'final', 'data': cached}, ensure_ascii=False)}\n\n"
                return
            except: pass
    
        extracted_text = ""
        has_low_confidence = False
        num_pages = 0
        
        try:
            if filename.endswith(".pdf"):
                ext_text = ""
                with pdfplumber.open(temp_path) as pdf:
                    for page in pdf.pages:
                        t = page.extract_text(x_tolerance=2, y_tolerance=3)
                        if t: ext_text += "\n".join([re.sub(r'\s{2,}', ' | ', l) for l in t.split('\n')]) + "\n"
                if ext_text.strip(): extracted_text = ext_text; p_method = "direct_text"
                else:
                    p_method = "ocr_table"
                    with pdfplumber.open(temp_path) as pdf:
                        num_pages = len(pdf.pages)
                        for i, pg in enumerate(pdf.pages):
                            img = io.BytesIO()
                            pg.to_image(resolution=150).original.save(img, format='PNG')
                            txt, low = await ocr_yandex(base64.b64encode(img.getvalue()).decode('utf-8'), api_key, folder_id)
                            extracted_text += f"\n--- Page {i+1} ---\n | " + " | ".join(txt.split("\n"))
                            if low: has_low_confidence = True
            elif filename.endswith((".xlsx", ".xls", ".csv")):
                df = pd.read_csv(temp_path, dtype=str) if filename.endswith(".csv") else pd.read_excel(temp_path, dtype=str)
                df = sanitize_dataframe(df.fillna(""))
                unnamed_empty = [c for c in df.columns if str(c).startswith("Unnamed") and (df[c].astype(str).replace("", "nan").isnull().all() or (df[c].astype(str).str.strip() == "").all())]
                if unnamed_empty: df = df.drop(columns=unnamed_empty)
                extracted_text = df.to_markdown(index=False, tablefmt="pipe", disable_numparse=True)
                p_method = "excel_ai"
            else:
                p_method = "ocr_table"
                with open(temp_path, "rb") as f:
                    txt, low = await ocr_yandex(base64.b64encode(f.read()).decode('utf-8'), api_key, folder_id)
                extracted_text = " | " + " | ".join(txt.split("\n"))
                has_low_confidence = low

            if is_spreadsheet and p_method == "auto":
                all_items = convert_df_to_items(df)
                total_tokens = 0
                main_doc = {"name": original_name}
            else:
                model = "pro" if p_method == "ocr_table" else "lite"
                async for ev in process_chunks_with_gpt(extracted_text, api_key, folder_id, model, doc_type):
                    if ev["type"] == "progress":
                        yield f"data: {json.dumps({'status': 'chunk', 'index': ev['index'], 'total': ev['total']}, ensure_ascii=False)}\n\n"
                    elif ev["type"] == "result":
                        all_items, total_tokens, main_doc = ev["items"], ev["tokens"], ev["main_doc"]

            final_struct = calculate_uncertainty({"document": main_doc or {"name": original_name}, "items": all_items}, has_low_confidence)
            rate = 1.2 if p_method == "ocr_table" else 0.2
            cost = round((total_tokens * rate) / 1000 + (num_pages * 1.22 if p_method == "ocr_table" else 0), 2)
            final_struct.update({"cost": cost, "method": p_method, "usage": {"total_tokens": total_tokens}})
            
            with open(cache_path, "w", encoding="utf-8") as f: json.dump(final_struct, f, ensure_ascii=False, indent=2)
            append_history({"fileName": original_name, "cost": cost, "tokens": total_tokens, "status": "DONE"})
            yield f"data: {json.dumps({'status': 'final', 'data': final_struct}, ensure_ascii=False)}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'status': 'error', 'detail': str(e)}, ensure_ascii=False)}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


def transliterate(text: str) -> str:
    ru = "абвгдёезийклмнопрстуфхцчшщъыьэюяАБВГДЁЕЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ"
    en = ["a", "b", "v", "g", "d", "yo", "e", "z", "i", "j", "k", "l", "m", "n", "o", "p", "r", "s", "t", "u", "f", "h", "ts", "ch", "sh", "shch", "", "y", "", "e", "yu", "ya", "A", "B", "V", "G", "D", "Yo", "E", "Z", "I", "J", "K", "L", "M", "N", "O", "P", "R", "S", "T", "U", "F", "H", "Ts", "Ch", "Sh", "Shch", "", "Y", "", "E", "Yu", "Ya"]
    return "".join({ru[i]: en[i] for i in range(len(ru))}.get(c, c) for c in text)

def secure_filename(filename: str) -> str:
    return re.sub(r'[^a-zA-Z0-9._-]', '_', filename)

@app.post("/api/match-items")
async def match_items_endpoint(request: Request):
    data = await request.json()
    invoice_items, spec_items = data.get("invoice_items", []), data.get("spec_items", [])
    spec_dict = [{"id": s.get("id"), "raw": s.get("name", ""), "norm": normalize_for_match(str(s.get("name", "")))} for s in spec_items if s.get("id")]
    for item in invoice_items:
        norm_i, best, best_s = normalize_for_match(str(item.get("name", ""))), None, 0
        if norm_i and spec_dict:
            for s in spec_dict:
                sc = rapidfuzz.fuzz.token_sort_ratio(norm_i, s["norm"])
                if sc > best_s: best_s, best = sc, s
        item["match_data"] = {"target_id": best["id"] if best else None, "target_name": best["raw"] if best else None, "score": round(best_s, 1), "status": "perfect" if best_s > 90 else ("warning" if best_s >= 60 else "none")}
    return {"invoice_items": invoice_items}

def sanitize_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    df = df.fillna("").astype(str)
    c_p, c_n = 0, 1
    for i, c in enumerate(df.columns):
        cl = str(c).lower()
        if any(x in cl for x in ["поз", "№", "unnamed: 0"]): c_p = i
        elif any(x in cl for x in ["наименован", "названи", "товар"]): c_n = i
    last = ""
    for i in range(len(df)):
        p, n = df.iloc[i, c_p].strip(), df.iloc[i, c_n].strip()
        if (not p or p=="nan") and n:
            m = re.match(r'^(\d+(?:\.\d+)*)\.?\s*(.*)', n)
            if m: df.iloc[i, c_p], df.iloc[i, c_n], p = m.group(1), m.group(2), m.group(1)
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

@app.post("/api/storage/upload")
async def storage_upload(file: UploadFile = File(...)):
    original_filename = file.filename
    transliterated = transliterate(original_filename)
    secured_name = secure_filename(transliterated)
    dest_path = os.path.join(STORAGE_DIR, secured_name)
    with open(dest_path, "wb") as f:
        shutil.copyfileobj(file.file, f)
        
    estimated_cost = 0.0
    estimated_tokens = 0
    api_key, folder_id = get_yandex_keys()
    ext_text = ""
    is_spreadsheet = original_filename.lower().endswith((".xlsx", ".xls", ".csv"))
    
    # Pre-parse format immediately
    if is_spreadsheet:
        try:
            if original_filename.lower().endswith(".csv"): df = pd.read_csv(dest_path, dtype=str)
            elif original_filename.lower().endswith(".xls"): df = pd.read_excel(dest_path, engine='xlrd', dtype=str)
            else: df = pd.read_excel(dest_path, engine='openpyxl', dtype=str)
            
            df = df.dropna(how='all').fillna("")
            df = sanitize_dataframe(df)
            unnamed_empty = [c for c in df.columns if str(c).startswith("Unnamed") and (df[c].astype(str).replace("", "nan").isnull().all() or (df[c].astype(str).str.strip() == "").all())]
            if unnamed_empty: df = df.drop(columns=unnamed_empty)
            md_text = df.to_markdown(index=False, tablefmt="pipe", disable_numparse=True)
            ext_text = md_text
            estimated_tokens = int((len(ext_text) / 4) * 2.0)
            estimated_cost = round((estimated_tokens * 0.2) / 1000, 2)
        except Exception as e:
            print(f"Spreadsheet processing error: {e}")
    elif api_key and folder_id:
        try:
            if original_filename.lower().endswith(".pdf"):
                with pdfplumber.open(dest_path) as pdf:
                    pages = len(pdf.pages)
                    if pages > 0:
                        estimated_cost = round(pages * 7.0, 2)
                        estimated_tokens = pages * 5000
            elif original_filename.lower().endswith((".png", ".jpg", ".jpeg")):
                estimated_tokens = 5000
                estimated_cost = 7.0
        except Exception as e:
            print(f"Error estimating cost: {e}")
            
    manifest = _load_manifest()
    existing = manifest.get(secured_name, {})
    manifest[secured_name] = {
        "originalName": original_filename,
        "status": "READY_MD" if is_spreadsheet else "ok",
        "cost": existing.get("cost", 0) if isinstance(existing, dict) else 0,
        "tokens": existing.get("tokens", 0) if isinstance(existing, dict) else 0,
        "model": existing.get("model", "") if isinstance(existing, dict) else "",
        "method": existing.get("method", "") if isinstance(existing, dict) else "",
        "estimated_cost": estimated_cost,
        "estimated_tokens": estimated_tokens
    }
    _save_manifest(manifest)
    
    append_history({
        "fileName": original_filename, "method": "", "model": "", "cost": 0, "tokens": 0, "status": "UPLOAD"
    })
    
    return {
        "status": "success", 
        "filename": secured_name, 
        "estimated_cost": estimated_cost, 
        "estimated_tokens": estimated_tokens, 
        "raw_markdown": ext_text if is_spreadsheet else None
    }

@app.get("/api/storage/files")
async def storage_list():
    manifest = _load_manifest()
    files = []
    if os.path.exists(STORAGE_DIR):
        for f in os.listdir(STORAGE_DIR):
            if f=="manifest.json" or f.startswith('.') or f.endswith((".json", ".md")): continue
            entry = manifest.get(f, {})
            files.append({"name": entry.get("originalName", f), "disk_name": f, "status": entry.get("status", "ok"), "cost": entry.get("cost", 0)})
    return files

@app.patch("/api/storage/files/{name}")
async def storage_update_file(name: str, data: dict):
    m = _load_manifest()
    for k, v in m.items():
        if isinstance(v, dict) and v.get("originalName")==name:
            v.update({ki: vi for ki, vi in data.items() if ki in ["status", "cost", "tokens"]})
            _save_manifest(m); return {"ok": True}
    raise HTTPException(status_code=404)

@app.delete("/api/storage/files/{name}")
async def storage_delete(name: str, nuclear: bool = False):
    m = _load_manifest()
    dk = None
    for k, v in m.items():
        if isinstance(v, dict) and v.get("originalName")==name: dk = k; break
    if not dk: dk = secure_filename(name)
    for ext in ["", ".json", ".md"]:
        p = os.path.join(STORAGE_DIR, dk + ext)
        if os.path.exists(p): os.remove(p)
    if dk in m: del m[dk]; _save_manifest(m)
    return {"status": "success"}

@app.get("/api/storage/files/{name}")
async def storage_get(name: str):
    m = _load_manifest()
    dk = None
    for k, v in m.items():
        if isinstance(v, dict) and v.get("originalName")==name: dk = k; break
    p = os.path.join(STORAGE_DIR, dk or secure_filename(name))
    if os.path.exists(p): return FileResponse(p)
    raise HTTPException(status_code=404)
