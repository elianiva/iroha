import type { Html } from 'foldkit/html'
import { Check } from 'lucide'
import { icon } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { badge } from '@/components/ui/badge'
import { button } from '@/components/ui/button'
import { Message } from '../app/state.ts'
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
  vocab: 'Words',
  practice: 'Practice',
  speak: 'Speak',
  mark: 'Mark',
  note: 'Note',
  read: 'Read',
  write: 'Write',
  answer: 'Answer',
  order: 'Order',
}

const norm = (s: string): string => s.replace(/[\s\u3000、。，,.]/g, '')

const textInput = (c: Ctx, key: string, className: string, placeholder = ''): Child =>
  c.h.input([
    c.h.Key(key),
    c.h.Type('text'),
    c.h.AriaLabel('Your answer'),
    c.h.Placeholder(placeholder),
    c.h.Value(c.model.typed[key] ?? ''),
    c.h.OnInput((value) => Message.Typed({ key, value })),
    c.h.Class(
      cn(
        'rounded-md border border-border bg-background px-2 py-1 text-[15px] outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
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
          'flex min-w-24 flex-col items-center gap-1.5 rounded-lg border p-2 text-center transition-colors',
          picked
            ? 'border-primary bg-primary/5 ring-1 ring-primary'
            : 'border-border bg-card hover:bg-muted',
        ),
      ),
    ],
    [
      o.image
        ? c.h.img([
            c.h.Src(lessonUrl(c.lesson.number, o.image)),
            c.h.Alt(plain(o.ja)),
            c.h.Loading('lazy'),
            c.h.Class('h-20 w-auto rounded-md object-contain'),
          ])
        : c.h.empty,
      c.h.span(
        [c.h.Class('text-[15px] leading-snug')],
        [
          c.h.span(
            [c.h.Class('mr-1 font-mono text-[12px] text-muted-foreground')],
            [`${o.label}.`],
          ),
          ...jp(c.h, o.ja),
        ],
      ),
      en(c.h, o.en, 'text-[12px]'),
    ],
  )

const chooseQuiz = (c: Ctx, quiz: Extract<Quiz, { type: 'choose' }>, key: string): Child =>
  c.h.div(
    [c.h.Class('mt-3 flex flex-col gap-3')],
    [
      ...quiz.items.flatMap((item, i) =>
        item.questions.map((q, k) => {
          const qkey = `${key}.c${i}.${k}`
          return c.h.div(
            [c.h.Key(qkey), c.h.Class('rounded-xl border border-border bg-muted/30 p-3')],
            [
              c.h.div(
                [c.h.Class('mb-2 flex flex-wrap items-center gap-2')],
                [
                  item.audio ? playButton(c, item.audio) : c.h.empty,
                  q.prompt
                    ? c.h.span([c.h.Class('text-[15px] font-medium')], jp(c.h, q.prompt))
                    : c.h.empty,
                ],
              ),
              c.h.div(
                [c.h.Class('flex flex-wrap gap-2')],
                q.options.map((o) => optionCard(c, qkey, o, c.model.picks[qkey] === o.label)),
              ),
            ],
          )
        }),
      ),
      c.h.p(
        [c.h.Class('text-[12px] text-muted-foreground')],
        [
          'The book prints no answer key for this task, so picks are not graded. Listen, choose, then check with a teacher.',
        ],
      ),
    ],
  )

const fillQuiz = (c: Ctx, quiz: Extract<Quiz, { type: 'fill' }>, key: string): Child => {
  const checked = has(c.model.checked, key)
  const shown = has(c.model.revealed, key)
  const verdict = (
    k: string,
    answers: ReadonlyArray<ReadonlyArray<{ text: string }>>,
    at: number,
  ): 'ok' | 'bad' | 'open' => {
    const value = c.model.typed[k] ?? ''
    if (!checked || value.trim() === '' || answers.length === 0) return 'open'
    return answers.some((a) => a[at] && norm(a[at].text) === norm(value)) ? 'ok' : 'bad'
  }
  let right = 0
  let total = 0
  const rows = quiz.items.map((item, i) => {
    const children: Array<Child> = []
    item.parts.forEach((part, at) => {
      children.push(c.h.span([], jp(c.h, part)))
      if (at < item.parts.length - 1) {
        const k = `${key}.f${i}.${at}`
        const v = verdict(k, item.answers, at)
        if (
          v !== 'open' ||
          (checked && (c.model.typed[k] ?? '').trim() !== '' && item.answers.length > 0)
        ) {
          total += 1
          if (v === 'ok') right += 1
        }
        children.push(
          textInput(
            c,
            k,
            cn(
              'mx-1 w-32 text-center',
              v === 'ok' && 'border-ok bg-ok/10',
              v === 'bad' && 'border-danger bg-danger/10',
            ),
          ),
        )
      }
    })
    if (shown) {
      children.push(
        c.h.span(
          [c.h.Class('ml-2 text-[13px] text-muted-foreground')],
          item.answers.length === 0
            ? ['(not in the book)']
            : ['→ ', item.answers.map((a) => a.map((x) => x.text).join(' / ')).join('  |  ')],
        ),
      )
    }
    return c.h.div([c.h.Key(`${key}.f${i}`), c.h.Class('py-1.5 leading-loose')], children)
  })
  return c.h.div(
    [c.h.Class('mt-3 rounded-xl border border-border bg-muted/30 p-3')],
    [
      ...rows,
      c.h.div(
        [c.h.Class('mt-2 flex flex-wrap items-center gap-2')],
        [
          button(
            { size: 'sm', onClick: Message.Checked({ key }), variant: 'default' },
            'Check',
            c.h,
          ),
          button(
            { size: 'sm', variant: 'outline', onClick: Message.ToggledReveal({ key }) },
            shown ? 'Hide answers' : 'Show answers',
            c.h,
          ),
          checked && total > 0
            ? c.h.span([c.h.Class('text-[13px] font-medium tabular-nums')], [`${right} / ${total}`])
            : c.h.empty,
        ],
      ),
    ],
  )
}

