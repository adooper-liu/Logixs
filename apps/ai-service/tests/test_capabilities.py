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
        SuggestMappingRequest(
            columns=["箱号", "备货单号", "货号.产品货号", "出运数量", "出运数量单位"],
        ),
    )
    by_column = {s.column: s for s in response.suggestions}
    assert by_column["箱号"].fieldCode == "containerNumber"
    assert by_column["备货单号"].fieldCode == "orderNumber"
    assert by_column["货号.产品货号"].fieldCode == "productNumber"
    assert by_column["出运数量"].fieldCode == "shippedQuantity"
    assert by_column["出运数量单位"].fieldCode == "quantityUnit"


def test_suggest_mapping_time_provenance_columns():
    response = suggest_mapping_handler(
        SuggestMappingRequest(
            columns=["实际清关日期", "清关状态", "卸空日期", "来源UTC偏移"],
        ),
    )
    by_column = {s.column: s for s in response.suggestions}
    assert by_column["实际清关日期"].fieldCode == "customsClearanceActualAt"
    assert by_column["清关状态"].fieldCode == "customsClearanceStatus"
    assert by_column["卸空日期"].fieldCode == "emptyEstimatedAt"
    assert by_column["来源UTC偏移"].fieldCode == "timeSourceUtcOffset"


def test_suggest_mapping_unknown_column():
    response = suggest_mapping_handler(
        SuggestMappingRequest(
            columns=[
                "备注",
                "备货单备注",
                "备货单状态",
                "FOB单价(备货)",
                "FOB单价$(备货)",
            ],
        ),
    )
    assert all(suggestion.fieldCode is None for suggestion in response.suggestions)
    assert all(suggestion.confidence == 0.0 for suggestion in response.suggestions)


def test_registry_has_suggest_mapping():
    assert "suggest_import_mapping" in CAPABILITIES
