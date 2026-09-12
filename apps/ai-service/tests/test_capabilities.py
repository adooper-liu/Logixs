from app.capabilities import CAPABILITIES, EchoRequest, echo_handler


def test_echo_handler():
    response = echo_handler(EchoRequest(message="hello"))
    assert response.message == "hello"
    assert response.echoedAt


def test_registry_has_echo():
    assert "echo" in CAPABILITIES
    assert CAPABILITIES["echo"]["version"] == "0.1.0"
