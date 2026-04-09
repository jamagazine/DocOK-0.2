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

def validate_bank_account(account: str, bic: str, is_corr: bool = False) -> bool:
    """Проверка контрольной цифры р/с или к/с по алгоритму ЦБ РФ."""
    if not account or not bic: return False
    account = re.sub(r'\D', '', str(account))
    bic = re.sub(r'\D', '', str(bic))
    
    if len(account) != 20 or len(bic) != 9:
        return False
    
    # ПРАВИЛО ЦБ:
    # Для к/с (корреспондентский): берем '0' + 5-ю и 6-ю цифры БИК
    # Для р/с (расчетный): берем последние три цифры БИК
    if is_corr:
        prefix = '0' + bic[4:6]
    else:
        prefix = bic[6:9]
    
    # Формируем 23-значное число (Префикс + Счет)
    full_str = prefix + account
    weights = [7, 1, 3, 7, 1, 3, 7, 1, 3, 7, 1, 3, 7, 1, 3, 7, 1, 3, 7, 1, 3, 7, 1]
    
    checksum = 0
    for i in range(23):
        checksum += int(full_str[i]) * weights[i]
    
    return (checksum % 10) == 0

def validate_bik(bik: str) -> bool:
    """Проверка формата БИК (9 цифр, начинается на 04)."""
    bik = re.sub(r'\D', '', str(bik))
    return len(bik) == 9 and bik.startswith('04')

def validate_inn_requisite(value: str, document_type: str = "Счет на оплату") -> dict:
    """Универсальная проверка ИНН с прощением для КП."""
    is_empty = value in ["---", None, "", "null"]
    is_kp = "коммерческое" in str(document_type).lower()

    if is_empty:
        if is_kp:
            return {"value": "---", "confidence": 1.0, "isVerified": False, "note": "Не обязательно для КП"}
        else:
            return {"value": "---", "confidence": 0.01, "isVerified": False, "note": "Обязательное поле ИНН отсутствует"}

    val_str = str(value)
    if not validate_inn(val_str):
        return {"value": val_str, "confidence": 0.01, "isVerified": False, "note": "Ошибка контрольной суммы ИНН!"}
    
    return {"value": val_str, "confidence": 1.0, "isVerified": False}

def validate_kpp_requisite(value: str, inn: str, document_type: str = "Счет на оплату") -> dict:
    """Универсальная проверка КПП с прощением для КП."""
    is_empty = value in ["---", None, "", "null"]
    is_kp = "коммерческое" in str(document_type).lower()

    if is_empty:
        if is_kp:
            return {"value": "---", "confidence": 1.0, "isVerified": False, "note": "Не обязательно для КП"}
        else:
            # Для счета КПП может быть пустым только если ИНН 12 знаков (ИП)
            if validate_kpp(value, inn):
                 return {"value": "---", "confidence": 1.0, "isVerified": False}
            return {"value": "---", "confidence": 0.01, "isVerified": False, "note": "Неверный формат КПП (должно быть 9 цифр)"}

    val_str = str(value)
    if not validate_kpp(val_str, inn):
        return {"value": val_str, "confidence": 0.01, "isVerified": False, "note": "Неверный формат КПП (должно быть 9 цифр)"}
    
    return {"value": val_str, "confidence": 1.0, "isVerified": False}

def validate_bank_requisites(value: str, field_name: str, document_type: str = "Счет на оплату", is_corr: bool = False, bik: str = None) -> dict:
    """
    Универсальная проверка для БИК и Счетов, которая прощает пустоту для КП.
    """
    is_empty = value in ["---", None, "", "null"]
    is_kp = "коммерческое" in str(document_type).lower()

    if is_empty:
        if is_kp:
            # Для КП отсутствие банка - это норма. Ошибки нет.
            return {"value": "---", "confidence": 1.0, "isVerified": False, "note": "Не требуется для КП"}
        else:
            # Для Счета отсутствие банка - это критическая ошибка.
            return {"value": "---", "confidence": 0.01, "isVerified": False, "note": f"Обязательное поле {field_name} отсутствует"}

    # Если данные есть, проверяем их стандартно
    val_str = str(value)
    
    if field_name == "bank_bik":
        if not validate_bik(val_str):
            return {"value": val_str, "confidence": 0.01, "isVerified": False, "note": "Неверный формат БИК (должно быть 9 цифр, начало 04)"}
    elif field_name in ["bank_account", "corr_account"]:
        if bik and not validate_bank_account(val_str, bik, is_corr=is_corr):
            return {"value": val_str, "confidence": 0.01, "isVerified": False, "note": f"Ошибка контрольного ключа {'к/с' if is_corr else 'р/с'} (не совпадает с БИК)"}

    return {"value": val_str, "confidence": 1.0, "isVerified": False}
