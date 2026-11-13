import type { Html } from 'foldkit/html'
import { Check } from 'lucide'
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
      cn(
        'rounded-xl border-2 border-b-4 bg-white px-3 py-1.5 text-[18px] outline-none transition-colors focus:border-[#1cb0f6] focus:bg-[#f4fbff]',
        state === 'ok'
          ? 'border-[#58cc02] bg-[#e7f8d4]'
          : state === 'bad'
            ? 'border-[#ff4b4b] bg-[#ffe3e3]'
            : 'border-[var(--line)]',
        className,
      ),
    ),
  ])

const optionCard = (c: Ctx, key: string, o: Choice, picked: boolean): Child =>
  c.h.button(
    [
      c.h.Key(`${key}.${o.label}`),
      c.h.Type('button'),
      c.h.AriaPressed(picked ? 'true' : 'false'),
      c.h.OnClick(Message.Picked({ key, value: o.label })),
      c.h.Class(
        cn(
          'card3d flex min-w-28 flex-1 flex-col items-center gap-2 p-3 text-center',
          picked && 'picked',
        ),
      ),
    ],
    [
      o.image
        ? c.h.img([
            c.h.Src(lessonUrl(c.lesson.number, o.image)),
            c.h.Alt(plain(o.ja)),
            c.h.Loading('lazy'),
            c.h.Class('h-28 w-auto rounded-xl object-contain'),
          ])
        : c.h.empty,
      c.h.span(
        [c.h.Class('text-[18px] leading-snug font-bold')],
        [
          c.h.span(
            [
              c.h.Class(
                'mr-1.5 inline-grid size-6 place-items-center rounded-lg border-2 border-[var(--line)] align-middle text-[12px]',
              ),
            ],
            [o.label],
          ),
          ...jp(c.h, o.ja),
        ],
      ),
      en(c.h, o.en),
    ],
  )

const chooseQuiz = (c: Ctx, quiz: Extract<Quiz, { type: 'choose' }>, key: string): Child =>
  c.h.div(
    [c.h.Class('mt-4 flex flex-col gap-5')],
    quiz.items.flatMap((item, i) =>
      item.questions.map((q, k) => {
        const qkey = `${key}.c${i}.${k}`
        return c.h.div(
          [c.h.Key(qkey), c.h.Class('flex flex-col gap-2.5')],
          [
            c.h.div(
              [c.h.Class('flex flex-wrap items-center gap-2.5')],
              [
                item.audio ? playButton(c, item.audio) : c.h.empty,
                q.prompt
                  ? c.h.span([c.h.Class('text-[17px] font-bold')], jp(c.h, q.prompt))
                  : c.h.empty,
              ],
            ),
            c.h.div(
              [c.h.Class('flex flex-wrap gap-2.5')],
              q.options.map((o) => optionCard(c, qkey, o, c.model.picks[qkey] === o.label)),
            ),
          ],
        )
      }),
    ),
  )

const fillQuiz = (c: Ctx, quiz: Extract<Quiz, { type: 'fill' }>, key: string): Child => {
  const checked = has(c.model.checked, key)
  return c.h.div(
    [c.h.Class('mt-4 flex flex-col gap-1')],
    quiz.items.map((item, i) => {
      const children: Array<Child> = []
      item.parts.forEach((part, at) => {
        children.push(c.h.span([], jp(c.h, part)))
        if (at < item.parts.length - 1) {
          const k = `${key}.f${i}.${at}`
          const value = c.model.typed[k] ?? ''
          const graded = checked && item.answers.length > 0
          const ok = item.answers.some((a) => norm(a[at]?.text ?? '\u0000') === norm(value))
          children.push(
            textInput(c, k, 'mx-1.5 w-36 text-center', graded ? (ok ? 'ok' : 'bad') : 'open'),
          )
        }
      })
      return c.h.div(
        [c.h.Key(`${key}.f${i}`), c.h.Class('py-2 text-[19px] leading-[2.4]')],
        children,
      )
    }),
  )
}

