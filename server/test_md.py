import pandas as pd
df = pd.DataFrame({"col": ["1.8", "1.9", "1.10", "1.11"]})
print("Original column type:", df["col"].dtype)
print(df.to_markdown(index=False, tablefmt="pipe"))
