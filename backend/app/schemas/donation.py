from pydantic import BaseModel
from typing import Optional

class CreateDonationRequest(BaseModel):
    amount_rupees: int
    user_id: str
    notes: Optional[str] = None

class CreateDonationResponse(BaseModel):
    transaction_id: str
    order_id: str
    amount_rupees: int
