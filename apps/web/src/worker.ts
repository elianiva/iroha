import * as Sentry from '@sentry/cloudflare'

interface ApiBinding {
  fetch(request: Request): Promise<Response>
}

/** The part of Cloudflare's Rate Limit binding this Worker uses. */
interface RateLimitBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>
}

/** The part of an R2 bucket this Worker reads. */
interface DataBucket {
  get(
    key: string,
    options?: { range?: Headers },
  ): Promise<{
    readonly body: ReadableStream
    readonly httpEtag: string
    readonly size: number
    readonly range?: { offset: number; length: number }
    writeHttpMetadata(headers: Headers): void
  } | null>
}

interface Environment {
  readonly API: ApiBinding
  /** The lesson files: JSON, audio and pictures, uploaded by `pnpm --filter @template/web upload-data`. */
  readonly DATA?: DataBucket
  /** Declared in `alchemy.run.ts`. Local dev without it allows everything. */
  readonly RATE_LIMIT_API?: RateLimitBinding
  /** Without a DSN the Sentry SDK stays off. */
  readonly SENTRY_DSN?: string
  readonly SENTRY_RELEASE?: string
}

/** A limiter that fails open: an outage in the rate limiter must not stop the app. */
const allowed = async (binding: RateLimitBinding | undefined, key: string): Promise<boolean> => {
  if (binding === undefined) return true
  try {
    return (await binding.limit({ key })).success
  } catch {
    return true
  }
}

const tooMany = (): Response =>
  new Response('Too many requests. Try again in a minute.', {
    status: 429,
    headers: { 'Retry-After': '60', 'Content-Type': 'text/plain; charset=utf-8' },
  })

const DATA_PREFIX = '/data/'

/** `/data/elementary01/L01/audio/Y_[01-01]_kaiwa1.mp3` is the R2 key `elementary01/L01/audio/Y_[01-01]_kaiwa1.mp3`. */
const serveData = async (request: Request, bucket: DataBucket | undefined): Promise<Response> => {
  if (bucket === undefined) return new Response('Lesson data is not configured.', { status: 503 })
  if (request.method !== 'GET' && request.method !== 'HEAD')
    return new Response('Method not allowed', { status: 405 })
  const key = decodeURIComponent(new URL(request.url).pathname.slice(DATA_PREFIX.length))
  if (key === '' || key.includes('..')) return new Response('Not found', { status: 404 })
  const object = await bucket.get(
    key,
    request.headers.has('range') ? { range: request.headers } : undefined,
  )
  if (object === null) return new Response('Not found', { status: 404 })
  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set('etag', object.httpEtag)
  headers.set('accept-ranges', 'bytes')
  // Lesson JSON can change when the parser improves; audio and pictures never do.
  headers.set(
    'cache-control',
    key.endsWith('.json') ? 'public, max-age=300' : 'public, max-age=31536000, immutable',
  )
  if (object.range) {
    headers.set(
      'content-range',
      `bytes ${object.range.offset}-${object.range.offset + object.range.length - 1}/${object.size}`,
    )
    return new Response(request.method === 'HEAD' ? null : object.body, { status: 206, headers })
  }
  return new Response(request.method === 'HEAD' ? null : object.body, { headers })
}

/**
 * Only requests under the API prefix reach this module (see `runWorkerFirst`
 * in `alchemy.run.ts`). Every other path is served from the static assets.
 */
export default Sentry.withSentry(
  (env: Environment) => ({
    dsn: env.SENTRY_DSN,
    release: env.SENTRY_RELEASE,
    // Only a browser trace is continued. A request without one starts none.
    tracesSampler: ({ parentSampled }) => (parentSampled ? 1 : 0),
    initialScope: { tags: { service: 'website-worker' } },
  }),
  {
    // The incoming request carries the browser's trace headers. The service binding passes the
    // same headers on, so one trace covers the browser and both Workers.
    async fetch(request: Request, env: Environment): Promise<Response> {
      if (new URL(request.url).pathname.startsWith(DATA_PREFIX)) return serveData(request, env.DATA)
      const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown'
      if (!(await allowed(env.RATE_LIMIT_API, ip))) return tooMany()
      return env.API.fetch(request)
    },
  },
)
