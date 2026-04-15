import asyncio
import logging
import re

logger = logging.getLogger(__name__)


def clean_and_group_markdown_table_excel(md_text: str) -> str:
    """
    Ultra-Squeezer 4.0 (Semicolon Edition) - EXCEL VERSION:
    Converts sparse Markdown into ultra-dense semicolon-separated text.

    This is a dedicated version for Excel files to ensure isolation from PDF processing.
    Any changes here will NOT affect PDF file processing.
    """
    lines = [line.strip() for line in md_text.split("\n") if line.strip()]

    # 1. Парсим Markdown в двумерный массив (grid)
    grid = []
    for line in lines:
        if line.startswith("|") and line.endswith("|"):
            cells = [c.strip() for c in line.split("|")[1:-1]]
            grid.append(cells)

    if not grid:
        return ""

    # 2. Весовой поиск заголовка таблицы
    header_idx = -1
    max_score = 0
    for i, row in enumerate(grid[:200]):
        row_str = " ".join(row).lower()
        score = 0
        # Используем более гибкий поиск без \b для символов типа №
        if re.search(r"(№|n|поз)", row_str):
            score += 1
        if re.search(r"(наименование|товар|услуг|работ|номенклатура)", row_str):
            score += 2
        if re.search(r"(кол-во|количество)", row_str):
            score += 1
        if re.search(r"(цена|стоимость)", row_str):
            score += 1
        if re.search(r"(сумма|всего)", row_str):
            score += 1
        if re.search(r"(код|артикул)", row_str):
            score += 1

        if score >= 3 and score > max_score:
            max_score = score
            header_idx = i

    if header_idx == -1:
        return ""

    # 3. Поиск подвала (Footer) с Peak-ahead на 3 строки + проверка повторного заголовка
    footer_idx = len(grid)
    stop_words = [
        "итого",
        "всего к оплате",
        "всего наименований",
        "внимание!",
        "условия поставки",
        "оплата данного счета",
        "подготовлено:",
        "руководитель",
        "м.п.",
    ]

    for i in range(header_idx + 2, len(grid)):
        row_str = " ".join(grid[i]).lower()
        if any(stop in row_str for stop in stop_words):
            # Smart Stop-Valve (Peak-ahead)
            is_fake_stop = False

            # Проверка 1: Ищем якоря в следующих 3 строках
            for j in range(1, 4):
                if i + j < len(grid):
                    next_row = grid[i + j]
                    val_0 = next_row[0].strip() if len(next_row) > 0 else ""
                    val_1 = next_row[1].strip() if len(next_row) > 1 else ""

                    if (
                        val_0 and len(val_0) < 15 and val_0.lower() not in stop_words
                    ) or (
                        val_1 and len(val_1) < 15 and val_1.lower() not in stop_words
                    ):
                        if re.search(
                            r"\d", val_0 + val_1
                        ):  # Защита: должна быть хоть одна цифра
                            is_fake_stop = True
                            break

            # Проверка 2: Ищем повторный заголовок таблицы в следующих 50 строках
            if not is_fake_stop:
                for j in range(1, min(51, len(grid) - i)):
                    next_row_str = " ".join(grid[i + j]).lower()
                    score = 0
                    if re.search(r"\b(№|n|поз)\b", next_row_str):
                        score += 1
                    if re.search(r"\b(наименование|товар|услуг|работ)\b", next_row_str):
                        score += 2
                    if re.search(r"\b(кол-во|количество)\b", next_row_str):
                        score += 1
                    if re.search(r"\b(цена|стоимость)\b", next_row_str):
                        score += 1
                    if re.search(r"\b(артикул|код)\b", next_row_str):
                        score += 1

                    if (
                        score >= 3
                    ):  # Найден повторный заголовок - это промежуточный итог
                        is_fake_stop = True
                        break

            if not is_fake_stop:
                footer_idx = i
                break

    table_body = grid[header_idx:footer_idx]
    if len(table_body) < 3:
        return ""

    # 4. Column Pruning (Удаление пустых колонок)
    num_cols = len(table_body[0])
    cols_to_keep = []

    for col_idx in range(num_cols):
        has_data = False
        for row in table_body[2:]:
            if col_idx < len(row) and re.sub(r"[^a-zA-Zа-яА-Я0-9]", "", row[col_idx]):
                has_data = True
                break

        header_val = table_body[0][col_idx].lower()
        if has_data or (header_val and "unnamed" not in header_val):
            cols_to_keep.append(col_idx)

    pruned_body = []
    for row in table_body:
        pruned_row = [row[i] for i in cols_to_keep if i < len(row)]
        pruned_body.append(pruned_row)

    # 5. Определение функции для проверки заголовков групп (нужна ДО обработки строк)
    def is_group_header_row_early(row: list) -> tuple:
        """Проверка заголовка группы ДО склеивания строк"""
        if not row:
            return False, ""

        # Случай 1: Вся строка в одной ячейке
        if len(row) == 1:
            full_text = row[0].strip()
            match = re.match(r"^([А-ЯA-ZЁ]{1,3}\d{1,2})\s", full_text, re.IGNORECASE)
            if match:
                tag = match.group(1).upper()
                rest = full_text[len(match.group(0)) :]
                if re.search(r"\d+[,\.]\d+", rest):
                    return True, tag
            return False, ""

        # Случай 2: Несколько ячеек
        if len(row) >= 2:
            first_cell = row[0].strip()
            match = re.match(r"^([А-ЯA-ZЁ]{1,3}\d{1,2})$", first_cell, re.IGNORECASE)
            if match and not first_cell.isdigit():
                has_numbers = any(
                    re.search(r"\d+[,\.]\d+", str(cell)) for cell in row[1:]
                )
                if has_numbers:
                    return True, match.group(1).upper()

        return False, ""

    # 5.5. Склейка строк (The Squeezer) с отслеживанием тегов групп
    valid_rows = []
    current_row_cells = []
    header = pruned_body[0]
    stop_words = {"итого", "всего", "total", "sum"}
    current_group_tag = ""  # Текущий тег группы
    row_tags = []  # Теги для каждой строки в valid_rows

    for row in pruned_body[1:]:
        if not row or set("".join(row).replace("-", "").replace(" ", "")) == set():
            continue

        # Проверяем, является ли строка заголовком группы
        is_header, group_tag = is_group_header_row_early(row)
        if is_header:
            # Завершаем текущий товар если есть (с ПРЕДЫДУЩИМ тегом)
            if current_row_cells:
                valid_rows.append(current_row_cells)
                row_tags.append(current_group_tag)  # Сохраняем старый тег
                current_row_cells = []
            # Обновляем тег группы для следующих товаров
            current_group_tag = group_tag
            continue

        val_col_0 = row[0].strip() if len(row) > 0 else ""
        val_col_1 = row[1].strip() if len(row) > 1 else ""

        # Проверяем, есть ли в последних колонках числовые значения (цены)
        has_prices = False
        if len(row) >= 2:
            last_two = " ".join(row[-2:])
            # Ищем числа с запятыми/точками (цены)
            if re.search(r"\d+[,\.]\d+", last_two):
                has_prices = True

        is_anchor = False
        # Проверка 1: Строка начинается с номера позиции (1-3 цифры в начале)
        # Изменено: убрали требование обязательного пробела после номера
        if val_col_0 and re.match(r"^\d{1,3}(\s|$)", val_col_0):
            is_anchor = True
        # Проверка 2: Короткое значение в первой или второй колонке (старая логика)
        elif val_col_0 and len(val_col_0) < 15 and val_col_0.lower() not in stop_words:
            is_anchor = True
        elif val_col_1 and len(val_col_1) < 15 and val_col_1.lower() not in stop_words:
            is_anchor = True

        has_useful_data = bool(re.search(r"[a-zA-Zа-яА-Я0-9]", " ".join(row)))

        # КРИТИЧЕСКАЯ ЛОГИКА: Якорь всегда имеет приоритет
        # Если строка начинается с номера позиции - это НОВАЯ позиция, даже если есть цены
        if is_anchor:
            # Сохраняем предыдущую позицию, если была
            if current_row_cells:
                valid_rows.append(current_row_cells)
                row_tags.append(current_group_tag)
            # Начинаем новую позицию
            current_row_cells = row
        # Если текущая строка имеет цены (но НЕ якорь), это завершение товара
        elif has_prices and current_row_cells:
            # Склеиваем текущую строку с накопленной
            for idx, cell in enumerate(row):
                if cell:
                    if idx < len(current_row_cells):
                        current_row_cells[idx] = (
                            f"{current_row_cells[idx]} {cell}".strip()
                        )
                    else:
                        current_row_cells.append(cell)
            # Сохраняем завершенный товар с тегом
            valid_rows.append(current_row_cells)
            row_tags.append(current_group_tag)
            current_row_cells = []
            if current_row_cells:
                valid_rows.append(current_row_cells)
                row_tags.append(current_group_tag)
            current_row_cells = row
        else:
            if current_row_cells and has_useful_data:
                for idx, cell in enumerate(row):
                    if cell:
                        if idx < len(current_row_cells):
                            current_row_cells[idx] = (
                                f"{current_row_cells[idx]} {cell}".strip()
                            )
                        else:
                            current_row_cells.append(cell)
            elif not current_row_cells and has_useful_data:
                current_row_cells = row

    if current_row_cells:
        valid_rows.append(current_row_cells)
        row_tags.append(current_group_tag)

    # 5.6. Присвоение тегов из row_tags
    # Теги уже определены на этапе склеивания строк
    final_rows = []
    for i, row in enumerate(valid_rows):
        tag = row_tags[i] if i < len(row_tags) else ""
        row_with_tag = row + [tag]
        final_rows.append(row_with_tag)

    # Обновляем valid_rows и header
    valid_rows = final_rows
    if header and final_rows:
        # Добавляем колонку "Тег" в заголовок
        header = header + ["Тег"]

    # 6. Сборка финального текста (DENSE SEMICOLON FORMAT)
    if not valid_rows:
        return ""

    def clean_cell(c):
        # Удаляем лишние пробелы внутри ячейки
        text = re.sub(r"\s+", " ", str(c)).strip()

        # Нормализация чисел: удаляем пробелы из чисел с разделителями тысяч
        # Примеры: "15 540,00" → "15540,00", "1 234 567.89" → "1234567.89"
        # Паттерн: цифра + (пробел + цифры)+ + опционально (запятая/точка + цифры)
        text = re.sub(r"(\d)\s+(?=\d)", r"\1", text)

        return text

    result_lines = []
    header_clean = [clean_cell(h) for h in header]
    result_lines.append("; ".join(header_clean))

    for row in valid_rows:
        padded_row = row + [""] * (len(header) - len(row))

        # Обрабатываем все ячейки, но последнюю (тег) не трогаем через clean_cell
        row_clean = []
        for i, cell in enumerate(padded_row):
            if i == len(padded_row) - 1:  # Последняя ячейка - это тег
                row_clean.append(str(cell).strip())
            else:
                row_clean.append(clean_cell(cell))

        # НЕ удаляем последнюю колонку (Тег), даже если она пустая
        result_lines.append("; ".join(row_clean))

    return "\n".join(result_lines)


