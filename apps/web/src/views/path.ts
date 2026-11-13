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

const OFFSETS = [0, 46, 70, 46, 0, -46, -70, -46]

const glyph = (h: H, s: SectionInfo, done: boolean): Child =>
  done
    ? icon(h, Check, 'size-8 stroke-[4]')
    : s.kind === 'activity'
      ? icon(h, Star, 'size-8 fill-current')
      : s.kind === 'kanji'
        ? h.span([h.Class('display text-[1.6rem] leading-none')], ['漢'])
        : s.kind === 'grammar'
          ? icon(h, BookOpen, 'size-7')
          : icon(h, Headphones, 'size-7')

const nodeTitle = (h: H, s: SectionInfo): ReadonlyArray<Child> =>
  s.kind === 'activity' && s.title ? jp(h, s.title) : [sectionLabel(s)]

/** One stop on the path. A finished stop is solid with a check, the next one is ringed and says START, the rest are outlined. */
export const pathNode = (
  h: H,
  n: number,
  s: SectionInfo,
  state: 'done' | 'current' | 'todo',
  at: number,
): Child => {
  const x = OFFSETS[at % OFFSETS.length] ?? 0
  return h.div(
    [h.Key(`${n}.${s.id}`), h.Class('flex justify-center py-2.5')],
    [
      h.div(
        [h.Class('relative'), h.Style({ transform: `translateX(${x}px)` })],
        [
          state === 'current' ? h.div([h.Class('start-bubble')], ['START']) : h.empty,
          h.a(
            [
              h.Href(lessonHref(n, s.id)),
              h.AriaLabel(`${sectionLabel(s)}${state === 'done' ? ', done' : ''}`),
              h.Class(cn('node', state === 'current' && 'current', state === 'todo' && 'todo')),
            ],
            [glyph(h, s, state === 'done')],
          ),
          h.span(
            [
              h.Class(
                cn(
                  'pointer-events-none absolute top-1/2 line-clamp-2 w-[8rem] -translate-y-1/2 text-[13px] leading-tight font-bold text-[var(--mute)]',
                  x > 0 ? 'right-full mr-5 text-right' : 'left-full ml-5',
                ),
              ),
            ],
            nodeTitle(h, s),
          ),
        ],
      ),
    ],
  )
}
