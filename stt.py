import os
import tempfile
import threading
import wave

import pyaudio
from groq import Groq

from config import Config

_stop_flag = threading.Event()


def stop_recording():
    _stop_flag.set()


def _level_bar(amplitude: int) -> str:
    bars = 20
    max_amp = 5000
    filled = min(bars, int(amplitude / max_amp * bars))
    return "█" * filled + "░" * (bars - filled)


def record_audio() -> str | None:
    audio = pyaudio.PyAudio()
    stream = audio.open(
        format=pyaudio.paInt16,
        channels=Config.MIC_CHANNELS,
        rate=Config.MIC_SAMPLE_RATE,
        input=True,
        frames_per_buffer=Config.MIC_CHUNK,
        input_device_index=Config.MIC_DEVICE_INDEX,
    )

    frames = []
    silent_chunks = 0
    silence_threshold = int(Config.SILENCE_SECONDS * Config.MIC_SAMPLE_RATE / Config.MIC_CHUNK)
    max_chunks = int(Config.MAX_RECORD_SECONDS * Config.MIC_SAMPLE_RATE / Config.MIC_CHUNK)

    for i in range(max_chunks):
        if _stop_flag.is_set():
            break

        data = stream.read(Config.MIC_CHUNK, exception_on_overflow=False)
        frames.append(data)

        amplitude = max(abs(int.from_bytes(data[i:i+2], "little", signed=True))
                        for i in range(0, len(data), 2))

        if amplitude < 100:
            silent_chunks += 1
        else:
            silent_chunks = 0

        if silent_chunks >= silence_threshold and len(frames) > 30:
            break

        if i % 3 == 0:
            print(f"\r[stt] Mic level: {_level_bar(amplitude)}", end="", flush=True)

    print()

    stream.stop_stream()
    stream.close()
    audio.terminate()

    if not frames:
        return None

    tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    tmp_path = tmp.name
    tmp.close()
    with wave.open(tmp_path, "wb") as wf:
        wf.setnchannels(Config.MIC_CHANNELS)
        wf.setsampwidth(audio.get_sample_size(pyaudio.paInt16))
        wf.setframerate(Config.MIC_SAMPLE_RATE)
        wf.writeframes(b"".join(frames))

    return tmp_path


def transcribe(audio_path: str) -> str:
    last_err = None
    for key in Config.GROQ_KEYS:
        try:
            client = Groq(api_key=key)
            with open(audio_path, "rb") as f:
                text = client.audio.transcriptions.create(
                    file=(os.path.basename(audio_path), f),
                    model="whisper-large-v3-turbo",
                    response_format="text",
                )
            os.unlink(audio_path)
            return text.strip()
        except Exception as e:
            last_err = e
            continue
    os.unlink(audio_path)
    raise last_err


def reset_stop():
    _stop_flag.clear()


def preload_model():
    pass


def speech_to_text() -> str | None:
    audio_path = record_audio()
    if audio_path is None:
        return None
    return transcribe(audio_path)
