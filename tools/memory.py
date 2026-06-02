from memory.store import save, get, get_all, delete
from memory.vector import add as add_conversation, search, get_recent


def remember(key: str, value: str) -> str:
    save(key, value)
    return f"Remembered: {key} = {value}"


def recall(key: str) -> str:
    val = get(key)
    if val is None:
        return f"I don't have anything saved for '{key}'"
    return val


def list_facts() -> str:
    facts = get_all()
    if not facts:
        return "No saved facts yet."
    return "\n".join(f"{k}: {v}" for k, v in facts.items())


def forget(key: str) -> str:
    delete(key)
    return f"Forgot '{key}'"


def search_memory(query: str) -> str:
    results = search(query, n=3)
    if not results:
        return f"No past conversations found matching '{query}'."
    lines = [f"[{r['created_at']}] {r['role']}: {r['content'][:200]}" for r in results]
    return "\n".join(lines)
