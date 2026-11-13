//! Turns the lines of a `◆` reference section (grammar tables such as the テ-form rules) into structure.

use crate::model::*;

#[derive(Clone)]
pub struct RLine {
    pub t: Text,
    pub size: f32,
    pub x: f32,
    pub y: f32,
}

fn plain(t: &Text) -> String {
    t.text.chars().filter(|c| !c.is_whitespace()).collect()
}

fn label_number(t: &Text) -> Option<u32> {
    let mut c = t.text.chars().filter(|c| !c.is_whitespace());
    let n = c.next()?.to_digit(10)?;
    (c.next() == Some('グ')).then_some(n)
}

/// Splits `English text日本語` where Japanese starts after a run of Latin text.
fn split_en(t: &Text) -> (String, Option<Text>) {
    let chars: Vec<char> = t.text.chars().collect();
    let mut alpha = 0;
    for (i, c) in chars.iter().enumerate() {
        if c.is_ascii_alphabetic() {
            alpha += 1;
        } else if !c.is_ascii() && alpha >= 6 {
            return (t.slice(0, i).text, Some(t.slice(i, chars.len())));
        }
    }
    if alpha >= 3 && chars.iter().all(|c| c.is_ascii() || matches!(c, '＊' | '’')) {
        (t.text.trim().to_string(), None)
    } else {
        (String::new(), Some(t.clone()))
    }
}

fn join(dst: &mut String, add: &str) {
    let add = add.trim();
    if dst.ends_with('-') && dst.len() > 1 {
        dst.pop();
    } else if !dst.is_empty() {
        dst.push(' ');
    }
    dst.push_str(add);
}

/// An English sentence that quotes a few Japanese words, such as `the テ-form, first you need…`.
fn is_latin_with_quotes(t: &Text) -> bool {
    let alpha = t.text.chars().filter(|c| c.is_ascii_alphabetic()).count();
    let mut run = 0;
    let mut longest = 0;
    for c in t.text.chars() {
        run = if c.is_ascii() { 0 } else { run + 1 };
        longest = longest.max(run);
    }
    alpha >= 8 && longest < 4 && t.text.starts_with(|c: char| c.is_ascii_alphabetic())
}

fn bilingual(lines: &[&RLine]) -> Option<Block> {
    let mut b = Block::default();
    for l in lines {
        let (en, ja) = if is_latin_with_quotes(&l.t) { (l.t.text.clone(), None) } else { split_en(&l.t) };
        join(&mut b.en, &en);
        if let Some(ja) = ja.filter(|j| !j.is_empty()) {
            match b.ja.as_mut() {
                Some(t) => t.push(&ja),
                None => b.ja = Some(ja),
            }
        }
    }
    b.en = b.en.trim().to_string();
    (b.ja.is_some() || !b.en.is_empty()).then_some(b)
}

/// Cuts a trailing `(hatarak＋u）` annotation off `t`.
fn strip_note(t: Text) -> (Text, Option<String>) {
    let chars: Vec<char> = t.text.chars().collect();
    let open = chars.iter().rposition(|c| matches!(c, '(' | '（'));
    match (open, chars.last()) {
        (Some(o), Some(')' | '）')) if o > 0 => {
            let note = t.slice(o + 1, chars.len() - 1).text;
            (t.slice(0, o), Some(note))
        }
        _ => (t, None),
    }
}

fn pair(t: &Text, note: Option<String>) -> Option<Pair> {
    let a = t.text.chars().position(|c| c == '→')?;
    let (from, from_note) = strip_note(t.slice(0, a));
    let (to, to_note) = strip_note(t.slice(a + 1, t.len()));
    Some(Pair { from, to, from_note, to_note, note })
}

/// `働く → 働いて ［exceptional case 例外］行く → 行って` holds two pairs; the bracket annotates the second.
fn pairs(t: &Text) -> Vec<Pair> {
    let chars: Vec<char> = t.text.chars().collect();
    match (chars.iter().position(|c| *c == '［'), chars.iter().position(|c| *c == '］')) {
        (Some(o), Some(c)) if o < c => {
            let note = t.slice(o + 1, c).text;
            pair(&t.slice(0, o), None).into_iter().chain(pair(&t.slice(c + 1, chars.len()), Some(note))).collect()
        }
        _ => pair(t, None).into_iter().collect(),
    }
}

