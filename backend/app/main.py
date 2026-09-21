from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.core.config import settings
from app.core.database import db
from app.core.scheduler import start_scheduler, stop_scheduler
from app.api import donations
from app.api.bookings import router as bookings_router
from app.api.admin import router as admin_router
from app.api.exemptions import router as exemptions_router
from app.api.settings import router as settings_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await db.connect()
    start_scheduler()
    yield
    # Shutdown
    stop_scheduler()
    await db.disconnect()

app = FastAPI(
    title=settings.PROJECT_NAME,
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.ALLOWED_ORIGINS.split(",")] if settings.ALLOWED_ORIGINS else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(bookings_router, prefix="/api/bookings", tags=["Bookings"])
app.include_router(donations.router, prefix="/api/donations", tags=["donations"])
app.include_router(exemptions_router, prefix="/api/exemptions", tags=["Exemptions"])
app.include_router(settings_router, prefix="/api/settings", tags=["Settings"])
app.include_router(admin_router, prefix="/api/admin", tags=["Admin"])

@app.get("/health")
async def health_check():
    return {"status": "healthy", "project": settings.PROJECT_NAME}
