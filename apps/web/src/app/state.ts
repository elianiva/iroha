import { Schema } from 'effect'
import { UrlRequest } from 'foldkit/navigation'
import { defineMessageUnion } from 'foldkit/message'
import { Url } from 'foldkit/url'
import { indexQuery, lessonQuery } from '../data/queries.ts'
import { AppRoute } from './route.ts'
import { Progress } from './progress-schema.ts'

export const Model = Schema.Struct({
  route: AppRoute,
  index: indexQuery.Model,
  lessons: lessonQuery.Model,
  /** Furigana over kanji. */
  furigana: Schema.Boolean,
  /** Listening scripts are blurred until tapped. */
  hideScripts: Schema.Boolean,
  /** The track playing now, or an empty string. */
  playing: Schema.String,
  /** XP earned by the activity that was just finished, for the completion screen. */
  earned: Schema.Finite,
  /** The option picked in each choose question, by element key. */
  picks: Schema.Record(Schema.String, Schema.String),
  /** Finished pages, XP and the streak, kept in this browser. */
  progress: Progress,
  /** Today as `YYYY-MM-DD`, read once at start. */
  today: Schema.String,
  /** The exercise on screen in the lesson player. */
  unit: Schema.Finite,
  /** What was typed into each blank or answer box, by element key. */
  typed: Schema.Record(Schema.String, Schema.String),
  /** Fill exercises that were checked, and elements whose answers or text are shown. */
  checked: Schema.Array(Schema.String),
  revealed: Schema.Array(Schema.String),
})
export type Model = typeof Model.Type

export const Message = defineMessageUnion({
  ClickedLink: { request: UrlRequest },
  ChangedUrl: { url: Url },
  Navigated: {},
  GotIndexMessage: { message: indexQuery.Message },
  GotLessonMessage: { message: lessonQuery.Message },
  ToggledFurigana: {},
  ToggledScripts: {},
  ClickedPlay: { id: Schema.String, url: Schema.String },
  StoppedAudio: { id: Schema.String },
  Picked: { key: Schema.String, value: Schema.String },
  Typed: { key: Schema.String, value: Schema.String },
  Checked: { key: Schema.String },
  ToggledReveal: { key: Schema.String },
  ClickedDone: {},
  ClickedRetry: {},
  LoadedProgress: { progress: Progress, today: Schema.String },
  ClickedContinue: { total: Schema.Finite },
  ClickedBack: {},
  ClickedRestart: {},
})
export type Message = typeof Message.Type
