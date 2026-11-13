//! Walks the layout lines of one lesson PDF and builds the structured `Lesson`.

use crate::layout::Line;
use crate::model::*;
use regex::Regex;
use std::collections::{HashMap, HashSet};
use std::sync::LazyLock;

static ID: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\d\d-\d\d").unwrap());
static ID_ONLY: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^\d\d-\d\d$").unwrap());
static ACTIVITY: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^(\d+)\.").unwrap());
static TASK: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^[(（]\s*(\d+)\s*[)）]\s*").unwrap());
static CAN_DO: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^(\d\d)(\D.*)?$").unwrap());
static EXAMPLE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"^(?:［\s*例\s*］)?\s*(?:▶)?\s*([①-⑩])?\s*(?:([Ａ-Ｃ])\s*：)?\s*(.*)$").unwrap()
});
static CHOICE: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"(?:^|\s|[^\x00-\x7f])([a-iア-ク])\s?\.\s*").unwrap());

enum Item {
    Line { text: Text, size: f32, x: f32, y: f32, page: usize },
    Dialogue(Dialogue),
}

fn ci(s: &str, byte: usize) -> usize {
    s[..byte].chars().count()
}

/// Drops page chrome and groups `Ａ：`/`Ｂ：` turns into dialogues, keeping reading order.
fn items(pages: &[Vec<Line>]) -> Vec<Item> {
    let mut out = Vec::new();
    for page in pages {
        let mut lines: Vec<&Line> = page
            .iter()
            .filter(|l| l.y < 770.0 && l.y > 30.0 && !l.text.contains("Japan Foundation"))
            .collect();
        // Baselines within 3pt read as one row, left to right: a track label can sit 1pt above its heading.
        let mut i = 0;
        while i < lines.len() {
            let mut j = i + 1;
            while j < lines.len() && (lines[i].y - lines[j].y).abs() <= 3.0 {
                j += 1;
            }
            lines[i..j].sort_by(|a, b| a.x.total_cmp(&b.x));
            i = j;
        }
        let is_turn = |l: &Line| {
            let mut c = l.text.chars();
            matches!(c.next(), Some('Ａ' | 'Ｂ' | 'Ｃ')) && c.next() == Some('：')
        };
        let ids: Vec<(f32, f32, String)> = lines
            .iter()
            .filter(|l| ID_ONLY.is_match(l.text.trim()))
            .map(|l| (l.x, l.y, l.text.trim().to_string()))
            .collect();

        // One column of turns per x position; a big vertical gap starts a new dialogue.
        let mut columns: Vec<Vec<usize>> = Vec::new();
        for (i, l) in lines.iter().enumerate().filter(|(_, l)| is_turn(l)) {
            match columns.iter_mut().find(|c| (lines[c[0]].x - l.x).abs() < 3.0) {
                Some(c) => c.push(i),
                None => columns.push(vec![i]),
            }
        }
        let mut groups: Vec<Vec<usize>> = Vec::new();
        for col in columns {
            let mut cur: Vec<usize> = Vec::new();
            for i in col {
                if let Some(&p) = cur.last() {
                    if lines[p].y - lines[i].y > 3.5 * lines[i].size {
                        groups.push(std::mem::take(&mut cur));
                    }
                }
                cur.push(i);
            }
            groups.push(cur);
        }
        let turn_ids: HashSet<usize> = groups.iter().flatten().copied().collect();
        let mut dialogues: HashMap<usize, Dialogue> = HashMap::new();
        for g in &groups {
            let first = lines[g[0]];
            // The track id sits at or above the dialogue, about 65pt to its left or right.
            let audio = ids
                .iter()
                .filter(|(_, y, _)| y - first.y >= -2.0)
                .map(|(x, y, id)| (((x - first.x).abs() - 67.0).abs() + (y - first.y), id))
                .filter(|(c, _)| *c < 100.0)
                .min_by(|a, b| a.0.total_cmp(&b.0))
                .map(|(_, id)| id.clone());
            let turns = g
                .iter()
                .map(|&i| {
                    let t = Text::from_line(lines[i]);
                    let speaker = match lines[i].text.chars().next() {
                        Some('Ａ') => "A",
                        Some('Ｂ') => "B",
                        _ => "C",
                    };
                    Turn { speaker: speaker.into(), text: t.slice(2, t.len()) }
                })
                .collect();
            dialogues.insert(g[0], Dialogue { audio, turns });
        }
        for (i, l) in lines.iter().enumerate() {
            if turn_ids.contains(&i) {
                if let Some(d) = dialogues.remove(&i) {
                    out.push(Item::Dialogue(d));
                }
                continue;
            }
            out.push(Item::Line { text: Text::from_line(l), size: l.size, x: l.x, y: l.y, page: l.page });
        }
    }
    out
}

