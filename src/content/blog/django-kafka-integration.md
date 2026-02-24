---
title: "Django Kafka Integration"
slug: "django-kafka-integration"
description: "Django Kafka Integration using Faust."
pubDate: "2022-10-26T08:31:33.000+00:00"
updatedDate: "2022-11-01T09:07:10.000+00:00"
featured: false
featureImage: "/images/django-kafka-integration/DSC00171.JPG"
tags:
  - "django"
  - "tech"
  - "kafka"
  - "python"
  - "faust"
author: "Sreeraj Rajan"
readingTime: 2
---

I was curious for a while on how Kafka would integrate with a Django codebase. At Procedure, we primarily use Django for a lot of use cases in the backend.  Celery is something that we use extensively, and to integrate kafka, you'd have probably have to run a Celery task periodically that initialises a consumer and looks for messages and processes. Sounds extremely ugly.

I found another library [Faust](https://faust.readthedocs.io/en/latest/?ref=sreeraj.dev), which can consume events from Kafka. With the advent of containers and k8s, the idea is to create modules of code which serve an atomic purpose. We'd have a django service which would expose REST APIs. We'd have a consumer service using Faust which would be connected to Kafka cluster listening for new events on a particular topic.

```yaml
version: '3'

volumes:
  sample_local_postgres_data: {}
  sample_local_postgres_data_backups: {}

services:
  django: &django
    build:
      context: .
      dockerfile: ./compose/local/django/Dockerfile
    image: sample_local_django
    platform: linux/x86_64
    depends_on:
      - postgres
    volumes:
      - .:/app:z
    env_file:
      - ./.envs/.local/.django
      - ./.envs/.local/.postgres
    ports:
      - "8000:8000"
    command: /start

  kafka_consumer:
    <<: *django
    image: kafka_consumer_image
    ports: []
    depends_on:
      - broker
    command: /start-faust

  postgres:
    build:
      context: .
      dockerfile: ./compose/production/postgres/Dockerfile
    image: sample_production_postgres
    container_name: sample_local_postgres
    volumes:
      - sample_local_postgres_data:/var/lib/postgresql/data:Z
      - sample_local_postgres_data_backups:/backups:z
    env_file:
      - ./.envs/.local/.postgres
    ports:
        - "5432:5432"

  zookeeper:
    image: confluentinc/cp-zookeeper:7.0.1
    container_name: zookeeper
    ports:
        - "2181:2181"
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181
      ZOOKEEPER_TICK_TIME: 2000

  broker:
    image: confluentinc/cp-kafka:7.0.1
    container_name: broker
    depends_on:
      - zookeeper
    ports:
      - "29092:29092"
      - "9092:9092"
      - "9101:9101"
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: 'zookeeper:2181'
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: PLAINTEXT:PLAINTEXT,PLAINTEXT_HOST:PLAINTEXT
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://broker:29092,PLAINTEXT_HOST://localhost:9092
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
      KAFKA_TRANSACTION_STATE_LOG_MIN_ISR: 1
      KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR: 1
      KAFKA_GROUP_INITIAL_REBALANCE_DELAY_MS: 0
      KAFKA_JMX_PORT: 9101
      KAFKA_JMX_HOSTNAME: localhost
    restart: on-failure
```

The `django` and `kafka_consumer` services are stateless and can be horizontally scaled as required without any side effect.  

```bash
#!/bin/bash

set -o errexit
set -o pipefail
set -o nounset


faust -A config.kafka_consumer:app worker -l info
```

/start-faust

`config.kafka_consumer:app` , `config` refers to the folder where you would have your `kafka_consumer` script with an `app` function defined inside.

```python
import os
import faust
import django

# eventlet is used as a bridge to communicate with asyncio
os.environ.setdefault("FAUST_LOOP", "eventlet")

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.local")
django.setup()

# Django logic models only imported after django setup is called

from consumer.models import Metric
from consumer.service import persist_metric_event

from django.conf import settings

app = faust.App("sample", broker=f"kafka://{settings.KAFKA_URL}")


topic = app.topic(settings.KAFKA_STREAM_TOPIC, value_type=Metric)


@app.agent(topic)
async def process_topic(stream):
    async for event in stream:
        print("received event %s", event)
        await persist_metric_event(event)
```

config/kafka\_consumer.py

Notice the `django.setup()` function. If you want to access django models and its functions, you'd have to call this.

This consumer would consume any event that is published to the topic it's listening.

Here's a template repo if you want to take a look.  
[sreeo/django-kafka-faust (github.com)](https://github.com/sreeo/django-kafka-faust?ref=sreeraj.dev)
