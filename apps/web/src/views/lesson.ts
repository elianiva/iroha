import { AsyncData } from 'foldkit'
import type { HtmlBuilder } from 'foldkit/html'
import { ArrowLeft, ArrowRight, BookOpen, Check, Headphones, Star } from 'lucide'
import { icon } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { lessonQuery } from '../data/queries.ts'
import type { BookIndex, Lesson, SectionInfo } from '../data/types.ts'
import { Message, type Model } from '../app/state.ts'
import { chapterClass } from '../ui/theme.ts'
import { type Child, type Ctx, en, jp } from '../ui/common.ts'
import { findLesson, lessonHref, sectionLabel, sectionsOf } from './lessonlinks.ts'
import { isDone } from './path.ts'
import { player } from './player.ts'
import { kanjiView, noteCard } from './notes.ts'
import { dialogueView } from './task.ts'

type H = HtmlBuilder<Message>

const loading = (h: H): Child =>
  h.div(
    [h.Class('flex flex-col gap-4')],
    [1, 2, 3].map((i) =>
      h.div([h.Key(`s${i}`), h.Class('h-28 animate-pulse rounded-3xl bg-black/5')], []),
    ),
  )

const failure = (h: H, error: string): Child =>
  h.div(
    [h.Class('card3d flex flex-col items-start gap-3 p-6')],
    [
      h.h2([h.Class('display text-[22px]')], ['This lesson did not load']),
      h.p([h.Class('text-[15px] text-[var(--mute)]')], [error]),
      h.button(
        [h.Type('button'), h.OnClick(Message.ClickedRetry()), h.Class('btn3d')],
        ['Try again'],
      ),
    ],
  )

const back = (h: H, href: string, label: string): Child =>
  h.a(
    [
      h.Href(href),
      h.Class(
        'inline-flex items-center gap-1.5 text-[14px] font-black tracking-wide text-[var(--mute)] uppercase hover:text-[var(--ink)]',
      ),
    ],
    [icon(h, ArrowLeft, 'size-4 stroke-[3]'), label],
  )

const kindIcon = (h: H, s: SectionInfo): Child =>
  s.kind === 'activity'
    ? icon(h, Star, 'size-7 fill-current')
    : s.kind === 'kanji'
      ? h.span([h.Class('display text-[1.4rem]')], ['漢'])
      : s.kind === 'grammar'
        ? icon(h, BookOpen, 'size-6')
        : icon(h, Headphones, 'size-6')

const sectionCard = (
  h: H,
  model: Model,
  n: number,
  s: SectionInfo,
  i: number,
  current: boolean,
): Child => {
  const done = isDone(model, n, s.id)
  return h.a(
    [
      h.Key(s.id),
      h.Href(lessonHref(n, s.id)),
      h.Class(cn('card3d flex items-center gap-4 p-4', current && 'border-[var(--c)]')),
    ],
    [
      h.span(
        [h.Class(cn('node shrink-0 !h-14 !w-16', !done && !current && 'todo'))],
        [done ? icon(h, Check, 'size-7 stroke-[4]') : kindIcon(h, s)],
      ),
      h.div(
        [h.Class('flex min-w-0 flex-col gap-0.5')],
        [
          h.span(
            [h.Class('text-[12px] font-black tracking-widest text-[var(--c)] uppercase')],
            [s.kind === 'activity' ? `Activity ${i + 1}` : sectionLabel(s)],
          ),
          s.title
            ? h.span([h.Class('text-[19px] leading-snug font-black')], jp(h, s.title))
            : h.empty,
          s.kind === 'activity'
            ? en(h, s.can_do_en)
            : en(
                h,
                s.kind === 'kanji'
                  ? 'Kanji words and reading practice'
                  : s.kind === 'grammar'
                    ? 'Grammar and culture notes'
                    : 'Read the listening scripts',
              ),
        ],
      ),
      h.span(
        [h.Class('ml-auto shrink-0 text-[var(--c)]')],
        [icon(h, ArrowRight, 'size-6 stroke-[3]')],
      ),
    ],
  )
}

