import type { HtmlBuilder } from 'foldkit/html'
import { ArrowRight, Check, X } from 'lucide'
import { icon } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { gate, unitsOf } from '../app/units.ts'
import { Message, type Model } from '../app/state.ts'
import { liveStreak } from '../app/progress-schema.ts'
import type { Activity, Lesson } from '../data/types.ts'
import { type Child, type Ctx, furiganaToggle, jp } from '../ui/common.ts'
import { lessonHref, sectionLabel, sectionsOf } from './lessonlinks.ts'
import { taskView } from './task.ts'

type H = HtmlBuilder<Message>

const topBar = (
  model: Model,
  h: H,
  lesson: Lesson,
  activity: Activity,
  code: string,
  total: number,
  complete: boolean,
): Child => {
  const at = complete ? total : Math.min(model.unit + 1, Math.max(1, total))
  const pct = total === 0 ? 100 : (at / total) * 100
  return h.header(
    [h.Class('player-top')],
    [
      h.div(
        [h.Class('player-top-inner')],
        [
          h.a(
            [
              h.Href(lessonHref(lesson.number)),
              h.Class('icon-btn'),
              h.AriaLabel(`Leave lesson ${lesson.number}`),
            ],
            [icon(h, X, 'size-5')],
          ),
          h.div(
            [
              h.Class('ride'),
              h.Role('group'),
              h.AriaLabel(`Exercise ${at} of ${total} in activity ${activity.number}`),
            ],
            [
              h.div(
                [h.Class('ride-head')],
                [
                  h.b([], [`${code || `第${lesson.number}課`} · Activity ${activity.number}`]),
                  h.span([h.Class('ride-count')], [`${at} / ${total}`]),
                ],
              ),
              h.div(
                [h.Class('ride-line')],
                [h.span([h.Class('ride-fill'), h.Style({ '--p': `${pct}%` })], [])],
              ),
            ],
          ),
          furiganaToggle(h, model),
        ],
      ),
    ],
  )
}

const complete = (model: Model, h: H, lesson: Lesson, activity: Activity, total: number): Child => {
  const sections = sectionsOf(lesson)
  const at = sections.findIndex((s) => s.id === `activity-${activity.number}`)
  const next = sections[at + 1]
  return h.div(
    [h.Class('complete')],
    [
      h.div([h.Class('stamp'), h.AriaHidden(true)], ['済']),
      h.h1([h.Class('complete-title')], [h.span([h.Lang('ja')], [`活動${activity.number} 完了`])]),
      h.p([h.Class('complete-sub')], jp(h, activity.title)),
      h.p(
        [h.Class('complete-stats')],
        [
          `+${model.earned} XP · ${total} exercises · ${liveStreak(model.progress, model.today)} day streak`,
        ],
      ),
      h.div(
        [h.Class('complete-actions')],
        [
          h.a(
            [
              h.Href(next ? lessonHref(lesson.number, next.id) : lessonHref(lesson.number)),
              h.Class('btn full'),
            ],
            [
              next ? `Next: ${sectionLabel(next)}` : `第${lesson.number}課`,
              icon(h, ArrowRight, 'size-4'),
            ],
          ),
          h.button(
            [h.Type('button'), h.OnClick(Message.ClickedRestart()), h.Class('btn secondary full')],
            ['Practice again'],
          ),
          next
            ? h.a(
                [h.Href(lessonHref(lesson.number)), h.Class('btn ghost full')],
                [`Back to 第${lesson.number}課`],
              )
            : h.empty,
        ],
      ),
    ],
  )
}

const bottomBar = (
  h: H,
  key: string,
  total: number,
  unit: number,
  g: ReturnType<typeof gate>,
): Child => {
  const back =
    unit > 0
      ? h.button(
          [h.Type('button'), h.OnClick(Message.ClickedBack()), h.Class('btn ghost')],
          ['Back'],
        )
      : h.span([h.Class('flex-1')], [])
  const cont = (label: string, secondary = false) =>
    h.button(
      [
        h.Type('button'),
        h.OnClick(Message.ClickedContinue({ total })),
        h.Class(cn('btn min-w-[8rem]', secondary && 'ghost')),
      ],
      [label],
    )
  const inner: Child =
    g.kind === 'check'
      ? h.div(
          [h.Class('flex w-full items-center justify-between gap-3')],
          [
            back,
            h.button(
              [
                h.Type('button'),
                h.Disabled(!g.ready),
                h.OnClick(Message.Checked({ key })),
                h.Class('btn min-w-[8rem]'),
              ],
              ['Check'],
            ),
          ],
        )
      : g.kind === 'result'
        ? h.div(
            [h.Class('flex w-full flex-wrap items-center justify-between gap-3')],
            [
              h.div(
                [h.Class(cn('result', g.ok ? 'ok' : 'bad'))],
                [
                  icon(h, g.ok ? Check : X, 'size-4'),
                  h.div(
                    [h.Class('min-w-0')],
                    [
                      h.div([h.Class('result-title')], [g.ok ? 'Correct' : 'Not quite']),
                      g.ok ? h.empty : h.div([h.Class('result-answer')], [g.answer]),
                    ],
                  ),
                ],
              ),
              cont('Continue'),
            ],
          )
        : h.div(
            [h.Class('flex w-full items-center justify-between gap-3')],
            [back, cont(g.label, g.label === 'Skip')],
          )
  return h.div(
    [h.Class(cn('player-foot', g.kind === 'result' && (g.ok ? 'is-ok' : 'is-bad')))],
    [h.div([h.Class('player-foot-inner')], [inner])],
  )
}

/** One activity as a run of single-exercise screens with the line and the verdict always in view. */
export const player = (
  model: Model,
  h: H,
  lesson: Lesson,
  activity: Activity,
  code: string,
): Child => {
  const c: Ctx = { h, model, lesson }
  const units = unitsOf(activity)
  const total = units.length
  const done = model.unit >= total
  const unit = units[Math.min(model.unit, total - 1)]
  return h.div(
    [h.Class('player')],
    [
      done || unit === undefined
        ? h.empty
        : h.h1([h.Class('sr-only')], [`Lesson ${lesson.number}, Activity ${activity.number}`]),
      topBar(model, h, lesson, activity, code, total, done),
      done || unit === undefined
        ? complete(model, h, lesson, activity, total)
        : h.main(
            [h.Class('player-main')],
            [h.div([h.Key(unit.key)], [taskView(c, unit.task, unit.key)])],
          ),
      done || unit === undefined
        ? h.empty
        : bottomBar(h, unit.key, total, model.unit, gate(model, unit)),
    ],
  )
}
