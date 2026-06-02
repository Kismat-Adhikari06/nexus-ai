import json
import re

from config import Config
from tools import browser, browser_automation, files, memory, system, whatsapp

REGISTRY = {
    "launch_app": (system.launch_app, "Launch an application or open a website (use name='whatsapp' to open WhatsApp Web)", {"name": "app name (chrome, notepad, calculator, cmd, terminal, whatsapp, etc.)", "admin": "set to true to run as admin (optional)"}),
    "get_battery": (system.get_battery, "Check battery percentage and charging status", {}),
    "get_cpu": (system.get_cpu, "Check CPU usage percentage", {}),
    "get_ram": (system.get_ram, "Check RAM usage", {}),
    "set_volume": (system.set_volume, "Set system volume 0-100", {"level": "volume level 0-100"}),
    "notify": (system.notify, "Send a desktop notification", {"title": "notification title", "message": "notification body"}),
    "run_command": (system.run_command, "Run a shell command (ipconfig, dir, etc. — NOT for launching apps)", {"command": "command to execute"}),
    "open_file": (files.open_file, "Open a file with its default app", {"path": "file path"}),
    "open_in_vscode": (files.open_in_vscode, "Open a file or folder in VS Code", {"path": "path to file or folder"}),
    "search_files": (files.search_files, "Search for files by name in a specific folder (default: Desktop)", {"query": "filename to search", "location": "directory to search (optional, default: Desktop)"}),
    "find_file": (files.find_file, "Search for a file across Desktop, Documents, and Home — use when you don't know where the file is", {"filename": "exact filename or part of it to search for"}),
    "get_file_info": (files.get_file_info, "Get file size and info", {"path": "file path"}),
    "list_directory": (files.list_directory, "List contents of a directory (defaults to desktop if no path given)", {"path": "directory path (optional)"}),
    "open_url": (browser.open_url, "Open a URL in the default browser", {"url": "URL to open"}),
    "search_web": (browser.search_web, "Search Google from the browser", {"query": "search query"}),
    "remember": (memory.remember, "Save a fact about the user", {"key": "fact name (e.g. my_name, uni_portal_url)", "value": "fact value"}),
    "recall": (memory.recall, "Retrieve a saved fact", {"key": "fact name to recall"}),
    "list_facts": (memory.list_facts, "List all saved facts", {}),
    "forget": (memory.forget, "Delete a saved fact", {"key": "fact name to delete"}),
    "search_memory": (memory.search_memory, "Search past conversations", {"query": "what to search for"}),
    "browser_navigate": (browser_automation.navigate_sync, "Go to a URL and return all page content (links, buttons, text)", {"url": "full URL to visit"}),
    "browser_click": (browser_automation.click_sync, "Click an element on the page by its visible text", {"text": "exact visible text of the button/link to click"}),
    "browser_act": (browser_automation.act_sync, "Automatically navigate a page to find information. Use this for portals, dashboards, or any page where you need to click multiple things to reach the target.", {"goal": "what the user wants to find (e.g. today's timetable)", "url": "starting URL (optional if already on a page)"}),
    "send_whatsapp": (whatsapp.send_message, "Send a WhatsApp message to a saved contact by name", {"contact_name": "contact name exactly as saved in your phone", "message": "message text to send", "browser": "browser to use (chrome, msedge, firefox) (optional)"}),
    "send_whatsapp_number": (whatsapp.send_message_by_number, "Send a WhatsApp message to a phone number (not saved as contact)", {"phone_number": "phone number with country code (e.g. +919876543210)", "message": "message text to send", "browser": "browser to use (chrome, msedge, firefox) (optional)"}),
    "read_whatsapp": (whatsapp.read_recent_messages, "Read your most recent WhatsApp messages", {"limit": "number of messages to read (optional, default 5)", "browser": "browser to use (chrome, msedge, firefox) (optional)"}),
    "list_whatsapp_contacts": (whatsapp.list_contacts, "Search your WhatsApp contacts", {"query": "search term to filter contacts (optional)", "browser": "browser to use (chrome, msedge, firefox) (optional)"}),
}


