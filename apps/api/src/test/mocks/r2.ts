/**
 * R2Bucket のインメモリモック
 * テスト用に put/get/delete/head のみ実装
 */

type R2ObjectMeta = {
  key: string
  size: number
  etag: string
  httpMetadata?: R2HTTPMetadata
  customMetadata?: Record<string, string>
  uploaded: Date
}

type MockR2Object = {
  body: ArrayBuffer
  meta: R2ObjectMeta
}

export const createMockR2Bucket = (): R2Bucket => {
  const storage = new Map<string, MockR2Object>()

  const createR2Object = (key: string, obj: MockR2Object): R2Object => {
    return {
      key,
      version: "mock-version",
      size: obj.meta.size,
      etag: obj.meta.etag,
      httpEtag: `"${obj.meta.etag}"`,
      uploaded: obj.meta.uploaded,
      httpMetadata: obj.meta.httpMetadata ?? {},
      customMetadata: obj.meta.customMetadata ?? {},
      checksums: { toJSON: () => ({}) },
      storageClass: "STANDARD",
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(obj.body))
          controller.close()
        },
      }),
      bodyUsed: false,
      arrayBuffer: async () => obj.body,
      text: async () => new TextDecoder().decode(obj.body),
      json: async () => JSON.parse(new TextDecoder().decode(obj.body)),
      blob: async () => new Blob([obj.body]),
      writeHttpMetadata: () => {},
    } as R2Object
  }

  const createR2ObjectBody = (key: string, obj: MockR2Object): R2ObjectBody => {
    return createR2Object(key, obj) as R2ObjectBody
  }

  return {
    head: async (key: string): Promise<R2Object | null> => {
      const obj = storage.get(key)
      if (!obj) return null
      return createR2Object(key, obj)
    },

    get: async (
      key: string,
      _options?: R2GetOptions
    ): Promise<R2ObjectBody | null> => {
      const obj = storage.get(key)
      if (!obj) return null
      return createR2ObjectBody(key, obj)
    },

    put: async (
      key: string,
      value: ArrayBuffer | ReadableStream | string | Blob | null,
      options?: R2PutOptions
    ): Promise<R2Object> => {
      let body: ArrayBuffer
      if (value === null) {
        body = new ArrayBuffer(0)
      } else if (value instanceof ArrayBuffer) {
        body = value
      } else if (typeof value === "string") {
        body = new TextEncoder().encode(value).buffer as ArrayBuffer
      } else if (value instanceof Blob) {
        body = await value.arrayBuffer()
      } else {
        // ReadableStream
        const reader = value.getReader()
        const chunks: Uint8Array[] = []
        let done = false
        while (!done) {
          const result = await reader.read()
          done = result.done
          if (result.value) chunks.push(result.value)
        }
        const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
        const combined = new Uint8Array(totalLength)
        let offset = 0
        for (const chunk of chunks) {
          combined.set(chunk, offset)
          offset += chunk.length
        }
        body = combined.buffer as ArrayBuffer
      }

      const meta: R2ObjectMeta = {
        key,
        size: body.byteLength,
        etag: `mock-etag-${Date.now()}`,
        httpMetadata: options?.httpMetadata,
        customMetadata: options?.customMetadata,
        uploaded: new Date(),
      }

      storage.set(key, { body, meta })
      return createR2Object(key, { body, meta })
    },

    delete: async (keys: string | string[]): Promise<void> => {
      const keyArray = Array.isArray(keys) ? keys : [keys]
      for (const key of keyArray) {
        storage.delete(key)
      }
    },

    list: async (options?: R2ListOptions): Promise<R2Objects> => {
      const prefix = options?.prefix ?? ""
      const limit = options?.limit ?? 1000
      const objects: R2Object[] = []

      for (const [key, obj] of storage) {
        if (key.startsWith(prefix)) {
          objects.push(createR2Object(key, obj))
          if (objects.length >= limit) break
        }
      }

      return {
        objects,
        truncated: objects.length >= limit,
        delimitedPrefixes: [],
      }
    },

    createMultipartUpload: async (): Promise<R2MultipartUpload> => {
      throw new Error("createMultipartUpload is not implemented in mock")
    },

    resumeMultipartUpload: (): R2MultipartUpload => {
      throw new Error("resumeMultipartUpload is not implemented in mock")
    },
  } as R2Bucket
}
