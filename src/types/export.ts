export type ExportScale = 1 | 2 | 3

export interface ExportOptions {
  scale: ExportScale
}

export interface ExportResult {
  blob: Blob
  width: number
  height: number
  filename: string
}
