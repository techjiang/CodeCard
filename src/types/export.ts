export type ExportScale = 1 | 2 | 3

export type ExportFormat = 'png' | 'svg'

export interface ExportOptions {
  scale: ExportScale
  format?: ExportFormat
}

export interface ExportResult {
  blob: Blob
  width: number
  height: number
  filename: string
  format: ExportFormat
}
