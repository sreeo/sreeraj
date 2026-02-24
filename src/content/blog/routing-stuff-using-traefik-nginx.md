---
title: "Routing stuff using traefik/nginx"
slug: "routing-stuff-using-traefik-nginx"
description: "Using traefik/nginx as a Reverse Proxy."
pubDate: "2022-04-15T09:52:25.000+00:00"
updatedDate: "2022-04-15T09:53:18.000+00:00"
featured: true
featureImage: "/images/routing-stuff-using-traefik-nginx/PXL_20220328_073210635.jpg"
tags:
  - "devops"
  - "nginx"
  - "tech"
author: "Sreeraj Rajan"
readingTime: 5
---

I had a bunch of docker containers running on an EC2 instance. The goal was to setup a base common domain for all services, and have different routing rules to those containers based on the path of the URL.

### The Ask

1) Block requests to the base/root URL (eg: `https://domain.com/`)  
2) Forward requests to port 8080 if `/dcm4chee-arc/` is in the path. (eg: `https://domain.com/*/dcm4chee-arc/*`)  
3) Else Forward requests to port 3030 if (eg: `https://domain.com/**`)

![](/images/routing-stuff-using-traefik-nginx/image-1.png)

A loadbalancer was setup pointing to the staging ec2 instance with the following rules. We set out to replicate this using a reverse proxy and eliminate the AWS loadbalancer.

![](/images/routing-stuff-using-traefik-nginx/image.png)

### 1) [Using Traefik (1.7.34)](https://github.com/traefik/traefik/releases/tag/v1.7.34?ref=sreeraj.dev)

I had some familiarity working with traefik in the past. We use traefik extensively in the backend for routing due to its amazing support with docker containers. Traefik's certbot integration is pretty amazing as well, generating and renewing SSL certificates are all automated.

I went with running traefik on a docker container on a separate network. I did this because I wanted to figure out if traefik could route to ports on the host machine while running on a docker container. I couldn't figure out how to make it work, so decided to run traefik natively. I lately figured this out while I was playing around with nginx, [attributing the stackoverflow solution here.](https://stackoverflow.com/questions/31324981/how-to-access-host-port-from-docker-container/31328031?ref=sreeraj.dev#31328031)

Traefik reads a configuration file, so setup a new file named `traefik.toml`

```toml
logLevel = "DEBUG"
defaultEntryPoints = ["http", "https"]

# Entrypoints, http and https
[entryPoints]

  # http should be redirected to https
  [entryPoints.http]
  address = ":80"
    [entryPoints.http.redirect]
    entryPoint = "https"

  # https is the default
  [entryPoints.https]
  address = ":443"
    [entryPoints.https.tls]

# Enable ACME (Let's Encrypt): automatic SSL
[acme]

# Email address used for registration
email = "xyz@theprocedure.in"
storage = "./acme/acme.json"
entryPoint = "https"
onDemand = false
OnHostRule = true

  # Use a HTTP-01 acme challenge rather than TLS-SNI-01 challenge
  [acme.httpChallenge]
  entryPoint = "http"

[file]

[backends]
  [backends.viewer]
    [backends.viewer.servers.server1]
      url = "http://localhost:3030"
  [backends.reader]
    [backends.reader.servers.server1]
      url = "http://localhost:8080"

  [frontends.reader]
    backend = "reader"
    [frontends.reader.routes.dr1]
      rule = "Host:api.staging.***.***.co;PathPrefix:/dcm4chee-arc/"
  [frontends.viewer]
    backend = "viewer"
    [frontends.viewer.routes.dr1]
      rule = "Host:api.staging.***.***.co"
```

traefik.toml

I added two entrypoints (ports 80 and 443). All http requests (port 80) are redirected to https(443). The middle part until the `file` section deals with SSL/certificate generation. The latter part is what we are concerned with.  
  
I define two backends, two docker containers running on the instance with 3030 and 8080 ports exposed respectively. All the requests are forwarded to the services as is (without any path/header/request stripping/modification).

Now I had to figure out how to block requests that are made to the base/root domain without any string/path appended to it. Unfortunately traefik doesn't allow us to return custom HTTP codes based on routing rules/host paths. So I added a dummy backend with a port where no services was running, and routed requests to base/root domain to that backend. It returned a 404, and probably wasn't the most elegant solution, so I decided to give this an attempt with nginx.

```toml
..........
..........
[backends]
  [backends.block]
    [backends.block.servers.server1]
      url = "http://localhost:25001"
      
[frontends]
  [frontends.block]
    backend = "block"
    [frontends.block.routes.dr1]
      rule = "Host:api.staging.***.***.co;Path:/"
```

traefik.toml (updated)

The final `traefik.toml` file.

