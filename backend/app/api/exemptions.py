from fastapi import APIRouter, Depends, HTTPException
from asyncpg import Connection
from pydantic import BaseModel
from typing import Optional

from app.core.database import get_db
from app.core.auth import get_current_user

router = APIRouter()

class ExemptionRequest(BaseModel):
    booking_id: Optional[str] = None
    ehundi_id: Optional[str] = None
    pan_number: str
    address: str

@router.post("")
async def request_tax_exemption(req: ExemptionRequest, db: Connection = Depends(get_db), user_id: str = Depends(get_current_user)):
    if not req.booking_id and not req.ehundi_id:
        raise HTTPException(400, "Must provide either booking_id or ehundi_id")

    amount = 0
    # Validate the booking or donation belongs to the user and gets its amount
    if req.booking_id:
        b = await db.fetchrow("SELECT amount_rupees FROM bookings WHERE id = $1 AND user_id = $2", req.booking_id, user_id)
        if not b:
            raise HTTPException(404, "Booking not found")
        amount = b['amount_rupees']
        # Check if already requested
        existing = await db.fetchval("SELECT id FROM tax_exemptions WHERE booking_id = $1", req.booking_id)
        if existing:
            raise HTTPException(400, "Tax exemption already requested for this booking")
            
    elif req.ehundi_id:
        d = await db.fetchrow("SELECT amount_rupees FROM e_undiyal_transactions WHERE id = $1 AND user_id = $2", req.ehundi_id, user_id)
        if not d:
            raise HTTPException(404, "Donation not found")
        amount = d['amount_rupees']
        # Check if already requested
        existing = await db.fetchval("SELECT id FROM tax_exemptions WHERE ehundi_id = $1", req.ehundi_id)
        if existing:
            raise HTTPException(400, "Tax exemption already requested for this donation")

    await db.execute(
        "INSERT INTO tax_exemptions (user_id, booking_id, ehundi_id, amount_rupees, pan_number, address) VALUES ($1, $2, $3, $4, $5, $6)",
        user_id, req.booking_id, req.ehundi_id, amount, req.pan_number, req.address
    )
    return {"status": "success"}

@router.get("")
async def get_my_tax_exemptions(db: Connection = Depends(get_db), user_id: str = Depends(get_current_user)):
    # Fetch with booking reference or donation reference joined
    records = await db.fetch("""
        SELECT t.*, 
               b.reference as booking_reference,
               d.reference as donation_reference,
               t.created_at::text,
               t.updated_at::text
        FROM tax_exemptions t
        LEFT JOIN bookings b ON t.booking_id = b.id
        LEFT JOIN e_undiyal_transactions d ON t.ehundi_id = d.id
        WHERE t.user_id = $1
        ORDER BY t.created_at DESC
    """, user_id)
    return [dict(r) for r in records]
