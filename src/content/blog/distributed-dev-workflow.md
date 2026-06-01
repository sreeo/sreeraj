---
title: "My Distributed Dev Workflow"
slug: "distributed-dev-workflow"
description: "How I run my dev workflows across a Macbook Pro, a Hetzner instance and my phone, stitched together with tmux, Tailscale and Claude Code."
pubDate: "2026-06-01T00:00:00.000+00:00"
updatedDate: "2026-06-01T00:00:00.000+00:00"
featured: false
featureImage: "/images/distributed-dev-workflow/IMG_8431.jpg"
tags:
  - "programming"
  - "workflow"
  - "claude-code"
  - "tmux"
  - "tailscale"
  - "ssh"
author: "Sreeraj Rajan"
readingTime: 2
---

Here's how I run my dev workflows.

## The setup

I split my machines into two dev instances and one on-the-go device.

**Dev instances**

1. Macbook Pro
2. A Hetzner instance

**On-the-go device**

1. My phone (iPhone 13)

## Agents and sessions

I primarily use [Claude Code](https://claude.com/claude-code) as my primary agent. I have tmux set up on both my Macbook and my Hetzner instance, with multiple sessions all running Claude Code for different codebases.

When I'm away from a keyboard, I use my phone to SSH or use Claude Code remote control to control active sessions across my dev instances.

## Networking it all together

I've set up [Tailscale](https://tailscale.com/), which brings my Macbook Pro, Hetzner instance and my phone into the same network, and makes SSHing into the dev instances pretty convenient.

On my iPhone I use [Termius](https://termius.com/) to SSH into my Macbook or Hetzner instance when needed. I use this sometimes to spin up new sessions for exploratory stuff.
