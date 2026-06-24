import os
from dotenv import load_dotenv
from google import genai

# Load environment variables from .env
load_dotenv()

# Instantiate client using the loaded API key
api_key = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=api_key)

response = client.models.generate_content(
    model="gemini-2.5-flash",
    contents="Hello"
)

print(response.text)