#[derive(Default, Clone, Copy, PartialEq)]
enum Mode {
    #[default]
    Front,
    Activity,
    Kanji,
    Notes,
    Scripts,
}

#[derive(Default, Clone, Copy, PartialEq)]
enum Slot {
    #[default]
    None,
    CanDo,
    StepTitle,
    Instr,
    Block,
    NoteTitle,
    Point,
    JaPoint,
    Example,
}

#[derive(Default)]
struct Builder {
    mode: Mode,
    slot: Slot,
    activities: Vec<Activity>,
    kanji: Kanji,
    notes: Vec<Note>,
    scripts: Vec<Dialogue>,
    /// Page and baseline of the last choice row, so options on one baseline share a row.
    choice_at: Option<(usize, f32)>,
    /// Lines of `◆` reference notes, keyed by note index, for table parsing.
    ref_lines: Vec<(usize, crate::reference::RLine)>,
}

fn join(dst: &mut String, add: &str) {
    let add = add.trim();
    if add.is_empty() {
        return;
    }
    if dst.ends_with('-') && dst.len() > 1 {
        dst.pop();
    } else if !dst.is_empty() {
        dst.push(' ');
    }
    dst.push_str(add);
}

/// English lines are mostly ASCII letters with no or few CJK or symbol chars.
fn is_en(t: &Text) -> bool {
    let non = t.text.chars().filter(|c| !c.is_ascii()).count();
    let alpha = t.text.chars().filter(|c| c.is_ascii_alphabetic()).count();
    alpha >= 3 && alpha > 3 * non && t.ruby.is_empty()
}

/// Cuts a line at its first audio id (and the `～` or circled digit before it).
fn strip_ids(t: &Text) -> Text {
    let Some(m) = ID.find(&t.text) else { return t.clone() };
    let chars: Vec<char> = t.text.chars().collect();
    let mut cut = ci(&t.text, m.start());
    while cut > 0 && (matches!(chars[cut - 1], ' ' | '～' | '\u{3000}') || ('①'..='⑳').contains(&chars[cut - 1])) {
        cut -= 1;
    }
    t.slice(0, cut)
}

impl Builder {
    fn steps(&mut self) -> Option<&mut Vec<Step>> {
        match self.mode {
            Mode::Activity => self.activities.last_mut().map(|a| &mut a.steps),
            _ => None,
        }
    }

    fn step(&mut self) -> Option<&mut Step> {
        let steps = self.steps()?;
        if steps.is_empty() {
            steps.push(Step::default());
        }
        steps.last_mut()
    }

    fn top_task(&mut self) -> Option<&mut Task> {
        let step = self.step()?;
        if step.tasks.is_empty() {
            step.tasks.push(Task::default());
        }
        step.tasks.last_mut()
    }

    /// The task content belongs to: the latest sub-question, else the latest task.
    fn task(&mut self) -> Option<&mut Task> {
        let top = self.top_task()?;
        if top.subtasks.is_empty() { Some(top) } else { top.subtasks.last_mut() }
    }

    fn item(&mut self, item: Item) {
        match item {
            Item::Line { text, size, x, y, page } => self.line(text, size, x, (page, y)),
            Item::Dialogue(d) => match self.mode {
                // A dialogue with no track id continues the previous one across a page or gap.
                Mode::Scripts => match (&d.audio, self.scripts.last_mut()) {
                    (None, Some(prev)) => prev.turns.extend(d.turns),
                    _ => self.scripts.push(d),
                },
                Mode::Kanji => {
                    // `④ Ａ：…` continues with `Ｂ：…` turns that belong to the same sentence.
                    if let Some(last) = self.kanji.sentences.last_mut() {
                        for turn in d.turns {
                            last.push(&Text { text: format!("\n{}：", turn.speaker), ruby: vec![] });
                            last.push(&turn.text);
                        }
                    }
                }
                Mode::Activity => {
                    if let Some(t) = self.task() {
                        if let Some(id) = &d.audio {
                            if !t.audio.contains(id) {
                                t.audio.push(id.clone());
                            }
                        }
                        t.dialogues.push(d);
                    }
                    self.slot = Slot::None;
                }
                _ => {}
            },
        }
    }

