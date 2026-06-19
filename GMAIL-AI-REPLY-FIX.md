# Gmail AI Reply Fix

## The Problem

The AI reply generation for Gmail had two bugs:

### 1. AI impersonated the email sender instead of the user

When replying to an email (e.g., a Twitch notification), the AI was writing the reply from the **original sender's** perspective instead of from **the user's** perspective. So instead of writing as the user replying to Twitch, it wrote as "Twitch Support" replying to the user.

**Cause:** The prompt sent to the AI just said "Write a reply to this email" without specifying who the AI is supposed to be. The AI would sometimes assume it was the original sender writing back.

**Fix:** Updated the prompt to explicitly state:
- "You are replying to this email as the person who received it"
- "Do NOT impersonate the company, service, or person who sent the original email"

### 2. Subject line appeared in the reply body

The AI was including `Subject: ...` text in the reply body, even though the subject is already in its own separate field in the compose form.

**Cause:** The prompt included the subject in the context but didn't tell the AI not to repeat it in the output.

**Fix:** Added explicit instructions:
- "Do NOT include a subject line — it will be added separately"
- "Do NOT start with 'Subject:' or include any subject text in your reply"

## File Changed

**`server/index.js`** — Updated the prompt string in the `/api/gmail/generate-reply` endpoint (around line 508).

### Old Prompt

```
Write a professional, helpful reply to this email. Be concise and natural.

Only return the reply text — no explanations, no opening lines like "Here's your reply:".

Email to reply to:
---
[email content]
---
```

### New Prompt

```
You are replying to this email as the person who received it. Write the reply
from YOUR perspective — you are the recipient writing back, NOT the original sender.

Rules:
- Do NOT impersonate the company, service, or person who sent the original email
- Do NOT include a subject line — it will be added separately
- Do NOT start with "Subject:" or include any subject text in your reply
- Just return the plain body text of your reply, nothing else
- Be natural and concise

Email you are replying to:
---
[email content]
---
```

## How to Test

1. Open the Gmail tab in Nexu
2. Select any email
3. Click "Reply" to open the compose form
4. Click the "AI Reply" (sparkles) button
5. Verify:
   - The generated reply is written from **your** perspective, not the sender's
   - There is no `Subject:` line in the message body
   - It's just the plain reply text
