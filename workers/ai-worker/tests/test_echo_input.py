import pytest
from echo_input import parse_echo_ai_input


def test_parses_message_object() -> None:
    assert parse_echo_ai_input({"message": "hello"}) == "hello"


def test_rejects_bare_string() -> None:
    with pytest.raises(TypeError, match="必须是对象"):
        parse_echo_ai_input("hello")


def test_rejects_missing_message() -> None:
    with pytest.raises(ValueError, match="message 必填"):
        parse_echo_ai_input({})


def test_rejects_blank_message() -> None:
    with pytest.raises(ValueError, match="message 必填"):
        parse_echo_ai_input({"message": "  "})
