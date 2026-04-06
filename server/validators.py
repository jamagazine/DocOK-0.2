import re

def validate_inn(inn: str) -> bool:
    """Проверка ИНН по контрольным числам (10 знаков для ЮЛ, 12 для ИП)."""
    if not inn: return False
    inn = re.sub(r'\D', '', str(inn))
    
    if len(inn) == 10:
        # Коэффициенты для 10-значного ИНН
        weights = [2, 4, 10, 3, 5, 9, 4, 6, 8]
        check_sum = sum(int(inn[i]) * weights[i] for i in range(9))
        control_digit = (check_sum % 11) % 10
        return control_digit == int(inn[9])
    
    elif len(inn) == 12:
        # Коэффициенты для 12-значного ИНН (две контрольные цифры)
        weights1 = [7, 2, 4, 10, 3, 5, 9, 4, 6, 8]
        check_sum1 = sum(int(inn[i]) * weights1[i] for i in range(10))
        control_digit1 = (check_sum1 % 11) % 10
        
        weights2 = [3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8]
        check_sum2 = sum(int(inn[i]) * weights2[i] for i in range(11))
        control_digit2 = (check_sum2 % 11) % 10
        
        return control_digit1 == int(inn[10]) and control_digit2 == int(inn[11])
    
    return False

def validate_kpp(kpp: str, inn: str = "") -> bool:
    """Проверка формата КПП (9 цифр). Если ИНН 12 знаков (ИП), КПП может быть пустым."""
    if not kpp or kpp == "---":
        # Если ИНН 12 знаков, то отсутствие КПП - это норма (True)
        return len(re.sub(r'\D', '', str(inn))) == 12
    
    kpp = re.sub(r'\D', '', str(kpp))
    return len(kpp) == 9
