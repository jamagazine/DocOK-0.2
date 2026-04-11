import json
import asyncio
import re

import logging

logger = logging.getLogger(__name__)

def clean_and_group_markdown_table(md_text: str) -> str:
    """
    Ultra-Squeezer 4.0 (Semicolon Edition): 
    Converts sparse Markdown into ultra-dense semicolon-separated text.
    """
    lines = [line.strip() for line in md_text.split('\n') if line.strip()]
    
    # 1. Парсим Markdown в двумерный массив (grid)
    grid = []
    for line in lines:
        if line.startswith('|') and line.endswith('|'):
            cells = [c.strip() for c in line.split('|')[1:-1]]
            grid.append(cells)
            
    if not grid:
        return ""

    # 2. Весовой поиск заголовка таблицы
    header_idx = -1
    max_score = 0
    for i, row in enumerate(grid[:200]):
        row_str = " ".join(row).lower()
        score = 0
        if re.search(r'\b(№|n|поз)\b', row_str): score += 1
        if re.search(r'\b(наименование|товар|услуг|работ|номенклатура)\b', row_str): score += 2
        if re.search(r'\b(кол-во|количество)\b', row_str): score += 1
        if re.search(r'\b(цена|стоимость)\b', row_str): score += 1
        if re.search(r'\b(сумма|всего)\b', row_str): score += 1
        
        if score >= 3 and score > max_score:
            max_score = score
            header_idx = i

    if header_idx == -1:
        return ""

    # 3. Поиск подвала (Footer) с Peak-ahead на 3 строки
    footer_idx = len(grid)
    stop_words = ['итого', 'всего к оплате', 'всего наименований', 'внимание!', 'условия поставки', 'оплата данного счета', 'подготовлено:', 'руководитель', 'м.п.']
    
    for i in range(header_idx + 2, len(grid)):
        row_str = " ".join(grid[i]).lower()
        if any(stop in row_str for stop in stop_words):
            # Smart Stop-Valve (Peak-ahead)
            is_fake_stop = False
            for j in range(1, 4):
                if i + j < len(grid):
                    next_row = grid[i+j]
                    val_0 = next_row[0].strip() if len(next_row) > 0 else ""
                    val_1 = next_row[1].strip() if len(next_row) > 1 else ""
                    
                    if (val_0 and len(val_0) < 15 and val_0.lower() not in stop_words) or \
                       (val_1 and len(val_1) < 15 and val_1.lower() not in stop_words):
                        if re.search(r'\d', val_0 + val_1): # Защита: должна быть хоть одна цифра
                            is_fake_stop = True
                            break
            
            if not is_fake_stop:
                footer_idx = i
                break
            
    table_body = grid[header_idx:footer_idx]
    if len(table_body) < 3:
        return ""

    # 4. Column Pruning (Удаление пустых колонок)
    num_cols = len(table_body[0])
    cols_to_keep = []
    
    for col_idx in range(num_cols):
        has_data = False
        for row in table_body[2:]:
            if col_idx < len(row) and re.sub(r'[^a-zA-Zа-яА-Я0-9]', '', row[col_idx]):
                has_data = True
                break
        
        header_val = table_body[0][col_idx].lower()
        if has_data or (header_val and 'unnamed' not in header_val):
            cols_to_keep.append(col_idx)

    pruned_body = []
    for row in table_body:
        pruned_row = [row[i] for i in cols_to_keep if i < len(row)]
        pruned_body.append(pruned_row)

    # 5. Склейка строк (The Squeezer)
    valid_rows = []
    current_row_cells = []
    header = pruned_body[0]

    for row in pruned_body[1:]:
        if not row or set("".join(row).replace('-', '').replace(' ', '')) == set():
            continue
            
        val_col_0 = row[0].strip() if len(row) > 0 else ""
        val_col_1 = row[1].strip() if len(row) > 1 else ""
        
        is_anchor = False
        if val_col_0 and len(val_col_0) < 15 and val_col_0.lower() not in stop_words:
            is_anchor = True
        elif val_col_1 and len(val_col_1) < 15 and val_col_1.lower() not in stop_words:
            is_anchor = True

        has_useful_data = bool(re.search(r'[a-zA-Zа-яА-Я0-9]', " ".join(row)))

        if is_anchor:
            if current_row_cells:
                valid_rows.append(current_row_cells)
            current_row_cells = row
        else:
            if current_row_cells and has_useful_data:
                for idx, cell in enumerate(row):
                    if cell:
                        if idx < len(current_row_cells):
                            current_row_cells[idx] = f"{current_row_cells[idx]} {cell}".strip()
                        else:
                            current_row_cells.append(cell)
            elif not current_row_cells and has_useful_data:
                current_row_cells = row

    if current_row_cells:
        valid_rows.append(current_row_cells)

    # 6. Сборка финального текста (DENSE SEMICOLON FORMAT)
    if not valid_rows:
        return ""
        
    def clean_cell(c):
        # Удаляем лишние пробелы внутри ячейки
        text = re.sub(r'\s+', ' ', str(c)).strip()
        
        # Нормализация чисел: удаляем пробелы из чисел с разделителями тысяч
        # Примеры: "15 540,00" → "15540,00", "1 234 567.89" → "1234567.89"
        # Паттерн: цифра + (пробел + цифры)+ + опционально (запятая/точка + цифры)
        text = re.sub(r'(\d)\s+(?=\d)', r'\1', text)
        
        return text

    result_lines = []
    header_clean = [clean_cell(h) for h in header]
    result_lines.append("; ".join(header_clean))
    
    for row in valid_rows:
        padded_row = row + [""] * (len(header) - len(row))
        row_clean = [clean_cell(c) for c in padded_row]
        # Удаляем пустые хвосты, чтобы не плодить "; ; ;" в конце строки
        while row_clean and not row_clean[-1]:
            row_clean.pop()
        result_lines.append("; ".join(row_clean))

    return "\n".join(result_lines)