def clean_and_group_markdown_table(md_text: str) -> str:
    """
    Ultra-Squeezer 4.0 (Semicolon Edition) - ORIGINAL VERSION (for PDF):
    Converts sparse Markdown into ultra-dense semicolon-separated text.

    This is the original version used for PDF files.
    For Excel files, use clean_and_group_markdown_table_excel() instead.
    """
    lines = [line.strip() for line in md_text.split("\n") if line.strip()]

    # 1. Парсим Markdown в двумерный массив (grid)
    grid = []
    for line in lines:
        if line.startswith("|") and line.endswith("|"):
            cells = [c.strip() for c in line.split("|")[1:-1]]
            grid.append(cells)

    if not grid:
        return ""

    # 2. Весовой поиск заголовка таблицы
    header_idx = -1
    max_score = 0
    for i, row in enumerate(grid[:200]):
        row_str = " ".join(row).lower()
        score = 0
        # Используем более гибкий поиск без \b для символов типа №
        if re.search(r"(№|n|поз)", row_str):
            score += 1
        if re.search(r"(наименование|товар|услуг|работ|номенклатура)", row_str):
            score += 2
        if re.search(r"(кол-во|количество)", row_str):
            score += 1
        if re.search(r"(цена|стоимость)", row_str):
            score += 1
        if re.search(r"(сумма|всего)", row_str):
            score += 1
        if re.search(r"(код|артикул)", row_str):
            score += 1

        if score >= 3 and score > max_score:
            max_score = score
            header_idx = i

    if header_idx == -1:
        return ""

    # 3. Поиск подвала (Footer) с Peak-ahead на 3 строки + проверка повторного заголовка
    footer_idx = len(grid)
    stop_words = [
        "итого",
        "всего к оплате",
        "всего наименований",
        "внимание!",
        "условия поставки",
        "оплата данного счета",
        "подготовлено:",
        "руководитель",
        "м.п.",
    ]

    for i in range(header_idx + 2, len(grid)):
        row_str = " ".join(grid[i]).lower()
        if any(stop in row_str for stop in stop_words):
            # Smart Stop-Valve (Peak-ahead)
            is_fake_stop = False

            # Проверка 1: Ищем якоря в следующих 3 строках
            for j in range(1, 4):
                if i + j < len(grid):
                    next_row = grid[i + j]
                    val_0 = next_row[0].strip() if len(next_row) > 0 else ""
                    val_1 = next_row[1].strip() if len(next_row) > 1 else ""

                    if (
                        val_0 and len(val_0) < 15 and val_0.lower() not in stop_words
                    ) or (
                        val_1 and len(val_1) < 15 and val_1.lower() not in stop_words
                    ):
                        if re.search(
                            r"\d", val_0 + val_1
                        ):  # Защита: должна быть хоть одна цифра
                            is_fake_stop = True
                            break

            # Проверка 2: Ищем повторный заголовок таблицы в следующих 50 строках
            if not is_fake_stop:
                for j in range(1, min(51, len(grid) - i)):
                    next_row_str = " ".join(grid[i + j]).lower()
                    score = 0
                    if re.search(r"\b(№|n|поз)\b", next_row_str):
                        score += 1
                    if re.search(r"\b(наименование|товар|услуг|работ)\b", next_row_str):
                        score += 2
                    if re.search(r"\b(кол-во|количество)\b", next_row_str):
                        score += 1
                    if re.search(r"\b(цена|стоимость)\b", next_row_str):
                        score += 1
                    if re.search(r"\b(артикул|код)\b", next_row_str):
                        score += 1

                    if (
                        score >= 3
                    ):  # Найден повторный заголовок - это промежуточный итог
                        is_fake_stop = True
                        break

            if not is_fake_stop:
                footer_idx = i
                break

    table_body = grid[header_idx:footer_idx]
    if len(table_body) < 3:
        return ""

    # 4. Column Pruning (Удаление пустых колонок)
    num_cols = len(table_body[0])
    cols_to_keep = []

    for col_idx in range(num_cols):
        has_data = False
        for row in table_body[2:]:
            if col_idx < len(row) and re.sub(r"[^a-zA-Zа-яА-Я0-9]", "", row[col_idx]):
                has_data = True
                break

        header_val = table_body[0][col_idx].lower()
        if has_data or (header_val and "unnamed" not in header_val):
            cols_to_keep.append(col_idx)

    pruned_body = []
    for row in table_body:
        pruned_row = [row[i] for i in cols_to_keep if i < len(row)]
        pruned_body.append(pruned_row)

    # 5. Определение функции для проверки заголовков групп (нужна ДО обработки строк)
    def is_group_header_row_early(row: list) -> tuple:
        """Проверка заголовка группы ДО склеивания строк"""
        if not row:
            return False, ""

        # Случай 1: Вся строка в одной ячейке
        if len(row) == 1:
            full_text = row[0].strip()
            match = re.match(r"^([А-ЯA-ZЁ]{1,3}\d{1,2})\s", full_text, re.IGNORECASE)
            if match:
                tag = match.group(1).upper()
                rest = full_text[len(match.group(0)) :]
                if re.search(r"\d+[,\.]\d+", rest):
                    return True, tag
            return False, ""

        # Случай 2: Несколько ячеек
        if len(row) >= 2:
            first_cell = row[0].strip()
            match = re.match(r"^([А-ЯA-ZЁ]{1,3}\d{1,2})$", first_cell, re.IGNORECASE)
            if match and not first_cell.isdigit():
                has_numbers = any(
                    re.search(r"\d+[,\.]\d+", str(cell)) for cell in row[1:]
                )
                if has_numbers:
                    return True, match.group(1).upper()

        return False, ""

    # 5.5. Склейка строк (The Squeezer) с отслеживанием тегов групп
    valid_rows = []
    current_row_cells = []
    header = pruned_body[0]
    stop_words = {"итого", "всего", "total", "sum"}
    current_group_tag = ""  # Текущий тег группы
    row_tags = []  # Теги для каждой строки в valid_rows

    for row in pruned_body[1:]:
        if not row or set("".join(row).replace("-", "").replace(" ", "")) == set():
            continue

        # Проверяем, является ли строка заголовком группы
        is_header, group_tag = is_group_header_row_early(row)
        if is_header:
            # Завершаем текущий товар если есть (с ПРЕДЫДУЩИМ тегом)
            if current_row_cells:
                valid_rows.append(current_row_cells)
                row_tags.append(current_group_tag)  # Сохраняем старый тег
                current_row_cells = []
            # Обновляем тег группы для следующих товаров
            current_group_tag = group_tag
            continue

        val_col_0 = row[0].strip() if len(row) > 0 else ""
        val_col_1 = row[1].strip() if len(row) > 1 else ""

        # Проверяем, есть ли в последних колонках числовые значения (цены)
        has_prices = False
        if len(row) >= 2:
            last_two = " ".join(row[-2:])
            # Ищем числа с запятыми/точками (цены)
            if re.search(r"\d+[,\.]\d+", last_two):
                has_prices = True

        is_anchor = False
        # Проверка 1: Строка начинается с номера позиции (1-3 цифры в начале)
        # Изменено: убрали требование обязательного пробела после номера
        if val_col_0 and re.match(r"^\d{1,3}(\s|$)", val_col_0):
            is_anchor = True
        # Проверка 2: Короткое значение в первой или второй колонке (старая логика)
        elif val_col_0 and len(val_col_0) < 15 and val_col_0.lower() not in stop_words:
            is_anchor = True
        elif val_col_1 and len(val_col_1) < 15 and val_col_1.lower() not in stop_words:
            is_anchor = True

        has_useful_data = bool(re.search(r"[a-zA-Zа-яА-Я0-9]", " ".join(row)))

        # КРИТИЧЕСКАЯ ЛОГИКА: Якорь всегда имеет приоритет
        # Если строка начинается с номера позиции - это НОВАЯ позиция, даже если есть цены
        if is_anchor:
            # Сохраняем предыдущую позицию, если была
            if current_row_cells:
                valid_rows.append(current_row_cells)
                row_tags.append(current_group_tag)
            # Начинаем новую позицию
            current_row_cells = row
        # Если текущая строка имеет цены (но НЕ якорь), это завершение товара
        elif has_prices and current_row_cells:
            # Склеиваем текущую строку с накопленной
            for idx, cell in enumerate(row):
                if cell:
                    if idx < len(current_row_cells):
                        current_row_cells[idx] = (
                            f"{current_row_cells[idx]} {cell}".strip()
                        )
                    else:
                        current_row_cells.append(cell)
            # Сохраняем завершенный товар с тегом
            valid_rows.append(current_row_cells)
            row_tags.append(current_group_tag)
            current_row_cells = []
            if current_row_cells:
                valid_rows.append(current_row_cells)
                row_tags.append(current_group_tag)
            current_row_cells = row
        else:
            if current_row_cells and has_useful_data:
                for idx, cell in enumerate(row):
                    if cell:
                        if idx < len(current_row_cells):
                            current_row_cells[idx] = (
                                f"{current_row_cells[idx]} {cell}".strip()
                            )
                        else:
                            current_row_cells.append(cell)
            elif not current_row_cells and has_useful_data:
                current_row_cells = row

    if current_row_cells:
        valid_rows.append(current_row_cells)
        row_tags.append(current_group_tag)

    # 5.6. Присвоение тегов из row_tags
    # Теги уже определены на этапе склеивания строк
    final_rows = []
    for i, row in enumerate(valid_rows):
        tag = row_tags[i] if i < len(row_tags) else ""
        row_with_tag = row + [tag]
        final_rows.append(row_with_tag)

    # Обновляем valid_rows и header
    valid_rows = final_rows
    if header and final_rows:
        # Добавляем колонку "Тег" в заголовок
        header = header + ["Тег"]

    # 6. Сборка финального текста (DENSE SEMICOLON FORMAT)
    if not valid_rows:
        return ""

    def clean_cell(c):
        # Удаляем лишние пробелы внутри ячейки
        text = re.sub(r"\s+", " ", str(c)).strip()

        # Нормализация чисел: удаляем пробелы из чисел с разделителями тысяч
        # Примеры: "15 540,00" → "15540,00", "1 234 567.89" → "1234567.89"
        # Паттерн: цифра + (пробел + цифры)+ + опционально (запятая/точка + цифры)
        text = re.sub(r"(\d)\s+(?=\d)", r"\1", text)

        return text

    result_lines = []
    header_clean = [clean_cell(h) for h in header]
    result_lines.append("; ".join(header_clean))

    for row in valid_rows:
        padded_row = row + [""] * (len(header) - len(row))

        # Обрабатываем все ячейки, но последнюю (тег) не трогаем через clean_cell
        row_clean = []
        for i, cell in enumerate(padded_row):
            if i == len(padded_row) - 1:  # Последняя ячейка - это тег
                row_clean.append(str(cell).strip())
            else:
                row_clean.append(clean_cell(cell))

        # НЕ удаляем последнюю колонку (Тег), даже если она пустая
        result_lines.append("; ".join(row_clean))

    return "\n".join(result_lines)


