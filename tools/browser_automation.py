import asyncio
import threading
import warnings

from config import Config
from nexu_log import get_logger

log = get_logger("browser_auto")

_GEMINI_AVAILABLE = False
_GENAI_CLIENT = None
_GENAI_OLD = None
try:
    import google.genai as genai_new
    if Config.GEMINI_API_KEY:
        _GENAI_CLIENT = genai_new.Client(api_key=Config.GEMINI_API_KEY)
        _GEMINI_AVAILABLE = True
        log.info("Browser auto: using google.genai")
    del genai_new
except ImportError:
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", FutureWarning)
        try:
            import google.generativeai as genai_old
            _GENAI_OLD = genai_old
            if Config.GEMINI_API_KEY:
                genai_old.configure(api_key=Config.GEMINI_API_KEY)
                _GEMINI_AVAILABLE = True
                log.info("Browser auto: using google.generativeai")
        except ImportError:
            log.warning("google.genai nor google.generativeai installed — browser auto unavailable")
        except Exception as e:
            log.warning("Gemini init failed for browser auto: %s", e)
except Exception as e:
    log.warning("Gemini init failed for browser auto: %s", e)

MAX_STEPS = 10
_BROWSER = None
_CONTEXT = None
_PAGE = None
_LOCK = threading.Lock()


def _init_gemini():
    if not _GEMINI_AVAILABLE:
        raise RuntimeError("Gemini not available for browser automation")


def _ask_gemini_prompt(prompt: str) -> str:
    if _GENAI_CLIENT is not None:
        response = _GENAI_CLIENT.models.generate_content(
            model=Config.GEMINI_MODEL, contents=prompt,
        )
        return response.text.strip()
    if _GENAI_OLD is not None:
        model = _GENAI_OLD.GenerativeModel(Config.GEMINI_MODEL)
        response = model.generate_content(prompt)
        return response.text.strip()
    return "STOP: No Gemini library available"


_BROWSER_PROMPT = (
    "You are a browser automation assistant. You look at the current page "
    "and decide the next action to achieve the user's goal.\n\n"
    "Rules:\n"
    "- Login detection: If a login form (password field) is visible, respond LOGIN_DETECTED.\n"
    "- Never guess or hallucinate elements. Only use text you see.\n"
    "- Prefer clicking links over buttons when both exist.\n"
    "- When you find what the user asked for, respond DONE with a clear summary.\n"
    "- If you can't find what the user wants, respond STOP with the reason.\n\n"
    "Current page elements:\n"
    "{dom}\n\n"
    "Goal: {goal}\n\n"
    "Respond with EXACTLY one of:\n"
    'CLICK: <exact visible text of element to click>\n'
    'DONE: <summary of what was found>\n'
    'STOP: <reason>\n'
    'LOGIN_DETECTED: Please log in to your portal first, then try again.'
)


async def _ensure_browser():
    from playwright.async_api import async_playwright

    global _BROWSER, _CONTEXT, _PAGE
    if _PAGE is not None:
        try:
            await _PAGE.evaluate("1")
            return _PAGE
        except Exception:
            pass

    _init_gemini()

    if _BROWSER is not None:
        try:
            await _BROWSER.close()
        except Exception:
            pass

    p = await async_playwright().start()
    _BROWSER = await p.chromium.launch(headless=True)
    _CONTEXT = await _BROWSER.new_context(
        viewport={"width": 1920, "height": 1080},
        user_agent=(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        ),
    )
    _PAGE = await _CONTEXT.new_page()
    return _PAGE


async def _extract_dom(page) -> dict:
    result = await page.evaluate("""
        () => {
            const items = [];

            document.querySelectorAll('a').forEach(el => {
                const text = el.innerText.trim();
                if (text) items.push({type: 'link', text, href: el.href});
            });

            document.querySelectorAll('button').forEach(el => {
                const text = el.innerText.trim();
                if (text) items.push({type: 'button', text});
            });

            document.querySelectorAll('input').forEach(el => {
                const t = el.type || 'text';
                const n = el.name || el.placeholder || el.id || '';
                if (n || t === 'password') items.push({type: 'input', input_type: t, name: n});
            });

            document.querySelectorAll('[role="button"]').forEach(el => {
                const text = el.innerText.trim();
                if (text) items.push({type: 'button', text});
            });

            document.querySelectorAll('select').forEach(el => {
                const n = el.name || el.id || '';
                if (n) items.push({type: 'select', name: n});
            });

            const bodyText = (document.body.innerText || '').trim().substring(0, 3000);
            const hasPassword = !!document.querySelector('input[type="password"]');
            const title = document.title || '';

            return {elements: items, bodyText, hasPassword, title};
        }
    """)
    return result


