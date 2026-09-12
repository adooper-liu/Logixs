from __future__ import annotations

from fastapi import FastAPI, HTTPException

from .capabilities import CAPABILITIES, Capability, EchoRequest, EchoResponse

app = FastAPI(title="Logix AI Service", version="0.1.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "ai-service"}


@app.get("/capabilities", response_model=list[Capability])
def list_capabilities() -> list[Capability]:
    return [
        Capability(name=name, version=cfg["version"], description=cfg["description"])
        for name, cfg in CAPABILITIES.items()
    ]


@app.post("/capabilities/echo", response_model=EchoResponse)
def echo(request: EchoRequest) -> EchoResponse:
    capability = CAPABILITIES.get("echo")
    if capability is None:
        raise HTTPException(status_code=404, detail="capability not found")
    return capability["handler"](request)
