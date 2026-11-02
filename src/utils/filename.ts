const ILLEGAL = /[\\/:*?"<>|\n\r\t]+/g

export function slugTitle(title: string, fallback = 'codecard'): string {
  const cleaned = (title ?? '').replace(ILLEGAL, ' ').trim().replace(/\s+/g, '-')
  return cleaned.slice(0, 60) || fallback
}

export function buildFileName(title: string, date = new Date(), ext = 'png'): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
  return `${slugTitle(title)}_${stamp}.${ext}`
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
