export type AIMessage = {
  role: "system" | "user" | "assistant"
  content: string
  imageUrl?: string
}

export type GenerateTextInput = {
  model: string
  messages: AIMessage[]
  temperature?: number
  maxTokens?: number
}

export type StreamTextInput = GenerateTextInput

export type GenerateTextResult = {
  content: string
  usage?: { promptTokens: number; completionTokens: number }
}

export type StreamChunk = {
  type: "text" | "error" | "done" | "session_created"
  content?: string
  error?: string
  messageId?: string
  sessionId?: string
}

export type AIAdapter = {
  generateText: (input: GenerateTextInput) => Promise<GenerateTextResult>
  streamText: (input: StreamTextInput) => AsyncIterable<StreamChunk>
}
