//! The structured lesson the app consumes. Japanese text keeps its furigana as ranges.

use crate::layout::{Line, Ruby};
use serde::Serialize;

/// Japanese text with furigana. `ruby` ranges are char indices into `text`.
#[derive(Debug, Clone, Default, Serialize, PartialEq)]
pub struct Text {
    pub text: String,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub ruby: Vec<Ruby>,
}

impl Text {
    /// Builds text from a layout line, dropping the stray spaces the PDF puts inside Japanese words.
    pub fn from_line(line: &Line) -> Text {
        let chars: Vec<char> = line.text.chars().collect();
        let blank = |c: char| matches!(c, ' ' | '\t' | '\u{3000}');
        let mut keep = vec![true; chars.len()];
        for i in 0..chars.len() {
            if !blank(chars[i]) {
                continue;
            }
            let prev = chars[..i].iter().rev().find(|c| !blank(**c));
            let next = chars[i + 1..].iter().find(|c| !blank(**c));
            let wide = |c: Option<&char>| c.is_none_or(|c| !c.is_ascii());
            keep[i] = !(wide(prev) && wide(next));
        }
        // Collapse leftover runs of blanks to one space and trim the ends.
        let mut out = Text::default();
        let mut map = vec![0usize; chars.len() + 1];
        let mut last_blank = true;
        for (i, &c) in chars.iter().enumerate() {
            map[i] = out.text.chars().count();
            if !keep[i] || (blank(c) && last_blank) {
                continue;
            }
            last_blank = blank(c);
            out.text.push(if blank(c) { ' ' } else { c });
        }
        map[chars.len()] = out.text.chars().count();
        let trimmed = out.text.trim_end().chars().count();
        out.text.truncate(out.text.trim_end().len());
        out.ruby = line
            .ruby
            .iter()
            .filter(|r| map[r.end] <= trimmed && map[r.end] > map[r.start])
            .map(|r| Ruby { start: map[r.start], end: map[r.end], reading: r.reading.clone() })
            .collect();
        out
    }

    pub fn len(&self) -> usize {
        self.text.chars().count()
    }

    /// The part between char indices `a..b`, re-basing furigana that lies fully inside.
    pub fn slice(&self, a: usize, b: usize) -> Text {
        let part: String = self.text.chars().skip(a).take(b - a).collect();
        let lead = part.chars().take_while(|c| c.is_whitespace()).count();
        let ruby = self
            .ruby
            .iter()
            .filter(|r| r.start >= a + lead && r.end <= b)
            .map(|r| Ruby { start: r.start - a - lead, end: r.end - a - lead, reading: r.reading.clone() })
            .collect();
        Text { text: part.trim().to_string(), ruby }
    }

    pub fn is_empty(&self) -> bool {
        self.text.is_empty()
    }

    /// Appends `other`, shifting its furigana ranges.
    pub fn push(&mut self, other: &Text) {
        let at = self.len();
        self.text.push_str(&other.text);
        self.ruby.extend(other.ruby.iter().map(|r| Ruby { start: r.start + at, end: r.end + at, reading: r.reading.clone() }));
    }

    /// Splits `ja English` at the first run of 3 ASCII letters that follows Japanese text.
    pub fn split_en(&self) -> (Text, Option<String>) {
        let chars: Vec<char> = self.text.chars().collect();
        let cut = (0..chars.len()).find(|&i| {
            chars[i..].iter().take(3).filter(|c| c.is_ascii_alphabetic()).count() == 3
                && chars[..i].iter().any(|p| !p.is_ascii())
        });
        match cut {
            Some(i) => {
                let en = self.slice(i, chars.len()).text;
                (self.slice(0, i), Some(en))
            }
            None => (self.clone(), None),
        }
    }
}

