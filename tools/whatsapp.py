import os
import re
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

from config import Config
from nexu_log import get_logger

log = get_logger("whatsapp")

_STATE_DIR = Path.home() / ".nexu" / "whatsapp_state"
_STATE_FILE = _STATE_DIR / "storage_state.json"
_BROWSER = None
_CONTEXT = None
_PAGE = None

WHATSAPP_URL = "https://web.whatsapp.com"
QR_WAIT_TIMEOUT = 120000
ELEMENT_TIMEOUT = 30000
ACTION_TIMEOUT = 15000
INIT_TIMEOUT = 60000

_BROWSER_MAP = {
    "chrome": "chrome",
    "msedge": "msedge",
    "edge": "msedge",
    "microsoft edge": "msedge",
    "firefox": "firefox",
    "ff": "firefox",
    "chromium": None,
}


def _resolve_browser(name: str) -> tuple[str | None, str]:
    name = name.lower().strip()
    channel = _BROWSER_MAP.get(name)
    if channel is not None:
        engine = "chromium"
    elif name == "firefox":
        engine = "firefox"
        channel = None
    else:
        engine = "chromium"
        channel = name
    return channel, engine


def _ensure_browser(browser: str | None = None):
    global _BROWSER, _CONTEXT, _PAGE

    raw_name = (browser or Config.WHATSAPP_BROWSER).lower()
    channel, engine = _resolve_browser(raw_name)
    log.info("Launching browser: engine=%s, channel=%s", engine, channel)

    if _PAGE is not None:
        try:
            cur_engine = getattr(_BROWSER, '_nexu_engine', None)
            cur_channel = getattr(_BROWSER, '_nexu_channel', None)
            if cur_engine != engine or cur_channel != channel:
                log.info("Browser switch: %s/%s -> %s/%s", cur_engine, cur_channel, engine, channel)
                close()
            else:
                _PAGE.evaluate("1")
                return _PAGE
        except Exception:
            close()

    _STATE_DIR.mkdir(parents=True, exist_ok=True)
    p = sync_playwright().start()

    def _try_launch(hl: bool) -> bool:
        global _BROWSER
        for eng, ch in [(engine, channel), (engine, None)]:
            try:
                if eng == "firefox":
                    _BROWSER = p.firefox.launch(headless=hl, args=["--no-sandbox"])
                else:
                    kw = {"headless": hl, "args": ["--no-sandbox"]}
                    if ch:
                        kw["channel"] = ch
                    _BROWSER = p.chromium.launch(**kw)
                _BROWSER._nexu_channel = ch
                _BROWSER._nexu_engine = eng
                return True
            except Exception as e:
                log.error("Failed to launch %s/%s: %s", eng, ch, e)
                continue
        return False

    qr_needed = True
    if _STATE_FILE.exists():
        if _try_launch(hl=True):
            _CONTEXT = _BROWSER.new_context(
                storage_state=str(_STATE_FILE),
                viewport={"width": 1280, "height": 720},
            )
            _PAGE = _CONTEXT.new_page()
            _PAGE.goto(WHATSAPP_URL, wait_until="domcontentloaded", timeout=INIT_TIMEOUT)
            _PAGE.wait_for_timeout(3000)
            if not _PAGE.evaluate("!!document.querySelector('canvas')"):
                log.info("Session restored from %s", _STATE_FILE)
                qr_needed = False
            else:
                log.info("Session expired, re-launching for QR...")
                close()

    if qr_needed:
        log.info("Opening WhatsApp for QR scan")
        if not _try_launch(hl=False):
            raise RuntimeError("Could not launch any browser for WhatsApp")
        _CONTEXT = _BROWSER.new_context(
            viewport={"width": 1280, "height": 720},
        )
        _PAGE = _CONTEXT.new_page()
        _PAGE.goto(WHATSAPP_URL, wait_until="domcontentloaded", timeout=INIT_TIMEOUT)
        log.info("Waiting for QR scan...")
        try:
            _PAGE.wait_for_selector("canvas", timeout=30000)
            _PAGE.wait_for_function(
                "!document.querySelector('canvas')",
                timeout=QR_WAIT_TIMEOUT,
            )
            log.info("QR scanned! Saving session...")
        except Exception:
            log.warning("QR scan timed out")
            _PAGE.wait_for_timeout(3000)
        _CONTEXT.storage_state(path=str(_STATE_FILE))
        log.info("Session saved to %s", _STATE_FILE)

    try:
        _PAGE.wait_for_selector(
            "div[data-testid='chat-list'], div[aria-label='Chat list']",
            timeout=30000,
        )
        log.info("WhatsApp Web loaded")
    except Exception:
        log.warning("Chat list not detected")

    return _PAGE