def normalize_vat_rate(vat_str: str) -> dict:
    """
    Нормализует ставку НДС и проверяет её корректность.

    Возвращает:
    {
        "value": "22%" | "20%" | "10%" | "0%" | "Без НДС" | исходное значение,
        "is_valid": bool,
        "is_legacy": bool  # True если 20% (старая ставка)
    }
    """
    if not vat_str or not isinstance(vat_str, str):
        return {"value": "", "is_valid": False, "is_legacy": False}

    vat_clean = vat_str.strip().lower()

    # Допустимые ставки НДС
    valid_rates = {
        "22%": ["22%", "22", "ндс 22%", "ндс 22"],
        "20%": ["20%", "20", "ндс 20%", "ндс 20"],
        "10%": ["10%", "10", "ндс 10%", "ндс 10"],
        "0%": ["0%", "0", "ндс 0%", "ндс 0"],
        "Без НДС": ["без ндс", "без", "не облагается", "нет", "-"],
    }

    # Поиск совпадения
    for normalized, variants in valid_rates.items():
        if vat_clean in variants:
            return {
                "value": normalized,
                "is_valid": True,
                "is_legacy": normalized == "20%",
            }

    # Если не найдено совпадение → некорректная ставка
    return {"value": vat_str, "is_valid": False, "is_legacy": False}


