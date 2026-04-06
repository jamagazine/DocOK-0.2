from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks, Body, Request, Header, Form
from fastapi.responses import FileResponse, PlainTextResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import json
import os
import shutil
import base64
import re
import asyncio
import pandas as pd, io
import datetime
from urllib.parse import quote
import rapidfuzz
import uuid
import re
import zipfile
import tempfile

def slugify_translit(text: str) -> str:
    # 1. Transliterate using the existing helper
    from parser_utils import transliterate
    t = transliterate(text)
    # 2. To lower
    t = t.lower()
    # 3. Replace anything not alphanumeric/hyphen with hyphen
    t = re.sub(r'[^a-z0-9]', '-', t)
    # 4. Collapse multiple hyphens
    t = re.sub(r'-+', '-', t)
    # 5. Trim hyphens from start/end
    return t.strip('-')

# Import modularized logic
from parser_utils import (
    normalize_for_match, calculate_uncertainty, 
    transliterate, secure_filename, sanitize_dataframe, 
    convert_df_to_items, extract_text_from_pdf, extract_specification_summary,
    excel_to_grid_markdown, clean_and_build_markdown
)
from ai_service import (
    ocr_yandex, gpt_yandex, get_token_count, 
    parse_gpt_json, process_chunks_with_gpt,
    process_header_with_llm
)

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

@app.post("/api/v1/extract-layout")
async def extract_layout_endpoint(ocr_json: dict = Body(...)):
    """
    Sprint 1: Server-side geometric processing (Y-Snapping, Anchor-based cropping).
    """
    try:
        markdown_layout = clean_and_build_markdown(ocr_json)
        return {"markdown_layout": markdown_layout}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

CONFIG_FILE = os.path.join(os.path.dirname(__file__), "config.json")
PROJECTS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "projects")
os.makedirs(PROJECTS_DIR, exist_ok=True)

def migrate_legacy_storage():
    """Safety migration for old 'server/storage' data to the new Project-based system."""
    old_storage = os.path.join(os.path.dirname(__file__), "storage")
    if not os.path.exists(old_storage):
        return

    # Check if storage has any real files (excluding hidden files)
    legacy_files = [f for f in os.listdir(old_storage) if os.path.isfile(os.path.join(old_storage, f)) and not f.startswith('.')]
    
    if legacy_files:
        print(f"!!! ALERT: Found {len(legacy_files)} legacy files in storage/ - Migrating to Legacy_Archive project...")
        
        # 1. Create a dedicated Legacy project folder
        legacy_uuid = "legacy-archive-0000" # Static-ish UUID for the archive
        legacy_folder_name = "legacy-archive"
        legacy_path = os.path.join(PROJECTS_DIR, legacy_folder_name)
        legacy_files_dir = os.path.join(legacy_path, "files")
        os.makedirs(legacy_files_dir, exist_ok=True)
        
        # 2. Move files
        for f in legacy_files:
            src = os.path.join(old_storage, f)
            dest = os.path.join(legacy_files_dir, f)
            shutil.move(src, dest)
            
        # 3. Create project state
        now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        state = {
            "id": legacy_uuid,
            "title": "Legacy Archive (Авто-миграция)",
            "categoryId": "archive",
            "filesCount": len(legacy_files),
            "lastModified": "Сейчас",
            "createdAt": now,
            "updatedAt": now,
            "status": "active",
            "version": "1.0",
            "files": []
        }
        with open(os.path.join(legacy_path, "project_state.json"), "w", encoding="utf-8") as f:
            json.dump(state, f, ensure_ascii=False, indent=4)
            
        print(f"Legacy migration complete. Data is now in projects/{legacy_folder_name}")

    # Final Deletion
    try:
        shutil.rmtree(old_storage)
        print("Cleaned up legacy server/storage directory.")
    except Exception as e:
        print(f"Warning: Could not remove old storage folder: {e}")

# Run migration on startup
migrate_legacy_storage()

def get_project_dir(project_id: str):
    if not project_id:
        raise HTTPException(status_code=400, detail="Missing project_id")
    
    # 1. Try direct path first (for transition or if ID is the slug)
    p_path = os.path.join(PROJECTS_DIR, project_id)
    state_file_direct = os.path.join(p_path, "project_state.json")
    if os.path.exists(state_file_direct):
         try:
             with open(state_file_direct, "r", encoding="utf-8") as f:
                 if json.load(f).get("id") == project_id:
                     return p_path
         except: pass

    # 2. Scanning all project folders to find the matching UUID
    if os.path.exists(PROJECTS_DIR):
        for d in os.listdir(PROJECTS_DIR):
            folder_path = os.path.join(PROJECTS_DIR, d)
            if not os.path.isdir(folder_path): continue
            sf = os.path.join(folder_path, "project_state.json")
            if os.path.exists(sf):
                try:
                    with open(sf, "r", encoding="utf-8") as f:
                        if json.load(f).get("id") == project_id:
                            return folder_path
                except: continue
                
    raise HTTPException(status_code=404, detail=f"Project {project_id} not found")

def get_files_dir(project_id: str):
    f_path = os.path.join(get_project_dir(project_id), "files")
    os.makedirs(f_path, exist_ok=True)
    return f_path

def get_manifest_path(project_id: str):
    return os.path.join(get_project_dir(project_id), "manifest.json")

