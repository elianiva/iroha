import { Effect } from 'effect'
import { Command } from 'foldkit'
import { emptyProgress, Progress } from './progress-schema.ts'
import { Message } from './state.ts'

const KEY = 'irodori.progress.v1'

export const LoadProgress = Command.define('LoadProgress', {
  messages: [Message.LoadedProgress],
  execute: Effect.sync(() => {
    let progress = emptyProgress
    try {
      const raw: unknown = JSON.parse(globalThis.localStorage?.getItem(KEY) ?? 'null')
      if (typeof raw === 'object' && raw !== null) {
        const r = raw as Partial<Record<keyof Progress, unknown>>
        progress = {
          done: Array.isArray(r.done)
            ? r.done.filter((x): x is string => typeof x === 'string')
            : [],
          xp: typeof r.xp === 'number' ? r.xp : 0,
          streak: typeof r.streak === 'number' ? r.streak : 0,
          lastDay: typeof r.lastDay === 'string' ? r.lastDay : '',
        }
      }
    } catch {
      progress = emptyProgress
    }
    return Message.LoadedProgress({ progress, today: new Date().toISOString().slice(0, 10) })
  }),
})

export const SaveProgress = Command.define('SaveProgress', {
  args: { progress: Progress },
  messages: [Message.Navigated],
  execute: ({ progress }) =>
    Effect.sync(() => {
      globalThis.localStorage?.setItem(KEY, JSON.stringify(progress))
      return Message.Navigated()
    }),
})
