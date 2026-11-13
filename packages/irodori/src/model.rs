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

#[derive(Debug, Serialize)]
pub struct Lesson {
    pub number: u32,
    pub topic: Bilingual,
    pub title: Bilingual,
    pub audio: Vec<AudioFile>,
    pub activities: Vec<Activity>,
    /// Listening scripts printed at the end of the book, one per audio track.
    pub scripts: Vec<Dialogue>,
    pub kanji: Vec<Step>,
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
    /// Any other Japanese on the page for this task, such as fill-in-the-blank sentences.
    pub body: Vec<Block>,
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

#[derive(Debug, Serialize)]
pub struct Choice {
    pub label: String,
    pub ja: Text,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub en: Option<String>,
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
    /// `grammar` for the numbered grammar notes, `column` for the culture columns.
    pub kind: String,
    pub title: Text,
    pub blocks: Vec<Block>,
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