def send_message(contact_name: str, message: str, browser: str | None = None) -> str:
    try:
        page = _ensure_browser(browser)

        search_box = page.locator("div[contenteditable='true'][data-testid='chat-list-search']")
        if search_box.count() == 0:
            search_box = page.locator("div[contenteditable='true']").first

        search_box.click()
        search_box.fill("")
        search_box.type(contact_name, delay=50)
        page.wait_for_timeout(1000)

        contact_item = page.locator(f"div[data-testid='chat-list'] div[aria-label*='{contact_name}']").first
        if contact_item.count() == 0:
            contact_item = page.locator(f"span[title='{contact_name}']").first
        if contact_item.count() == 0:
            contact_item = page.locator(f"div[role='row']:has-text('{contact_name}')").first

        if contact_item.count() == 0:
            return f"Contact '{contact_name}' not found."

        contact_item.click()
        page.wait_for_timeout(1000)

        message_box = page.locator("div[contenteditable='true'][data-testid='conversation-compose-box-input']")
        if message_box.count() == 0:
            message_box = page.locator("div[contenteditable='true']").last

        message_box.click()
        message_box.type(message, delay=30)
        page.wait_for_timeout(300)

        send_button = page.locator("button[data-testid='compose-btn-send']")
        if send_button.count() > 0:
            send_button.click()
        else:
            message_box.press("Enter")

        page.wait_for_timeout(1000)
        log.info("Message sent to %s", contact_name)
        return f"Message sent to {contact_name}"
    except Exception as e:
        log.error("Failed to send WhatsApp message: %s", e)
        return f"Failed to send WhatsApp message: {e}"


def send_message_by_number(phone_number: str, message: str, browser: str | None = None) -> str:
    try:
        digits = re.sub(r"\D", "", phone_number)
        if not digits:
            return "Invalid phone number"

        url = f"https://web.whatsapp.com/send?phone={digits}"
        page = _ensure_browser(browser)
        page.goto(url, wait_until="domcontentloaded", timeout=INIT_TIMEOUT)
        page.wait_for_timeout(3000)

        message_box = page.locator("div[contenteditable='true'][data-testid='conversation-compose-box-input']")
        if message_box.count() == 0:
            message_box = page.locator("div[contenteditable='true']").last

        message_box.click()
        message_box.type(message, delay=30)
        page.wait_for_timeout(300)

        send_button = page.locator("button[data-testid='compose-btn-send']")
        if send_button.count() > 0:
            send_button.click()
        else:
            message_box.press("Enter")

        page.wait_for_timeout(1000)
        return f"Message sent to {phone_number}"
    except Exception as e:
        log.error("Failed to send WhatsApp message: %s", e)
        return f"Failed to send WhatsApp message: {e}"


def read_recent_messages(limit: int = 5, browser: str | None = None) -> str:
    try:
        page = _ensure_browser(browser)
        page.wait_for_timeout(2000)

        chats = page.locator("div[data-testid='chat-list'] div[role='row']")
        count = chats.count()
        if count == 0:
            return "No chats found"

        results = []
        for i in range(min(count, limit)):
            try:
                aria = chats.nth(i).get_attribute("aria-label") or ""
                name = aria.split(",")[0].strip() if aria else "Unknown"
                preview = chats.nth(i).inner_text()
                lines = preview.split("\n")
                preview_text = lines[1] if len(lines) > 1 else preview[:100]
                results.append(f"{name}: {preview_text}")
            except Exception:
                continue

        if results:
            return "Recent messages:\n" + "\n".join(results)
        return "No messages found"
    except Exception as e:
        log.error("Failed to read messages: %s", e)
        return f"Failed to read messages: {e}"


def list_contacts(query: str = "", browser: str | None = None) -> str:
    try:
        page = _ensure_browser(browser)

        if query:
            search_box = page.locator("div[contenteditable='true'][data-testid='chat-list-search']")
            if search_box.count() == 0:
                search_box = page.locator("div[contenteditable='true']").first
            search_box.click()
            search_box.fill("")
            search_box.type(query, delay=30)
            page.wait_for_timeout(1500)

        chats = page.locator("div[data-testid='chat-list'] div[role='row']")
        count = chats.count()
        if count == 0:
            return "No contacts found"

        names = []
        for i in range(min(count, 15)):
            try:
                aria = chats.nth(i).get_attribute("aria-label") or ""
                name = aria.split(",")[0].strip() if aria else ""
                if name:
                    names.append(name)
            except Exception:
                continue

        if names:
            return "Contacts:\n" + "\n".join(names)
        return "No contacts found"
    except Exception as e:
        log.error("Failed to list contacts: %s", e)
        return f"Failed to list contacts: {e}"


def close():
    global _BROWSER, _CONTEXT, _PAGE
    try:
        if _CONTEXT:
            _CONTEXT.storage_state(path=str(_STATE_FILE))
        if _BROWSER:
            _BROWSER.close()
    except Exception:
        pass
    _PAGE = None
    _CONTEXT = None
    _BROWSER = None
