import { AsyncData } from 'foldkit'
import type { HtmlBuilder } from 'foldkit/html'
import { ArrowLeft, ArrowRight, Check, TriangleAlert } from 'lucide'
import { icon } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { lessonQuery } from '../data/queries.ts'
import type { BookIndex, Lesson, SectionInfo } from '../data/types.ts'
import { Message, type Model } from '../app/state.ts'
import { chapterClass } from '../ui/theme.ts'
import { type Child, type Ctx, jp, plain } from '../ui/common.ts'
import { findLesson, lessonCode, lessonHref, sectionLabel, sectionsOf } from './lessonlinks.ts'
import { isDone } from './path.ts'
import { player } from './player.ts'
import { kanjiView, noteCard } from './notes.ts'
import { dialogueView } from './task.ts'

type H = HtmlBuilder<Message>

const loading = (h: H): Child =>
  h.div(
    [h.Class('page')],
    [
      h.div(
        [h.Class('loading'), h.AriaBusy(true)],
        [h.span([h.Class('loading-mark')], []), h.span([], ['Loading lesson…'])],
      ),
    ],
  )

const failure = (h: H, error: string): Child =>
  h.div(
    [h.Class('page narrow')],
    [
      h.div(
        [h.Class('notice')],
        [
          h.span([h.Class('notice-icon')], [icon(h, TriangleAlert, 'size-5')]),
          h.div([], [h.h2([], ['This lesson did not load']), h.p([], [error])]),
          h.button(
            [h.Type('button'), h.OnClick(Message.ClickedRetry()), h.Class('btn')],
            ['Try again'],
          ),
        ],
      ),
    ],
  )

const crumbs = (h: H, lesson: Lesson, current?: string): Child =>
  h.nav(
    [h.Class('crumbs'), h.AriaLabel('Breadcrumb')],
    [
      h.a([h.Href('/')], ['Irodori']),
      h.span([], ['/']),
      h.a(
        [h.Href(lessonHref(lesson.number)), ...(current ? [] : [h.AriaCurrent('page')])],
        [`第${lesson.number}課`],
      ),
      current ? h.span([], ['/']) : h.empty,
      current ? h.span([h.AriaCurrent('page')], [current]) : h.empty,
    ],
  )

const sectionTitle = (h: H, s: SectionInfo): ReadonlyArray<Child> => {
  if (s.kind === 'activity') return s.title ? jp(h, s.title) : [sectionLabel(s)]
  return [
    s.kind === 'kanji' ? '漢字のことば' : s.kind === 'grammar' ? '文法ノート' : '聴解スクリプト',
  ]
}

const sectionHint = (s: SectionInfo): string => {
  if (s.kind === 'activity') return s.can_do_en ?? 'Practice'
  if (s.kind === 'kanji') return 'Kanji words and readings'
  if (s.kind === 'grammar') return 'Grammar and culture notes'
  return 'Listening scripts'
}

const studyTitle = (s: SectionInfo): string =>
  s.kind === 'kanji' ? '漢字のことば' : s.kind === 'grammar' ? '文法ノート' : '聴解スクリプト'

const studySub = (s: SectionInfo): string =>
  s.kind === 'kanji'
    ? 'Kanji words and reading practice'
    : s.kind === 'scripts'
      ? 'Listening scripts'
      : ''

