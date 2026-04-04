"""
AI-Assisted Calendar API

FastAPI application for the AI-Assisted Calendar system.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .routers import auth, users, events, participants, ai, notifications

# Create FastAPI application
app = FastAPI(
    title="AI-Assisted Calendar API",
    description="API for managing calendar events with AI-powered scheduling",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Register routers
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(events.router)
app.include_router(participants.router)
app.include_router(ai.router)
app.include_router(notifications.router)


# Health check endpoint
@app.get("/health")
def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "version": "1.0.0"}


# Root endpoint
@app.get("/")
def root():
    """Root endpoint with API information."""
    return {
        "name": "AI-Assisted Calendar API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG
    )
