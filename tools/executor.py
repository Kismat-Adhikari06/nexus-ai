import json

from config import Config
from nexu_log import get_logger

log = get_logger("executor")

_lazy_tools = {}


def _import_tools():
    global _lazy_tools
    if _lazy_tools:
        return
    from tools import browser, browser_automation, extra, files, memory, system, whatsapp
    _lazy_tools.update(
        browser=browser,
        browser_automation=browser_automation,
        extra=extra,
        files=files,
        memory=memory,
        system=system,
        whatsapp=whatsapp,
    )


def _t(name: str):
    _import_tools()
    return _lazy_tools.get(name)


REGISTRY = {
    "launch_app": ("tools.system.launch_app", "Launch an application or open a website", {"name": "app name (chrome, notepad, calculator, cmd, terminal, whatsapp, etc.)", "admin": "set to true to run as admin (optional)"}),
    "get_battery": ("tools.system.get_battery", "Check battery percentage and charging status", {}),
    "get_cpu": ("tools.system.get_cpu", "Check CPU usage percentage", {}),
    "get_ram": ("tools.system.get_ram", "Check RAM usage", {}),
    "set_volume": ("tools.system.set_volume", "Set system volume 0-100", {"level": "volume level 0-100"}),
    "notify": ("tools.system.notify", "Send a desktop notification", {"title": "notification title", "message": "notification body"}),
    "run_command": ("tools.system.run_command", "Run a shell command", {"command": "command to execute"}),
    "open_file": ("tools.files.open_file", "Open a file with its default app", {"path": "file path"}),
    "open_in_vscode": ("tools.files.open_in_vscode", "Open a file or folder in VS Code", {"path": "path to file or folder"}),
    "search_files": ("tools.files.search_files", "Search for files by name in a specific folder", {"query": "filename to search", "location": "directory to search (optional)"}),
    "find_file": ("tools.files.find_file", "Search for a file across Desktop, Documents, and Home", {"filename": "exact filename or part of it to search for"}),
    "get_file_info": ("tools.files.get_file_info", "Get file size and info", {"path": "file path"}),
    "list_directory": ("tools.files.list_directory", "List contents of a directory", {"path": "directory path (optional)"}),
    "open_url": ("tools.browser.open_url", "Open a URL in the default browser", {"url": "URL to open"}),
    "search_web": ("tools.browser.search_web", "Search Google from the browser", {"query": "search query"}),
    "remember": ("tools.memory.remember", "Save a fact about the user", {"key": "fact name", "value": "fact value"}),
    "recall": ("tools.memory.recall", "Retrieve a saved fact", {"key": "fact name to recall"}),
    "list_facts": ("tools.memory.list_facts", "List all saved facts", {}),
    "forget": ("tools.memory.forget", "Delete a saved fact", {"key": "fact name to delete"}),
    "search_memory": ("tools.memory.search_memory", "Search past conversations", {"query": "what to search for"}),
    "browser_navigate": ("tools.browser_automation.navigate_sync", "Go to a URL and return all page content", {"url": "full URL to visit"}),
    "browser_click": ("tools.browser_automation.click_sync", "Click an element on the page by its visible text", {"text": "exact visible text of the button/link to click"}),
    "browser_act": ("tools.browser_automation.act_sync", "Automatically navigate a page to find information", {"goal": "what the user wants to find", "url": "starting URL (optional)"}),
    "send_whatsapp": ("tools.whatsapp.send_message", "Send a WhatsApp message to a saved contact", {"contact_name": "contact name exactly as saved", "message": "message text to send"}),
    "send_whatsapp_number": ("tools.whatsapp.send_message_by_number", "Send a WhatsApp message to a phone number", {"phone_number": "phone number with country code", "message": "message text to send"}),
    "read_whatsapp": ("tools.whatsapp.read_recent_messages", "Read your most recent WhatsApp messages", {"limit": "number of messages to read (optional)"}),
    "list_whatsapp_contacts": ("tools.whatsapp.list_contacts", "Search your WhatsApp contacts", {"query": "search term (optional)"}),
    "clipboard_read": ("tools.extra.clipboard_read", "Read current clipboard content", {}),
    "clipboard_copy": ("tools.extra.clipboard_copy", "Copy text to clipboard", {"text": "text to copy"}),
    "screenshot": ("tools.extra.screenshot", "Take a screenshot and save it", {}),
    "read_pdf": ("tools.extra.read_pdf", "Read text from a PDF file", {"path": "path to PDF file"}),
    "play_youtube": ("tools.extra.play_youtube", "Search and play a song/video on YouTube", {"query": "song name or search query"}),
}


def build_tool_prompt() -> str:
    lines = [
        "Available tools (only use for file/system/browser/action requests — NEVER for chit-chat):",
    ]
    for name, (_, desc, params) in REGISTRY.items():
        if params:
            keys = ", ".join(f'"{k}": ...' for k in params)
            lines.append(f"  {name} — {desc}")
            lines.append(f'    {{"action": "{name}", {keys}}}')
        else:
            lines.append(f"  {name} — {desc}")
            lines.append(f'    {{"action": "{name}"}}')
    lines.append("")
    lines.append("Respond naturally, then add ---TOOL--- followed by the JSON on a new line.")
    lines.append("Use forward slashes for paths (C:/Users/...).")
    lines.append("For greetings just reply naturally — no tools.")
    lines.append('"play X by Y" = play_youtube(query="X by Y") — do this for any music request.')
    return "\n".join(lines)


def parse_tool_calls(text: str) -> list:
    calls = []
    for part in text.split("---TOOL---")[1:]:
        part = part.strip()
        if part.startswith("{"):
            try:
                calls.append(json.loads(part))
            except json.JSONDecodeError:
                continue
    return calls


def execute(action: str, **kwargs) -> str:
    entry = REGISTRY.get(action)
    if entry is None:
        log.warning("Unknown tool: %s", action)
        return f"Unknown tool: {action}"

    module_path, func_name = entry[0].rsplit(".", 1)
    try:
        tool_name = module_path.split(".")[1]
        mod = _t(tool_name)
        if mod is None:
            import importlib
            mod = importlib.import_module(module_path)
        fn = getattr(mod, func_name)
    except (ImportError, AttributeError) as e:
        log.error("Failed to load tool %s: %s", action, e)
        return f"Failed to load tool {action}: {e}"

    try:
        log.info("Executing tool: %s %s", action, kwargs)
        return fn(**kwargs)
    except Exception as e:
        log.error("Tool %s failed: %s", action, e)
        return f"I couldn't do that — {e}. Does the file/resource still exist?"
