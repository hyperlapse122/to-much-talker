# To Much Talker

> Discord TTS bot powered by OpenRouter (Gemini Flash TTS / GPT-4o Mini TTS)

[![CI](https://github.com/hyperlapse122/to-much-talker/actions/workflows/ci.yml/badge.svg)](https://github.com/hyperlapse122/to-much-talker/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## Quick Start

See [apps/server/README.md](apps/server/README.md) and the docs app for the full setup guide.

### Prerequisites

- Node.js 24+
- Yarn 4+
- Docker (for production deployment)

### Development

```bash
yarn install
yarn workspace @to-much-talker/server key:gen
cp .env.example apps/server/.env
# Fill in apps/server/.env, then run:
yarn workspace @to-much-talker/server migrate
yarn workspace @to-much-talker/server dev
```