#[derive(Debug, Serialize)]
pub struct Bilingual {
    pub ja: String,
    pub en: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct AudioFile {
    /// Track id as printed in the PDF, such as `01-04`.
    pub id: String,
    pub kind: String,
    pub file: String,
    pub url: String,
}

/// A picture from the PDF. `file` is relative to the lesson folder; the box is in PDF points,
/// with the origin at the bottom left of the page, like the line positions.
#[derive(Debug, Clone, Serialize)]
pub struct Image {
    pub page: usize,
    pub file: String,
    pub width: u32,
    pub height: u32,
    pub x: f32,
    pub y: f32,
    pub w: f32,
    pub h: f32,
}

#[derive(Debug, Serialize)]
pub struct Lesson {
    pub number: u32,
    pub topic: Bilingual,
    pub title: Bilingual,
    pub audio: Vec<AudioFile>,
    /// Pictures embedded in the PDF, extracted next to it.
    pub images: Vec<Image>,
    pub activities: Vec<Activity>,
    /// Listening scripts printed at the end of the book, one per audio track.
    pub scripts: Vec<Dialogue>,
    pub kanji: Kanji,
    pub notes: Vec<Note>,
}

#[derive(Debug, Default, Serialize)]
pub struct Activity {
    pub number: u32,
    pub title: Text,
    pub can_do_id: String,
    pub can_do: Text,
    pub can_do_en: String,
    pub steps: Vec<Step>,
}

#[derive(Debug, Default, Serialize)]
pub struct Step {
    pub number: u32,
    pub title: Text,
    pub title_en: String,
    pub tasks: Vec<Task>,
}

#[derive(Debug, Default, Serialize)]
pub struct Task {
    pub number: u32,
    /// What the learner does: `listen`, `choose`, `fill`, `shadow`, `repeat`, `notice`, `vocab`, `practice` or `speak`.
    #[serde(skip_serializing_if = "String::is_empty")]
    pub kind: String,
    pub instruction: Text,
    pub instruction_en: String,
    pub audio: Vec<String>,
    /// Set when the PDF prints an audio range such as `01-04 ～ 01-06`.
    #[serde(skip)]
    pub ranged: bool,
    pub dialogues: Vec<Dialogue>,
    /// Sub-questions, printed as `（1）` under a `(1)` task.
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub subtasks: Vec<Task>,
    /// Multiple-choice rows, each row a list of options that share a baseline.
    pub choices: Vec<Vec<Choice>>,
    pub vocab: Vec<Vocab>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub tables: Vec<Table>,
    /// An answer table: one column per person or track, one row per thing to note down.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub grid: Option<Grid>,
    /// Pattern-practice speech bubbles, in reading order.
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub practice: Vec<Bubble>,
    /// A quiz built from the task, for `choose` and `fill` tasks.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub quiz: Option<Quiz>,
    /// Any other Japanese on the page for this task.
    pub body: Vec<Block>,
}

#[derive(Debug, Clone, Serialize)]
pub struct Grid {
    pub columns: Vec<Text>,
    pub rows: Vec<Text>,
}

/// A speech bubble from a pattern-practice diagram. Lines are alternatives or consecutive sentences.
#[derive(Debug, Serialize)]
pub struct Bubble {
    pub side: String,
    pub lines: Vec<Text>,
}

#[derive(Debug, Clone, Serialize)]
pub struct Question {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub prompt: Option<Text>,
    /// Empty for a circle-it task. The PDF has no answer key, so answers are not filled in.
    pub options: Vec<Choice>,
}

#[derive(Debug, Serialize)]
pub struct ChooseItem {
    /// The track to listen to; empty for reading tasks.
    #[serde(skip_serializing_if = "String::is_empty")]
    pub audio: String,
    pub questions: Vec<Question>,
}

#[derive(Debug, Serialize)]
pub struct FillItem {
    /// The text around the blanks; `parts.len() - 1` blanks. One part means no blank.
    pub parts: Vec<Text>,
    /// Every answer set found in the listening scripts, one text per blank.
    pub answers: Vec<Vec<Text>>,
}

#[derive(Debug, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Quiz {
    Choose { items: Vec<ChooseItem> },
    Fill { items: Vec<FillItem> },
}

#[derive(Debug, Default, Serialize)]
pub struct Kanji {
    /// Words with their readings.
    pub words: Vec<Text>,
    /// Practice sentences; a dialogue sentence has its lines joined by `\n`.
    pub sentences: Vec<Text>,
}

