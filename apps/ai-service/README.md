# Logix AI 能力服务（apps/ai-service）

ADR-005 的 Python AI 边界：FastAPI 独立实现 AI 业务能力，经 LiteLLM Proxy 调模型；不直接写生产业务表。

## 运行

```bash
cd apps/ai-service
uv sync                # 安装依赖（含 dev extra 需 --extra dev）
uv run uvicorn app.main:app --host 127.0.0.1 --port 8001
```

> 端口 8001：本机 8000 已被其他服务占用（旧系统）。

## 端点（骨架）

- `GET /health` — 存活检查
- `GET /capabilities` — 能力注册表（当前仅 `echo`）
- `POST /capabilities/echo` — 回显（骨架验证通路，不调模型）

## 测试

```bash
uv run --extra dev pytest
```

## 说明

- 能力按版本登记（ADR-006：能力版本化、可观测、可审计）；真实能力（映射/抽取/RAG）在 P6/P7 按契约补充。
- 骨架阶段 `echo` 不调模型；真实能力须经 LiteLLM Proxy（ADR-006），默认 mock 不调付费模型（P4-09）。
- 跨语言契约 parity（TS ↔ Python）待阶段 P3-13 的 datamodel-code-generator 生成补齐。
