/** The shapes of `index.json` and `lesson.json`, written by `packages/irodori` (`irodori lesson N`, `irodori index`). */

export type Ruby = Readonly<{ start: number; end: number; reading: string }>
/** Japanese text. `ruby` ranges are code-point indices into `text`. */
export type Text = Readonly<{ text: string; ruby?: ReadonlyArray<Ruby> }>
export type Bilingual = Readonly<{ ja: string; en: string }>

export type Block = Readonly<{ ja?: Text; en?: string }>
export type AudioFile = Readonly<{ id: string; kind: string; file: string; url: string }>
export type LessonImage = Readonly<{ page: number; file: string; width: number; height: number }>

export type Choice = Readonly<{ label: string; ja: Text; en?: string; image?: string }>
export type Question = Readonly<{ prompt?: Text; options: ReadonlyArray<Choice> }>
export type ChooseItem = Readonly<{ audio?: string; questions: ReadonlyArray<Question> }>
export type FillItem = Readonly<{
  parts: ReadonlyArray<Text>
  answers: ReadonlyArray<ReadonlyArray<Text>>
}>
export type Quiz =
  | Readonly<{ type: 'choose'; items: ReadonlyArray<ChooseItem> }>
  | Readonly<{ type: 'fill'; items: ReadonlyArray<FillItem> }>

export type Turn = Readonly<{ speaker: string; text: Text }>
export type Dialogue = Readonly<{ audio?: string; turns: ReadonlyArray<Turn> }>
export type Vocab = Readonly<{ ja: Text; en: string }>
export type Entry = Readonly<{ term: Text; reading: Text }>
export type Table = Readonly<{
  headings: ReadonlyArray<Block>
  rows: ReadonlyArray<ReadonlyArray<Entry>>
}>
export type Grid = Readonly<{ columns: ReadonlyArray<Text>; rows: ReadonlyArray<Text> }>
export type Bubble = Readonly<{ side: string; lines: ReadonlyArray<Text> }>

export type Task = Readonly<{
  number: number
  kind?: string
  response?: string
  instruction: Text
  instruction_en: string
  audio: ReadonlyArray<string>
  dialogues: ReadonlyArray<Dialogue>
  subtasks?: ReadonlyArray<Task>
  choices: ReadonlyArray<ReadonlyArray<Choice>>
  vocab: ReadonlyArray<Vocab>
  tables?: ReadonlyArray<Table>
  grid?: Grid
  practice?: ReadonlyArray<Bubble>
  quiz?: Quiz
  hints?: ReadonlyArray<Block>
  body: ReadonlyArray<Block>
}>
export type Step = Readonly<{
  number: number
  title: Text
  title_en: string
  tasks: ReadonlyArray<Task>
}>
export type Activity = Readonly<{
  number: number
  title: Text
  can_do_id: string
  can_do: Text
  can_do_en: string
  steps: ReadonlyArray<Step>
}>

export type Pair = Readonly<{
  from: Text
  to: Text
  from_note?: string
  to_note?: string
  note?: string
}>
export type RefSection = Readonly<{
  title: Text
  intro?: Block
  groups?: ReadonlyArray<
    Readonly<{
      group: number
      stem_en: string
      stem_ja: Text
      rule_en: string
      rule_ja: Text
      examples: ReadonlyArray<Pair>
    }>
  >
  rules?: ReadonlyArray<
    Readonly<{
      group: number
      ending: string
      forms: ReadonlyArray<string>
      examples: ReadonlyArray<Pair>
    }>
  >
  patterns?: ReadonlyArray<Readonly<{ pattern: Text; examples: ReadonlyArray<Block> }>>
  grid?: ReadonlyArray<ReadonlyArray<Block>>
  matrix_columns?: ReadonlyArray<string>
  matrix?: ReadonlyArray<
    Readonly<{
      class: string
      polarity: string
      cells: ReadonlyArray<Readonly<{ pattern: Text; example?: Block }>>
    }>
  >
  sentences?: ReadonlyArray<Readonly<{ group: string; label: string; ja: Text; en: string }>>
  footnote?: Block
}>
export type Note = Readonly<{
  kind: string
  title: Text
  pattern?: ReadonlyArray<Text>
  blocks: ReadonlyArray<Block>
  points: ReadonlyArray<Readonly<{ en: string; ja?: Text }>>
  points_ja?: ReadonlyArray<Text>
  examples: ReadonlyArray<
    Readonly<{
      label?: string
      turns: ReadonlyArray<Readonly<{ speaker?: string; ja: Text; en?: string }>>
    }>
  >
  sections?: ReadonlyArray<RefSection>
}>

export type Lesson = Readonly<{
  number: number
  topic: Bilingual
  title: Bilingual
  question: Block
  audio: ReadonlyArray<AudioFile>
  images: ReadonlyArray<LessonImage>
  activities: ReadonlyArray<Activity>
  scripts: ReadonlyArray<Dialogue>
  kanji: Readonly<{ words: ReadonlyArray<Text>; sentences: ReadonlyArray<Text> }>
  notes: ReadonlyArray<Note>
}>

export type SectionKind = 'activity' | 'kanji' | 'grammar' | 'scripts'
export type SectionInfo = Readonly<{
  id: string
  kind: SectionKind
  title?: Text
  can_do?: Text
  can_do_en?: string
}>
export type LessonSummary = Readonly<{
  number: number
  title: Bilingual
  question: Block
  audio: number
  images: number
  sections: ReadonlyArray<SectionInfo>
}>
export type Chapter = Readonly<{
  number: number
  topic: Bilingual
  lessons: ReadonlyArray<LessonSummary>
}>
export type BookIndex = Readonly<{
  book: Readonly<{ id: string; title: Bilingual }>
  chapters: ReadonlyArray<Chapter>
}>
