import xlrd

wb = xlrd.open_workbook('data/projects/novyj-proekt-1-02-04-2026/files/1058-25-OV_S_1.xls', formatting_info=True)
sh = wb.sheet_by_name('Спецификация')
print(f"Sheet 'Спецификация': Rows={sh.nrows}, Cols={sh.ncols}")
print(f"Merged cells: {len(sh.merged_cells)}")

# Find non-empty rows from top
print("\n=== FIRST 60 ROWS (non-empty only) ===")
for r in range(min(60, sh.nrows)):
    cells = []
    for c in range(sh.ncols):
        v = sh.cell_value(r, c)
        if v:
            cells.append(f"C{c}:{str(v)[:50]}")
    if cells:
        print(f"R{r:03d} -> {' | '.join(cells)}")

# Search for stamp keywords
print("\n=== STAMP KEYWORD SEARCH ===")
stamp_kw = ["листов", "лист", "изм.", "разраб", "пров.", "н.контр", "шифр", "1058"]
for r in range(sh.nrows):
    for c in range(sh.ncols):
        v = str(sh.cell_value(r, c)).strip().lower()
        for kw in stamp_kw:
            if kw in v and len(v) < 50:
                print(f"  R{r:03d} C{c}: '{sh.cell_value(r, c).strip() if isinstance(sh.cell_value(r, c), str) else sh.cell_value(r, c)}'")
                break

# Print merged cells in the stamp area (find rows with stamp keywords first)
print("\n=== MERGED CELLS WITH DATA (near stamp) ===")
for mc in sh.merged_cells:
    r_lo, r_hi, c_lo, c_hi = mc
    v = sh.cell_value(r_lo, c_lo)
    if v and r_lo < 60:
        v_str = str(v).strip()[:60]
        if len(v_str) > 2:
            print(f"  Merged R{r_lo}-R{r_hi-1} C{c_lo}-C{c_hi-1}: '{v_str}'")
