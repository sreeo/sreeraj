---
title: "Moving from AWS Loadbalancers to Nginx"
slug: "nginx-ingress-k8s"
description: "We run a k8s cluster for our healthcare EMR application. At the time, we only had one public facing service, so we used a Kubernetes Service of Type LoadBalancer.

resource \"kubernetes_service\" \"django\" {

  metadata {
    name      = \"django\"
    namespace = kubernetes_namespace.app_namespace.metadata[0].name
    annotations = tomap(
      {
        \"service.beta.kubernetes.io/aws-load-balancer-ssl-cert\"         = var.django_acm_arn,
        \"service.beta.kubernetes.io/aws-load-balancer-ssl-por"
pubDate: "2021-12-18T11:18:35.000+00:00"
updatedDate: "2021-12-18T16:24:31.000+00:00"
featured: false
featureImage: "/images/nginx-ingress-k8s/IMG_20211031_101043.jpeg"
tags:
  - "devops"
  - "aws"
  - "django"
  - "kubernetes"
  - "nginx"
  - "k8s"
author: "Sreeraj Rajan"
readingTime: 2
---

We run a k8s cluster for our healthcare EMR application. At the time, we only had one public facing service, so we used a Kubernetes Service of Type LoadBalancer.

```terraform
resource "kubernetes_service" "django" {

  metadata {
    name      = "django"
    namespace = kubernetes_namespace.app_namespace.metadata[0].name
    annotations = tomap(
      {
        "service.beta.kubernetes.io/aws-load-balancer-ssl-cert"         = var.django_acm_arn,
        "service.beta.kubernetes.io/aws-load-balancer-ssl-ports"        = "443",
        "service.beta.kubernetes.io/aws-load-balancer-backend-protocol" = "http"
      }
    )
  }

  spec {
    type = "LoadBalancer"
    port {
      port        = 443
      target_port = var.django_port
      protocol    = "TCP"
      name        = "https"
    }
    selector = {
      app : "django"
    }
  }
}
```

As time went on, we added more public facing services to the cluster each with their own loadbalancer. We also added a ELK stack with an exposed Kibana dashboard.  So we decided to add an NGINX ingress controller that'd allow access to services.

```terraform

resource "helm_release" "ingress-nginx" {
  name       = "ingress-nginx"
  repository = "https://kubernetes.github.io/ingress-nginx/"
  chart      = "ingress-nginx"
  namespace  = kubernetes_namespace.namespace.metadata[0].name

  values = [
    "${file("./ingress-nginx.yaml")}"
  ]
}
```

This will create a load balancer. Add/Modify A records to all services that you'll route through your NGINX ingress and point it to the newly created loadbalancer.

You'd also want to ensure that the endpoints run on HTTPS. For this we added a clusterissuer that'd issue SSL certificates to resources in the cluster. [We used this module](https://registry.terraform.io/modules/terraform-iaac/cert-manager/kubernetes/latest?ref=sreeraj.dev) to add the cert-manager in our cluster.

```

module "cert-manager" {
  source  = "terraform-iaac/cert-manager/kubernetes"
  version = "2.2.2"
  cluster_issuer_email = "xxx@xxx.in"
}
```

We add a kubernetes\_ingress resource that'd route all requests for a particular domain to a particular service. We add an ingress resource for each resource since we generate a SSL certificate for each service with the domain. You could keep a common ingress resource with a wildcard domain SSL certificate and route all requests to difference services.

```terraform
resource "kubernetes_ingress" "django_ingress" {
  metadata {
    name      = "xxx-django-ingress"
    namespace = "production"
    annotations = {
      "kubernetes.io/ingress.class"             = "nginx"
      "cert-manager.io/cluster-issuer" = "cert-manager"
    }
  }
  spec {
    tls {
      hosts = ["xxx.xx.xxx.com"]
      secret_name = "cert-manager-private-key-django"
    }
    rule {
      host = "api.xx.xxx.com"
      http {
        path {
          path = "/"
          backend {
            service_name = "production-django"
            service_port = 443
          }
        }
      }
    }
  }
}
```

And then modify the service to be a ClusterIP service.

```
resource "kubernetes_service" "django" {

  metadata {
    name      = "${var.environment}-django"
    namespace = kubernetes_namespace.app_namespace.metadata[0].name
  }

  spec {
    type = "ClusterIP"
    port {
      port        = 443
      target_port = var.django_port
      protocol    = "TCP"
      name        = "https"
    }
    selector = {
      app : "django"
    }
  }
}
```

We moved a bunch of our services which were exposed using individual loadbalancers to a single nginx ingress controller.  A single loadbalancer costs around $22 .  
References  
1) [https://github.com/hashicorp/terraform/issues/27257#issuecomment-825102330](https://github.com/hashicorp/terraform/issues/27257?ref=sreeraj.dev#issuecomment-825102330) (Read this if you are installing the module on M1 machines)  
2) [Securing NGINX-ingress | cert-manager](https://cert-manager.io/docs/tutorials/acme/ingress/?ref=sreeraj.dev)  
3) [terraform-iaac/cert-manager/kubernetes | Terraform Registry](https://registry.terraform.io/modules/terraform-iaac/cert-manager/kubernetes/latest?ref=sreeraj.dev)  
4) [Docs overview | gavinbunney/kubectl | Terraform Registry](https://registry.terraform.io/providers/gavinbunney/kubectl/latest/docs?ref=sreeraj.dev#installation)
