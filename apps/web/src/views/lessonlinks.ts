import type { BookIndex, Chapter, Lesson, LessonSummary, SectionInfo } from '../data/types.ts'

export const lessonHref = (n: number, section?: string): string =>
  section ? `/lesson/${n}/${section}` : `/lesson/${n}`

/** The pages of a lesson, from the lesson itself so a page never lists what it cannot show. */
export const sectionsOf = (lesson: Lesson): ReadonlyArray<SectionInfo> => [
  ...lesson.activities.map((a): SectionInfo => ({
    id: `activity-${a.number}`,
    kind: 'activity',
    title: a.title,
    can_do: a.can_do,
    can_do_en: a.can_do_en,
  })),
  ...(lesson.kanji.words.length ? [{ id: 'kanji', kind: 'kanji' } as const] : []),
  ...(lesson.notes.length ? [{ id: 'grammar', kind: 'grammar' } as const] : []),
  ...(lesson.scripts.length ? [{ id: 'scripts', kind: 'scripts' } as const] : []),
]

export const sectionLabel = (s: SectionInfo): string =>
  s.kind === 'activity'
    ? `Activity ${s.id.replace('activity-', '')}`
    : s.kind === 'kanji'
      ? '漢字'
      : s.kind === 'grammar'
        ? 'Grammar'
        : 'Scripts'

export const findLesson = (
  index: BookIndex,
  n: number,
): { chapter: Chapter; lesson: LessonSummary } | undefined => {
  for (const chapter of index.chapters) {
    const lesson = chapter.lessons.find((l) => l.number === n)
    if (lesson) return { chapter, lesson }
  }
  return undefined
}
