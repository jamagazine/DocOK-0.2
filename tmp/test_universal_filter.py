import sys
import os

# Имитируем структуру объекта item
def is_technical_row(it):
    p = str(it.get("pos", "")).strip()
    n = str(it.get("name", "")).strip()
    # Если в первой колонке "1", во второй "2" и в любой из следующих 3-4-5 колонок числа 3-4-5
    if p == "1" and n == "2":
        for key in ["brand", "code", "supplier", "unit", "quantity"]:
            val = str(it.get(key, "")).strip()
            if val in ["3", "4", "5", "6"]:
                return True
    return False

def test_filtering():
    # Тест 1: Техническая строка (должна быть отфильтрована)
    row1 = {"pos": "1", "name": "2", "brand": "3", "code": "4"}
    assert is_technical_row(row1) == True
    print("Тест 1 (Тех. строка 1-4): УСПЕШНО")

    # Тест 2: Техническая строка с пробелами
    row2 = {"pos": " 1 ", "name": " 2 ", "unit": " 6 "}
    assert is_technical_row(row2) == True
    print("Тест 2 (Тех. строка с пробелами): УСПЕШНО")

    # Тест 3: Обычный айтем с позицией 1 (не должен быть отфильтрован)
    row3 = {"pos": "1", "name": "Электромонтаж", "brand": "Система"}
    assert is_technical_row(row3) == False
    print("Тест 3 (Обычный заголовок): УСПЕШНО")

    # Тест 4: Айтем с реальной позицией 1.1 и именем 2.2 (не должен быть отфильтрован)
    row4 = {"pos": "1.1", "name": "2.2 Насос"}
    assert is_technical_row(row4) == False
    print("Тест 4 (Айтем с числами): УСПЕШНО")

if __name__ == "__main__":
    test_filtering()
