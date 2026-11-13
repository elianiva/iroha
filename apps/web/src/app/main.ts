import { Effect, Option } from 'effect'
import { Command, type Runtime, type Update } from 'foldkit'
import { UrlRequest, load, pushUrl } from 'foldkit/navigation'
import { Url, toString as urlToString } from 'foldkit/url'
import { indexQuery, lessonQuery } from '../data/queries.ts'
import { AppRoute, urlToAppRoute } from './route.ts'
import { LoadProgress, SaveProgress } from './progress.ts'
import { emptyProgress, finish } from './progress-schema.ts'
import { Message, Model } from './state.ts'
import { Schema } from 'effect'

export { Message, Model }

const index = indexQuery.lift<Model, Message>({
  parentField: 'index',
  toParentMessage: (message) => Message.GotIndexMessage({ message }),
})
const lessons = lessonQuery.lift<Model, Message>({
  parentField: 'lessons',
  toParentMessage: (message) => Message.GotLessonMessage({ message }),
})

type Return = Update.Return<Model, Message>

const Navigate = Command.define('Navigate', {
  args: { url: Schema.String },
  messages: [Message.Navigated],
  execute: ({ url }) => pushUrl(url).pipe(Effect.as(Message.Navigated())),
})
const LoadExternal = Command.define('LoadExternal', {
  args: { href: Schema.String },
  messages: [Message.Navigated],
  execute: ({ href }) => load(href).pipe(Effect.as(Message.Navigated())),
})
const ScrollTop = Command.define('ScrollTop', {
  messages: [Message.Navigated],
  execute: Effect.sync(() => {
    requestAnimationFrame(() => window.scrollTo(0, 0))
    return Message.Navigated()
  }),
})

/** One track plays at a time. The Command ends when the track ends or is paused. */
const player = typeof Audio === 'undefined' ? undefined : new Audio()
const PlayAudio = Command.define('PlayAudio', {
  args: { id: Schema.String, url: Schema.String },
  messages: [Message.StoppedAudio],
  execute: ({ id, url }) =>
    Effect.promise(
      () =>
        new Promise<void>((resolve) => {
          if (!player) return resolve()
          player.pause()
          player.src = url
          const done = () => {
            player.removeEventListener('ended', done)
            player.removeEventListener('pause', done)
            player.removeEventListener('error', done)
            resolve()
          }
          player.addEventListener('ended', done)
          player.addEventListener('pause', done)
          player.addEventListener('error', done)
          void player.play().catch(done)
        }),
    ).pipe(Effect.as(Message.StoppedAudio({ id }))),
})
const StopAudio = Command.define('StopAudio', {
  args: { id: Schema.String },
  messages: [Message.StoppedAudio],
  execute: ({ id }) =>
    Effect.sync(() => {
      player?.pause()
      return Message.StoppedAudio({ id })
    }),
})

const lessonOf = (route: AppRoute): number | undefined =>
  AppRoute.match(route, {
    Home: () => undefined,
    Lesson: ({ number }) => number,
    Section: ({ number }) => number,
    NotFound: () => undefined,
  })

/** A lesson loads once, when its page is first opened. */
const loadFor = (model: Model): Return => {
  const n = lessonOf(model.route)
  return n === undefined ? { model } : lessons.loadIfMissing(model, { number: n })
}

/** Runs `next` on the model `first` returned, and keeps both Commands. */
const then = (first: Return, next: (model: Model) => Return): Return => {
  const second = next(first.model)
  return { model: second.model, commands: [...(first.commands ?? []), ...(second.commands ?? [])] }
}

export const init: Runtime.RoutingApplicationInit<Model, Message> = (url) => {
  const route = urlToAppRoute(url)
  const model = Model.make({
    route,
    index: indexQuery.init(),
    lessons: lessonQuery.init(),
    furigana: true,
    hideScripts: false,
    playing: '',
    earned: 0,
    progress: emptyProgress,
    today: '1970-01-01',
    unit: 0,
    picks: {},
    typed: {},
    checked: [],
    revealed: [],
  })
  return then(then(index.loadIfMissing(model), loadFor), (next) => ({
    model: next,
    commands: [LoadProgress()],
  }))
}

