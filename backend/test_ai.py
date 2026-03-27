from google import genai
import os
from dotenv import load_dotenv
import time

load_dotenv()
client = genai.Client(api_key=os.getenv('GEMINI_API_KEY'))

model = 'gemini-2.5-flash'
print(f"Testing the chosen model: {model}")
try:
    time.sleep(2) # Extra buffer for quota
    resp = client.models.generate_content(model=model, contents="Say 'Testing 123'")
    print(f"SUCCESS: {resp.text}")
except Exception as e:
    print(f"FAILED: {e}")
