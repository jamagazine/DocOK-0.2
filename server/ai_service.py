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
                            
                            # Extract bounding box (normalized 0-1 usually, or pixels)
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

async def gpt_yandex(text: str, api_key: str, folder_id: str, system_prompt: str, model_type: str = "lite"):
    url = "https://llm.api.cloud.yandex.net/foundationModels/v1/completion"
    headers = {
        "Authorization": f"Api-Key {api_key}",
        "x-folder-id": folder_id,
        "Content-Type": "application/json"
    }

    user_text = f"Текст документа:\n{text}"
    
    # We assume last_prompt.txt debug is handled or not needed here
    # If needed, it should be done in main.py or passed as a flag

    model_uri = f"gpt://{folder_id}/yandexgpt-lite/latest" if model_type == "lite" else f"gpt://{folder_id}/yandexgpt-pro/5.1"
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

async def extract_invoice_metadata(text: str, api_key: str, folder_id: str, model_type: str = "pro"):
    """
    Extracts only the invoice header (Metadata) using a specialized prompt.
    Takes first ~100 lines of MD text but strips table formatting for better extraction.
    """
    from main import load_prompt
    lines = text.split('\n')
    header_slice = "\n".join(lines[:100])
    
    # Strip MD table markers to get clean text for meta extraction
    clean_text = header_slice.replace("|", " ").replace("---", " ")
    clean_text = re.sub(r' +', ' ', clean_text)
    
    system_prompt = load_prompt("invoice_header")
    
    try:
        raw_res, tokens = await gpt_yandex(clean_text, api_key, folder_id, system_prompt, model_type)
        return parse_gpt_json(raw_res), tokens
    except Exception as e:
        print(f"Metadata extraction error: {e}")
        return None, 0

async def process_chunks_with_gpt(full_text: str, api_key: str, folder_id: str, system_prompt: str, model_type: str = "lite", context: dict = None):
    lines = full_text.split('\n')
    # If context (supplier) is provided, we can skip hardcoded header_block or use it alongside
    header_block = "\n".join(lines[:2]) if len(lines) >= 2 else (lines[0] if lines else "")
    data_lines = lines[2:] if len(lines) >= 2 else []
    
    # Inject context into system prompt if needed
    if context and "{supplier_name}" in system_prompt:
        system_prompt = system_prompt.replace("{supplier_name}", context.get("supplier_name", "Не указан"))

    CHUNK_SIZE = 400
    all_items = []
    all_fixes = []
    total_tokens = 0
    main_doc = {}
    footer_data = {}

    chunks = [data_lines[i:i + CHUNK_SIZE] for i in range(0, len(data_lines), CHUNK_SIZE)]
    sem = asyncio.Semaphore(5)
    
    async def process_single_chunk(i, chunk):
        async with sem:
            # For data rows, we don't necessarily need the full original header, 
            # but we need the table header (line 0, 1 of MD table)
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
                
                # Check for header/footer/document
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
