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
