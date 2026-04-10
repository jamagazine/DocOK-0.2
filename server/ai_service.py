import httpx
import json
import re
import asyncio
import os
import logging
from thefuzz import fuzz
logger = logging.getLogger(__name__)

from dataclasses import dataclass, field
from typing import Dict
import pricing as pricing

# --- ATOMIC ESTIMATION CONSTANTS ---
# Атом 1: Реквизиты (Lite)
EST_LITE_INPUT = 3500  # Усредненный вес промпта + текста счета
EST_LITE_OUTPUT = 500  # Усредненный вес JSON с реквизитами

# Атом 2: Чанк товаров (Pro)
EST_PRO_CHUNK_OVERHEAD = 2500 # Промпт + Заголовки таблицы (отправляются в КАЖДОМ чанке)
EST_PRO_CHUNK_OUTPUT = 600    # Усредненный вес JSON для пачки из 15 товаров

# Настройки чанкинга
CHUNK_SIZE = 15
SAFE_BUFFER_MULTIPLIER = 1.15 # Запас +15% на "разговорчивость" ИИ

@dataclass
class UsageStats:
    total_input: int = 0
    total_output: int = 0
    total_cost: float = 0.0
    cost_breakdown: Dict[str, dict] = field(default_factory=dict)

    def add(self, label: str, model_key: str, input_tok: int, output_tok: int):
        rates = pricing.PRICING_CONFIG.get(model_key, pricing.PRICING_CONFIG["yandexgpt-pro"])
        step_cost = (input_tok * rates["input_per_1k"] + output_tok * rates["output_per_1k"]) / 1000.0
        
        self.total_input += input_tok
        self.total_output += output_tok
        self.total_cost += step_cost
        
        # Если чанков несколько, они будут сохраняться под отдельными ключами (Items_Chunk_1, Items_Chunk_2)
        if label not in self.cost_breakdown:
            self.cost_breakdown[label] = {"input": 0, "output": 0, "cost": 0.0}
        
        self.cost_breakdown[label]["input"] += input_tok
        self.cost_breakdown[label]["output"] += output_tok
        self.cost_breakdown[label]["cost"] += step_cost

    def add_ocr(self, pages: int, method: str, label: str):
        config = pricing.PRICING_CONFIG["ocr"]
        method_cost = config.get("table") if method == "ocr_table" else config.get("page")
        current_cost = round(pages * method_cost, 4)
        
        self.total_cost += current_cost
        if label not in self.cost_breakdown:
            self.cost_breakdown[label] = {"input": 0, "output": 0, "cost": 0.0}
        self.cost_breakdown[label]["cost"] += current_cost
        self.cost_breakdown[label]["pages"] = self.cost_breakdown[label].get("pages", 0) + pages
        self.cost_breakdown[label]["method"] = method

    def merge(self, other: 'UsageStats', prefix=""):
        self.total_input += other.total_input
        self.total_output += other.total_output
        self.total_cost += other.total_cost
        for k, v in other.cost_breakdown.items():
            key = f"{prefix}{k}" if prefix else k
            if key not in self.cost_breakdown:
                self.cost_breakdown[key] = {"input": 0, "output": 0, "cost": 0.0}
            self.cost_breakdown[key]["input"] += v.get("input", 0)
            self.cost_breakdown[key]["output"] += v.get("output", 0)
            self.cost_breakdown[key]["cost"] += v.get("cost", 0.0)
            if "pages" in v:
                self.cost_breakdown[key]["pages"] = self.cost_breakdown[key].get("pages", 0) + v["pages"]

    def to_dict(self):
        return {
            "tokens": self.total_input + self.total_output,
            "cost": round(self.total_cost, 4),
            "cost_breakdown": self.cost_breakdown
        }


