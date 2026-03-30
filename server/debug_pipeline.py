import pandas as pd
import sys
import re
import os

# Добавляем путь к серверу, чтобы импортировать main
sys.path.append(os.getcwd())
from main import sanitize_dataframe

def test_file():
    file_path = r'c:\Project\DocOK\DocOK_0.2.5\server\storage\Shablon_spetsifikatsii_GOST_21.110-2013.xls'
    if not os.path.exists(file_path):
        print(f"ERROR: File {file_path} not found")
        return

    print(f"Reading file: {file_path}")
    df = pd.read_excel(file_path, engine='xlrd', dtype=str)
    df = df.dropna(how='all')
    df = df.fillna("")
    
    # Запускаем штатный санитайзер
    df_clean = sanitize_dataframe(df)
    
    # Ищем строку с группой
    group_row = df_clean[df_clean.iloc[:, 1].str.contains("Электромонтажные", na=False)]
    
    print("\n--- RESULTS ---")
    if not group_row.empty:
        # Выводим первую найденную строку целиком
        row_data = group_row.iloc[0].to_dict()
        print(f"Raw Row Data: {row_data}")
        
        # Проверяем колонку Pos (обычно это первая колонка)
        pos_val = group_row.iloc[0, 0]
        name_val = group_row.iloc[0, 1]
        print(f"Detected POS: {repr(pos_val)}")
        print(f"Detected NAME: {repr(name_val)}")
    else:
        print("Group header NOT FOUND in processed data.")
        # Выведем первые 10 строк для анализа
        print("\nFirst 10 rows of processed data:")
        print(df_clean.head(10).to_string())

if __name__ == "__main__":
    test_file()
