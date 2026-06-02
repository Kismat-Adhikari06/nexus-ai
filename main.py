import ctypes
import sys
import threading
import time
import tkinter as tk

from pynput import keyboard

from ai import Conversation, ask_stream
from config import Config
from memory.vector import add as save_conversation
from stt import preload_model, reset_stop, speech_to_text, stop_recording
from tools.executor import execute
from tts import speak, speak_sentence, speaking, stop_speaking, VOICE

VK_F4 = 0x73


def ts():
    return time.strftime("%H:%M:%S")


def _try_acrylic(hwnd):
    try:
        class ACCENTPOLICY(ctypes.Structure):
            _fields_ = [
                ("AccentState", ctypes.c_ulong),
                ("AccentFlags", ctypes.c_ulong),
                ("GradientColor", ctypes.c_ulong),
                ("AnimationId", ctypes.c_ulong),
            ]

        class WINCOMPATTRDATA(ctypes.Structure):
            _fields_ = [
                ("Attribute", ctypes.c_ulong),
                ("Data", ctypes.POINTER(ACCENTPOLICY)),
                ("SizeOfData", ctypes.c_size_t),
            ]

        accent = ACCENTPOLICY()
        accent.AccentState = 3
        accent.AccentFlags = 2
        accent.GradientColor = 0x11000000
        accent.AnimationId = 0

        data = WINCOMPATTRDATA()
        data.Attribute = 19
        data.Data = ctypes.pointer(accent)
        data.SizeOfData = ctypes.sizeof(accent)

        user32 = ctypes.windll.user32
        return user32.SetWindowCompositionAttribute(hwnd, ctypes.byref(data))
    except Exception:
        return False


