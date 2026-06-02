import json
import time
import urllib.request

import google.generativeai as genai
from groq import Groq

from config import Config
from tools.executor import build_tool_prompt, parse_tool_calls


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
            print(f"[memory] Error loading context: {e}")

        messages = [{"role": "system", "content": prompt}]
        for user_msg, assistant_msg in self.history:
            messages.append({"role": "user", "content": user_msg})
            messages.append({"role": "assistant", "content": assistant_msg})
        messages.append({"role": "user", "content": user_text})
        return messages


def _call_groq(messages: list) -> str:
    last_err = None
    for key in Config.GROQ_KEYS:
        try:
            client = Groq(api_key=key)
            completion = client.chat.completions.create(
                model=Config.GROQ_MODEL,
                messages=messages,
                temperature=0.7,
                max_tokens=1024,
                timeout=Config.AI_TIMEOUT,
            )
            return completion.choices[0].message.content
        except Exception as e:
            last_err = e
            print(f"[groq] Key failed, trying next: {e}")
            continue
    raise last_err


def _call_gemini(messages: list) -> str:
    genai.configure(api_key=Config.GEMINI_API_KEY)
    model = genai.GenerativeModel(Config.GEMINI_MODEL)
    prompt = "\n".join(
        f"{m['role']}: {m['content']}" for m in messages
    )
    response = model.generate_content(prompt)
    return response.text


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


def ask(user_text: str, conversation: Conversation | None = None) -> tuple[str, list]:
    if conversation is None:
        conversation = Conversation()
    messages = conversation.build_messages(user_text)
    try:
        raw = _call_with_fallback(messages)
    except Exception as e:
        print(f"[ai] All AI providers failed: {e}")
        return "Sorry, I couldn't reach any AI provider right now.", []
    parts = raw.split("---TOOL---")
    text = parts[0].strip()
    tool_calls = parse_tool_calls(raw)
    conversation.add(user_text, text)
    return text, tool_calls


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
        for attempt in range(2):
            try:
                return fn(messages)
            except urllib.error.HTTPError as e:
                if e.code == 429 and attempt == 0:
                    print(f"[ai] {name} rate limited, waiting 5s and retrying...")
                    time.sleep(5)
                    continue
                last_err = e
                print(f"[ai] {name} failed: {e}")
                break
            except Exception as e:
                last_err = e
                print(f"[ai] {name} failed: {e}")
                break
    raise last_err


def ask_stream(user_text: str, conversation: Conversation | None = None):
    """Generator that yields ('token', str) for each token, then ('done', text, tool_calls).

    Use like:
        for msg in ask_stream(user_text, conv):
            if msg[0] == 'token':
                token = msg[1]
                ...
            elif msg[0] == 'done':
                _, text, tool_calls = msg
    """
    if conversation is None:
        conversation = Conversation()
    messages = conversation.build_messages(user_text)

    full_text = ""
    streamed = False

    # Try Groq streaming first
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
                break
            except Exception as e:
                print(f"[groq] Stream failed with key {key[:8]}...: {e}")
                continue

    if not streamed:
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
