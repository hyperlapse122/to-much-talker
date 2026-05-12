# @to-much-talker/server

Discord TTS bot powered by OpenRouter (Gemini Flash TTS / GPT-4o Mini TTS).

## Prerequisites

- Node.js 24+
- Docker (for production)
- A Discord application and bot token: https://discord.com/developers/applications
- An OpenRouter API key: https://openrouter.ai/keys

## Quick Start

### 1. Generate encryption key

```bash
yarn workspace @to-much-talker/server key:gen
# Copy this value to MASTER_ENC_KEY in your .env
```

### 2. Create and invite the Discord bot

1. Open the Discord Developer Portal and create an application.
2. In **Bot**, create or reset the bot token. Copy it to `DISCORD_TOKEN`.
3. In **Bot > Privileged Gateway Intents**, enable **Message Content Intent**. The bot needs this to read text messages for TTS.
4. In **OAuth2**, copy the **Client ID** to `DISCORD_CLIENT_ID`.
5. In **OAuth2 > URL Generator**, select `bot` and `applications.commands` scopes.
6. Select bot permissions: **View Channels**, **Send Messages**, **Read Message History**, **Connect**, and **Speak**. Use the generated URL to invite the bot to your test server.

Keep the token private. Never commit `.env`.

### 3. Configure environment

```bash
cp .env.example apps/server/.env
# Fill in DISCORD_TOKEN, DISCORD_CLIENT_ID, MASTER_ENC_KEY, and optional OPENROUTER_API_KEY
```

Run workspace commands from the repository root. The server scripts load `apps/server/.env` when Yarn executes them in the server workspace.

### 4. Run migrations

```bash
yarn workspace @to-much-talker/server migrate
```

### 5. Start the bot

```bash
yarn workspace @to-much-talker/server dev   # Development (tsx watch)
yarn workspace @to-much-talker/server build
yarn workspace @to-much-talker/server start # Production bundle
```

### Docker

```bash
docker build -f Dockerfile -t tmt-bot .
docker run --env-file=.env tmt-bot
```

## CLI Reference

```
tmt-bot start                          # Start bot (default)
tmt-bot key gen                        # Generate new master key
tmt-bot key rotate --new-key <base64>  # Rotate master key (Task 18)
tmt-bot migrate                        # Run DB migrations only
```
