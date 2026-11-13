import type { Html } from 'foldkit/html'
import { Check, Eye } from 'lucide'
import { icon } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { Message } from '../app/state.ts'
import { norm } from '../app/units.ts'
import { lessonUrl } from '../data/queries.ts'
import type { Block, Choice, Dialogue, Quiz, Table, Task } from '../data/types.ts'
import { type Child, type Ctx, en, has, jp, plain, playButton, plays } from '../ui/common.ts'

const KIND: Record<string, string> = {
  listen: 'Listen',
  choose: 'Choose',
  fill: 'Fill in',
  shadow: 'Shadow',
  repeat: 'Repeat',
  notice: 'Notice',
  vocab: 'New words',
  practice: 'Practice',
  speak: 'Speak',
  mark: 'Mark',
  note: 'Note',
  read: 'Read',
  write: 'Write',
  answer: 'Answer',
  order: 'Order',
  intro: 'Warm up',
  words: 'New words',
  diagram: 'Pattern',
}

const textInput = (
  c: Ctx,
  key: string,
  className: string,
  state: 'ok' | 'bad' | 'open' = 'open',
): Child =>
  c.h.input([
    c.h.Key(key),
    c.h.Type('text'),
    c.h.AriaLabel('Your answer'),
    c.h.Value(c.model.typed[key] ?? ''),
    c.h.OnInput((value) => Message.Typed({ key, value })),
    c.h.Class(
      cn('answer', state === 'ok' ? 'is-ok' : state === 'bad' ? 'is-bad' : undefined, className),
    ),
  ])

const choiceRow = (c: Ctx, key: string, o: Choice, picked: boolean): Child =>
  c.h.button(
    [
      c.h.Key(`${key}.${o.label}`),
      c.h.Type('button'),
      c.h.AriaPressed(picked ? 'true' : 'false'),
      c.h.OnClick(Message.Picked({ key, value: o.label })),
      c.h.Class(cn('choice-row', picked && 'is-picked')),
    ],
    [
      c.h.span(
        [c.h.Class('choice-key')],
        [picked ? icon(c.h, Check, 'size-3 stroke-[3]') : o.label],
      ),
      c.h.div(
        [],
        [
          o.image
            ? c.h.img([
                c.h.Src(lessonUrl(c.lesson.number, o.image)),
                c.h.Alt(plain(o.ja)),
                c.h.Loading('lazy'),
                c.h.Class('choice-img'),
              ])
            : c.h.empty,
          c.h.span([c.h.Class('choice-text')], jp(c.h, o.ja)),
          en(c.h, o.en, 'choice-en'),
        ],
      ),
    ],
  )

const chooseQuiz = (c: Ctx, quiz: Extract<Quiz, { type: 'choose' }>, key: string): Child =>
  c.h.div(
    [c.h.Class('flex flex-col gap-5')],
    quiz.items.flatMap((item, i) =>
      item.questions.map((q, k) => {
        const qkey = `${key}.c${i}.${k}`
        return c.h.div(
          [c.h.Key(qkey), c.h.Class('flex flex-col gap-1')],
          [
            c.h.div(
              [c.h.Class('flex flex-wrap items-center gap-2')],
              [
                item.audio ? playButton(c, item.audio, `Conversation ${i + 1}`) : c.h.empty,
                q.prompt
                  ? c.h.span([c.h.Class('text-[1.05rem] font-bold')], jp(c.h, q.prompt))
                  : c.h.empty,
              ],
            ),
            c.h.div(
              [c.h.Class('choice-list')],
              q.options.map((o) => choiceRow(c, qkey, o, c.model.picks[qkey] === o.label)),
            ),
          ],
        )
      }),
    ),
  )

const fillQuiz = (c: Ctx, quiz: Extract<Quiz, { type: 'fill' }>, key: string): Child => {
  const checked = has(c.model.checked, key)
  return c.h.div(
    [c.h.Class('task-body')],
    quiz.items.map((item, i) => {
      const children: Array<Child> = []
      item.parts.forEach((part, at) => {
        children.push(c.h.span([], jp(c.h, part)))
        if (at < item.parts.length - 1) {
          const k = `${key}.f${i}.${at}`
          const value = c.model.typed[k] ?? ''
          const graded = checked && item.answers.length > 0
          const ok = item.answers.some((a) => norm(a[at]?.text ?? '\u0000') === norm(value))
          children.push(textInput(c, k, 'mx-1', graded ? (ok ? 'ok' : 'bad') : 'open'))
        }
      })
      return c.h.div([c.h.Key(`${key}.f${i}`), c.h.Class('fill-line')], children)
    }),
  )
}