/// Picks contiguous row groups so each group's vertical centre matches its label.
fn partition(ys: &[f32], labels: &[f32]) -> Vec<usize> {
    fn best(ys: &[f32], labels: &[f32]) -> (f32, Vec<usize>) {
        if labels.len() == 1 {
            let mid = (ys[0] + ys[ys.len() - 1]) / 2.0;
            return ((mid - labels[0]).abs(), vec![ys.len()]);
        }
        let mut out = (f32::MAX, vec![]);
        for s in 1..=ys.len() - (labels.len() - 1) {
            let mid = (ys[0] + ys[s - 1]) / 2.0;
            let (c, mut rest) = best(&ys[s..], &labels[1..]);
            let cost = c + (mid - labels[0]).abs();
            if cost < out.0 {
                rest.insert(0, s);
                out = (cost, rest);
            }
        }
        out
    }
    if ys.len() < labels.len() || labels.is_empty() {
        return vec![];
    }
    best(ys, labels).1
}

fn groups(body: &[&RLine]) -> Vec<VerbGroup> {
    let mut labels: Vec<(f32, u32)> = body.iter().filter(|l| l.x < 150.0).filter_map(|l| label_number(&l.t).map(|n| (l.y, n))).collect();
    labels.sort_by(|a, b| b.0.total_cmp(&a.0));
    let mut out: Vec<VerbGroup> = labels.iter().map(|(_, n)| VerbGroup { group: *n, ..Default::default() }).collect();
    let mut fragments: Vec<Vec<Text>> = vec![vec![]; out.len()];
    for l in body {
        // A line belongs to the first group whose next label starts below it (10pt of slack).
        if labels.is_empty() {
            continue;
        }
        let k = (0..labels.len()).find(|&k| k + 1 == labels.len() || l.y >= labels[k + 1].0 + 10.0).unwrap();
        let g = &mut out[k];
        if l.x < 150.0 {
            if label_number(&l.t).is_some() || l.t.text.starts_with(['（', '(']) {
                continue;
            }
            let (en, ja) = split_en(&l.t);
            join(&mut g.stem_en, &en);
            match (en.is_empty(), ja) {
                (true, Some(ja)) => g.stem_ja.push(&ja),
                (false, Some(ja)) => g.rule_ja.push(&ja),
                _ => {}
            }
        } else if l.x < 250.0 {
            let (en, ja) = split_en(&l.t);
            join(&mut g.rule_en, &en);
            match (en.is_empty(), ja) {
                (true, Some(ja)) => g.rule_ja.push(&ja),
                (false, Some(ja)) => fragments[k].push(ja),
                _ => {}
            }
        } else if l.t.text.starts_with('→') && !fragments[k].is_empty() {
            fragments[k].last_mut().unwrap().push(&l.t);
        } else {
            fragments[k].push(l.t.clone());
        }
    }
    for (g, frags) in out.iter_mut().zip(fragments) {
        g.stem_en = g.stem_en.trim().to_string();
        g.rule_en = g.rule_en.trim().to_string();
        g.examples = frags.iter().flat_map(pairs).collect();
    }
    out
}

/// A short table cell: 8.5pt, a hyphen form such as `- って`, or a bare irregular verb.
fn is_cell(l: &RLine) -> bool {
    l.size < 9.0 && !l.t.text.contains('→') && (l.t.text.starts_with('-') || matches!(plain(&l.t).as_str(), "する" | "来る"))
}

/// A conjugated ending: `-って`, or plain kana such as `して` and `来た`.
fn is_form(l: &RLine) -> bool {
    let p = plain(&l.t);
    l.size < 9.5 && !p.is_empty() && (p.starts_with('-') || p.chars().all(|c| crate::layout::is_kana(c) || c == '来'))
}

