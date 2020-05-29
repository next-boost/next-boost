import { RequestListener } from '../renderer'

export default async function init(
  args: Record<string, unknown>
): Promise<RequestListener> {
  const app = require('next')(args)
  await app.prepare()
  return app.getRequestHandler()
}
