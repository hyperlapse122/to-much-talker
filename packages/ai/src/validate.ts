import type { Result } from '@to-much-talker/shared'
import { UpstreamError } from '@to-much-talker/shared'
import type { OpenRouterClient } from './client.js'

export interface ModelInfo {
  readonly id: string
  readonly name: string
  readonly pricing?: {
    readonly prompt: string
    readonly completion: string
  }
}

export interface ValidateModelResult {
  readonly exists: boolean
  readonly model?: ModelInfo
}

export async function validateModel(
  client: OpenRouterClient,
  modelId: string,
): Promise<Result<ValidateModelResult, UpstreamError>> {
  try {
    const response = await client.openai.models.list()

    // Look up the model by id
    const model = response.data.find((m) => m.id === modelId)

    if (model === undefined) {
      return { ok: true, value: { exists: false } }
    }

    return {
      ok: true,
      value: {
        exists: true,
        model: {
          id: model.id,
          name: (model as { name?: string }).name ?? model.id,
        },
      },
    }
  } catch (cause) {
    return {
      ok: false,
      error: new UpstreamError(
        `Failed to validate model ${modelId}: ${cause instanceof Error ? cause.message : String(cause)}`,
        cause,
      ),
    }
  }
}
