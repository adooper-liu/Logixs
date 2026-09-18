from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Callable, Literal

from pydantic import BaseModel, Field

from app.generated_import_field_catalog import IMPORT_FIELD_ALIAS_RULES


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


def suggest_mapping_handler(
    request: SuggestMappingRequest,
) -> SuggestMappingResponse:
    suggestions = []
    for column in request.columns:
        lowered = column.lower()
        field_code = None
        confidence = 0.0
        for code, aliases in IMPORT_FIELD_ALIAS_RULES:
            if lowered in (alias.lower() for alias in aliases):
                field_code = code
                confidence = 0.9
                break
        if field_code is not None:
            suggestions.append(
                MappingSuggestion(
                    column=column,
                    fieldCode=field_code,
                    confidence=confidence,
                ),
            )
            continue
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


class AssistantObjectSummary(BaseModel):
    containerId: str
    orderNumber: str
    containerNumber: str | None
    currentStatus: str
    currentNodeCode: str | None
    flowState: str | None
    updatedAt: str


class AssistantAllowedAction(BaseModel):
    actionCode: Literal[
        "work_execution.claim_work_order",
        "work_execution.complete_work_order",
    ]
    explanation: str
    containerId: str
    taskId: str
    workOrderId: str
    nodeCode: str
    assigneeId: str | None
    dueAt: str | None
    actorCanExecute: bool
    targetPath: str


class AssistantReadOnlyPolicy(BaseModel):
    assistantCanExecute: Literal[False]
    actorCanExecuteActions: bool
    explanation: str


class AssistantObjectContext(BaseModel):
    summary: AssistantObjectSummary
    allowedActions: list[AssistantAllowedAction]
    actionSummary: str
    readOnlyPolicy: AssistantReadOnlyPolicy


class OpsQuestionHistoryMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    body: str


class OpsQuestionRequest(BaseModel):
    question: str = Field(min_length=1, max_length=4000)
    notificationContext: str | None = Field(default=None, max_length=10000)
    objectContext: AssistantObjectContext | None
    history: list[OpsQuestionHistoryMessage] = Field(max_length=100)


class OpsQuestionResponse(BaseModel):
    answer: str


def answer_ops_question_handler(request: OpsQuestionRequest) -> OpsQuestionResponse:
    lines = ["这是只读运营摘要。"]
    if request.notificationContext:
        lines.append(f"相关问题：{request.notificationContext}")
    if request.objectContext:
        context = request.objectContext
        display_number = context.summary.containerNumber or "未绑定箱号"
        lines.extend(
            [
                f"货柜：{display_number}（备货单 {context.summary.orderNumber}）",
                f"当前状态：{context.summary.currentStatus}",
                f"下一动作：{context.actionSummary}",
            ],
        )
        lines.extend(f"- {action.explanation}" for action in context.allowedActions)
        lines.append(context.readOnlyPolicy.explanation)
    lines.extend(
        [
            f"你的问题：{request.question}",
            "助手不能领取、提交或改变业务状态。",
        ],
    )
    return OpsQuestionResponse(answer="\n".join(lines))


register(
    "answer_ops_question",
    "0.1.0",
    "对象上下文只读问答（确定性基线，不调模型）",
    answer_ops_question_handler,
)
