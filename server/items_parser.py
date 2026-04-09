import json
import asyncio
import re

def slice_markdown_table(md_text: str) -> str:
    """
    Slices the full markdown table to extract only the items section.
    Finds the header row with 'Кол-во', 'Цена', 'Сумма' etc.
    Extracts everything below it until footer markers ('Итого', 'Всего') or 5 empty lines.
    """
    if not md_text:
        return ""
        
    lines = md_text.split('\n')
    start_idx = -1
    end_idx = len(lines)
    
    # 1. Find Header
    for i, line in enumerate(lines):
        line_lower = line.lower()
        if any(marker in line_lower for marker in ["кол-во", "количество", "цена", "сумма", "наименование"]):
            # Found header, usually followed by markdown separator ---
            start_idx = i
            # Check if next line is a separator to include it or skip it
            if i + 1 < len(lines) and "---" in lines[i+1]:
                start_idx = i + 1  # start data right after separator
            break
            
    if start_idx == -1:
        # If no strict header found, we start from top
        start_idx = 0
        
    # 2. Find Footer or Empty line boundary
    empty_count = 0
    for i in range(start_idx + 1, len(lines)):
        line = lines[i].strip()
        line_lower = line.lower()
        
        if any(marker in line_lower for marker in ["итого", "всего", "в т.ч. ндс", "в т.ч.", "сумма прописью"]):
            end_idx = i
            break
            
        # Treat lines with only pipes and spaces as empty
        clean_content = line.replace("|", "").strip()
        if not clean_content:
            empty_count += 1
            if empty_count >= 5:
                end_idx = i - 5
                break
        else:
            empty_count = 0
            
    sliced_lines = lines[start_idx+1:end_idx]
    
    # Prepend dynamic Markdown header so LLM understands columns
    if start_idx > 0 and "---" in lines[start_idx]:
        header = lines[start_idx-1:start_idx+1]
        sliced_lines = header + sliced_lines
        
    return "\n".join(sliced_lines).strip()

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
        # Apply Excel/CSV Markdown Slicer
        markdown_payload = slice_markdown_table(extracted_text)
        
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
