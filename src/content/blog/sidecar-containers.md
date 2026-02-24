---
title: "Using sidecar containers in k8s"
slug: "sidecar-containers"
description: "Pods are the basic unit of deployment in k8s and in a typical k8s setup, your application container is probably running inside a pod. Pods themselves are containers, and you can run multiple containers sharing the same volume and network interfaces of the pod concurrently. This is called the sidecar pattern.

We run an emr django application connected to a RDS postgres database using RDS IAM auth. To make this work, we run a cronjob which generates a token every 10 minutes which is used by the a"
pubDate: "2022-01-22T12:48:06.000+00:00"
updatedDate: "2022-01-22T12:48:06.000+00:00"
featured: false
featureImage: "/images/sidecar-containers/IMG_20210314_112700.jpg"
tags:
  - "devops"
  - "kubernetes"
  - "aws"
author: "Sreeraj Rajan"
readingTime: 3
---

Pods are the basic unit of deployment in k8s and in a typical k8s setup, your application container is probably running inside a pod. Pods themselves are containers, and you can run multiple containers sharing the same volume and network interfaces of the pod concurrently. This is called the sidecar pattern.  
  
We run an emr django application connected to a RDS postgres database [using RDS IAM auth](https://sreeraj.dev/connecting-django-to-rds-via-pgbouncer/). To make this work, we run a cronjob which generates a token every 10 minutes which is used by the application to connect to the database server. We decided to abstract out the cron logic to a sidecar container, so that the application container serves a single purpose, i.e to run the application and nothing more.

We defined a dockerfile for the cron container.

```

FROM python:3.8-slim-buster

ENV PYTHONUNBUFFERED 1

RUN apt update \

  && apt-get update \
  # dependencies for building Python packages
  && apt-get install -y build-essential \
  # cron 
  && apt-get -y install cron \

  && pip install awscli  \

  # cleaning up unused files
  && apt-get purge -y --auto-remove -o APT::AutoRemove::RecommendsImportant=false \
  && rm -rf /var/lib/apt/lists/*


RUN addgroup --system django \
    && adduser --system --ingroup django django

RUN find /etc/ -path /etc -prune -o -path '*/resolv.conf' -prune -o -path '*/alternatives/*' -prune -o -path '*/hosts' -prune -o -exec chown django {} +

COPY ./compose/cron-sidecar/entrypoint /entrypoint
RUN sed -i 's/\r$//g' /entrypoint
RUN chmod +x /entrypoint
RUN chown django /entrypoint


RUN mkdir /app
RUN chown -R django /app

COPY ./rds-ca-2019-root.pem /rds-ca-2019-root.pem
COPY ./scripts/pgbouncer-update.sh /pgbouncer-update.sh
COPY ./users.template.txt /app/users.template.txt

RUN sed -i -e 's/\r//' /pgbouncer-update.sh

RUN chmod +x /pgbouncer-update.sh
RUN chmod +x /pgbouncer-update.sh


RUN touch /var/run/crond.pid
RUN chown django /var/run/crond.pid


RUN chmod gu+rw /var/run \
    && chmod gu+s /usr/sbin/cron

USER django

ENTRYPOINT ["/entrypoint"]
```

Dockerfile

```
#!/bin/bash

set -o errexit
set -o pipefail
set -o nounset


echo "*/2 * * * * bash /pgbouncer-update.sh >> /app/cron.log 2>&1
# This extra line makes it a valid cron" > scheduler.txt

crontab scheduler.txt
nohup cron -f &

while true
do
    echo "Press [CTRL+C] to stop.."
    sleep 1
done

exec "$@"
```

entrypoint.sh

We also make changes to the pgbouncer config so that it picks up auth credentials from the volume which is mounted in the application container and the sidecar container.

```
[databases]
{{PGBOUNCER_NAME}} = host={{POSTGRES_HOST}} port={{POSTGRES_PORT}} dbname={{POSTGRES_DB}}

[pgbouncer]
pool_mode = transaction
listen_port = {{PGBOUNCER_PORT}}
listen_addr = {{PGBOUNCER_HOST}}
auth_type = trust
auth_file = /shared/users.txt
pidfile = /var/run/pgbouncer/pgbouncer.pid
logfile = /var/run/pgbouncer/pgbouncer.log
max_client_conn = 4000
default_pool_size = 20
reserve_pool_size = 5
server_tls_sslmode = verify-full
server_tls_ca_file = rds-ca-2019-root.pem
syslog = 1
```

The base logic is to create a sidecar container, spawn a cron job which would generate auth credentials and write it to the file in the volume mounted to it. The volume which also be mounted in the application container with access to the file written by the sidecar container. Any writes to the volume by the sidecar container will be available to the application container. The following is an example terraform config of a kubernetes deployment running a sidecar container sharing a volume.  

```terraform
resource "kubernetes_deployment" "django" {

metadata {
    namespace = kubernetes_namespace.app_namespace.metadata[0].name
    labels = {
      name = "django"
    }
    name = "django"
  }

  spec {
    replicas = var.django_replicas
    selector {
      match_labels = {
        app : "django"
      }
    }
    template {
      metadata {
        labels = {
          app = "django"
        }
      }

      spec {
        enable_service_links    = false
        
        volume  {
          name = "shared-app"
          empty_dir {}
        }

        container {
          name              = "django"
          image             = "${var.ecr_url}:latest"
          image_pull_policy = "Always"
          args              = ["/start"]
          port  {
            name           = "django-port"
            container_port = var.django_port
          }
          volume_mount {
            name = "shared-app"
            mount_path = "/shared"
          }
        }

        container {
          name              = "cron"
          image             = "${var.cron_sidecar_ecr_url}:latest"
          image_pull_policy = "Always"
          args              = ["/start"]
        
          volume_mount {
            name = "shared-app"
            mount_path = "/shared"
          }
        }
      }
    }
  }
}
```

We add a volume named **shared\_app** which is then mounted to the /**shared** path in both containers. The cron job in the cron container writes to a file in this path which is then read by the django(application) container.

Note: Do not mount to a path which already exists in the container. Doing that would override all contents which were present in that location before mounting. [If you want to mount to a path which exists, has contents and also want to preserve it, use an init container to mount that volume to a different path, copy contents from the original path to the mounted location, and then mount it in the original path.](https://stackoverflow.com/questions/46389817/kubernetes-share-volume-between-containers-inside-a-deployment?ref=sreeraj.dev)

  
References :  
[Pods | Kubernetes](https://v1-20.docs.kubernetes.io/docs/concepts/workloads/pods/?ref=sreeraj.dev)  
[The Sidecar Pattern (magalix.com)](https://www.magalix.com/blog/the-sidecar-pattern?ref=sreeraj.dev)
