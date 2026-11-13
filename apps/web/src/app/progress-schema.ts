import { Schema } from 'effect'

/** What the learner keeps in this browser: finished pages, XP, and the streak. */
export const Progress = Schema.Struct({
  done: Schema.Array(Schema.String),
  xp: Schema.Finite,
  streak: Schema.Finite,
  lastDay: Schema.String,
})
export type Progress = typeof Progress.Type

export const emptyProgress: Progress = { done: [], xp: 0, streak: 0, lastDay: '' }

const dayBefore = (day: string): string => {
  const date = new Date(`${day}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() - 1)
  return date.toISOString().slice(0, 10)
}

/** Finishing a page today extends yesterday's streak, or starts a new one. */
export const finish = (p: Progress, page: string, xp: number, today: string): Progress => {
  if (p.done.includes(page)) return p
  const streak = p.lastDay === today ? p.streak : p.lastDay === dayBefore(today) ? p.streak + 1 : 1
  return { done: [...p.done, page], xp: p.xp + xp, streak, lastDay: today }
}

/** A streak that was not extended yesterday or today is over. */
export const liveStreak = (p: Progress, today: string): number =>
  p.lastDay === today || p.lastDay === dayBefore(today) ? p.streak : 0
