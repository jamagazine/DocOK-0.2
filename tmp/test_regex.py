import re

def validate_inn_logic(s: str) -> bool:
    if not s or not s.isdigit(): return False
    if len(s) not in [10, 12]: return False
    if len(s) == 10:
        coeffs = [2, 4, 10, 3, 5, 9, 4, 6, 8]
        s_sum = sum(int(s[i]) * coeffs[i] for i in range(9))
        return (s_sum % 11) % 10 == int(s[9])
    if len(s) == 12:
        coeffs1 = [7, 2, 4, 10, 3, 5, 9, 4, 6, 8]
        s_sum1 = sum(int(s[i]) * coeffs1[i] for i in range(10))
        n11 = (s_sum1 % 11) % 10
        coeffs2 = [3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8]
        s_sum2 = sum(int(s[i]) * coeffs2[i] for i in range(11))
        n12 = (s_sum2 % 11) % 10
        return n11 == int(s[10]) and n12 == int(s[11])
    return False

test_text = """
Счет на оплату № 123 от 01.01.2026
Поставщик: ООО "РОВЕН-Пермь", ИНН 7713360442, КПП 771301001, 
Адрес: 614022, г. Пермь, ул. Левченко, д. 1
Р/с 40702810449490001234 в ПАО СБЕРБАНК, БИК 042202603, К/с 30101810900000000603
Покупатель: ООО "ММК-Пермь", ИНН 5905271743, КПП 590501001
Телефон: 8 (342) 220-22-22, +7 900 123-45-67, (342) 211-34-04
"""

# INN
inn_candidates = re.findall(r'\b\d{10}\b|\b\d{12}\b', test_text)
inns = [inn for inn in inn_candidates if validate_inn_logic(inn)]
print(f"INNs: {inns}")

# KPP
kpp_candidates = re.findall(r'\b\d{9}\b', test_text)
kpps = []
for kpp in kpp_candidates:
    idx = test_text.find(kpp)
    window = test_text[max(0, idx-20):min(len(test_text), idx+30)].upper()
    if "КПП" in window or "ИНН" in window:
        if kpp not in kpps: kpps.append(kpp)
print(f"KPPs: {kpps}")

# BIK
biks = re.findall(r'\b04\d{7}\b', test_text)
print(f"BIKs: {biks}")

# Accounts
accounts = re.findall(r'\b(?:407|408|301)\d{17}\b', test_text)
print(f"Accounts: {accounts}")

# Phones
phone_pattern = re.compile(
    r'(?:\+7|8)[\s\-]?\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}|'
    r'\(\d{3}\)\s*\d{3}[\s\-]?\d{2}[\s\-]?\d{2}|'
    r'\b\d{3}[\s\-]?\d{2}[\s\-]?\d{2}\b'
)
phones = phone_pattern.findall(test_text)
print(f"Phones: {phones}")
