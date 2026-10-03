# CPU-only decider service: Mapika/decider GGUF weights behind a Jev-compatible /v1/systemone endpoint.
FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends build-essential cmake git     && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu
# Built on the host it runs on, so tune llama.cpp for this CPU (AVX-512 on EPYC Genoa).
ENV CMAKE_ARGS="-DGGML_NATIVE=ON"
RUN pip install --no-cache-dir "decider-ai[gguf]==1.8.1" fastapi "uvicorn[standard]"
COPY server.py /app/server.py
ENV HF_HOME=/hf
EXPOSE 8000
CMD ["uvicorn", "server:app", "--app-dir", "/app", "--host", "0.0.0.0", "--port", "8000"]
