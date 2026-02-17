import type { AIAdapter } from "./types"
import type { Tracer } from "../tracer"
import { traced } from "../tracer"

export const tracedAIAdapter = (
  adapter: AIAdapter,
  tracer: Tracer,
  spanName: string
): AIAdapter => ({
  generateText: traced(tracer, spanName, adapter.generateText),
  streamText: adapter.streamText, // passthrough（decorator対象外）
})
