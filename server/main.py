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
    "мм": "миллиметр", "мм.": "миллиметр",
    "см": "сантиметр", "см.": "сантиметр",
    "км": "километр", "км.": "километр",
    "га": "гектар",
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
    return UNITS_MAP.get(cleaned, unit_str) # Возвращаем нормализованное значение, либо оригинал

def normalize_for_match(text: str) -> str:
    if not text: return ""
    # Lowercase, trim
    t = text.lower().strip()
    # Remove punctuation, keeping alphanumeric and russian letters
    t = re.sub(r'[^\w\sа-яё]', ' ', t)
    # Remove extra spaces
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
TEMP_INPUT_DIR = os.path.join(os.path.dirname(__file__), "temp_output")
STORAGE_DIR = os.path.join(os.path.dirname(__file__), "storage")

# Ensure dirs exist
os.makedirs(TEMP_INPUT_DIR, exist_ok=True)
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
        
        # Rename columns to Russian
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
        
        # Keep only known columns if history json has others
        cols = [c for c in rename_map.values() if c in df.columns]
        df = df[cols]
        
        # Make cost numeric and sum it
        if 'Цена' in df.columns:
            df['Цена'] = pd.to_numeric(df['Цена'], errors='coerce').fillna(0)
            total_cost = df['Цена'].sum()
            
            # Append TOTAL row
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

    # Deep parse vision structure
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

    INVOICE_PROMPT = """Ты — интеллектуальный редактор-корректор табличных данных. Тебе подана Markdown-таблица, которая может содержать ошибки: разорванные строки, смещенные колонки или неточное распознавание текста.

}

ПРАВИЛА ОЧИСТКИ (КРИТИЧЕСКИ ВАЖНО):
1. ВЕРНИ РЕЗУЛЬТАТ СТРОГО В ВИДЕ JSON-ОБЪЕКТА: {"items": [...]}.
2. НИКОГДА не возвращай просто массив []. Всегда оборачивай его в объект с ключом "items".
3. ТОЛЬКО ТОВАРЫ: В массив "items" включай ТОЛЬКО реальные товары или услуги. 
4. ИГНОРИРУЙ: заголовки таблиц, строки-разделители (|---|), пустые строки, техническую информацию, "Итого", "В том числе НДС".
5. Если поле отсутствует в тексте, оставляй значение пустым ("").
5. МАТЕМАТИЧЕСКИЙ САМОКОНТРОЛЬ: Если поле quantity (количество) в документе пустое или содержит нечитаемый текст, ты ОБЯЗАН вычислить его по формуле: quantity = total (сумма по позиции) / price (цена за единицу). Сверь полученное число с текстом в колонке 'Количество'.
6. РАЗДЕЛЕНИЕ КОЛИЧЕСТВА: Поле quantity должно содержать ТОЛЬКО число (цифры и точка). Поле unit должно содержать единицу измерения. Если в исходных данных они склеены (например, '5 шт', '10 кг'), ты ОБЯЗАН их разделить. Даже если они попали в одну "ячейку" между |.
7. ОБРАБОТКА ПЕРЕНОСОВ: Игнорируй любые переносы строк внутри ячеек. Например, '5\\nшт' должно превратиться в quantity: 5, unit: 'шт'.
8. ОЧИСТКА ЧИСЕЛ: Поля quantity, price и total должны содержать только цифры и точку. Без пробелов и букв.
9. КОНТЕКСТ ЕДИНИЦ: Если единица измерения не указана явно, но понятна из контекста — заполни unit (по умолчанию ставь 'шт').
10. МАРКИРОВКА СИСТЕМ (ПЕ1, В1, К1 и т.д.): Если перед названием товара стоит короткий код системы (ПЕ, В, К, П + цифра), он ОБЯЗАН быть частью поля name. Пример: | ПЕ1 | Клапан... -> name: "ПЕ1 Клапан...". НИКОГДА не клади эти коды в поле article. Артикул — это только заводской шифр производителя."""

    SPEC_PROMPT = """Ты — эксперт-корректор инженерных спецификаций. Тебе подана Markdown-таблица.
Твоя задача — исправить возможные ошибки распознавания (склеить разорванные строки, сопоставить данные с ключами) и вернуть результат в JSON.

Колонки (разделитель |): 1:pos, 2:name, 3:brand, 4:code, 5:supplier, 6:unit, 7:quantity, 8:mass, 9:note.

ПРАВИЛА КЛАССИФИКАЦИИ (КРИТИЧЕСКИ ВАЖНО):
1. ВЕРНИ РЕЗУЛЬТАТ СТРОГО В ВИДЕ JSON-ОБЪЕКТА: {"items": [...]}.
2. КАЖДАЯ СТРОКА должна иметь поле "row_type" со значением:
   - "LOCATION": если это название площадки/цеха (нет номера позиции, нет цифр в начале).
   - "GROUP": если это заголовок группы (нет номера позиции, но в названии есть цифра с точкой, напр. "1. Изделия").
   - "ITEM": если это конкретный товар/оборудование с номером позиции (напр. "1.1").
3. ПОРЯДОК: Не меняй порядок строк! Возвращай их ровно так, как они идут в Markdown. Запрещено объединять одинаковые локации, если они разнесены в тексте.
4. НУМЕРАЦИЯ (ВЛОЖЕННОСТЬ): Если в группе "2. Изделия" товар имеет номер "1.31" — ИСПРАВЬ его на логическое продолжение "2.1", "2.2" и т.д. Соблюдай иерархию родительского заголовка.
5. ПОЛЯ: Для LOCATION и GROUP поля quantity, mass и т.д. оставляй пустыми ("").
6. ИГНОРИРУЙ: только технические строки Markdown (разделители |---|). Все текстовые заголовки ДОЛЖНЫ быть в JSON с соответствующим row_type.
7. ФОРМАТ: СТРОГО JSON. Без пояснений и markdown."""

    system_prompt = SPEC_PROMPT if doc_type == "spec" else INVOICE_PROMPT

    user_text = f"Текст документа:\n{text}"
    
    # DEBUG: Save last prompt
    try:
        debug_path = os.path.join(TEMP_INPUT_DIR, "last_prompt.txt")
        with open(debug_path, "w", encoding="utf-8") as f:
            f.write("=== SYSTEM PROMPT ===\n")
            f.write(system_prompt + "\n\n")
            f.write("=== USER TEXT ===\n")
            f.write(user_text)
    except Exception as e:
        print(f"Failed to save debug prompt: {e}")

    model_uri = f"gpt://{folder_id}/yandexgpt-lite/latest" if model_type == "lite" else f"gpt://{folder_id}/yandexgpt/latest"
    payload = {
        "modelUri": model_uri,
        "completionOptions": {
            "stream": False,
            "temperature": 0.1,
            "maxTokens": "8000"
        },
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
    payload = {
        "modelUri": model_uri,
        "text": text
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(url, headers=headers, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                return len(data.get("tokens", []))
    except Exception as e:
        print(f"Tokenize API error: {e}")
    return 0


def parse_gpt_json(text: str):
    try:
        text = re.sub(r'```json|```', '', text).strip()
        # Try finding json structure first
        match = re.search(r'(\[.*\]|\{.*\})', text, re.DOTALL)
        if match:
            return json.loads(match.group(1))
        # Fallback to direct parse
        return json.loads(text.strip())
    except Exception as e:
        print(f"JSON Parse Error: {e}")
        return None

async def process_chunks_with_gpt(full_text: str, api_key: str, folder_id: str, model_type: str = "lite", doc_type: str = "invoice"):
    """
    Inteligently splits text into chunks if it exceeds token limits, otherwise sends the whole document.
    """
    initial_tokens = await get_token_count(full_text, model_type, api_key, folder_id)
    chunks_report = []
    
    lines = full_text.split('\n')
    # Markdown tables have header at lines 0 and separator at line 1
    header_block = "\n".join(lines[:2]) if len(lines) >= 2 else (lines[0] if lines else "")
    data_lines = lines[2:] if len(lines) >= 2 else []
    
    CHUNK_SIZE = 30
    all_items = []
    total_tokens = 0
    main_doc = {}

    # Split into chunks
    chunks = [data_lines[i:i + CHUNK_SIZE] for i in range(0, len(data_lines), CHUNK_SIZE)]
    print(f"Document split into {len(chunks)} chunks.")
    
    sem = asyncio.Semaphore(5)
    
    async def process_single_chunk(i, chunk):
        async with sem:
            print(f"Processing chunk {i+1} of {len(chunks)}...")
            chunk_text = header_block + "\n" + "\n".join(chunk)
            try:
                raw_res, tokens = await gpt_yandex(chunk_text, api_key, folder_id, model_type, doc_type)
                parsed = parse_gpt_json(raw_res)
                if parsed:
                    return i, True, parsed, tokens, None
                else:
                    print(f"Chunk {i+1}: GPT returned invalid JSON, skipping.")
                    return i, False, None, tokens, "ИИ вернул невалидный JSON"
            except Exception as chunk_err:
                print(f"Chunk {i+1} failed: {chunk_err}. Skipping.")
                return i, False, None, 0, str(chunk_err)

    tasks = [process_single_chunk(i, chunk) for i, chunk in enumerate(chunks)]
    results = []
    
    for coro in asyncio.as_completed(tasks):
        res = await coro
        results.append(res)
        yield {"type": "progress", "index": res[0]+1, "total": len(chunks)}
    
    # Sort results STRICTLY by chunk index to maintain order
    results.sort(key=lambda x: x[0])
    
    for i, ok, parsed, tokens, err_msg in results:
        total_tokens += tokens
        if ok and parsed:
            # Safe item extraction (TK v1.10)
            items_to_add = []
            if isinstance(parsed, list):
                items_to_add = parsed
            elif isinstance(parsed, dict):
                items_to_add = parsed.get('items', [])
            
            all_items.extend(items_to_add)
            
            if not main_doc and isinstance(parsed, dict) and parsed.get('document'):
                main_doc = parsed.get('document', {})
            chunks_report.append({"id": i+1, "ok": True})
        else:
            chunks_report.append({"id": i+1, "ok": False})
            all_items.append({
                "pos": "ERROR",
                "name": f"Ошибка обработки блока строк {i+1}",
                "note": err_msg or "Неизвестная ошибка",
                "is_error_chunk": True
            })
            
    # If all items failed but we have a main_doc (unlikely), or no items at all
    if not all_items and not main_doc:
        yield {"type": "result", "items": None, "tokens": total_tokens, "main_doc": None, "chunks_report": chunks_report}
        return
        
    yield {"type": "result", "items": all_items, "tokens": total_tokens, "main_doc": main_doc, "chunks_report": chunks_report}

def to_float(val) -> float:
    if not val: return 0.0
    val_str = str(val).replace(' ', '').replace(',', '.')
    # extract first numeric float structure
    match = re.search(r'-?\d+(\.\d+)?', val_str)
    if match:
        return float(match.group(0))
    return 0.0

def calculate_uncertainty(struct: dict, global_low_conf: bool):
    doc_metadata = struct.get("document", {}).get("metadata", {})
    inn = str(doc_metadata.get("inn", "")).strip()
    inn = re.sub(r'\D', '', inn)
    
    inn_uncertain = len(inn) > 0 and len(inn) not in (10, 12)

    items = struct.get("items", [])
    for item in items:
        # Default assume uncertain if document had bad OCR, or INN is wrong length
        is_uncertain = global_low_conf or inn_uncertain
        
        # Pre-process double column in quantity before any math
        raw_qty = str(item.get("quantity", "")).strip()
        # Look for a number pattern optionally followed by some text
        match_qty = re.match(r'^([\d\.\,\s]+)(.*?)$', raw_qty)
        if match_qty and match_qty.group(2).strip():
            # Looks like it has both numbers and text (e.g. "10.5 кг")
            num_part = match_qty.group(1).strip()
            text_part = match_qty.group(2).strip()
            item["quantity"] = num_part
            # Use text_part as unit only if unit was empty
            if not item.get("unit"):
                item["unit"] = text_part
                
        # Normalize unit
        if item.get("unit"):
            item["unit"] = normalize_unit(str(item.get("unit")))

        # Check math
        qty = to_float(item.get("quantity"))
        price = to_float(item.get("price"))
        total = to_float(item.get("total"))
        
        math_error = False
        if qty > 0 and price > 0 and total > 0:
            calc_total = qty * price
            # Diff > 5% means it's likely a parsing/math issue for uncertainty
            if abs(calc_total - total) > (0.05 * total):
                is_uncertain = True
            
            # Strict math police check with 0.1 tolerance for rounding
            if abs(calc_total - total) >= 0.1:
                math_error = True
                
        # Required field missing
        if not item.get("name"):
            is_uncertain = True

        item["isUncertain"] = is_uncertain
        if math_error:
            item["math_error"] = True
        
    return struct


@app.post("/api/process-invoice")
async def process_invoice(
    file: UploadFile = File(...),
    doc_type: str = Form("invoice"),
    x_api_key: str | None = Header(None),
    x_folder_id: str | None = Header(None)
):
    print(f"DEBUG: Processing file: {file.filename}, doc_type: {doc_type}")
    api_key, folder_id = get_yandex_keys()
    
    # Override with provided keys if present
    if x_api_key: api_key = x_api_key
    if x_folder_id: folder_id = x_folder_id

    if not api_key or not folder_id:
        raise HTTPException(status_code=400, detail="YANDEX API keys not configured. Please save keys in settings.")

    filename = file.filename.lower()
    
    # Secure filename
    secured_name = secure_filename(transliterate(file.filename))
    original_name = file.filename # Store original name for history/manifest
    
    # Save file temporarily
    temp_path = os.path.join(TEMP_INPUT_DIR, secured_name)
    with open(temp_path, "wb") as f:
        shutil.copyfileobj(file.file, f)
        
    async def event_generator():
        yield f"data: {json.dumps({'status': 'stage', 'step': 'prep'}, ensure_ascii=False)}\n\n"
        # CACHE CHECK
        cache_path = os.path.join(STORAGE_DIR, f"{secured_name}.json")
        if os.path.exists(cache_path):
            try:
                with open(cache_path, "r", encoding="utf-8") as f:
                    cached_data = json.load(f)
                    
                cached_data["cost"] = 0
                cached_data["method"] = "CACHED"
                cached_data["model"] = "CACHED"
                
                append_history({
                    "fileName": original_name,
                    "method": "CACHED",
                    "model": "CACHED",
                    "cost": 0,
                    "tokens": 0,
                    "status": "CACHED_RESTORE"
                })
                
                manifest = _load_manifest()
                for k, v in manifest.items():
                    if isinstance(v, dict) and k == secured_name:
                        v["cost"] = 0
                        v["tokens"] = 0
                        v["method"] = "CACHED"
                        v["model"] = "CACHED"
                        break
                _save_manifest(manifest)
                
                yield f"data: {json.dumps({'status': 'final', 'data': cached_data}, ensure_ascii=False)}\n\n"
                return
            except Exception as e:
                print(f"Cache read error: {e}")
    
        extracted_text = ""
        has_low_confidence = False
        parse_method = "direct_text"
        num_pages = 0
        
        try:
            if filename.endswith(".pdf"):
                ext_text = ""
                try:
                    with pdfplumber.open(temp_path) as pdf:
                        for page in pdf.pages:
                            page_text = page.extract_text(x_tolerance=2, y_tolerance=3)
                            # Attempt to replace multiple spaces with | to form logical columns for GPT
                            if page_text:
                                formatted_lines = [re.sub(r'\s{2,}', ' | ', line) for line in page_text.split('\n')]
                                ext_text += "\n".join(formatted_lines) + "\n"
                except Exception as e:
                    print(f"pdfplumber error: {e}")
    
                if ext_text.strip():
                    extracted_text = ext_text
                    parse_method = "direct_text"
                else:
                    print("No text layer found. Falling back to OCR.")
                    parse_method = "ocr_table"
                    extracted_text = "" # Reset
                    with pdfplumber.open(temp_path) as pdf:
                        num_pages = len(pdf.pages)
                        for i, page in enumerate(pdf.pages):
                            page_img = page.to_image(resolution=150)
                            img_byte_arr = io.BytesIO()
                            page_img.original.save(img_byte_arr, format='PNG')
                            b64_str = base64.b64encode(img_byte_arr.getvalue()).decode('utf-8')
                            
                            txt, low_conf = await ocr_yandex(b64_str, str(api_key), str(folder_id))
                            # OCR response is raw so we don't have delimiters easily, but we can do a simple split join
                            formatted_ocr = " | ".join([line.strip() for line in txt.split("\n") if line.strip()])
                            extracted_text += f"\n--- Page {i+1} ---\n | {formatted_ocr}\n"
                            if low_conf:
                                has_low_confidence = True
                
            elif filename.endswith((".png", ".jpg", ".jpeg")):
                parse_method = "ocr_table"
                num_pages = 1
                with open(temp_path, "rb") as fimg:
                    b64_str = base64.b64encode(fimg.read()).decode('utf-8')
                txt, low_conf = await ocr_yandex(b64_str, str(api_key), str(folder_id))
                formatted_ocr = " | ".join([line.strip() for line in txt.split("\n") if line.strip()])
                extracted_text += f" | {formatted_ocr}"
                if low_conf:
                    has_low_confidence = True
                    
            elif filename.endswith((".xlsx", ".xls", ".csv")):
                md_path = os.path.join(STORAGE_DIR, f"{secured_name}.md")
                if os.path.exists(md_path):
                    with open(md_path, "r", encoding="utf-8") as fmd:
                        extracted_text = fmd.read()
                else:
                    # Fallback to direct reading if .md missing
                    if filename.endswith(".csv"):
                        df = pd.read_csv(temp_path)
                    elif filename.endswith(".xls"):
                        df = pd.read_excel(temp_path, engine='xlrd')
                    else:
                        df = pd.read_excel(temp_path, engine='openpyxl')
                    
                    df = df.dropna(how='all')
                    df = df.fillna("")
                    extracted_text = df.to_markdown(index=False, tablefmt="pipe")
                has_low_confidence = False
                
            else:
                yield f"data: {json.dumps({'status': 'error', 'detail': 'Unsupported file format.'}, ensure_ascii=False)}\n\n"
                return
                
            if not extracted_text.strip():
                 yield f"data: {json.dumps({'status': 'error', 'detail': 'No readable text found in document.'}, ensure_ascii=False)}\n\n"
                 return
                 
            # Call GPT to structure the data using chunking
            model_type = "pro" if parse_method == "ocr_table" else "lite"
            all_items = None
            total_tokens = 0
            main_doc_info = None
            all_chunks_report = []
            async for event in process_chunks_with_gpt(extracted_text, str(api_key), str(folder_id), model_type, doc_type):
                if event["type"] == "progress":
                    msg = {"status": "chunk", "index": event["index"], "total": event["total"]}
                    yield f"data: {json.dumps(msg, ensure_ascii=False)}\n\n"
                elif event["type"] == "result":
                    all_items = event["items"]
                    total_tokens = event["tokens"]
                    main_doc_info = event["main_doc"]
                    all_chunks_report = event["chunks_report"]
            
            if all_items is None:
                yield f"data: {json.dumps({'status': 'error', 'detail': 'ИИ вернул невалидный ответ'}, ensure_ascii=False)}\n\n"
                return
            
            # Merge into a single struct for compatibility with existing calculate_uncertainty
            merged_struct = {
                "document": main_doc_info or {"name": file.filename, "metadata": {}},
                "items": all_items
            }
            
            # Override document name for UI grouping if GPT couldn't figure it out
            if not merged_struct["document"].get("name"):
                 merged_struct["document"]["name"] = file.filename
            else:
                 merged_struct["document"]["filename"] = file.filename
                 
            try:
                final_struct = calculate_uncertainty(merged_struct, has_low_confidence)
            except Exception as e:
                print(f"calculate_uncertainty error: {e}")
                final_struct = merged_struct
            
            # Pro rate: 1.2 RUB per 1000 tokens, Lite: 0.2 RUB per 1000 tokens
            model_rate = 1.2 if model_type == "pro" else 0.2
            cost = round((total_tokens * model_rate) / 1000, 2)
            if parse_method == "ocr_table":
                cost += round(num_pages * 1.22, 2)
            
            # Add usage and cost to the final return
            final_struct["usage"] = {"total_tokens": total_tokens}
            final_struct["cost"] = round(cost, 2)
            final_struct["method"] = parse_method
            final_struct["model"] = model_type
            final_struct["chunks_report"] = all_chunks_report
            final_struct["total_chunks"] = len(all_chunks_report) if all_chunks_report else 1
            final_struct["processed_count"] = sum(1 for c in all_chunks_report if c.get("ok")) if all_chunks_report else 1
            
            # Save cache
            try:
                with open(cache_path, "w", encoding="utf-8") as f:
                    json.dump(final_struct, f, ensure_ascii=False, indent=2)
            except Exception as e:
                print(f"Failed to write cache: {e}")
                
            append_history({
                "fileName": original_name,
                "method": parse_method,
                "model": model_type,
                "cost": round(cost, 2),
                "tokens": total_tokens,
                "status": "FIRST_RUN"
            })
            
            # Persist cost + tokens to manifest
            manifest = _load_manifest()
            for k, v in manifest.items():
                if isinstance(v, dict) and (v.get("originalName") == original_name or v.get("original_name") == original_name):
                    v["status"] = "PROCESSED"
                    v["cost"] = round(cost, 2)
                    v["tokens"] = total_tokens
                    v["method"] = parse_method
                    v["model"] = model_type
                    break
            _save_manifest(manifest)
            
            # Get estimated from manifest
            estimated_cost = 0.0
            for k, v in manifest.items():
                if isinstance(v, dict) and (v.get("originalName") == original_name or v.get("original_name") == original_name):
                    estimated_cost = v.get("estimated_cost", 0.0)
                    break
            
            print(f"DEBUG ECONOMY: {filename} | Est: {estimated_cost} руб | Real: {cost} руб")
            
            yield f"data: {json.dumps({'status': 'final', 'data': final_struct}, ensure_ascii=False)}\n\n"
    
        except Exception as e:
            import traceback
            traceback.print_exc()
            err_msg = str(e)
            if "getaddrinfo failed" in err_msg or "11002" in err_msg or "ConnectError" in err_msg:
                err_msg = "Ошибка соединения с Yandex Cloud. Проверьте интернет."
            yield f"data: {json.dumps({'status': 'error', 'detail': err_msg}, ensure_ascii=False)}\n\n"
        finally:
            # DEBUG: Disabled cleanup per user request to inspect temp files
            # if os.path.exists(temp_path):
            #     os.remove(temp_path)
            pass

    return StreamingResponse(event_generator(), media_type="text/event-stream")



def transliterate(text: str) -> str:
    ru = "абвгдёезийклмнопрстуфхцчшщъыьэюяАБВГДЁЕЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ"
    en = [
        "a", "b", "v", "g", "d", "yo", "e", "z", "i", "j", "k", "l", "m", "n", "o", "p", "r", "s", "t", "u", "f", "h", "ts", "ch", "sh", "shch", "", "y", "", "e", "yu", "ya",
        "A", "B", "V", "G", "D", "Yo", "E", "Z", "I", "J", "K", "L", "M", "N", "O", "P", "R", "S", "T", "U", "F", "H", "Ts", "Ch", "Sh", "Shch", "", "Y", "", "E", "Yu", "Ya"
    ]
    mapping = {ru[i]: en[i] for i in range(len(ru))}
    return "".join(mapping.get(c, c) for c in text)


def secure_filename(filename: str) -> str:
    """
    Sanitize filename to prevent directory traversal.
    """
    filename = re.sub(r'[^a-zA-Z0-9._-]', '_', filename)
    return filename


@app.post("/api/match-items")
async def match_items_endpoint(request: Request):
    try:
        data = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")
        
    invoice_items = data.get("invoice_items", [])
    spec_items = data.get("spec_items", [])
    
    spec_dict = []
    for s in spec_items:
        s_id = s.get("id")
        s_name = str(s.get("name", ""))
        norm_name = normalize_for_match(s_name)
        if s_id and norm_name:
            spec_dict.append({"id": s_id, "raw_name": s_name, "norm_name": norm_name})
            
    for item in invoice_items:
        i_name = str(item.get("name", ""))
        norm_i = normalize_for_match(i_name)
        
        best_match = None
        best_score = 0.0
        
        if norm_i and spec_dict:
            for s in spec_dict:
                score = rapidfuzz.fuzz.token_sort_ratio(norm_i, s["norm_name"])
                if score > best_score:
                    best_score = score
                    best_match = s
                    
        if best_match:
            if best_score > 90:
                status = "perfect"
            elif best_score >= 60:
                status = "warning"
            else:
                status = "none"
                
            item["match_data"] = {
                "target_id": best_match["id"],
                "target_name": best_match["raw_name"],
                "score": round(best_score, 1),
                "status": status
            }
        else:
            item["match_data"] = {
                "target_id": None,
                "target_name": None,
                "score": 0,
                "status": "none"
            }
            
    return {"invoice_items": invoice_items}


def sanitize_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    print("--- [DEBUG] Starting sanitization ---")
    # 1. Стерилизация: всё в строки, убираем мусор
    df = df.fillna("").astype(str)
    for col in df.columns:
        df[col] = df[col].str.strip()
    
    # 2. Поиск колонок Поз и Наименование
    col_pos, col_name = 0, 1
    pos_aliases = ["поз", "№", "pos", "п/п", "index", "unnamed: 0"]
    name_aliases = ["наименование", "название", "товар", "item", "name"]
    
    for i, col in enumerate(df.columns):
        c_low = str(col).lower()
        if any(a in c_low for a in pos_aliases): col_pos = i
        if any(a in c_low for a in name_aliases): col_name = i
    
    print(f"--- [DEBUG] Mapping: Pos at idx {col_pos}, Name at idx {col_name}")

    new_rows = []
    last_dot_pos = "" # Для отслеживания 1.9 -> 1.10

    for idx, row in df.iterrows():
        r = row.to_dict() # Работаем со словарем, чтобы изменения точно сохранились
        vals = list(r.values())
        pos = str(vals[col_pos]).strip()
        name = str(vals[col_name]).strip()

        # А) Проверка на цифровой мусор (1|2|3|4...)
        digit_vals = [v for v in vals if v.isdigit()]
        if len(digit_vals) >= 4: continue

        # Б) Фикс 1.10 (Проверка X.1 после X.9)
        if "." in pos and re.match(r'^\d+(\.\d+)+$', pos):
            p_parts = pos.split('.')
            if p_parts[-1] == '1' and last_dot_pos:
                lp_parts = last_dot_pos.split('.')
                if len(p_parts) == len(lp_parts) and p_parts[:-1] == lp_parts[:-1] and lp_parts[-1] == '9':
                    pos = ".".join(p_parts[:-1]) + ".10"
                    r[df.columns[col_pos]] = pos
                    print(f"--- [DEBUG] Fixed 1.10: row {idx} -> {pos}")
            last_dot_pos = pos

        # В) L1: Группы (вырезаем цифры из начала названия)
        if (pos == "" or pos == "nan") and name:
            group_match = re.match(r'^\s*(\d+(?:\.\d+)*)\.?\s+(.*)', name)
            if group_match:
                extracted_num = group_match.group(1).strip()
                r[df.columns[col_pos]] = extracted_num
                r[df.columns[col_name]] = group_match.group(2).strip()
                new_rows.append(r)
                last_dot_pos = extracted_num
                continue

        # Г) L0: Локации (маркер §)
        others = [v for i, v in enumerate(vals) if i not in [col_pos, col_name] and v != ""]
        if (pos == "" or pos == "nan") and name and not others:
            if not re.match(r'^\d', name):
                r[df.columns[col_pos]] = "§"
                new_rows.append(r)
                last_dot_pos = ""
                continue

        new_rows.append(r)
        
    print(f"--- [DEBUG] Sanitization finished. Rows kept: {len(new_rows)} ---")
    return pd.DataFrame(new_rows)



@app.post("/api/storage/upload")
async def storage_upload(file: UploadFile = File(...)):
    original_filename = file.filename
    # 1. Transliterate to Latin
    transliterated = transliterate(original_filename)
    # 2. Secure filename
    secured_name = secure_filename(transliterated)
    
    dest_path = os.path.join(STORAGE_DIR, secured_name)
    with open(dest_path, "wb") as f:
        shutil.copyfileobj(file.file, f)
        
    estimated_cost = 0.0
    estimated_tokens = 0
    api_key, folder_id = get_yandex_keys()
    
    ext_text = ""
    is_spreadsheet = original_filename.lower().endswith((".xlsx", ".xls", ".csv"))
    
    if is_spreadsheet:
        try:
            if original_filename.lower().endswith(".csv"):
                df = pd.read_csv(dest_path, dtype=str)
            elif original_filename.lower().endswith(".xls"):
                df = pd.read_excel(dest_path, engine='xlrd', dtype=str)
            else:
                df = pd.read_excel(dest_path, engine='openpyxl', dtype=str)
            
            df = df.dropna(how='all')
            df = df.fillna("")
            
            # TK v2.1 FIX: Activating sterilization + structural cleaning
            df = sanitize_dataframe(df)
            print("--- [DEBUG] Sample after sanitize: ---")
            print(df[[df.columns[0], df.columns[1]]].head(5))

            # Smart Clean: Remove only columns that are both Unnamed and totally empty
            unnamed_empty = [c for c in df.columns if str(c).startswith("Unnamed") and (df[c].astype(str).replace("", "nan").isnull().all() or (df[c].astype(str).str.strip() == "").all())]
            if unnamed_empty:
                df = df.drop(columns=unnamed_empty)
            
            # Pre-generate Markdown for better estimates and processing
            md_text = df.to_markdown(index=False, tablefmt="pipe")

            md_path = os.path.join(STORAGE_DIR, f"{secured_name}.md")
            with open(md_path, "w", encoding="utf-8") as fmd:
                fmd.write(md_text)
            
            ext_text = md_text
            estimated_tokens = int((len(ext_text) / 4) * 2.0)
            estimated_cost = round((estimated_tokens * 0.2) / 1000, 2)
        except Exception as e:
            print(f"Spreadsheet processing error: {e}")
            
    elif api_key and folder_id:
        try:
            if original_filename.lower().endswith(".pdf"):
                try:
                    with pdfplumber.open(dest_path) as pdf:
                        for page in pdf.pages:
                            page_text = page.extract_text(x_tolerance=2, y_tolerance=3)
                            if page_text:
                                formatted_lines = [re.sub(r'\s{2,}', ' | ', line) for line in page_text.split('\n')]
                                ext_text += "\n".join(formatted_lines) + "\n"
                        if not ext_text.strip():
                            pages = len(pdf.pages)
                            estimated_cost = round(pages * 7.0, 2)
                            estimated_tokens = pages * 5000
                except Exception as e:
                    print(f"pdfplumber error: {e}")
            elif original_filename.lower().endswith((".png", ".jpg", ".jpeg")):
                estimated_tokens = 5000
                estimated_cost = 7.0
                
            if ext_text.strip() and not is_spreadsheet:
                input_tokens = await get_token_count(ext_text, "lite", api_key, folder_id)
                estimated_tokens = int(input_tokens * 1.5)
                estimated_cost = round((estimated_tokens * 0.2) / 1000, 2)
        except Exception as e:
            print(f"Error estimating cost: {e}")
    
    # Update manifest
    manifest = _load_manifest()
    # Preserve existing cost/tokens if re-uploading
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
        "fileName": original_filename,
        "method": "",
        "model": "",
        "cost": 0,
        "tokens": 0,
        "status": "UPLOAD"
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
            if f == "manifest.json" or f.startswith('.') or f.endswith(".json") or f.endswith(".md"): # Exclude cache and hidden files
                continue
            path = os.path.join(STORAGE_DIR, f)
            if os.path.isfile(path):
                stat = os.stat(path)
                from datetime import datetime
                dt = datetime.fromtimestamp(stat.st_mtime)
                time_str = dt.strftime("%H:%M | %d.%m.%y")
                
                # Get all details from manifest
                entry = manifest.get(f, {})
                if isinstance(entry, dict):
                    # Support both old 'original_name' and new 'originalName' keys
                    display_name = entry.get("originalName") or entry.get("original_name", f)
                    status = entry.get("status", "ok")
                    cost = entry.get("cost", 0)
                    tokens = entry.get("tokens", 0)
                    estimated_cost = entry.get("estimated_cost", 0)
                    estimated_tokens = entry.get("estimated_tokens", 0)
                    model = entry.get("model", "")
                    method = entry.get("method", "")
                else:
                    # Backward compatibility: plain string value
                    display_name = entry if entry else f
                    status = "ok"
                    cost = 0
                    tokens = 0
                    estimated_cost = 0
                    estimated_tokens = 0
                    model = ""
                    method = ""
                
                # Add to result
                files.append({
                    "name": display_name,
                    "disk_name": f,
                    "size": stat.st_size,
                    "time": time_str,
                    "status": status,
                    "cost": cost,
                    "tokens": tokens,
                    "estimated_cost": estimated_cost,
                    "estimated_tokens": estimated_tokens,
                    "model": model,
                    "method": method,
                })
    return files


@app.patch("/api/storage/files/{name}")
async def storage_update_file(name: str, update_data: dict):
    """
    Update any field(s) of a file entry in the manifest.
    'name' is the original filename.
    Allowed fields: status, cost, tokens.
    """
    allowed_fields = {"status", "cost", "tokens"}
    fields_to_update = {k: v for k, v in update_data.items() if k in allowed_fields}
    if not fields_to_update:
        raise HTTPException(status_code=400, detail="No valid fields to update")

    manifest = _load_manifest()
    
    # Find disk name by original name (supports both key formats)
    disk_name = None
    for k, v in manifest.items():
        if isinstance(v, dict):
            orig = v.get("originalName") or v.get("original_name")
            if orig == name:
                disk_name = k
                break
        elif v == name:
            disk_name = k
            break

    if not disk_name:
        raise HTTPException(status_code=404, detail="File not found in manifest")

    # Migrate plain-string entry to dict if needed
    if not isinstance(manifest[disk_name], dict):
        manifest[disk_name] = {"originalName": name, "status": "ok", "cost": 0, "tokens": 0}

    manifest[disk_name].update(fields_to_update)
    _save_manifest(manifest)
    return {"updated": True, "file": name, "fields": fields_to_update}


@app.delete("/api/storage/files/{name}")
async def storage_delete(name: str, nuclear: bool = False):
    # 'name' is the original filename in the UI
    manifest = _load_manifest()
    
    # Find disk name by original name
    disk_name = None
    for k, v in manifest.items():
        if isinstance(v, dict):
            if v.get("originalName") == name:
                disk_name = k
                break
        elif v == name:
            disk_name = k
            break

    # If not found by original name, try it as a disk name (fallback)
    if not disk_name:
        disk_name = secure_filename(name)
        
    path = os.path.join(STORAGE_DIR, disk_name)
    cache_path = os.path.join(STORAGE_DIR, f"{disk_name}.json")
    
    # Always allow manifest/history cleanup even if file was already physically removed
    # or handle physical files properly
    if nuclear:
        if os.path.exists(path):
            try: os.remove(path)
            except: pass
        if os.path.exists(cache_path):
            try: os.remove(cache_path)
            except: pass
        # Also delete .md клон
        md_path = os.path.join(STORAGE_DIR, f"{disk_name}.md")
        if os.path.exists(md_path):
            try: os.remove(md_path)
            except: pass
    else:
        if os.path.exists(path):
            try: os.remove(path)
            except: pass
        # Also cleanup .md клон if exists
        md_path = os.path.join(STORAGE_DIR, f"{disk_name}.md")
        if os.path.exists(md_path):
            try: os.remove(md_path)
            except: pass

    # Remove from manifest
    if disk_name in manifest:
        del manifest[disk_name]
        _save_manifest(manifest)
        
    if nuclear:
        if os.path.exists(HISTORY_FILE):
            try:
                with open(HISTORY_FILE, "r", encoding="utf-8") as f:
                    history = json.load(f)
                
                new_history = [r for r in history if r.get("fileName") != name]
                
                with open(HISTORY_FILE, "w", encoding="utf-8") as f:
                    json.dump(new_history, f, ensure_ascii=False, indent=2)
            except Exception as e:
                print(f"Nuclear delete history error: {e}")

    # Return success regardless of physical existence if it was tracked
    return {"status": "success"}
    raise HTTPException(status_code=404, detail="File not found")


@app.get("/api/storage/files/{name}")
async def storage_get(name: str):
    from fastapi.responses import FileResponse
    # 'name' is the original filename in the UI
    manifest = _load_manifest()
    
    disk_name = None
    for k, v in manifest.items():
        if isinstance(v, dict):
            if v.get("originalName") == name:
                disk_name = k
                break
        elif v == name:
            disk_name = k
            break
            
    if not disk_name:
        disk_name = secure_filename(name)

    path = os.path.join(STORAGE_DIR, disk_name)
    if os.path.exists(path):
        return FileResponse(path, filename=disk_name)
    raise HTTPException(status_code=404, detail="File not found")

