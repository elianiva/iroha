/** One colour per chapter; the CSS classes `.ch-1` … `.ch-9` set `--c`, `--cd` and `--cs`. */
export const chapterClass = (chapter: number): string => `ch-${((chapter - 1) % 9) + 1}`