def detect_vat_strategy(items: list) -> str:
    """
    Определяет стратегию извлечения НДС из счёта.

    Возвращает:
    - "single" — единая ставка для всех позиций
    - "mixed" — разные ставки в одном счёте
    - "none" — НДС не указан
    """
    if not items:
        return "none"

    vat_rates = set()
    for item in items:
        vat = item.get("vat_rate", "")
        if vat:
            vat_rates.add(vat)

    if not vat_rates:
        return "none"
    elif len(vat_rates) == 1:
        return "single"
    else:
        return "mixed"


def calculate_vat_rate_from_amounts(total: float, vat_amount: float) -> str:
    """
    Вычисляет процент НДС из суммы НДС и общей суммы.

    Формула: НДС% = (vat_amount / (total - vat_amount)) * 100

    Args:
        total: Общая сумма счёта (с НДС)
        vat_amount: Сумма НДС

    Returns:
        Строка с процентом НДС ("22%", "20%", "10%", "0%") или пустая строка
    """
    if not total or not vat_amount or total <= 0 or vat_amount < 0:
        return ""

    # Цена без НДС
    price_without_vat = total - vat_amount
    if price_without_vat <= 0:
        return ""

    # Вычисляем процент НДС
    vat_percent = (vat_amount / price_without_vat) * 100

    # Округляем до ближайшей стандартной ставки
    if 21 <= vat_percent <= 23:
        return "22%"
    elif 19 <= vat_percent <= 21:
        return "20%"
    elif 9 <= vat_percent <= 11:
        return "10%"
    elif 4 <= vat_percent <= 8:
        return "5%"  # УСН
    elif vat_percent < 1:
        return "0%"
    else:
        # Если не попадает в стандартные ставки → возвращаем округлённое значение
        return f"{round(vat_percent)}%"


