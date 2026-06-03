# Phase 3: Memory & Context

## Goal
Make the assistant remember who you are, where your stuff is, and what you were doing.

## Two Memory Systems

### 1. Key-Value Memory (SQLite) — Explicit Facts
For things you tell it once and it should never forget:
```sql
-- Example entries
key: "uni_portal_url"          → value: "https://myuniversity.edu/portal"
key: "projects_folder"         → value: "C:\\Users\\kisma\\Desktop\\projects"
key: "my_name"                 → value: "Kishan"
key: "whatsapp_contact_mom"    → value: "91XXXXXXXXXX"
```

- User can say: "Remember my uni portal is https://..."
- Assistant saves it permanently
- On relevant queries, it pulls the stored value

### 2. Semantic Memory (ChromaDB) — Conversations & Context
For remembering past conversations and retrieving relevant ones:
- Every conversation gets embedded as a vector
- When new query comes in, find similar past conversations
- Inject relevant context into the AI prompt

## Files

### `memory/store.py`
- `save(key, value)` — stores a fact
- `get(key)` — retrieves a fact
- `get_all()` — dump all known facts
- `delete(key)` — remove a fact

### `memory/vector.py`
- `add_conversation(text, metadata)` — store with timestamp
- `search(query, n=3)` — find relevant past convos
- `summarize_recent()` — get today's summary

## How It Works in Practice

```
User: "Hey do you remember the project we were working on?"
    → AI searches memory for "project working on"
    → Finds: "project name: nexu, location: C:\Users\kisma\Desktop\nexuv2"
    → AI: "Yes! The Nexu assistant. Opening it in VS Code now."
    → Tool call: open_in_vscode("C:\Users\kisma\Desktop\nexuv2")

User: "Check my uni portal for new grades"
    → AI retrieves uni_portal_url from memory
    → Opens browser to that URL
```

## Test Criteria
- [ ] "Remember my uni portal is X" → stores it
- [ ] "What's my uni portal?" → recalls it
- [ ] "Remember I was working on project Y" → stores it
- [ ] "Open the project I was working on" → retrieves and opens
- [ ] Memory persists after restart
