import os
import sys
import pandas as pd
import json

# Add server directory to path
sys.path.append(r'c:\Project\DocOK\DocOK_0.2.5\server')

from parser_utils import extract_specification_summary, convert_df_to_items, sanitize_dataframe

def test_parsing():
    file_path = r'c:\Project\DocOK\DocOK_0.2.5\data\projects\novyj-proekt-1-02-04-2026\files\1058-25-OV_S_1.xls'
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        return

    print(f"Testing on: {file_path}")
    
    try:
        # Load the file as pandas df for first pass
        df = pd.read_excel(file_path, engine='xlrd', dtype=str).fillna("")
        df = sanitize_dataframe(df)
        
        # Convert to items
        items = convert_df_to_items(df)
        
        # Extract summary
        res = extract_specification_summary(df, items, file_path)
        
        print("\n=== SUMMARY MD ===")
        print(res["summary_md"])
        
        print("\n=== DEBUG GRID (FIRST 30 LINES) ===")
        debug_lines = res["debug_grid"].split("\n")
        for line in debug_lines[:30]:
            print(line)
            
        print("\n=== DEBUG GRID (LAST 30 LINES) ===")
        for line in debug_lines[-30:]:
            print(line)
            
        # Save results to a temp file for me to inspect
        with open("c:/Project/DocOK/DocOK_0.2.5/tmp/parsed_res.json", "w", encoding="utf-8") as f:
            json.dump(res, f, ensure_ascii=False, indent=2)
            
    except Exception as e:
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    # Ensure tmp exists
    os.makedirs("c:/Project/DocOK/DocOK_0.2.5/tmp", exist_ok=True)
    test_parsing()
