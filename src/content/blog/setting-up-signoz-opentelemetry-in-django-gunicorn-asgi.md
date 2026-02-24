---
title: "Setting up OpenTelemetry in Django gUnicorn ASGI"
slug: "setting-up-signoz-opentelemetry-in-django-gunicorn-asgi"
description: "Setup OpenTelemetry for Django running on gUnicorn ASGI."
pubDate: "2022-01-29T16:59:50.000+00:00"
updatedDate: "2022-01-29T17:00:57.000+00:00"
featured: false
featureImage: "/images/setting-up-signoz-opentelemetry-in-django-gunicorn-asgi/PXL_20211106_065359710.jpeg"
tags:
  - "devops"
  - "django"
author: "Sreeraj Rajan"
readingTime: 3
---

I was working on integrating Signoz APM in one of the k8s clusters that we run for one of our products. We also added a [helm chart repository](https://proceduretech.github.io/signoz-helm/?ref=sreeraj.dev) for [Signoz](https://signoz.io/?ref=sreeraj.dev) to facilitate terraform deployments. To send metrics to Signoz, we need to add OpenTelemetry to instrument and send it to a otel-consumer which comes out of the box with Signoz.

1) Start by adding these dependencies to your Django App.

```text
opentelemetry-api==1.5.0
opentelemetry-exporter-otlp==1.5.0
opentelemetry-instrumentation==0.24b0
opentelemetry-instrumentation-asgi==0.24b0
opentelemetry-sdk==1.5.0
```

2) We add a new file named **gunicorn.config.py**.  
[OpenTelemetry has an issue of getting into a deadlock with fork process models](https://opentelemetry-python.readthedocs.io/en/latest/examples/fork-process-model/README.html?ref=sreeraj.dev#working-with-fork-process-models).  
To bypass this, we use the post fork hook to initialise a **BatchSpanProcessor** which would spawn a thread in the background to send spans to the telemetry backend.

```python
# Copyright The OpenTelemetry Authors
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import (
    OTLPSpanExporter,
)
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor

bind = "0.0.0.0:5000"

# Sample Worker processes
workers = 4
worker_class = "uvicorn.workers.UvicornWorker"



def post_fork(server, worker):
    server.log.info("Worker spawned (pid: %s)", worker.pid)

    resource = Resource.create(attributes={"service.name": "emr-backend-service"})

    trace.set_tracer_provider(TracerProvider(resource=resource))
    # This uses insecure connection for the purpose of example. Please see the
    # OTLP Exporter documentation for other options.
    span_processor = BatchSpanProcessor(
        OTLPSpanExporter(endpoint="http://otel-collector:4317", insecure=True)
    )
    trace.get_tracer_provider().add_span_processor(span_processor)
```

**gunicorn.config.py**

3) We initialise the OpenTelemetryMiddleware in asgi config to enable automatic telemetry logging.

```python
"""
ASGI config for EMR API project.
It exposes the ASGI callable as a module-level variable named ``application``.
For more information on this file, see
https://docs.djangoproject.com/en/dev/howto/deployment/asgi/
"""
import os
import sys
from pathlib import Path

from django.core.asgi import get_asgi_application
from opentelemetry.instrumentation.asgi import OpenTelemetryMiddleware

# This allows easy placement of apps within the interior
# emr_api directory.
ROOT_DIR = Path(__file__).resolve(strict=True).parent.parent
sys.path.append(str(ROOT_DIR / "emr_api"))

# If DJANGO_SETTINGS_MODULE is unset, default to the local settings
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.local")

# This application object is used by any ASGI server configured to use this file.
django_application = get_asgi_application()
django_application = OpenTelemetryMiddleware(django_application)

# Apply ASGI middleware here.
# from helloworld.asgi import HelloWorldApplication
# application = HelloWorldApplication(application)

# Import websocket application here, so apps from django_application are loaded first
from config.websocket import websocket_application  # noqa isort:skip


async def application(scope, receive, send):
    if scope["type"] == "http":
        await django_application(scope, receive, send)
    elif scope["type"] == "websocket":
        await websocket_application(scope, receive, send)
    else:
        raise NotImplementedError(f"Unknown scope type {scope['type']}")
```

asgi.py

4) Finally, we modify the start command. Replace the **OTEL\_EXPORTER\_OTLP\_ENDPOINT** value to the one depending on your infra/services are setup.

```
/usr/local/bin/gunicorn config.asgi --bind 0.0.0.0:5000 --chdir=/app -w 4 -k uvicorn.workers.UvicornWorker
```

Old

```
DJANGO_SETTINGS_MODULE=config.settings.production OTEL_RESOURCE_ATTRIBUTES=service.name=emr-backend-service OTEL_EXPORTER_OTLP_ENDPOINT="http://otel-collector:4317" opentelemetry-instrument /usr/local/bin/gunicorn config.asgi  -c config/gunicorn.config.py
```

New

This should start sending spans to your collector.

**References**:  
[Django gunicorn auto instrumentation · Issue #2038 · open-telemetry/opentelemetry-python (github.com)](https://github.com/open-telemetry/opentelemetry-python/issues/2038?ref=sreeraj.dev)  
[Working With Fork Process Models — OpenTelemetry Python documentation (opentelemetry-python.readthedocs.io)](https://opentelemetry-python.readthedocs.io/en/latest/examples/fork-process-model/README.html?highlight=gunicorn&ref=sreeraj.dev#working-with-fork-process-models)
