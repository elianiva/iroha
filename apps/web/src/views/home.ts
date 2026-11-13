import type { HtmlBuilder } from 'foldkit/html'
import { ArrowRight } from 'lucide'
import { icon } from '@/lib/icons'
import { cn } from '@/lib/utils'
import type { BookIndex } from '../data/types.ts'
import type { Message, Model } from '../app/state.ts'
import { liveStreak } from '../app/progress-schema.ts'
import { chapterClass } from '../ui/theme.ts'
import { type Child, en, jp } from '../ui/common.ts'
import { lessonHref, sectionLabel } from './lessonlinks.ts'
import { flatPages, pathNode } from './path.ts'

type H = HtmlBuilder<Message>

export const homePage = (model: Model, h: H, index: BookIndex): Child => {
  const all = index.chapters.flatMap((c) => c.lessons)
  const pages = flatPages(model, all)
  const current = pages.find((p) => !p.done)
  const done = pages.filter((p) => p.done).length
  const currentLesson = current ? all.find((l) => l.number === current.n) : undefined

  const rail = h.aside(
    [h.Class('hidden lg:block')],
    [
      h.div(
        [h.Class('sticky top-24 flex flex-col gap-4')],
        [
          h.div(
            [
              h.Class(
                cn(
                  'card3d flex flex-col gap-3 p-5',
                  currentLesson &&
                    chapterClass(
                      index.chapters.find((c) => c.lessons.includes(currentLesson))?.number ?? 1,
                    ),
                ),
              ),
            ],
            current && currentLesson
              ? [
                  h.span([h.Class('chip w-fit')], ['Up next']),
                  h.span(
                    [h.Class('text-[20px] leading-snug font-black')],
                    [currentLesson.title.ja],
                  ),
                  en(h, `Lesson ${current.n} · ${sectionLabel(current.s)}`),
                  h.a(
                    [h.Href(lessonHref(current.n, current.s.id)), h.Class('btn3d w-full')],
                    ['Continue', icon(h, ArrowRight, 'size-5')],
                  ),
                ]
              : [
                  h.span([h.Class('display text-[22px]')], ['You finished the book! 🎉']),
                  en(h, 'Every page is done. Revisit any lesson to keep your streak.'),
                ],
          ),
          h.div(
            [h.Class('card3d flex flex-col gap-2 p-5')],
            [
              h.div(
                [h.Class('flex items-baseline justify-between')],
                [
                  h.span(
                    [
                      h.Class(
                        'text-[13px] font-black tracking-widest text-[var(--mute)] uppercase',
                      ),
                    ],
                    ['Book progress'],
                  ),
                  h.span([h.Class('text-[13px] font-black')], [`${done} / ${pages.length}`]),
                ],
              ),
              h.div(
                [h.Class('pbar')],
                [
                  h.div(
                    [
                      h.Class('pfill'),
                      h.Style({
                        width: `${Math.max(3, (done / Math.max(1, pages.length)) * 100)}%`,
                      }),
                    ],
                    [],
                  ),
                ],
              ),
              en(
                h,
                `${liveStreak(model.progress, model.today)} day streak · ${model.progress.xp} XP`,
              ),
            ],
          ),
        ],
      ),
    ],
  )

  const path = h.div(
    [h.Class('flex flex-col gap-10')],
    index.chapters.map((chapter) => {
      let at = 0
      return h.section(
        [h.Key(`ch${chapter.number}`), h.Class(chapterClass(chapter.number))],
        [
          h.div(
            [
              h.Class(
                'sticky top-[4.6rem] z-10 flex items-center gap-4 rounded-3xl bg-[var(--c)] px-5 py-4 text-white shadow-[0_5px_0_var(--cd)]',
              ),
            ],
            [
              h.span(
                [h.Class('display text-[2.4rem] leading-none opacity-90')],
                [String(chapter.number)],
              ),
              h.div(
                [h.Class('flex min-w-0 flex-col leading-tight')],
                [
                  h.span(
                    [h.Class('text-[11px] font-black tracking-widest uppercase opacity-90')],
                    [`Chapter ${chapter.number}`],
                  ),
                  h.span([h.Class('truncate text-[21px] font-black')], [chapter.topic.ja]),
                  h.span([h.Class('text-[13px] opacity-90')], [chapter.topic.en]),
                ],
              ),
            ],
          ),
          ...chapter.lessons.map((lesson) =>
            h.div(
              [h.Key(`l${lesson.number}`), h.Class('mt-6')],
              [
                h.a(
                  [
                    h.Href(lessonHref(lesson.number)),
                    h.Class(
                      'card3d mx-auto mb-7 flex max-w-sm flex-col items-center gap-0.5 px-4 py-3 text-center',
                    ),
                  ],
                  [
                    h.span(
                      [h.Class('text-[11px] font-black tracking-widest text-[var(--c)] uppercase')],
                      [`Lesson ${lesson.number}`],
                    ),
                    h.span([h.Class('text-[17px] leading-snug font-black')], [lesson.title.ja]),
                    en(h, lesson.title.en),
                  ],
                ),
                ...lesson.sections.map((s) => {
                  const state = pages.find((p) => p.n === lesson.number && p.s.id === s.id)?.done
                    ? 'done'
                    : current && current.n === lesson.number && current.s.id === s.id
                      ? 'current'
                      : 'todo'
                  const node = pathNode(h, lesson.number, s, state, at)
                  at += 1
                  return node
                }),
              ],
            ),
          ),
        ],
      )
    }),
  )

  return h.div(
    [h.Class('mx-auto grid max-w-5xl gap-10 px-4 pt-6 pb-24 lg:grid-cols-[minmax(0,1fr)_20rem]')],
    [h.div([h.Class('mx-auto w-full max-w-md')], [path]), rail],
  )
}

export { jp }
