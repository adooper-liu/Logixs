from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Callable

from pydantic import BaseModel, Field


class EchoRequest(BaseModel):
    message: str = Field(min_length=1, max_length=1000)


class EchoResponse(BaseModel):
    message: str
    echoedAt: str


class Capability(BaseModel):
    name: str
    version: str
    description: str


# 能力注册表：AI 业务能力按版本登记（ADR-006：能力版本化、可观测、可审计）。
# 骨架阶段只有 echo；真实能力（映射/抽取/RAG/解释）在 P6/P7 按契约补充。
CAPABILITIES: dict[str, dict[str, Any]] = {}


def register(
    name: str,
    version: str,
    description: str,
    handler: Callable[..., Any],
) -> None:
    if name in CAPABILITIES:
        raise ValueError(f"capability already registered: {name}")
    CAPABILITIES[name] = {
        "version": version,
        "description": description,
        "handler": handler,
    }


def echo_handler(request: EchoRequest) -> EchoResponse:
    # 骨架：无真实模型调用，仅回显。真实能力须经 LiteLLM Proxy（ADR-006），
    # 且默认不调付费模型（P4-09 mock）。
    return EchoResponse(
        message=request.message,
        echoedAt=datetime.now(timezone.utc).isoformat(),
    )


register("echo", "0.1.0", "回显能力（骨架验证通路，不调模型）", echo_handler)


class SuggestMappingRequest(BaseModel):
    columns: list[str] = Field(min_length=1, max_length=100)


class MappingSuggestion(BaseModel):
    column: str
    fieldCode: str | None  # None = 未识别，待人工
    confidence: float  # 0~1


class SuggestMappingResponse(BaseModel):
    suggestions: list[MappingSuggestion]


# 列头 → 标准字段 的关键词规则（Mock，不调模型；真实模型 P7 替换）。
# 规则按优先级排序，命中即 confidence 0.9，未命中 fieldCode=None / 0.0。
_KEYWORD_RULES: list[tuple[str, tuple[str, ...]]] = [
    ("containerNumber", ("箱号", "柜号", "container")),
    ("containerTypeCode", ("箱型", "柜型", "container type")),
    ("orderNumber", ("备货单", "备货", "order")),
    ("portOfLoadingCode", ("起运港", "装货港", "pol")),
    ("portOfDischargeCode", ("目的港", "卸货港", "pod")),
    ("shippingCompanyCode", ("船司", "船公司", "carrier")),
    ("vesselName", ("船名", "vessel")),
    ("voyageNumber", ("航次", "voyage")),
    ("logisticsStatusText", ("物流状态", "状态")),
    ("shipmentDate", ("出运日期", "etd", "发运")),
    ("grossWeight", ("毛重", "gross")),
    ("netWeight", ("净重", "net")),
]


def suggest_mapping_handler(
    request: SuggestMappingRequest,
) -> SuggestMappingResponse:
    suggestions = []
    for column in request.columns:
        lowered = column.lower()
        field_code = None
        confidence = 0.0
        for code, keywords in _KEYWORD_RULES:
            if any(keyword.lower() in lowered for keyword in keywords):
                field_code = code
                confidence = 0.9
                break
        suggestions.append(
            MappingSuggestion(
                column=column,
                fieldCode=field_code,
                confidence=confidence,
            ),
        )
    return SuggestMappingResponse(suggestions=suggestions)


register(
    "suggest_import_mapping",
    "0.1.0",
    "列头→标准字段映射建议（Mock 关键词规则，不调模型）",
    suggest_mapping_handler,
)