    fn line(&mut self, t: Text, size: f32, x: f32, at: (usize, f32)) {
        let s = t.text.clone();
        let first = s.chars().next().unwrap_or(' ');

        // Section switches.
        if s.contains("聴解スクリプト") {
            self.mode = Mode::Scripts;
            self.slot = Slot::None;
            return;
        }
        if s.contains("漢字のことば") && size > 14.0 {
            self.mode = Mode::Kanji;
            self.slot = Slot::None;
            return;
        }
        if size > 12.0 && ('\u{278a}'..='\u{2793}').contains(&first) {
            self.mode = Mode::Notes;
            let rest = t.slice(1, t.len());
            let note = Note { kind: "grammar".into(), title: rest.clone(), ..Default::default() };
            self.notes.push(note);
            self.slot = if rest.is_empty() { Slot::NoteTitle } else { Slot::Block };
            return;
        }
        if size > 10.0 && first == '◆' {
            self.mode = Mode::Notes;
            self.notes.push(Note { kind: "reference".into(), title: t.slice(1, t.len()), ..Default::default() });
            self.slot = Slot::Block;
            return;
        }
        if size > 10.0 && first == '●' {
            self.mode = Mode::Notes;
            self.notes.push(Note { kind: "column".into(), title: t.slice(1, t.len()), ..Default::default() });
            self.slot = Slot::Block;
            return;
        }
        if matches!(self.mode, Mode::Front | Mode::Activity | Mode::Kanji) && size >= 17.0 {
            if let Some(c) = ACTIVITY.captures(&s) {
                let end = ci(&s, c.get(0).unwrap().end());
                self.activities.push(Activity {
                    number: c[1].parse().unwrap_or(0),
                    title: t.slice(end, t.len()),
                    ..Default::default()
                });
                self.mode = Mode::Activity;
                self.slot = Slot::CanDo;
                return;
            }
        }

        match self.mode {
            Mode::Front | Mode::Scripts => {}
            Mode::Notes if self.notes.last().is_some_and(|n| n.kind == "reference") => {
                let idx = self.notes.len() - 1;
                self.ref_lines.push((idx, crate::reference::RLine { t, size, x, y: at.1 }));
            }
            Mode::Notes => self.note_line(t),
            Mode::Kanji => self.kanji_line(t, size),
            Mode::Activity => self.activity_line(t, size, x, at),
        }
    }

    /// Kanji words sit in the 14pt boxes with readings; sentences start with a circled digit.
    fn kanji_line(&mut self, mut t: Text, size: f32) {
        let first = t.text.chars().next().unwrap_or(' ');
        if (14.0..14.5).contains(&size) {
            merge_ruby(&mut t);
            self.kanji.words.push(t);
        } else if ('①'..='⑳').contains(&first) {
            self.kanji.sentences.push(t.slice(1, t.len()));
        } else if matches!(first, 'Ａ' | 'Ｂ') && t.text.chars().nth(1) == Some('：') {
            if let Some(last) = self.kanji.sentences.last_mut() {
                last.push(&Text { text: "\n".into(), ruby: vec![] });
                last.push(&t);
            }
        }
    }

