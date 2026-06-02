# Phase 4: WhatsApp Integration

## Goal
Send and receive WhatsApp messages through the assistant, hands-free.

## Approach
We'll use **Playwright** to automate web.whatsapp.com. This is more reliable than third-party APIs and doesn't require Meta approval.

## How It Works
1. First-time setup: Scan QR code once (session saved)
2. Subsequent runs: Reuse saved session (no QR needed)
3. AI constructs message → Playwright finds contact → sends

## What We'll Build

### `tools/whatsapp.py`
- `send_message(contact_name, message)` — sends to any saved contact
- `send_message_by_number(phone_number, message)` — sends to unsaved number
- `read_recent_messages(limit=5)` — reads latest messages (stretch goal)
- `list_contacts(query)` — search contacts (stretch goal)

## Integration With AI
```
User: "Send mom a message saying I'll be late"
    → AI remembers mom's contact from memory
    → AI crafts message
    → Tool call: send_message("Mom", "I'll be late tonight")
    → TTS: "Sent! Saying you'll be late."
```

## Important Notes
- WhatsApp Web must stay logged in (session persistence)
- First run requires QR scan
- Keep WhatsApp Web open in background (headless mode with visible browser or persistent context)
- Playwright session save/restore

## Dependencies
```
pip install playwright
playwright install chromium
```

## Test Criteria
- [ ] Can send message to saved contact by name
- [ ] Can send message to unsaved number
- [ ] Session persists across restarts
- [ ] Sends confirmation to user
- [ ] Handles errors gracefully (contact not found, offline)
