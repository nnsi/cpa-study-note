import { describe, it, expect } from "vitest"
import { sanitizeFilename, validateMagicBytes } from "./usecase"

describe("sanitizeFilename", () => {
  it("正常なファイル名はそのまま返す", () => {
    expect(sanitizeFilename("test.jpg")).toBe("test.jpg")
    expect(sanitizeFilename("my-image_2024.png")).toBe("my-image_2024.png")
    expect(sanitizeFilename("file123.gif")).toBe("file123.gif")
  })

  it("パストラバーサル攻撃を防ぐ（../、..\\）", () => {
    // Unix形式のパストラバーサル
    expect(sanitizeFilename("../../../etc/passwd")).toBe("passwd")
    expect(sanitizeFilename("../../secret.jpg")).toBe("secret.jpg")
    expect(sanitizeFilename("foo/../bar/image.png")).toBe("image.png")

    // Windows形式のパストラバーサル
    expect(sanitizeFilename("..\\..\\..\\windows\\system32")).toBe("system32")
    expect(sanitizeFilename("..\\secret.jpg")).toBe("secret.jpg")
    expect(sanitizeFilename("foo\\..\\bar\\image.png")).toBe("image.png")

    // 混合形式
    expect(sanitizeFilename("../..\\../mixed/path.jpg")).toBe("path.jpg")
  })

  it("特殊文字を除去する（<>:\"|?*、制御文字）", () => {
    // Windows禁止文字
    expect(sanitizeFilename("file<name>.jpg")).toBe("file_name_.jpg")
    expect(sanitizeFilename('test:file|name?.png')).toBe("test_file_name_.png")
    expect(sanitizeFilename('image"test*.gif')).toBe("image_test_.gif")

    // 制御文字（ASCII 0-31）
    expect(sanitizeFilename("file\x00name.jpg")).toBe("file_name.jpg")
    expect(sanitizeFilename("test\x1fimage.png")).toBe("test_image.png")
    expect(sanitizeFilename("image\ttab.gif")).toBe("image_tab.gif")
    expect(sanitizeFilename("test\nnewline.jpg")).toBe("test_newline.jpg")

    // 日本語やスペース（「テスト画像」は5文字）
    expect(sanitizeFilename("テスト画像.jpg")).toBe("_____.jpg")
    expect(sanitizeFilename("my image file.png")).toBe("my_image_file.png")
  })

  it("空文字・空白のみの場合はデフォルト値を返す", () => {
    expect(sanitizeFilename("")).toBe("file")
    expect(sanitizeFilename("   ")).toBe("___")
    expect(sanitizeFilename("/")).toBe("file")
    expect(sanitizeFilename("\\")).toBe("file")
    expect(sanitizeFilename("../")).toBe("file")
  })
})

describe("validateMagicBytes", () => {
  // 各形式のマジックバイト定義
  const JPEG_MAGIC = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])
  const PNG_MAGIC = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const GIF_MAGIC = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]) // GIF89a
  const WEBP_MAGIC = new Uint8Array([
    0x52, 0x49, 0x46, 0x46, // RIFF
    0x00, 0x00, 0x00, 0x00, // file size (placeholder)
    0x57, 0x45, 0x42, 0x50, // WEBP
  ])

  it("JPEG形式を正しく検証する", () => {
    const buffer = JPEG_MAGIC.buffer
    expect(validateMagicBytes(buffer, "image/jpeg")).toBe(true)
  })

  it("PNG形式を正しく検証する", () => {
    const buffer = PNG_MAGIC.buffer
    expect(validateMagicBytes(buffer, "image/png")).toBe(true)
  })

  it("GIF形式を正しく検証する", () => {
    const buffer = GIF_MAGIC.buffer
    expect(validateMagicBytes(buffer, "image/gif")).toBe(true)
  })

  it("WebP形式を正しく検証する", () => {
    const buffer = WEBP_MAGIC.buffer
    expect(validateMagicBytes(buffer, "image/webp")).toBe(true)
  })

  it("偽装ファイルを検出する（拡張子とマジックバイト不一致）", () => {
    // PNGデータをJPEGとして検証
    expect(validateMagicBytes(PNG_MAGIC.buffer, "image/jpeg")).toBe(false)

    // JPEGデータをPNGとして検証
    expect(validateMagicBytes(JPEG_MAGIC.buffer, "image/png")).toBe(false)

    // GIFデータをWebPとして検証
    expect(validateMagicBytes(GIF_MAGIC.buffer, "image/webp")).toBe(false)

    // WebPデータをGIFとして検証
    expect(validateMagicBytes(WEBP_MAGIC.buffer, "image/gif")).toBe(false)
  })

  it("不正なバイナリを拒否する", () => {
    // ランダムなバイナリデータ
    const randomBytes = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x05])
    expect(validateMagicBytes(randomBytes.buffer, "image/jpeg")).toBe(false)
    expect(validateMagicBytes(randomBytes.buffer, "image/png")).toBe(false)
    expect(validateMagicBytes(randomBytes.buffer, "image/gif")).toBe(false)
    expect(validateMagicBytes(randomBytes.buffer, "image/webp")).toBe(false)

    // テキストデータ
    const textData = new TextEncoder().encode("This is not an image")
    expect(validateMagicBytes(textData.buffer, "image/jpeg")).toBe(false)

    // HTMLデータ（XSS攻撃の試み）
    const htmlData = new TextEncoder().encode("<script>alert('xss')</script>")
    expect(validateMagicBytes(htmlData.buffer, "image/png")).toBe(false)
  })

  it("空ファイルを拒否する", () => {
    const emptyBuffer = new ArrayBuffer(0)
    expect(validateMagicBytes(emptyBuffer, "image/jpeg")).toBe(false)
    expect(validateMagicBytes(emptyBuffer, "image/png")).toBe(false)
    expect(validateMagicBytes(emptyBuffer, "image/gif")).toBe(false)
    expect(validateMagicBytes(emptyBuffer, "image/webp")).toBe(false)
  })

  it("サイズ不足のファイルを拒否する（バッファが短い場合）", () => {
    // JPEGは3バイト必要だが2バイトしかない
    const shortJpeg = new Uint8Array([0xff, 0xd8])
    expect(validateMagicBytes(shortJpeg.buffer, "image/jpeg")).toBe(false)

    // PNGは4バイト必要だが3バイトしかない
    const shortPng = new Uint8Array([0x89, 0x50, 0x4e])
    expect(validateMagicBytes(shortPng.buffer, "image/png")).toBe(false)

    // GIFは3バイト必要だが2バイトしかない
    const shortGif = new Uint8Array([0x47, 0x49])
    expect(validateMagicBytes(shortGif.buffer, "image/gif")).toBe(false)

    // WebPは4バイト必要だが3バイトしかない
    const shortWebp = new Uint8Array([0x52, 0x49, 0x46])
    expect(validateMagicBytes(shortWebp.buffer, "image/webp")).toBe(false)

    // 1バイトだけ
    const singleByte = new Uint8Array([0xff])
    expect(validateMagicBytes(singleByte.buffer, "image/jpeg")).toBe(false)
  })

  it("サポートされていないMIMEタイプを拒否する", () => {
    const validPng = PNG_MAGIC.buffer
    expect(validateMagicBytes(validPng, "image/bmp")).toBe(false)
    expect(validateMagicBytes(validPng, "image/tiff")).toBe(false)
    expect(validateMagicBytes(validPng, "application/pdf")).toBe(false)
    expect(validateMagicBytes(validPng, "text/html")).toBe(false)
    expect(validateMagicBytes(validPng, "")).toBe(false)
  })
})
