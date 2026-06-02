import os
import subprocess
from difflib import SequenceMatcher

from config import Config

_ACCENT_MAP = str.maketrans({
    "b": "v", "v": "b",
    "p": "f", "f": "p",
})


def _score_match(target: str, item: str) -> int:
    return int(SequenceMatcher(None, target, item).ratio() * 100)


def _best_match(target: str, candidates: list[str]) -> str | None:
    t_orig = target.lower()
    t_norm = t_orig.translate(_ACCENT_MAP)
    best = None
    best_score = 1
    for item in candidates:
        i_lower = item.lower()
        score = max(_score_match(t_orig, i_lower), _score_match(t_norm, i_lower))
        if score > best_score:
            best_score = score
            best = item
    return best


def _fuzzy_find(path: str) -> str:
    expanded = os.path.expanduser(path.replace("\\", "/"))
    if os.path.exists(expanded):
        return expanded
    parts = expanded.split("/")
    for i in range(len(parts), 0, -1):
        prefix = "/".join(parts[:i])
        if os.path.isdir(prefix):
            current = prefix
            for j in range(i, len(parts)):
                try:
                    items = os.listdir(current)
                except Exception:
                    break
                match = _best_match(parts[j], items)
                if match:
                    current = os.path.join(current, match)
                else:
                    current = os.path.join(current, parts[j])
            return current
    return expanded


def open_file(path: str) -> str:
    try:
        full = _fuzzy_find(path)
        if not os.path.exists(full):
            return f"Could not find: {path}"
        os.startfile(full)
        return f"Opened {os.path.basename(full)}"
    except Exception as e:
        return f"Failed to open {path}: {e}"


def open_in_vscode(path: str) -> str:
    try:
        full = _fuzzy_find(path)
        if not os.path.exists(full):
            return f"Could not find: {path}"
        subprocess.Popen(["code", full], shell=True)
        return f"Opened {os.path.basename(full)} in VS Code"
    except Exception as e:
        return f"Failed: {e}"


def search_files(query: str, location: str | None = None) -> str:
    try:
        root = os.path.expanduser(location) if location else Config.HOME_DIR
        matches = []
        for dirpath, _, filenames in os.walk(root):
            if len(matches) >= 10:
                break
            for f in filenames:
                if query.lower() in f.lower():
                    matches.append(os.path.join(dirpath, f))
                    if len(matches) >= 10:
                        break
        if matches:
            return "Found:\n" + "\n".join(matches)
        return "No files found"
    except Exception as e:
        return f"Search failed: {e}"


def get_file_info(path: str) -> str:
    try:
        full = _fuzzy_find(path)
        if not os.path.exists(full):
            return f"Could not find: {path}"
        stat = os.stat(full)
        size = stat.st_size
        if size > 1e9:
            size_str = f"{size/1e9:.1f} GB"
        elif size > 1e6:
            size_str = f"{size/1e6:.1f} MB"
        elif size > 1e3:
            size_str = f"{size/1e3:.1f} KB"
        else:
            size_str = f"{size} B"
        return f"{os.path.basename(full)} — {size_str}, modified {os.path.getmtime(full):.0f}"
    except Exception as e:
        return f"Error: {e}"


def list_directory(path: str | None = None) -> str:
    try:
        if path is None:
            path = Config.DESKTOP_DIR
        full = _fuzzy_find(path)
        if not os.path.isdir(full):
            return f"Could not find directory: {path}"
        items = os.listdir(full)
        dirs = []
        files = []
        for item in items:
            if os.path.isdir(os.path.join(full, item)):
                dirs.append(f"📁 {item}")
            else:
                files.append(f"📄 {item}")
        result = dirs[:10] + files[:10]
        return "\n".join(result) if result else "Empty directory"
    except Exception as e:
        return f"Error: {e}"
