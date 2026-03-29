# main.py - Update CORS configuration

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import settings
import firebase_admin_init  # noqa: F401 — import triggers Admin SDK initialisation
from routers import onboarding, assistant, profile, news, opportunities


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Firebase Admin SDK is already initialised at import time in firebase_admin_init.py
    print("Starting up ET Smart Concierge API...")
    yield
    print("Shutting down...")


app = FastAPI(
    title="ET Smart Concierge API",
    description="AI Financial Co-Pilot backend powered by Google Gemini",
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS ───────────────────────────────────────────────────────────────────
# Allow all origins for development (you can restrict in production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# ── Global exception handler ───────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    print(f"Global error: {exc}")  # Add logging
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error", "detail": str(exc)},
    )

# ── Routers ────────────────────────────────────────────────────────────────
app.include_router(onboarding.router,    prefix="/api/onboarding",    tags=["Onboarding"])
app.include_router(assistant.router,     prefix="/api/assistant",     tags=["Assistant"])
app.include_router(profile.router,       prefix="/api/profile",       tags=["Profile"])
app.include_router(news.router,          prefix="/api/news",          tags=["News"])
app.include_router(opportunities.router, prefix="/api/opportunities", tags=["Opportunities"])



# ── Health check ───────────────────────────────────────────────────────────
@app.get("/", tags=["Health"])
async def health_check():
    return {
        "status": "ok",
        "model": "gemini-3-flash-preview",
        "provider": "Google Gemini",
        "api_docs": "/docs",
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", reload=True, host="0.0.0.0", port=8000)