const dialogueView = (c: Ctx, d: Dialogue, key: string, blur = false): Child => {
  const hidden = blur && c.model.hideScripts && !has(c.model.revealed, key)
  return c.h.div(
    [
      c.h.Key(key),
      c.h.Class(
        cn(
          'rounded-xl border border-border bg-card p-3',
          blur && c.model.hideScripts && 'cursor-pointer',
        ),
      ),
      ...(blur && c.model.hideScripts ? [c.h.OnClick(Message.ToggledReveal({ key }))] : []),
    ],
    [
      d.audio ? c.h.div([c.h.Class('mb-1.5')], [playButton(c, d.audio)]) : c.h.empty,
      c.h.div(
        [
          c.h.Class(
            cn('flex flex-col gap-1 transition-[filter]', hidden && 'blur-[7px] select-none'),
          ),
        ],
        d.turns.map((t, i) =>
          c.h.div(
            [c.h.Key(`${key}.${i}`), c.h.Class('flex gap-3 text-[15px] leading-relaxed')],
            [
              c.h.span(
                [
                  c.h.Class(
                    'w-12 shrink-0 text-right text-[12px] leading-[2] text-muted-foreground',
                  ),
                ],
                [t.speaker],
              ),
              c.h.span([], jp(c.h, t.text)),
            ],
          ),
        ),
      ),
    ],
  )
}

export { dialogueView }