def get_history_path(project_id: str):
    return os.path.join(get_project_dir(project_id), "history.json")

def get_file_path(project_id: str, filename: str, suffix: str = ""):
    """Dynamically resolves the path to a file inside the project directory."""
    # Ensure we use ONLY the basename for security and portability
    base_name = os.path.basename(filename)
    files_dir = get_files_dir(project_id)
    return os.path.join(files_dir, base_name + suffix)

def _load_manifest(project_id: str):
    manifest_file = get_manifest_path(project_id)
    if not os.path.exists(manifest_file):
        return {}
    try:
        with open(manifest_file, "r", encoding="utf-8") as f:
            data = json.load(f)
            
        # --- Migration: Convert absolute path keys to relative filenames ---
        migrated = {}
        has_changes = False
        for k, v in data.items():
            if os.path.isabs(k) or "/" in k or "\\" in k:
                rel_key = os.path.basename(k)
                if rel_key not in migrated: # Avoid overwriting if relative key already exists
                    migrated[rel_key] = v
                    has_changes = True
                else:
                    # Merge if both exist (rare but possible during migration)
                    migrated[rel_key].update(v)
                    has_changes = True
            else:
                migrated[k] = v
        
        if has_changes:
            _save_manifest(migrated, project_id) # Persist cleanup
            
        return migrated
    except Exception:
        return {}

def _save_manifest(manifest, project_id: str):
    manifest_file = get_manifest_path(project_id)
    try:
        with open(manifest_file, "w", encoding="utf-8") as f:
            json.dump(manifest, f, ensure_ascii=False, indent=4)
    except Exception as e:
        print(f"Error saving manifest: {e}")

def append_history(action_data: dict, project_id: str):
    history_file = get_history_path(project_id)
    history = []
    if os.path.exists(history_file):
        try:
            with open(history_file, "r", encoding="utf-8") as f:
                history = json.load(f)
        except Exception:
            pass
            
    if "timestamp" not in action_data:
        action_data["timestamp"] = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
    # Ensure relative filename in history
    if "fileName" in action_data:
        action_data["fileName"] = os.path.basename(action_data["fileName"])
        
    history.append(action_data)
    
    with open(history_file, "w", encoding="utf-8") as f:
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

def load_prompt(name: str) -> str:
    path = os.path.join(os.path.dirname(__file__), "prompts", f"{name}_prompt.md")
    if not os.path.exists(path):
        return ""
    try:
        with open(path, "r", encoding="utf-8") as f:
            return f.read().strip()
    except Exception as e:
        print(f"Error loading prompt {name}: {e}")
        return ""

@app.get("/api/storage/history/export")
async def export_history(projectId: str):
    p_path = get_project_dir(projectId)
    history_file = get_history_path(projectId)
    if not os.path.exists(history_file):
        return PlainTextResponse("История пуста")
        
    try:
        with open(history_file, "r", encoding="utf-8") as f:
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
async def export_history_xlsx(projectId: str):
    p_path = get_project_dir(projectId)
    history_file = get_history_path(projectId)
    if not os.path.exists(history_file):
        return PlainTextResponse("История пуста")
        
    try:
        with open(history_file, "r", encoding="utf-8") as f:
            history = json.load(f)
            
        if not history:
            return PlainTextResponse("История пуста")
            
        df = pd.DataFrame(history)
        
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
        
        cols = [c for c in rename_map.values() if c in df.columns]
        df = df[cols]
        
        if 'Цена' in df.columns:
            df['Цена'] = pd.to_numeric(df['Цена'], errors='coerce').fillna(0)
            total_cost = df['Цена'].sum()
            
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


