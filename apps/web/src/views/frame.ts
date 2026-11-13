import { AsyncData } from 'foldkit'
import type { Document, HtmlBuilder } from 'foldkit/html'
import { Languages, Menu, X } from 'lucide'
import { icon } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { button } from '@/components/ui/button'
import { skeleton } from '@/components/ui/skeleton'
import { Alert } from '@/components/ui/alert'
import { indexQuery } from '../data/queries.ts'
import type { BookIndex } from '../data/types.ts'
import { AppRoute } from '../app/route.ts'
import { Message, type Model } from '../app/state.ts'
import type { Child } from '../ui/common.ts'
import { homePage } from './home.ts'
import { findLesson, lessonHref, lessonPage } from './lesson.ts'

type H = HtmlBuilder<Message>

const currentLesson = (model: Model): number | undefined =>
  AppRoute.match(model.route, {
    Home: () => undefined,
    Lesson: ({ number }) => number,
    Section: ({ number }) => number,
    NotFound: () => undefined,
  })

/** Chapters and lessons, always in reach on a wide screen and in a drawer on a phone. */
const nav = (model: Model, h: H, index: BookIndex | undefined): Child => {
  const current = currentLesson(model)
  return h.nav(
    [h.AriaLabel('Lessons'), h.Class('flex flex-col gap-5 p-4')],
    index
      ? index.chapters.map((chapter) =>
          h.div(
            [h.Key(`ch${chapter.number}`), h.Class('flex flex-col gap-0.5')],
            [
              h.div(
                [
                  h.Class(
                    'px-2 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase',
                  ),
                ],
                [`${chapter.number}. ${chapter.topic.en}`],
              ),
              ...chapter.lessons.map((l) =>
                h.a(
                  [
                    h.Key(`l${l.number}`),
                    h.Href(lessonHref(l.number)),
                    ...(current === l.number ? [h.AriaCurrent('page')] : []),
                    h.Class(
                      cn(
                        'flex items-baseline gap-2 rounded-md px-2 py-1.5 text-[13px] leading-snug transition-colors',
                        current === l.number
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-muted',
                      ),
                    ),
                  ],
                  [
                    h.span(
                      [h.Class('w-5 shrink-0 font-mono text-[11px] opacity-70')],
                      [String(l.number)],
                    ),
                    h.span([], [l.title.ja]),
                  ],
                ),
              ),
            ],
          ),
        )
      : [
          skeleton({ className: 'h-6 w-3/4' }, [], h),
          skeleton({ className: 'h-6 w-2/3' }, [], h),
          skeleton({ className: 'h-6 w-3/4' }, [], h),
        ],
  )
}

const header = (model: Model, h: H): Child =>
  h.header(
    [
      h.Class(
        'sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur',
      ),
    ],
    [
      button(
        {
          variant: 'ghost',
          size: 'icon',
          onClick: Message.ToggledMenu(),
          className: 'lg:hidden',
          attributes: [
            h.AriaLabel(model.menu ? 'Close menu' : 'Open menu'),
            h.AriaExpanded(model.menu),
          ],
        },
        icon(h, model.menu ? X : Menu),
        h,
      ),
      h.a(
        [h.Href('/'), h.Class('flex items-baseline gap-2')],
        [
          h.span([h.Class('text-[17px] font-semibold tracking-tight')], ['いろどり']),
          h.span(
            [h.Class('hidden text-[13px] text-muted-foreground sm:inline')],
            ['Irodori · Elementary 1'],
          ),
        ],
      ),
      h.div(
        [h.Class('ml-auto flex items-center gap-2')],
        [
          button(
            {
              variant: model.furigana ? 'secondary' : 'outline',
              size: 'sm',
              onClick: Message.ToggledFurigana(),
              attributes: [h.AriaPressed(model.furigana ? 'true' : 'false')],
            },
            [icon(h, Languages, 'size-4'), model.furigana ? 'Furigana on' : 'Furigana off'],
            h,
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
        ? homePage(h, data)
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
  return {
    title: lesson ? `Lesson ${lesson.number} · ${lesson.title.en} · Irodori` : 'Irodori',
    lang: 'ja',
    body: h.div(
      [h.Class(cn('min-h-dvh', model.furigana ? '' : 'furigana-off'))],
      [
        header(model, h),
        h.div(
          [h.Class('mx-auto grid max-w-7xl lg:grid-cols-[17rem_minmax(0,1fr)]')],
          [
            h.aside(
              [
                h.Class(
                  cn(
                    'border-r border-border bg-background lg:sticky lg:top-14 lg:block lg:h-[calc(100dvh-3.5rem)] lg:overflow-y-auto',
                    model.menu ? 'block' : 'hidden',
                  ),
                ),
              ],
              [nav(model, h, data)],
            ),
            h.main(
              [h.Class(cn('min-w-0 px-4 py-8 sm:px-6', model.menu && 'hidden lg:block'))],
              [h.div([h.Class('mx-auto max-w-3xl')], [content])],
            ),
          ],
        ),
      ],
    ),
  }
}