    fn note_line(&mut self, t: Text) {
        let slot = self.slot;
        let Some(note) = self.notes.last_mut() else { return };
        if slot == Slot::NoteTitle {
            note.title = t;
            self.slot = Slot::Block;
            return;
        }
        let s = t.text.clone();

        // `［例］▶①Ａ：…` opens an example; later `Ｂ：…` lines are its turns, English lines their glosses.
        let c = EXAMPLE.captures(&s).unwrap();
        let marker = s.contains('▶') || s.starts_with('［');
        let speaker = c.get(2).map(|m| match m.as_str() {
            "Ａ" => "A".to_string(),
            "Ｂ" => "B".to_string(),
            _ => "C".to_string(),
        });
        if marker || (speaker.is_some() && slot == Slot::Example) {
            let turn = ExTurn { speaker, ja: t.slice(ci(&s, c.get(3).unwrap().start()), t.len()), en: String::new() };
            match note.examples.last_mut() {
                Some(e) if !marker => e.turns.push(turn),
                _ => note.examples.push(Example { label: c.get(1).map(|m| m.as_str().to_string()), turns: vec![turn] }),
            }
            self.slot = Slot::Example;
            return;
        }
        if slot == Slot::Example && is_en(&t) {
            if let Some(turn) = note.examples.last_mut().and_then(|e| e.turns.last_mut()) {
                join(&mut turn.en, &s);
            }
            return;
        }

        // English bullets can quote Japanese (`such as ～か月`), so also accept lines that are mostly Latin.
        let alpha = s.chars().filter(|c| c.is_ascii_alphabetic()).count();
        let wide = s.chars().filter(|c| !c.is_ascii()).count();
        let latin = is_en(&t) || (alpha >= 8 && alpha > 2 * wide && !s.starts_with('•'));
        if latin || s.starts_with('-') {
            let en = s.trim_start_matches(['-', '•', ' ']);
            if s.starts_with('-') {
                note.points.push(Point { en: en.to_string(), ja: None });
                self.slot = Slot::Point;
            } else if let (Slot::Point, Some(p)) = (slot, note.points.last_mut()) {
                join(&mut p.en, en);
            } else {
                match note.blocks.last_mut() {
                    Some(b) => join(&mut b.en, en),
                    None => note.blocks.push(Block { en: en.to_string(), ..Default::default() }),
                }
            }
            return;
        }
        if s.starts_with('•') {
            note.points_ja.push(t.slice(1, t.len()));
            self.slot = Slot::JaPoint;
            return;
        }
        if let (Slot::JaPoint, Some(p)) = (slot, note.points_ja.last_mut()) {
            p.push(&t);
            return;
        }
        match note.blocks.last_mut() {
            Some(b) if b.en.is_empty() && b.ja.is_some() => b.ja.as_mut().unwrap().push(&t),
            _ => note.blocks.push(Block { ja: Some(t), ..Default::default() }),
        }
        self.slot = Slot::Block;
    }

    fn activity_line(&mut self, t: Text, size: f32, x: f32, at: (usize, f32)) {
        let s = t.text.clone();
        let prev_choice = self.choice_at.take();
        let slot = self.slot;

        // Step heading, such as `1会話を聞きましょう。`.
        let mut chars = s.chars();
        if (11.5..=12.0).contains(&size)
            && x < 100.0
            && chars.next().is_some_and(|c| c.is_ascii_digit())
            && chars.find(|c| *c != ' ').is_some_and(|c| !c.is_ascii())
        {
            let number = s.chars().next().unwrap().to_digit(10).unwrap();
            if let Some(steps) = self.steps() {
                steps.push(Step { number, title: t.slice(1, t.len()), ..Default::default() });
                self.slot = Slot::StepTitle;
            }
            return;
        }

        // Task heading, such as `(2) シャドーイングしましょう。`.
        if (10.5..=11.6).contains(&size) {
            if let Some(c) = TASK.captures(&s) {
                let end = ci(&s, c.get(0).unwrap().end());
                let ids: Vec<String> = ID.find_iter(&s).map(|m| m.as_str().to_string()).collect();
                let ranged = !ids.is_empty() && s.contains('～');
                let instruction = strip_ids(&t.slice(end, t.len()));
                let task = Task {
                    number: c[1].parse().unwrap_or(0),
                    instruction,
                    audio: ids,
                    ranged,
                    ..Default::default()
                };
                // Full-width `（1）` marks a sub-question of the latest `(1)` task.
                if s.starts_with('（') {
                    if let Some(top) = self.top_task() {
                        top.subtasks.push(task);
                        self.slot = Slot::Instr;
                    }
                } else if let Some(step) = self.step() {
                    step.tasks.push(task);
                    self.slot = Slot::Instr;
                }
                return;
            }
        }

        // The can-do statement may wrap, with its id on a line of its own in between.
        if slot == Slot::CanDo {
            if let (Mode::Activity, Some(act)) = (self.mode, self.activities.last_mut()) {
                if let Some(c) = CAN_DO.captures(&s) {
                    act.can_do_id = c[1].to_string();
                    join(&mut act.can_do_en, c.get(2).map_or("", |m| m.as_str()));
                } else if is_en(&t) {
                    join(&mut act.can_do_en, &s);
                } else if act.can_do.is_empty() {
                    act.can_do = t;
                } else {
                    act.can_do.push(&t);
                }
                return;
            }
        }

        // Everything else belongs to the current task.
        let ids: Vec<String> = ID.find_iter(&s).map(|m| m.as_str().to_string()).collect();
        let ranged = !ids.is_empty() && s.contains('～');
        let Some(task) = self.task() else { return };
        for id in ids {
            if !task.audio.contains(&id) {
                task.audio.push(id);
            }
        }
        task.ranged |= ranged;

        let body = strip_ids(&t);
        if body.text.trim_matches(|c: char| c.is_ascii_punctuation() || " ～①②③④⑤⑥⑦⑧⑨".contains(c)).is_empty() {
            return;
        }

        if body.text.contains('｜') {
            let chars: Vec<char> = body.text.chars().collect();
            let mut start = 0;
            for end in (0..=chars.len()).filter(|&i| i == chars.len() || chars[i] == '｜') {
                let (ja, en) = body.slice(start, end).split_en();
                if !ja.is_empty() {
                    task.vocab.push(Vocab { ja, en: en.unwrap_or_default() });
                }
                start = end + 1;
            }
            self.slot = Slot::None;
            return;
        }

        let marks: Vec<_> = CHOICE.captures_iter(&body.text).collect();
        if marks.first().is_some_and(|c| c.get(1).unwrap().start() == 0) {
            let mut row = Vec::new();
            for (i, c) in marks.iter().enumerate() {
                let a = ci(&body.text, c.get(0).unwrap().end());
                let b = marks.get(i + 1).map_or(body.len(), |n| ci(&body.text, n.get(1).unwrap().start()));
                let (ja, en) = body.slice(a, b).split_en();
                row.push(Choice { label: c[1].to_string(), ja, en });
            }
            match task.choices.last_mut() {
                Some(last) if prev_choice.is_some_and(|(p, y)| p == at.0 && (y - at.1).abs() <= 2.0) => last.extend(row),
                _ => task.choices.push(row),
            }
            self.choice_at = Some(at);
            self.slot = Slot::None;
            return;
        }

        if is_en(&body) {
            match slot {
                Slot::Instr => join(&mut task.instruction_en, &body.text),
                Slot::Block => {
                    if let Some(b) = task.body.last_mut() {
                        join(&mut b.en, &body.text);
                    }
                }
                Slot::StepTitle => {
                    if let Some(step) = self.step() {
                        join(&mut step.title_en, &body.text);
                    }
                }
                _ => {}
            }
            return;
        }

        let (ja, en) = body.split_en();
        task.body.push(Block { ja: Some(ja), en: en.unwrap_or_default(), at: Some((at.0, x, at.1)) });
        self.slot = Slot::Block;
    }
}

