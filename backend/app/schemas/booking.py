from pydantic import BaseModel, EmailStr
from datetime import date
from typing import Optional, List, Dict, Any

class HoldRequest(BaseModel):
    service_id: str
    user_id: str
    date: date
    session: str
    slot_capacity: int = 1

class HoldResponse(BaseModel):
    hold_id: str
    expires_at: str

class CreateBookingRequest(BaseModel):
    service_id: str
    user_id: str
    hold_id: str
    date: date
    session: str
    num_persons: int
    persons: List[Dict[str, Any]]

class ExtendHoldRequest(BaseModel):
    hold_id: str

class ReleaseHoldRequest(BaseModel):
    hold_id: str

class CreateBookingResponse(BaseModel):
    booking_id: str
    razorpay_order_id: str
    amount_rupees: int

class WebhookRequest(BaseModel):
    pass
