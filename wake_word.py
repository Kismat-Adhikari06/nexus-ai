import struct
import threading

import pyaudio

from config import Config
from nexu_log import get_logger

log = get_logger("wake")

_NEAREST_MODEL = {
    "nexu": "hey_jarvis",
    "jarvis": "hey_jarvis",
    "mycroft": "hey_mycroft",
    "rhasspy": "hey_rhasspy",
}


class WakeWordDetector:
    def __init__(self, callback, keyword="hey_jarvis"):
        self.callback = callback
        self.keyword = _NEAREST_MODEL.get(keyword.lower(), keyword.lower())
        self._model = None
        self._audio = None
        self._stream = None
        self._running = False
        self._thread = None

    def start(self):
        if self._running:
            return

        try:
            from openwakeword import Model
            self._model = Model(inference_framework="onnx")
            log.info("OpenWakeWord model loaded (ONNX)")
        except Exception as e:
            log.warning("OpenWakeWord init failed: %s — wake word disabled", e)
            return

        try:
            self._audio = pyaudio.PyAudio()
            self._stream = self._audio.open(
                format=pyaudio.paInt16,
                channels=1,
                rate=16000,
                input=True,
                frames_per_buffer=1280,
                input_device_index=Config.MIC_DEVICE_INDEX,
            )
        except Exception as e:
            log.warning("Wake word mic failed: %s", e)
            self._model = None
            return

        self._running = True
        self._thread = threading.Thread(target=self._listen, daemon=True)
        self._thread.start()
        log.info("Wake word active (listening for '%s')", self.keyword)

    def stop(self):
        self._running = False
        if self._stream:
            self._stream.stop_stream()
            self._stream.close()
        if self._audio:
            self._audio.terminate()
        self._model = None
        log.info("Wake word stopped")

    def is_running(self):
        return self._running and self._model is not None

    def _listen(self):
        try:
            while self._running:
                data = self._stream.read(1280, exception_on_overflow=False)
                pcm = struct.unpack_from("h" * 640, data)
                prediction = self._model.predict(pcm)

                for model_name, score in prediction.items():
                    if score > 0.5:
                        log.info("Wake word '%s' detected (score=%.2f)", model_name, score)
                        self.callback()
        except Exception as e:
            log.warning("Wake word listener error: %s", e)
        finally:
            self.stop()
