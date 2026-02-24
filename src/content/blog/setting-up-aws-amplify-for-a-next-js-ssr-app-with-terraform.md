---
title: "Setting up AWS Amplify for a Next JS SSR app with Terraform"
slug: "setting-up-aws-amplify-for-a-next-js-ssr-app-with-terraform"
description: "Setting up Amplify for nextjs SSR via Terraform"
pubDate: "2022-01-21T08:57:54.000+00:00"
updatedDate: "2022-01-21T10:20:46.000+00:00"
featured: false
featureImage: "/images/setting-up-aws-amplify-for-a-next-js-ssr-app-with-terraform/IMG_20170917_144020.jpg"
tags:
  - "devops"
author: "Sreeraj Rajan"
readingTime: 4
---

e.g github repo : [proceduretech/terraform-amplify-nextjs-ssr (github.com)](https://github.com/proceduretech/terraform-amplify-nextjs-ssr?ref=sreeraj.dev)

I'd been trying to host a nextjs APP on Amplify via terraform and ran into some issues. It did not seem to be straightforward as I thought it'd be, so I wrote a tutorial on it.

Start out with setting up a terraform repo, set your state etc.

Amplify requires permissions of certain AWS resources like S3, Cloudfront, etc to deploy a SSR application. So, we setup an IAM role and attach required policies so that amplify can access those required policies. The following file contains all the policies required.

[

Amplify role policies

amplify\_role\_policies.json

16 KB

.a{fill:none;stroke:currentColor;stroke-linecap:round;stroke-linejoin:round;stroke-width:1.5px;}download-circle

](https://sreeraj.dev/content/files/2022/01/amplify_role_policies.json "Download")

Start out by creating a role that'd allow the amplify service to assume that particular role. We'd attach all policies that amplify requires.  

```terraform
resource "aws_iam_role" "amplify_role" {
  name = "amplify_deploy_terraform_role"

  # Terraform's "jsonencode" function converts a
  # Terraform expression result to valid JSON syntax.
  assume_role_policy = <<POLICY
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "amplify.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
POLICY
  

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}
```
```terraform

resource "aws_iam_role_policy" "amplify_role_policy" {
  name = "amplify_iam_role_policy"
  role = aws_iam_role.amplify_role.id

  policy = file("${path.cwd}/modules/frontend/amplify_role_policies.json")
}
```

Download the file attached above or look up Amplify Administrator in the IAM dashboard to copy all the policies and write it to a file.

Now add in the amplify\_app config to create an Amplify App.

```
resource "aws_amplify_app" "frontend" {
  name = "${var.project_name}-${var.environment}"
  repository = var.github_repository
  access_token= var.github_token_for_frontend

  build_spec = <<-EOT
    version: 1
    frontend:
      phases:
        preBuild:
          commands:
            - yarn install
        build:
          commands:
            - yarn run build
      artifacts:
        baseDirectory: .next
        files:
          - '**/*'
      cache:
        paths:
          - node_modules/**/*
  EOT

  enable_auto_branch_creation = true
  enable_branch_auto_build = true
  enable_branch_auto_deletion = true
  platform = "WEB"

  auto_branch_creation_config {
    enable_pull_request_preview = true
    environment_variables = {
      APP_ENVIRONMENT = "develop"
    }
  }

  iam_service_role_arn = aws_iam_role.amplify_role.arn

  # Comment this on the first run, trigger a build of your branch, This will added automatically on the console after deployment. Add it here to ensure your subsequent terraform runs don't break your amplify deployment.
  custom_rule {
    source = "/<*>"
    status = "200"
    target = "https://xxx.cloudfront.net/<*>" 
  }

  custom_rule {
    source = "/<*>"
    status = "404-200"
    target = "/index.html"  
  }

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}
```

Comment out the first custom rule. After your first branch deployment, Amplify adds in a custom rule with the newly generated cloudfront endpoint. You'd get this value  in the Amplify dashboard in Rewrites and redirects. Replace the xxx in cloudfront with the new value you get when you run terraform apply. You could also run terraform plan, where terraform would detect the changes outside of its scope and notify you about the new value.

![](/images/setting-up-aws-amplify-for-a-next-js-ssr-app-with-terraform/image-7.png)

We add in our branches to enable CI/CD whenever a change is pushed to the branch.

```
# map git branches to amplify
#- - - - - - - - - - - - - - -- - - -- - - - - -- - - - - - -
resource "aws_amplify_branch" "develop" {
  app_id      = aws_amplify_app.frontend.id
  branch_name = "develop"

  enable_auto_build = true

  framework = "Next.js - SSR"
  stage     = "DEVELOPMENT"

  environment_variables = {
    APP_ENVIRONMENT = "develop"
  }
}
```

Assuming you have configured your dns records on Route53, you can add in domain associations to your branches. For eg: you can add subdomains for each environment, and point those subdomains to a particular branch.

```
resource "aws_amplify_domain_association" "develop" {
  app_id      = aws_amplify_app.frontend.id
  domain_name = "staging-xxx.xxx.co"

  # https://staging-xxx.xxx.co
  sub_domain {
    branch_name = aws_amplify_branch.develop.branch_name
    prefix      = ""
  }

  # https://www.staging-xxx.xxx.co
  sub_domain {
    branch_name = aws_amplify_branch.develop.branch_name
    prefix      = "www"
  }
}
```

If you do not have your dns records on AWS, you can point your domain to the endpoint that amplify generates for each environment. You can get the amplify endpoint from the console.

Modify the **artifacts** value in the baseDirectory in **aws\_amplify\_app** resource if your app outputs a production build to a different directory than **.next/** .

Click on Run Build after provisioning. You'll probably have to do this once for all the branches you add/commit. This will trigger a build and deploy.

![](/images/setting-up-aws-amplify-for-a-next-js-ssr-app-with-terraform/image-8.png)

Amplify also offers logs for each step in the deployment process.

![](/images/setting-up-aws-amplify-for-a-next-js-ssr-app-with-terraform/image-9.png)

Protip: If you configuring resources on terraform, and you hit a roadblock, try creating a working flow via the console, and see if you have missed configuring stuff. In my case, I hadn't assigned a **iam\_service\_role\_arn** to the **aws\_amplify\_resource**, but terraform/amplify did not raise any errors. Deployments on the amplify console also ran successfully, but we found that there were no cloudfront/s3 resources provisioned. Adding the role and attaching the amplify administrator policies fixed it.
