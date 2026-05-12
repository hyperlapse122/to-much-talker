---
title: Setup Guide
description: How to set up To Much Talker
order: 1
---

# Setup Guide

## Prerequisites
- Node.js 24+
- Discord bot token from https://discord.com/developers/applications
- OpenRouter API key from https://openrouter.ai/keys

## Installation
```bash
git clone https://github.com/owner/to-much-talker
cd to-much-talker
yarn install
yarn workspace @to-much-talker/server build
```

## Configuration
Copy `.env.example` to `.env` and configure:

| Variable | Required | Description |
|---|---|---|
| DISCORD_TOKEN | Yes | Bot token |
| DISCORD_CLIENT_ID | Yes | Application ID |
| MASTER_ENC_KEY | Yes | Run: `node dist/index.js key gen` |
| OPENROUTER_API_KEY | Yes | OpenRouter key |

## Starting the Bot
```bash
# Run migrations
NODE_ENV=development node --env-file=.env dist/index.js migrate

# Start
yarn workspace @to-much-talker/server start
```