@app.post("/api/process-invoice")
async def process_invoice(
    projectId: str = Form(...),
    file: UploadFile | None = File(None),
    file_id: str | None = Form(None),
    doc_type: str = Form("invoice"),
    parse_method: str = Form("auto"),
    force_ocr: str = Form("false"),
    x_api_key: str | None = Header(None),
    x_folder_id: str | None = Header(None)
):
    is_force_ocr = force_ocr.lower() == "true"
    api_key, folder_id = get_yandex_keys()
    if x_api_key: api_key = x_api_key
    if x_folder_id: folder_id = x_folder_id

    if not api_key or not folder_id:
        raise HTTPException(status_code=400, detail="Yandex API keys not configured.")

    if file_id:
        disk_name = file_id
        manifest = _load_manifest(projectId)
        original_name = manifest.get(disk_name, {}).get("originalName", disk_name)
    elif file:
        original_name = file.filename
        secured_name = secure_filename(transliterate(original_name))
        manifest = _load_manifest(projectId)
        disk_name = secured_name
        for k, v in manifest.items():
            if isinstance(v, dict) and (v.get("originalName") == original_name or v.get("original_name") == original_name):
                disk_name = k; break
    else:
        raise HTTPException(status_code=400, detail="Require file or file_id")

    filename = original_name.lower()
    temp_path = get_file_path(projectId, disk_name)
    cache_path = get_file_path(projectId, disk_name, ".json")

    if file and not os.path.exists(temp_path):
        with open(temp_path, "wb") as f: shutil.copyfileobj(file.file, f)

    async def event_generator():
        yield f"data: {json.dumps({'status': 'stage', 'step': 'prep'}, ensure_ascii=False)}\n\n"
        if os.path.exists(cache_path):
            try:
                with open(cache_path, "r", encoding="utf-8") as f:
                    cached = json.load(f)
                cached["method"] = "CACHED"
                yield f"data: {json.dumps({'status': 'final', 'data': cached}, ensure_ascii=False)}\n\n"
                return
            except: pass
    
        extracted_text = ""
        full_header_text = ""
        has_low_confidence = False
        num_pages = 0
        p_method = "ocr_table"
        p_width, p_height = 0, 0
        all_items = []
        main_doc = None
        total_tokens = 0
        footer_data = {}
        
        try:
            # 1. OCR / Parsing Phase
            if filename.endswith(".pdf"):
                import pdfplumber
                from parser_utils import deskew_image # Оставляем для сканов
                from parser_utils import clean_and_build_markdown, ocr_to_grid_markdown
                
                with pdfplumber.open(temp_path) as pdf:
                    first_page = pdf.pages[0]
                    
                    # --- ПУТЬ 1: ЦИФРОВОЙ PDF (БЫСТРЫЙ И ЧИСТЫЙ) ---
                    if len(first_page.chars) > 50 and not is_force_ocr:
                        print(f"⚡ [CLEAN TEXT] Обработка цифрового PDF без таблиц: {original_name}")
                        
                        all_text_buffer = ""
                        for pg in pdf.pages:
                            # Извлекаем текст с сохранением физического расположения (layout=True)
                            # но БЕЗ добавления табличных разделителей |
                            page_text = pg.extract_text(layout=True) or ""
                            all_text_buffer += page_text + "\n\n"
                        
                        # Очищаем от лишних двойных пробелов, сохраняя структуру строк
                        clean_text = "\n".join([line.strip() for line in all_text_buffer.split('\n') if line.strip()])
                        
                        extracted_text = clean_text
                        full_header_text = clean_text[:3000] # Берем верхнюю часть для реквизитов
                        p_method = "pdf_text"
                        raw_ocr_data = {"raw_text_mode": True, "content": clean_text} # Флаг для ИИ
                        num_pages = len(pdf.pages)
                        has_low_confidence = False

                    # --- ПУТЬ 2: СКАН / ПРИНУДИТЕЛЬНЫЙ OCR ---
                    else:
                        print(f"🔍 [OCR] Обработка как скан: {original_name}")
                        if is_force_ocr:
                            print(f"🔍 [HYBRID] Принудительный OCR запрошен для: {original_name}.")
                            
                        all_ocr_text = ""
                        raw_ocr_data = [] 
                        
                        num_pages = len(pdf.pages)
                        for i, pg in enumerate(pdf.pages):
                            p_img = pg.to_image(resolution=200).original
                            p_img = deskew_image(p_img)
                            
                            img_byte_arr = io.BytesIO()
                            p_img.save(img_byte_arr, format='PNG')
                            
                            txt_res, low_res, words_res, raw_json = await ocr_yandex(base64.b64encode(img_byte_arr.getvalue()).decode('utf-8'), api_key, folder_id)
                            raw_ocr_data.append(raw_json)
                            
                            h, t = ocr_to_grid_markdown(words_res)
                            if t: all_ocr_text += f"\n\n{t}"
                            if low_res: has_low_confidence = True
                            
                            await asyncio.sleep(1.5)
                        
                        extracted_text = all_ocr_text.strip()
                        full_header_text = clean_and_build_markdown(raw_ocr_data)
                        p_method = "ocr_table"
                
                # Save Raw OCR Log for Debugging
                raw_log_p = get_file_path(projectId, disk_name, "_raw_ocr.json")
                with open(raw_log_p, "w", encoding="utf-8") as f:
                    json.dump(raw_ocr_data, f, ensure_ascii=False, indent=2)
            elif filename.endswith((".xlsx", ".xls", ".csv")):
                from parser_utils import excel_to_grid_markdown
                extracted_text = excel_to_grid_markdown(temp_path)
                full_header_text = ""
                p_method = "excel_ai"
            else: # Images
                from parser_utils import ocr_to_grid_markdown
                p_method = "ocr_table"
                with open(temp_path, "rb") as f:
                    txt_res, low_res, words_res = await ocr_yandex(base64.b64encode(f.read()).decode('utf-8'), api_key, folder_id)
                h, t = ocr_to_grid_markdown(words_res)
                extracted_text = t.strip()
                full_header_text = h.strip()
                if low_res: has_low_confidence = True

            # Save sterile MD files locally for reference (Full Debug View)
            debug_header = f"DEBUG_INFO: Size={p_width}x{p_height}, Method={p_method}\n"
            full_md_debug = (debug_header + full_header_text + "\n\n" + extracted_text).strip()
            
            grid_p = get_file_path(projectId, disk_name, "_invoice.md")
            with open(grid_p, "w", encoding="utf-8") as f: f.write(full_md_debug)
            
            final_p = get_file_path(projectId, disk_name, "_invoice_final.md")
            with open(final_p, "w", encoding="utf-8") as f: f.write(full_md_debug)

            # Metadata source (Header + bit of grid)
            metadata_source = (full_header_text + "\n" + (extracted_text[:1000] if extracted_text else "")).strip()
            if not metadata_source: metadata_source = "Empty Document"

            # SYMBOLIC SEMANTIC EXTRACTION (Sprint 2)
            yield f"data: {json.dumps({'status': 'chunk', 'index': 1, 'total': 1, 'msg': 'Разбор реквизитов (Semantic Parsing)...'}, ensure_ascii=False)}\n\n"
            
            # Pass full OCR data or local text to the semantic extractor
            main_doc = await process_header_with_llm(raw_ocr_data, api_key, folder_id)

            # --- ИНЪЕКЦИЯ МЕТОДА ДЛЯ ФРОНТЕНДА ---
            if isinstance(main_doc, dict):
                main_doc["method"] = p_method
            # --------------------------------------

            # Sprint 4: Diagnostics
            if all((v.get("value") in [None, ""] if isinstance(v, dict) else v in [None, ""]) for v in main_doc.values()):
                print(f"Warning: LLM returned empty data for file [{original_name}]")
            
            all_items = []
            footer_data = {}
            total_tokens = 0

            # Final structural assembly
            final_struct = calculate_uncertainty({"document": main_doc, "items": all_items}, has_low_confidence)
            if footer_data: final_struct["footer"] = footer_data

            # Summary and Cost
            from parser_utils import generate_invoice_summary
            summary_md = generate_invoice_summary(final_struct)
            rate = 0.6 if p_method == "ocr_table" else 0.2
            cost = round((total_tokens * rate) / 1000 + (num_pages * 1.5 if p_method == "ocr_table" else 0), 2)
            final_struct.update({"cost": cost, "method": p_method, "usage": {"tokens": total_tokens}, "summary_md": summary_md})
            
            # Cache and Manifest update
            with open(cache_path, "w", encoding="utf-8") as f: json.dump(final_struct, f, ensure_ascii=False, indent=2)
            manifest = _load_manifest(projectId)
            if disk_name in manifest:
                # Гарантируем наличие метода для фронтенда (даже если данные пусты)
                supp_safe = main_doc if isinstance(main_doc, dict) else {}
                manifest[disk_name].update({
                    "cost": cost, 
                    "status": "READY_MD_LOCAL" if p_method == "pdf_text" else "READY_MD_OCR",
                    "method": p_method, # Ключ в корне для кнопок
                    "summary_md": summary_md,
                    "supplierData": {
                        **supp_safe,
                        "method": p_method # Дублируем внутрь для фронтенда
                    }
                })
                _save_manifest(manifest, projectId)
            append_history({"fileName": original_name, "cost": cost, "tokens": total_tokens, "status": "DONE"}, projectId)
            
            yield f"data: {json.dumps({'status': 'final', 'data': final_struct}, ensure_ascii=False)}\n\n"

        except Exception as e:
            import traceback
            traceback.print_exc()
            yield f"data: {json.dumps({'status': 'error', 'detail': str(e)}, ensure_ascii=False)}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.post("/api/match-items")
