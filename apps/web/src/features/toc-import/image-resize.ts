/** 長辺を指定サイズ以内に縮小し、JPEGへ変換する。変換できない場合は元画像を返す。 */
export const downscaleImage = async (
  file: File,
  maxEdge = 2048,
  quality = 0.8
): Promise<File> => {
  let bitmap: ImageBitmap | null = null

  try {
    bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height

    const context = canvas.getContext("2d")
    if (!context) return file
    context.drawImage(bitmap, 0, 0, width, height)

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", quality)
    })
    if (!blob) return file

    const jpegName = file.name.replace(/\.[^.]+$/, "") || "toc-image"
    return new File([blob], `${jpegName}.jpg`, {
      type: "image/jpeg",
      lastModified: file.lastModified,
    })
  } catch {
    return file
  } finally {
    bitmap?.close()
  }
}
