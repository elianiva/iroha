import { Option } from 'effect'
import { expect, test } from 'vitest'
import { AppRoute, urlToAppRoute } from './route.ts'

const url = (pathname: string) => ({
  protocol: 'https:',
  host: 'example.test',
  port: Option.none(),
  pathname,
  search: Option.none(),
  hash: Option.none(),
})

test('lesson URLs parse into routes', () => {
  expect(urlToAppRoute(url('/'))._tag).toBe('Home')
  expect(urlToAppRoute(url('/lesson/12'))).toMatchObject({ _tag: 'Lesson', number: 12 })
  expect(urlToAppRoute(url('/lesson/3/activity-2'))).toMatchObject({
    _tag: 'Section',
    number: 3,
    section: 'activity-2',
  })
  expect(urlToAppRoute(url('/lesson/banana'))._tag).toBe('NotFound')
})

test('routes are matchable', () => {
  expect(AppRoute.Home()._tag).toBe('Home')
})