def validate_math(items: list) -> list:
    """
    Validates the math (quantity * price_final == total) for each item.

    Оптимизация #3: Инвертированная логика - добавляем has_math_error только если есть ошибка.
    Экономия ~448 токенов OUTPUT для 56 позиций (0.27₽).
    """
    for item in items:
        # Safely extract floats
        try:
            qty = float(item.get("quantity", 0) or 0)
        except:
            qty = 0.0

        try:
            price = float(item.get("price_final", 0) or 0)
        except:
            price = 0.0

        try:
            total = float(item.get("total", 0) or 0)
        except:
            total = 0.0

        # Оптимизация #3: Добавляем поле только если есть ошибка (инвертированная логика)
        # Вместо is_valid: true (всегда) -> has_math_error: true (только при ошибке)
        if abs((qty * price) - total) >= 0.1:
            item["has_math_error"] = True

    return items


def clean_empty_fields(items: list) -> list:
    """
    Удаляет пустые строковые поля из items для экономии токенов.

    Оптимизация #2: Экономия ~504 токена OUTPUT для 56 позиций.
    Безопасно: фронтенд должен проверять наличие полей (item.discount ?? "").

    ВАЖНО: НЕ удаляем поля НДС (vat_rate, vat_amount, vat_rate_invalid, vat_rate_legacy)
    даже если они пустые — они нужны для UI.
    """
    vat_fields = {
        "vat_rate",
        "vat_amount",
        "vat_rate_invalid",
        "vat_rate_legacy",
        "vat_math_error",
    }

    for item in items:
        # Удаляем только пустые строки и None, НО НЕ поля НДС
        # НЕ удаляем False, 0, [] - это валидные значения
        empty_keys = [
            k for k, v in item.items() if (v == "" or v is None) and k not in vat_fields
        ]
        for k in empty_keys:
            del item[k]
    return items