fn rules(body: &[&RLine]) -> Vec<ConjRule> {
    let mut numbers: Vec<(f32, u32)> = body.iter().filter(|l| l.x < 150.0).filter_map(|l| label_number(&l.t).map(|n| (l.y, n))).collect();
    numbers.sort_by(|a, b| b.0.total_cmp(&a.0));
    let cells: Vec<&&RLine> = body.iter().filter(|l| is_cell(l)).collect();
    let Some(first_x) = cells.iter().map(|l| l.x).reduce(f32::min) else { return vec![] };
    let mut endings: Vec<&&RLine> = cells.iter().filter(|l| l.x < first_x + 6.0).copied().collect();
    endings.sort_by(|a, b| b.y.total_cmp(&a.y));
    let labels: Vec<f32> = numbers.iter().map(|n| n.0).collect();
    let sizes = partition(&endings.iter().map(|l| l.y).collect::<Vec<_>>(), &labels);

    let mut out: Vec<ConjRule> = Vec::new();
    let mut start = 0;
    for (size, (_, n)) in sizes.iter().zip(&numbers) {
        for e in &endings[start..start + size] {
            let mut forms: Vec<&RLine> = body
                .iter()
                .filter(|c| c.x > first_x + 20.0 && c.x < first_x + 160.0 && (c.y - e.y).abs() <= 4.0 && is_form(c))
                .copied()
                .collect();
            forms.sort_by(|a, b| a.x.total_cmp(&b.x));
            out.push(ConjRule { group: *n, ending: plain(&e.t), forms: forms.iter().map(|f| plain(&f.t)).collect(), examples: vec![] });
        }
        start += size;
    }
    // A form cell is printed once for the rows it spans, so rows without one borrow from the nearest
    // row of the same group that has one.
    let ys: Vec<f32> = endings.iter().map(|e| e.y).collect();
    let have: Vec<Vec<String>> = out.iter().map(|r| r.forms.clone()).collect();
    for i in 0..out.len() {
        if !have[i].is_empty() {
            continue;
        }
        let near = (0..out.len()).filter(|&j| !have[j].is_empty() && out[j].group == out[i].group).min_by(|&a, &b| (ys[a] - ys[i]).abs().total_cmp(&(ys[b] - ys[i]).abs()));
        if let Some(j) = near {
            out[i].forms = have[j].clone();
        }
    }
    // Each example belongs to the ending its dictionary form ends with; the closest row wins.
    for l in body.iter().filter(|l| l.x > first_x + 20.0 && l.t.text.contains('→') && l.size < 9.5) {
        for p in pairs(&l.t) {
            let from = plain(&p.from);
            let fits = |r: &ConjRule| match r.ending.strip_prefix('-') {
                Some(e) => from.ends_with(e),
                None => r.ending == from,
            };
            let ys = |i: usize| endings_y(&endings, &sizes, i);
            let best = (0..out.len()).filter(|&i| fits(&out[i])).min_by(|&a, &b| (ys(a) - l.y).abs().total_cmp(&(ys(b) - l.y).abs()));
            if let Some(i) = best {
                out[i].examples.push(p);
            }
        }
    }
    out
}

fn endings_y(endings: &[&&RLine], _sizes: &[usize], i: usize) -> f32 {
    endings[i].y
}

fn is_latin(t: &Text) -> bool {
    let alpha = t.text.chars().filter(|c| c.is_ascii_alphabetic()).count();
    alpha >= 4 && t.text.chars().all(|c| c.is_ascii() || matches!(c, '’' | '“' | '”'))
}

