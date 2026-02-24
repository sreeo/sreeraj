---
title: "Adding Basic Authentication via NGINX in Kubernetes"
slug: "adding-auth-to-kibana-via-nginx"
description: "Basic Auth via NGINX in kubernetes"
pubDate: "2022-10-26T14:24:31.000+00:00"
updatedDate: "2022-11-01T09:06:20.000+00:00"
featured: false
featureImage: "/images/adding-auth-to-kibana-via-nginx/IMG_0786.jpeg"
tags:
  - "aws"
  - "kubernetes"
  - "tech"
  - "nginx"
  - "k8s"
  - "devops"
  - "shorts"
author: "Sreeraj Rajan"
readingTime: 1
---

1. Generate the htpasswd file

```
htpasswd -c auth sree
New password:
Re-type new password:
Adding password for user sree
```

2. Create a kubernetes secret with the auth file as the source.

```
resource "kubernetes_secret" "service-secret" {
  metadata {
    name      = "basic-auth"
    namespace = "production"
  }

  data = {
    "auth" = file("${path.cwd}/auth")
  }
}
```

3. Reference the secret in the ingress annotations.

```
resource "kubernetes_ingress" "service_ingress" {
  metadata {
    name      = "service-ingress"
    namespace = "production"
    annotations = {
      "kubernetes.io/ingress.class"             = "nginx"
      "cert-manager.io/cluster-issuer" = "cert-manager"
      "nginx.ingress.kubernetes.io/auth-type"   = "basic"
      "nginx.ingress.kubernetes.io/auth-secret" = "basic-auth"
      "nginx.ingress.kubernetes.io/auth-realm"  = "Authentication Required - sree"
    }
  }
```

Terraform (HCL)

Voila, the service will ask you for the username and password to login whenever you access the service.

Extremely useful if you are dealing with internal/private dashboards and quickly want to add a layer of authentication without dealing with the internal application code.
