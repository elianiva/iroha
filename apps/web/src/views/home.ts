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
import { flatPages, lessonStop, pathNode } from './path.ts'

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
    [h.Class('flex flex-col gap-12')],
    index.chapters.map((chapter) =>
      h.section(
        [h.Key(`ch${chapter.number}`), h.Class(chapterClass(chapter.number))],
        [
          h.div(
            [h.Class('line-head')],
            [
              h.span([h.Class('line-badge display')], [String(chapter.number)]),
              h.div(
                [h.Class('flex min-w-0 flex-col leading-tight')],
                [
                  h.span([h.Class('truncate text-[20px] font-black')], [chapter.topic.ja]),
                  h.span([h.Class('text-[13px] font-bold opacity-80')], [chapter.topic.en]),
                ],
              ),
            ],
          ),
          h.div(
            [h.Class('line-track')],
            chapter.lessons.flatMap((lesson) => [
              lessonStop(h, lesson),
              ...lesson.sections.map((s) => {
                const state = pages.find((p) => p.n === lesson.number && p.s.id === s.id)?.done
                  ? 'done'
                  : current && current.n === lesson.number && current.s.id === s.id
                    ? 'current'
                    : 'todo'
                return pathNode(h, lesson.number, s, state)
              }),
            ]),
          ),
        ],
      ),
    ),
  )

  return h.div(
    [h.Class('mx-auto grid max-w-5xl gap-10 px-4 pt-6 pb-24 lg:grid-cols-[minmax(0,1fr)_20rem]')],
    [h.div([h.Class('mx-auto w-full max-w-lg')], [path]), rail],
  )
}

export { jp }