/// `01-04 ～ 01-06` prints only its ends; fill the tracks between them from the audio list.
fn expand(task: &mut Task, all: &[AudioFile]) {
    task.subtasks.iter_mut().for_each(|t| expand(t, all));
    if !task.ranged {
        return;
    }
    let (Some(lo), Some(hi)) = (task.audio.iter().min().cloned(), task.audio.iter().max().cloned()) else { return };
    task.audio = all.iter().map(|a| a.id.clone()).filter(|id| *id >= lo && *id <= hi).collect();
}

/// Splits a merged cell where a reading runs into the next digit, like `いっかげつ7 か月`.
fn split_cells(t: &Text) -> Vec<Text> {
    let chars: Vec<char> = t.text.chars().collect();
    let kana = |c: char| ('\u{3041}'..='\u{3096}').contains(&c) || c == 'ー';
    let cuts: Vec<usize> = (1..chars.len()).filter(|&i| chars[i].is_ascii_digit() && kana(chars[i - 1])).collect();
    let mut out = Vec::new();
    let mut start = 0;
    for end in cuts.into_iter().chain([chars.len()]) {
        out.push(t.slice(start, end));
        start = end;
    }
    out
}

struct Row {
    blocks: std::ops::Range<usize>,
    cells: Vec<Text>,
    heading: bool,
}