def _format_dom(dom: dict) -> str:
    lines = [f"Page title: {dom['title']}"]
    for el in dom["elements"]:
        if el["type"] == "link":
            text = el["text"].replace("\n", " ")
            lines.append(f'[LINK] "{text}" -> {el["href"]}')
        elif el["type"] == "button":
            text = el["text"].replace("\n", " ")
            lines.append(f'[BUTTON] "{text}"')
        elif el["type"] == "input":
            lines.append(f'[INPUT] {el["name"]} (type={el["input_type"]})')
        elif el["type"] == "select":
            lines.append(f'[SELECT] {el["name"]}')
    if dom["hasPassword"]:
        lines.append("[!] PASSWORD FIELD DETECTED")
    lines.append("")
    lines.append("Page text content:")
    body = dom["bodyText"][:1500]
    lines.append(body)
    return "\n".join(lines)


async def navigate(url: str) -> str:
    page = await _ensure_browser()
    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_timeout(2000)
        dom = await _extract_dom(page)
        formatted = _format_dom(dom)
        if dom["hasPassword"]:
            return "LOGIN_DETECTED: This page has a login form. Please log in first.\n\n" + formatted
        return formatted
    except Exception as e:
        log.error("Error navigating to %s: %s", url, e)
        return f"Error navigating to {url}: {e}"


async def click(text: str) -> str:
    page = await _ensure_browser()
    try:
        locator = page.get_by_text(text, exact=False).first
        if await locator.count() == 0:
            locator = page.locator(f"button:has-text('{text}')").first
        if await locator.count() == 0:
            locator = page.locator(f"a:has-text('{text}')").first
        await locator.wait_for(timeout=5000)
        await locator.click()
        await page.wait_for_timeout(2000)
        dom = await _extract_dom(page)
        formatted = _format_dom(dom)
        if dom["hasPassword"]:
            return "LOGIN_DETECTED: " + formatted
        return formatted
    except Exception as e:
        log.error("Error clicking '%s': %s", text, e)
        return f"Error clicking '{text}': {e}"


async def _ask_gemini(dom_str: str, goal: str) -> str:
    if not _GEMINI_AVAILABLE:
        return "STOP: Gemini not available"
    prompt = _BROWSER_PROMPT.format(dom=dom_str, goal=goal)
    try:
        return _ask_gemini_prompt(prompt)
    except Exception as e:
        log.error("Gemini request failed: %s", e)
        return f"STOP: Gemini error: {e}"


async def _try_auto_login(page) -> bool:
    try:
        from memory.store import get as get_fact
        username = get_fact("uni_username")
        password = get_fact("uni_password")
        if not username or not password:
            return False

        await page.fill("input[type='text'], input[name='username'], input[name='email'], input[placeholder*='user' i], input[placeholder*='email' i]", username)
        await page.fill("input[type='password']", password)
        await page.click("button[type='submit'], input[type='submit'], button:has-text('Sign In'), button:has-text('Login'), button:has-text('Log in')")
        await page.wait_for_timeout(3000)
        log.info("Auto-login attempted")
        return True
    except Exception as e:
        log.warning("Auto-login failed: %s", e)
        return False


async def act(goal: str, url: str | None = None) -> str:
    page = await _ensure_browser()

    if url:
        result = await navigate(url)
        if result.startswith("LOGIN_DETECTED"):
            auto = await _try_auto_login(page)
            if auto:
                dom = await _extract_dom(page)
                if not dom["hasPassword"]:
                    result = _format_dom(dom)
                else:
                    return "LOGIN_DETECTED: Auto-login failed. Save credentials with:\n  python nexu-cli.py remember uni_username your_username\n  python nexu-cli.py remember uni_password your_password"
            else:
                return "LOGIN_DETECTED: Please log in. To enable auto-login, save credentials:\n  python nexu-cli.py remember uni_username your_username\n  python nexu-cli.py remember uni_password your_password"
        if result.startswith("Error"):
            return result
        dom_str = result
    else:
        try:
            dom = await _extract_dom(page)
            dom_str = _format_dom(dom)
            if dom["hasPassword"]:
                return "LOGIN_DETECTED: This page has a login form. Please log in first."
        except Exception as e:
            return f"Error: {e}"

    for step in range(MAX_STEPS):
        decision = await _ask_gemini(dom_str, goal)
        log.debug("Step %d: %s", step + 1, decision)

        if decision.startswith("DONE:"):
            return decision[5:].strip()
        if decision.startswith("STOP:"):
            return decision[5:].strip()
        if decision.startswith("LOGIN_DETECTED"):
            return decision
        if decision.startswith("CLICK:"):
            text_to_click = decision[6:].strip().strip('"').strip("'")
            if not text_to_click:
                return f"STOP: Empty CLICK at step {step + 1}"
            result = await click(text_to_click)
            if result.startswith("LOGIN_DETECTED"):
                return result
            if result.startswith("Error"):
                return f"STOP: {result}"
            dom_str = result
            continue
        return f"STOP: Unexpected AI response: {decision}"

    return "STOP: Reached maximum steps without completing."


def navigate_sync(url: str) -> str:
    return asyncio.run(navigate(url))


def click_sync(text: str) -> str:
    return asyncio.run(click(text))


def act_sync(goal: str, url: str | None = None) -> str:
    return asyncio.run(act(goal, url))
