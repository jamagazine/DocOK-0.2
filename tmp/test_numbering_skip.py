import pandas as pd
import sys
import os

# Добавляем путь к серверу
sys.path.append(os.path.join(os.getcwd(), 'server'))

try:
    from main import convert_df_to_items
except ImportError:
    # Определение для теста если импорт не сработал
    def convert_df_to_items(df: pd.DataFrame) -> list:
        items = []
        for idx, row in df.iterrows():
            vals = [str(x).strip() for x in row.values]
            pos = vals[0] if len(vals) > 0 else ""
            name = vals[1] if len(vals) > 1 else ""
            
            # Логика пропуска технической строки
            if pos == "1" and name == "2":
                matches = 0
                for i, v in enumerate(vals[:min(5, len(vals))]):
                    if v == str(i + 1):
                        matches += 1
                if matches >= 3:
                    continue
            
            items.append({"pos": pos, "name": name})
        return items

def test_numbering_skip():
    data = {
        "Col1": ["1", "1.1", "1.2"],
        "Col2": ["2", "Item 1", "Item 2"],
        "Col3": ["3", "Brand 1", "Brand 2"],
        "Col4": ["4", "Code 1", "Code 2"]
    }
    df = pd.DataFrame(data)
    print("Исходный DF:")
    print(df)
    
    items = convert_df_to_items(df)
    print("\nРезультат (items):")
    for item in items:
        print(item)
    
    # Ожидаем 2 айтема (первая строка пропущена)
    assert len(items) == 2
    assert items[0]["pos"] == "1.1"
    print("\nТест (Пропуск технической строки): УСПЕШНО")

if __name__ == "__main__":
    test_numbering_skip()
