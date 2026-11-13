import { AsyncData } from 'foldkit'
import type { Html, HtmlBuilder } from 'foldkit/html'
import { ArrowLeft, ArrowRight } from 'lucide'
import { icon } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { badge } from '@/components/ui/badge'
import { button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { skeleton } from '@/components/ui/skeleton'
import { lessonQuery } from '../data/queries.ts'
import type {
  Activity,
  BookIndex,
  Chapter,
  Lesson,
  LessonSummary,
  SectionInfo,
} from '../data/types.ts'
import { Message, type Model } from '../app/state.ts'
import { type Child, type Ctx, en, jp } from '../ui/common.ts'
import { kanjiView, noteCard } from './notes.ts'
import { dialogueView, taskView } from './task.ts'

type H = HtmlBuilder<Message>

export const lessonHref = (n: number, section?: string): string =>
  section ? `/lesson/${n}/${section}` : `/lesson/${n}`

/** The pages of a lesson, from the lesson itself so a page never lists what it cannot show. */
export const sectionsOf = (lesson: Lesson): ReadonlyArray<SectionInfo> => [
  ...lesson.activities.map((a): SectionInfo => ({
    id: `activity-${a.number}`,
    kind: 'activity',
    title: a.title,
    can_do: a.can_do,
    can_do_en: a.can_do_en,
  })),
  ...(lesson.kanji.words.length ? [{ id: 'kanji', kind: 'kanji' } as const] : []),
  ...(lesson.notes.length ? [{ id: 'grammar', kind: 'grammar' } as const] : []),
  ...(lesson.scripts.length ? [{ id: 'scripts', kind: 'scripts' } as const] : []),
]

export const sectionLabel = (s: SectionInfo): string =>
  s.kind === 'activity'
    ? `Activity ${s.id.replace('activity-', '')}`
    : s.kind === 'kanji'
      ? '漢字'
      : s.kind === 'grammar'
        ? 'Grammar'
        : 'Scripts'

export const findLesson = (
  index: BookIndex,
  n: number,
): { chapter: Chapter; lesson: LessonSummary } | undefined => {
  for (const chapter of index.chapters) {
    const lesson = chapter.lessons.find((l) => l.number === n)
    if (lesson) return { chapter, lesson }
  }
  return undefined
}

const tabClass = (on: boolean): string =>
  cn(
    'inline-flex h-8 shrink-0 items-center rounded-lg px-3 text-[13px] font-medium whitespace-nowrap transition-colors',
    on
      ? 'bg-primary text-primary-foreground'
      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
  )

const tabs = (h: H, n: number, sections: ReadonlyArray<SectionInfo>, current: string): Child =>
  h.nav(
    [
      h.AriaLabel('Lesson pages'),
      h.Class(
        'sticky top-14 z-10 -mx-4 mb-6 flex gap-1 overflow-x-auto border-b border-border bg-background/90 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6',
      ),
    ],
    [
      h.a(
        [
          h.Key('overview'),
          h.Href(lessonHref(n)),
          h.Class(tabClass(current === '')),
          ...(current === '' ? [h.AriaCurrent('page')] : []),
        ],
        ['Overview'],
      ),
      ...sections.map((s) =>
        h.a(
          [
            h.Key(s.id),
            h.Href(lessonHref(n, s.id)),
            h.Class(tabClass(current === s.id)),
            ...(current === s.id ? [h.AriaCurrent('page')] : []),
          ],
          [sectionLabel(s)],
        ),
      ),
    ],
  )

const activityBody = (c: Ctx, a: Activity): Child => {
  const { h } = c
  return h.div(
    [h.Class('flex flex-col gap-6')],
    [
      h.div(
        [h.Class('rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3')],
        [
          h.div(
            [h.Class('mb-1 font-mono text-[11px] tracking-wide text-amber-800 uppercase')],
            [`Can-do ${a.can_do_id}`],
          ),
          h.p([h.Class('text-[16px] leading-relaxed')], jp(h, a.can_do)),
          en(h, a.can_do_en),
        ],
      ),
      ...a.steps.map((s, si) =>
        h.section(
          [
            h.Key(`step${si}`),
            h.Class('rounded-xl border border-border bg-card px-4 py-3 sm:px-5'),
          ],
          [
            h.div(
              [h.Class('flex items-baseline gap-3 pb-1')],
              [
                h.span(
                  [
                    h.Class(
                      'grid size-6 shrink-0 place-items-center rounded-md bg-primary font-mono text-[12px] text-primary-foreground',
                    ),
                  ],
                  [String(s.number || si + 1)],
                ),
                h.div(
                  [],
                  [
                    h.h3([h.Class('text-[17px] leading-snug font-semibold')], jp(h, s.title)),
                    en(h, s.title_en),
                  ],
                ),
              ],
            ),
            ...s.tasks.map((t, ti) => taskView(c, t, `a${a.number}.s${si}.t${ti}`)),
          ],
        ),
      ),
    ],
  )
}

const scriptsBody = (c: Ctx): Child => {
  const { h, lesson, model } = c
  return h.div(
    [h.Class('flex flex-col gap-3')],
    [
      h.div(
        [h.Class('flex flex-wrap items-center justify-between gap-2')],
        [
          en(h, 'Listening scripts. Hide them to listen first, then tap one to read it.'),
          button(
            { size: 'sm', variant: 'outline', onClick: Message.ToggledScripts() },
            model.hideScripts ? 'Show all scripts' : 'Hide scripts',
            h,
          ),
        ],
      ),
      ...lesson.scripts.map((d, i) => dialogueView(c, d, `script${i}`, true)),
    ],
  )
}

const overview = (c: Ctx, sections: ReadonlyArray<SectionInfo>): Child => {
  const { h, lesson } = c
  const card = (s: SectionInfo, i: number): Child =>
    h.a(
      [
        h.Key(s.id),
        h.Href(lessonHref(lesson.number, s.id)),
        h.Class(
          'group flex flex-col gap-1 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/60',
        ),
      ],
      [
        h.div(
          [h.Class('flex items-center gap-2')],
          [
            badge(
              { variant: s.kind === 'activity' ? 'default' : 'secondary' },
              [sectionLabel(s)],
              h,
            ),
            s.kind === 'activity'
              ? h.span(
                  [h.Class('text-[12px] text-muted-foreground')],
                  [`${i + 1} of ${sections.filter((x) => x.kind === 'activity').length}`],
                )
              : h.empty,
          ],
        ),
        s.title
          ? h.span([h.Class('mt-1 text-[16px] leading-snug font-medium')], jp(h, s.title))
          : h.empty,
        s.can_do
          ? h.span([h.Class('text-[13px] leading-snug text-muted-foreground')], [s.can_do_en ?? ''])
          : h.empty,
        s.kind === 'kanji'
          ? en(h, 'Kanji words and reading practice')
          : s.kind === 'grammar'
            ? en(h, `${lesson.notes.length} grammar and culture notes`)
            : s.kind === 'scripts'
              ? en(h, `${lesson.scripts.length} listening scripts`)
              : h.empty,
      ],
    )
  return h.div([h.Class('grid grid-cols-1 gap-3 sm:grid-cols-2')], sections.map(card))
}

const sibling = (
  h: H,
  label: string,
  n: number,
  title: string,
  section: string | undefined,
  dir: 'prev' | 'next',
): Child =>
  h.a(
    [
      h.Href(lessonHref(n, section)),
      h.Class(
        cn(
          'flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:bg-muted/60',
          dir === 'next' && 'justify-end text-right',
        ),
      ),
    ],
    [
      dir === 'prev' ? icon(h, ArrowLeft, 'size-4 shrink-0') : h.empty,
      h.div(
        [h.Class('min-w-0')],
        [
          h.div([h.Class('text-[11px] text-muted-foreground')], [label]),
          h.div([h.Class('truncate text-[14px] font-medium')], [title]),
        ],
      ),
      dir === 'next' ? icon(h, ArrowRight, 'size-4 shrink-0') : h.empty,
    ],
  )

export const lessonPage = (
  model: Model,
  h: H,
  index: BookIndex | undefined,
  n: number,
  current: string,
): Child => {
  const found = index ? findLesson(index, n) : undefined
  const data = lessonQuery.read(model.lessons, { number: n })
  const retry = Message.ClickedRetry()
  return AsyncData.matchData(data, {
    onEmpty: () =>
      h.div(
        [h.Class('flex flex-col gap-4')],
        [
          skeleton({ className: 'h-24 w-full' }, [], h),
          skeleton({ className: 'h-8 w-2/3' }, [], h),
          skeleton({ className: 'h-64 w-full' }, [], h),
        ],
      ),
    onFailure: (error) =>
      h.div(
        [h.Class('flex flex-col items-start gap-3')],
        [
          Alert(
            { variant: 'destructive' },
            [Alert.title({}, ['This lesson did not load'], h), Alert.description({}, [error], h)],
            h,
          ),
          button({ variant: 'outline', onClick: retry }, 'Try again', h),
        ],
      ),
    onData: (lesson: Lesson): Html => {
      const c: Ctx = { h, model, lesson }
      const sections = sectionsOf(lesson)
      const at = sections.findIndex((s) => s.id === current)
      const known = current === '' || at >= 0
      const section = at >= 0 ? sections[at] : undefined
      const order: ReadonlyArray<string> = ['', ...sections.map((s) => s.id)]
      const pos = order.indexOf(known ? current : '')
      const nextId = order[pos + 1]
      const prevId = pos > 0 ? order[pos - 1] : undefined
      const label = (id: string | undefined): string =>
        id === undefined
          ? ''
          : id === ''
            ? 'Overview'
            : sectionLabel(sections.find((s) => s.id === id)!)
      const body: Child = !known
        ? h.p([h.Class('text-muted-foreground')], ['This lesson has no such page.'])
        : section === undefined
          ? overview(c, sections)
          : section.kind === 'activity'
            ? activityBody(c, lesson.activities[at]!)
            : section.kind === 'kanji'
              ? kanjiView(c)
              : section.kind === 'grammar'
                ? h.div(
                    [h.Class('flex flex-col gap-4')],
                    lesson.notes.map((nt, i) => noteCard(c, nt, i)),
                  )
                : scriptsBody(c)
      return h.div(
        [h.Class('flex flex-col')],
        [
          h.div(
            [h.Class('mb-5 flex flex-col gap-1')],
            [
              h.p(
                [h.Class('text-[13px] text-muted-foreground')],
                [
                  found ? `Chapter ${found.chapter.number} · ` : '',
                  ...jp(h, { text: lesson.topic.ja }),
                  ` · ${lesson.topic.en}`,
                ],
              ),
              h.h1(
                [h.Class('text-[28px] leading-tight font-semibold tracking-tight sm:text-[32px]')],
                [`第${lesson.number}課　`, ...jp(h, { text: lesson.title.ja })],
              ),
              en(h, lesson.title.en, 'text-[15px]'),
            ],
          ),
          lesson.question.ja && current === ''
            ? h.div(
                [h.Class('mb-6 rounded-xl border border-border bg-muted/50 px-4 py-3')],
                [
                  h.p([h.Class('text-[17px]')], jp(h, lesson.question.ja)),
                  en(h, lesson.question.en),
                ],
              )
            : h.empty,
          tabs(h, lesson.number, sections, known ? current : ''),
          body,
          h.div(
            [h.Class('mt-8 flex gap-3')],
            [
              prevId !== undefined
                ? sibling(h, 'Previous', n, label(prevId), prevId || undefined, 'prev')
                : found && found.lesson.number > 1
                  ? sibling(h, 'Previous lesson', n - 1, `Lesson ${n - 1}`, undefined, 'prev')
                  : h.div([h.Class('flex-1')], []),
              nextId !== undefined
                ? sibling(h, 'Next', n, label(nextId), nextId, 'next')
                : index && findLesson(index, n + 1)
                  ? sibling(h, 'Next lesson', n + 1, `Lesson ${n + 1}`, undefined, 'next')
                  : h.div([h.Class('flex-1')], []),
            ],
          ),
        ],
      )
    },
  })
}
