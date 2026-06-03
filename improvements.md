# Future Improvements

## 1. Wake Word — OpenWakeWord (DONE)
Replaced slow Groq-API-based wake word with `openwakeword`. Runs fully offline in ~100ms.
- Supports arbitrary phrases without an API key
- Default: "nexu" — no signup needed
- Uses ONNX runtime for fast inference

## 2. Local STT via faster-whisper
Every voice command currently goes through Groq's Whisper API (needs internet, adds latency).
- `faster-whisper` is already in `requirements.txt` but unused
- Run the `tiny` or `base` model locally for simple commands
- Fall back to Groq API only when local confidence is low

## 3. Offline TTS via Windows SAPI
`edge-tts` needs internet. Windows has `SAPI.SpVoice` built-in — zero dependencies, instant, offline.
- Quality is worse than edge-tts but fine for quick confirmations
- Use as primary for short responses, edge-tts for longer ones

## 4. Command Caching
Ask "what's my battery" twice → hits the AI both times.
- Cache deterministic tool results (battery, CPU, RAM, time) for ~30s
- Bypass AI entirely for cached commands — instant response

## 5. System Prompt Bloat (DONE)
Every new tool pads the system prompt. With 30+ tools the model spends more tokens reading instructions than thinking.
- Trimmed tool descriptions to essential format only
- Can further optimize by grouping tools by category

## 6. Smarter Memory via AI Summarization
FTS5 is keyword-only — "my favorite color is blue" won't match "what color do I like".
- Use the AI itself to summarize conversations into real semantic embeddings
- Store summaries as facts instead of raw transcripts
