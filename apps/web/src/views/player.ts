import type { HtmlBuilder } from 'foldkit/html'
import { ArrowRight, Check, Flame, Languages, X } from 'lucide'
import { icon } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { gate, unitsOf } from '../app/units.ts'
import { Message, type Model } from '../app/state.ts'
import type { Activity, Lesson } from '../data/types.ts'
import { type Child, type Ctx, jp } from '../ui/common.ts'
import { lessonHref, sectionLabel, sectionsOf } from './lessonlinks.ts'
import { taskView } from './task.ts'

type H = HtmlBuilder<Message>

const CONFETTI = ['#58cc02', '#1cb0f6', '#ff9600', '#b86bff', '#ff4b6e', '#f5b800', '#00c2a0']

const confetti = (h: H): Child =>
  h.div(
    [h.AriaHidden(true), h.Class('confetti pointer-events-none fixed inset-0 overflow-hidden')],
    Array.from({ length: 36 }, (_, i) =>
      h.i(
        [
          h.Key(`c${i}`),
          h.Style({
            left: `${(i * 97) % 100}%`,
            background: CONFETTI[i % CONFETTI.length] ?? '#58cc02',
            animationDelay: `${((i * 53) % 20) / 10}s`,
            animationDuration: `${2.2 + ((i * 31) % 15) / 10}s`,
          }),
        ],
        [],
      ),
    ),
  )

const stat = (h: H, label: string, value: string, color: string): Child =>
  h.div(
    [h.Class('pop flex-1 overflow-hidden rounded-2xl border-2'), h.Style({ borderColor: color })],
    [
      h.div(
        [
          h.Class(
            'px-3 py-1 text-center text-[11px] font-black tracking-widest text-white uppercase',
          ),
          h.Style({ background: color }),
        ],
        [label],
      ),
      h.div(
        [h.Class('bg-white py-3 text-center text-[26px] font-black'), h.Style({ color })],
        [value],
      ),
    ],
  )

const complete = (model: Model, h: H, lesson: Lesson, activity: Activity, total: number): Child => {
  const sections = sectionsOf(lesson)
  const at = sections.findIndex((s) => s.id === `activity-${activity.number}`)
  const next = sections[at + 1]
  return h.div(
    [
      h.Class(
        'relative mx-auto flex max-w-md flex-col items-center gap-6 px-4 pt-14 pb-40 text-center',
      ),
    ],
    [
      confetti(h),
      h.div([h.Class('pop display text-[5rem] leading-none')], ['🎉']),
      h.h1([h.Class('display text-[32px] leading-tight')], ['Activity complete!']),
      h.p([h.Class('text-[17px] text-[var(--mute)]')], jp(h, activity.title)),
      h.div(
        [h.Class('flex w-full gap-3')],
        [
          stat(h, 'XP', `+${total * 2}`, '#f5b800'),
          stat(h, 'Streak', String(model.progress.streak), '#ff9600'),
          stat(h, 'Exercises', String(total), '#1cb0f6'),
        ],
      ),
      h.div(
        [h.Class('flex w-full flex-col gap-3')],
        [
          h.a(
            [
              h.Href(next ? lessonHref(lesson.number, next.id) : lessonHref(lesson.number)),
              h.Class('btn3d ok w-full'),
            ],
            [
              next ? `Next: ${sectionLabel(next)}` : 'Back to the lesson',
              icon(h, ArrowRight, 'size-5'),
            ],
          ),
          h.button(
            [h.Type('button'), h.OnClick(Message.ClickedRestart()), h.Class('btn3d ghost w-full')],
            ['Practice again'],
          ),
        ],
      ),
    ],
  )
}