async def match_items_endpoint(request: Request):
    data = await request.json()
    invoice_items, spec_items = data.get("invoice_items", []), data.get("spec_items", [])
    spec_dict = [{"id": s.get("id"), "raw": s.get("name", ""), "norm": normalize_for_match(str(s.get("name", "")))} for s in spec_items if s.get("id")]
    for item in invoice_items:
        norm_i, best, best_s = normalize_for_match(str(item.get("name", ""))), None, 0
        if norm_i and spec_dict:
            for s in spec_dict:
                sc = rapidfuzz.fuzz.token_sort_ratio(norm_i, s["norm"])
                if sc > best_s: best_s, best = sc, s
        item["match_data"] = {"target_id": best["id"] if best else None, "target_name": best["raw"] if best else None, "score": round(best_s, 1), "status": "perfect" if best_s > 90 else ("warning" if best_s >= 60 else "none")}
    return {"invoice_items": invoice_items}

@app.post("/api/storage/upload")
async def storage_upload(projectId: str = Form(...), file: UploadFile = File(...), stage: str = Form("spec")):
    original_filename = file.filename
    transliterated_name = transliterate(original_filename)
    secured_name = secure_filename(transliterated_name)
    dest_path = get_file_path(projectId, secured_name)
    with open(dest_path, "wb") as f:
        shutil.copyfileobj(file.file, f)
        
    estimated_cost = 0.0
    estimated_tokens = 0
    api_key, folder_id = get_yandex_keys()
    ext_text = ""
    is_spreadsheet = original_filename.lower().endswith((".xlsx", ".xls", ".csv"))
    summary_md = ""
    summary_fields = None
    
    if is_spreadsheet:
        try:
            if original_filename.lower().endswith(".csv"): df = pd.read_csv(dest_path, dtype=str)
            elif original_filename.lower().endswith(".xls"): df = pd.read_excel(dest_path, engine='xlrd', dtype=str)
            else: df = pd.read_excel(dest_path, engine='openpyxl', dtype=str)
            
            df = df.dropna(how='all').fillna("")
            df = sanitize_dataframe(df)
            unnamed_empty = [c for c in df.columns if str(c).startswith("Unnamed") and (df[c].astype(str).replace("", "nan").isnull().all() or (df[c].astype(str).str.strip() == "").all())]
            if unnamed_empty: df = df.drop(columns=unnamed_empty)
            
            if stage == "invoice":
                # TK v2.0: GRID METHOD for Invoices
                md_text = excel_to_grid_markdown(dest_path)
                # Save physical grid MD
                grid_p = get_file_path(projectId, secured_name, "_invoice.md")
                with open(grid_p, "w", encoding="utf-8") as f:
                    f.write(md_text)
            else:
                md_text = df.to_markdown(index=False, tablefmt="pipe", disable_numparse=True)

            ext_text = md_text
            estimated_tokens = int((len(ext_text) / 4) * 2.0)
            estimated_cost = 0

            # --- AUTO-EXTRACT SUMMARY (Pre-AI) - ONLY FOR SPECS ---
            if stage == "spec":
                try:
                    # We can do a quick pass to get basic stats
                    pre_items = convert_df_to_items(df)
                    sum_res = extract_specification_summary(df, pre_items, dest_path)
                    summary_md = sum_res["summary_md"]
                    debug_grid = sum_res["debug_grid"]
                    summary_fields = sum_res["fields"]
                    
                    if summary_md:
                        summary_p = get_file_path(projectId, secured_name, "_summary.md")
                        with open(summary_p, "w", encoding="utf-8") as f:
                            f.write(summary_md)
                    
                    # Save DEBUG grid
                    if debug_grid:
                        debug_p = get_file_path(projectId, secured_name, "_debug.md")
                        with open(debug_p, "w", encoding="utf-8") as f:
                            f.write(f"### DEBUG GRID FOR {secured_name}\n\n" + summary_md + "\n\n---\n\n" + "```\n" + debug_grid + "\n```")
                except Exception as e_sum:
                    print(f"Pre-summary error: {e_sum}")
                    summary_md = ""
                    summary_fields = None
            else:
                summary_fields = None
        except Exception as e:
            print(f"Spreadsheet processing error: {e}")
            summary_fields = None
    elif api_key and folder_id:
        try:
            if original_filename.lower().endswith(".pdf"):
                from parser_utils import detect_pdf_type, pdf_to_grid_markdown
                pdf_type = detect_pdf_type(dest_path)
                
                if pdf_type == "TEXT_PDF" and stage == "invoice":
                    md_text = pdf_to_grid_markdown(dest_path)
                    if md_text and not md_text.startswith("Error"):
                        ext_text = md_text
                        grid_p = get_file_path(projectId, secured_name, "_invoice.md")
                        with open(grid_p, "w", encoding="utf-8") as f:
                            f.write(md_text)
                        
                        tokens = await get_token_count(ext_text, "pro", api_key, folder_id)
                        estimated_tokens = tokens
                        estimated_cost = 0
                        
                if not ext_text:
                    import pdfplumber
                    with pdfplumber.open(dest_path) as pdf:
                        pages = len(pdf.pages)
                        if pages > 0:
                            # 1.22 (OCR Table) + ~0.28 (LLM margin) = 1.5 RUB per page
                            estimated_cost = round(pages * 1.5, 2)
                            # Average 5000 tokens per page for structured docs
                            estimated_tokens = pages * 5000
            elif original_filename.lower().endswith((".png", ".jpg", ".jpeg")):
                estimated_tokens = 5000
                estimated_cost = 1.5
        except Exception as e:
            print(f"Error estimating cost: {e}")
            
    # Determine initial file status
    final_status = "ok"
    if is_spreadsheet:
        final_status = "READY_MD_LOCAL"
    elif original_filename.lower().endswith(".pdf"):
        # We already called detect_pdf_type above
        from parser_utils import detect_pdf_type
        pdf_type = detect_pdf_type(dest_path)
        if pdf_type == "TEXT_PDF" and stage == "invoice":
            final_status = "READY_MD_LOCAL"
        else:
            final_status = "NEED_OCR"
    elif original_filename.lower().endswith((".png", ".jpg", ".jpeg")):
        final_status = "NEED_OCR"

    manifest = _load_manifest(projectId)
    existing = manifest.get(secured_name, {})
    manifest[secured_name] = {
        "originalName": original_filename,
        "status": final_status,
        "cost": existing.get("cost", 0) if isinstance(existing, dict) else 0,
        "tokens": existing.get("tokens", 0) if isinstance(existing, dict) else 0,
        "model": existing.get("model", "") if isinstance(existing, dict) else "",
        "method": existing.get("method", "") if isinstance(existing, dict) else "",
        "estimated_cost": estimated_cost,
        "estimated_tokens": estimated_tokens,
        "raw_markdown": ext_text,
        "summary_md": summary_md,
        "summary_fields": summary_fields,
        "type": stage
    }
    _save_manifest(manifest, projectId)
    
    append_history({
        "fileName": original_filename, "method": "", "model": "", "cost": 0, "tokens": 0, "status": "UPLOAD"
    }, projectId)
    
    # Calculate metadata for frontend routing
    pages_count = 1
    is_pdf = original_filename.lower().endswith(".pdf")
    is_image = original_filename.lower().endswith((".png", ".jpg", ".jpeg"))
    
    current_pdf_type = None
    if is_pdf:
        from parser_utils import detect_pdf_type
        current_pdf_type = detect_pdf_type(dest_path)
        import pdfplumber
        try:
            with pdfplumber.open(dest_path) as pdf:
                pages_count = len(pdf.pages)
        except: pass
    
    is_scan_val = (is_image or (is_pdf and current_pdf_type == "SCAN_PDF"))

    return {
        "status": "success", 
        "filename": secured_name, 
        "estimated_cost": estimated_cost, 
        "estimated_tokens": estimated_tokens, 
        "raw_markdown": ext_text,
        "summary_md": summary_md,
        "summary_fields": summary_fields,
        "file_status": final_status,
        "pages_count": pages_count,
        "is_scan": is_scan_val,
        "pdf_type": current_pdf_type
    }

