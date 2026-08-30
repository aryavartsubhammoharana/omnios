import uvicorn
from app.main import app
from app.utils.smart_logger import get_smart_log_config

if __name__ == "__main__":
    print("🚀 Starting NoteAI Server on http://127.0.0.1:8000 ...")
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True, log_config=get_smart_log_config())