async def process_items(
    extracted_text: str,
    p_method: str = "",
    api_key: str = "",
    folder_id: str = "",
    supplier_name: str = "",
    default_vat: str = "",
):
    """
    Applies slicer for Excel/CSV generated Markdown, chunks the payload, then calls LLM concurrently.
    Returns: (items_list, UsageStats)

    Args:
        default_vat: Ставка НДС по умолчанию из реквизитов документа (если есть)
    """
    from ai_service import UsageStats, gpt_yandex, load_prompt, parse_gpt_json

    if not extracted_text:
        return [], UsageStats()

    markdown_payload = extracted_text

    if p_method == "excel_ai":
        # Apply Excel/CSV Semicolon Squeezer - EXCEL VERSION (isolated)
        markdown_payload = clean_and_group_markdown_table_excel(extracted_text)
    elif p_method == "pdf_text":
        # Apply Ultra-Squeezer for digital PDF tables - PDF VERSION (isolated)
        markdown_payload = clean_and_group_markdown_table(extracted_text)
    elif p_method == "squeezer":
        # Apply Squeezer 4.0 WITHOUT LLM - return items directly (uses PDF version)
        squeezed_text = clean_and_group_markdown_table(extracted_text)
        if not squeezed_text:
            return [], UsageStats()

        # Parse semicolon format into items
        import pandas as pd
        from parser_utils import convert_df_to_items

        # Convert semicolon text to DataFrame
        lines = squeezed_text.strip().split("\n")
        if len(lines) < 2:
            return [], UsageStats()

        # Parse header and data
        rows = [line.split(";") for line in lines]
        rows = [[cell.strip() for cell in row] for row in rows]

        df = pd.DataFrame(rows[1:], columns=rows[0])
        items = convert_df_to_items(df)

        # Оптимизация #1: НЕ добавляем supplier в items
        validated_items = validate_math(items)

        # Оптимизация #2: Удаление пустых полей для экономии токенов
        validated_items = clean_empty_fields(validated_items)

        return validated_items, UsageStats()
    elif p_method == "ocr_table":
        # OCR PDF filter: keep only lines containing digits (price/quantity candidates)
        lines = extracted_text.split("\n")
        filtered = []
        for line in lines:
            if re.search(r"\d", line) or "---" in line or not line.strip():
                filtered.append(line)
        markdown_payload = "\n".join(filtered)

    # Load appropriate prompt based on method (Excel vs PDF isolation)
    if p_method == "excel_ai":
        prompt_template = load_prompt("invoice_items_excel")
        if not prompt_template:
            print("Error: invoice_items_excel_prompt.md not found")
            return [], UsageStats()
    else:
        # For pdf_text, ocr_table, and other methods
        prompt_template = load_prompt("invoice_items")
        if not prompt_template:
            print("Error: invoice_items_prompt.md not found")
            return [], UsageStats()

    parts = prompt_template.split("[INSTRUCTION]")
    system_prompt = parts[0].strip()

    # Chunking Semicolon Payload (15 rows max per chunk) to avoid output token truncation
    lines = markdown_payload.split("\n")
    header_line = lines[0] if lines else ""
    data_lines = lines[1:] if len(lines) > 1 else []

    chunks = []
    chunk_size = 15
    if data_lines:
        for i in range(0, len(data_lines), chunk_size):
            chunk = [header_line] + data_lines[i : i + chunk_size]
            chunks.append("\n".join(chunk))
    else:
        chunks = [markdown_payload]

    total_stats = UsageStats()
    all_items = []

    async def process_chunk(chunk_payload, index):
        instruction = (
            "[INSTRUCTION]"
            + parts[1].replace("{markdown_payload}", chunk_payload).strip()
        )
        try:
            llm_response, in_tok, out_tok = await gpt_yandex(
                text=instruction,
                api_key=api_key,
                folder_id=folder_id,
                system_prompt=system_prompt,
                model_type="pro",
                label=f"Items_Chunk_{index}",
            )
            chunk_stats = UsageStats()
            chunk_stats.add(f"Items_Chunk_{index}", "yandexgpt-pro", in_tok, out_tok)

            parsed = parse_gpt_json(llm_response)
            chunk_items = (
                parsed.get("items", [])
                if isinstance(parsed, dict)
                else (parsed if isinstance(parsed, list) else [])
            )
            return chunk_items, chunk_stats
        except Exception as e:
            logger.error(
                f"CRITICAL: Error calling LLM for items parsing chunk {index}: {e}",
                exc_info=True,
            )
            return [], UsageStats()

    chunk_tasks = [process_chunk(c, i + 1) for i, c in enumerate(chunks)]
    results = await asyncio.gather(*chunk_tasks)

    for items, stats in results:
        all_items.extend(items)
        total_stats.merge(stats)

    # Оптимизация #1: НЕ добавляем supplier в items - он уже есть в document.organization_name
    # Экономия ~567 токенов OUTPUT для 56 позиций (0.34₽)
    # Фронтенд должен брать supplier из document.organization_name

    # Apply Math Sanitizer
    validated_items = validate_math(all_items)

    # Валидация и нормализация НДС
    for item in validated_items:
        vat_raw = item.get("vat_rate", "")

        # Если НДС пустой и есть default_vat → используем его
        if not vat_raw and default_vat:
            vat_raw = default_vat

        # Нормализуем НДС
        if vat_raw:
            vat_info = normalize_vat_rate(vat_raw)
            item["vat_rate"] = vat_info["value"]

            # Флаги только если есть проблемы (инвертированная логика)
            if not vat_info["is_valid"]:
                item["vat_rate_invalid"] = True
            if vat_info["is_legacy"]:
                item["vat_rate_legacy"] = True

    # Оптимизация #2: Удаление пустых полей для экономии токенов
    validated_items = clean_empty_fields(validated_items)

    # Post-processing: Очистка точек с запятой в названиях (замена на пробелы)
    # Это исправляет проблему когда LLM склеивает несколько ячеек через ";"
    for item in validated_items:
        if 'name' in item and item['name']:
            item['name'] = item['name'].replace('; ', ' ')

    return validated_items, total_stats