/// Turns runs of body lines laid out in rows (term, reading, term, reading) into tables.
fn group_tables(task: &mut Task) {
    task.subtasks.iter_mut().for_each(group_tables);

    // Blocks on one baseline form a row; a row is a heading when every cell has English.
    let mut rows: Vec<Row> = Vec::new();
    let mut i = 0;
    while i < task.body.len() {
        let Some((page, _, y)) = task.body[i].at else {
            i += 1;
            continue;
        };
        let mut j = i + 1;
        while j < task.body.len() && task.body[j].at.is_some_and(|(p, _, y2)| p == page && (y2 - y).abs() <= 2.0) {
            j += 1;
        }
        let mut blocks: Vec<&Block> = task.body[i..j].iter().filter(|b| b.ja.is_some()).collect();
        blocks.sort_by(|a, b| a.at.unwrap().1.total_cmp(&b.at.unwrap().1));
        let heading = !blocks.is_empty() && blocks.iter().all(|b| !b.en.is_empty());
        let cells = blocks
            .iter()
            .flat_map(|b| if b.en.is_empty() { split_cells(b.ja.as_ref().unwrap()) } else { vec![b.ja.clone().unwrap()] })
            .collect();
        rows.push(Row { blocks: i..j, cells, heading });
        i = j;
    }

    // Readings are kana only, which keeps fill-in-the-blank sentences (`…して　か？`) out.
    let reading = |t: &Text| !t.is_empty() && t.text.chars().all(|c| crate::layout::is_kana(c) || c == '／');
    let is_data = |r: &Row| {
        !r.heading && r.cells.len() >= 2 && r.cells.len() % 2 == 0 && r.cells.chunks(2).all(|p| reading(&p[1]))
    };
    let mut tables: Vec<Table> = Vec::new();
    let mut taken: Vec<std::ops::Range<usize>> = Vec::new();
    let mut k = 0;
    while k < rows.len() {
        if !(rows[k].heading || is_data(&rows[k])) {
            k += 1;
            continue;
        }
        // Extend over contiguous rows; a heading after data rows starts the next table.
        let mut end = k;
        let mut seen_data = false;
        while end < rows.len()
            && (end == k || rows[end].blocks.start == rows[end - 1].blocks.end)
            && (rows[end].heading || is_data(&rows[end]))
            && !(rows[end].heading && seen_data)
        {
            seen_data |= !rows[end].heading;
            end += 1;
        }
        let run = &rows[k..end];
        if run.iter().filter(|r| !r.heading).count() >= 2 {
            let mut table = Table::default();
            for r in run {
                if r.heading {
                    for b in &task.body[r.blocks.clone()] {
                        table.headings.push(Block { ja: b.ja.clone(), en: b.en.clone(), at: None });
                    }
                } else {
                    table.rows.push(
                        r.cells
                            .chunks(2)
                            .map(|p| Entry { term: p[0].clone(), reading: p[1].clone() })
                            .collect(),
                    );
                }
            }
            taken.push(run[0].blocks.start..run[run.len() - 1].blocks.end);
            tables.push(table);
        }
        k = end.max(k + 1);
    }
    if !tables.is_empty() {
        let mut idx = 0;
        task.body.retain(|_| {
            idx += 1;
            !taken.iter().any(|r| r.contains(&(idx - 1)))
        });
        task.tables = tables;
    }
}

/// Joins readings of adjacent kanji (`{がく|学}{せい|生}` becomes one `がくせい` over `学生`).
fn merge_ruby(t: &mut Text) {
    let mut out: Vec<crate::layout::Ruby> = Vec::new();
    for r in t.ruby.drain(..) {
        match out.last_mut() {
            Some(m) if m.end == r.start => {
                m.end = r.end;
                m.reading.push_str(&r.reading);
            }
            _ => out.push(r),
        }
    }
    t.ruby = out;
}

fn classify(t: &Task) -> &'static str {
    let s: String = t.instruction.text.split_whitespace().collect();
    if t.number == 0 {
        return if !t.practice.is_empty() {
            "diagram"
        } else if !t.choices.is_empty() {
            "words"
        } else {
            "intro"
        };
    }
    if s.contains("シャドーイング") {
        "shadow"
    } else if s.contains("聞いて言いましょう") {
        "repeat"
    } else if s.contains("○を書") {
        "mark"
    } else if !t.choices.is_empty() || s.contains("選びましょう") {
        "choose"
    } else if s.starts_with("音声を聞いて") {
        "fill"
    } else if s.contains("形に注目") {
        "notice"
    } else if s.contains("確認して") {
        "vocab"
    } else if s.contains("練習しましょう") || s.contains("ことばをかえて") {
        "practice"
    } else if s.contains("話しましょう") || s.contains("設定") {
        "speak"
    } else if s.contains("聞きましょう") {
        "listen"
    } else {
        ""
    }
}