```
logLevel = "DEBUG"
defaultEntryPoints = ["http", "https"]

# Entrypoints, http and https
[entryPoints]

  # http should be redirected to https
  [entryPoints.http]
  address = ":80"
    [entryPoints.http.redirect]
    entryPoint = "https"

  # https is the default
  [entryPoints.https]
  address = ":443"
    [entryPoints.https.tls]

# Enable ACME (Let's Encrypt): automatic SSL
[acme]

# Email address used for registration
email = "***@theprocedure.in"
storage = "./acme/acme.json"
entryPoint = "https"
onDemand = false
OnHostRule = true

  # Use a HTTP-01 acme challenge rather than TLS-SNI-01 challenge
  [acme.httpChallenge]
  entryPoint = "http"

[file]

[backends]
  [backends.viewer]
    [backends.viewer.servers.server1]
      url = "http://localhost:3030"
  [backends.reader]
    [backends.reader.servers.server1]
      url = "http://localhost:8080"
  [backends.block]
    [backends.block.servers.server1]
      url = "http://localhost:25001"

[frontends]
  [frontends.block]
    backend = "block"
    [frontends.block.routes.dr1]
      rule = "Host:api.staging.***.***.co;Path:/"
  [frontends.reader]
    backend = "reader"
    [frontends.reader.routes.dr1]
      rule = "Host:api.staging.***.***.co;PathPrefix:/dcm4chee-arc/"
  [frontends.viewer]
    backend = "viewer"
    [frontends.viewer.routes.dr1]
      rule = "Host:api.staging.***.***.co"
```

**cmd**: `nohup sudo ./traefik_linux-amd64 --configFile=traefik.toml &`  

### 2) Using NGINX

Since traefik did not allow status code redirects based on certain paths, I decided to do this via NGINX. I also wanted to run NGINX on a docker container and figure out how to route to services running on the host machine who might not be on the same docker network.

I create a new `dockerfile` and a `nginx.conf` to configure nginx.

```

FROM nginx
COPY ./nginx.conf /etc/nginx/conf.d/default.conf
```

Dockerfile

[If you want to enable SSL cert generation using Certbot, follow this.](https://www.programonaut.com/setup-ssl-with-docker-nginx-and-lets-encrypt/?ref=sreeraj.dev)

After doing the above, we'd have a compose file. I add the `extra_hosts` section to the nginx service in my container definition. The whole compose file is referenced below. This allows the nginx service to access services running on the host machine with the `host.docker.internal` domain.

```yaml
version: '3'

services:
  nginx:
    image: nginx
    build: 
      context: .
    ports:
      - "80:80"
      - "443:443"
    extra_hosts:
      - "host.docker.internal:host-gateway"
    volumes:
      - ./certbot/conf:/etc/letsencrypt
      - ./certbot/www:/var/www/certbot
  certbot:
    image: certbot/certbot
    container_name: certbot
    volumes: 
      - ./certbot/conf:/etc/letsencrypt
      - ./certbot/www:/var/www/certbot
    command: certonly --webroot -w /var/www/certbot --force-renewal --email xxx@theprocedure.in -d api.staging.***.***.co  --agree-tos
```

docker-compose.yml

Finally I add routing rules in the `nginx.conf` file.

```
server {
    listen 80;
    server_name api.staging.***.***.co;


    return 301 https://$host$request_uri;

}

server {
    listen 443 ssl http2;
    ssl_certificate     /etc/letsencrypt/live/api.staging.***.***.co/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.staging.***.***.co/privkey.pem;
    server_name api.staging.***.***.co;

    location ~ /dcm4chee-arc/ {
        proxy_pass http://host.docker.internal:8080;
    }

    location ~ /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location = / {
        return 403;
    }

    location ~ /(.+)$ {
        proxy_pass http://host.docker.internal:3030;
    }
}
```

nginx.conf

The first server block is to route all requests to port 80 to 443 (HTTPS redirect).

The second server block listens to requests on the 443 port, routes requests having path  `/dcm4chee-arc/` to the service running on port 8080 (on the host machine, not the docker container).  
I also block all requests by returning 403 made only to the base/root domain with an exact match.

```
location = / {
  return 403;
}
```

The last location block forwards all requests to the service running on port 3030.

  
While playing around with NGINX, I also discovered [Nginx Unit](https://unit.nginx.org/?ref=sreeraj.dev), a polyglot server supporting Python, Go, JS, Java, Perl, Ruby applications. [User benchmarks look promising, users reporting better performance over Gunicorn when serving python applications.](https://github.com/tiangolo/fastapi/issues/3128?ref=sreeraj.dev)

References:  
1)  [Traefik | Traefik | v1.7](https://doc.traefik.io/traefik/v1.7/?ref=sreeraj.dev)  
2) [Setup SSL with Docker, NGINX and Lets Encrypt - Programonaut](https://www.programonaut.com/setup-ssl-with-docker-nginx-and-lets-encrypt/?ref=sreeraj.dev)  
3) [How to access host port from docker container - Stack Overflow](https://stackoverflow.com/questions/31324981/how-to-access-host-port-from-docker-container/?ref=sreeraj.dev)

> [GitHub - sreeo/nginx-traefik-reverse-proxy-template: Template repo for nginx/traefik](https://github.com/sreeo/nginx-traefik-reverse-proxy-template?ref=sreeraj.dev)
> Template repo for nginx/traefik. Contribute to sreeo/nginx-traefik-reverse-proxy-template development by creating an account on GitHub.
