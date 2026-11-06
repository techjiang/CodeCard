/**
 * 最小 zip 打包器（store / deflate），不引第三方依赖。
 *
 * CI 镜像里不一定有 `zip` 命令，而 Release 产物必须是能双击解压的 zip，
 * 所以自己按 PKZIP 规范拼一份：本地文件头 + 数据 + 中央目录 + 结尾记录。
 */
import { deflateRawSync } from 'node:zlib'
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[i] = c
  }
  return table
})()

function crc32(buffer) {
  let crc = -1
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ -1) >>> 0
}

/** 把目录或文件收成 [{ abs, name }]，`name` 是 zip 内的相对路径 */
function collect(entries, base, skip = () => false) {
  const out = []
  const walk = (path) => {
    const stat = statSync(path)
    if (stat.isDirectory()) {
      for (const child of readdirSync(path)) {
        const abs = join(path, child)
        if (skip(abs)) continue
        walk(abs)
      }
    } else {
      out.push({ abs: path, name: relative(base, path).split(sep).join('/') })
    }
  }
  for (const entry of entries) walk(entry)
  return out
}

/**
 * @param {string} output 输出 zip 路径
 * @param {Array<string | { from: string, to: string }>} entries 要打包的路径（文件或目录）
 * @param {{ skip?: (abs: string) => boolean }} [options]
 */
export function zip(output, entries, options = {}) {
  const { skip } = options
  const base = process.cwd()
  const files = collect(
    entries.map((e) => join(base, e)),
    base,
    skip ? (abs) => skip(abs) : undefined,
  )

  const chunks = []
  const central = []
  let offset = 0

  for (const file of files) {
    const raw = readFileSync(file.abs)
    const deflated = deflateRawSync(raw, { level: 9 })
    // 压缩后反而更大就存原文
    const stored = deflated.length >= raw.length
    const body = stored ? raw : deflated
    const nameBytes = Buffer.from(file.name, 'utf8')
    const crc = crc32(raw)
    const method = stored ? 0 : 8
    // 固定时间戳（1980-01-01），同样的源码永远打出同样的字节，便于比对
    const time = 0
    const date = 0x21 // 1980-01-01

    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4) // 解压所需版本 2.0
    local.writeUInt16LE(0x0800, 6) // 文件名按 UTF-8 解
    local.writeUInt16LE(method, 8)
    local.writeUInt16LE(time, 10)
    local.writeUInt16LE(date, 12)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(body.length, 18)
    local.writeUInt32LE(raw.length, 22)
    local.writeUInt16LE(nameBytes.length, 26)
    local.writeUInt16LE(0, 28)

    chunks.push(local, nameBytes, body)

    const entry = Buffer.alloc(46)
    entry.writeUInt32LE(0x02014b50, 0)
    entry.writeUInt16LE(20, 4)
    entry.writeUInt16LE(20, 6)
    entry.writeUInt16LE(0x0800, 8)
    entry.writeUInt16LE(method, 10)
    entry.writeUInt16LE(time, 12)
    entry.writeUInt16LE(date, 14)
    entry.writeUInt32LE(crc, 16)
    entry.writeUInt32LE(body.length, 20)
    entry.writeUInt32LE(raw.length, 24)
    entry.writeUInt16LE(nameBytes.length, 28)
    entry.writeUInt16LE(0, 30) // extra
    entry.writeUInt16LE(0, 32) // comment
    entry.writeUInt16LE(0, 34) // disk
    entry.writeUInt16LE(0, 36) // internal attr
    entry.writeUInt32LE(0, 38) // external attr
    entry.writeUInt32LE(offset, 42)
    central.push(entry, nameBytes)

    offset += local.length + nameBytes.length + body.length
  }

  const centralBuf = Buffer.concat(central)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(0, 4)
  end.writeUInt16LE(0, 6)
  end.writeUInt16LE(files.length, 8)
  end.writeUInt16LE(files.length, 10)
  end.writeUInt32LE(centralBuf.length, 12)
  end.writeUInt32LE(offset, 16)
  end.writeUInt16LE(0, 20)

  writeFileSync(output, Buffer.concat([...chunks, centralBuf, end]))
  return files.length
}