#[derive(Debug, Default, Serialize)]
pub struct Block {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ja: Option<Text>,
    #[serde(skip_serializing_if = "String::is_empty")]
    pub en: String,
    /// Page, x and baseline in the PDF; used to rebuild tables, never serialized.
    #[serde(skip)]
    pub at: Option<(usize, f32, f32)>,
}

/// One term and its reading from a vocabulary table.
#[derive(Debug, Serialize)]
pub struct Entry {
    pub term: Text,
    pub reading: Text,
}

/// A vocabulary table. Each row lists term and reading pairs, one pair per column group.
#[derive(Debug, Default, Serialize)]
pub struct Table {
    pub headings: Vec<Block>,
    pub rows: Vec<Vec<Entry>>,
}

#[derive(Debug, Clone, Serialize)]
pub struct Choice {
    pub label: String,
    pub ja: Text,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub en: Option<String>,
    /// The picture printed under the label, as a path relative to the lesson folder.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub image: Option<String>,
    /// Page, x and baseline of the label, when it stands on a line of its own; never serialized.
    #[serde(skip)]
    pub at: Option<(usize, f32, f32)>,
}

#[derive(Debug, Serialize)]
pub struct Vocab {
    pub ja: Text,
    pub en: String,
}

#[derive(Debug, Default, Serialize)]
pub struct Dialogue {
    /// Audio track id, when the PDF prints one next to the dialogue.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub audio: Option<String>,
    pub turns: Vec<Turn>,
}

#[derive(Debug, Serialize)]
pub struct Turn {
    pub speaker: String,
    pub text: Text,
}

#[derive(Debug, Default, Serialize)]
pub struct Note {
    /// `grammar` for the numbered grammar notes, `reference` for lettered sections, `column` for culture columns.
    pub kind: String,
    pub title: Text,
    /// The sentence pattern box under the number, one text per line.
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub pattern: Vec<Text>,
    /// Sample sentences and running text.
    pub blocks: Vec<Block>,
    /// Explanation bullets, English with the Japanese bullet that follows it.
    pub points: Vec<Point>,
    /// Japanese bullets that could not be paired with an English one.
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub points_ja: Vec<Text>,
    pub examples: Vec<Example>,
    /// Sections of a `reference` note, such as the verb groups and the テ-form rules.
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub sections: Vec<RefSection>,
}

#[derive(Debug, Default, Serialize)]
pub struct RefSection {
    pub title: Text,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub intro: Option<Block>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub groups: Vec<VerbGroup>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub rules: Vec<ConjRule>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub footnote: Option<Block>,
}

/// A verb group and how its verbs conjugate.
#[derive(Debug, Default, Serialize)]
pub struct VerbGroup {
    pub group: u32,
    pub stem_en: String,
    pub stem_ja: Text,
    pub rule_en: String,
    pub rule_ja: Text,
    pub examples: Vec<Pair>,
}

/// One dictionary-form ending and the form it takes, such as `-う` to `-って`.
#[derive(Debug, Serialize)]
pub struct ConjRule {
    pub group: u32,
    pub ending: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<String>,
    pub examples: Vec<Pair>,
}

/// `働く (hatarak＋u) → 働きます (hatarak＋i＋ます)`.
#[derive(Debug, Serialize)]
pub struct Pair {
    pub from: Text,
    pub to: Text,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub from_note: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub to_note: Option<String>,
    /// Set for exceptions, such as `exceptional case 例外`.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub note: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct Point {
    pub en: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ja: Option<Text>,
}

/// A `［例］` example: one sentence or a short dialogue.
#[derive(Debug, Serialize)]
pub struct Example {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
    pub turns: Vec<ExTurn>,
}

#[derive(Debug, Serialize)]
pub struct ExTurn {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub speaker: Option<String>,
    pub ja: Text,
    #[serde(skip_serializing_if = "String::is_empty")]
    pub en: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn split_en_ignores_single_latin_letters_inside_japanese() {
        let t = Text { text: "どんな人にaを使いますか。 With whom".into(), ruby: vec![] };
        let (ja, en) = t.split_en();
        assert_eq!(ja.text, "どんな人にaを使いますか。");
        assert_eq!(en.as_deref(), Some("With whom"));
    }
}
