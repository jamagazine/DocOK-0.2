import xlrd

file_path = r'c:\Project\DocOK\DocOK_0.2.5\data\projects\novyj-proekt-1-03-04-2026\files\1058-25-OV_S_1.xls'
wb = xlrd.open_workbook(file_path)
for sheet in wb.sheets():
    print(f"Sheet: {sheet.name}, Rows: {sheet.nrows}")
