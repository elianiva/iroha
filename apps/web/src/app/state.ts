import { Schema } from 'effect'
import { UrlRequest } from 'foldkit/navigation'
import { defineMessageUnion } from 'foldkit/message'
import { Url } from 'foldkit/url'
import { indexQuery, lessonQuery } from '../data/queries.ts'
import { AppRoute } from './route.ts'

export const Model = Schema.Struct({
  route: AppRoute,
  index: indexQuery.Model,
  lessons: lessonQuery.Model,
  /** Furigana over kanji. */
  furigana: Schema.Boolean,
  /** Listening scripts are blurred until tapped. */
  hideScripts: Schema.Boolean,
  /** The navigation drawer is open on a phone. */
  menu: Schema.Boolean,
  /** The track playing now, or an empty string. */
  playing: Schema.String,
  /** The option picked in each choose question, by element key. */
  picks: Schema.Record(Schema.String, Schema.String),
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
  ToggledMenu: {},
  ClickedPlay: { id: Schema.String, url: Schema.String },
  StoppedAudio: { id: Schema.String },
  Picked: { key: Schema.String, value: Schema.String },
  Typed: { key: Schema.String, value: Schema.String },
  Checked: { key: Schema.String },
  ToggledReveal: { key: Schema.String },
  ClickedRetry: {},
})
export type Message = typeof Message.Type
