from app.capabilities import (
    CAPABILITIES,
    EchoRequest,
    SuggestMappingRequest,
    echo_handler,
    suggest_mapping_handler,
)


def test_echo_handler():
    response = echo_handler(EchoRequest(message="hello"))
    assert response.message == "hello"
    assert response.echoedAt


def test_registry_has_echo():
    assert "echo" in CAPABILITIES
    assert CAPABILITIES["echo"]["version"] == "0.1.0"


def test_suggest_mapping_known_columns():
    response = suggest_mapping_handler(
        SuggestMappingRequest(columns=["箱号", "备货单号", "物流状态"]),
    )
    by_column = {s.column: s for s in response.suggestions}
    assert by_column["箱号"].fieldCode == "containerNumber"
    assert by_column["备货单号"].fieldCode == "orderNumber"
    assert by_column["物流状态"].fieldCode == "logisticsStatusText"


def test_suggest_mapping_unknown_column():
    response = suggest_mapping_handler(SuggestMappingRequest(columns=["备注"]))
    assert response.suggestions[0].fieldCode is None
    assert response.suggestions[0].confidence == 0.0


def test_registry_has_suggest_mapping():
    assert "suggest_import_mapping" in CAPABILITIES
