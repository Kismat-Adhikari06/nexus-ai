import subprocess
import urllib.parse

from nexu_log import get_logger

log = get_logger("browser")


def open_url(url: str) -> str:
    try:
        if not url.startswith("http"):
            url = "https://" + url
        subprocess.Popen(["cmd", "/c", "start", url], shell=True)
        log.info("Opened URL: %s", url)
        return f"Opened {url}"
    except Exception as e:
        log.error("Failed to open URL: %s", e)
        return f"Failed: {e}"


def search_web(query: str) -> str:
    try:
        encoded = urllib.parse.quote(query)
        url = f"https://www.google.com/search?q={encoded}"
        subprocess.Popen(["cmd", "/c", "start", url], shell=True)
        return f"Searched Google for: {query}"
    except Exception as e:
        log.error("Failed to search web: %s", e)
        return f"Failed: {e}"
