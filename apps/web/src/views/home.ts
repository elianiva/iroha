import { badge } from '@/components/ui/badge'
import type { BookIndex } from '../data/types.ts'
import { type Child, en, jp } from '../ui/common.ts'
import type { Message } from '../app/state.ts'
import type { HtmlBuilder } from 'foldkit/html'
import { lessonHref } from './lesson.ts'

export const homePage = (h: HtmlBuilder<Message>, index: BookIndex): Child =>
  h.div(
    [h.Class('flex flex-col gap-8')],
    [
      h.div(
        [h.Class('flex flex-col gap-1')],
        [
          h.h1(
            [h.Class('text-[30px] leading-tight font-semibold tracking-tight')],
            [index.book.title.ja],
          ),
          en(
            h,
            `${index.book.title.en} · ${index.chapters.length} chapters · ${index.chapters.reduce((n, c) => n + c.lessons.length, 0)} lessons`,
            'text-[15px]',
          ),
        ],
      ),
      ...index.chapters.map((chapter) =>
        h.section(
          [h.Key(`ch${chapter.number}`), h.Class('flex flex-col gap-3')],
          [
            h.div(
              [h.Class('flex items-baseline gap-3')],
              [
                h.span(
                  [h.Class('font-mono text-[12px] text-muted-foreground')],
                  [`Chapter ${chapter.number}`],
                ),
                h.h2([h.Class('text-[19px] font-semibold')], [chapter.topic.ja]),
                h.span([h.Class('text-[13px] text-muted-foreground')], [chapter.topic.en]),
              ],
            ),
            h.div(
              [h.Class('grid grid-cols-1 gap-3 md:grid-cols-2')],
              chapter.lessons.map((l) =>
                h.a(
                  [
                    h.Key(`l${l.number}`),
                    h.Href(lessonHref(l.number)),
                    h.Class(
                      'flex flex-col gap-2 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/60',
                    ),
                  ],
                  [
                    h.div(
                      [h.Class('flex items-center gap-2')],
                      [
                        badge({ variant: 'default' }, [`Lesson ${l.number}`], h),
                        h.span(
                          [h.Class('text-[12px] text-muted-foreground')],
                          [
                            `${l.sections.filter((s) => s.kind === 'activity').length} activities · ${l.audio} tracks`,
                          ],
                        ),
                      ],
                    ),
                    h.span([h.Class('text-[18px] leading-snug font-medium')], [l.title.ja]),
                    en(h, l.title.en),
                    l.question.ja
                      ? h.span(
                          [
                            h.Class(
                              'mt-1 border-t border-border pt-2 text-[13px] text-muted-foreground',
                            ),
                          ],
                          jp(h, l.question.ja),
                        )
                      : h.empty,
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    ],
  )