export const dialogueView = (
  c: Ctx,
  d: Dialogue,
  key: string,
  blur = false,
  label?: string,
): Child => {
  const hidden = blur && c.model.hideScripts && !has(c.model.revealed, key)
  const turns = d.turns.map((t, i) =>
    c.h.div(
      [c.h.Key(`${key}.${i}`), c.h.Class('script-item')],
      [
        c.h.span([c.h.Class('script-speaker')], [t.speaker]),
        c.h.div([], [c.h.div([c.h.Class('script-ja')], jp(c.h, t.text))]),
      ],
    ),
  )
  return c.h.div(
    [
      c.h.Key(key),
      c.h.Class(cn(blur && 'script-box', hidden && 'is-hidden')),
      ...(hidden ? [c.h.OnClick(Message.ToggledReveal({ key }))] : []),
    ],
    [
      d.audio ? c.h.div([c.h.Class('audio-row')], [playButton(c, d.audio, label)]) : c.h.empty,
      hidden
        ? c.h.div(
            [c.h.Class('script-reveal')],
            [
              c.h.button(
                [
                  c.h.Type('button'),
                  c.h.OnClick(Message.ToggledReveal({ key }), { propagation: 'Stop' }),
                  c.h.Class('reveal-btn'),
                ],
                [icon(c.h, Eye, 'size-4'), 'Reveal script'],
              ),
            ],
          )
        : c.h.empty,
      c.h.div(
        [c.h.Class(cn('script-turns', hidden && 'is-blurred'))],
        [c.h.div([c.h.Class('script')], turns)],
      ),
    ],
  )
}

const tableView = (c: Ctx, tb: Table): Child =>
  c.h.div(
    [c.h.Class('table-wrap')],
    [
      c.h.table(
        [c.h.Class('data-table')],
        [
          tb.headings.length
            ? c.h.thead(
                [],
                [
                  c.h.tr(
                    [],
                    tb.headings.map((x) =>
                      c.h.th(
                        [],
                        [
                          ...jp(c.h, x.ja),
                          x.en ? c.h.span([c.h.Class('en ml-1')], [x.en]) : c.h.empty,
                        ],
                      ),
                    ),
                  ),
                ],
              )
            : c.h.empty,
          c.h.tbody(
            [],
            tb.rows.map((r, i) =>
              c.h.tr(
                [c.h.Key(`row${i}`)],
                r.flatMap((e, k) => [
                  c.h.td([c.h.Key(`t${k}`), c.h.Class('font-bold')], jp(c.h, e.term)),
                  c.h.td([c.h.Key(`r${k}`)], jp(c.h, e.reading)),
                ]),
              ),
            ),
          ),
        ],
      ),
    ],
  )

const bubbles = (c: Ctx, t: Task): Child =>
  c.h.div(
    [c.h.Class('practice-list')],
    (t.practice ?? []).map((b, i) =>
      c.h.div(
        [c.h.Key(`bubble${i}`), c.h.Class('practice')],
        [
          c.h.span([c.h.Class('script-speaker')], [b.side.toUpperCase()]),
          c.h.div(
            [],
            b.lines.map((l, k) => c.h.div([c.h.Key(`l${k}`), c.h.Class('line')], jp(c.h, l))),
          ),
        ],
      ),
    ),
  )