@app.get("/api/storage/files")
async def storage_list(projectId: str):
    manifest = _load_manifest(projectId)
    files = []
    files_dir = get_files_dir(projectId)
    if os.path.exists(files_dir):
        for f in os.listdir(files_dir):
            if f.startswith('.') or f.endswith((".json", ".md")): continue
            entry = manifest.get(f, {})
            # Return all metadata from manifest
            files.append({
                "name": entry.get("originalName", f), 
                "disk_name": f, 
                "status": entry.get("status", "ok"), 
                "time": entry.get("time", ""),
                "size": entry.get("size", 0),
                "cost": entry.get("cost", 0),
                "tokens": entry.get("tokens", 0),
                "estimated_cost": entry.get("estimated_cost", 0),
                "estimated_tokens": entry.get("estimated_tokens", 0),
                "model": entry.get("model", ""),
                "method": "pdf_text" if entry.get("status") == "READY_MD_LOCAL" and not entry.get("method") else entry.get("method", ""),
                "summary_md": entry.get("summary_md", ""),
                "summary_fields": entry.get("summary_fields", None),
                "pages_count": entry.get("pages_count", 0),
                "is_scan": entry.get("is_scan", False),
                "pdf_type": entry.get("pdf_type", "UNKNOWN"),
                "type": entry.get("type", "spec"),
                "verifiedFields": entry.get("verifiedFields", {}),
                "supplierData": entry.get("supplierData", {})
            })
    return files