export const dialogueView = (c: Ctx, d: Dialogue, key: string, blur = false): Child => {
  const hidden = blur && c.model.hideScripts && !has(c.model.revealed, key)
  const speakers = [...new Set(d.turns.map((t) => t.speaker))]
  return c.h.div(
    [
      c.h.Key(key),
      c.h.Class(
        cn(
          'flex flex-col gap-2',
          blur && 'card3d p-4',
          blur && c.model.hideScripts && 'cursor-pointer',
        ),
      ),
      ...(blur && c.model.hideScripts ? [c.h.OnClick(Message.ToggledReveal({ key }))] : []),
    ],
    [
      d.audio ? c.h.div([], [playButton(c, d.audio)]) : c.h.empty,
      c.h.div(
        [
          c.h.Class(
            cn('flex flex-col gap-2 transition-[filter]', hidden && 'blur-[8px] select-none'),
          ),
        ],
        d.turns.map((t, i) => {
          const right = speakers.indexOf(t.speaker) % 2 === 1
          return c.h.div(
            [
              c.h.Key(`${key}.${i}`),
              c.h.Class(cn('flex items-end gap-2', right && 'flex-row-reverse')),
            ],
            [
              c.h.span(
                [
                  c.h.Class(
                    cn(
                      'grid size-8 shrink-0 place-items-center rounded-full text-[12px] font-black text-white',
                      right ? 'bg-[#ff9600]' : 'bg-[#1cb0f6]',
                    ),
                  ),
                ],
                [Array.from(t.speaker)[0] ?? '·'],
              ),
              c.h.span(
                [
                  c.h.Class(
                    cn(
                      'max-w-[85%] rounded-2xl border-2 px-3.5 py-2 text-[17px] leading-relaxed',
                      right
                        ? 'rounded-br-md border-[#ffd9a3] bg-[#fff3df]'
                        : 'rounded-bl-md border-[var(--line)] bg-white',
                    ),
                  ),
                ],
                jp(c.h, t.text),
              ),
            ],
          )
        }),
      ),
    ],
  )
}