/// A table of sentence patterns (`V-たんです`) with example phrases and their English, such as
/// the box that opens the ～んです reference. Returns the rows and which lines they used.
fn patterns(ls: &[&RLine]) -> Option<(Vec<PatternRow>, Vec<usize>)> {
    let starts = |t: &Text| t.text.chars().next().is_some_and(|c| matches!(c, 'N' | 'S' | 'V' | 'ナ' | 'イ'));
    let cand = |l: &RLine| (8.0..9.0).contains(&l.size) && !is_latin(&l.t);
    let min_x = ls.iter().filter(|l| cand(l) && starts(&l.t) && !l.t.text.contains('→')).map(|l| l.x).reduce(f32::min)?;
    let pats: Vec<usize> = (0..ls.len()).filter(|&i| cand(ls[i]) && starts(&ls[i].t) && ls[i].x < min_x + 6.0).collect();
    if pats.len() < 3 {
        return None;
    }
    let mut rows: Vec<PatternRow> = pats.iter().map(|&i| PatternRow { pattern: ls[i].t.clone(), examples: vec![] }).collect();
    let mut used = pats.clone();
    for (i, l) in ls.iter().enumerate() {
        if !cand(l) || l.x < min_x + 30.0 || used.contains(&i) {
            continue;
        }
        let Some(k) = (0..pats.len()).filter(|&k| (ls[pats[k]].y - l.y).abs() <= 12.0).min_by(|&a, &b| (ls[pats[a]].y - l.y).abs().total_cmp(&(ls[pats[b]].y - l.y).abs())) else { continue };
        // The English gloss sits right under its phrase, in the same column, in a smaller size.
        let gloss = (0..ls.len()).find(|&j| ls[j].size < 8.0 && is_latin(&ls[j].t) && (ls[j].x - l.x).abs() < 6.0 && l.y - ls[j].y > 0.0 && l.y - ls[j].y < 14.0);
        if let Some(j) = gloss {
            used.push(j);
        }
        used.push(i);
        rows[k].examples.push(Block { ja: Some(l.t.clone()), en: gloss.map(|j| ls[j].t.text.trim().to_string()).unwrap_or_default(), at: None });
    }
    Some((rows, used))
}

/// A plain table (`入る contain | 入れる put in`): 8.5pt lines on one baseline are the cells of a row.
fn grid(ls: &[&RLine]) -> Option<(Vec<Vec<Block>>, Vec<usize>)> {
    let mut idx: Vec<usize> = (0..ls.len()).filter(|&i| (8.0..8.8).contains(&ls[i].size)).collect();
    idx.sort_by(|&a, &b| ls[b].y.total_cmp(&ls[a].y).then(ls[a].x.total_cmp(&ls[b].x)));
    let mut rows: Vec<Vec<usize>> = Vec::new();
    for i in idx {
        match rows.last_mut() {
            Some(r) if (ls[r[0]].y - ls[i].y).abs() <= 4.0 => r.push(i),
            _ => rows.push(vec![i]),
        }
    }
    // Keep the longest run of consecutive rows that have two or more cells.
    let mut best: Vec<&Vec<usize>> = Vec::new();
    let mut cur: Vec<&Vec<usize>> = Vec::new();
    for r in &rows {
        if r.len() >= 2 && cur.last().is_none_or(|p| ls[p[0]].y - ls[r[0]].y < 40.0) {
            cur.push(r);
        } else {
            if cur.len() > best.len() {
                best = cur.clone();
            }
            cur = if r.len() >= 2 { vec![r] } else { vec![] };
        }
    }
    if cur.len() > best.len() {
        best = cur;
    }
    if best.len() < 3 {
        return None;
    }
    let mut used = Vec::new();
    let table = best
        .iter()
        .map(|r| {
            used.extend(r.iter().copied());
            r.iter()
                .map(|&i| {
                    let (ja, en) = ls[i].t.split_en();
                    Block { ja: Some(ja), en: en.unwrap_or_default(), at: None }
                })
                .collect()
        })
        .collect();
    Some((table, used))
}

