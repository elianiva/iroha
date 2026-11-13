import { Schema, pipe } from 'effect'
import { Route } from 'foldkit'
import { defineRouteUnion, int, literal, slash, string } from 'foldkit/route'

export const AppRoute = defineRouteUnion({
  Home: {},
  Lesson: { number: Schema.Finite },
  Section: { number: Schema.Finite, section: Schema.String },
  NotFound: { path: Schema.String },
})
export type AppRoute = typeof AppRoute.Type

export const homeRouter = pipe(Route.root, Route.mapTo(AppRoute.Home))
export const lessonRouter = pipe(
  literal('lesson'),
  slash(int('number')),
  Route.mapTo(AppRoute.Lesson),
)
export const sectionRouter = pipe(
  literal('lesson'),
  slash(int('number')),
  slash(string('section')),
  Route.mapTo(AppRoute.Section),
)

const parser = Route.oneOf(sectionRouter, lessonRouter, homeRouter)
export const urlToAppRoute = Route.parseUrlWithFallback(parser, AppRoute.NotFound)