const tableView = (c: Ctx, tb: Table): Child =>
  c.h.div(
    [c.h.Class('mt-3 overflow-x-auto rounded-2xl border-2 border-[var(--line)] bg-white')],
    [
      c.h.table(
        [c.h.Class('w-full border-collapse text-[17px]')],
        [
          tb.headings.length
            ? c.h.thead(
                [],
                [
                  c.h.tr(
                    [c.h.Class('bg-[var(--cs)]')],
                    tb.headings.map((x) =>
                      c.h.th(
                        [c.h.Class('px-3 py-2 text-left font-bold')],
                        [
                          ...jp(c.h, x.ja),
                          x.en
                            ? c.h.span(
                                [c.h.Class('ml-1 text-[12px] font-normal text-[var(--mute)]')],
                                [x.en],
                              )
                            : c.h.empty,
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
                [c.h.Key(`row${i}`), c.h.Class('border-t-2 border-[var(--line)]')],
                r.flatMap((e, k) => [
                  c.h.td([c.h.Key(`t${k}`), c.h.Class('px-3 py-2 font-bold')], jp(c.h, e.term)),
                  c.h.td(
                    [c.h.Key(`r${k}`), c.h.Class('px-3 py-2 text-[var(--mute)]')],
                    jp(c.h, e.reading),
                  ),
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
    [c.h.Class('mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2')],
    (t.practice ?? []).map((b, i) =>
      c.h.div(
        [
          c.h.Key(`bubble${i}`),
          c.h.Class(
            cn(
              'rounded-3xl border-2 border-b-4 px-4 py-2.5 text-[18px]',
              b.side === 'a'
                ? 'border-[#ffe08a] bg-[#fff6cf] sm:col-start-1'
                : 'border-[#ffc89c] bg-[#ffe8d4] sm:col-start-2',
            ),
          ),
        ],
        b.lines.map((l, k) =>
          c.h.div(
            [
              c.h.Key(`l${k}`),
              c.h.Class(
                cn('py-1 leading-loose', k > 0 && 'border-t-2 border-dashed border-[#ffc89c]'),
              ),
            ],
            jp(c.h, l),
          ),
        ),
      ),
    ),
  )

const gridView = (c: Ctx, t: Task, key: string): Child => {
  const g = t.grid
  if (!g) return c.h.empty
  const rows = g.rows.length ? g.rows : [undefined]
  return c.h.div(
    [c.h.Class('mt-3 overflow-x-auto rounded-2xl border-2 border-[var(--line)] bg-white')],
    [
      c.h.table(
        [c.h.Class('w-full border-collapse text-[17px]')],
        [
          c.h.thead(
            [],
            [
              c.h.tr(
                [c.h.Class('bg-[var(--cs)]')],
                [
                  c.h.th([], []),
                  ...g.columns.map((col) =>
                    c.h.th([c.h.Class('px-3 py-2 text-left font-bold')], jp(c.h, col)),
                  ),
                ],
              ),
            ],
          ),
          c.h.tbody(
            [],
            rows.map((r, i) =>
              c.h.tr(
                [c.h.Key(`g${i}`), c.h.Class('border-t-2 border-[var(--line)]')],
                [
                  c.h.th([c.h.Class('px-3 py-2 text-left font-bold')], r ? jp(c.h, r) : []),
                  ...g.columns.map((_, k) =>
                    c.h.td(
                      [c.h.Key(`c${k}`), c.h.Class('px-2 py-1.5')],
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
    [c.h.Class('mt-4 flex flex-col gap-2')],
    blocks.map((b, i) => {
      const k = `${key}.b${i}`
      const on = has(c.model.revealed, k)
      return c.h.div(
        [c.h.Key(k), c.h.Class('flex flex-col gap-1.5')],
        [
          c.h.div(
            [c.h.Class('flex items-start gap-2.5 text-[18px] leading-relaxed')],
            [
              t.response === 'check' && b.ja
                ? c.h.button(
                    [
                      c.h.Type('button'),
                      c.h.AriaPressed(on ? 'true' : 'false'),
                      c.h.AriaLabel('Mark'),
                      c.h.OnClick(Message.ToggledReveal({ key: k })),
                      c.h.Class(
                        cn(
                          'mt-1 grid size-7 shrink-0 place-items-center rounded-lg border-2 border-b-4 transition-colors',
                          on
                            ? 'border-[#46a302] bg-[#58cc02] text-white'
                            : 'border-[var(--line)] bg-white',
                        ),
                      ),
                    ],
                    [on ? icon(c.h, Check, 'size-4') : c.h.empty],
                  )
                : c.h.empty,
              c.h.span([], jp(c.h, b.ja)),
            ],
          ),
          en(c.h, b.en),
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
        [c.h.Class('mt-4 flex flex-wrap gap-2.5')],
        t.vocab.map((v, i) =>
          c.h.span(
            [c.h.Key(`v${i}`), c.h.Class('card3d inline-flex flex-col px-3.5 py-2 leading-tight')],
            [
              c.h.span([c.h.Class('text-[20px] font-bold')], jp(c.h, v.ja)),
              c.h.span([c.h.Class('text-[13px] text-[var(--mute)]')], [v.en]),
            ],
          ),
        ),
      )

const pictures = (c: Ctx, t: Task, key: string): Child =>
  c.h.div(
    [c.h.Class('mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3')],
    t.choices
      .flat()
      .map((o) =>
        c.h.div(
          [
            c.h.Key(`${key}.${o.label}`),
            c.h.Class('card3d flex flex-col items-center gap-2 p-3 text-center'),
          ],
          [
            o.image
              ? c.h.img([
                  c.h.Src(lessonUrl(c.lesson.number, o.image)),
                  c.h.Alt(plain(o.ja)),
                  c.h.Loading('lazy'),
                  c.h.Class('h-28 w-auto object-contain'),
                ])
              : c.h.empty,
            c.h.span(
              [c.h.Class('text-[18px] leading-snug font-bold')],
              [
                c.h.span(
                  [
                    c.h.Class(
                      'mr-1.5 inline-grid size-6 place-items-center rounded-lg border-2 border-[var(--line)] align-middle text-[12px]',
                    ),
                  ],
                  [o.label],
                ),
                ...jp(c.h, o.ja),
              ],
            ),
            en(c.h, o.en),
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
      label ? h.div([h.Class('mb-2')], [h.span([h.Class('chip')], [label])]) : h.empty,
      t.instruction.text
        ? h.h2(
            [h.Class('text-[24px] leading-snug font-black sm:text-[28px]')],
            jp(h, t.instruction),
          )
        : h.empty,
      en(h, t.instruction_en, 'mt-1 text-[15px]'),
      h.div(
        [h.Class('mt-3')],
        [hasQuiz && t.quiz?.type === 'choose' ? h.empty : plays(c, t.audio)],
      ),
      t.quiz?.type === 'choose' ? h.div([h.Class('mt-1')], [plays(c, t.audio)]) : h.empty,
      t.practice?.length ? bubbles(c, t) : h.empty,
      !hasQuiz && t.choices.length && (t.kind === 'words' || t.number === 0)
        ? pictures(c, t, key)
        : h.empty,
      !hasQuiz && t.grid ? gridView(c, t, key) : h.empty,
      t.dialogues.length
        ? h.div(
            [h.Class('mt-4 flex flex-col gap-5')],
            t.dialogues.map((d, i) => dialogueView(c, d, `${key}.d${i}`)),
          )
        : h.empty,
      vocabView(c, t),
      ...(t.tables ?? []).map((tb) => tableView(c, tb)),
      t.quiz?.type === 'choose' ? chooseQuiz(c, t.quiz, key) : h.empty,
      t.quiz?.type === 'fill' ? fillQuiz(c, t.quiz, key) : h.empty,
      bodyView(c, t, key),
      ...(t.hints ?? []).map((b, i) =>
        h.div(
          [h.Key(`${key}.h${i}`), h.Class('mt-4 rounded-2xl bg-[var(--cs)] px-4 py-3 text-[16px]')],
          [h.div([h.Class('font-bold')], jp(h, b.ja)), en(h, b.en)],
        ),
      ),
      ...(flat
        ? []
        : (t.subtasks ?? []).map((s, i) => taskView(c, s, `${key}.${s.number}-${i}`, flat))),
    ],
  )
}
