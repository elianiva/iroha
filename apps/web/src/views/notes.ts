import { Message } from '../app/state.ts'
import { cn } from '@/lib/utils'
import type { Note, Pair, RefSection } from '../data/types.ts'
import { type Child, type Ctx, en, has, jp, plain } from '../ui/common.ts'

const badge = (label: string, h: Ctx['h']): Child => h.span([h.Class('note-label')], [label])

const pill = (c: Ctx, p: Pair): Child =>
  c.h.span(
    [c.h.Class('pill')],
    [
      ...jp(c.h, p.from),
      c.h.span([c.h.Class('arrow')], ['→']),
      ...jp(c.h, p.to),
      p.from_note ? c.h.span([c.h.Class('pill-note')], [`(${p.from_note})`]) : c.h.empty,
      p.note ? c.h.span([c.h.Class('pill-note')], [p.note]) : c.h.empty,
    ],
  )

const table = (c: Ctx, head: ReadonlyArray<Child>, rows: ReadonlyArray<Child>): Child =>
  c.h.div(
    [c.h.Class('table-wrap')],
    [
      c.h.table(
        [c.h.Class('data-table')],
        [
          head.length
            ? c.h.thead(
                [],
                [
                  c.h.tr(
                    [],
                    head.map((x) => c.h.th([], [x])),
                  ),
                ],
              )
            : c.h.empty,
          c.h.tbody([], rows),
        ],
      ),
    ],
  )

