import { AsyncData } from 'foldkit'
import type { Document, HtmlBuilder } from 'foldkit/html'
import { TriangleAlert } from 'lucide'
import { icon } from '@/lib/icons'
import { indexQuery } from '../data/queries.ts'
import { AppRoute } from '../app/route.ts'
import { Message, type Model } from '../app/state.ts'
import { liveStreak } from '../app/progress-schema.ts'
import { type Child, furiganaToggle } from '../ui/common.ts'
import { homePage } from './home.ts'
import { lessonPage } from './lesson.ts'
import { findLesson } from './lessonlinks.ts'

type H = HtmlBuilder<Message>

const header = (model: Model, h: H): Child =>
  h.header(
    [h.Class('site-header')],
    [
      h.div(
        [h.Class('shell site-header-inner')],
        [
          h.a(
            [h.Href('/'), h.Class('brand'), h.AriaLabel('Irodori Elementary 1')],
            [
              h.span([h.Class('brand-mark'), h.AriaHidden(true)], ['彩']),
              h.span(
                [h.Class('brand-text')],
                [
                  h.span([h.Class('brand-name')], [h.span([h.Lang('ja')], ['いろどり'])]),
                  h.span([h.Class('brand-sub')], ['Irodori Elementary 1']),
                ],
              ),
            ],
          ),
          model.route._tag !== 'Home'
            ? h.nav(
                [h.Class('header-nav'), h.AriaLabel('Main')],
                [h.a([h.Href('/'), h.Class('header-link')], ['Map'])],
              )
            : h.empty,
          h.div(
            [h.Class('hud')],
            [
              h.span(
                [
                  h.Class('hud-item'),
                  h.AriaLabel(`${liveStreak(model.progress, model.today)} day streak`),
                ],
                [
                  h.b([h.Class('num')], [String(liveStreak(model.progress, model.today))]),
                  h.span([], ['day']),
                ],
              ),
              h.span([h.Class('hud-sep'), h.AriaHidden(true)], []),
              h.span(
                [h.Class('hud-item'), h.AriaLabel(`${model.progress.xp} XP`)],
                [h.b([h.Class('num')], [String(model.progress.xp)]), h.span([], ['XP'])],
              ),
              h.span([h.Class('hud-sep'), h.AriaHidden(true)], []),
              furiganaToggle(h, model),
            ],
          ),
        ],
      ),
    ],
  )

const loading = (h: H): Child =>
  h.div(
    [h.Class('page')],
    [
      h.div(
        [h.Class('loading'), h.AriaBusy(true)],
        [h.span([h.Class('loading-mark')], []), h.span([], ['Loading lessons…'])],
      ),
    ],
  )

const failure = (h: H, error: string): Child =>
  h.div(
    [h.Class('page')],
    [
      h.div(
        [h.Class('notice')],
        [
          h.span([h.Class('notice-icon')], [icon(h, TriangleAlert, 'size-5')]),
          h.div([], [h.h2([], ['Lessons did not load']), h.p([], [error])]),
          h.button(
            [h.Type('button'), h.OnClick(Message.ClickedRetry()), h.Class('btn')],
            ['Try again'],
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
            onEmpty: () => loading(h),
            onFailure: (error) => failure(h, error),
            onData: () => h.empty,
          }),
    Lesson: ({ number }) => lessonPage(model, h, data, number, ''),
    Section: ({ number, section }) => lessonPage(model, h, data, number, section),
    NotFound: ({ path }) =>
      h.div(
        [h.Class('page narrow')],
        [
          h.div(
            [h.Class('notice')],
            [
              h.span([h.Class('notice-icon')], [icon(h, TriangleAlert, 'size-5')]),
              h.div(
                [],
                [
                  h.h1([h.Class('text-[1.6rem] font-bold')], ['Page not found']),
                  h.p([], [`There is no page at ${path || 'this address'}.`]),
                ],
              ),
              h.a([h.Href('/'), h.Class('btn')], ['Back to the line guide']),
            ],
          ),
        ],
      ),
  })
  const focused = model.route._tag === 'Section' && model.route.section.startsWith('activity-')
  const section =
    model.route._tag === 'Section'
      ? model.route.section.startsWith('activity-')
        ? `Activity ${model.route.section.slice('activity-'.length)}`
        : model.route.section === 'kanji'
          ? 'Kanji'
          : model.route.section === 'grammar'
            ? 'Grammar'
            : 'Scripts'
      : undefined
  const title = lesson
    ? model.route._tag === 'Section' && section
      ? `第${lesson.number}課 · ${section} · Irodori`
      : `第${lesson.number}課 · ${lesson.title.en} · Irodori`
    : 'Irodori Elementary 1'
  return {
    title,
    lang: 'en',
    body: h.div(
      [h.Class(model.furigana ? '' : 'furigana-off')],
      [
        h.a([h.Href('#main'), h.Class('skip-link')], ['Skip to content']),
        focused ? h.empty : header(model, h),
        h.main([h.Id('main')], [content]),
      ],
    ),
  }
}