const tableView = (c: Ctx, tb: Table): Child =>
  c.h.div(
    [c.h.Class('mt-2 overflow-x-auto rounded-lg border border-border')],
    [
      c.h.table(
        [c.h.Class('w-full border-collapse text-[15px]')],
        [
          tb.headings.length
            ? c.h.thead(
                [],
                [
                  c.h.tr(
                    [c.h.Class('bg-muted')],
                    tb.headings.map((x) =>
                      c.h.th(
                        [c.h.Class('px-3 py-1.5 text-left font-medium')],
                        [
                          ...jp(c.h, x.ja),
                          x.en
                            ? c.h.span(
                                [c.h.Class('ml-1 text-[12px] font-normal text-muted-foreground')],
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
                [c.h.Key(`row${i}`), c.h.Class('border-t border-border')],
                r.flatMap((e, k) => [
                  c.h.td([c.h.Key(`t${k}`), c.h.Class('px-3 py-1.5')], jp(c.h, e.term)),
                  c.h.td(
                    [c.h.Key(`r${k}`), c.h.Class('px-3 py-1.5 text-muted-foreground')],
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
    [c.h.Class('my-3 grid grid-cols-1 gap-2 sm:grid-cols-2')],
    (t.practice ?? []).map((b, i) =>
      c.h.div(
        [
          c.h.Key(`bubble${i}`),
          c.h.Class(
            cn(
              'rounded-2xl border px-3.5 py-2 text-[15px]',
              b.side === 'a'
                ? 'border-amber-300/70 bg-amber-50 sm:col-start-1'
                : 'border-orange-300/70 bg-orange-50 sm:col-start-2',
            ),
          ),
        ],
        b.lines.map((l, k) =>
          c.h.div(
            [
              c.h.Key(`l${k}`),
              c.h.Class(
                cn('py-0.5 leading-loose', k > 0 && 'border-t border-dashed border-orange-300/70'),
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
    [c.h.Class('mt-2 overflow-x-auto rounded-lg border border-border')],
    [
      c.h.table(
        [c.h.Class('w-full border-collapse text-[15px]')],
        [
          c.h.thead(
            [],
            [
              c.h.tr(
                [c.h.Class('bg-muted')],
                [
                  c.h.th([], []),
                  ...g.columns.map((col) =>
                    c.h.th([c.h.Class('px-3 py-1.5 text-left font-medium')], jp(c.h, col)),
                  ),
                ],
              ),
            ],
          ),
          c.h.tbody(
            [],
            rows.map((r, i) =>
              c.h.tr(
                [c.h.Key(`g${i}`), c.h.Class('border-t border-border')],
                [
                  c.h.th([c.h.Class('px-3 py-1.5 text-left font-medium')], r ? jp(c.h, r) : []),
                  ...g.columns.map((_, k) =>
                    c.h.td(
                      [c.h.Key(`c${k}`), c.h.Class('px-2 py-1')],
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
  const intro = t.number === 0
  return c.h.div(
    [c.h.Class(cn('mt-2 flex flex-col gap-1.5', intro && 'text-[15px]'))],
    blocks.map((b, i) => {
      const k = `${key}.b${i}`
      const on = has(c.model.revealed, k)
      return c.h.div(
        [c.h.Key(k), c.h.Class('flex flex-col gap-1')],
        [
          c.h.div(
            [c.h.Class('flex items-start gap-2 text-[15px] leading-relaxed')],
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
                          'mt-1 grid size-5 shrink-0 place-items-center rounded border',
                          on
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border bg-background',
                        ),
                      ),
                    ],
                    [on ? icon(c.h, Check, 'size-3.5') : c.h.empty],
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
        [c.h.Class('mt-2 flex flex-wrap gap-1.5')],
        t.vocab.map((v, i) =>
          c.h.span(
            [
              c.h.Key(`v${i}`),
              c.h.Class(
                'inline-flex items-baseline gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-[15px]',
              ),
            ],
            [
              c.h.span([], jp(c.h, v.ja)),
              c.h.span([c.h.Class('text-[12px] text-muted-foreground')], [v.en]),
            ],
          ),
        ),
      )

/** A picture vocabulary list: the choices are labelled pictures, not an exercise. */
const pictures = (c: Ctx, t: Task, key: string): Child =>
  c.h.div(
    [c.h.Class('mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4')],
    t.choices
      .flat()
      .map((o) =>
        c.h.div(
          [
            c.h.Key(`${key}.${o.label}`),
            c.h.Class(
              'flex flex-col items-center gap-1.5 rounded-xl border border-border bg-card p-2.5 text-center',
            ),
          ],
          [
            o.image
              ? c.h.img([
                  c.h.Src(lessonUrl(c.lesson.number, o.image)),
                  c.h.Alt(plain(o.ja)),
                  c.h.Loading('lazy'),
                  c.h.Class('h-24 w-auto object-contain'),
                ])
              : c.h.empty,
            c.h.span(
              [c.h.Class('text-[15px] leading-snug')],
              [
                c.h.span(
                  [c.h.Class('mr-1 font-mono text-[12px] text-muted-foreground')],
                  [`${o.label}.`],
                ),
                ...jp(c.h, o.ja),
              ],
            ),
            en(c.h, o.en, 'text-[12px]'),
          ],
        ),
      ),
  )

export const taskView = (c: Ctx, t: Task, key: string, depth = 0): Html => {
  const { h } = c
  const hasQuiz = t.quiz !== undefined
  const label = t.kind ? KIND[t.kind] : undefined
  const head =
    t.number === 0
      ? h.empty
      : h.div(
          [h.Class('flex flex-wrap items-center gap-x-2.5 gap-y-1.5')],
          [
            h.span([h.Class('font-mono text-[12px] text-muted-foreground')], [`(${t.number})`]),
            h.span([h.Class('text-[16px] leading-snug font-medium')], jp(h, t.instruction)),
            label ? badge({ variant: 'secondary' }, [label], h) : h.empty,
            hasQuiz ? h.empty : plays(c, t.audio),
          ],
        )
  return h.div(
    [
      h.Key(key),
      h.Class(
        cn(
          'flex flex-col py-3',
          depth > 0
            ? 'ml-4 border-l-2 border-border pl-4'
            : 'border-t border-border first:border-t-0',
        ),
      ),
    ],
    [
      head,
      t.number === 0 ? h.empty : en(h, t.instruction_en, 'mt-0.5'),
      hasQuiz && t.quiz?.type === 'fill' ? plays(c, t.audio) : h.empty,
      t.practice?.length ? bubbles(c, t) : h.empty,
      !hasQuiz && t.choices.length && t.kind === 'words' ? pictures(c, t, key) : h.empty,
      !hasQuiz && t.grid ? gridView(c, t, key) : h.empty,
      ...t.dialogues.map((d, i) => dialogueView(c, d, `${key}.d${i}`)),
      vocabView(c, t),
      ...(t.tables ?? []).map((tb) => tableView(c, tb)),
      t.quiz?.type === 'choose' ? chooseQuiz(c, t.quiz, key) : h.empty,
      t.quiz?.type === 'fill' ? fillQuiz(c, t.quiz, key) : h.empty,
      bodyView(c, t, key),
      ...(t.hints ?? []).map((b, i) =>
        h.div(
          [h.Key(`${key}.h${i}`), h.Class('mt-2 rounded-lg bg-muted px-3 py-2 text-[14px]')],
          [h.div([], jp(h, b.ja)), en(h, b.en)],
        ),
      ),
      ...(t.subtasks ?? []).map((s, i) => taskView(c, s, `${key}.${s.number}-${i}`, depth + 1)),
    ],
  )
}
