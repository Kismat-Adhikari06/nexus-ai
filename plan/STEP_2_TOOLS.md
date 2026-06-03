# Phase 2: Computer Control Tools

## Goal
Make the AI able to do things on your laptop — not just talk.

## Concept
The AI doesn't directly execute code. It returns structured tool calls in its response:
```json
{
  "action": "open_file",
  "path": "C:\\Users\\kisma\\Desktop\\project\\main.py"
}
```

The Python tool executor parses this and runs the actual command.

## Tools to Build

### `tools/files.py`
- `open_file(path)` — opens in default editor
- `open_in_vscode(path)` — opens in VS Code
- `search_files(query)` — searches file names and content
- `get_file_info(path)` — size, type, modified date
- `list_directory(path)` — lists folder contents

### `tools/browser.py`
- `open_url(url)` — opens in default browser
- `search_web(query)` — opens Google/DuckDuckGo search
- `check_portal(url, credentials)` — log into uni portal (stretch goal)

### `tools/system.py`
- `launch_app(name)` — starts any installed app
- `run_command(cmd)` — runs a shell command
- `get_system_info()` — battery, CPU, RAM usage
- `set_volume(level)` — adjust system volume
- `notify(title, message)` — sends Windows notification

## How the Loop Changes

```
User: "Open my project in VS Code"
    → STT → AI → AI responds: "Opening now!"
    → AI also returns: { "action": "open_in_vscode", "path": "..." }
    → Tool executor runs it
    → TTS: "Opening now!"
```

## Security Considerations
- Only execute actions explicitly in the tool schema
- No arbitrary code execution
- Confirm destructive actions (delete, shutdown)
- Path allowlisting or user confirmation for sensitive ops

## Test Criteria
- [ ] "Open Notepad" → Notepad launches
- [ ] "Search for invoices" → file explorer opens with results
- [ ] "Open chrome and go to youtube" → Chrome opens to YouTube
- [ ] "What's my battery at?" → responds with percentage
