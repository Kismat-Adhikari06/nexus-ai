import sys
from ai import Conversation, ask, refine_with_tools
from memory.vector import add as save_conversation
from tools.executor import execute

def main():
    if len(sys.argv) < 2:
        print("Usage: python nexu-cli.py <your command>")
        print("Example: python nexu-cli.py open my calendar")
        sys.exit(1)

    text = " ".join(sys.argv[1:])
    conversation = Conversation()

    print(f"  You: {text}\n")
    response, tool_calls = ask(text, conversation)

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
