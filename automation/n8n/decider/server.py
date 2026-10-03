"""Jev-compatible decision server for CPU.

decider.serve loads full-precision torch weights (about 8 GB for the 2B on CPU), so this
wrapper serves the quantized GGUF files through decider.infer.Decider instead.

  POST /v1/systemone  {state, questions}  -> TypeSafe wire format ({answers: ...})
  POST /decide        {context, questions} -> plain form
  GET  /healthz
"""
import os
import threading
import time

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from decider.infer import Decider

REPO = os.environ.get("DECIDER_REPO", "Mapika/decider-4b-GGUF")
GGUF = os.environ.get("DECIDER_GGUF", "decider-4b-v2.1-Q4_K_M.gguf")
OPTIONS = {
    "n_ctx": int(os.environ.get("DECIDER_CTX", "8192")),
    "n_threads": int(os.environ.get("DECIDER_THREADS", "4")),
    "n_gpu_layers": 0,
}

model = Decider(REPO, gguf_file=GGUF, gguf_options=OPTIONS)
# llama.cpp contexts are not thread-safe; one decision at a time.
lock = threading.Lock()
app = FastAPI(title="decider (GGUF, CPU)")


class SystemOneRequest(BaseModel):
    state: dict
    questions: dict


class DecideRequest(BaseModel):
    context: str
    questions: list


@app.get("/healthz")
def healthz():
    return {"ok": True, "repo": REPO, "gguf": GGUF, **OPTIONS}


@app.post("/v1/systemone")
def system_one(req: SystemOneRequest):
    start = time.perf_counter()
    try:
        with lock:
            out = model.system_one(req.state, req.questions)
    except ValueError as err:
        raise HTTPException(status_code=422, detail=str(err))
    out["x_latency_ms"] = round((time.perf_counter() - start) * 1000)
    out["x_model"] = GGUF
    return out


@app.post("/decide")
def decide(req: DecideRequest):
    start = time.perf_counter()
    with lock:
        out = model.decide(req.context, req.questions)
    return {"answers": out, "x_latency_ms": round((time.perf_counter() - start) * 1000), "x_model": GGUF}
