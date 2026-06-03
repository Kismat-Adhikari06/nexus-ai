import json
import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

_CONFIG_DIR = Path.home() / ".nexu"
_CONFIG_FILE = _CONFIG_DIR / "config.json"


def _load_user_config() -> dict:
    if _CONFIG_FILE.exists():
        try:
            return json.loads(_CONFIG_FILE.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return {}
    return {}


def _save_user_config(cfg: dict):
    _CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    _CONFIG_FILE.write_text(json.dumps(cfg, indent=2), encoding="utf-8")


_user_cfg = _load_user_config()


def _get(key: str, default):
    return _user_cfg.get(key, default)


def _set(key: str, value):
    _user_cfg[key] = value
    _save_user_config(_user_cfg)


class Config:
    HOTKEY = _get("hotkey", "caps_lock")
    MIC_DEVICE_INDEX = _get("mic_device_index", None)
    MIC_SAMPLE_RATE = _get("mic_sample_rate", 16000)
    MIC_CHANNELS = _get("mic_channels", 1)
    MIC_CHUNK = _get("mic_chunk", 1024)
    SILENCE_SECONDS = _get("silence_seconds", 2.0)
    MAX_RECORD_SECONDS = _get("max_record_seconds", 10)
    WHISPER_MODEL_SIZE = _get("whisper_model_size", "base")
    WHISPER_DEVICE = _get("whisper_device", "cpu")
    WHISPER_COMPUTE_TYPE = _get("whisper_compute_type", "int8")

    GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
    GROQ_API_KEY1 = os.getenv("GROQ_API_KEY1", "")
    GROQ_KEYS = [k for k in [GROQ_API_KEY, GROQ_API_KEY1] if k]
    GROQ_MODEL = _get("groq_model", "llama-3.3-70b-versatile")

    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL = _get("gemini_model", "gemini-2.0-flash-lite")

    OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
    OPENROUTER_MODEL = _get("openrouter_model", "qwen/qwen-2.5-72b-instruct:free")

    LM_STUDIO_URL = _get("lm_studio_url", os.getenv("LM_STUDIO_URL", "http://localhost:1234/v1"))
    LM_STUDIO_MODEL = _get("lm_studio_model", "qwen3-v1-2b-instruct")

    AI_PROVIDER = _get("ai_provider", "groq")
    TTS_VOICE = _get("tts_voice", "en-US-AriaNeural")
    TTS_SPEED = _get("tts_speed", 0)
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
        "For greetings or chit-chat, just reply naturally. DO NOT use any tool for greetings.\n"
        "Only use a tool when the user explicitly asks for a file/system/browser action.\n\n"
        "CRITICAL — NEVER describe what you'll do. When asked to DO something (open, launch,\n"
        "search, find, send, check), use the tool IMMEDIATELY. Just do it.\n"
        "Don't ask permission for small reversible actions (opening files, launching apps,\n"
        "searching, checking battery). Only ask before destructive actions (delete, format,\n"
        "install, modify system files).\n\n"
        "{MEMORY_PROMPT}\n\n"
        "The facts above are for you to use directly in conversation. "
        "You already know them — do NOT call recall or any tool to fetch them."
        " Just use the information naturally.\n\n"
        "{TOOL_PROMPT}"
    )
    WHATSAPP_BROWSER = _get("whatsapp_browser", "chromium")
    MAX_HISTORY = _get("max_history", 3)
    AI_TIMEOUT = _get("ai_timeout", 15)

    @classmethod
    def save_user_config(cls):
        _save_user_config(_user_cfg)

    @classmethod
    def set_config(cls, key: str, value):
        cls._update_class_attr(key, value)
        _set(key, value)

    @classmethod
    def _update_class_attr(cls, key: str, value):
        upper = key.upper()
        if hasattr(cls, upper):
            setattr(cls, upper, value)
        elif hasattr(cls, key):
            setattr(cls, key, value)

    @classmethod
    def get_all_config(cls) -> dict:
        return dict(_user_cfg)

    @classmethod
    def reload(cls):
        global _user_cfg
        _user_cfg.clear()
        _user_cfg.update(_load_user_config())
        for key, value in _user_cfg.items():
            cls._update_class_attr(key, value)
