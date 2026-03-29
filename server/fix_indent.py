import os
import json

os.system("git restore server/main.py")

with open("server/main.py", "r", encoding="utf-8") as f:
    text = f.read()

import re
text = re.sub(r'estimated_tokens = int\(input_tokens \* [\d\.]+\)', 'estimated_tokens = int(input_tokens * 1.5)', text)

old_chunks_code = """    tasks = [process_single_chunk(i, chunk) for i, chunk in enumerate(chunks)]
    results = await asyncio.gather(*tasks)
    
    # Sort results by chunk index to maintain order
    results.sort(key=lambda x: x[0])
    
    for i, ok, parsed, tokens, err_msg in results:
        total_tokens += tokens
        if ok and parsed:
            all_items.extend(parsed.get('items', []))
            if not main_doc and parsed.get('document'):
                main_doc = parsed.get('document', {})
            chunks_report.append({"id": i+1, "ok": True})
        else:
            chunks_report.append({"id": i+1, "ok": False})
            all_items.append({
                "pos": "ERROR",
                "name": f"Ошибка обработки блока строк {i+1}",
                "note": err_msg or "Неизвестная ошибка"
            })
            
    # If all items failed but we have a main_doc (unlikely), or no items at all
    if not all_items and not main_doc:
        return None, total_tokens, None, chunks_report
        
    return all_items, total_tokens, main_doc, chunks_report"""

new_chunks_code = """    tasks = [process_single_chunk(i, chunk) for i, chunk in enumerate(chunks)]
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
            all_items.extend(parsed.get('items', []))
            if not main_doc and parsed.get('document'):
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
        
    yield {"type": "result", "items": all_items, "tokens": total_tokens, "main_doc": main_doc, "chunks_report": chunks_report}"""

if old_chunks_code in text:
    text = text.replace(old_chunks_code, new_chunks_code)

start_s = "    # CACHE CHECK\n    cache_path = os.path.join(STORAGE_DIR, f\"{secured_name}.json\")"
end_s = "    finally:\n        # DEBUG: Disabled cleanup per user request to inspect temp files"
idx_start = text.find(start_s)
idx_end = text.find(end_s)

block = text[idx_start:idx_end]

b1 = block.replace("            return cached_data", "            yield f\"data: {json.dumps({'status': 'final', 'data': cached_data}, ensure_ascii=False)}\\n\\n\"\n            return")

new_auth = """        all_items = None
        total_tokens = 0
        main_doc_info = None
        all_chunks_report = []
        async for event in process_chunks_with_gpt(extracted_text, str(api_key), str(folder_id), model_type, doc_type):
            if event["type"] == "progress":
                msg = {"status": "chunk", "index": event["index"], "total": event["total"]}
                yield f"data: {json.dumps(msg, ensure_ascii=False)}\\n\\n"
            elif event["type"] == "result":
                all_items = event["items"]
                total_tokens = event["tokens"]
                main_doc_info = event["main_doc"]
                all_chunks_report = event["chunks_report"]
        
        if all_items is None:
            yield f"data: {json.dumps({'status': 'error', 'detail': 'ИИ вернул невалидный ответ'}, ensure_ascii=False)}\\n\\n"
            return"""
        
b2 = b1.replace("""        all_items, total_tokens, main_doc_info, all_chunks_report = await process_chunks_with_gpt(extracted_text, str(api_key), str(folder_id), model_type, doc_type)
        
        if all_items is None:
            raise HTTPException(status_code=422, detail="ИИ вернул невалидный ответ")""", new_auth)
        
b3 = b2.replace("""        return final_struct

    except HTTPException:
        # Re-raise HTTP exceptions directly
        raise
    except Exception as e:
        import traceback
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))""",
"""        # Get estimated from manifest
        estimated_cost = 0.0
        for k, v in manifest.items():
            if isinstance(v, dict) and (v.get("originalName") == original_name or v.get("original_name") == original_name):
                estimated_cost = v.get("estimated_cost", 0.0)
                break
        
        print(f"DEBUG ECONOMY: {filename} | Est: {estimated_cost} руб | Real: {cost} руб")
        
        yield f"data: {json.dumps({'status': 'final', 'data': final_struct}, ensure_ascii=False)}\\n\\n"

    except Exception as e:
        import traceback
        traceback.print_exc()
        yield f"data: {json.dumps({'status': 'error', 'detail': str(e)}, ensure_ascii=False)}\\n\\n\"""")

b4 = b3.replace("""            raise HTTPException(status_code=400, detail="Unsupported file format.")""", 
"""            yield f"data: {json.dumps({'status': 'error', 'detail': 'Unsupported file format.'}, ensure_ascii=False)}\\n\\n"
            return""")
b4 = b4.replace("""             raise HTTPException(status_code=400, detail="No readable text found in document.")""",
"""             yield f"data: {json.dumps({'status': 'error', 'detail': 'No readable text found in document.'}, ensure_ascii=False)}\\n\\n"
             return""")

indented_lines = ["        " + x for x in b4.split('\n')]
if indented_lines[-1] == "        ":
    indented_lines.pop()
indented_block = "\n".join(indented_lines)

wrapper = f"""    async def event_generator():
        try:
            yield f"data: {{json.dumps({{'status': 'stage', 'step': 'prep'}}, ensure_ascii=False)}}\\n\\n"
{indented_block}

    return StreamingResponse(event_generator(), media_type="text/event-stream")
"""

text = text[:idx_start] + wrapper + text[idx_end:]

with open("server/main.py", "w", encoding="utf-8") as f:
    f.write(text)