@app.patch("/api/storage/files/{name}")
async def storage_update_file(name: str, projectId: str, data: dict):
    m = _load_manifest(projectId)
    for k, v in m.items():
        if isinstance(v, dict) and v.get("originalName")==name:
            v.update({ki: vi for ki, vi in data.items() if ki in ["status", "cost", "tokens", "verifiedFields", "type", "supplierData"]})
            _save_manifest(m, projectId); return {"ok": True}
    raise HTTPException(status_code=404)

@app.delete("/api/storage/files/{name}")
async def storage_delete(name: str, projectId: str, nuclear: bool = False):
    m = _load_manifest(projectId)
    dk = None
    for k, v in m.items():
        if isinstance(v, dict) and v.get("originalName") == name:
            dk = k
            break
            
    if not dk:
        dk = secure_filename(name)
        
    f_dir = get_files_dir(projectId)
    
    if nuclear and os.path.exists(f_dir):
        # NUCLEAR: Delete ALL artifacts starting with the manifest key (prefix dk)
        # This catches .pdf, _raw_ocr.json, _invoice.md, etc.
        for f in os.listdir(f_dir):
            if f.startswith(dk):
                try:
                    os.remove(os.path.join(f_dir, f))
                except Exception as e:
                    print(f"Nuclear deletion error for {f}: {e}")
    else:
        # CONSERVATIVE: Only delete original and exact .json/.md pairs
        for ext in ["", ".json", ".md"]:
            p = get_file_path(projectId, dk, ext)
            if os.path.exists(p):
                os.remove(p)
                
    if dk in m:
        del m[dk]
        _save_manifest(m, projectId)
        
    return {"status": "success"}

@app.get("/api/storage/files/{name}")
async def storage_get(name: str, projectId: str):
    m = _load_manifest(projectId)
    dk = None
    for k, v in m.items():
        if isinstance(v, dict) and v.get("originalName")==name: dk = k; break
    p = get_file_path(projectId, dk or secure_filename(name))
    if os.path.exists(p): return FileResponse(p)
    raise HTTPException(status_code=404)

# --- Project Management ---

@app.get("/api/projects")
async def list_projects():
    projects_list = []
    if not os.path.exists(PROJECTS_DIR):
        return []
        
    for pid in os.listdir(PROJECTS_DIR):
        p_path = os.path.join(PROJECTS_DIR, pid)
        if not os.path.isdir(p_path): continue
            
        state_file = os.path.join(p_path, "project_state.json")
        if not os.path.exists(state_file): continue
            
        try:
            with open(state_file, "r", encoding="utf-8") as f:
                state = json.load(f)
            
            # 0. Versioning: Update to 1.1
            state["version"] = "1.1"
            
            # 1. Dynamic Files Count Sync (Using direct local path)
            f_dir = os.path.join(p_path, "files")
            if os.path.exists(f_dir):
                state["filesCount"] = len([f for f in os.listdir(f_dir) if os.path.isfile(os.path.join(f_dir, f)) and not f.lower().endswith(('.json', '.md'))])
            else:
                state["filesCount"] = 0
            
            # 2. Dynamic Last Modified Time
            mtimes = [os.path.getmtime(state_file)]
            for meta_file in ["manifest.json", "history.json"]:
                mp = os.path.join(p_path, meta_file)
                if os.path.exists(mp): mtimes.append(os.path.getmtime(mp))
            
            if os.path.exists(f_dir):
                for f in os.listdir(f_dir):
                    mtimes.append(os.path.getmtime(os.path.join(f_dir, f)))
            
            max_mtime = max(mtimes)
            dt = datetime.datetime.fromtimestamp(max_mtime)
            state["lastModified"] = dt.strftime("%H:%M | %d.%m.%y")
            
            projects_list.append(state)
        except Exception as e:
            print(f"Error syncing project {pid}: {e}")
                
    return projects_list

