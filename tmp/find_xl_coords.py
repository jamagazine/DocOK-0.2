import xlrd

file_path = r'c:\Project\DocOK\DocOK_0.2.5\data\projects\novyj-proekt-1-03-04-2026\files\1058-25-OV_S_1.xls'
wb = xlrd.open_workbook(file_path)
s = [sh for sh in wb.sheets() if "специф" in sh.name.lower()][0]

keywords = ["Примечание", "Листов", "Разраб", "Пров", "Лист 1"]

print(f"Sheet: {s.name}")
for r in range(s.nrows):
    row_vals = [str(s.cell_value(r, c)).strip() for c in range(s.ncols)]
    row_str = " ".join(row_vals)
    for kw in keywords:
        if kw.lower() in row_str.lower():
            print(f"R{r}: {row_vals}")
