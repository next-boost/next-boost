export type PagePayload = {
  headers: any
  body: Buffer
}

const MAGIC = Buffer.from('%NB%')
const LENGTH_SIZE = 4

/**
 * Package the headers and body of a page to a binary format.
 * The format will be `%NB%` + length of the headers + headers + body.
 *
 * @param payload The page payload.
 * @returns The binary payload.
 */
export function encodePayload({ headers, body }: PagePayload): Buffer {
  const headerBuffer = Buffer.from(JSON.stringify(headers))
  const headerLength = Buffer.alloc(LENGTH_SIZE)
  headerLength.writeUInt32BE(headerBuffer.length, 0)
  return Buffer.concat([MAGIC, headerLength, headerBuffer, body ? body : Buffer.alloc(0)])
}

/**
 * Read the headers and body of a page from a binary payload.
 *
 * @param payload The binary payload.
 * @returns The page payload.
 */
export function decodePayload(payload: Buffer | undefined): PagePayload {
  if (!payload) return { headers: {}, body: Buffer.alloc(0) }
  const magic = payload.slice(0, MAGIC.length)
  if (MAGIC.compare(magic) !== 0) throw new Error('Invalid payload')
  const headerLength = payload.readUInt32BE(MAGIC.length)
  const headerBuffer = payload.slice(
    MAGIC.length + LENGTH_SIZE,
    MAGIC.length + LENGTH_SIZE + headerLength,
  )
  const headers = JSON.parse(headerBuffer.toString())
  const body = payload.slice(MAGIC.length + LENGTH_SIZE + headerLength)
  return { headers, body }
}
