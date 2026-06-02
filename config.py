import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")


class Config:
    HOTKEY = "caps_lock"
    MIC_DEVICE_INDEX = None
    MIC_SAMPLE_RATE = 16000
    MIC_CHANNELS = 1
    MIC_CHUNK = 1024
    SILENCE_SECONDS = 2.0
    MAX_RECORD_SECONDS = 10
    WHISPER_MODEL_SIZE = "base"
    WHISPER_DEVICE = "cpu"
    WHISPER_COMPUTE_TYPE = "int8"

    GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
    GROQ_API_KEY1 = os.getenv("GROQ_API_KEY1", "")
    GROQ_KEYS = [k for k in [GROQ_API_KEY, GROQ_API_KEY1] if k]
    GROQ_MODEL = "llama-3.3-70b-versatile"

    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL = "gemini-2.0-flash-lite"

    OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
    OPENROUTER_MODEL = "qwen/qwen-2.5-72b-instruct:free"

    LM_STUDIO_URL = os.getenv("LM_STUDIO_URL", "http://localhost:1234/v1")
    LM_STUDIO_MODEL = "qwen3-v1-2b-instruct"

    AI_PROVIDER = "groq"
    HOME_DIR = str(Path.home())
    DESKTOP_DIR = str(Path.home() / "Desktop")
    DOCUMENTS_DIR = str(Path.home() / "Documents")

    SYSTEM_PROMPT = (
        "You are Nexu, a friendly AI assistant on Windows. "
        "Be natural, concise, and conversational.\n\n"
        f"User's home: {HOME_DIR}\n"
        f"Desktop: {DESKTOP_DIR}\n"
        f"Documents: {DOCUMENTS_DIR}\n\n"
        "Each user message is a fresh query. Don't repeat past actions.\n"
        "If the user switches topics, drop the previous topic completely.\n"
        "For greetings or chit-chat, just reply naturally.\n"
        "Only use a tool when the user explicitly asks for a file/system/browser action.\n\n"
        "{MEMORY_PROMPT}\n\n"
        "{TOOL_PROMPT}"
    )
    WHATSAPP_BROWSER = "chromium"
    MAX_HISTORY = 3
    AI_TIMEOUT = 15
