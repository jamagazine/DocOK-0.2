import pandas as pd
df = pd.read_excel(r'c:\Project\DocOK\DocOK_0.2.5\server\storage\Shablon_spetsifikatsii_GOST_21.110-2013.xls', dtype=str)
print('COLUMNS:')
for i, c in enumerate(df.columns): print(i, repr(c))
print('\nHEAD:')
print(df.head(10).to_string())
