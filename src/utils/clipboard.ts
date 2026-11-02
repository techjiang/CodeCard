export async function copyBlobToClipboard(blob: Blob): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.clipboard) return false
  const ClipboardItemCtor = (globalThis as unknown as { ClipboardItem?: typeof ClipboardItem }).ClipboardItem
  if (!ClipboardItemCtor || typeof ClipboardItemCtor.supports === 'function' && !ClipboardItemCtor.supports('image/png')) {
    return false
  }
  try {
    await navigator.clipboard.write([new ClipboardItemCtor({ 'image/png': blob })])
    return true
  } catch {
    return false
  }
}

export async function copyText(text: string): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.clipboard) return false
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
