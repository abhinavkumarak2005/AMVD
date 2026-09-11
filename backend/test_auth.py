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

# Try to resend OTP for an email that is definitely verified (admin@temple.com)
res = requests.post(
    f"{supabase_url}/auth/v1/resend",
    headers=headers,
    json={"type": "signup", "email": "admin@temple.com"}
)
print("Status:", res.status_code)
print("Body:", res.text)
