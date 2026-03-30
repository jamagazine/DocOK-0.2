import sys
import os

# Имитируем структуру объекта item и функцию фильтрации
def is_technical_row(it):
    def as_num(s):
        s = str(s).strip().replace(',', '.')
        if s.endswith('.0'): s = s[:-2]
        return s

    p = as_num(it.get("pos", ""))
    n = as_num(it.get("name", ""))
    # Если в первой колонке "1", во второй "2" — это почти наверняка техническая строка
    if p == "1" and n == "2":
        # Для надежности проверим еще одну колонку (3 или 4)
        b = as_num(it.get("brand", ""))
        c = as_num(it.get("code", ""))
        if b == "3" or c == "4" or c == "3" or b == "4":
            return True
    return False

def test_aggressive_filtering():
    # Тест 1: Техническая строка с дробными нулями (pandas style)
    row1 = {"pos": "1.0", "name": "2.0", "brand": "3.0", "code": "4.0"}
    assert is_technical_row(row1) == True
    print("Тест 1 (1.0 - 4.0): УСПЕШНО")

    # Тест 2: Техническая строка с запятыми
    row2 = {"pos": "1,0", "name": "2,0", "brand": "3,0"}
    assert is_technical_row(row2) == True
    print("Тест 2 (1,0 - 3,0): УСПЕШНО")

    # Тест 3: Смешанный формат
    row3 = {"pos": "1", "name": "2.0", "code": "3.0"}
    assert is_technical_row(row3) == True
    print("Тест 3 (Смешанный): УСПЕШНО")

    # Тест 4: Реальный айтем (не должен быть отфильтрован)
    row4 = {"pos": "1", "name": "2.0 Кабель", "brand": "3.0"}
    assert is_technical_row(row4) == False
    print("Тест 4 (Реальный айтем): УСПЕШНО")

if __name__ == "__main__":
    test_aggressive_filtering()
