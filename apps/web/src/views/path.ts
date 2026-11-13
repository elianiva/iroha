import type { HtmlBuilder } from 'foldkit/html'
import { BookOpen, Check, Headphones, Star } from 'lucide'
import { icon } from '@/lib/icons'
import { cn } from '@/lib/utils'
import type { LessonSummary, SectionInfo } from '../data/types.ts'
import type { Message, Model } from '../app/state.ts'
import { type Child, jp } from '../ui/common.ts'
import { lessonHref, sectionLabel } from './lessonlinks.ts'

type H = HtmlBuilder<Message>

export const isDone = (model: Model, n: number, section: string): boolean =>
  model.progress.done.includes(`${n}.${section}`)

/** Every page of the book in reading order, with whether the learner has finished it. */
export const flatPages = (
  model: Model,
  lessons: ReadonlyArray<LessonSummary>,
): ReadonlyArray<Readonly<{ n: number; s: SectionInfo; done: boolean }>> =>
  lessons.flatMap((l) =>
    l.sections.map((s) => ({ n: l.number, s, done: isDone(model, l.number, s.id) })),
  )

const glyph = (h: H, s: SectionInfo): Child =>
  s.kind === 'activity'
    ? icon(h, Star, 'size-3.5 fill-current')
    : s.kind === 'kanji'
      ? h.span([h.Class('display text-[11px] leading-none')], ['漢'])
      : s.kind === 'grammar'
        ? icon(h, BookOpen, 'size-3.5')
        : icon(h, Headphones, 'size-3.5')

/** A lesson is an interchange: the big double-ringed stop where its pages branch off the line. */
export const lessonStop = (h: H, lesson: LessonSummary): Child =>
  h.a(
    [h.Key(`l${lesson.number}`), h.Href(lessonHref(lesson.number)), h.Class('stn stn-hub')],
    [
      h.span(
        [h.Class('stn-dot hub')],
        [h.span([h.Class('display text-[1.15rem]')], [String(lesson.number)])],
      ),
      h.span(
        [h.Class('stn-card flex flex-col gap-0.5')],
        [
          h.span(
            [h.Class('text-[11px] font-black tracking-widest text-[var(--c)] uppercase')],
            [`Lesson ${lesson.number}`],
          ),
          h.span([h.Class('text-[18px] leading-snug font-black')], [lesson.title.ja]),
          h.span([h.Class('text-[13px] text-[var(--mute)]')], [lesson.title.en]),
        ],
      ),
    ],
  )

/** One station on a lesson's line. Finished stops are filled, the next one pulses and says YOU ARE HERE, the rest are hollow. */
export const pathNode = (
  h: H,
  n: number,
  s: SectionInfo,
  state: 'done' | 'current' | 'todo',
): Child =>
  h.a(
    [
      h.Key(`${n}.${s.id}`),
      h.Href(lessonHref(n, s.id)),
      h.AriaLabel(`${sectionLabel(s)}${state === 'done' ? ', done' : ''}`),
      h.Class(cn('stn', state)),
    ],
    [
      h.span(
        [h.Class('stn-dot')],
        [state === 'done' ? icon(h, Check, 'size-4 stroke-[5]') : h.empty],
      ),
      h.span(
        [h.Class('stn-label')],
        [
          state === 'current' ? h.span([h.Class('here')], ['YOU ARE HERE']) : h.empty,
          h.span(
            [
              h.Class(
                'flex items-center gap-1.5 text-[11px] font-black tracking-widest text-[var(--mute)] uppercase',
              ),
            ],
            [glyph(h, s), sectionLabel(s)],
          ),
          s.kind === 'activity' && s.title
            ? h.span([h.Class('text-[16px] leading-snug font-bold')], jp(h, s.title))
            : h.empty,
        ],
      ),
    ],
  )
