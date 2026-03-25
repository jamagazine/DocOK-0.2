import httpx, asyncio

async def test():
    files = {"file": ("test.csv", b"col1,col2\na,b", "text/csv")}
    async with httpx.AsyncClient() as client:
        r = await client.post("http://localhost:8000/api/storage/upload", files=files)
        print("Upload Response:", r.json())
        
    r2 = await client.get("http://localhost:8000/api/storage/files")
    print("Files List:", r2.json())

asyncio.run(test())
