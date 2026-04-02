import os
import json
import pandas as pd
import sys
import re

# Add current dir and server to path
sys.path.append(os.getcwd())
sys.path.append(os.path.join(os.getcwd(), 'server'))

from server.parser_utils import extract_specification_summary, convert_df_to_items

project_id = 'novyj-proekt-1-02-04-2026'
manifest_path = f'data/projects/{project_id}/manifest.json'

if not os.path.exists(manifest_path):
    print(f"Manifest not found at {manifest_path}")
    sys.exit(1)

with open(manifest_path, 'r', encoding='utf-8') as f:
    manifest = json.load(f)

for disk_name, entry in manifest.items():
    if disk_name.lower().endswith(('.xls', '.xlsx', '.csv')):
        file_path = f'data/projects/{project_id}/files/{disk_name}'
        if os.path.exists(file_path):
            print(f"Processing {disk_name}...")
            try:
                if disk_name.lower().endswith(".csv"): df = pd.read_csv(file_path, dtype=str)
                elif disk_name.lower().endswith(".xls"): df = pd.read_excel(file_path, engine='xlrd', dtype=str)
                else: df = pd.read_excel(file_path, engine='openpyxl', dtype=str)
                
                df = df.dropna(how='all').fillna("")
                items = convert_df_to_items(df)
                summary = extract_specification_summary(df, items)
                entry['summary_md'] = summary
                print(f"Summary for {disk_name} updated.")
            except Exception as e:
                print(f"Error processing {disk_name}: {e}")

with open(manifest_path, 'w', encoding='utf-8') as f:
    json.dump(manifest, f, indent=4, ensure_ascii=False)

print("Done.")