const hub = (
  model: Model,
  h: H,
  lesson: Lesson,
  chapter: number | undefined,
  topic: string,
  code: string,
): Child => {
  const sections = sectionsOf(lesson)
  const doneCount = sections.filter((s) => isDone(model, lesson.number, s.id)).length
  const nextIdx = sections.findIndex((s) => !isDone(model, lesson.number, s.id))
  const next = nextIdx >= 0 ? sections[nextIdx] : sections[0]
  const allDone = doneCount === sections.length && sections.length > 0
  const lineCode = code.slice(0, 1) || 'A'
  return h.div(
    [h.Class('page narrow')],
    [
      crumbs(h, lesson),
      h.header(
        [h.Class(cn('station-sign', chapterClass(chapter ?? 1)))],
        [
          h.div(
            [h.Class('sign-top')],
            [
              h.span([h.Class('station-code')], [code || `${lineCode}01`]),
              h.span([], [`Line ${lineCode} · ${topic}`]),
            ],
          ),
          h.h1([h.Class('sign-title')], [h.span([h.Lang('ja')], [`第${lesson.number}課`])]),
          h.p([h.Class('sign-ja')], [h.span([h.Lang('ja')], [lesson.title.ja])]),
          h.p([h.Class('sign-en')], [lesson.title.en]),
          lesson.question.ja
            ? h.p(
                [h.Class('sign-question')],
                [...jp(h, lesson.question.ja), h.span([h.Class('en')], [lesson.question.en ?? ''])],
              )
            : h.empty,
        ],
      ),
      h.div(
        [h.Class(cn('lesson-bar', chapterClass(chapter ?? 1)))],
        [
          h.div(
            [h.Class('ticks')],
            sections.map((s) =>
              h.span(
                [h.Key(s.id), h.Class(cn('tick', isDone(model, lesson.number, s.id) && 'on'))],
                [],
              ),
            ),
          ),
          h.span([h.Class('lesson-count')], [`${doneCount} / ${sections.length}`]),
          next
            ? h.a(
                [h.Href(lessonHref(lesson.number, next.id)), h.Class('btn')],
                [
                  allDone ? 'Review' : doneCount === 0 ? 'Start' : 'Continue',
                  icon(h, ArrowRight, 'size-4'),
                ],
              )
            : h.empty,
        ],
      ),
      h.div(
        [h.Class(cn('route-list', chapterClass(chapter ?? 1)))],
        sections.map((s, i) => {
          const done = isDone(model, lesson.number, s.id)
          const current = !done && i === nextIdx
          return h.a(
            [
              h.Key(s.id),
              h.Href(lessonHref(lesson.number, s.id)),
              h.AriaLabel(
                `${sectionLabel(s)}: ${s.title ? plain(s.title) : sectionHint(s)}${done ? ', done' : current ? ', current' : ''}`,
              ),
              ...(current ? [h.AriaCurrent('step')] : []),
              h.Class(cn('route-row', done ? 'is-done' : current ? 'is-current' : 'is-ahead')),
            ],
            [
              h.span(
                [h.Class('route-tick')],
                [done ? icon(h, Check, 'size-3 stroke-[3]') : String(i + 1)],
              ),
              h.span(
                [h.Class('route-main')],
                [
                  h.span(
                    [h.Class('route-kind')],
                    [current ? `${sectionLabel(s)} · 現在地` : sectionLabel(s)],
                  ),
                  h.span([h.Class('route-title')], sectionTitle(h, s)),
                  h.span([h.Class('route-sub')], [sectionHint(s)]),
                ],
              ),
              h.span([h.Class('route-arrow'), h.AriaHidden(true)], ['›']),
            ],
          )
        }),
      ),
    ],
  )
}