async def estimate_cost_before_processing(
    text: str,
    api_key: str = "",
    folder_id: str = "",
    num_positions: int = 0,
    file_type: str = "excel_ai",
    pages: int = 0
) -> dict:
    rates = pricing.PRICING_CONFIG
    
    # --- СЦЕНАРИЙ 1: СКАНЫ (OCR) ---
    if file_type in ["need_ocr", "ocr_table", "image"]:
        pages = max(1, pages)
        ocr_cost = pages * rates["ocr"]["table"]
        
        # Грубая прикидка для сканов: 1 страница = 1 чанк Pro + 1 вызов Lite
        total_in = EST_LITE_INPUT + (EST_PRO_CHUNK_OVERHEAD + 2000) * pages
        total_out = EST_LITE_OUTPUT + (EST_PRO_CHUNK_OUTPUT * pages)
        
        llm_cost = (total_in * rates["yandexgpt-pro"]["input_per_1k"] + 
                    total_out * rates["yandexgpt-pro"]["output_per_1k"]) / 1000.0
                    
        total_cost = (ocr_cost + llm_cost) * SAFE_BUFFER_MULTIPLIER
        return {
            "estimated_cost": round(total_cost, 2),
            "estimated_tokens": total_in + total_out,
            "breakdown": f"OCR ({pages} стр) + Atomic LLM"
        }

    # --- СЦЕНАРИЙ 2: ТЕКСТ (Excel, CSV, PDF с текстом) ---
    try:
        # Попытка использовать точный токенизатор Яндекса
        if api_key and folder_id:
            raw_payload_tokens = await get_token_count(text, "pro", api_key, folder_id)
        else:
            raw_payload_tokens = len(text) // 3
    except Exception:
        raw_payload_tokens = len(text) // 3

    # Атом 1: Стоимость Реквизитов (Lite)
    lite_cost = (EST_LITE_INPUT * rates["yandexgpt-lite"]["input_per_1k"] + 
                 EST_LITE_OUTPUT * rates["yandexgpt-lite"]["output_per_1k"]) / 1000.0

    # Атом 2: Стоимость Товаров (Pro)
    # Считаем количество чанков (минимум 1, даже если позиций 0, чтобы ИИ попытался найти таблицу)
    num_chunks = (num_positions // CHUNK_SIZE) + 1 if num_positions > 0 else 1
    
    pro_in_tokens = (EST_PRO_CHUNK_OVERHEAD * num_chunks) + raw_payload_tokens
    pro_out_tokens = EST_PRO_CHUNK_OUTPUT * num_chunks
    
    pro_cost = (pro_in_tokens * rates["yandexgpt-pro"]["input_per_1k"] + 
                pro_out_tokens * rates["yandexgpt-pro"]["output_per_1k"]) / 1000.0

    # Финальная сборка с динамическим буфером
    total_base_cost = lite_cost + pro_cost
    total_estimated_cost = total_base_cost * SAFE_BUFFER_MULTIPLIER
    total_estimated_tokens = EST_LITE_INPUT + EST_LITE_OUTPUT + pro_in_tokens + pro_out_tokens

    return {
        "estimated_cost": round(total_estimated_cost, 2),
        "estimated_tokens": total_estimated_tokens,
        "breakdown": f"Atomic: Lite (1) + Pro ({num_chunks} chunks)"
    }


def find_account_by_context(text: str, prefix: str) -> str:
    """Ищет 20-значное число с заданным префиксом (407 или 301)."""
    import re
    # Удаляем пробелы и тире для точного поиска 20 цифр подряд
    clean_text = text.replace(" ", "").replace("-", "")
    pattern = rf'\b{prefix}\d{{17}}\b'
    matches = re.findall(pattern, clean_text)
    return matches[0] if matches else None

async def ocr_yandex(b64_img: str, api_key: str, folder_id: str):
    """
    Robust Hybrid OCR Engine (Vision V1).
    Handles 429 errors on initial submission and uses safe 1.5s polling.
    """
    url_analyze = "https://vision.api.cloud.yandex.net/vision/v1/batchAnalyze"
    url_operations = "https://operation.api.cloud.yandex.net/operations/"
    
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
                "text_detection_config": {"language_codes": ["*"]}
            }]
        }]
    }

    async with httpx.AsyncClient(timeout=90.0) as client:
        # 1. Submission Phase with 429 Defense
        resp = None
        for attempt in range(3):
            resp = await client.post(url_analyze, headers=headers, json=payload)
            if resp.status_code == 429:
                wait_time = 2.0 + (attempt * 1.5)
                print(f"Yandex 429 (Initial Submit). Attempt {attempt+1}/3. Waiting {wait_time}s...")
                await asyncio.sleep(wait_time)
                continue
            resp.raise_for_status()
            break
        
        if not resp:
            raise Exception("Failed to submit OCR task after 3 attempts.")
            
        data = resp.json()

        # Case A: Sync Results
        if "results" in data:
            return _extract_ocr_data(data)

        # Case B: Async Operation
        operation = data.get("operation", {})
        op_id = operation.get("id")
        if not op_id:
            raise ValueError(f"Unexpected response from Yandex Vision: {data}")

        # 2. Polling Phase (Throttled)
        max_polls = 50
        poll_interval = 1.5 # Colleague recommended 1.2-1.5

        for attempt in range(max_polls):
            await asyncio.sleep(poll_interval)
            try:
                op_resp = await client.get(f"{url_operations}{op_id}", headers=headers)
                if op_resp.status_code == 429:
                    print(f"Polling 429... waiting 2.5s extra. Operation: {op_id}")
                    await asyncio.sleep(2.5)
                    continue
                
                op_resp.raise_for_status()
                op_status = op_resp.json()

                if op_status.get("done"):
                    if "error" in op_status:
                        raise Exception(f"Yandex OCR error: {op_status['error']}")
                    return _extract_ocr_data(op_status.get("response"))
                    
            except Exception as e:
                print(f"Error polling Yandex Operation {op_id}: {e}. Retrying inner loop...")
                await asyncio.sleep(2.0)

    raise Exception(f"OCR Operation {op_id} timed out after {max_polls * poll_interval}s.")

