---
title: Commands Reference
description: All slash commands
order: 2
---

# Commands Reference

## /tts join
Join your current voice channel and read messages from that voice channel's chat.
**Usage**: `/tts join`

## /tts leave
Leave the voice channel.
**Usage**: `/tts leave`

## /tts say
Read a message aloud.
**Usage**: `/tts say message:<text>`

## /tts settings api-key
Store or replace the server OpenRouter API key. The key is submitted through a modal and encrypted at rest.
**Usage**: `/tts settings api-key`

## /tts settings server-max-chars
View, set, or reset the server-wide TTS message length limit. The allowed range is 1 to 2000 characters; reset restores the default of 500.
**Usage**: `/tts settings server-max-chars value:<characters>` or `/tts settings server-max-chars reset:true`

## /tts settings channel-max-chars
View, set, or reset the current channel's TTS message length limit. Channel limits must be less than or equal to the server limit; reset clears the channel override.
**Usage**: `/tts settings channel-max-chars value:<characters>` or `/tts settings channel-max-chars reset:true`
