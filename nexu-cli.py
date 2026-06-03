import argparse
import sys

from ai import Conversation, ask, refine_with_tools
from memory.vector import add as save_conversation
from nexu_log import setup_logging, get_logger
from tools.executor import execute

log = get_logger("cli")


def _is_planning(text: str) -> bool:
    lower = text.lower()
    return any(p in lower for p in ["i can", "i'll", "i will", "first,", "let me", "i'm going to"])


def main():
    parser = argparse.ArgumentParser(description="Nexu CLI")
    parser.add_argument("command", nargs="*", help="Command to run")
    parser.add_argument("--debug", action="store_true", help="Enable debug logging")
    args = parser.parse_args()

    setup_logging(debug=args.debug)

    if not args.command:
        print("Usage: python nexu-cli.py [--debug] <your command>")
        print("Example: python nexu-cli.py open my calendar")
        sys.exit(1)

    text = " ".join(args.command)
    conversation = Conversation()

    print(f"  You: {text}\n")
    response, tool_calls = ask(text, conversation)

    max_retries = 2
    retries = 0
    while not tool_calls and retries < max_retries and _is_planning(response):
        retries += 1
        log.info("Retry %d: AI planning instead of acting", retries)
        response, tool_calls = ask(
            "Actually, don't describe what you'll do. Just use the appropriate tool directly and do it now — no more planning talk.",
            conversation,
        )

    if tool_calls:
        print(f"  Tools: {tool_calls}")
        results = []
        for call in tool_calls:
            action = call.pop("action")
            result = execute(action, **call)
            print(f"  Result: {result}")
            results.append(result)
        response = refine_with_tools(results, conversation)

    save_conversation("user", text)
    save_conversation("assistant", response)
    print(f"\n Nexu: {response}")


if __name__ == "__main__":
    main()
