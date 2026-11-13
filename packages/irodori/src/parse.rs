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
        let lines: Vec<&Line> = page
            .iter()
            .filter(|l| l.y < 770.0 && l.y > 30.0 && !l.text.contains("Japan Foundation"))
            .collect();
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
}

#[derive(Default)]
struct Builder {
    mode: Mode,
    slot: Slot,
    activities: Vec<Activity>,
    kanji: Vec<Step>,
    notes: Vec<Note>,
    scripts: Vec<Dialogue>,
    /// Page and baseline of the last choice row, so options on one baseline share a row.
    choice_at: Option<(usize, f32)>,
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
            Mode::Kanji => Some(&mut self.kanji),
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
                Mode::Activity | Mode::Kanji => {
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
            Mode::Notes => self.note_line(t),
            Mode::Activity | Mode::Kanji => self.activity_line(t, size, x, at),
        }
    }

    fn note_line(&mut self, t: Text) {
        let Some(note) = self.notes.last_mut() else { return };
        if self.slot == Slot::NoteTitle {
            note.title = t;
            self.slot = Slot::Block;
            return;
        }
        let bullet = t.text.starts_with(['-', '•']);
        if is_en(&t) {
            let en = t.text.trim_start_matches(['-', '•', ' ']);
            match note.blocks.last_mut() {
                Some(b) if !bullet => join(&mut b.en, en),
                _ => note.blocks.push(Block { en: en.to_string(), ..Default::default() }),
            }
        } else {
            let t = if bullet { t.slice(1, t.len()) } else { t };
            match note.blocks.last_mut() {
                Some(b) if !bullet && b.en.is_empty() && b.ja.is_some() => b.ja.as_mut().unwrap().push(&t),
                _ => note.blocks.push(Block { ja: Some(t), ..Default::default() }),
            }
        }
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
    for task in b.activities.iter_mut().flat_map(|a| &mut a.steps).chain(&mut b.kanji).flat_map(|s| &mut s.tasks) {
        expand(task, &audio);
        group_tables(task);
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
