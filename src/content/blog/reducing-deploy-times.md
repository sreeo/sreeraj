---
title: "Reducing our Deployment times by 87%"
slug: "reducing-deploy-times"
description: "Leveraging github actions by using state to determine whether to build a dockerimage or not."
pubDate: "2022-01-03T17:41:31.000+00:00"
updatedDate: "2022-01-03T17:47:53.000+00:00"
featured: true
featureImage: "/images/reducing-deploy-times/PXL_20211230_121955872.jpeg"
tags:
  - "devops"
  - "django"
  - "k8s"
  - "kubernetes"
  - "aws"
author: "Sreeraj Rajan"
readingTime: 2
---

We run a healthcare EMR application on k8s. We used to auto-deploy to prod/uat whenever a new commit was merged to the main/uat branch via Github Actions.

Our deployment script had the following the set of actions:

1) Build and tag the docker image.

2) Upload the image to ECR.

3) Update the k8s deployments with the new image.

Of the above steps, 1 & 2 took almost 6-7 minutes to finish. On every trigger, all requirements and dependencies were compiled/installed.  

```
....
RUN apt-get install -y pgbouncer \
	&& pip install awscli
...
COPY ./requirements /requirements
...
RUN pip install --no-cache-dir -r /requirements/uat.txt \
  && rm -rf /requirements
...
```
![](/images/reducing-deploy-times/image.png)

We decided to add a base dockerfile that'd be built only when the requirements changed/modified. The actual docker image that'd be used to deploy would refer to the base dockerfile and only contains steps to copy application code and other time-irrelevant steps.

We needed to figure out a way to detect if the requirements/dependencies changed, which would trigger the base image build.

We added [jorgebg/stateful-action@v0.1](https://github.com/marketplace/actions/stateful-action?ref=sreeraj.dev) to our deploy script. This allows us to set state between github actions. Any state modification is written to the state branch by default.

```
name: UAT deployment

on:
  push:
    branches:
      - uat

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: jorgebg/stateful-action@v0.1
      - name: Check and build base docker image
        run:  |
          echo "get existing hash"
          FILE=.state/requirements-hash.txt

          if [ -f "$FILE" ]; then
            echo "$FILE exists.";
            read -r existing_hash<$FILE;
            echo "Existing hash $existing_hash";
            new_base_hash=($(md5sum requirements/base.txt))
            new_production_hash=($(md5sum requirements/production.txt))
            echo "$new_base_hash$new_production_hash" > "$FILE"
            read -r new_hash<$FILE;

            echo "Current hash $new_hash";

            if [ "$new_hash" != "$existing_hash" ]; then
              echo "Hash does not match, rebuilding docker image"
              bash ./deploy_scripts/base.sh -i ...
            else
              echo "Hash matches no rebuilding required"
            fi
          else
            echo "File does not exist in state"
            new_base_hash=($(md5sum requirements/base.txt))
            new_production_hash=($(md5sum requirements/production.txt))
            echo "$new_base_hash$new_production_hash" > "$FILE"
            bash ./deploy_scripts/base.sh -i ...
          fi
```

On every trigger, we compared the hash of the requirements file with the hash stored in the state, and triggered a build of the base docker image if there was a mismatch. The new hash value is written to the state once the build finishes.

Since, we do not add/modify dependencies to our django application frequently, it made sense to have a base docker image with all the dependencies already installed and use it as a base to the actual application docker image.

![](/images/reducing-deploy-times/image-1.png)

We reduced our deploy times from 6-7 minutes to less than a minute. This allows us to be more confident while pushing to production since we know rolling back/releasing a hotfix would take less than a minute.
