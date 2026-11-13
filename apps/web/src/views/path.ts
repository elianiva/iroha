import type { LessonSummary, SectionInfo } from '../data/types.ts'
import type { Model } from '../app/state.ts'

export const isDone = (model: Model, n: number, section: string): boolean =>
  model.progress.done.includes(`${n}.${section}`)

/** How many pages of a lesson are finished, and how many it has. */
export const lessonStats = (
  model: Model,
  lesson: LessonSummary,
): Readonly<{ done: number; total: number; pct: number }> => {
  const total = lesson.sections.length
  const done = lesson.sections.filter((s) => isDone(model, lesson.number, s.id)).length
  return { done, total, pct: total === 0 ? 0 : (done / total) * 100 }
}

/** Every page of the book in reading order, with whether the learner has finished it. */
export const flatPages = (
  model: Model,
  lessons: ReadonlyArray<LessonSummary>,
): ReadonlyArray<Readonly<{ n: number; s: SectionInfo; done: boolean }>> =>
  lessons.flatMap((l) =>
    l.sections.map((s) => ({ n: l.number, s, done: isDone(model, l.number, s.id) })),
  )

/** The first unfinished page, which is where the learner continues. */
export const nextPage = (
  model: Model,
  lessons: ReadonlyArray<LessonSummary>,
): Readonly<{ n: number; s: SectionInfo }> | undefined =>
  flatPages(model, lessons).find((p) => !p.done)
