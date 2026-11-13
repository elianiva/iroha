//! Finds PDF text that never reached lesson.json, by comparing 2-character runs.

use crate::layout::Line;
use serde_json::Value;
use std::collections::HashSet;

/// Runs of letters and digits of one script. Spaces, punctuation and furigana gaps split runs, and a
/// switch between Latin and Japanese does too, so `生活 life` is two runs. Track ids and answer-key
/// style labels (`a.`, `Ａ：`, `①`) are dropped: they are metadata, not content.
fn runs(s: &str) -> Vec<Vec<char>> {
    let chars: Vec<char> = s.chars().collect();
    let mut out: Vec<Vec<char>> = vec![vec![]];
    let mut i = 0;
    while i < chars.len() {
        let c = chars[i];
        // Track id such as `01-04`.
        if c.is_ascii_digit() && chars.get(i + 1).is_some_and(|d| d.is_ascii_digit()) && chars.get(i + 2) == Some(&'-') && chars.get(i + 3).is_some_and(|d| d.is_ascii_digit()) {
            i += 5;
            out.push(vec![]);
            continue;
        }
        // Option label such as `a.`, `ア.`, `Ａ：`.
        let label = c.is_ascii_lowercase() || matches!(c, 'Ａ'..='Ｃ' | 'ア'..='ク');
        let after = chars[i + 1..].iter().position(|x| *x != ' ').map(|p| chars[i + 1 + p]);
        if label && matches!(after, Some('.' | '：' | ':')) && out.last().is_none_or(|r| r.is_empty()) {
            let skip = chars[i + 1..].iter().position(|x| matches!(x, '.' | '：' | ':')).unwrap_or(0);
            i += skip + 2;
            continue;
        }
        let latin = c.is_ascii_alphanumeric();
        if !c.is_alphanumeric() || out.last().is_some_and(|r| r.last().is_some_and(|p| p.is_ascii_alphanumeric() != latin)) {
            out.push(vec![]);
        }
        if c.is_alphanumeric() {
            out.last_mut().unwrap().extend(c.to_lowercase());
        }
        i += 1;
    }
    out.retain(|r| r.len() >= 2);
    out
}

fn grams(run: &[char], set: &mut HashSet<[char; 2]>) {
    for w in run.windows(2) {
        set.insert([w[0], w[1]]);
    }
}

/// Text fields only: file names and URLs would make unrelated text look covered. `reading` is skipped
/// when it is a string (furigana) but kept when it is a text (table readings).
fn collect(v: &Value, set: &mut HashSet<[char; 2]>) {
    match v {
        Value::String(s) => runs(s).iter().for_each(|r| grams(r, set)),
        Value::Array(a) => a.iter().for_each(|x| collect(x, set)),
        Value::Object(o) => {
            for (k, x) in o {
                let skip = matches!(k.as_str(), "file" | "url" | "image" | "audio" | "id" | "kind" | "type" | "side" | "speaker" | "label") || (k == "reading" && x.is_string());
                if !skip {
                    collect(x, set);
                }
            }
        }
        _ => {}
    }
}

pub fn report(json: &Value, pages: &[Vec<Line>]) {
    let mut have = HashSet::new();
    collect(json, &mut have);
    let (mut total, mut missing) = (0, 0);
    for page in pages {
        for l in page {
            // Running header and footer repeat on every page after the cover.
            if l.page > 1 && (l.y > 770.0 || l.y < 30.0) || l.page == 1 && l.y < 30.0 {
                continue;
            }
            let rs = runs(&l.text);
            let w: Vec<[char; 2]> = rs.iter().flat_map(|r| r.windows(2).map(|w| [w[0], w[1]])).collect();
            if w.is_empty() {
                continue;
            }
            total += 1;
            let hit = w.iter().filter(|g| have.contains(*g)).count();
            if (hit as f32) < 0.8 * w.len() as f32 {
                missing += 1;
                println!("p{} y={:.0} x={:.0} {:>3}% {}", l.page, l.y, l.x, 100 * hit / w.len(), l.text.chars().take(90).collect::<String>());
            }
        }
    }
    println!("-- {missing} of {total} lines missing");
}
