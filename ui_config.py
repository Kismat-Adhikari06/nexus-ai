import tkinter as tk
from tkinter import ttk

from config import Config
from nexu_log import get_logger

log = get_logger("config_ui")


def show_settings():
    root = tk.Tk()
    root.title("Nexu Settings")
    root.geometry("500x480")
    root.resizable(False, False)

    try:
        root.iconbitmap(default="nexu.ico")
    except Exception:
        pass

    frame = ttk.Frame(root, padding=20)
    frame.pack(fill="both", expand=True)

    row = 0

    ttk.Label(frame, text="Nexu Settings", font=("Segoe UI", 14, "bold")).grid(
        row=row, column=0, columnspan=2, pady=(0, 20), sticky="w"
    )
    row += 1

    fields = {}

    def add_field(label, key, current_value, options=None):
        nonlocal row
        ttk.Label(frame, text=label, font=("Segoe UI", 10)).grid(
            row=row, column=0, sticky="w", pady=4, padx=(0, 10)
        )
        if options:
            var = tk.StringVar(value=str(current_value))
            widget = ttk.Combobox(frame, textvariable=var, values=options, state="readonly", width=35)
        else:
            var = tk.StringVar(value=str(current_value))
            widget = ttk.Entry(frame, textvariable=var, width=38)
        widget.grid(row=row, column=1, sticky="w", pady=4)
        fields[key] = var
        row += 1

    add_field("Hotkey", "hotkey", Config.HOTKEY, options=["caps_lock", "f4", "f3", "f2", "f1"])
    add_field("AI Provider", "ai_provider", Config.AI_PROVIDER, options=["groq", "gemini", "openrouter", "lm_studio"])
    add_field("Groq Model", "groq_model", Config.GROQ_MODEL)
    add_field("Gemini Model", "gemini_model", Config.GEMINI_MODEL)
    add_field("TTS Voice", "tts_voice", Config.TTS_VOICE)
    add_field("Max History", "max_history", Config.MAX_HISTORY)
    add_field("AI Timeout (s)", "ai_timeout", Config.AI_TIMEOUT)
    add_field("WhatsApp Browser", "whatsapp_browser", Config.WHATSAPP_BROWSER, options=["chromium", "chrome", "msedge", "firefox"])
    add_field("Silence Seconds", "silence_seconds", Config.SILENCE_SECONDS)
    add_field("Max Record (s)", "max_record_seconds", Config.MAX_RECORD_SECONDS)

    ttk.Label(frame, text="", font=("Segoe UI", 8)).grid(row=row, column=0, columnspan=2)
    row += 1

    status_var = tk.StringVar()
    status_label = ttk.Label(frame, textvariable=status_var, foreground="green")
    status_label.grid(row=row, column=0, columnspan=2, pady=5)

    def save():
        for key, var in fields.items():
            val = var.get()
            converted = val
            if val.isdigit():
                converted = int(val)
            elif _is_float(val):
                converted = float(val)
            Config.set_config(key, converted)
        Config.save_user_config()
        Config.reload()
        status_var.set("Settings saved! Restart for some changes to take effect.")
        root.after(2000, lambda: status_var.set(""))

    def _is_float(s):
        try:
            float(s)
            return True
        except ValueError:
            return False

    save_btn = ttk.Button(frame, text="Save Settings", command=save)
    save_btn.grid(row=row + 1, column=0, pady=10)

    close_btn = ttk.Button(frame, text="Close", command=root.destroy)
    close_btn.grid(row=row + 1, column=1, pady=10)

    root.mainloop()


if __name__ == "__main__":
    show_settings()
