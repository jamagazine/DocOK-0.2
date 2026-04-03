import httpx
import json
import re
import asyncio
import os

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
    all_words = []  # List of {text, x, y, w, h}
    has_low_confidence = False

    for result in data.get('results', []):
        for res2 in result.get('results', []):
            text_detection = res2.get('textDetection', {})
            for page in text_detection.get('pages', []):
                p_w = float(page.get('width', 1))
                p_h = float(page.get('height', 1))
                
                for block in page.get('blocks', []):
                    for line in block.get('lines', []):
                        for word in line.get('words', []):
                            conf = word.get('confidence', 1.0)
                            if conf < 0.8:
                                has_low_confidence = True
                            
                            w_text = word.get('text', '')
                            text_parts.append(w_text)
                            
                            # Extract bounding box
                            poly = word.get('boundingBox', {}).get('vertices', [])
                            if poly and len(poly) >= 4:
                                x = min(int(v.get('x', 0)) for v in poly)
                                y = min(int(v.get('y', 0)) for v in poly)
                                w = max(int(v.get('x', 0)) for v in poly) - x
                                h = max(int(v.get('y', 0)) for v in poly) - y
                                all_words.append({
                                    "text": w_text,
                                    "x": x, "y": y, "w": w, "h": h
                                })
                        text_parts.append('\n')

    return "".join(text_parts), has_low_confidence, all_words

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

async def gpt_yandex(text: str, api_key: str, folder_id: str, system_prompt: str, model_type: str = "lite"):
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
    total_tokens = int(usage.get('totalTokens', 0))
    return data['result']['alternatives'][0]['message']['text'], total_tokens

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
    try:
        text = re.sub(r'```json|```', '', text).strip()
        match = re.search(r'(\[.*\]|\{.*\})', text, re.DOTALL)
        if match:
            return json.loads(match.group(1))
        return json.loads(text.strip())
    except:
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

async def extract_invoice_metadata(text: str, api_key: str, folder_id: str, system_prompt: str, model_type: str = "pro"):
    """Extracts only the metadata (inn, date, number) from raw header text."""
    lines = text.split('\n')
    header_slice = "\n".join(lines[:100])
    
    # Strip MD table markers for meta extraction
    clean_text = header_slice.replace("|", " ").replace("---", " ")
    clean_text = re.sub(r' +', ' ', clean_text)
    
    try:
        raw_res, tokens = await gpt_yandex(clean_text, api_key, folder_id, system_prompt, model_type)
        return parse_gpt_json(raw_res), tokens
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
    all_items = []
    all_fixes = []
    total_tokens = 0
    main_doc = {}
    footer_data = {}

    chunks = [data_lines[i:i + CHUNK_SIZE] for i in range(0, len(data_lines), CHUNK_SIZE)]
    sem = asyncio.Semaphore(5)
    
    async def process_single_chunk(i, chunk):
        async with sem:
            chunk_text = header_block + "\n" + "\n".join(chunk)
            try:
                raw_res, tokens = await gpt_yandex(chunk_text, api_key, folder_id, system_prompt, model_type)
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
            fixes_to_add = []
            items_to_add = []
            if isinstance(parsed, list):
                items_to_add = parsed
            elif isinstance(parsed, dict):
                fixes_to_add = parsed.get('fixes', [])
                items_to_add = parsed.get('items', [])
                if not main_doc:
                    main_doc = parsed.get('header', parsed.get('document', {}))
                if not footer_data:
                    footer_data = parsed.get('footer', {})
            
            all_fixes.extend(fixes_to_add)
            all_items.extend(items_to_add)
        else:
            all_items.append({"pos": "ERR", "name": f"Ошибка чанка {i+1}", "note": err_msg, "is_error_chunk": True})
            
    yield {
        "type": "result", 
        "items": all_items, 
        "fixes": all_fixes, 
        "tokens": total_tokens, 
        "main_doc": main_doc, 
        "footer": footer_data,
        "chunks_report": []
    }
