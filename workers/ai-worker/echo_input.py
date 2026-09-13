from typing import Mapping, TypedDict


class EchoAiInput(TypedDict):
    message: str


def parse_echo_ai_input(value: object) -> str:
    if not isinstance(value, Mapping):
        raise TypeError("VALIDATION_FORMAT: EchoAiWorkflow 入参必须是对象")
    message = value.get("message")
    if not isinstance(message, str) or not message.strip():
        raise ValueError("VALIDATION_FORMAT: message 必填")
    return message
