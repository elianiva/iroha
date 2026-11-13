import type { Html, HtmlBuilder } from 'foldkit/html'
import { Play, Square } from 'lucide'
import { icon } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { lessonUrl } from '../data/queries.ts'
import type { Message, Model } from '../app/state.ts'
import { Message as Msg } from '../app/state.ts'
import type { Lesson, Text } from '../data/types.ts'

export type Child = Html | string

/** What every view of a lesson needs: the builder, the model, and the lesson being read. */
export type Ctx = Readonly<{ h: HtmlBuilder<Message>; model: Model; lesson: Lesson }>

export const plain = (t: Text | undefined): string => t?.text ?? ''

/** Japanese text with furigana over the ranges the PDF carried. */
export const jp = (h: HtmlBuilder<Message>, t: Text | undefined): ReadonlyArray<Child> => {
  if (!t) return []
  const chars = Array.from(t.text)
  const out: Array<Child> = []
  let at = 0
  for (const r of [...(t.ruby ?? [])].sort((a, b) => a.start - b.start)) {
    if (r.start < at) continue
    if (r.start > at) out.push(chars.slice(at, r.start).join(''))
    out.push(h.ruby([], [chars.slice(r.start, r.end).join(''), h.rt([], [r.reading])]))
    at = r.end
  }
  if (at < chars.length) out.push(chars.slice(at).join(''))
  return out.length ? [h.span([h.Lang('ja')], out)] : []
}

/** Japanese text without the furigana wrapper, for short labels. */
export const ja = (h: HtmlBuilder<Message>, text: string): Child => h.span([h.Lang('ja')], [text])
/** A muted English line. */
export const en = (h: HtmlBuilder<Message>, text: string | undefined, className = ''): Child =>
  text ? h.p([h.Class(cn('en-copy', className))], [text]) : h.empty

const AUDIO_KINDS: Readonly<Record<string, string>> = {
  kaiwa: 'Conversation',
  kiku: 'Listening',
  hanasu: 'Speaking',
  katachi: 'Pattern',
  kotoba: 'Vocabulary',
}

const audioName = (kind: string): string => AUDIO_KINDS[kind.match(/^[a-z]+/)?.[0] ?? ''] ?? 'Audio'

/** The furigana switch: one compact control in the masthead and in the player. */
export const furiganaToggle = (h: HtmlBuilder<Message>, model: Model): Child =>
  h.button(
    [
      h.Type('button'),
      h.AriaPressed(model.furigana ? 'true' : 'false'),
      h.AriaLabel(`Furigana ${model.furigana ? 'on' : 'off'}`),
      h.OnClick(Msg.ToggledFurigana()),
      h.Class('furigana'),
    ],
    [h.span([], ['ふ']), h.span([h.Class('furigana-word')], ['りがな'])],
  )

/** A round button that plays one track of the lesson, and stops it when pressed again. */
export const playButton = (c: Ctx, id: string, label?: string): Child => {
  const { h, model, lesson } = c
  const file = lesson.audio.find((a) => a.id === id)
  if (!file) return h.empty
  const name = label ?? audioName(file.kind)
  const on = model.playing === id
  return h.button(
    [
      h.Key(`play-${id}`),
      h.Type('button'),
      h.AriaPressed(on ? 'true' : 'false'),
      h.AriaLabel(`${on ? 'Stop' : 'Play'} ${name}`),
      h.OnClick(Msg.ClickedPlay({ id, url: lessonUrl(lesson.number, `audio/${file.file}`) }), {
        propagation: 'Stop',
      }),
      h.Class(cn('audio-btn', on && 'is-playing')),
    ],
    [icon(h, on ? Square : Play, 'size-3.5 fill-current'), name],
  )
}

/** Every track on a task, numbered when there is more than one. */
export const plays = (c: Ctx, ids: ReadonlyArray<string>): Child => {
  const { h } = c
  if (ids.length === 0) return h.empty
  return h.div(
    [h.Class('audio-row')],
    ids.map((id) => {
      const file = c.lesson.audio.find((a) => a.id === id)
      if (!file) return h.empty
      const name =
        ids.length > 1 ? `${audioName(file.kind)} ${ids.indexOf(id) + 1}` : audioName(file.kind)
      return playButton(c, id, name)
    }),
  )
}

export const has = (list: ReadonlyArray<string>, key: string): boolean => list.includes(key)
