import os
import sys
import json
import traceback
import pandas as pd

# Add server directory to path to import parser_utils
sys.path.append(r'c:\Project\DocOK\DocOK_0.2.5\server')
from parser_utils import extract_specification_summary

def test_actual_parsing():
    file_path = r'c:\Project\DocOK\DocOK_0.2.5\data\projects\novyj-proekt-1-03-04-2026\files\1058-25-OV_S_1.xls'
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        return

    print(f"Testing actual parsing logic on: {file_path}")
    
    try:
        # Mock inputs
        df = pd.DataFrame()
        parsed_rows = []
        
        # Call the actual extraction function
        result = extract_specification_summary(df, parsed_rows, file_path=file_path)
        
        # Save to json for inspection
        output_file = r'c:\Project\DocOK\DocOK_0.2.5\tmp\parsed_res.json'
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
        
        print(f"Success! Output saved to {output_file}")
        print(f"Notes extracted: {result['fields']['notes']}")
        
    except Exception as e:
        traceback.print_exc()

if __name__ == "__main__":
    test_actual_parsing()