const hub = (
  model: Model,
  h: H,
  lesson: Lesson,
  chapter: number | undefined,
  topic: string,
): Child => {
  const sections = sectionsOf(lesson)
  const doneCount = sections.filter((s) => isDone(model, lesson.number, s.id)).length
  const nextIdx = sections.findIndex((s) => !isDone(model, lesson.number, s.id))
  return h.div(
    [h.Class('flex flex-col gap-6')],
    [
      back(h, '/', 'All lessons'),
      h.div(
        [
          h.Class(
            'relative overflow-hidden rounded-[2rem] bg-[var(--c)] p-6 text-white shadow-[0_8px_0_var(--cd)] sm:p-8',
          ),
        ],
        [
          h.div(
            [
              h.Class(
                'display pointer-events-none absolute -top-6 -right-2 text-[11rem] leading-none text-white/15 select-none',
              ),
            ],
            [String(lesson.number)],
          ),
          h.p(
            [h.Class('relative text-[13px] font-black tracking-widest uppercase opacity-90')],
            [`Chapter ${chapter ?? ''} · ${topic}`],
          ),
          h.h1(
            [h.Class('display relative mt-2 text-[34px] leading-tight sm:text-[44px]')],
            [`第${lesson.number}課`],
          ),
          h.p(
            [h.Class('relative mt-1 text-[22px] leading-snug font-black')],
            jp(h, { text: lesson.title.ja }),
          ),
          h.p([h.Class('relative text-[15px] opacity-90')], [lesson.title.en]),
          lesson.question.ja
            ? h.div(
                [
                  h.Class(
                    'relative mt-5 max-w-lg rounded-2xl rounded-tl-md bg-white p-4 text-[var(--ink)]',
                  ),
                ],
                [
                  h.p([h.Class('text-[17px] font-bold')], jp(h, lesson.question.ja)),
                  en(h, lesson.question.en),
                ],
              )
            : h.empty,
          h.div(
            [h.Class('relative mt-5 flex items-center gap-3')],
            [
              h.div(
                [h.Class('h-3 flex-1 overflow-hidden rounded-full bg-black/15')],
                [
                  h.div(
                    [
                      h.Class('h-full rounded-full bg-white transition-all'),
                      h.Style({ width: `${(doneCount / Math.max(1, sections.length)) * 100}%` }),
                    ],
                    [],
                  ),
                ],
              ),
              h.span([h.Class('text-[13px] font-black')], [`${doneCount} / ${sections.length}`]),
            ],
          ),
        ],
      ),
      h.div(
        [h.Class('flex flex-col gap-3.5')],
        sections.map((s, i) =>
          sectionCard(
            h,
            model,
            lesson.number,
            s,
            sections.filter((x) => x.kind === 'activity').indexOf(s),
            i === nextIdx,
          ),
        ),
      ),
    ],
  )
}

const study = (model: Model, h: H, lesson: Lesson, section: SectionInfo): Child => {
  const c: Ctx = { h, model, lesson }
  const sections = sectionsOf(lesson)
  const next = sections[sections.findIndex((s) => s.id === section.id) + 1]
  const title =
    section.kind === 'kanji'
      ? '漢字のことば'
      : section.kind === 'grammar'
        ? '文法ノート'
        : '聴解スクリプト'
  return h.div(
    [h.Class('flex flex-col gap-6')],
    [
      back(h, lessonHref(lesson.number), `Lesson ${lesson.number}`),
      h.div(
        [h.Class('flex flex-col gap-1')],
        [
          h.span([h.Class('chip w-fit')], [sectionLabel(section)]),
          h.h1([h.Class('display text-[32px] leading-tight')], [title]),
        ],
      ),
      section.kind === 'kanji'
        ? kanjiView(c)
        : section.kind === 'grammar'
          ? h.div(
              [h.Class('flex flex-col gap-5')],
              lesson.notes.map((nt, i) => noteCard(c, nt, i)),
            )
          : h.div(
              [h.Class('flex flex-col gap-4')],
              [
                h.div(
                  [h.Class('flex flex-wrap items-center justify-between gap-3')],
                  [
                    en(h, 'Listen first. Tap a blurred script to read it.'),
                    h.button(
                      [
                        h.Type('button'),
                        h.OnClick(Message.ToggledScripts()),
                        h.Class('btn3d ghost sm'),
                      ],
                      [model.hideScripts ? 'Show all' : 'Hide scripts'],
                    ),
                  ],
                ),
                ...lesson.scripts.map((d, i) => dialogueView(c, d, `script${i}`, true)),
              ],
            ),
      h.a(
        [
          h.Href(next ? lessonHref(lesson.number, next.id) : lessonHref(lesson.number)),
          h.Class('btn3d ok mt-2 w-full'),
        ],
        [
          next ? `Next: ${sectionLabel(next)}` : 'Back to the lesson',
          icon(h, ArrowRight, 'size-5'),
        ],
      ),
    ],
  )
}

/** The lesson hub, a study page, or the player, once the lesson has loaded. */
export const lessonPage = (
  model: Model,
  h: H,
  index: BookIndex | undefined,
  n: number,
  current: string,
): Child => {
  const found = index ? findLesson(index, n) : undefined
  const data = lessonQuery.read(model.lessons, { number: n })
  const colour = chapterClass(found?.chapter.number ?? 1)
  return h.div(
    [h.Class(colour)],
    [
      AsyncData.matchData(data, {
        onEmpty: () => h.div([h.Class('mx-auto max-w-2xl px-4 py-8')], [loading(h)]),
        onFailure: (error) => h.div([h.Class('mx-auto max-w-2xl px-4 py-8')], [failure(h, error)]),
        onData: (lesson: Lesson) => {
          const section = sectionsOf(lesson).find((s) => s.id === current)
          if (current !== '' && section === undefined)
            return h.div(
              [h.Class('mx-auto max-w-2xl px-4 py-8')],
              [
                back(h, lessonHref(n), `Lesson ${n}`),
                h.p([h.Class('mt-4')], ['This lesson has no such page.']),
              ],
            )
          if (section?.kind === 'activity') {
            const activity = lesson.activities.find((a) => `activity-${a.number}` === section.id)
            return activity ? player(model, h, lesson, activity) : h.empty
          }
          return h.div(
            [h.Class('mx-auto max-w-2xl px-4 py-8 pb-24')],
            [
              section
                ? study(model, h, lesson, section)
                : hub(
                    model,
                    h,
                    lesson,
                    found?.chapter.number,
                    found?.chapter.topic.en ?? lesson.topic.en,
                  ),
            ],
          )
        },
      }),
    ],
  )
}
