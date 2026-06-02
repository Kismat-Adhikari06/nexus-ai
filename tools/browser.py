import subprocess
import urllib.parse


def open_url(url: str) -> str:
    try:
        if not url.startswith("http"):
            url = "https://" + url
        subprocess.Popen(["cmd", "/c", "start", url], shell=True)
        return f"Opened {url}"
    except Exception as e:
        return f"Failed: {e}"


def search_web(query: str) -> str:
    try:
        encoded = urllib.parse.quote(query)
        url = f"https://www.google.com/search?q={encoded}"
        subprocess.Popen(["cmd", "/c", "start", url], shell=True)
        return f"Searched Google for: {query}"
    except Exception as e:
        return f"Failed: {e}"