def _extract_ocr_data(data: dict):
    """
    Unified parser for Yandex Vision JSON (extracts text, coordinates, and confidence).
    """
    if not data: return "", False, [], {}
    
    text_parts = []
    all_words = []
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
                            
                            w_text = word.get('text', '')
                            text_parts.append(w_text)
                            
                            # Extract bounding box to coordinates
                            poly = word.get('boundingBox', {}).get('vertices', [])
                            if poly and len(poly) >= 4:
                                x = min(int(v.get('x', 0)) for v in poly)
                                y = min(int(v.get('y', 0)) for v in poly)
                                w = max(int(v.get('x', 0)) for v in poly) - x
                                h = max(int(v.get('y', 0)) for v in poly) - y
                                all_words.append({
                                    "text": w_text, "x": x, "y": y, "w": w, "h": h
                                })
                        text_parts.append('\n')
    
    return "".join(text_parts), has_low_confidence, all_words, data

def load_prompt(name: str) -> str:
    """Standalone prompt loader to avoid circular imports with main.py"""
    path = os.path.join(os.path.dirname(__file__), "prompts", f"{name}_prompt.md")
    if not os.path.exists(path):
        return ""
    try:
        with open(path, "r", encoding="utf-8") as f:
            return f.read().strip()
    except:
        return ""

