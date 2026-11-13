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
  return out
}

/** A muted English line. */
export const en = (h: HtmlBuilder<Message>, text: string | undefined, className = ''): Child =>
  text
    ? h.p([h.Class(cn('text-[14px] leading-snug text-[var(--mute)]', className))], [text])
    : h.empty

/** A round button that plays one track of the lesson, and stops it when pressed again. */
export const playButton = (c: Ctx, id: string): Child => {
  const { h, model, lesson } = c
  const file = lesson.audio.find((a) => a.id === id)
  if (!file) return h.empty
  const on = model.playing === id
  return h.button(
    [
      h.Key(`play-${id}`),
      h.Type('button'),
      h.AriaPressed(on ? 'true' : 'false'),
      h.AriaLabel(`${on ? 'Stop' : 'Play'} ${file.kind} ${id}`),
      h.OnClick(Msg.ClickedPlay({ id, url: lessonUrl(lesson.number, `audio/${file.file}`) })),
      h.Class(cn('play', on && 'on')),
    ],
    [icon(h, on ? Square : Play, 'size-3.5 fill-current'), id],
  )
}

export const plays = (c: Ctx, ids: ReadonlyArray<string>): Child =>
  ids.length === 0
    ? c.h.empty
    : c.h.div(
        [c.h.Class('flex flex-wrap gap-1.5')],
        ids.map((id) => playButton(c, id)),
      )

export const has = (list: ReadonlyArray<string>, key: string): boolean => list.includes(key)
