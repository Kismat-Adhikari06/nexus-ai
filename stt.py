import os
import tempfile
import threading
import wave

import pyaudio
from groq import Groq

from config import Config
from nexu_log import get_logger

log = get_logger("stt")

_stop_flag = threading.Event()
_audio_save_dir = os.path.join(str(os.path.expanduser("~")), ".nexu", "debug_audio")
_whisper_model = None


def stop_recording():
    _stop_flag.set()


def _level_bar(amplitude: int) -> str:
    bars = 20
    max_amp = 5000
    filled = min(bars, int(amplitude / max_amp * bars))
    return "█" * filled + "░" * (bars - filled)


def record_audio() -> str | None:
    try:
        audio = pyaudio.PyAudio()
    except Exception as e:
        log.error("Failed to initialize PyAudio (mic unavailable): %s", e)
        return None

    stream = None
    frames = []
    silent_chunks = 0
    silence_threshold = int(Config.SILENCE_SECONDS * Config.MIC_SAMPLE_RATE / Config.MIC_CHUNK)
    max_chunks = int(Config.MAX_RECORD_SECONDS * Config.MIC_SAMPLE_RATE / Config.MIC_CHUNK)

    try:
        stream = audio.open(
            format=pyaudio.paInt16,
            channels=Config.MIC_CHANNELS,
            rate=Config.MIC_SAMPLE_RATE,
            input=True,
            frames_per_buffer=Config.MIC_CHUNK,
            input_device_index=Config.MIC_DEVICE_INDEX,
        )
    except Exception as e:
        log.error("Could not open audio stream: %s", e)
        audio.terminate()
        return None

    try:
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
                log.debug("Mic level: %s", _level_bar(amplitude))
    except Exception as e:
        log.error("Error during recording: %s", e)
        return None
    finally:
        if stream:
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

    _save_debug_audio(tmp_path, frames)
    return tmp_path


def _save_debug_audio(original_path: str, frames: list[bytes]):
    if not os.environ.get("NEXU_DEBUG_AUDIO"):
        return
    os.makedirs(_audio_save_dir, exist_ok=True)
    import time
    debug_path = os.path.join(_audio_save_dir, f"recording_{int(time.time())}.wav")
    try:
        with wave.open(debug_path, "wb") as wf:
            wf.setnchannels(Config.MIC_CHANNELS)
            wf.setsampwidth(pyaudio.PyAudio().get_sample_size(pyaudio.paInt16))
            wf.setframerate(Config.MIC_SAMPLE_RATE)
            wf.writeframes(b"".join(frames))
        log.info("Saved debug audio: %s", debug_path)
    except Exception as e:
        log.warning("Failed to save debug audio: %s", e)


def preload_model():
    global _whisper_model
    try:
        from faster_whisper import WhisperModel
        _whisper_model = WhisperModel(
            Config.WHISPER_MODEL_SIZE,
            device=Config.WHISPER_DEVICE,
            compute_type=Config.WHISPER_COMPUTE_TYPE,
        )
        log.info("Local whisper model loaded (%s, %s, %s)",
                 Config.WHISPER_MODEL_SIZE, Config.WHISPER_DEVICE, Config.WHISPER_COMPUTE_TYPE)
    except Exception as e:
        log.warning("Failed to load local whisper model: %s — will use Groq API", e)


def _transcribe_local(audio_path: str) -> tuple[str | None, float]:
    if _whisper_model is None:
        return None, 0.0
    try:
        segments, info = _whisper_model.transcribe(audio_path, beam_size=1)
        text = " ".join(seg.text.strip() for seg in segments).strip()
        avg_prob = info.average_log_prob if hasattr(info, 'average_log_prob') else -10
        confidence = 2 ** avg_prob if avg_prob > -10 else 0
        return text, confidence
    except Exception as e:
        log.warning("Local transcription failed: %s", e)
        return None, 0.0


def _transcribe_groq(audio_path: str) -> str | None:
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
            return text.strip()
        except Exception as e:
            last_err = e
            log.warning("Groq transcription failed with key %s: %s", key[:8], e)
            continue
    raise last_err


def transcribe(audio_path: str) -> str:
    text, confidence = _transcribe_local(audio_path)

    if text and confidence > 0.3:
        log.info("Local STT (conf=%.2f): %s", confidence, text)
        os.unlink(audio_path)
        return text

    log.info("Local STT confidence low (%.2f), falling back to Groq API", confidence)
    try:
        text = _transcribe_groq(audio_path)
        os.unlink(audio_path)
        return text
    except Exception as e:
        try:
            os.unlink(audio_path)
        except OSError:
            pass
        if text:
            log.warning("Groq failed, using low-confidence local result: %s", e)
            return text
        raise


def reset_stop():
    _stop_flag.clear()


def speech_to_text() -> str | None:
    audio_path = record_audio()
    if audio_path is None:
        return None
    return transcribe(audio_path)
