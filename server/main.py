from fastapi import FastAPI, Request, UploadFile, File, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
import json
import os
import shutil
import base64
import httpx
import re
import math
import tempfile
import pandas as pd
import fitz  # PyMuPDF

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

async def gpt_yandex(text: str, api_key: str, folder_id: str):
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

    user_text = f"Текст документа:\n{text[:8000]}"
    
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

    payload = {
        "modelUri": f"gpt://{folder_id}/yandexgpt/latest",
        "completionOptions": {
            "stream": False,
            "temperature": 0.1,
            "maxTokens": "4000"
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


def parse_gpt_json(raw_text: str):
    # Cleanup markdown if GPT hallucinated it
    clean = re.sub(r'```json\s*', '', raw_text)
    clean = re.sub(r'```\s*', '', clean)
    # Filter only contents within { } if there's surrounding text
    match = re.search(r'(\{.*\})', clean, re.DOTALL)
    if match:
        clean = match.group(1)
    return json.loads(clean.strip())

async def process_chunks_with_gpt(full_text: str, api_key: str, folder_id: str):
    """
    Splits text into chunks of 25 lines (plus header) if it's too large.
    """
    lines = full_text.split('\n')
    header = lines[0] if lines else ""
    data_lines = lines[1:] if len(lines) > 1 else []
    
    CHUNK_SIZE = 25
    all_items = []
    total_tokens = 0
    main_doc = {}
    
    # If small, process normally
    if len(data_lines) <= CHUNK_SIZE:
        raw_res, tokens = await gpt_yandex(full_text, api_key, folder_id)
        parsed = parse_gpt_json(raw_res)
        return parsed.get('items', []), tokens, parsed.get('document', {})

    # Split into chunks
    chunks = [data_lines[i:i + CHUNK_SIZE] for i in range(0, len(data_lines), CHUNK_SIZE)]
    print(f"Document split into {len(chunks)} chunks.")
    
    for i, chunk in enumerate(chunks):
        chunk_text = header + "\n" + "\n".join(chunk)
        # We might need to handle per-chunk errors here, but for now let it propagate
        raw_res, tokens = await gpt_yandex(chunk_text, api_key, folder_id)
        total_tokens += tokens
        parsed = parse_gpt_json(raw_res)
        
        all_items.extend(parsed.get('items', []))
        if not main_doc:
            main_doc = parsed.get('document', {})
            
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
    
    # Save file temporarily
    temp_path = os.path.join(TEMP_INPUT_DIR, file.filename)
    with open(temp_path, "wb") as f:
        shutil.copyfileobj(file.file, f)
        
    extracted_text = ""
    has_low_confidence = False
    
    try:
        if filename.endswith(".pdf"):
            doc = fitz.open(temp_path)
            
            # 1. Try Extracting Text Layer
            text_layer_found = False
            for page in doc:
                blocks = page.get_text("blocks")
                if blocks:
                    text_layer_found = True
                    # Sort blocks by vertical then horizontal position
                    blocks.sort(key=lambda b: (b[1], b[0]))
                    
                    current_y = -1
                    page_text_parts = []
                    for b in blocks:
                        # block format: (x0, y0, x1, y1, "text", block_no, block_type)
                        # Check if we are on roughly the same line
                        if abs(b[1] - current_y) > 5:
                            page_text_parts.append("\n| ")
                            current_y = b[1]
                        else:
                            page_text_parts.append(" | ")
                        
                        clean_text = b[4].replace("\n", " ").strip()
                        page_text_parts.append(clean_text)
                    
                    extracted_text += "".join(page_text_parts) + "\n"
            
            # 2. If no text layer OR very little text found, fallback to OCR
            if not text_layer_found or len(extracted_text.strip()) < 50:
                print("No text layer found or text too short. Falling back to OCR.")
                extracted_text = "" # Reset
                for i in range(len(doc)):
                    page = doc.load_page(i)
                    pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
                    png_bytes = pix.tobytes("png")
                    b64_str = base64.b64encode(png_bytes).decode('utf-8')
                    
                    txt, low_conf = await ocr_yandex(b64_str, str(api_key), str(folder_id))
                    # OCR response is raw so we don't have delimiters easily, but we can do a simple split join
                    formatted_ocr = " | ".join([line.strip() for line in txt.split("\n") if line.strip()])
                    extracted_text += f"\n--- Page {i+1} ---\n | {formatted_ocr}\n"
                    if low_conf:
                        has_low_confidence = True
            doc.close()
            
        elif filename.endswith((".png", ".jpg", ".jpeg")):
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
            else:
                df = pd.read_excel(temp_path)
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
        all_items, total_tokens, main_doc_info = await process_chunks_with_gpt(extracted_text, str(api_key), str(folder_id))
        
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
             
        final_struct = calculate_uncertainty(merged_struct, has_low_confidence)
        
        # Pro rate: 1.2 RUB per 1000 tokens
        cost = round((total_tokens * 1.2) / 1000, 2)
        
        # Add usage and cost to the final return
        final_struct["usage"] = {"total_tokens": total_tokens}
        final_struct["cost"] = cost
        
        return final_struct

    except Exception as e:
        print(f"Error in processing: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")
    finally:
        # DEBUG: Disabled cleanup per user request to inspect temp files
        # if os.path.exists(temp_path):
        #     os.remove(temp_path)
        pass


def secure_filename(filename: str) -> str:
    """
    Sanitize filename to prevent directory traversal.
    """
    filename = re.sub(r'[^a-zA-Z0-9._-]', '_', filename)
    return filename


@app.post("/api/storage/upload")
async def storage_upload(file: UploadFile = File(...)):
    filename = secure_filename(file.filename)
    dest_path = os.path.join(STORAGE_DIR, filename)
    with open(dest_path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    return {"status": "success", "filename": filename}


@app.get("/api/storage/files")
async def storage_list():
    files = []
    if os.path.exists(STORAGE_DIR):
        for f in os.listdir(STORAGE_DIR):
            path = os.path.join(STORAGE_DIR, f)
            if os.path.isfile(path):
                stat = os.stat(path)
                from datetime import datetime
                dt = datetime.fromtimestamp(stat.st_mtime)
                time_str = dt.strftime("%H:%M | %d.%m.%y")
                files.append({
                    "name": f,
                    "size": stat.st_size,
                    "time": time_str
                })
    return files


@app.delete("/api/storage/files/{name}")
async def storage_delete(name: str):
    filename = secure_filename(name)
    path = os.path.join(STORAGE_DIR, filename)
    if os.path.exists(path):
        os.remove(path)
        return {"status": "success"}
    raise HTTPException(status_code=404, detail="File not found")


@app.get("/api/storage/files/{name}")
async def storage_get(name: str):
    from fastapi.responses import FileResponse
    filename = secure_filename(name)
    path = os.path.join(STORAGE_DIR, filename)
    if os.path.exists(path):
        return FileResponse(path, filename=filename)
    raise HTTPException(status_code=404, detail="File not found")