const gridView = (c: Ctx, t: Task, key: string): Child => {
  const g = t.grid
  if (!g) return c.h.empty
  const rows = g.rows.length ? g.rows : [undefined]
  return c.h.div(
    [c.h.Class('table-wrap')],
    [
      c.h.table(
        [c.h.Class('data-table')],
        [
          c.h.thead(
            [],
            [c.h.tr([], [c.h.th([], []), ...g.columns.map((col) => c.h.th([], jp(c.h, col)))])],
          ),
          c.h.tbody(
            [],
            rows.map((r, i) =>
              c.h.tr(
                [c.h.Key(`g${i}`)],
                [
                  c.h.th([], r ? jp(c.h, r) : []),
                  ...g.columns.map((_, k) =>
                    c.h.td(
                      [c.h.Key(`c${k}`)],
                      [textInput(c, `${key}.g${i}.${k}`, 'w-full min-w-24')],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    ],
  )
}

const bodyView = (c: Ctx, t: Task, key: string): Child => {
  const used = new Set<string>()
  const q = t.quiz
  if (q?.type === 'fill') q.items.forEach((it) => it.parts.forEach((p) => used.add(plain(p))))
  if (q?.type === 'choose')
    q.items.forEach((it) => it.questions.forEach((x) => x.prompt && used.add(plain(x.prompt))))
  const blocks = t.body.filter((b: Block) => !(b.ja && used.has(plain(b.ja))))
  if (blocks.length === 0) return c.h.empty
  return c.h.div(
    [c.h.Class('task-body flex flex-col gap-3')],
    blocks.map((b, i) => {
      const k = `${key}.b${i}`
      const on = has(c.model.revealed, k)
      return c.h.div(
        [c.h.Key(k), c.h.Class('flex flex-col gap-1')],
        [
          c.h.div(
            [c.h.Class('flex items-start gap-2.5')],
            [
              t.response === 'check' && b.ja
                ? c.h.button(
                    [
                      c.h.Type('button'),
                      c.h.AriaPressed(on ? 'true' : 'false'),
                      c.h.AriaLabel(`${on ? 'Unmark' : 'Mark'} this line as read`),
                      c.h.OnClick(Message.ToggledReveal({ key: k })),
                      c.h.Class('mark-btn mt-1'),
                    ],
                    [on ? icon(c.h, Check, 'size-3 stroke-[3]') : c.h.empty],
                  )
                : c.h.empty,
              c.h.span([c.h.Class('note-ja')], jp(c.h, b.ja)),
            ],
          ),
          en(c.h, b.en, 'note-en'),
          t.response === 'text' && b.ja ? textInput(c, k, 'w-full max-w-xl') : c.h.empty,
        ],
      )
    }),
  )
}

const vocabView = (c: Ctx, t: Task): Child =>
  t.vocab.length === 0
    ? c.h.empty
    : c.h.div(
        [c.h.Class('vocab-row')],
        t.vocab.map((v, i) =>
          c.h.span(
            [c.h.Key(`v${i}`), c.h.Class('vocab-item')],
            [
              c.h.span([c.h.Class('vocab-ja')], jp(c.h, v.ja)),
              c.h.span([c.h.Class('vocab-en')], [v.en]),
            ],
          ),
        ),
      )

const pictures = (c: Ctx, t: Task, key: string): Child =>
  c.h.div(
    [c.h.Class('choice-grid')],
    t.choices
      .flat()
      .map((o) =>
        c.h.div(
          [c.h.Key(`${key}.${o.label}`), c.h.Class('picture')],
          [
            o.image
              ? c.h.img([
                  c.h.Src(lessonUrl(c.lesson.number, o.image)),
                  c.h.Alt(plain(o.ja)),
                  c.h.Loading('lazy'),
                ])
              : c.h.empty,
            c.h.span(
              [c.h.Class('flex items-baseline gap-1.5')],
              [
                c.h.span([c.h.Class('text-[0.7rem] font-bold')], [o.label]),
                c.h.span([c.h.Class('choice-text')], jp(c.h, o.ja)),
              ],
            ),
            en(c.h, o.en, 'choice-en'),
          ],
        ),
      ),
  )

/** One exercise. `flat` leaves its sub-questions to the player, which shows them as exercises of their own. */
export const taskView = (c: Ctx, t: Task, key: string, flat = true): Html => {
  const { h } = c
  const hasQuiz = t.quiz !== undefined
  const label = t.kind ? KIND[t.kind] : undefined
  return h.div(
    [h.Key(key), h.Class('flex flex-col')],
    [
      h.div(
        [h.Class('task-head')],
        [
          label ? h.div([h.Class('task-kind')], [label]) : h.empty,
          t.instruction.text ? h.h2([h.Class('task-title')], jp(h, t.instruction)) : h.empty,
          en(h, t.instruction_en, 'task-en'),
          t.quiz?.type === 'choose' ? h.empty : plays(c, t.audio),
        ],
      ),
      h.div(
        [h.Class('task-body')],
        [
          t.practice?.length ? bubbles(c, t) : h.empty,
          !hasQuiz && t.choices.length && (t.kind === 'words' || t.number === 0)
            ? pictures(c, t, key)
            : h.empty,
          !hasQuiz && t.grid ? gridView(c, t, key) : h.empty,
          t.dialogues.length
            ? h.div(
                [h.Class('flex flex-col gap-4')],
                t.dialogues.map((d, i) =>
                  dialogueView(c, d, `${key}.d${i}`, false, `Dialogue ${i + 1}`),
                ),
              )
            : h.empty,
          vocabView(c, t),
          ...(t.tables ?? []).map((tb) => tableView(c, tb)),
          t.quiz?.type === 'choose' ? chooseQuiz(c, t.quiz, key) : h.empty,
          t.quiz?.type === 'fill' ? fillQuiz(c, t.quiz, key) : h.empty,
          bodyView(c, t, key),
          ...(t.hints ?? []).map((b, i) =>
            h.div(
              [h.Key(`${key}.h${i}`), h.Class('hint')],
              [h.div([h.Class('ja')], jp(h, b.ja)), h.div([h.Class('en')], [b.en ?? ''])],
            ),
          ),
          ...(flat
            ? []
            : (t.subtasks ?? []).map((s, i) => taskView(c, s, `${key}.${s.number}-${i}`, flat))),
        ],
      ),
    ],
  )
}
