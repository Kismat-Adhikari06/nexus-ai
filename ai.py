import json
import time
import urllib.request
import urllib.error
import warnings

from groq import Groq

from config import Config
from nexu_log import get_logger
from tools.executor import build_tool_prompt, parse_tool_calls

log = get_logger("ai")

_GEMINI_AVAILABLE = False
_GENAI_CLIENT = None
_GENAI_OLD = None
try:
    import google.genai as genai_new
    if Config.GEMINI_API_KEY:
        _GENAI_CLIENT = genai_new.Client(api_key=Config.GEMINI_API_KEY)
        _GEMINI_AVAILABLE = True
        log.info("Using google.genai for Gemini")
    del genai_new
except ImportError:
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", FutureWarning)
        try:
            import google.generativeai as genai_old
            _GENAI_OLD = genai_old
            if Config.GEMINI_API_KEY:
                genai_old.configure(api_key=Config.GEMINI_API_KEY)
                _GEMINI_AVAILABLE = True
                log.info("Using google.generativeai for Gemini")
        except ImportError:
            log.warning("google.genai nor google.generativeai installed — Gemini unavailable")
        except Exception as e:
            log.warning("Gemini init failed: %s", e)
except Exception as e:
    log.warning("Gemini init failed: %s", e)


class Conversation:
    def __init__(self):
        self.history = []

    def add(self, user: str, assistant: str):
        self.history.append((user, assistant))
        if len(self.history) > Config.MAX_HISTORY:
            self.history.pop(0)

    def update_last(self, assistant: str):
        if self.history:
            user, _ = self.history[-1]
            self.history[-1] = (user, assistant)

    def build_messages(self, user_text: str) -> list:
        prompt = Config.SYSTEM_PROMPT.replace("{TOOL_PROMPT}", build_tool_prompt())

        try:
            from memory.store import get_all as get_facts
            from memory.vector import search as search_conversations

            facts = get_facts()
            if facts:
                fact_lines = "\n".join(f"  {k}: {v}" for k, v in facts.items())
                prompt = prompt.replace(
                    "{MEMORY_PROMPT}",
                    f"\n\nFacts I know about the user:\n{fact_lines}",
                )
            else:
                prompt = prompt.replace("{MEMORY_PROMPT}", "")

            past = search_conversations(user_text, n=2)
            if past:
                conv_lines = []
                for c in past:
                    label = "User" if c["role"] == "user" else "You"
                    conv_lines.append(f"{label}: {c['content']}")
                prompt += (
                    "\n\nRelevant past conversations:\n" + "\n".join(conv_lines)
                )
        except Exception as e:
            prompt = prompt.replace("{MEMORY_PROMPT}", "")
            log.warning("Error loading memory context: %s", e)

        messages = [{"role": "system", "content": prompt}]
        for user_msg, assistant_msg in self.history:
            messages.append({"role": "user", "content": user_msg})
            messages.append({"role": "assistant", "content": assistant_msg})
        messages.append({"role": "user", "content": user_text})
        return messages


def _call_groq(messages: list, stream: bool = False):
    last_err = None
    for key in Config.GROQ_KEYS:
        try:
            client = Groq(api_key=key)
            kwargs = {
                "model": Config.GROQ_MODEL,
                "messages": messages,
                "temperature": 0.7,
                "max_tokens": 1024,
                "timeout": Config.AI_TIMEOUT,
            }
            if stream:
                kwargs["stream"] = True
                return client.chat.completions.create(**kwargs)
            completion = client.chat.completions.create(**kwargs)
            return completion.choices[0].message.content
        except Exception as e:
            last_err = e
            log.warning("Groq key %s failed: %s", key[:8], e)
            continue
    raise last_err


def _call_gemini(messages: list) -> str:
    if not _GEMINI_AVAILABLE:
        raise RuntimeError("Gemini not available")
    prompt = "\n".join(f"{m['role']}: {m['content']}" for m in messages)
    if _GENAI_CLIENT is not None:
        response = _GENAI_CLIENT.models.generate_content(
            model=Config.GEMINI_MODEL, contents=prompt,
        )
        return response.text
    if _GENAI_OLD is not None:
        model = _GENAI_OLD.GenerativeModel(Config.GEMINI_MODEL)
        response = model.generate_content(prompt)
        return response.text
    raise RuntimeError("No Gemini library available")


