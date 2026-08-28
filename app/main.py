import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from app.config import settings
from app.database import engine, Base
from app.routes import auth, classroom, upload, ai, quiz

# Create DB tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    description="Google Classroom & NotebookLM Clone powered by Sarvam AI & Gemini AI"
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Custom Middleware to force 200 OK (Disable 304 caching completely)
@app.middleware("http")
async def disable_304_cache_middleware(request: Request, call_next):
    # Remove incoming cache validation headers from request scope to prevent Starlette 304 responses
    headers = dict(request.scope.get("headers", []))
    headers.pop(b"if-none-match", None)
    headers.pop(b"if-modified-since", None)
    request.scope["headers"] = list(headers.items())

    response = await call_next(request)
    
    # Force fresh 200 OK delivery with no-store cache headers
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response

# Ensure uploads directory exists and mount static files
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# Include Routers
app.include_router(auth.router)
app.include_router(classroom.router)
app.include_router(upload.router)
app.include_router(ai.router)
app.include_router(quiz.router)

@app.get("/api/health")
def health_check():
    return {
        "message": "Welcome to NoteAI - Google Classroom & NotebookLM Clone",
        "status": "online",
        "models": {
            "gemini": settings.GEMINI_MODEL,
            "sarvam": settings.SARVAM_MODEL
        }
    }

# Serve Built 3D React Frontend Static Files
dist_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "dist")
if os.path.exists(dist_dir):
    app.mount("/assets", StaticFiles(directory=os.path.join(dist_dir, "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        if full_path.startswith("api/") or full_path.startswith("uploads/"):
            return None
        file_path = os.path.join(dist_dir, full_path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(dist_dir, "index.html"))
