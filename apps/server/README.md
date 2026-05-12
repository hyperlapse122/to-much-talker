# @to-much-talker/server

Discord TTS bot powered by OpenRouter (Gemini Flash TTS / GPT-4o Mini TTS).

## Prerequisites

- Node.js 24+
- Docker (for production)
- An OpenRouter API key: https://openrouter.ai/keys

## Quick Start

### 1. Generate encryption key

```bash
node dist/index.js key gen
# Copy this value to MASTER_ENC_KEY in your .env
```

### 2. Configure environment

```bash
cp ../../.env.example .env
# Fill in DISCORD_TOKEN, DISCORD_CLIENT_ID, MASTER_ENC_KEY, OPENROUTER_API_KEY
```

### 3. Run migrations

```bash
node --env-file=.env dist/index.js migrate
```

### 4. Start the bot

```bash
yarn dev   # Development (tsx watch)
yarn start # Production
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
