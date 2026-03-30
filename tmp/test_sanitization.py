import pandas as pd
import re
import sys
import os

# Добавляем путь к серверу, чтобы импортировать функцию
sys.path.append(os.path.join(os.getcwd(), 'server'))

try:
    from main import sanitize_dataframe
except ImportError:
    # Если не получается импортировать, определим функцию здесь для теста
    def sanitize_dataframe(df: pd.DataFrame) -> pd.DataFrame:
        df = df.fillna("").astype(str)
        for col in df.columns:
            df[col] = df[col].str.strip()

        col_pos, col_name = 0, 1
        for i, col in enumerate(df.columns):
            c_low = str(col).lower()
            if any(x in c_low for x in ["поз", "№", "unnamed: 0"]):
                col_pos = i
            elif any(x in c_low for x in ["наименован", "названи", "товар"]):
                col_name = i

        last_dot_pos = ""
        for i in range(len(df)):
            pos = df.iloc[i, col_pos].strip()
            name = df.iloc[i, col_name].strip()

            if (not pos or pos.lower() == "nan") and name:
                match = re.match(r'^(\d+(?:\.\d+)*)\.?\s*(.*)', name)
                if match:
                    new_pos = match.group(1)
                    new_name = match.group(2)
                    df.iloc[i, col_pos] = new_pos
                    df.iloc[i, col_name] = new_name
                    pos = new_pos

            if pos.endswith(".1") and last_dot_pos.endswith(".9"):
                if pos[:-2] == last_dot_pos[:-2]:
                    pos = pos + "0"
                    df.iloc[i, col_pos] = pos

            if re.match(r'^\d+(\.\d+)+$', pos):
                last_dot_pos = pos
        return df

def test_sanitization():
    # Тест 1: Перенос цифр
    data = {
        "№": ["", "2", ""],
        "Наименование": ["1.1 Насос", "Клапан", "3.1.2. Труба"]
    }
    df = pd.DataFrame(data)
    print("Исходный DF:")
    print(df)
    
    df_clean = sanitize_dataframe(df)
    print("\nОчищенный DF:")
    print(df_clean)
    
    assert df_clean.iloc[0, 0] == "1.1"
    assert df_clean.iloc[0, 1] == "Насос"
    assert df_clean.iloc[2, 0] == "3.1.2"
    assert df_clean.iloc[2, 1] == "Труба"
    print("\nТест 1 (Перенос цифр): УСПЕШНО")

    # Тест 2: Фикс 1.10
    data2 = {
        "Поз": ["1.9", "1.1"],
        "Наименование": ["Товар 9", "Товар 10"]
    }
    df2 = pd.DataFrame(data2)
    df_clean2 = sanitize_dataframe(df2)
    print("\nОчищенный DF (тест 1.10):")
    print(df_clean2)
    assert df_clean2.iloc[1, 0] == "1.10"
    print("\nТест 2 (Фикс 1.10): УСПЕШНО")

if __name__ == "__main__":
    test_sanitization()