/// Groups the lines of a speech-bubble diagram into bubbles by column and vertical gap.
fn bubbles(task: &mut Task) {
    if task.number != 0 || task.body.len() < 3 || !task.choices.is_empty() || task.body.iter().any(|b| !b.en.is_empty() || b.ja.is_none() || b.at.is_none()) {
        return;
    }
    let mut groups: Vec<(usize, f32, f32, Vec<Text>)> = Vec::new();
    for b in &task.body {
        let (page, x, y) = b.at.unwrap();
        match groups.iter_mut().find(|g| g.0 == page && (g.1 - x).abs() <= 3.0 && (g.2 - y).abs() <= 32.0) {
            Some(g) => {
                g.2 = y;
                g.3.push(b.ja.clone().unwrap());
            }
            None => groups.push((page, x, y, vec![b.ja.clone().unwrap()])),
        }
    }
    let xs: Vec<f32> = groups.iter().map(|g| g.1).collect();
    let (lo, hi) = (xs.iter().cloned().fold(f32::MAX, f32::min), xs.iter().cloned().fold(f32::MIN, f32::max));
    if groups.len() < 2 || hi - lo < 20.0 {
        return;
    }
    task.practice = groups
        .into_iter()
        .map(|(_, x, _, lines)| Bubble { side: if x < (lo + hi) / 2.0 { "a" } else { "b" }.into(), lines })
        .collect();
    task.body.clear();
}

fn quiz_choose(task: &Task, inherited: &[Choice]) -> Option<Quiz> {
    let rows: Vec<Vec<Choice>> = if task.choices.is_empty() {
        if inherited.is_empty() {
            return None;
        }
        vec![inherited.to_vec()]
    } else {
        task.choices.clone()
    };
    let n = task.audio.len();
    if n == 0 {
        return None;
    }
    // Text printed beside the answer grid, such as the row label `何をしている？`, asks the question.
    let mut prompt: Option<Text> = None;
    for t in task.body.iter().filter_map(|b| b.ja.as_ref()) {
        if t.text.chars().all(|c| !c.is_alphanumeric() && !crate::layout::is_kanji(c) && !crate::layout::is_kana(c)) {
            continue;
        }
        match prompt.as_mut() {
            Some(p) => p.push(t),
            None => prompt = Some(t.clone()),
        }
    }
    let items = task
        .audio
        .iter()
        .enumerate()
        .map(|(i, id)| {
            let questions = if rows.len() >= n && rows.len() % n == 0 {
                let k = rows.len() / n;
                rows[i * k..(i + 1) * k].iter().map(|r| Question { prompt: None, options: r.clone() }).collect()
            } else {
                vec![Question { prompt: None, options: rows.iter().flatten().cloned().collect() }]
            };
            let mut questions: Vec<Question> = questions;
            if let [only] = questions.as_mut_slice() {
                only.prompt = prompt.clone();
            }
            ChooseItem { audio: id.clone(), questions }
        })
        .collect();
    Some(Quiz::Choose { items })
}

/// Finds what the listening scripts say in the blanks between `parts`.
fn find_answers(parts: &[Text], scripts: &[Dialogue]) -> Vec<Vec<Text>> {
    let mut found: Vec<Vec<Text>> = Vec::new();
    for turn in scripts.iter().flat_map(|d| &d.turns) {
        let hay = &turn.text.text;
        let mut at = 0;
        let mut cuts: Vec<(usize, usize)> = Vec::new();
        for (i, p) in parts.iter().enumerate() {
            let rest = &hay[at..];
            let pos = if i > 0 && i == parts.len() - 1 { rest.rfind(&p.text) } else { rest.find(&p.text) };
            let Some(pos) = pos else { break };
            cuts.push((at + pos, at + pos + p.text.len()));
            at += pos + p.text.len();
        }
        if cuts.len() != parts.len() {
            continue;
        }
        let answer: Vec<Text> = cuts.windows(2).map(|w| turn.text.slice(ci(hay, w[0].1), ci(hay, w[1].0))).collect();
        if answer.iter().all(|a| !a.is_empty()) && !found.contains(&answer) {
            found.push(answer);
        }
    }
    found
}

fn quiz_fill(task: &mut Task, scripts: &[Dialogue]) -> Option<Quiz> {
    // The heading's second half (`にことばを書きましょう。`) lands in the body, with the English instruction.
    if task.body.first().and_then(|b| b.ja.as_ref()).is_some_and(|t| t.text.starts_with("にことば")) {
        let b = task.body.remove(0);
        task.instruction.push(&Text { text: "＿＿にことばを書きましょう。".into(), ruby: vec![] });
        task.instruction_en = b.en;
    }
    let mut rows: Vec<Vec<&Block>> = Vec::new();
    for b in &task.body {
        let Some((page, _, y)) = b.at else { continue };
        match rows.last_mut() {
            Some(r) if r[0].at.is_some_and(|(p, _, y0)| p == page && (y0 - y).abs() <= 2.0) => r.push(b),
            _ => rows.push(vec![b]),
        }
    }
    let items: Vec<FillItem> = rows
        .iter()
        .filter(|r| r.len() >= 2 && r.iter().all(|b| b.ja.is_some()))
        .map(|r| {
            let parts: Vec<Text> = r.iter().map(|b| b.ja.clone().unwrap()).collect();
            let answers = find_answers(&parts, scripts);
            FillItem { parts, answers }
        })
        .collect();
    (!items.is_empty()).then_some(Quiz::Fill { items })
}

