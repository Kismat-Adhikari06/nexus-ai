import os
import struct
import threading
import time

import pyaudio

from config import Config
from nexu_log import get_logger

log = get_logger("wake")


class WakeWordDetector:
    def __init__(self, callback, keyword="nexu"):
        self.callback = callback
        self.keyword = keyword.lower()
        self._running = False
        self._thread = None
        self._last_phrases = []

    def start(self):
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(target=self._listen_loop, daemon=True)
        self._thread.start()
        log.info("Wake word detector started (keyword: '%s')", self.keyword)

    def stop(self):
        self._running = False

    def is_running(self):
        return self._running

    def _listen_loop(self):
        try:
            audio = pyaudio.PyAudio()
            stream = audio.open(
                format=pyaudio.paInt16,
                channels=Config.MIC_CHANNELS,
                rate=16000,
                input=True,
                frames_per_buffer=1024,
                input_device_index=Config.MIC_DEVICE_INDEX,
            )
        except Exception as e:
            log.warning("Wake word mic failed: %s", e)
            return

        try:
            while self._running:
                data = stream.read(1024, exception_on_overflow=False)
                amplitude = self._get_amplitude(data)
                if amplitude > 2000:
                    phrase = self._record_phrase(stream, audio)
                    if phrase and self.keyword in phrase.lower():
                        log.info("Wake word detected!")
                        self.callback()
        except Exception as e:
            log.warning("Wake word listener error: %s", e)
        finally:
            stream.stop_stream()
            stream.close()
            audio.terminate()

    def _get_amplitude(self, data):
        count = len(data) // 2
        if count == 0:
            return 0
        total = 0
        for i in range(count):
            sample = struct.unpack_from("<h", data, i * 2)[0]
            total += abs(sample)
        return total / count

    def _record_phrase(self, stream, audio):
        import io
        import wave

        frames = []
        silent = 0
        max_silent = int(1.5 * 16000 / 1024)
        max_frames = int(3 * 16000 / 1024)

        for _ in range(max_frames):
            data = stream.read(1024, exception_on_overflow=False)
            frames.append(data)
            amp = self._get_amplitude(data)
            if amp < 500:
                silent += 1
            else:
                silent = 0
            if silent >= max_silent and len(frames) > 10:
                break

        buf = io.BytesIO()
        with wave.open(buf, "wb") as wf:
            wf.setnchannels(Config.MIC_CHANNELS)
            wf.setsampwidth(audio.get_sample_size(pyaudio.paInt16))
            wf.setframerate(16000)
            wf.writeframes(b"".join(frames))
        buf.seek(0)

        try:
            from groq import Groq
            client = Groq(api_key=Config.GROQ_KEYS[0])
            transcript = client.audio.transcriptions.create(
                file=("wake.wav", buf),
                model="whisper-large-v3-turbo",
                response_format="text",
            )
            return transcript.strip()
        except Exception as e:
            log.debug("Wake word transcription failed: %s", e)
            return ""
