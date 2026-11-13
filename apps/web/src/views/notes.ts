import { Message } from '../app/state.ts'
import { badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { Note, Pair, RefSection } from '../data/types.ts'
import { type Child, type Ctx, en, has, jp, plain } from '../ui/common.ts'

const pill = (c: Ctx, p: Pair): Child =>
  c.h.span(
    [
      c.h.Class(
        'inline-flex items-baseline gap-1 rounded-md border border-border bg-card px-2 py-0.5 text-[15px]',
      ),
    ],
    [
      ...jp(c.h, p.from),
      c.h.span([c.h.Class('text-muted-foreground')], ['→']),
      ...jp(c.h, p.to),
      p.from_note
        ? c.h.span([c.h.Class('text-[11px] text-muted-foreground')], [`(${p.from_note})`])
        : c.h.empty,
      p.note ? c.h.span([c.h.Class('text-[11px] text-muted-foreground')], [p.note]) : c.h.empty,
    ],
  )

const th = (c: Ctx, children: ReadonlyArray<Child>): Child =>
  c.h.th(
    [c.h.Class('border border-border bg-muted px-3 py-1.5 text-left text-[13px] font-medium')],
    children,
  )
const td = (c: Ctx, children: ReadonlyArray<Child>): Child =>
  c.h.td([c.h.Class('border border-border px-3 py-1.5 align-top text-[15px]')], children)
const wrap = (c: Ctx, table: Child): Child =>
  c.h.div(
    [c.h.Class('my-2 overflow-x-auto')],
    [c.h.table([c.h.Class('w-full border-collapse')], [table])],
  )

const section = (c: Ctx, s: RefSection, key: string): Child => {
  const { h } = c
  return h.div(
    [h.Key(key), h.Class('mt-5 flex flex-col gap-2')],
    [
      s.title.text ? h.h4([h.Class('text-[15px] font-semibold')], jp(h, s.title)) : h.empty,
      s.intro
        ? h.div([], [h.p([h.Class('text-[15px]')], jp(h, s.intro.ja)), en(h, s.intro.en)])
        : h.empty,
      ...(s.groups ?? []).map((g) =>
        h.div(
          [h.Key(`g${g.group}`), h.Class('rounded-lg border border-border p-3')],
          [
            h.div(
              [h.Class('mb-1 flex flex-wrap items-baseline gap-2')],
              [
                badge({ variant: 'outline' }, [`Group ${g.group}`], h),
                en(h, [g.stem_en, g.rule_en].filter(Boolean).join(' · ')),
              ],
            ),
            h.p(
              [h.Class('text-[14px] text-muted-foreground')],
              [...jp(h, g.stem_ja), ' ', ...jp(h, g.rule_ja)],
            ),
            h.div(
              [h.Class('mt-2 flex flex-wrap gap-1.5')],
              g.examples.map((p) => pill(c, p)),
            ),
          ],
        ),
      ),
      s.rules?.length
        ? wrap(
            c,
            h.tbody(
              [],
              [
                h.tr(
                  [],
                  ['Group', 'Dictionary form', 'Forms', 'Examples'].map((x) => th(c, [x])),
                ),
                ...s.rules.map((r, i) =>
                  h.tr(
                    [h.Key(`r${i}`)],
                    [
                      td(c, [String(r.group)]),
                      td(c, [r.ending]),
                      td(c, [r.forms.join(' · ') || '—']),
                      td(c, [
                        h.div(
                          [h.Class('flex flex-wrap gap-1')],
                          r.examples.map((p) => pill(c, p)),
                        ),
                      ]),
                    ],
                  ),
                ),
              ],
            ),
          )
        : h.empty,
      s.patterns?.length
        ? wrap(
            c,
            h.tbody(
              [],
              s.patterns.map((r, i) =>
                h.tr(
                  [h.Key(`p${i}`)],
                  [
                    th(c, jp(h, r.pattern)),
                    td(
                      c,
                      r.examples.map((e) =>
                        h.div(
                          [],
                          [
                            ...jp(h, e.ja),
                            e.en
                              ? h.span([h.Class('ml-2 text-[12px] text-muted-foreground')], [e.en])
                              : h.empty,
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          )
        : h.empty,
      s.grid?.length
        ? wrap(
            c,
            h.tbody(
              [],
              s.grid.map((r, i) =>
                h.tr(
                  [h.Key(`gr${i}`)],
                  r.map((cell) =>
                    td(c, [
                      ...jp(h, cell.ja),
                      cell.en
                        ? h.span([h.Class('ml-2 text-[12px] text-muted-foreground')], [cell.en])
                        : h.empty,
                    ]),
                  ),
                ),
              ),
            ),
          )
        : h.empty,
      s.matrix?.length
        ? wrap(
            c,
            h.tbody(
              [],
              [
                h.tr(
                  [],
                  [th(c, []), th(c, []), ...(s.matrix_columns ?? []).map((x) => th(c, [x]))],
                ),
                ...s.matrix.map((r, i) =>
                  h.tr(
                    [h.Key(`m${i}`)],
                    [
                      th(c, [r.class]),
                      th(c, [r.polarity]),
                      ...r.cells.map((cell, k) =>
                        td(c, [
                          h.div([h.Key(`mc${k}`), h.Class('font-medium')], jp(h, cell.pattern)),
                          cell.example ? h.div([], jp(h, cell.example.ja)) : h.empty,
                          en(h, cell.example?.en),
                        ]),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          )
        : h.empty,
      ...(s.sentences ?? []).map((x, i) =>
        h.div(
          [h.Key(`s${i}`), h.Class('text-[15px]')],
          [
            badge({ variant: 'secondary' }, [x.group], h),
            ' ',
            x.label,
            ' ',
            ...jp(h, x.ja),
            en(h, x.en),
          ],
        ),
      ),
      s.footnote
        ? h.div(
            [h.Class('text-[13px] text-muted-foreground')],
            [...jp(h, s.footnote.ja), ' ', s.footnote.en ?? ''],
          )
        : h.empty,
    ],
  )
}

export const noteCard = (c: Ctx, n: Note, i: number): Child => {
  const { h } = c
  const key = `note${i}`
  return h.section(
    [h.Key(key), h.Id(key), h.Class('rounded-xl border border-border bg-card p-4 sm:p-5')],
    [
      h.div(
        [h.Class('mb-2 flex flex-wrap items-center gap-2')],
        [
          badge(
            { variant: 'secondary' },
            [
              n.kind === 'grammar'
                ? `Grammar ${i + 1}`
                : n.kind === 'column'
                  ? 'Culture'
                  : 'Reference',
            ],
            h,
          ),
          h.h3([h.Class('text-[17px] leading-snug font-semibold')], jp(h, n.title)),
        ],
      ),
      n.pattern?.length && plain(n.title) !== n.pattern.map(plain).join(' ')
        ? h.div(
            [
              h.Class(
                'mb-2 inline-block rounded-md border-2 border-primary px-3 py-1.5 font-semibold',
              ),
            ],
            n.pattern.map((p) => h.div([], jp(h, p))),
          )
        : h.empty,
      ...n.blocks.map((b, k) =>
        h.div(
          [h.Key(`b${k}`), h.Class('mb-2')],
          [h.p([h.Class('text-[16px] leading-relaxed')], jp(h, b.ja)), en(h, b.en)],
        ),
      ),
      n.points.length
        ? h.ul(
            [h.Class('mt-3 flex flex-col gap-2')],
            n.points.map((p, k) =>
              h.li(
                [
                  h.Key(`p${k}`),
                  h.Class('border-l-2 border-border pl-3 text-[14px] leading-relaxed'),
                ],
                [
                  h.div([], [p.en]),
                  p.ja ? h.div([h.Class('text-muted-foreground')], jp(h, p.ja)) : h.empty,
                ],
              ),
            ),
          )
        : h.empty,
      ...n.examples.map((e, k) =>
        h.div(
          [h.Key(`e${k}`), h.Class('mt-3 rounded-lg bg-muted/50 px-3 py-2')],
          e.turns.map((t, j) =>
            h.div(
              [h.Key(`t${j}`), h.Class('py-0.5')],
              [
                h.div(
                  [h.Class('text-[15px]')],
                  [t.speaker ? `${t.speaker}： ` : '▸ ', ...jp(h, t.ja)],
                ),
                en(h, t.en, 'pl-5'),
              ],
            ),
          ),
        ),
      ),
      ...(n.sections ?? []).map((s, k) => section(c, s, `${key}.s${k}`)),
    ],
  )
}

export const kanjiView = (c: Ctx): Child => {
  const { h, lesson, model } = c
  return h.div(
    [h.Class('flex flex-col gap-6')],
    [
      h.div(
        [h.Class('grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4')],
        lesson.kanji.words.map((w, i) => {
          const key = `kanji.${i}`
          const flipped = has(model.revealed, key)
          return h.button(
            [
              h.Key(key),
              h.Type('button'),
              h.AriaPressed(flipped ? 'true' : 'false'),
              h.AriaLabel(`${plain(w)}: show reading`),
              h.OnClick(Message.ToggledReveal({ key })),
              h.Class(
                cn(
                  'flex min-h-24 items-center justify-center rounded-xl border p-3 text-center text-3xl transition-colors',
                  flipped ? 'border-primary bg-primary/5' : 'border-border bg-card hover:bg-muted',
                ),
              ),
            ],
            flipped ? jp(h, w) : [plain(w)],
          )
        }),
      ),
      h.p(
        [h.Class('-mt-3 text-[12px] text-muted-foreground')],
        ['Tap a card to show its reading.'],
      ),
      h.div(
        [h.Class('flex flex-col gap-2')],
        [
          h.h3([h.Class('text-[15px] font-semibold')], ['Read these']),
          ...lesson.kanji.sentences.map((s, i) =>
            h.div(
              [
                h.Key(`s${i}`),
                h.Class(
                  'rounded-lg border border-border bg-card px-3 py-2 text-[16px] leading-loose',
                ),
              ],
              plain(s)
                .split('\n')
                .flatMap((line, k) => (k ? [h.br([]), line] : [line])),
            ),
          ),
        ],
      ),
    ],
  )
}
