import { expect, test } from 'vitest'
import worker from './worker.ts'

const request = new Request('https://template.test/api/rpc', {
  method: 'POST',
  body: '{"method":"ping"}',
})

test('the website Worker forwards API requests through the service binding', async () => {
  const forwarded: Array<Request> = []

  const response = await worker.fetch(request, {
    API: {
      fetch(input) {
        forwarded.push(input)
        return Promise.resolve(new Response('from the API Worker', { status: 202 }))
      },
    },
  })

  expect(forwarded).toHaveLength(1)
  expect(forwarded[0]?.url).toBe('https://template.test/api/rpc')
  expect(response.status).toBe(202)
  expect(await response.text()).toBe('from the API Worker')
})

test('the website Worker refuses a request over the per-IP limit', async () => {
  const forwarded: Array<Request> = []

  const response = await worker.fetch(request, {
    API: {
      fetch(input) {
        forwarded.push(input)
        return Promise.resolve(new Response('from the API Worker'))
      },
    },
    RATE_LIMIT_API: {
      limit: () => Promise.resolve({ success: false }),
    },
  })

  expect(response.status).toBe(429)
  expect(response.headers.get('Retry-After')).toBe('60')
  expect(forwarded).toEqual([])
})

test('the rate limiter fails open', async () => {
  const forwarded: Array<Request> = []

  const response = await worker.fetch(request, {
    API: {
      fetch(input) {
        forwarded.push(input)
        return Promise.resolve(new Response('from the API Worker'))
      },
    },
    RATE_LIMIT_API: {
      limit: () => Promise.reject(new Error('The limiter is down.')),
    },
  })

  expect(response.status).toBe(200)
  expect(forwarded).toHaveLength(1)
})

test('the website Worker serves lesson files from R2 by decoded key, with a range', async () => {
  const keys: Array<string> = []
  const api = { fetch: () => Promise.resolve(new Response('api')) }
  const DATA = {
    get(key: string) {
      keys.push(key)
      return Promise.resolve(
        key.endsWith('.mp3')
          ? {
              body: new Blob(['abc']).stream(),
              httpEtag: '"e"',
              size: 10,
              range: { offset: 2, length: 3 },
              writeHttpMetadata: (headers: Headers) => headers.set('content-type', 'audio/mpeg'),
            }
          : null,
      )
    },
  }

  const audio = await worker.fetch(
    new Request('https://template.test/data/elementary01/L01/audio/Y_%5B01-01%5D_kaiwa1.mp3', {
      headers: { range: 'bytes=2-4' },
    }),
    { API: api, DATA },
  )
  expect(keys).toEqual(['elementary01/L01/audio/Y_[01-01]_kaiwa1.mp3'])
  expect(audio.status).toBe(206)
  expect(audio.headers.get('content-range')).toBe('bytes 2-4/10')
  expect(audio.headers.get('cache-control')).toContain('immutable')

  const missing = await worker.fetch(
    new Request('https://template.test/data/elementary01/none.json'),
    { API: api, DATA },
  )
  expect(missing.status).toBe(404)
  const noBucket = await worker.fetch(new Request('https://template.test/data/x.json'), {
    API: api,
  })
  expect(noBucket.status).toBe(503)
})