async def gpt_yandex(text: str, api_key: str, folder_id: str, system_prompt: str, model_type: str = "lite", label: str = "General"):
    url = "https://llm.api.cloud.yandex.net/foundationModels/v1/completion"
    headers = {
        "Authorization": f"Api-Key {api_key}",
        "x-folder-id": folder_id,
        "Content-Type": "application/json"
    }

    user_text = f"Текст документа:\n{text}"
    
    # Official Yandex GPT model URIs (latest is standard)
    if model_type == "pro":
        model_uri = f"gpt://{folder_id}/yandexgpt/latest"
    else:
        model_uri = f"gpt://{folder_id}/yandexgpt-lite/latest"
    
    payload = {
        "modelUri": model_uri,
        "completionOptions": {"stream": False, "temperature": 0.0, "maxTokens": 2000},
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
    in_tok = int(usage.get('inputTextTokens', 0))
    out_tok = int(usage.get('completionTokens', 0))
    
    logger.info(f"LLM call [{label}] — input: {in_tok}, output: {out_tok}")
    
    return data['result']['alternatives'][0]['message']['text'], in_tok, out_tok

async def get_token_count(text: str, model_type: str, api_key: str, folder_id: str) -> int:
    url = "https://llm.api.cloud.yandex.net/foundationModels/v1/tokenize"
    headers = {
        "Authorization": f"Api-Key {api_key}",
        "x-folder-id": folder_id,
        "Content-Type": "application/json"
    }
    model_uri = f"gpt://{folder_id}/yandexgpt/latest" if model_type == "pro" else f"gpt://{folder_id}/yandexgpt-lite/latest"
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
    import logging
    logger = logging.getLogger(__name__)
    try:
        text_clean = re.sub(r'```json|```', '', text).strip()
        match = re.search(r'(\[.*\]|\{.*\})', text_clean, re.DOTALL)
        if match:
            return json.loads(match.group(1))
        return json.loads(text_clean.strip())
    except:
        logger.error(f"Failed to parse LLM response. Possible truncation. Response: {text[:200]}...")
        return None

def normalize_invoice_table(md_text: str) -> str:
    """
    Cleans up MD table noise:
    1. Finds actual table start.
    2. Merges rows that have text but no prices (orphans).
    3. Cleans up pipe characters.
    """
    if not md_text: return ""
    lines = md_text.split('\n')
    output_lines = []
    
    # Find headers (look for piped header with --- separator)
    start_idx = -1
    for i, line in enumerate(lines):
        if "|" in line and i + 1 < len(lines) and "| ---" in lines[i+1]:
            start_idx = i
            break
    
    if start_idx == -1: return md_text # No table found, return as is
            
    header_part = lines[start_idx:start_idx+2]
    data_rows = lines[start_idx+2:]
    output_lines.extend(header_part)
    
    current_row = None
    
    for line in data_rows:
        line = line.strip()
        if not line.startswith("|") or not line.endswith("|"): continue
        
        parts = [p.strip() for p in line.split("|")]
        # Expected Grid: | Group | No | Name | Qty | Unit | Price | Disc | Sum |
        # Parts will be ['', Group, No, Name, Qty, Unit, Price, Disc, Sum, ''] -> len 10
        if len(parts) < 9: continue
        
        # Shift to data indices (1 to 8)
        name_val = parts[3] if len(parts) > 3 else ""
        price_val = parts[6] if len(parts) > 6 else ""
        sum_val = parts[8] if len(parts) > 8 else ""
        qty_val = parts[4] if len(parts) > 4 else ""
        
        # Check if row has numeric anchors (Price, Sum or Qty)
        has_data = any(c.isdigit() for c in price_val) or \
                   any(c.isdigit() for c in sum_val) or \
                   any(c.isdigit() for c in qty_val)
        
        if has_data:
            if current_row: 
                output_lines.append("| " + " | ".join(current_row) + " |")
            current_row = parts[1:9]
        else:
            # Orphan row (description wrap)
            if current_row and name_val:
                current_row[2] += " " + name_val
    
    if current_row:
        output_lines.append("| " + " | ".join(current_row) + " |")
        
    return "\n".join(output_lines)

def apply_math_arbitrage(json_data: dict) -> dict:
    """
    Python-based Auditor (Pipeline v7.0 Auditor).
    1. Validates Qty * Price = Total per row.
    2. Compares accumulated row totals against Grand Total in footer.
    3. Injects validation_notes with human-readable audit results.
    4. Calculates VAT if not provided.
    """
    if not json_data: return {}
    
    # Extract sections from DocOK schema
    footer = json_data.get("footer", {})
    items = json_data.get("items", [])
    
    total_accumulated = 0.0
    global_notes = []
    
    def to_f(v): 
        if v is None: return 0.0
        import re
        s = str(v).replace(" ", "").replace(",", ".")
        try:
            match = re.search(r'-?\d+(\.\d+)?', s)
            return float(match.group(0)) if match else 0.0
        except:
            return 0.0

    for item in items:
        qty = to_f(item.get("quantity", 1))
        price = to_f(item.get("price", 0))
        total_doc = to_f(item.get("total", 0))
        
        calc_total = round(qty * price, 2)
        item["calculated_total"] = calc_total
        item["unit_price_raw"] = price
        
        notes = []
        if abs(calc_total - total_doc) > 0.05:
            notes.append(f"Ошибка расчета: {qty} * {price} = {calc_total}, в доке {total_doc}")
            item["math_error"] = True
        else:
            notes.append("OK: Математика сходится")
            
        item["validation_notes"] = "; ".join(notes)
        total_accumulated += total_doc

        if not item.get("vat_sum"):
            item["vat_sum"] = round(total_doc * (20 / 120), 2)

    grant_total_doc = 0.0
    for k in ["total_amount", "sum_total", "grand_total", "total"]:
        if footer.get(k):
            grant_total_doc = to_f(footer[k])
            if grant_total_doc > 0: break
            
    if grant_total_doc > 0:
        diff = abs(total_accumulated - grant_total_doc)
        if diff > 0.5:
            global_notes.append(f"⚠ Несовпадение итогов: Сумма строк ({total_accumulated:.2f}) != Итого в доке ({grant_total_doc:.2f})")
        else:
            global_notes.append("Общий итог документа подтвержден")
    
    if global_notes:
        footer["validation_notes"] = "; ".join(global_notes)
        
    return json_data

async def extract_invoice_metadata(text: str, api_key: str, folder_id: str, system_prompt: str, model_type: str = "pro"):
    """Extracts only the metadata (inn, date, number) from raw header text."""
    lines = text.split('\n')
    header_slice = "\n".join(lines[:100])
    
    # Strip MD table markers for meta extraction
    clean_text = header_slice.replace("|", " ").replace("---", " ")
    clean_text = re.sub(r' +', ' ', clean_text)
    
    try:
        logger.info("Attempting single API call for whole raw document...")
        raw_res, stats = await gpt_yandex(clean_text, api_key, folder_id, system_prompt, model_type, label="Header_Single")
        logger.info("Single API call successful.")
        return parse_gpt_json(raw_res), stats
    except Exception as e:
        print(f"Metadata extraction error: {e}")
        return None, 0

async def process_chunks_with_gpt(full_text: str, api_key: str, folder_id: str, system_prompt: str, model_type: str = "pro", context: dict = None):
    """Processes cleaned-up MD tables with Yandex GPT."""
    
    # 1. Normalize the MD table before processing
    full_text = normalize_invoice_table(full_text)
    
    lines = full_text.split('\n')
    header_block = "\n".join(lines[:2]) if len(lines) >= 2 else (lines[0] if lines else "")
    data_lines = lines[2:] if len(lines) >= 2 else []
    
    # 2. Inject context (Supplier Name) into prompt
    if context and "{supplier_name}" in system_prompt:
        system_prompt = system_prompt.replace("{supplier_name}", context.get("supplier_name", "Не указан"))

    # 3. Use unified large chunk for invoices (avoid fragmentation)
    CHUNK_SIZE = 9999 
    from parser_utils import clean_and_build_markdown
    total_stats = UsageStats()
    all_items = []
    all_fixes = []
    main_doc = {}
    footer_data = {}

    chunks = [data_lines[i:i + CHUNK_SIZE] for i in range(0, len(data_lines), CHUNK_SIZE)]
    sem = asyncio.Semaphore(5)
    
    async def process_single_chunk(i, chunk):
        async with sem:
            chunk_text = header_block + "\n" + "\n".join(chunk)
            try:
                raw_res, in_tok, out_tok = await gpt_yandex(chunk_text, api_key, folder_id, system_prompt, model_type, label=f"Header_Chunk_{i+1}")
                chunk_stats = UsageStats()
                model_key = "yandexgpt-pro" if model_type == "pro" else "yandexgpt-lite"
                chunk_stats.add(f"Header_Chunk_{i+1}", model_key, in_tok, out_tok)
                
                parsed = parse_gpt_json(raw_res)
                if parsed:
                    return i, True, parsed, chunk_stats, None
                return i, False, None, UsageStats(), "Невалидный JSON"
            except Exception as e:
                return i, False, None, UsageStats(), str(e)

    tasks = [process_single_chunk(i, chunk) for i, chunk in enumerate(chunks)]
    results = []
    for coro in asyncio.as_completed(tasks):
        res = await coro
        results.append(res)
        yield {"type": "progress", "index": res[0]+1, "total": len(chunks)}
    
    results.sort(key=lambda x: x[0])
    
    for i, ok, parsed, chunk_stats, err_msg in results:
        total_stats.merge(chunk_stats)
        if ok and parsed:
            fixes_to_add = []
            items_to_add = []
            if isinstance(parsed, list):
                items_to_add = parsed
            elif isinstance(parsed, dict):
                fixes_to_add = parsed.get('fixes', [])
                items_to_add = parsed.get('items', [])
                # Store potential metadata/footer for extraction
                if not main_doc:
                    main_doc = parsed.get('header', parsed.get('document', {}))
                if not footer_data:
                    footer_data = parsed.get('footer', {})
            
            all_fixes.extend(fixes_to_add)
            all_items.extend(items_to_add)
        else:
            all_items.append({"pos": "ERR", "name": f"Ошибка чанка {i+1}", "note": err_msg, "is_error_chunk": True})

    # FINAL STEP: Apply Python Mathematical Arbitrage
    final_json = {
        "header": main_doc,
        "items": all_items,
        "footer": footer_data
    }
    final_json = apply_math_arbitrage(final_json)
    yield {
        "type": "result", 
        "items": final_json["items"], 
        "fixes": all_fixes, 
        "tokens": getattr(total_stats, "cost", 0.0), # Temporary placeholder if caller assumes it's cost/stats. Unused anyway.
        "main_doc": final_json["header"], 
        "footer": final_json["footer"],
        "chunks_report": []
    }

def normalize_phone(phone_str: str) -> str:
    if not phone_str or phone_str == "---": return phone_str
    # Оставляем только цифры
    digits = "".join(re.findall(r'\d', phone_str))
    if len(digits) >= 10:
        # Берем последние 10 цифр (игнорируем любые 7, 8 или случайные префиксы)
        d10 = digits[-10:]
        return f"+7 ({d10[:3]}) {d10[3:6]}-{d10[6:8]}-{d10[8:10]}"
    return phone_str
    
def get_address_tokens(addr_str: str) -> dict:
    if not addr_str: return {"index": None, "house": None, "office": None}
    addr_str = addr_str.lower()
    idx = re.search(r'\b\d{6}\b', addr_str)
    # Ищем дом (д., дом, д, стр.)
    hs = re.search(r'\b(?:д\.|дом|д|стр\.|строение)\s*№?\s*(\d+[а-я]?|\d+\/\d+)\b', addr_str)
    # Ищем офис (оф., офис, каб., кв.)
    off = re.search(r'\b(?:оф\.|офис|каб\.|кабинет|кв\.|квартира)\s*№?\s*(\d+[а-я]?)\b', addr_str)
    return {
        "index": idx.group(0) if idx else None,
        "house": hs.group(1) if hs else None,
        "office": off.group(1) if off else None
    }

def check_address_anchor(addr_str: str, anchor_tokens: dict) -> str:
    if not addr_str or not anchor_tokens:
        return "OK"
    
    tokens = get_address_tokens(addr_str)
    
    # Если не нашли индекс или дом, пропускаем проверку (недостаточно данных)
    if not tokens["index"] or not tokens["house"]:
        return "OK"
        
    if tokens["index"] == anchor_tokens.get("index") and tokens["house"] == anchor_tokens.get("house"):
        if tokens["office"] == anchor_tokens.get("office"):
            return "ERROR" # Полное совпадение (это адрес клиента)
        else:
            return "WARNING" # Сосед по зданию (разные офисы)
            
    return "OK"

def extract_field(field_data):
    if isinstance(field_data, dict):
        # Пытаемся получить confidence, кастуем во float, при ошибке ставим 1.0
        try:
            raw_conf = field_data.get("confidence", 1.0)
            conf = float(raw_conf)
        except (ValueError, TypeError):
            conf = 1.0
            
        return {
            "value": field_data.get("value"),
            "confidence": conf,
            "isVerified": False
        }
    # Фолбэк, если ИИ по привычке вернул строку
    return {
        "value": field_data,
        "confidence": 1.0 if field_data else 0.0,
        "isVerified": False
    }

def safe_parse_llm_json(response_text: str) -> dict:
    """Безопасно извлекает JSON из ответа LLM, игнорируя markdown-теги."""
    try:
        match = re.search(r'\{.*\}', response_text, re.DOTALL)
        raw_dict = {}
        if match:
            clean_json_str = match.group(0)
            raw_dict = json.loads(clean_json_str)
        else:
            raw_dict = json.loads(response_text)
            
        # Wrap for HITL Sprint 3.3 - Updated for Sprint 4 confidence passing
        wrapped_data = {
            "document_type": extract_field(raw_dict.get("document_type")),
            "contact_person": extract_field(raw_dict.get("contact_person")),
            "organization_name": extract_field(raw_dict.get("organization_name")),
            "inn": extract_field(raw_dict.get("inn")),
            "kpp": extract_field(raw_dict.get("kpp")),
            "legal_address": extract_field(raw_dict.get("legal_address")),
            "postal_address": extract_field(raw_dict.get("postal_address")),
            "bank_name": extract_field(raw_dict.get("bank_name")),
            "bank_bik": extract_field(raw_dict.get("bank_bik")),
            "bank_account": extract_field(raw_dict.get("bank_account")),
            "corr_account": extract_field(raw_dict.get("corr_account")),
            "phone": extract_field(raw_dict.get("phone")),
            
            # Additional metadata (non-wrapped for now or handled separately)
            "invoice_number": raw_dict.get("invoice_number", "---"),
            "invoice_date": raw_dict.get("invoice_date", "---"),
            "total_amount": raw_dict.get("total_amount", "---"),
            "currency": raw_dict.get("currency", "RUB")
        }
        return wrapped_data
    except json.JSONDecodeError as e:
        print(f"LLM JSON Decode Error: {e}")
        print(f"Raw LLM response: {response_text}")
        return {
            key: {"value": "---", "confidence": 0.0, "isVerified": False}
            for key in [
                "organization_name", "inn", "kpp", "legal_address", "postal_address",
                "bank_name", "bank_bik", "bank_account", "corr_account", "phone", "contact_person", "document_type"
            ]
        }

async def process_header_with_llm(ocr_json, api_key: str, folder_id: str) -> dict:
    """
    Принимает сырой OCR JSON (от Яндекса или нашего цифрового адаптера).
    1. Строит зональный Markdown через clean_and_build_markdown.
    2. Вставляет данные в промпт.
    3. Вызывает LLM и возвращает плоский JSON.
    """
    from parser_utils import clean_and_build_markdown
    
    # Если на вход уже пришел готовый Markdown-текст (например, из Excel/CSV)
    if isinstance(ocr_json, str):
        markdown_payload = ocr_json
    else:
        # Единый подход: собираем Markdown из координатных блоков
        markdown_payload = clean_and_build_markdown(ocr_json)
    
    if not markdown_payload or markdown_payload == "NO_TEXT_FOUND":
        return safe_parse_llm_json(""), UsageStats()

    # 2. Читаем промпт
    with open(os.path.join(os.path.dirname(__file__), "prompts", "invoice_header_prompt.md"), "r", encoding="utf-8") as f:
        prompt_template = f.read()
        
    parts = prompt_template.split("[INSTRUCTION]")
    system_prompt = parts[0].replace("[SYSTEM PROMPT]", "").strip()
    instruction = "[INSTRUCTION]" + parts[1].replace("{markdown_payload}", markdown_payload).strip()
    
    # 3. Вызываем LLM
    try:
        llm_response, in_tok, out_tok = await gpt_yandex(
            text=instruction, 
            api_key=api_key, 
            folder_id=folder_id, 
            system_prompt=system_prompt,
            model_type="lite",
            label="Header_Final"
        )
        
        stats = UsageStats()
        stats.add("Header_Final", "yandexgpt-lite", in_tok, out_tok)
        
        parsed = parse_gpt_json(llm_response)
        if isinstance(parsed, dict):
            return parsed, stats
        return safe_parse_llm_json(""), stats
    except Exception as e:
        logger.error(f"Error calling LLM for prompt: {e}")
        return safe_parse_llm_json(""), UsageStats()
    
    # 4. Безопасно парсим
    wrapped_data = safe_parse_llm_json(llm_response)
    
    # ДАННЫЕ КЛИЕНТА (ММК)
    CLIENT_INN = "5905271743"
    CLIENT_ANCHOR = {"index": "614022", "house": "1", "office": "3"}

    # 1. Проверка по ИНН (Если ИИ притащил ИНН покупателя)
    if wrapped_data.get("inn") and wrapped_data["inn"].get("value") == CLIENT_INN:
        for key in wrapped_data: 
            if isinstance(wrapped_data[key], dict) and "value" in wrapped_data[key]:
                wrapped_data[key]["value"] = None # Стираем всё, это не поставщик
        return wrapped_data, stats

    # 2. Нормализация телефона
    if wrapped_data.get("phone") and wrapped_data["phone"].get("value"):
        wrapped_data["phone"]["value"] = normalize_phone(wrapped_data["phone"]["value"])

    # 3. Агрессивный фильтр адресов
    for f_name in ["legal_address", "postal_address"]:
        val = wrapped_data.get(f_name, {}).get("value")
        if not val: continue
        
        t = get_address_tokens(val)
        # Если совпал Индекс+Дом ИЛИ Дом+Офис - это 100% клиент
        is_leak = (t["index"] == CLIENT_ANCHOR["index"] and t["house"] == CLIENT_ANCHOR["house"]) or \
                  (t["house"] == CLIENT_ANCHOR["house"] and t["office"] == CLIENT_ANCHOR["office"])
        
        if is_leak:
            wrapped_data[f_name]["value"] = None
            wrapped_data[f_name]["note"] = "Данные покупателя удалены автоматически"

    # 4. Умный Клон: Если почтовый пуст, а юридический есть - клонируем с пометкой
    if not wrapped_data["postal_address"]["value"] and wrapped_data["legal_address"]["value"]:
        wrapped_data["postal_address"]["value"] = wrapped_data["legal_address"]["value"]
        wrapped_data["postal_address"]["confidence"] = 0.5
        wrapped_data["postal_address"]["note"] = "Адрес продублирован из Юридического (оригинал не найден)"

    # --- БЛОК КОНТЕКСТНОЙ СОРТИРОВКИ БАНКОВ ---
    raw_text = str(markdown_payload)
    acc_val = wrapped_data.get("bank_account", {}).get("value")
    corr_val = wrapped_data.get("corr_account", {}).get("value")

    # 1. Если в Р/С (407) попал номер на 301 (К/С банка)
    if acc_val and str(acc_val).startswith('301'):
        # Переносим его в К/С, если там пусто
        if not corr_val or corr_val == "---":
            wrapped_data["corr_account"]["value"] = acc_val
            wrapped_data["corr_account"]["confidence"] = 1.0

        # Пытаемся найти настоящий Р/С (на 407) в тексте
        found_407 = find_account_by_context(raw_text, "407")
        if found_407:
            wrapped_data["bank_account"]["value"] = found_407
            wrapped_data["bank_account"]["confidence"] = 0.95
            wrapped_data["bank_account"]["note"] = "Р/С автоматически найден по префиксу 407"
        else:
            wrapped_data["bank_account"]["value"] = None
            wrapped_data["bank_account"]["note"] = "Ошибка: в поле Р/С был К/С. Реальный Р/С не найден."

    # 2. Если К/С пуст, попробуем найти его по префиксу 301
    if not wrapped_data["corr_account"]["value"] or wrapped_data["corr_account"]["value"] == "---":
        found_301 = find_account_by_context(raw_text, "301")
        if found_301:
            wrapped_data["corr_account"]["value"] = found_301
            wrapped_data["corr_account"]["confidence"] = 0.9
            wrapped_data["corr_account"]["note"] = "К/С автоматически найден по префиксу 301"
    # ------------------------------------------

    from validators import validate_inn, validate_kpp, validate_bank_requisites
    
    doc_type = wrapped_data.get("document_type", {}).get("value", "Счет на оплату")

    # 5. Математический арбитраж (ИНН/КПП)
    inn_val = wrapped_data.get("inn", {}).get("value")
    wrapped_data["inn"] = validate_inn(inn_val, doc_type)
    new_inn_val = wrapped_data.get("inn", {}).get("value")

    # Валидация КПП
    kpp_val = wrapped_data.get("kpp", {}).get("value")
    wrapped_data["kpp"] = validate_kpp(kpp_val, new_inn_val, doc_type)

    # 6. Валидация банковских реквизитов с прощением для КП
    bik_field = wrapped_data.get("bank_bik", {})
    bik_val = bik_field.get("value")
    
    # Гарантированный zfill(9) для БИК перед валидацией
    if bik_val and bik_val not in ["---", "", "null"]:
        cleaned_bik_digits = re.sub(r'\D', '', str(bik_val))
        if 0 < len(cleaned_bik_digits) < 9:
            bik_val = cleaned_bik_digits.zfill(9)
    
    # Валидация БИК
    wrapped_data["bank_bik"] = validate_bank_requisites(bik_val, "bank_bik", doc_type)
    new_bik_val = wrapped_data.get("bank_bik", {}).get("value")
    
    # Валидация Расчетного счета (р/с)
    rs_field = wrapped_data.get("bank_account", {})
    wrapped_data["bank_account"] = validate_bank_requisites(rs_field.get("value"), "bank_account", doc_type, is_corr=False, bik=new_bik_val)

    # Валидация Корреспондентского счета (к/с)
    ks_field = wrapped_data.get("corr_account", {})
    wrapped_data["corr_account"] = validate_bank_requisites(ks_field.get("value"), "corr_account", doc_type, is_corr=True, bik=new_bik_val)

    return wrapped_data, stats