@app.post("/api/projects/save")
async def save_project(state: dict = Body(...)):
    pid = state.get("id")
    if not pid:
        raise HTTPException(status_code=400, detail="Missing project id")
        
    p_path = get_project_dir(pid)
    
    state["updatedAt"] = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    state["version"] = "1.1"
    if "createdAt" not in state:
        state["createdAt"] = state["updatedAt"]
        
    state_file = os.path.join(p_path, "project_state.json")
    try:
        with open(state_file, "w", encoding="utf-8") as f:
            json.dump(state, f, ensure_ascii=False, indent=4)
        return {"status": "success", "id": pid}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save project: {e}")

@app.post("/api/projects/create")
async def create_project(data: dict):
    # 1. Count current project folders for N+1
    n = 0
    if os.path.exists(PROJECTS_DIR):
        n = sum(1 for d in os.listdir(PROJECTS_DIR) if os.path.isdir(os.path.join(PROJECTS_DIR, d)))
    
    date_str = datetime.datetime.now().strftime("%d.%m.%Y")
    default_name = f"Новый проект №{n+1} [{date_str}]"
    
    # 2. Determine title and base slug
    name = data.get("name") or default_name
    category_id = data.get("categoryId", "all")
    
    base_slug = slugify_translit(name)
    if not base_slug:
        base_slug = "project"
        
    # 3. Ensure folder uniqueness (Collision check)
    folder_name = base_slug
    p_path = os.path.join(PROJECTS_DIR, folder_name)
    if os.path.exists(p_path):
        # Add a small random suffix if collision
        folder_name = f"{base_slug}-{str(uuid.uuid4())[:8]}"
        p_path = os.path.join(PROJECTS_DIR, folder_name)
    
    os.makedirs(p_path, exist_ok=True)
    os.makedirs(os.path.join(p_path, "files"), exist_ok=True)
    
    # 4. Generate stable UUID
    project_id = str(uuid.uuid4())
    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    state = {
        "id": project_id,
        "title": name,
        "categoryId": category_id,
        "filesCount": 0,
        "lastModified": "Сегодня", # For frontend display consistency
        "createdAt": now,
        "updatedAt": now,
        "progress": 0,
        "status": "active",
        "version": "1.1",
        "files": []
    }
    
    state_file = os.path.join(p_path, "project_state.json")
    with open(state_file, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=4)
        
    return state

@app.patch("/api/projects/{project_id}")
async def patch_project(project_id: str, data: dict):
    new_title = data.get("title")
    if not new_title:
        raise HTTPException(status_code=400, detail="Missing title")
        
    p_path = get_project_dir(project_id)
    state_file = os.path.join(p_path, "project_state.json")
    
    if not os.path.exists(state_file):
        raise HTTPException(status_code=404, detail="Project not found")
        
    try:
        with open(state_file, "r", encoding="utf-8") as f:
            state = json.load(f)
            
        state["title"] = new_title
        state["updatedAt"] = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        with open(state_file, "w", encoding="utf-8") as f:
            json.dump(state, f, ensure_ascii=False, indent=4)
            
        return {"status": "success", "title": new_title}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to rename project: {e}")

# Consolidated duplicate functionality
@app.post("/api/projects/duplicate")
async def duplicate_project(data: dict):
    # This was previously handled by simple save, now making it explicit
    # Logic remains similar to save but with new ID
    pass

@app.patch("/api/projects/{project_id}/rename")
async def rename_project_alias(project_id: str, data: dict):
    # Legacy alias for the frontend to transition smoothly
    return await patch_project(project_id, data)

@app.get("/api/projects/{project_id}/download")
async def download_project(project_id: str, background_tasks: BackgroundTasks):
    p_path = get_project_dir(project_id)
    if not os.path.exists(p_path):
        raise HTTPException(status_code=404, detail="Project not found")
        
    # Get project title for filename
    state_file = os.path.join(p_path, "project_state.json")
    project_title = "project"
    if os.path.exists(state_file):
        try:
            with open(state_file, "r", encoding="utf-8") as f:
                state = json.load(f)
                project_title = state.get("title", project_id)
        except: pass

    # Create zip
    zip_base = os.path.join(os.path.dirname(__file__), f"export_{project_id}")
    zip_path = shutil.make_archive(zip_base, 'zip', p_path)
    
    background_tasks.add_task(os.remove, zip_path)
    
    safe_filename = quote(f"{project_title}.zip")
    return FileResponse(
        zip_path, 
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{safe_filename}"}
    )

