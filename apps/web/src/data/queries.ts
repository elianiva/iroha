import { Effect, Schema } from 'effect'
import { Query } from 'foldkit/experimental'
import type { BookIndex, Lesson } from './types.ts'

/** Where the JSON, audio and pictures are served: R2 behind `/data/*` (see `src/worker.ts`). */
export const DATA = '/data'
export const BOOK = 'elementary01'

const lessonFolder = (n: number): string => `L${String(n).padStart(2, '0')}`
export const lessonUrl = (n: number, path: string): string =>
  `${DATA}/${BOOK}/${lessonFolder(n)}/${path.split('/').map(encodeURIComponent).join('/')}`

const getJson = (url: string) =>
  Effect.tryPromise({
    try: async () => {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`)
      return (await response.json()) as unknown
    },
    catch: (error) => (error instanceof Error ? error.message : String(error)),
  })

/** The data is written by our own tool, so a shallow check is enough at the boundary. */
const object = <A extends object>() =>
  Schema.declare<A>((value): value is A => typeof value === 'object' && value !== null)

export const indexQuery = Query.define({
  name: 'BookIndex',
  data: object<BookIndex>(),
  error: Schema.String,
  execute: getJson(`${DATA}/${BOOK}/index.json`).pipe(Effect.map((json) => json as BookIndex)),
})

export const lessonQuery = Query.define({
  name: 'Lesson',
  data: object<Lesson>(),
  error: Schema.String,
  args: { number: Schema.Finite },
  execute: ({ number }) =>
    getJson(lessonUrl(number, 'lesson.json')).pipe(Effect.map((json) => json as Lesson)),
})
