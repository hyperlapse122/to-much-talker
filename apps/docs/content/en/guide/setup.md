---
title: Setup Guide
description: How to set up To Much Talker — Docker quick start and source build
order: 1
---

# Setup Guide

Two paths are supported:

- **Docker** (recommended for production) — pull a prebuilt image from GHCR.
- **From source** (recommended for development) — clone and run with Yarn.

Both paths require the same Discord bot setup and the same three secrets.

## Prerequisites

- A Discord bot — see [Create a Discord Bot](#create-a-discord-bot) below.
- Either:
  - **Docker 25+** (for the Docker path), or
  - **Node.js 24+** and **Yarn 4+** (for the source path).

## Create a Discord Bot

1. Open the [Discord Developer Portal](https://discord.com/developers/applications) and create an application.
2. Under **Bot**, create or reset the bot token. Save it — you will paste it into `DISCORD_TOKEN`.
3. Under **Bot > Privileged Gateway Intents**, enable **Message Content Intent**. The bot needs this to read text messages for TTS.
4. Under **OAuth2**, copy the **Application/Client ID**. You will paste it into `DISCORD_CLIENT_ID`.
5. Under **OAuth2 > URL Generator**, select scopes `bot` and `applications.commands`.
6. Select bot permissions: **View Channels**, **Send Messages**, **Read Message History**, **Connect**, and **Speak**.
7. Invite the bot to your test server with the generated URL.

Keep the token private. Never commit `.env`.

## Required Environment Variables

The server validates its environment at startup with a zod schema in `@to-much-talker/config`. It fails fast and prints a precise error if anything is missing or malformed, so misconfiguration never silently degrades.

### The three required secrets

| Variable | Format | Where to get it |
|---|---|---|
| `DISCORD_TOKEN` | non-empty string | **Bot** tab of the Discord Developer Portal |
| `DISCORD_CLIENT_ID` | 17–20 digit Discord snowflake | **OAuth2** tab — the application/client ID |
| `MASTER_ENC_KEY` | base64 of exactly 32 bytes | Generate it — see below |

### Generate the master key

`MASTER_ENC_KEY` is the AES-256-GCM master key that encrypts per-guild BYOK OpenRouter keys at rest.

```bash
# From inside the repo (uses Node's crypto module):
yarn workspace @to-much-talker/server key:gen

# Or, anywhere with OpenSSL:
openssl rand -base64 32
```

> Losing or rotating `MASTER_ENC_KEY` makes existing per-guild BYOK keys **unrecoverable**. Store it like any other production secret. To rotate without data loss, increment `MASTER_ENC_KEY_VERSION` and keep the previous key available — old versions stay readable for decryption.

### Optional variables (all have safe defaults)

| Variable | Default | Notes |
|---|---|---|
| `MASTER_ENC_KEY_VERSION` | `1` | Positive integer. Increment when rotating keys. |
| `DATABASE_URL` | `sqlite://./data/bot.db` | Also accepts `file:`, `postgres://`, `postgresql://`. Inside the container the default resolves to `/app/data/bot.db`. |
| `OPENROUTER_API_KEY` | — | Currently not read at startup; per-guild BYOK takes precedence. |
| `LOG_LEVEL` | `info` | `trace` / `debug` / `info` / `warn` / `error` / `fatal` / `silent` (pino). |
| `TOTAL_SHARDS` | `auto` | `auto`, or a positive integer to pin shard count. |
| `CLUSTER_COUNT` | `1` | Number of cluster processes. |
| `IDLE_TEXT_INACTIVITY_MS` | `300000` | Voice-channel idle leave timer (text inactivity). |
| `IDLE_LEAVE_ON_EMPTY` | `true` | Leave when the voice channel empties. |

`NODE_ENV` is already set to `production` inside the Docker image and does not need to be supplied.

## Run with Docker (recommended)

Prebuilt images are published to **GitHub Container Registry**. They are multi-arch (`linux/amd64` + `linux/arm64`).

### Pull the image

```bash
docker pull ghcr.io/hyperlapse122/to-much-talker/server:latest
```

### Image tags

| Tag pattern | When it is published |
|---|---|
| `main` | every push to the `main` branch |
| `<major>.<minor>.<patch>` (e.g. `0.1.0`) | each git tag starting with `v` |
| `<major>.<minor>` (e.g. `0.1`) | derived from the same git tags |

Pin to a specific version in production. Use `latest` only when you want the bleeding edge.

### Run it

```bash
# 1. Create an env file with the three required secrets
cat > server.env <<'EOF'
DISCORD_TOKEN=your-bot-token
DISCORD_CLIENT_ID=123456789012345678
MASTER_ENC_KEY=base64-32-byte-key-from-openssl
LOG_LEVEL=info
EOF

# 2. Run the bot with a persistent volume for the SQLite database
docker run -d --name tmt-server \
  --env-file server.env \
  -v tmt-data:/app/data \
  ghcr.io/hyperlapse122/to-much-talker/server:latest
```

The container entrypoint is `dumb-init -- node apps/server/dist/index.js start`. SQLite data lives at `/app/data` — mount a named volume (or a host path) so it persists across container restarts.

### Docker Compose

A reference [`docker-compose.yml`](https://github.com/hyperlapse122/to-much-talker/blob/main/docker-compose.yml) is provided at the repository root. It supports two profiles (`bot` and `postgres`) and reads `.env`. Pin the image tag in production rather than using `latest`.

## Run from Source (development)

```bash
git clone https://github.com/hyperlapse122/to-much-talker
cd to-much-talker
yarn install

# Generate the master key
yarn workspace @to-much-talker/server key:gen

# Configure the env file
cp .env.example apps/server/.env
# then fill in DISCORD_TOKEN, DISCORD_CLIENT_ID, MASTER_ENC_KEY

# Run database migrations
yarn workspace @to-much-talker/server migrate

# Build, then start the built artifact
yarn workspace @to-much-talker/server build
yarn workspace @to-much-talker/server start
```

For an iterative dev loop, use `yarn workspace @to-much-talker/server dev`. Production runtime must always go through `build` + `start`, never `dev` or `tsx` — see the root `AGENTS.md` rule.
