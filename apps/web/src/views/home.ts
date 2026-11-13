import type { HtmlBuilder } from 'foldkit/html'
import { ArrowRight } from 'lucide'
import { icon } from '@/lib/icons'
import { cn } from '@/lib/utils'
import type { BookIndex, LessonSummary } from '../data/types.ts'
import type { Message, Model } from '../app/state.ts'
import { chapterClass } from '../ui/theme.ts'
import type { Child } from '../ui/common.ts'
import { lessonCode, lessonHref, lineLetter, sectionLabel, stationCode } from './lessonlinks.ts'
import { flatPages, lessonStats } from './path.ts'

type H = HtmlBuilder<Message>

const station = (
  h: H,
  model: Model,
  chapter: BookIndex['chapters'][number],
  lesson: LessonSummary,
  position: number,
  current: number | undefined,
): Child => {
  const stats = lessonStats(model, lesson)
  const done = stats.done === stats.total && stats.total > 0
  const here = current === lesson.number
  const code = stationCode(chapter.number, position)
  return h.a(
    [
      h.Key(`l${lesson.number}`),
      h.Href(lessonHref(lesson.number)),
      h.AriaLabel(
        `Lesson ${lesson.number}: ${lesson.title.en}, ${stats.done} of ${stats.total} pages${done ? ', complete' : here ? ', current' : ''}`,
      ),
      ...(here ? [h.AriaCurrent('step')] : []),
      h.Class('station'),
    ],
    [
      h.span([h.Class(cn('station-mark', done ? 'is-done' : here ? 'is-current' : ''))], [code]),
      h.span(
        [h.Class('station-text')],
        [
          h.span([h.Class('station-no')], [h.span([h.Lang('ja')], [`第${lesson.number}課`])]),
          h.span([h.Class('station-ja')], [h.span([h.Lang('ja')], [lesson.title.ja])]),
          h.span([h.Class('station-en')], [lesson.title.en]),
          here ? h.span([h.Class('station-here')], [h.span([h.Lang('ja')], ['現在地'])]) : h.empty,
        ],
      ),
    ],
  )
}

export const homePage = (model: Model, h: H, index: BookIndex): Child => {
  const all = index.chapters.flatMap((c) => c.lessons)
  const pages = flatPages(model, all)
  const donePages = pages.filter((p) => p.done).length
  const next = pages.find((p) => !p.done)
  const nextLesson = next ? all.find((l) => l.number === next.n) : undefined
  const nextChapter = next
    ? index.chapters.find((c) => c.lessons.some((l) => l.number === next.n))
    : undefined
  const code =
    next && nextChapter && nextLesson ? lessonCode(nextChapter, nextLesson.number) : 'A01'

  const departure = h.section(
    [h.Class('departure')],
    [
      h.div(
        [h.Class('departure-label')],
        [h.b([], [next ? '次は' : '完乗']), h.span([], [next ? 'Next' : 'Complete'])],
      ),
      h.div(
        [h.Class('departure-body')],
        [
          h.span([h.Class(cn('station-code', chapterClass(nextChapter?.number ?? 1)))], [code]),
          h.div(
            [h.Class('departure-text')],
            [
              h.p(
                [h.Class('departure-title')],
                nextLesson
                  ? [h.span([h.Lang('ja')], [nextLesson.title.ja])]
                  : [h.span([h.Lang('ja')], ['全線完乗'])],
              ),
              h.p(
                [h.Class('departure-sub')],
                next && nextLesson
                  ? [`${nextLesson.title.en} · ${sectionLabel(next.s)}`]
                  : ['Every page is done. Choose any station below.'],
              ),
            ],
          ),
        ],
      ),
      h.a(
        [
          h.Href(next ? lessonHref(next.n, next.s.id) : lessonHref(1)),
          h.Class('btn'),
          h.AriaLabel(
            next && nextLesson
              ? `Continue with lesson ${next.n}, ${sectionLabel(next.s)}`
              : 'Return to 第1課',
          ),
        ],
        [next ? 'Continue' : 'Revisit', icon(h, ArrowRight, 'size-4')],
      ),
    ],
  )

  const guideLine = (chapter: BookIndex['chapters'][number]): Child =>
    h.section(
      [h.Key(`ch${chapter.number}`), h.Class(cn('guide-line', chapterClass(chapter.number)))],
      [
        h.div(
          [h.Class('guide-head')],
          [
            h.span([h.Class('line-letter')], [lineLetter(chapter.number)]),
            h.h2(
              [h.Class('guide-title')],
              [
                h.span([h.Class('ja')], [h.span([h.Lang('ja')], [chapter.topic.ja])]),
                h.span([h.Class('en')], [chapter.topic.en]),
              ],
            ),
          ],
        ),
        h.div(
          [h.Class('track'), h.Style({ '--n': String(chapter.lessons.length) })],
          chapter.lessons.map((lesson, at) => station(h, model, chapter, lesson, at + 1, next?.n)),
        ),
      ],
    )

  return h.div(
    [h.Class('page')],
    [
      h.h1([h.Class('sr-only')], ['Irodori Elementary 1 line guide']),
      departure,
      h.div(
        [h.Class('guide')],
        [
          h.div(
            [h.Class('guide-top')],
            [
              h.div(
                [h.Class('guide-label')],
                [h.span([h.Lang('ja')], ['路線案内']), h.span([], ['Line guide'])],
              ),
              h.span([h.Class('guide-progress')], [`${donePages} / ${pages.length} stops`]),
            ],
          ),
          ...index.chapters.map(guideLine),
        ],
      ),
    ],
  )
}