def validate_math(items: list) -> list:
    """
    Validates the math (quantity * price_final == total) for each item.
    """
    for item in items:
        # Safely extract floats
        try:
            qty = float(item.get('quantity', 0) or 0)
        except: qty = 0.0
        
        try:
            price = float(item.get('price_final', 0) or 0)
        except: price = 0.0
        
        try:
            total = float(item.get('total', 0) or 0)
        except: total = 0.0
        
        # Validation with 0.1 tolerance for rounding
        item['is_valid'] = abs((qty * price) - total) < 0.1
        
    return items

async def process_items(extracted_text: str, p_method: str = "", api_key: str = "", folder_id: str = "", supplier_name: str = ""):
    """
    Applies slicer for Excel/CSV generated Markdown, chunks the payload, then calls LLM concurrently.
    Returns: (items_list, UsageStats)
    """
    from ai_service import gpt_yandex, parse_gpt_json, load_prompt, UsageStats
    
    if not extracted_text:
        return [], UsageStats()

    markdown_payload = extracted_text
    
    if p_method == "excel_ai":
        # Apply Excel/CSV Semicolon Squeezer
        markdown_payload = clean_and_group_markdown_table(extracted_text)
    elif p_method == "pdf_text":
        # Apply Ultra-Squeezer for digital PDF tables (same as Excel)
        markdown_payload = clean_and_group_markdown_table(extracted_text)
    elif p_method == "ocr_table":
        # OCR PDF filter: keep only lines containing digits (price/quantity candidates)
        lines = extracted_text.split('\n')
        filtered = []
        for line in lines:
            if re.search(r'\d', line) or '---' in line or not line.strip():
                filtered.append(line)
        markdown_payload = '\n'.join(filtered)
        
    prompt_template = load_prompt("invoice_items")
    if not prompt_template:
        print("Error: invoice_items_prompt.md not found")
        return [], UsageStats()
        
    parts = prompt_template.split("[INSTRUCTION]")
    system_prompt = parts[0].strip()
    
    # Chunking Semicolon Payload (15 rows max per chunk) to avoid output token truncation
    lines = markdown_payload.split('\n')
    header_line = lines[0] if lines else ""
    data_lines = lines[1:] if len(lines) > 1 else []
    
    chunks = []
    chunk_size = 15
    if data_lines:
        for i in range(0, len(data_lines), chunk_size):
            chunk = [header_line] + data_lines[i:i+chunk_size]
            chunks.append('\n'.join(chunk))
    else:
        chunks = [markdown_payload]
        
    total_stats = UsageStats()
    all_items = []
    
    async def process_chunk(chunk_payload, index):
        instruction = "[INSTRUCTION]" + parts[1].replace("{markdown_payload}", chunk_payload).strip()
        try:
            llm_response, in_tok, out_tok = await gpt_yandex(
                text=instruction, 
                api_key=api_key, 
                folder_id=folder_id, 
                system_prompt=system_prompt,
                model_type="pro",
                label=f"Items_Chunk_{index}"
            )
            chunk_stats = UsageStats()
            chunk_stats.add(f"Items_Chunk_{index}", "yandexgpt-pro", in_tok, out_tok)
            
            parsed = parse_gpt_json(llm_response)
            chunk_items = parsed.get("items", []) if isinstance(parsed, dict) else (parsed if isinstance(parsed, list) else [])
            return chunk_items, chunk_stats
        except Exception as e:
            logger.error(f"CRITICAL: Error calling LLM for items parsing chunk {index}: {e}", exc_info=True)
            return [], UsageStats()

    chunk_tasks = [process_chunk(c, i + 1) for i, c in enumerate(chunks)]
    results = await asyncio.gather(*chunk_tasks)
    
    for items, stats in results:
        all_items.extend(items)
        total_stats.merge(stats)
        
                
    # Force supplier assignment if missing
    if supplier_name:
        for item in all_items:
            if not item.get("supplier") or item.get("supplier") == "---":
                item["supplier"] = supplier_name

    # Apply Math Sanitizer
    validated_items = validate_math(all_items)
    return validated_items, total_stats
