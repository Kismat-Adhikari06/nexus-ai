import asyncio
import os
import queue
import re
import tempfile
import threading

import edge_tts
import pygame

try:
    pygame.mixer.init()
    _audio_available = True
except pygame.error as e:
    print(f"[tts] Audio unavailable — running in text-only mode ({e})")
    _audio_available = False

VOICE = "en-US-AriaNeural"
_tts_queue = queue.Queue()
_stop_requested = threading.Event()
_playing = False
_loop = None
_loop_thread = None


def _ensure_loop():
    global _loop, _loop_thread
    if _loop is not None:
        return
    _loop = asyncio.new_event_loop()
    _loop_thread = threading.Thread(target=_loop.run_forever, daemon=True)
    _loop_thread.start()


def _speak_single(text: str):
    if not _audio_available:
        return

    async def _play():
        tmp = tempfile.NamedTemporaryFile(suffix=".mp3", delete=False)
        tmp_path = tmp.name
        tmp.close()
        communicate = edge_tts.Communicate(text, VOICE)
        await communicate.save(tmp_path)

        pygame.mixer.music.load(tmp_path)
        pygame.mixer.music.play()
        while pygame.mixer.music.get_busy():
            if _stop_requested.is_set():
                pygame.mixer.music.stop()
                break
            pygame.time.Clock().tick(10)

        pygame.mixer.music.unload()
        try:
            os.unlink(tmp_path)
        except PermissionError:
            pass

    future = asyncio.run_coroutine_threadsafe(_play(), _loop)
    try:
        future.result()
    except Exception as e:
        print(f"[tts] Error: {e}")


def _tts_worker():
    _ensure_loop()
    global _playing
    while True:
        sentence = _tts_queue.get()
        if sentence is None:
            break
        if _stop_requested.is_set():
            _stop_requested.clear()
            _playing = False
            continue
        _playing = True
        _speak_single(sentence)
        _playing = False


_worker_thread = threading.Thread(target=_tts_worker, daemon=True)
_worker_thread.start()


def speak(text: str):
    if not _audio_available:
        return
    sentences = [s.strip() for s in re.split(r'(?<=[.!?])\s+', text.strip()) if s.strip()]
    for s in sentences:
        _tts_queue.put(s)


def speak_sentence(text: str):
    if not _audio_available or not text.strip():
        return
    _tts_queue.put(text.strip())


def stop_speaking():
    _stop_requested.set()
    if _audio_available:
        pygame.mixer.music.stop()
    while not _tts_queue.empty():
        try:
            _tts_queue.get_nowait()
        except queue.Empty:
            break


def speaking():
    return _playing or not _tts_queue.empty()