def _call_lm_studio(messages: list) -> str:
    data = json.dumps({
        "model": Config.LM_STUDIO_MODEL or "",
        "messages": messages,
        "temperature": 0.7,
        "max_tokens": 1024,
    }).encode()
    req = urllib.request.Request(
        f"{Config.LM_STUDIO_URL}/chat/completions",
        data=data,
        headers={"Content-Type": "application/json"},
    )
    resp = urllib.request.urlopen(req, timeout=Config.AI_TIMEOUT)
    result = json.loads(resp.read())
    return result["choices"][0]["message"]["content"]


def _call_openrouter(messages: list) -> str:
    data = json.dumps({
        "model": Config.OPENROUTER_MODEL,
        "messages": messages,
        "temperature": 0.7,
        "max_tokens": 1024,
    }).encode()
    req = urllib.request.Request(
        "https://openrouter.ai/api/v1/chat/completions",
        data=data,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {Config.OPENROUTER_API_KEY}",
            "HTTP-Referer": "https://github.com/nexu",
            "X-Title": "Nexu",
        },
    )
    resp = urllib.request.urlopen(req, timeout=Config.AI_TIMEOUT)
    result = json.loads(resp.read())
    return result["choices"][0]["message"]["content"]


providers = {
    "groq": _call_groq,
    "gemini": _call_gemini,
    "openrouter": _call_openrouter,
    "lm_studio": _call_lm_studio,
}


def _call_with_fallback(messages: list, provider_name: str | None = None) -> str:
    if provider_name is None:
        provider_name = Config.AI_PROVIDER

    ordered = [provider_name]
    for fallback in ("openrouter", "groq", "gemini", "lm_studio"):
        if fallback not in ordered:
            ordered.append(fallback)

    last_err = None
    for name in ordered:
        fn = providers.get(name)
        if fn is None:
            continue
        if name == "gemini" and not _GEMINI_AVAILABLE:
            log.debug("Skipping Gemini — not available")
            continue
        if name == "groq" and not Config.GROQ_KEYS:
            log.debug("Skipping Groq — no API keys")
            continue
        if name == "openrouter" and not Config.OPENROUTER_API_KEY:
            log.debug("Skipping OpenRouter — no API key")
            continue
        for attempt in range(2):
            try:
                log.info("Calling AI provider: %s (attempt %d)", name, attempt + 1)
                return fn(messages)
            except urllib.error.HTTPError as e:
                if e.code == 429 and attempt == 0:
                    log.warning("%s rate limited, waiting 5s...", name)
                    time.sleep(5)
                    continue
                last_err = e
                log.warning("%s HTTP error: %s", name, e)
                break
            except Exception as e:
                last_err = e
                log.warning("%s failed: %s", name, e)
                break
    raise last_err


def ask(user_text: str, conversation: Conversation | None = None) -> tuple[str, list]:
    if conversation is None:
        conversation = Conversation()
    messages = conversation.build_messages(user_text)
    try:
        raw = _call_with_fallback(messages)
    except Exception as e:
        log.error("All AI providers failed: %s", e)
        return "Sorry, I couldn't reach any AI provider right now.", []
    parts = raw.split("---TOOL---")
    text = parts[0].strip()
    tool_calls = parse_tool_calls(raw)
    conversation.add(user_text, text)
    return text, tool_calls


def ask_stream(user_text: str, conversation: Conversation | None = None):
    if conversation is None:
        conversation = Conversation()
    messages = conversation.build_messages(user_text)

    full_text = ""
    streamed = False

    if Config.AI_PROVIDER == "groq" and Config.GROQ_KEYS:
        for key in Config.GROQ_KEYS:
            try:
                client = Groq(api_key=key)
                stream = client.chat.completions.create(
                    model=Config.GROQ_MODEL,
                    messages=messages,
                    temperature=0.7,
                    max_tokens=1024,
                    timeout=Config.AI_TIMEOUT,
                    stream=True,
                )
                for chunk in stream:
                    token = chunk.choices[0].delta.content or ""
                    full_text += token
                    yield ("token", token)
                streamed = True
                log.info("Groq streaming complete")
                break
            except Exception as e:
                log.warning("Groq stream failed with key %s: %s", key[:8], e)
                continue

    if not streamed:
        log.info("Falling back to non-streaming AI call")
        raw = _call_with_fallback(messages)
        full_text = raw
        yield ("token", raw)

    text = full_text.split("---TOOL---")[0].strip()
    tool_calls = parse_tool_calls(full_text)
    conversation.add(user_text, text)
    yield ("done", text, tool_calls)


def refine_with_tools(results: list, conversation: Conversation) -> str:
    if not results:
        return ""
    return ". ".join(str(r) for r in results)
