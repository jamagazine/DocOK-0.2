from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks, Body, Request, Header
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
import pandas as pd, io
import pdfplumber
import datetime
from urllib.parse import quote

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

async def gpt_yandex(text: str, api_key: str, folder_id: str, model_type: str = "lite"):
    url = "https://llm.api.cloud.yandex.net/foundationModels/v1/completion"
    headers = {
        "Authorization": f"Api-Key {api_key}",
        "x-folder-id": folder_id,
        "Content-Type": "application/json"
    }

    system_prompt = """Ты специализированный парсер счетов на оплату и накладных.
Текст передается в формате, разделенном символами |, которые обозначают границы колонок или логических блоков. Ориентируйся на это при извлечении структуры.

Извлеки из текста документа данные и верни СТРОГО В ВИДЕ JSON:
{
  "document": {
    "name": "Название формы (Счет на оплату №123, УПД и т.д.)",
    "metadata": {
      "date": "Дата документа",
      "vendor": "Название поставщика",
      "inn": "ИНН поставщика (только цифры)",
      "total_sum": "Общая сумма по документу"
    }
  },
  "items": [
    {
      "article": "Артикул товара",
      "name": "Наименование товара или услуги (обязательно)",
      "quantity": "Количество (ТОЛЬКО число, без единиц измерения)",
      "unit": "Единица измерения (шт, кг, компл и т.д.)",
      "price": "Цена за единицу",
      "total": "Сумма по позиции"
    }
  ]
}

Правила:
1. НЕ ПИШИ НИЧЕГО КРОМЕ JSON.
2. Не используй markdown-разметку (```json). Возвращай только фигурные скобки.
3. В items не включай строки типа 'Итого', 'В том числе НДС'.
4. Если поле отсутствует в тексте, оставляй значение пустым ("").
5. МАТЕМАТИЧЕСКИЙ САМОКОНТРОЛЬ: Если поле quantity (количество) в документе пустое или содержит нечитаемый текст, ты ОБЯЗАН вычислить его по формуле: quantity = total (сумма по позиции) / price (цена за единицу). Сверь полученное число с текстом в колонке 'Количество'.
6. РАЗДЕЛЕНИЕ КОЛИЧЕСТВА: Поле quantity должно содержать ТОЛЬКО число (цифры и точка). Поле unit должно содержать единицу измерения. Если в исходных данных они склеены (например, '5 шт', '10 кг'), ты ОБЯЗАН их разделить. Даже если они попали в одну "ячейку" между |.
7. ОБРАБОТКА ПЕРЕНОСОВ: Игнорируй любые переносы строк внутри ячеек. Например, '5\\nшт' должно превратиться в quantity: 5, unit: 'шт'.
8. ОЧИСТКА ЧИСЕЛ: Поля quantity, price и total должны содержать только цифры и точку. Без пробелов и букв.
9. КОНТЕКСТ ЕДИНИЦ: Если единица измерения не указана явно, но понятна из контекста — заполни unit (по умолчанию ставь 'шт').
10. МАРКИРОВКА СИСТЕМ (ПЕ1, В1, К1 и т.д.): Если перед названием товара стоит короткий код системы (ПЕ, В, К, П + цифра), он ОБЯЗАН быть частью поля name. Пример: | ПЕ1 | Клапан... -> name: "ПЕ1 Клапан...". НИКОГДА не клади эти коды в поле article. Артикул — это только заводской шифр производителя."""

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
        match = re.search(r'(\[.*\]|\{.*\})', text, re.DOTALL)
        if match:
            return json.loads(match.group(1))
        return json.loads(text.strip())
    except Exception as e:
        print(f"JSON Parse Error: {e}")
        return None

async def process_chunks_with_gpt(full_text: str, api_key: str, folder_id: str, model_type: str = "lite"):
    """
    Inteligently splits text into chunks if it exceeds token limits, otherwise sends the whole document.
    """
    # 1. Inteligently check full token size
    initial_tokens = await get_token_count(full_text, model_type, api_key, folder_id)
    
    # Send full if fits comfortably (leave ~1000 tokens for system prompt & response)
    if initial_tokens < 7000:
        raw_res, tokens = await gpt_yandex(full_text, api_key, folder_id, model_type)
        parsed = parse_gpt_json(raw_res)
        if not parsed:
            return None, tokens, None
        return parsed.get('items', []), tokens, parsed.get('document', {})

    print(f"Document exceeds 7000 tokens ({initial_tokens} tokens). Falling back to line chunking.")

    # 2. Fallback to 25 chunking logic
    lines = full_text.split('\n')
    header = lines[0] if lines else ""
    data_lines = lines[1:] if len(lines) > 1 else []
    
    CHUNK_SIZE = 25
    all_items = []
    total_tokens = 0
    main_doc = {}

    # Split into chunks
    chunks = [data_lines[i:i + CHUNK_SIZE] for i in range(0, len(data_lines), CHUNK_SIZE)]
    print(f"Document split into {len(chunks)} chunks.")
    
    for i, chunk in enumerate(chunks):
        chunk_text = header + "\n" + "\n".join(chunk)
        # We might need to handle per-chunk errors here, but for now let it propagate
        raw_res, tokens = await gpt_yandex(chunk_text, api_key, folder_id, model_type)
        total_tokens += tokens
        parsed = parse_gpt_json(raw_res)
        
        if parsed:
            all_items.extend(parsed.get('items', []))
            if not main_doc:
                main_doc = parsed.get('document', {})
            
    # If all chunks returned None, parsed fails
    if not all_items and not main_doc:
        return None, total_tokens, None
        
    return all_items, total_tokens, main_doc

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
        
        # Check math
        qty = to_float(item.get("quantity"))
        price = to_float(item.get("price"))
        total = to_float(item.get("total"))
        
        if qty > 0 and price > 0 and total > 0:
            calc_total = qty * price
            # Diff > 5% means it's likely a math issue/parsing error
            if abs(calc_total - total) > (0.05 * total):
                is_uncertain = True
                
        # Required field missing
        if not item.get("name"):
            is_uncertain = True

        item["isUncertain"] = is_uncertain
        
    return struct


