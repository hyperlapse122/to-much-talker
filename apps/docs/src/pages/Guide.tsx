import type { JSX } from 'react'
import { useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const CONTENT: Record<string, string> = {
  setup: `# Setup Guide

## Prerequisites

- Node.js 24+
- Discord bot token from https://discord.com/developers/applications
- OpenRouter API key from https://openrouter.ai/keys

## Installation

\`\`\`bash
git clone https://github.com/owner/to-much-talker
cd to-much-talker
yarn install
yarn workspace @to-much-talker/server build
\`\`\`

## Configuration

Copy \`.env.example\` to \`.env\` and configure:

| Variable | Required | Description |
|---|---|---|
| DISCORD_TOKEN | Yes | Bot token |
| DISCORD_CLIENT_ID | Yes | Application ID |
| MASTER_ENC_KEY | Yes | Run: \`node dist/index.js key gen\` |
| OPENROUTER_API_KEY | Yes | OpenRouter key |

## Starting the Bot

\`\`\`bash
# Run migrations
NODE_ENV=development node --env-file=.env dist/index.js migrate

# Start
yarn workspace @to-much-talker/server start
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
