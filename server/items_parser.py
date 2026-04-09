import json
import asyncio
import re

import logging

logger = logging.getLogger(__name__)

def clean_and_group_markdown_table(md_text: str) -> str:
    """
    Ultra-Squeezer: 
    1. Весовой поиск заголовка.
    2. Отсечение подвала.
    3. Удаление полностью пустых колонок (Column Pruning).
    4. Склейка многострочных позиций по якорю.
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
    for i, row in enumerate(grid[:50]):
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
        return "" # Таблица не найдена

    # 3. Поиск подвала (Footer)
    footer_idx = len(grid)
    stop_words = ['итого', 'всего к оплате', 'всего наименований', 'внимание!', 'условия поставки', 'оплата данного счета', 'подготовлено:', 'руководитель', 'м.п.']
    
    for i in range(header_idx + 2, len(grid)):
        row_str = " ".join(grid[i]).lower()
        if any(stop in row_str for stop in stop_words):
            # Smart Stop-Valve: проверяем следующие 3 строки на наличие якоря
            is_subtotal = False
            # Ищем якорь в № или Артикуле
            for l_idx in range(i + 1, min(i + 4, len(grid))):
                lookahead_row = grid[l_idx]
                if not lookahead_row: continue
                val_0 = lookahead_row[0].strip() if len(lookahead_row) > 0 else ""
                val_1 = lookahead_row[1].strip() if len(lookahead_row) > 1 else ""
                
                if (val_0 and len(val_0) < 15 and val_0.lower() != 'итого') or \
                   (val_1 and len(val_1) < 15 and val_1.lower() != 'итого'):
                    is_subtotal = True
                    break
            
            if is_subtotal:
                continue # Считаем промежуточным итогом, идем дальше
                
            footer_idx = i
            break
            
    table_body = grid[header_idx:footer_idx]
    if len(table_body) < 3: # Заголовок, разделитель, минимум 1 строка данных
        return ""

    # 4. Column Pruning (Удаление пустых колонок)
    num_cols = len(table_body[0])
    cols_to_keep = []
    
    for col_idx in range(num_cols):
        has_data = False
        # Проверяем строки с данными (пропуская header и '---')
        for row in table_body[2:]:
            if col_idx < len(row) and re.sub(r'[^a-zA-Zа-яА-Я0-9]', '', row[col_idx]):
                has_data = True
                break
        
        header_val = table_body[0][col_idx].lower()
        # Оставляем, если есть данные ИЛИ если это нормальный заголовок (не Unnamed)
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

    for row in pruned_body[2:]:
        if not row or set("".join(row).replace('-', '').replace(' ', '')) == set():
            continue
            
        val_0 = row[0].strip() if len(row) > 0 else ""
        val_1 = row[1].strip() if len(row) > 1 else ""
        
        is_anchor = False
        if val_0 and len(val_0) < 15 and val_0.lower() != 'итого':
            is_anchor = True
        elif val_1 and len(val_1) < 15 and val_1.lower() != 'итого':
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

    # 6. Сборка финального Markdown
    if not valid_rows:
        return ""
        
    col_count = len(header)
    separator = "|" + "|".join(["---"] * col_count) + "|"
    
    result_lines = ["| " + " | ".join(header) + " |", separator]
    for row in valid_rows:
        padded_row = row + [""] * (col_count - len(row))
        result_lines.append("| " + " | ".join(padded_row) + " |")

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
    Main entry point for processing table items. 
    Applies slicer for Excel/CSV generated Markdown, then calls LLM.
    """
    from ai_service import gpt_yandex, parse_gpt_json, load_prompt
    
    if not extracted_text:
        return []

    markdown_payload = extracted_text
    
    if p_method == "excel_ai":
        # Apply Excel/CSV Markdown Squeezer
        markdown_payload = clean_and_group_markdown_table(extracted_text)
    elif p_method in ["ocr_table", "pdf_text"]:
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
        return []
        
    parts = prompt_template.split("[INSTRUCTION]")
    system_prompt = parts[0].strip()
    instruction = "[INSTRUCTION]" + parts[1].replace("{markdown_payload}", markdown_payload).strip()
    
    try:
        llm_response, _ = await gpt_yandex(
            text=instruction, 
            api_key=api_key, 
            folder_id=folder_id, 
            system_prompt=system_prompt,
            model_type="pro"
        )
        
        parsed = parse_gpt_json(llm_response)
        items = parsed.get("items", []) if isinstance(parsed, dict) else (parsed if isinstance(parsed, list) else [])
        
        # Force supplier assignment if missing
        if supplier_name:
            for item in items:
                if not item.get("supplier") or item.get("supplier") == "---":
                    item["supplier"] = supplier_name
                    
        # Apply Math Sanitizer
        validated_items = validate_math(items)
        return validated_items
        
    except Exception as e:
        print(f"Error calling LLM for items parsing: {e}")
        return []