/// Sets each task's kind, nests bubbles, and builds quizzes. `last` carries the latest options so
/// a task that says "choose from a-i of 1" reuses the options printed earlier in the activity.
fn finish(task: &mut Task, last: &mut Vec<Choice>, scripts: &[Dialogue]) {
    bubbles(task);
    task.kind = classify(task).into();
    task.quiz = match task.kind.as_str() {
        "choose" => quiz_choose(task, last),
        "fill" => quiz_fill(task, scripts),
        _ => None,
    };
    if !task.choices.is_empty() {
        *last = task.choices.iter().flatten().cloned().collect();
    }
    for sub in &mut task.subtasks {
        finish(sub, last, scripts);
    }
}

pub fn parse(number: u32, topic_en: &str, title_en: &str, audio: Vec<AudioFile>, pages: &[Vec<Line>]) -> Lesson {
    // The running header on page 2 repeats the Japanese topic and lesson title.
    let header = |f: &dyn Fn(&Line) -> Option<String>| pages.get(1).and_then(|p| p.iter().find_map(f)).unwrap_or_default();
    let topic_ja = header(&|l| l.text.strip_prefix("▶トピック").map(|r| r.trim().to_string()));
    // The title can wrap: a large first part (`3課冬`) and a small second part above it.
    let title_ja = pages.get(1).map_or_else(String::new, |p| {
        let big = p.iter().find(|l| l.size > 20.0 && l.y > 780.0);
        let head = big.map_or("", |l| l.text.trim_start_matches(|c: char| c.is_ascii_digit()).trim_start_matches('課'));
        let tail = p
            .iter()
            .filter(|l| l.size < 10.0 && l.y > 785.0 && l.y < 800.0 && !l.text.starts_with('▶'))
            .map(|l| l.text.trim_start_matches('第'))
            .collect::<String>();
        // The PDF pads the title with spaces between Japanese characters.
        format!("{head}{tail}").replace([' ', '\u{3000}', '\t'], "").replace('\u{a4}', "")
    });

    let mut b = Builder::default();
    for item in items(pages) {
        b.item(item);
    }
    for act in &mut b.activities {
        let mut last = Vec::new();
        for task in act.steps.iter_mut().flat_map(|s| &mut s.tasks) {
            expand(task, &audio);
            group_tables(task);
            finish(task, &mut last, &b.scripts);
        }
    }
    for idx in 0..b.notes.len() {
        let lines: Vec<_> = b.ref_lines.iter().filter(|(i, _)| *i == idx).map(|(_, l)| crate::reference::RLine { t: l.t.clone(), ..*l }).collect();
        b.notes[idx].sections = crate::reference::sections(&lines);
    }
    // Each English explanation is followed by its Japanese bullet in the same order.
    for note in &mut b.notes {
        if note.points.len() == note.points_ja.len() {
            for (p, ja) in note.points.iter_mut().zip(note.points_ja.drain(..)) {
                p.ja = Some(ja);
            }
        }
    }
    Lesson {
        number,
        topic: Bilingual { ja: topic_ja, en: topic_en.into() },
        title: Bilingual { ja: title_ja, en: title_en.into() },
        audio,
        activities: b.activities,
        scripts: b.scripts,
        kanji: b.kanji,
        notes: b.notes,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn text(s: &str) -> Text {
        Text { text: s.into(), ruby: vec![] }
    }

    #[test]
    fn fill_answers_come_from_the_text_between_the_parts() {
        let script = Dialogue {
            audio: None,
            turns: vec![
                Turn { speaker: "B".into(), text: text("私は、先月、来ました。") },
                Turn { speaker: "A".into(), text: text("毎日、大変です。でも、楽しいです。") },
            ],
        };
        let one = find_answers(&[text("先月、"), text("。")], std::slice::from_ref(&script));
        assert_eq!(one, vec![vec![text("来ました")]]);
        let two = find_answers(&[text("毎日、"), text("です。でも、"), text("です。")], &[script]);
        assert_eq!(two, vec![vec![text("大変"), text("楽しい")]]);
    }
}