def build_tool_prompt() -> str:
    lines = [
        "TOOLS (only use when the user asks for a file/system/browser action):",
    ]
    for name, (_, desc, params) in REGISTRY.items():
        if params:
            param_str = ", ".join(f"{k}: {v}" for k, v in params.items())
            keys = ", ".join(f'"{k}": ...' for k in params)
            lines.append(f"  {name} — {desc}")
            lines.append(f'    JSON: {{"action": "{name}", {keys}}}')
        else:
            lines.append(f"  {name} — {desc}")
            lines.append(f'    JSON: {{"action": "{name}"}}')
    lines.append("")
    lines.append("Format: respond naturally, then on a new line add ---TOOL--- then the JSON.")
    lines.append("Use forward slashes for paths, e.g. C:/Users/name/Desktop.")
    lines.append("CRITICAL: To OPEN an application (e.g. 'open chrome', 'launch notepad'),")
    lines.append("  ALWAYS use the launch_app tool. NEVER use run_command to open apps.")
    lines.append("MEMORY: Use 'remember' when the user says 'remember this'. Use 'recall' when")
    lines.append("  they ask 'what is...' about a fact. Use 'search_memory' for past conversations.")
    lines.append("BROWSER AUTOMATION: Use 'browser_act' when the user wants to CHECK, FIND, or")
    lines.append("  EXTRACT something from a website (timetable, grades, portal info).")
    lines.append("  The goal should be a short description of what the user wants.")
    lines.append("  Only use 'browser_navigate' or 'browser_click' for manual step-by-step control.")
    lines.append("WHATSAPP TOOLS (sending/reading messages):")
    lines.append("  'send_whatsapp' — send a message to a saved contact (ONLY if user gives a contact name + message)")
    lines.append("  'send_whatsapp_number' — send to a number not in contacts")
    lines.append("  'read_whatsapp' — read recent messages")
    lines.append("  These tools open WhatsApp Web internally via Playwright (in background, or visible on first scan).")
    lines.append("  Do NOT call launch_app before them — they handle their own browser.")
    lines.append("  Add 'browser': 'edge' (or 'chrome', 'firefox') to pick which browser opens WhatsApp.")
    lines.append("  Examples:")
    lines.append('    User says "send mom hi" → use send_whatsapp with contact_name="Mom", message="hi"')
    lines.append('    User says "check my whatsapp" → use read_whatsapp')
    lines.append('    User says "open whatsapp and check messages" → use read_whatsapp (NOT launch_app)')
    lines.append("")
    lines.append("LAUNCHING WHATSAPP (just opening the browser tab, not interacting):")
    lines.append("  If user ONLY says 'open whatsapp' or 'launch whatsapp' with NO request to read/send,")
    lines.append("  use launch_app with name='whatsapp'. Do NOT use send_whatsapp.")
    lines.append("FILE SEARCH GUIDANCE:")
    lines.append("  - If the user asks 'find X' or 'where is X', first try 'find_file' (searches Desktop/Documents/Home).")
    lines.append("  - If 'find_file' fails, use 'list_directory' to look inside a specific folder the user mentioned.")
    lines.append("  - Use 'search_files' with a 'location' parameter to narrow the search to a specific folder.")
    lines.append("  - 'search_files' without location only searches the Desktop (fast).")
    lines.append("  - Do NOT say 'I can't find it' immediately — try multiple search approaches first.")
    lines.append("Example for battery:")
    lines.append("  Your battery is at 80%.")
    lines.append("  ---TOOL---")
    lines.append('  {"action": "get_battery"}')
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
        return f"Unknown tool: {action}"
    fn = entry[0]
    try:
        return fn(**kwargs)
    except Exception as e:
        return f"Error executing {action}: {e}"