const section = (c: Ctx, s: RefSection, key: string): Child => {
  const { h } = c
  return h.div(
    [h.Key(key), h.Class('note-section')],
    [
      s.title.text ? h.h4([], jp(h, s.title)) : h.empty,
      s.intro
        ? h.div(
            [h.Class('note-block')],
            [h.div([h.Class('note-ja')], jp(h, s.intro.ja)), en(h, s.intro.en)],
          )
        : h.empty,
      ...(s.groups ?? []).map((g) =>
        h.div(
          [h.Key(`g${g.group}`), h.Class('note-group')],
          [
            h.div(
              [h.Class('note-group-head')],
              [
                badge(`Group ${g.group}`, h),
                en(h, [g.stem_en, g.rule_en].filter(Boolean).join(' · ')),
              ],
            ),
            h.p([h.Class('note-ja')], [...jp(h, g.stem_ja), ' ', ...jp(h, g.rule_ja)]),
            h.div(
              [h.Class('flex flex-wrap gap-1.5')],
              g.examples.map((p) => pill(c, p)),
            ),
          ],
        ),
      ),
      s.rules?.length
        ? table(
            c,
            ['Group', 'Dictionary form', 'Forms', 'Examples'],
            s.rules.map((r, i) =>
              h.tr(
                [h.Key(`r${i}`)],
                [
                  h.td([], [String(r.group)]),
                  h.td([], [r.ending]),
                  h.td([], [r.forms.join(' · ') || '—']),
                  h.td(
                    [],
                    [
                      h.div(
                        [h.Class('flex flex-wrap gap-1')],
                        r.examples.map((p) => pill(c, p)),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          )
        : h.empty,
      s.patterns?.length
        ? table(
            c,
            [],
            s.patterns.map((r, i) =>
              h.tr(
                [h.Key(`p${i}`)],
                [
                  h.th([], jp(h, r.pattern)),
                  h.td(
                    [],
                    r.examples.map((e) =>
                      h.div(
                        [],
                        [...jp(h, e.ja), e.en ? h.span([h.Class('en')], [` — ${e.en}`]) : h.empty],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          )
        : h.empty,
      s.grid?.length
        ? table(
            c,
            [],
            s.grid.map((r, i) =>
              h.tr(
                [h.Key(`gr${i}`)],
                r.map((cell) =>
                  h.td(
                    [],
                    [
                      ...jp(h, cell.ja),
                      cell.en ? h.span([h.Class('en')], [` — ${cell.en}`]) : h.empty,
                    ],
                  ),
                ),
              ),
            ),
          )
        : h.empty,
      s.matrix?.length
        ? table(
            c,
            ['', '', ...(s.matrix_columns ?? []).map((x) => h.span([], [x]))],
            s.matrix.map((r, i) =>
              h.tr(
                [h.Key(`m${i}`)],
                [
                  h.th([], [r.class]),
                  h.th([], [r.polarity]),
                  ...r.cells.map((cell, k) =>
                    h.td(
                      [],
                      [
                        h.div([h.Key(`mc${k}`), h.Class('font-bold')], jp(h, cell.pattern)),
                        cell.example ? h.div([], jp(h, cell.example.ja)) : h.empty,
                        en(h, cell.example?.en, 'text-[0.72rem]'),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          )
        : h.empty,
      ...(s.sentences ?? []).map((x, i) =>
        h.div(
          [h.Key(`s${i}`), h.Class('note-block')],
          [
            h.div(
              [h.Class('flex flex-wrap items-baseline gap-2')],
              [badge(x.group, h), h.span([h.Class('font-bold')], [x.label])],
            ),
            h.div([h.Class('note-ja')], jp(h, x.ja)),
            en(h, x.en),
          ],
        ),
      ),
      s.footnote
        ? h.div([h.Class('note-footnote')], [...jp(h, s.footnote.ja), ' ', s.footnote.en ?? ''])
        : h.empty,
    ],
  )
}

export const noteCard = (c: Ctx, n: Note, i: number): Child => {
  const { h } = c
  const key = `note${i}`
  const label =
    n.kind === 'grammar' ? `Grammar ${i + 1}` : n.kind === 'column' ? 'Culture' : 'Reference'
  return h.section(
    [h.Key(key), h.Id(key), h.Class('note')],
    [
      h.div(
        [h.Class('note-head')],
        [badge(label, h), h.h3([h.Class('note-title')], jp(h, n.title))],
      ),
      n.pattern?.length && plain(n.title) !== n.pattern.map(plain).join(' ')
        ? h.div(
            [h.Class('note-pattern')],
            n.pattern.map((p) => h.div([], jp(h, p))),
          )
        : h.empty,
      ...n.blocks.map((b, k) =>
        h.div(
          [h.Key(`b${k}`), h.Class('note-block')],
          [h.div([h.Class('note-ja')], jp(h, b.ja)), en(h, b.en, 'note-en')],
        ),
      ),
      n.points.length
        ? h.ul(
            [h.Class('note-points')],
            n.points.map((p, k) =>
              h.li(
                [h.Key(`p${k}`)],
                [h.div([], [p.en]), p.ja ? h.div([h.Class('ja')], jp(h, p.ja)) : h.empty],
              ),
            ),
          )
        : h.empty,
      ...n.examples.map((e, k) =>
        h.div(
          [h.Key(`e${k}`), h.Class('note-example')],
          e.turns.map((t, j) =>
            h.div(
              [h.Key(`t${j}`)],
              [
                h.p(
                  [],
                  [
                    t.speaker ? h.span([h.Class('speaker')], [`${t.speaker}： `]) : h.empty,
                    ...jp(h, t.ja),
                  ],
                ),
                en(h, t.en, 'pl-4'),
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
    [h.Class('study-body')],
    [
      h.div(
        [h.Class('kanji-grid sm:grid-cols-3 lg:grid-cols-4')],
        lesson.kanji.words.map((w, i) => {
          const key = `kanji.${i}`
          const open = has(model.revealed, key)
          return h.button(
            [
              h.Key(key),
              h.Type('button'),
              h.AriaPressed(open ? 'true' : 'false'),
              h.AriaLabel(`${plain(w)}: ${open ? 'hide' : 'show'} the reading`),
              h.OnClick(Message.ToggledReveal({ key })),
              h.Class(cn('kanji-card', open && 'is-open')),
            ],
            [
              h.span([h.Class('kanji-furi'), h.AriaHidden(true)], ['ふ']),
              h.span(
                [h.Class('kanji-word')],
                open ? jp(h, w) : [h.span([h.Lang('ja')], [plain(w)])],
              ),
            ],
          )
        }),
      ),
      h.div(
        [h.Class('reading-list')],
        [
          h.h3([], ['Read these']),
          ...lesson.kanji.sentences.map((s, i) =>
            h.div([h.Key(`s${i}`), h.Class('reading-item')], jp(h, s)),
          ),
        ],
      ),
    ],
  )
}
