import type { Activity, Step, Task } from '../data/types.ts'
import type { Model } from './state.ts'

/** One screen of the lesson player: a single exercise, with the heading of the step it sits in. */
export type Unit = Readonly<{ key: string; step: Step; task: Task }>

const hasContent = (t: Task): boolean =>
  t.instruction.text !== '' ||
  t.body.length > 0 ||
  t.choices.length > 0 ||
  (t.practice?.length ?? 0) > 0 ||
  t.quiz !== undefined ||
  t.dialogues.length > 0 ||
  t.vocab.length > 0 ||
  (t.tables?.length ?? 0) > 0 ||
  t.audio.length > 0

/** Tasks and their sub-questions, flattened in reading order. */
export const unitsOf = (a: Activity): ReadonlyArray<Unit> => {
  const out: Array<Omit<Unit, 'key'>> = []
  const add = (step: Step, t: Task): void => {
    if (hasContent(t)) out.push({ step, task: t })
    ;(t.subtasks ?? []).forEach((s) => add(step, s))
  }
  a.steps.forEach((s) => s.tasks.forEach((t) => add(s, t)))
  return out.map((u, i) => ({ ...u, key: `a${a.number}.u${i}` }))
}

export const norm = (s: string): string => s.replace(/[\s　、。，,.]/g, '')

export type Gate =
  | Readonly<{ kind: 'continue'; label: 'Continue' | 'Skip' }>
  | Readonly<{ kind: 'check'; ready: boolean }>
  | Readonly<{ kind: 'result'; ok: boolean; answer: string }>

const anyKey = (record: Readonly<Record<string, string>>, prefix: string): boolean =>
  Object.entries(record).some(([k, v]) => k.startsWith(prefix) && v.trim() !== '')

/** What the bottom bar asks for: nothing, a check of typed blanks, or the verdict of that check. */
export const gate = (model: Model, unit: Unit): Gate => {
  const q = unit.task.quiz
  if (q?.type === 'fill' && q.items.some((i) => i.answers.length > 0)) {
    const key = unit.key
    if (!model.checked.includes(key))
      return { kind: 'check', ready: anyKey(model.typed, `${key}.f`) }
    let ok = true
    const shown: Array<string> = []
    q.items.forEach((item, i) => {
      if (item.answers.length === 0) return
      const blanks = item.parts.length - 1
      for (let at = 0; at < blanks; at += 1) {
        const value = model.typed[`${key}.f${i}.${at}`] ?? ''
        if (!item.answers.some((a) => norm(a[at]?.text ?? '\u0000') === norm(value))) {
          ok = false
          shown.push(item.answers[0]?.[at]?.text ?? '')
        }
      }
    })
    return { kind: 'result', ok, answer: shown.filter(Boolean).slice(0, 3).join(' · ') }
  }
  if (q?.type === 'choose')
    return { kind: 'continue', label: anyKey(model.picks, `${unit.key}.c`) ? 'Continue' : 'Skip' }
  return { kind: 'continue', label: 'Continue' }
}
