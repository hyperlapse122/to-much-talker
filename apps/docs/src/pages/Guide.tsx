import type { JSX } from 'react'
import { useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const CONTENT: Record<string, string> = {
  setup: `# Setup Guide

## Prerequisites

- Node.js 24+
- Discord bot token from https://discord.com/developers/applications
- Optional OpenRouter API key from https://openrouter.ai/keys

## Installation

\`\`\`bash
git clone https://github.com/owner/to-much-talker
cd to-much-talker
yarn install
yarn workspace @to-much-talker/server build
\`\`\`

## Create the Discord Bot

1. Create an application in the Discord Developer Portal.
2. Open **Bot**, create or reset the token, and copy it to \`DISCORD_TOKEN\`.
3. Enable **Message Content Intent** under **Privileged Gateway Intents**.
4. Open **OAuth2**, copy the client ID to \`DISCORD_CLIENT_ID\`.
5. In **OAuth2 > URL Generator**, select \`bot\` and \`applications.commands\` scopes.
6. Select **View Channels**, **Send Messages**, **Read Message History**, **Connect**, and **Speak**, then invite the bot with the generated URL.

## Configuration

Copy \`.env.example\` to \`apps/server/.env\` and configure:

| Variable | Required | Description |
|---|---|---|
| DISCORD_TOKEN | Yes | Bot token |
| DISCORD_CLIENT_ID | Yes | Application ID |
| MASTER_ENC_KEY | Yes | Run: \`yarn workspace @to-much-talker/server key:gen\` |
| OPENROUTER_API_KEY | No | Optional default OpenRouter key |

## Starting the Bot

\`\`\`bash
# Generate key and configure env
yarn workspace @to-much-talker/server key:gen
cp .env.example apps/server/.env
# Fill in apps/server/.env

# Run migrations
yarn workspace @to-much-talker/server migrate

# Start
yarn workspace @to-much-talker/server dev
\`\`\`
`,
  commands: `# Commands Reference

## /tts join

Join your voice channel.

**Usage**: \`/tts join\`

## /tts leave

Leave the voice channel.

**Usage**: \`/tts leave\`

## /tts say \`<text>\`

Queue a TTS message.

**Usage**: \`/tts say Hello world\`

## /tts skip

Skip the current track.

## /tts clear

Clear the queue.

## /tts stats

Show queue stats.

## /tts settings

Manage server/channel/user settings.

## /tts setup

Run the setup wizard (admin only).
`,
}

export function Guide(): JSX.Element {
  const { slug } = useParams<{ slug: string }>()
  const content = slug !== undefined ? CONTENT[slug] : undefined

  if (content === undefined) {
    return (
      <div>
        <h1>Page not found: {slug}</h1>
      </div>
    )
  }

  return (
    <article>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </article>
  )
}
