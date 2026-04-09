import json
import asyncio
import re

import logging

logger = logging.getLogger(__name__)

def clean_and_group_markdown_table(md_text: str) -> str:
    """
    Очищает Markdown-таблицу от мусора и группирует многострочные позиции 
    путем склейки ячеек по 'якорю' (номеру позиции или тегу).
    """
    lines = md_text.split('\n')
    table_lines = []
    in_table = False
    
    # 1. Извлечение тела таблицы и отсечение подвала
    for i, line in enumerate(lines):
        lower_line = line.lower()
        if 'наименование' in lower_line and ('кол-во' in lower_line or 'количество' in lower_line or 'цена' in lower_line):
            in_table = True
            table_lines.append(line)
            continue
            
        if in_table:
            # Жесткие стоп-слова для отсечения мусора
            if any(stop in lower_line for stop in ['итого', 'всего к оплате', 'всего наименований', 'внимание!', 'условия поставки', 'оплата данного счета']):
                break
            
            stripped = line.strip()
            if not stripped:
                continue
            if set(stripped.replace('|', '').replace('-', '').replace(' ', '')) == set() and len(table_lines) > 1:
                continue 
                
            table_lines.append(line)

    if len(table_lines) < 2:
        return ""

    # 2. Очистка и склейка ячеек (The Squeezer)
    header = table_lines[0]
    valid_rows = []
    current_row_cells = []

    for line in table_lines[1:]:
        if '---' in line:
            continue
            
        cells = [c.strip() for c in line.split('|')]
        if len(cells) < 3:
            continue
            
        # Очищаем фиктивные пустые ячейки по краям MD-таблицы
        if cells and cells[0] == '': cells.pop(0)
        if cells and cells[-1] == '': cells.pop()
        
        # Ищем 'якорь' в первых двух колонках (№ или Тег вроде В1, П1, 47.0)
        is_anchor = False
        val_col_0 = (cells[0] if len(cells) > 0 else "").replace('.', '')
        val_col_1 = (cells[1] if len(cells) > 1 else "").replace('.', '')
        
        if re.fullmatch(r'\d+', val_col_0) or re.fullmatch(r'[А-Яа-яA-Za-z]\d+[а-я]?', cells[0] if len(cells)>0 else ""):
            is_anchor = True
        elif val_col_1 and (re.fullmatch(r'\d+', val_col_1) or re.fullmatch(r'[А-Яа-яA-Za-z]\d+[а-я]?', cells[1] if len(cells)>1 else "")):
            is_anchor = True

        has_useful_data = bool(re.search(r'[a-zA-Zа-яА-Я0-9]', line))

        if is_anchor:
            if current_row_cells:
                valid_rows.append(current_row_cells)
            current_row_cells = cells
        else:
            # Склеиваем "хвост" с предыдущей позицией
            if current_row_cells and has_useful_data:
                for idx, cell in enumerate(cells):
                    if cell:
                        if idx < len(current_row_cells):
                            current_row_cells[idx] = f"{current_row_cells[idx]} {cell}".strip()
                        else:
                            current_row_cells.append(cell)
            elif not current_row_cells and has_useful_data:
                current_row_cells = cells

    if current_row_cells:
        valid_rows.append(current_row_cells)

    # 3. Сборка чистого Markdown
    col_count = len(header.split('|'))
    separator = "|" + "|".join(["---"] * (col_count - 2)) + "|"
    
    result_lines = [header, separator]
    for row in valid_rows:
        result_lines.append("| " + " | ".join(row) + " |")

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

async def process_items(extracted_text: str, p_method: str = "", api_key: str = "", folder_id: str = ""):
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
        
        # Apply Math Sanitizer
        validated_items = validate_math(items)
        return validated_items
        
    except Exception as e:
        print(f"Error calling LLM for items parsing: {e}")
        return []
