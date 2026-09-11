import requests
import os
from dotenv import load_dotenv

load_dotenv()
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_ANON_KEY")

headers = {
    "apikey": supabase_key,
    "Authorization": f"Bearer {supabase_key}",
    "Content-Type": "application/json"
}

# Assuming admin@temple.com is verified and password is password
res = requests.post(
    f"{supabase_url}/auth/v1/token?grant_type=password",
    headers=headers,
    json={"email": "admin@temple.com", "password": "password"}
)
print("Admin login status:", res.status_code)
print("Admin login body:", res.text)