class NexuOverlay:
    def __init__(self):
        self.conversation = Conversation()
        self.state = "idle"
        self._last_f4_time = 0.0

        self.root = tk.Tk()
        self.root.title("Nexu")
        self.root.overrideredirect(True)
        self.root.attributes("-topmost", True)
        self.root.attributes("-transparentcolor", "magenta")
        self.root.configure(bg="magenta")

        hwnd = ctypes.windll.user32.GetParent(self.root.winfo_id())
        if not _try_acrylic(hwnd):
            self.root.attributes("-alpha", 0.80)

        inner_bg = "#111826"

        self.frame = tk.Frame(
            self.root,
            bg=inner_bg,
            highlightbackground="#1e2d4a",
            highlightthickness=1,
            padx=2, pady=2,
        )
        self.frame.pack(fill="both", expand=True)

        self.label = tk.Label(
            self.frame,
            text="",
            font=("Segoe UI", 12, "bold"),
            fg="#e6edf3",
            bg=inner_bg,
            padx=20, pady=12,
            anchor="w",
        )
        self.label.pack(side="left", fill="x", expand=True)

        self.entry = tk.Entry(
            self.frame,
            font=("Segoe UI", 12),
            bg="#0d1117",
            fg="#e6edf3",
            insertbackground="#58a6ff",
            relief="flat",
            bd=0,
            highlightthickness=0,
        )
        self.entry.bind("<Return>", self._on_text_submit)
        self.entry.bind("<Escape>", lambda e: self._hide())

        self.root.withdraw()
        self.root.bind("<Escape>", lambda e: self._exit())

        threading.Thread(target=self._preload, daemon=True).start()
        self._start_keyboard_listener()

    def _preload(self):
        preload_model()

    def _start_keyboard_listener(self):
        listener = keyboard.Listener(on_press=self._on_press, on_release=self._on_release)
        listener.daemon = True
        listener.start()

    def _on_press(self, key):
        try:
            if key == keyboard.Key.f4:
                now = time.time()
                if (now - self._last_f4_time) > 0.3:
                    self._last_f4_time = now
                    if self.state == "idle":
                        print(f"[{ts()}] F4 pressed")
                        self._start_listen()
                    elif self.state == "speaking":
                        print(f"[{ts()}] F4 barge-in")
                        stop_speaking()
                        self._start_listen()
            elif key == keyboard.Key.f3 and self.state == "idle":
                print(f"[{ts()}] F3 pressed — text mode")
                self._start_text_mode()
        except AttributeError:
            pass

    def _on_release(self, key):
        try:
            if key == keyboard.Key.f4 and self.state == "listening":
                user32 = ctypes.windll.user32
                if not (user32.GetAsyncKeyState(VK_F4) & 0x8000):
                    print("[nexu] F4 released via pynput")
                    stop_recording()
        except AttributeError:
            pass

    def _wait_for_f4_release(self):
        try:
            user32 = ctypes.windll.user32
            time.sleep(0.15)
            misses = 0
            while self.state == "listening":
                if not (user32.GetAsyncKeyState(VK_F4) & 0x8000):
                    misses += 1
                    if misses >= 3:
                        print("[nexu] F4 released via monitor")
                        stop_recording()
                        break
                else:
                    misses = 0
                time.sleep(0.05)
        except Exception as e:
            print(f"[nexu] F4 monitor died: {e}")

    def _start_listen(self):
        self.state = "listening"
        self._show("●  Nexu is listening...", bg="#111826", fg="#58a6ff")
        print("[nexu] Hold F4 to talk...")
        reset_stop()
        threading.Thread(target=self._wait_for_f4_release, daemon=True).start()
        threading.Thread(target=self._process_loop, daemon=True).start()

    def _start_text_mode(self):
        self.state = "text"
        self._show("> ", bg="#111826", fg="#e6edf3")
        self.root.after(0, self._focus_entry)

    def _focus_entry(self):
        self.entry.pack(side="right", fill="x", expand=False, padx=(0, 10))
        self.entry.delete(0, tk.END)
        self.entry.focus_set()

    def _on_text_submit(self, event=None):
        text = self.entry.get().strip()
        if not text:
            return
        self.entry.pack_forget()
        self.state = "processing"
        self._show("●  Nexu is thinking...", bg="#111826", fg="#d29922")
        threading.Thread(target=self._process_text, args=(text,), daemon=True).start()

    def _process_text(self, text: str):
        full_text = ""
        tool_calls = []
        try:
            for msg in ask_stream(text, self.conversation):
                if msg[0] == "token":
                    full_text += msg[1]
                    display = full_text[-120:] if len(full_text) > 120 else full_text
                    self._show(display, bg="#111826", fg="#e6edf3")
                elif msg[0] == "done":
                    _, _, tool_calls = msg
        except Exception as e:
            print(f"[nexu] AI error: {e}")
            self.state = "idle"
            self._hide()
            return

        if tool_calls:
            results = []
            for call in tool_calls:
                action = call.pop("action")
                result = execute(action, **call)
                results.append(result)
            response = ". ".join(str(r) for r in results)
            self.conversation.update_last(response)
            full_text = response

        response = full_text.split("---TOOL---")[0].strip()
        print(f"[nexu] You (text): {text}")
        print(f"[nexu] Nexu: {response}")
        save_conversation("user", text)
        save_conversation("assistant", response)
        self._show_text_response(response)

    def _show_text_response(self, response: str):
        max_chars = 120
        display = response[:max_chars] + "..." if len(response) > max_chars else response
        self._show(display, bg="#111826", fg="#3fb950")
        self.state = "idle"
        self.root.after(5000, self._hide)

    def _show(self, text, bg="#111826", fg="#e6edf3"):
        def _update():
            self.label.config(text=text, fg=fg, bg=bg)
            self.frame.config(bg=bg, highlightbackground="#1e2d4a")
            self.root.update_idletasks()
            sw = self.root.winfo_screenwidth()
            ww = self.root.winfo_width()
            self.root.geometry(f"+{(sw - ww) // 2}+0")
            self.root.deiconify()

        self.root.after(0, _update)

    def _hide(self):
        self.root.after(0, self.root.withdraw)

    def _exit(self):
        self.root.destroy()
        sys.exit(0)

    def _process_loop(self):
        t0 = time.time()
        try:
            text = speech_to_text()
        except Exception as e:
            print(f"[{ts()}] STT error: {e}")
            self.state = "idle"
            self._hide()
            return

        if not text:
            print(f"[{ts()}] No speech")
            self.state = "idle"
            self._hide()
            return

        print(f"[{ts()}] STT done  ({time.time()-t0:.1f}s)")
        t1 = time.time()
        print(f"[{ts()}] You: {text}")

        self.state = "processing"
        self._show("●  Nexu is thinking...", bg="#111826", fg="#d29922")

        full_text = ""
        tts_buffer = ""
        tool_calls = []

        try:
            for msg in ask_stream(text, self.conversation):
                if msg[0] == "token":
                    token = msg[1]
                    full_text += token
                    tts_buffer += token
                    print(f"\r[{ts()}] Nexu: {full_text}", end="", flush=True)

                    if any(token.endswith(p) for p in ".!?") and len(tts_buffer.strip()) > 3:
                        sentence = tts_buffer.strip()
                        if self.state == "processing":
                            self.state = "speaking"
                        self._show(sentence[:80], bg="#111826", fg="#3fb950")
                        speak_sentence(sentence)
                        tts_buffer = ""

                elif msg[0] == "done":
                    _, _, tool_calls = msg
            print()
            print(f"[{ts()}] LLM done  ({time.time()-t1:.1f}s)")
        except Exception as e:
            print(f"\n[{ts()}] AI error: {e}")
            self.state = "idle"
            self._hide()
            return

        if tts_buffer.strip():
            sentence = tts_buffer.strip()
            if self.state == "processing":
                self.state = "speaking"
            self._show(sentence[:80], bg="#111826", fg="#3fb950")
            speak_sentence(sentence)

        if tool_calls:
            t2 = time.time()
            print(f"[{ts()}] Tools: {tool_calls}")
            self.state = "processing"
            self._show("●  Nexu is doing...", bg="#111826", fg="#d29922")
            results = []
            for call in tool_calls:
                action = call.pop("action")
                result = execute(action, **call)
                print(f"[{ts()}] Tool result: {result}")
                results.append(result)
            response_text = ". ".join(str(r) for r in results if r)
            if response_text:
                self.conversation.update_last(response_text)
                print(f"[{ts()}] Tools done  ({time.time()-t2:.1f}s)")
                print(f"[{ts()}] Result: {response_text}")
                self.state = "speaking"
                self._show(response_text[:80], bg="#111826", fg="#3fb950")
                speak(response_text)

        full_response = full_text.split("---TOOL---")[0].strip()
        save_conversation("user", text)
        save_conversation("assistant", full_response)

        while speaking() and self.state == "speaking":
            time.sleep(0.05)
        if self.state == "speaking":
            self.state = "idle"
            self._hide()
        print(f"[{ts()}] Total  ({time.time()-t0:.1f}s)")
        print("-" * 40)

    def run(self):
        print("=" * 40)
        print("  Nexu — AI Desktop Assistant")
        print("=" * 40)
        print(f"  Voice:    F4 (hold to talk)")
        print(f"  Text:     F3 (type a message)")
        model_name = getattr(Config, f"{Config.AI_PROVIDER.upper()}_MODEL", "")
        print(f"  AI:       {Config.AI_PROVIDER}/{model_name}")
        print(f"  STT:      Groq whisper-large-v3-turbo")
        print(f"  TTS:      edge-tts ({VOICE})")
        if not Config.GROQ_API_KEY:
            print("  !!! GROQ_API_KEY not set — edit .env !!!")
        print("=" * 40)
        print("  Press Esc to exit")
        print("=" * 40)
        sys.stdout.flush()

        try:
            self.root.mainloop()
        except KeyboardInterrupt:
            self._exit()


if __name__ == "__main__":
    NexuOverlay().run()