const study = (
  model: Model,
  h: H,
  lesson: Lesson,
  section: SectionInfo,
  chapter: number | undefined,
  code: string,
): Child => {
  const c: Ctx = { h, model, lesson }
  const sections = sectionsOf(lesson)
  const at = sections.findIndex((s) => s.id === section.id)
  const prev = at > 0 ? sections[at - 1] : undefined
  const next = at >= 0 ? sections[at + 1] : undefined
  const done = isDone(model, lesson.number, section.id)
  const body =
    section.kind === 'kanji'
      ? kanjiView(c)
      : section.kind === 'grammar'
        ? h.div(
            [],
            lesson.notes.map((nt, i) => noteCard(c, nt, i)),
          )
        : h.div(
            [h.Class('study-body')],
            [
              h.div(
                [h.Class('scripts-head')],
                [
                  h.span(
                    [h.Class('muted text-[0.78rem]')],
                    [
                      `${lesson.scripts.length} ${lesson.scripts.length === 1 ? 'script' : 'scripts'}`,
                    ],
                  ),
                  h.button(
                    [
                      h.Type('button'),
                      h.OnClick(Message.ToggledScripts()),
                      h.Class('btn secondary sm'),
                    ],
                    [model.hideScripts ? 'Reveal all' : 'Blur scripts'],
                  ),
                ],
              ),
              ...lesson.scripts.map((d, i) =>
                dialogueView(c, d, `script${i}`, true, `Dialogue ${i + 1}`),
              ),
            ],
          )
  return h.div(
    [h.Class('page narrow')],
    [
      crumbs(h, lesson, sectionLabel(section)),
      h.header(
        [h.Class(cn('study-head', chapterClass(chapter ?? 1)))],
        [
          h.span([h.Class('study-code')], [`${code} · Page ${at + 1} of ${sections.length}`]),
          h.h1([h.Class('study-title')], [h.span([h.Lang('ja')], [studyTitle(section)])]),
          studySub(section) ? h.p([h.Class('study-en')], [studySub(section)]) : h.empty,
        ],
      ),
      body,
      h.div(
        [h.Class('study-actions')],
        [
          done
            ? h.div(
                [h.Class('study-done flex items-center gap-1.5')],
                [icon(h, Check, 'size-4'), 'Done · +5 XP'],
              )
            : h.button(
                [h.Type('button'), h.OnClick(Message.ClickedDone()), h.Class('btn')],
                [icon(h, Check, 'size-4'), 'Mark as done'],
              ),
          h.div(
            [h.Class('study-actions-row')],
            [
              h.a(
                [
                  h.Href(prev ? lessonHref(lesson.number, prev.id) : lessonHref(lesson.number)),
                  h.Class('btn secondary'),
                ],
                [icon(h, ArrowLeft, 'size-4'), prev ? sectionLabel(prev) : `第${lesson.number}課`],
              ),
              h.a(
                [
                  h.Href(next ? lessonHref(lesson.number, next.id) : lessonHref(lesson.number)),
                  h.Class('btn'),
                ],
                [next ? sectionLabel(next) : `第${lesson.number}課`, icon(h, ArrowRight, 'size-4')],
              ),
            ],
          ),
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
  if (index !== undefined && found === undefined)
    return h.div(
      [h.Class('page narrow')],
      [
        h.div(
          [h.Class('notice')],
          [
            h.span([h.Class('notice-icon')], [icon(h, TriangleAlert, 'size-5')]),
            h.div(
              [],
              [h.h2([], ['No such lesson']), h.p([], [`第${n}課 is not on this line guide.`])],
            ),
            h.a([h.Href('/'), h.Class('btn')], ['Back to the line guide']),
          ],
        ),
      ],
    )
  const data = lessonQuery.read(model.lessons, { number: n })
  const colour = chapterClass(found?.chapter.number ?? 1)
  const code = found ? lessonCode(found.chapter, n) : ''
  return h.div(
    [h.Class(colour)],
    [
      AsyncData.matchData(data, {
        onEmpty: () => loading(h),
        onFailure: (error) => failure(h, error),
        onData: (lesson: Lesson) => {
          const section = sectionsOf(lesson).find((s) => s.id === current)
          if (current !== '' && section === undefined)
            return h.div(
              [h.Class('page narrow')],
              [
                crumbs(h, lesson),
                h.div(
                  [h.Class('notice mt-4')],
                  [
                    h.span([h.Class('notice-icon')], [icon(h, TriangleAlert, 'size-5')]),
                    h.div(
                      [],
                      [
                        h.h2([], ['Page not found']),
                        h.p([], [`第${n}課 has no page called “${current}”.`]),
                      ],
                    ),
                    h.a([h.Href(lessonHref(n)), h.Class('btn')], [`Back to 第${n}課`]),
                  ],
                ),
              ],
            )
          if (section?.kind === 'activity') {
            const activity = lesson.activities.find((a) => `activity-${a.number}` === section.id)
            return activity ? player(model, h, lesson, activity, code) : h.empty
          }
          return section
            ? study(model, h, lesson, section, found?.chapter.number, code)
            : hub(
                model,
                h,
                lesson,
                found?.chapter.number,
                found?.chapter.topic.en ?? lesson.topic.en,
                code,
              )
        },
      }),
    ],
  )
}
