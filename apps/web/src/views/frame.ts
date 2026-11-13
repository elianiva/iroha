import { AsyncData } from 'foldkit'
import type { Document, HtmlBuilder } from 'foldkit/html'
import { cn } from '@/lib/utils'
import { skeleton } from '@/components/ui/skeleton'
import { Alert } from '@/components/ui/alert'
import { indexQuery } from '../data/queries.ts'
import { AppRoute } from '../app/route.ts'
import { Message, type Model } from '../app/state.ts'
import type { Child } from '../ui/common.ts'
import { homePage } from './home.ts'
import { lessonPage } from './lesson.ts'
import { findLesson } from './lessonlinks.ts'
import { liveStreak } from '../app/progress-schema.ts'

type H = HtmlBuilder<Message>

const header = (model: Model, h: H): Child =>
  h.header(
    [
      h.Class(
        'sticky top-0 z-30 border-b-2 border-[var(--line)] bg-[var(--paper)]/95 backdrop-blur',
      ),
    ],
    [
      h.div(
        [h.Class('mx-auto flex h-16 max-w-5xl items-center gap-3 px-4')],
        [
          h.a(
            [h.Href('/'), h.Class('flex items-center gap-2')],
            [
              h.span(
                [
                  h.Class(
                    'display grid size-9 place-items-center rounded-xl bg-[#ff5a4e] text-[18px] text-white shadow-[0_3px_0_#c93b31]',
                  ),
                ],
                ['彩'],
              ),
              h.span([h.Class('display text-[22px]')], ['Irodori']),
            ],
          ),
          h.div(
            [h.Class('ml-auto flex items-center gap-2 text-[15px] font-black')],
            [
              h.span([h.Class('chip')], [`🔥 ${liveStreak(model.progress, model.today)}`]),
              h.span([h.Class('chip')], [`⚡ ${model.progress.xp} XP`]),
              h.button(
                [
                  h.Type('button'),
                  h.OnClick(Message.ToggledFurigana()),
                  h.AriaPressed(model.furigana ? 'true' : 'false'),
                  h.Class('btn3d ghost sm'),
                ],
                [model.furigana ? 'ふ On' : 'ふ Off'],
              ),
            ],
          ),
        ],
      ),
    ],
  )

export const view = (model: Model, h: H): Document => {
  const index = AsyncData.getData(indexQuery.read(model.index))
  const data = index._tag === 'Some' ? index.value : undefined
  const lesson = AppRoute.match(model.route, {
    Home: () => undefined,
    Lesson: ({ number }) => (data ? findLesson(data, number)?.lesson : undefined),
    Section: ({ number }) => (data ? findLesson(data, number)?.lesson : undefined),
    NotFound: () => undefined,
  })
  const content: Child = AppRoute.match(model.route, {
    Home: () =>
      data
        ? homePage(model, h, data)
        : AsyncData.matchData(indexQuery.read(model.index), {
            onEmpty: () =>
              h.div(
                [h.Class('flex flex-col gap-3')],
                [
                  skeleton({ className: 'h-10 w-1/2' }, [], h),
                  skeleton({ className: 'h-32 w-full' }, [], h),
                ],
              ),
            onFailure: (error) =>
              Alert(
                { variant: 'destructive' },
                [
                  Alert.title({}, ['The lessons did not load'], h),
                  Alert.description({}, [error], h),
                ],
                h,
              ),
            onData: () => h.empty,
          }),
    Lesson: ({ number }) => lessonPage(model, h, data, number, ''),
    Section: ({ number, section }) => lessonPage(model, h, data, number, section),
    NotFound: ({ path }) =>
      h.div(
        [h.Class('flex flex-col items-start gap-3')],
        [
          h.h1([h.Class('text-2xl font-semibold')], ['Page not found']),
          h.p([h.Class('text-muted-foreground')], [path]),
          h.a([h.Href('/'), h.Class('underline underline-offset-4')], ['Back to the lessons']),
        ],
      ),
  })
  const playing = AppRoute.match(model.route, {
    Home: () => false,
    Lesson: () => false,
    Section: ({ section }) => section.startsWith('activity-'),
    NotFound: () => false,
  })
  return {
    title: lesson ? `Lesson ${lesson.number} · ${lesson.title.en} · Irodori` : 'Irodori',
    lang: 'ja',
    body: h.div(
      [
        h.Class(
          cn('min-h-dvh bg-[var(--paper)] text-[var(--ink)]', model.furigana ? '' : 'furigana-off'),
        ),
      ],
      [playing ? h.empty : header(model, h), h.main([], [content])],
    ),
  }
}