pub fn sections(lines: &[RLine]) -> Vec<RefSection> {
    let is_heading = |l: &RLine| l.x < 95.0 && (8.0..9.0).contains(&l.size) && l.t.text.chars().next().is_some_and(|c| c.is_ascii_digit()) && l.t.text.chars().nth(1) == Some('.');
    let mut chunks: Vec<(Option<&RLine>, Vec<&RLine>)> = vec![(None, vec![])];
    for l in lines {
        if is_heading(l) {
            chunks.push((Some(l), vec![]));
        } else {
            chunks.last_mut().unwrap().1.push(l);
        }
    }
    let header = ["マス-form", "conjugation rules", "exampledictionary-form", "dictionary-form", "example", "テ-form"];
    chunks
        .into_iter()
        .filter(|(h, ls)| h.is_some() || !ls.is_empty())
        .map(|(h, ls)| {
            let top = ls.iter().filter(|l| header.contains(&plain(&l.t).as_str())).map(|l| l.y).fold(f32::MIN, f32::max);
            let has_table = top > f32::MIN;
            let foot = ls.iter().position(|l| plain(&l.t).starts_with('＊') && l.y < top);
            let (intro, rest): (Vec<&RLine>, Vec<&RLine>) = ls.iter().partition(|l| !has_table || l.y > top + 3.0);
            let (body, footnote): (Vec<&RLine>, Vec<&RLine>) = match foot {
                Some(f) => {
                    let fy = ls[f].y;
                    rest.into_iter().filter(|l| l.y < top - 14.0).partition(|l| l.y > fy + 3.0)
                }
                None => (rest.into_iter().filter(|l| l.y < top - 14.0).collect(), vec![]),
            };
            let by_conjugation = ls.iter().any(|l| plain(&l.t) == "conjugationrules");
            let rules = if has_table && !by_conjugation { rules(&body) } else { vec![] };
            let mut table: Vec<Vec<Block>> = vec![];
            let (patterns, intro) = match (rules.is_empty() && !by_conjugation, patterns(&ls)) {
                (true, Some((rows, used))) => {
                    let header_word = |l: &RLine| {
                        let t = &l.t.text;
                        let cell = (t.contains("［例］") && t.chars().count() <= 16) || (["名詞", "形容詞", "動詞", "文型"].iter().any(|w| t.contains(w)) && t.chars().count() <= 14) || (t.contains("adjective") && t.chars().count() <= 30);
                        let cjk = t.chars().any(|c| matches!(c, '\u{3040}'..='\u{9fff}'));
                        cell || (!cjk && t.split_whitespace().count() <= 2 && t.chars().any(|c| c.is_ascii_alphabetic()) && !t.contains('.'))
                    };
                    let keep = intro.into_iter().filter(|l| !ls.iter().position(|x| std::ptr::eq(*x, *l)).is_some_and(|i| used.contains(&i)) && !header_word(l));
                    (rows, keep.collect())
                }
                (true, None) if !by_conjugation => match grid(&ls) {
                    Some((rows, used)) => {
                        table = rows;
                        (vec![], intro.into_iter().filter(|l| !ls.iter().position(|x| std::ptr::eq(*x, *l)).is_some_and(|i| used.contains(&i))).collect())
                    }
                    None => (vec![], intro),
                },
                _ => (vec![], intro),
            };
            RefSection {
                title: h.map(|h| h.t.clone()).unwrap_or_default(),
                intro: bilingual(&intro),
                groups: if has_table && by_conjugation { groups(&body) } else { vec![] },
                rules,
                patterns,
                grid: table,
                footnote: bilingual(&footnote),
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn exceptional_pair_follows_its_bracket() {
        let t = Text { text: "働く→働いて［exceptional case 例外］行く→行って".into(), ruby: vec![] };
        let p = pairs(&t);
        assert_eq!((p[0].from.text.as_str(), p[0].note.as_deref()), ("働く", None));
        assert_eq!((p[1].from.text.as_str(), p[1].to.text.as_str(), p[1].note.as_deref()), ("行く", "行って", Some("exceptional case 例外")));
    }

    #[test]
    fn romaji_annotation_moves_to_a_note() {
        let t = Text { text: "働く(hatarak＋u）→働きます(hatarak＋i ＋ます）".into(), ruby: vec![] };
        let p = &pairs(&t)[0];
        assert_eq!((p.from.text.as_str(), p.from_note.as_deref()), ("働く", Some("hatarak＋u")));
        assert_eq!(p.to_note.as_deref(), Some("hatarak＋i ＋ます"));
    }
}