const bottomBar = (
  model: Model,
  h: H,
  key: string,
  total: number,
  g: ReturnType<typeof gate>,
): Child => {
  const back =
    model.unit > 0
      ? h.button(
          [h.Type('button'), h.OnClick(Message.ClickedBack()), h.Class('btn3d ghost')],
          ['Back'],
        )
      : h.div([], [])
  const cont = (cls: string, label: string) =>
    h.button(
      [
        h.Type('button'),
        h.OnClick(Message.ClickedContinue({ total })),
        h.Class(cn('btn3d min-w-36', cls)),
      ],
      [label],
    )
  const inner: Child =
    g.kind === 'check'
      ? h.div(
          [h.Class('flex items-center justify-between')],
          [
            back,
            h.button(
              [
                h.Type('button'),
                h.Disabled(!g.ready),
                h.OnClick(Message.Checked({ key })),
                h.Class('btn3d min-w-36'),
              ],
              ['Check'],
            ),
          ],
        )
      : g.kind === 'result'
        ? h.div(
            [h.Class('rise flex items-center justify-between gap-3')],
            [
              h.div(
                [
                  h.Class(
                    cn('flex items-center gap-3', g.ok ? 'text-[#58a700]' : 'text-[#ea2b2b]'),
                  ),
                ],
                [
                  h.span(
                    [h.Class('grid size-12 place-items-center rounded-full bg-white')],
                    [icon(h, g.ok ? Check : X, 'size-7 stroke-[4]')],
                  ),
                  h.div(
                    [h.Class('leading-tight')],
                    [
                      h.div(
                        [h.Class('text-[20px] font-black')],
                        [g.ok ? 'Nice work!' : 'Not quite'],
                      ),
                      g.ok
                        ? h.empty
                        : h.div([h.Class('text-[15px] font-bold')], [`Answer: ${g.answer}`]),
                    ],
                  ),
                ],
              ),
              cont(g.ok ? 'ok' : 'bad', 'Continue'),
            ],
          )
        : h.div(
            [h.Class('flex items-center justify-between')],
            [back, cont(g.label === 'Skip' ? 'ghost' : '', g.label)],
          )
  return h.div(
    [
      h.Class(
        cn(
          'bar fixed inset-x-0 bottom-0 z-20 px-4 py-4 sm:py-5',
          g.kind === 'result' && (g.ok ? 'ok' : 'bad'),
        ),
      ),
    ],
    [h.div([h.Class('mx-auto max-w-2xl')], [inner])],
  )
}

/** One activity as a run of single-exercise screens, a progress bar on top and the verdict at the bottom. */
export const player = (model: Model, h: H, lesson: Lesson, activity: Activity): Child => {
  const c: Ctx = { h, model, lesson }
  const units = unitsOf(activity)
  const total = units.length
  const done = model.unit >= total
  const unit = units[Math.min(model.unit, total - 1)]
  const pct = total === 0 ? 100 : Math.min(100, (model.unit / total) * 100)
  return h.div(
    [h.Class('min-h-dvh')],
    [
      h.div(
        [h.Class('sticky top-0 z-20 bg-[var(--paper)]/95 backdrop-blur')],
        [
          h.div(
            [h.Class('mx-auto flex max-w-2xl items-center gap-3 px-4 py-4')],
            [
              h.a(
                [
                  h.Href(lessonHref(lesson.number)),
                  h.AriaLabel('Leave the activity'),
                  h.Class(
                    'grid size-9 place-items-center rounded-xl text-[var(--mute)] hover:bg-black/5',
                  ),
                ],
                [icon(h, X, 'size-6 stroke-[3]')],
              ),
              h.div(
                [h.Class('pbar')],
                [h.div([h.Class('pfill'), h.Style({ width: `${Math.max(pct, 4)}%` })], [])],
              ),
              h.button(
                [
                  h.Type('button'),
                  h.AriaPressed(model.furigana ? 'true' : 'false'),
                  h.AriaLabel('Toggle furigana'),
                  h.OnClick(Message.ToggledFurigana()),
                  h.Class(
                    cn(
                      'grid size-9 place-items-center rounded-xl border-2 transition-colors',
                      model.furigana
                        ? 'border-[var(--c)] bg-[var(--cs)] text-[var(--cd)]'
                        : 'border-[var(--line)] text-[var(--mute)]',
                    ),
                  ),
                ],
                [icon(h, Languages, 'size-5')],
              ),
              h.span(
                [h.Class('flex items-center gap-1 text-[16px] font-black text-[#ff9600]')],
                [icon(h, Flame, 'size-5 fill-current'), String(model.progress.streak)],
              ),
            ],
          ),
        ],
      ),
      done || unit === undefined
        ? complete(model, h, lesson, activity, total)
        : h.div(
            [h.Key(unit.key), h.Class('rise mx-auto max-w-2xl px-4 pt-4 pb-44')],
            [
              h.p(
                [h.Class('mb-4 text-[13px] font-bold text-[var(--mute)]')],
                [`${model.unit + 1} / ${total} · `, ...jp(h, unit.step.title)],
              ),
              taskView(c, unit.task, unit.key),
            ],
          ),
      done || unit === undefined
        ? h.empty
        : bottomBar(model, h, unit.key, total, gate(model, unit)),
    ],
  )
}
