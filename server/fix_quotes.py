import os

target = r"c:\Project\DocOK\DocOK_0.2.5\server\main.py"
with open(target, 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace('\\"', '"')

with open(target, 'w', encoding='utf-8') as f:
    f.write(text)

print("Fixed main.py")