const saved = (model: Model, progress: Model['progress']): Return => ({
  model: { ...model, progress },
  commands: [SaveProgress({ progress })],
})

const toggle = (list: ReadonlyArray<string>, key: string): ReadonlyArray<string> =>
  list.includes(key) ? list.filter((k) => k !== key) : [...list, key]

export const update = (model: Model, message: Message): Return =>
  Message.match<Return>(message, {
    ClickedLink: ({ request }) =>
      UrlRequest.match<Return>(request, {
        Internal: ({ url }) => ({ model, commands: [Navigate({ url: urlToString(url) })] }),
        External: ({ href }) => ({ model, commands: [LoadExternal({ href })] }),
      }),
    ChangedUrl: ({ url }) => {
      const next = {
        ...model,
        route: urlToAppRoute(url),
        unit: 0,
        earned: 0,
        playing: '',
      }
      const hash = Option.isSome(url.hash)
      const commands = [
        ...(model.playing ? [StopAudio({ id: model.playing })] : []),
        ...(hash ? [] : [ScrollTop()]),
      ]
      return then({ model: next, commands }, loadFor)
    },
    Navigated: () => ({ model }),
    GotIndexMessage: ({ message }) => index.fold(model, message),
    GotLessonMessage: ({ message }) => lessons.fold(model, message),
    ToggledFurigana: () => ({ model: { ...model, furigana: !model.furigana } }),
    ToggledScripts: () => ({
      model: {
        ...model,
        hideScripts: !model.hideScripts,
        revealed: model.revealed.filter((k) => !k.startsWith('script')),
      },
    }),
    ClickedPlay: ({ id, url }) =>
      model.playing === id
        ? { model: { ...model, playing: '' }, commands: [StopAudio({ id })] }
        : { model: { ...model, playing: id }, commands: [PlayAudio({ id, url })] },
    StoppedAudio: ({ id }) => ({ model: model.playing === id ? { ...model, playing: '' } : model }),
    Picked: ({ key, value }) => ({ model: { ...model, picks: { ...model.picks, [key]: value } } }),
    Typed: ({ key, value }) => ({ model: { ...model, typed: { ...model.typed, [key]: value } } }),
    Checked: ({ key }) => ({
      model: {
        ...model,
        checked: model.checked.includes(key) ? model.checked : [...model.checked, key],
      },
    }),
    ToggledReveal: ({ key }) => ({ model: { ...model, revealed: toggle(model.revealed, key) } }),
    LoadedProgress: ({ progress, today }) =>
      saved(
        { ...model, today },
        {
          done: [...new Set([...progress.done, ...model.progress.done])],
          xp: progress.xp + model.progress.xp,
          streak: progress.streak,
          lastDay: progress.lastDay,
        },
      ),
    ClickedContinue: ({ total }) => {
      const next = model.unit + 1
      if (next < total || model.route._tag !== 'Section')
        return { model: { ...model, unit: next, earned: 0 } }
      // The last exercise: the page is done, and the first time it earns XP and extends the streak.
      const page = `${model.route.number}.${model.route.section}`
      const progress = finish(model.progress, page, total * 2, model.today)
      const earned = progress === model.progress ? 0 : total * 2
      if (progress === model.progress) return { model: { ...model, unit: next, earned } }
      return {
        model: { ...model, unit: next, earned, progress },
        commands: [SaveProgress({ progress })],
      }
    },
    ClickedDone: () => {
      if (model.route._tag !== 'Section' || model.route.section.startsWith('activity-'))
        return { model }
      const progress = finish(
        model.progress,
        `${model.route.number}.${model.route.section}`,
        5,
        model.today,
      )
      return progress === model.progress ? { model } : saved(model, progress)
    },
    ClickedBack: () => ({ model: { ...model, unit: Math.max(0, model.unit - 1) } }),
    ClickedRestart: () => ({
      model: {
        ...model,
        unit: 0,
        earned: 0,
        picks: {},
        typed: {},
        checked: [],
      },
    }),
    ClickedRetry: () => {
      const n = lessonOf(model.route)
      return n === undefined
        ? index.revalidateOrLoad(model)
        : lessons.revalidateOrLoad(model, { number: n })
    },
  })

export type { Url }