@app.post("/api/projects/duplicate")
async def duplicate_project(data: dict):
    old_id = data.get("id")
    old_path = get_project_dir(old_id)
    
    if not os.path.exists(old_path):
         raise HTTPException(status_code=404, detail="Project not found")
         
    # 1. Get old state to determine new title
    state_file_old = os.path.join(old_path, "project_state.json")
    old_title = "Project"
    if os.path.exists(state_file_old):
        with open(state_file_old, "r", encoding="utf-8") as f:
            old_title = json.load(f).get("title", "Project")
    
    new_title = f"{old_title} — Копия"
    
    # 2. Generate new safe folder ID (slug)
    base_slug = slugify_translit(new_title)
    new_folder_name = base_slug
    new_path = os.path.join(PROJECTS_DIR, new_folder_name)
    
    # Handle collisions for copies
    if os.path.exists(new_path):
        suffix = int(datetime.datetime.now().timestamp())
        new_folder_name = f"{base_slug}-{suffix}"
        new_path = os.path.join(PROJECTS_DIR, new_folder_name)
        
    shutil.copytree(old_path, new_path)
    
    # 3. Generate NEW stable UUID for the copy
    new_uuid = str(uuid.uuid4())
    
    # Update state in the copy
    state_file = os.path.join(new_path, "project_state.json")
    if os.path.exists(state_file):
        with open(state_file, "r", encoding="utf-8") as f:
            state = json.load(f)
        state["id"] = new_uuid
        state["title"] = new_title
        state["lastModified"] = "Сегодня"
        state["createdAt"] = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        state["updatedAt"] = state["createdAt"]
        with open(state_file, "w", encoding="utf-8") as f:
            json.dump(state, f, ensure_ascii=False, indent=4)
            
    return {"status": "success", "id": new_uuid}

@app.post("/api/projects/import")
async def import_project(file: UploadFile = File(...)):
    if not file.filename.endswith('.zip'):
        raise HTTPException(status_code=400, detail="Only ZIP files are supported")
        
    # 1. Create a unique folder for the imported project
    import_uuid = str(uuid.uuid4())
    temp_slug = f"import_{import_uuid[:8]}"
    temp_import_root = os.path.join(os.path.dirname(__file__), "temp_import")
    import_path = os.path.join(temp_import_root, temp_slug)
    os.makedirs(import_path, exist_ok=True)
    
    # 2. Save and Extract
    temp_zip = os.path.join(tempfile.gettempdir(), f"import_{import_uuid}.zip")
    try:
        with open(temp_zip, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        with zipfile.ZipFile(temp_zip, 'r') as zip_ref:
            zip_ref.extractall(import_path)
            
        # 3. Validate
        state_file = os.path.join(import_path, "project_state.json")
        if not os.path.exists(state_file):
            shutil.rmtree(import_path) # Cleanup
            raise HTTPException(status_code=400, detail="Invalid project archive: project_state.json missing")
            
        # 4. Read state and UPDATE identity/title if needed
        with open(state_file, "r", encoding="utf-8") as f:
            state = json.load(f)
            
        incoming_id = state.get("id")
        original_title = state.get("title", "Новый проект")
        new_title = original_title
        new_project_uuid = incoming_id

        # CHECK FOR UUID DUPLICATE
        uuid_exists = False
        try:
            get_project_dir(incoming_id)
            uuid_exists = True
        except: pass

        if uuid_exists or not incoming_id:
             new_project_uuid = str(uuid.uuid4())
             new_title = f"Импорт - {original_title}"
             state["id"] = new_project_uuid
             state["title"] = new_title
        
        # 5. Hierarchy Fix & Validation (Auto-Healing)
        # Standard DocOK project structure:
        # [ROOT]/project_state.json
        # [ROOT]/files/ (all PDFs, XLSX etc and .json results)
        
        final_files_dir = os.path.join(import_path, "files")
        os.makedirs(final_files_dir, exist_ok=True)
        
        # Move document files AND results (.json, .md) from root to /files/ folder if flat ZIP
        data_extensions = (".pdf", ".xlsx", ".xls", ".csv", ".png", ".jpg", ".jpeg", ".json", ".md")
        system_files = ("project_state.json", "manifest.json", "history.json")
        
        for f in os.listdir(import_path):
            if f in system_files: continue
            if f.lower().endswith(data_extensions):
                shutil.move(os.path.join(import_path, f), os.path.join(final_files_dir, f))
        
        # 6. Recalculate file count for the state
        actual_files = [f for f in os.listdir(final_files_dir) if os.path.isfile(os.path.join(final_files_dir, f))]
        state["filesCount"] = len(actual_files)
        
        # 7. Finalize folder name (Slugify title + "-import")
        base_slug = slugify_translit(original_title) # Use original for slug base
        final_folder_name = f"{base_slug}-import"
        final_path = os.path.join(PROJECTS_DIR, final_folder_name)
        
        # Handle folder collisions (e.g. if we import same project twice)
        if os.path.exists(final_path):
             extra_suffix = str(uuid.uuid4())[:4]
             final_folder_name = f"{base_slug}-import-{extra_suffix}"
             final_path = os.path.join(PROJECTS_DIR, final_folder_name)
             
        # Update dates
        now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        state["updatedAt"] = now
        if uuid_exists: state["createdAt"] = now # Mark as new if it's a "copy" via import
        
        # Move temp files to final destination
        os.rename(import_path, final_path)
        
        # Save updated state
        new_state_file = os.path.join(final_path, "project_state.json")
        with open(new_state_file, "w", encoding="utf-8") as f:
            json.dump(state, f, ensure_ascii=False, indent=4)
            
        return state # Return the full project object
        
    except Exception as e:
        if os.path.exists(import_path): shutil.rmtree(import_path)
        raise HTTPException(status_code=500, detail=f"Import failed: {e}")
    finally:
        if os.path.exists(temp_zip): os.remove(temp_zip)

@app.delete("/api/projects/delete/{project_id}")
async def delete_project_endpoint(project_id: str):
    p_path = get_project_dir(project_id)
    if os.path.exists(p_path):
        shutil.rmtree(p_path)
        return {"status": "success"}
    raise HTTPException(status_code=404, detail="Project not found")
