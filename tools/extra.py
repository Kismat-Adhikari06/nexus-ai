import os
import subprocess
import tempfile
import urllib.parse

from nexu_log import get_logger

log = get_logger("extra")


def clipboard_read() -> str:
    try:
        import pyperclip
        text = pyperclip.paste()
        if text:
            return text[:500]
        return "Clipboard is empty"
    except ImportError:
        log.warning("pyperclip not installed, using PowerShell fallback")
    except Exception as e:
        log.warning("pyperclip failed: %s", e)

    try:
        result = subprocess.run(
            ["powershell", "-command", "Get-Clipboard"],
            capture_output=True, text=True, timeout=5,
        )
        text = result.stdout.strip()
        return text[:500] if text else "Clipboard is empty"
    except Exception as e:
        return f"Failed to read clipboard: {e}"


def clipboard_copy(text: str) -> str:
    try:
        import pyperclip
        pyperclip.copy(text)
        return "Copied to clipboard"
    except ImportError:
        log.warning("pyperclip not installed, using PowerShell fallback")
    except Exception as e:
        log.warning("pyperclip failed: %s", e)

    try:
        escaped = text.replace("'", "''")
        subprocess.run(
            ["powershell", "-command", f"Set-Clipboard -Value '{escaped}'"],
            timeout=5,
        )
        return "Copied to clipboard"
    except Exception as e:
        return f"Failed to copy: {e}"


def screenshot() -> str:
    try:
        import pyautogui
        save_dir = os.path.join(str(os.path.expanduser("~")), ".nexu", "screenshots")
        os.makedirs(save_dir, exist_ok=True)
        import time
        path = os.path.join(save_dir, f"screenshot_{int(time.time())}.png")
        pyautogui.screenshot(path)
        log.info("Screenshot saved: %s", path)
        return f"Screenshot saved to {path}"
    except ImportError:
        log.warning("pyautogui not installed")
        return "Screenshot tool requires pyautogui (pip install pyautogui)"
    except Exception as e:
        log.error("Screenshot failed: %s", e)
        return f"Screenshot failed: {e}"


def read_pdf(path: str) -> str:
    try:
        import PyPDF2
    except ImportError:
        try:
            import pdfplumber as PyPDF2
        except ImportError:
            return "PDF reader requires PyPDF2 or pdfplumber (pip install PyPDF2)"

    full = _resolve_path(path)
    if not os.path.exists(full):
        return f"Could not find: {path}"

    try:
        text_parts = []
        with open(full, "rb") as f:
            reader = PyPDF2.PdfReader(f)
            for page in reader.pages:
                text = page.extract_text()
                if text:
                    text_parts.append(text)
        result = "\n".join(text_parts)
        if not result.strip():
            return "No text could be extracted from this PDF (scanned document?)"
        return result[:2000]
    except Exception as e:
        log.error("Failed to read PDF: %s", e)
        return f"Failed to read PDF: {e}"


def play_youtube(query: str) -> str:
    from playwright.sync_api import sync_playwright

    log.info("YouTube search: %s", query)

    try:
        p = sync_playwright().start()
        browser = p.chromium.launch(headless=True, args=["--no-sandbox"])
        page = browser.new_page()
        search_url = f"https://www.youtube.com/results?search_query={urllib.parse.quote(query)}"
        page.goto(search_url, wait_until="domcontentloaded", timeout=30000)
        page.wait_for_timeout(3000)

        first_video = page.locator("a#video-title").first
        if first_video.count() == 0:
            first_video = page.locator("a[href*='/watch']").first
        if first_video.count() == 0:
            browser.close()
            p.stop()
            return f"No results found for '{query}' on YouTube"

        title = (first_video.get_attribute("title") or first_video.inner_text()).strip()
        href = first_video.get_attribute("href") or ""
        watch_url = f"https://www.youtube.com{href}" if href.startswith("/") else href

        browser.close()
        p.stop()

        subprocess.Popen(["cmd", "/c", "start", watch_url], shell=True)
        log.info("Opened YouTube video: %s — %s", title, watch_url)
        return f"Playing '{title}' on YouTube"
    except Exception as e:
        log.error("YouTube playback failed: %s", e)
        return f"Failed to play on YouTube: {e}"


def _resolve_path(path: str) -> str:
    expanded = os.path.expanduser(path.replace("\\", "/"))
    if os.path.exists(expanded):
        return expanded
    for parent in [
        str(os.path.expanduser("~")),
        str(os.path.expanduser("~") + "/Desktop"),
        str(os.path.expanduser("~") + "/Documents"),
    ]:
        candidate = os.path.join(parent, expanded)
        if os.path.exists(candidate):
            return candidate
    return expanded