@app.post("/api/process-invoice")
async def process_invoice(
    file: UploadFile = File(...),
    x_api_key: str | None = Header(None),
    x_folder_id: str | None = Header(None)
):
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
            
            return cached_data
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
                        page_text = page.extract_text()
                        if page_text:
                            ext_text += page_text + "\n"
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
            if filename.endswith(".csv"):
                df = pd.read_csv(temp_path)
            elif filename.endswith(".xls"):
                df = pd.read_excel(temp_path, engine='xlrd')
            else:
                df = pd.read_excel(temp_path, engine='openpyxl')
            
            df = df.dropna(how='all')
            df = df.fillna("")
            
            # Serialize with | for GPT consistency
            header = " | ".join(map(str, df.columns))
            rows = []
            for _, row in df.iterrows():
                rows.append(" | ".join(map(str, row.values)))
            extracted_text = header + "\n" + "\n".join(rows)
            has_low_confidence = False
            
        else:
            raise HTTPException(status_code=400, detail="Unsupported file format.")
            
        if not extracted_text.strip():
             raise HTTPException(status_code=400, detail="No readable text found in document.")
             
        # Call GPT to structure the data using chunking
        model_type = "pro" if parse_method == "ocr_table" else "lite"
        all_items, total_tokens, main_doc_info = await process_chunks_with_gpt(extracted_text, str(api_key), str(folder_id), model_type)
        
        if all_items is None or main_doc_info is None:
            raise HTTPException(status_code=422, detail="ИИ вернул невалидный ответ")
        
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
            if isinstance(v, dict) and v.get("originalName") == original_name:
                v["cost"] = round(cost, 2)
                v["tokens"] = total_tokens
                v["method"] = parse_method
                v["model"] = model_type
                break
            elif isinstance(v, dict) and v.get("original_name") == original_name:
                v["cost"] = round(cost, 2)
                v["tokens"] = total_tokens
                v["method"] = parse_method
                v["model"] = model_type
                break
        _save_manifest(manifest)
        
        return final_struct

    except HTTPException:
        # Re-raise HTTP exceptions directly
        raise
    except Exception as e:
        import traceback
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # DEBUG: Disabled cleanup per user request to inspect temp files
        # if os.path.exists(temp_path):
        #     os.remove(temp_path)
        pass


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
    
    if api_key and folder_id:
        try:
            ext_text = ""
            if original_filename.lower().endswith(".pdf"):
                try:
                    with pdfplumber.open(dest_path) as pdf:
                        for page in pdf.pages:
                            page_text = page.extract_text()
                            if page_text:
                                ext_text += page_text + "\n"
                        if not ext_text.strip():
                            estimated_cost = round(len(pdf.pages) * 1.22, 2)
                except Exception as e:
                    print(f"pdfplumber error: {e}")
            elif original_filename.lower().endswith((".png", ".jpg", ".jpeg")):
                estimated_tokens = 1500
                estimated_cost = 1.22 # OCR estimate 1 page
            elif original_filename.lower().endswith((".xlsx", ".xls", ".csv")):
                if original_filename.lower().endswith(".csv"):
                    df = pd.read_csv(dest_path)
                elif original_filename.lower().endswith(".xls"):
                    df = pd.read_excel(dest_path, engine='xlrd')
                else:
                    df = pd.read_excel(dest_path, engine='openpyxl')
                
                df = df.dropna(how='all')
                df = df.fillna("")
                
                header = " | ".join(map(str, df.columns))
                rows = []
                for _, row in df.iterrows():
                    rows.append(" | ".join(map(str, row.values)))
                ext_text = header + "\n" + "\n".join(rows)
                
            # Always calculate tokens to not miss base count
            input_tokens = await get_token_count(ext_text, "lite", api_key, folder_id)
            estimated_tokens = int(input_tokens * 2.2)
            if ext_text.strip():
                # Read ALL available text for maximum token estimation accuracy
                estimated_cost = round((estimated_tokens * 0.2) / 1000, 2)
        except Exception as e:
            print(f"Error estimating cost: {e}")
    
    # Update manifest
    manifest = _load_manifest()
    # Preserve existing cost/tokens if re-uploading
    existing = manifest.get(secured_name, {})
    manifest[secured_name] = {
        "originalName": original_filename,
        "status": "ok",
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
    
    return {"status": "success", "filename": secured_name, "estimated_cost": estimated_cost, "estimated_tokens": estimated_tokens}


@app.get("/api/storage/files")
async def storage_list():
    manifest = _load_manifest()
    files = []
    
    if os.path.exists(STORAGE_DIR):
        for f in os.listdir(STORAGE_DIR):
            if f == "manifest.json" or f.startswith('.') or f.endswith(".json"): # Exclude cache files
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
            os.remove(path)
        if os.path.exists(cache_path):
            try: os.remove(cache_path)
            except: pass
    else:
        if os.path.exists(path):
            os.remove(path)

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

