//! Turns raw PDF spans into reading lines with furigana attached to the kanji they sit above.

use pdf_oxide::PdfDocument;
use serde::Serialize;

/// Furigana reading for the characters `start..end` (char indices) of a line's text.
#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct Ruby {
    pub start: usize,
    pub end: usize,
    pub reading: String,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct Line {
    pub page: usize,
    pub x: f32,
    pub y: f32,
    pub size: f32,
    pub text: String,
    pub ruby: Vec<Ruby>,
}

#[derive(Debug, Clone)]
struct Piece {
    text: String,
    x: f32,
    y: f32,
    w: f32,
    size: f32,
    char_widths: Vec<f32>,
}

impl Piece {
    fn right(&self) -> f32 {
        self.x + self.w
    }

    /// Horizontal centre of each char, from the glyph widths when they match the text.
    fn char_centres(&self) -> Vec<f32> {
        let n = self.text.chars().count();
        let sum: f32 = self.char_widths.iter().sum();
        let widths: Vec<f32> = if self.char_widths.len() == n && sum > 0.0 {
            self.char_widths.iter().map(|w| w * self.w / sum).collect()
        } else {
            vec![self.w / n.max(1) as f32; n]
        };
        let mut at = self.x;
        widths
            .into_iter()
            .map(|w| {
                let c = at + w / 2.0;
                at += w;
                c
            })
            .collect()
    }
}

pub fn is_kana(c: char) -> bool {
    matches!(c, '\u{3040}'..='\u{30ff}' | 'ー' | ' ' | '\u{3000}')
}

pub fn is_kanji(c: char) -> bool {
    matches!(c, '\u{4e00}'..='\u{9fff}' | '々')
}

pub fn read_pages(path: &str) -> anyhow::Result<Vec<Vec<Line>>> {
    let doc = PdfDocument::open(path)?;
    let mut pages = Vec::new();
    for p in 0..doc.page_count()? {
        let pieces = doc
            .extract_spans(p)?
            .into_iter()
            .filter(|s| !s.text.trim().is_empty())
            .map(|s| Piece {
                text: s.text,
                x: s.bbox.x,
                y: s.bbox.y,
                w: s.bbox.width,
                size: s.font_size,
                char_widths: s.char_widths,
            })
            .collect();
        pages.push(build_lines(p + 1, pieces));
    }
    Ok(pages)
}

fn build_lines(page: usize, pieces: Vec<Piece>) -> Vec<Line> {
    let (ruby, base): (Vec<_>, Vec<_>) = pieces.iter().cloned().partition(|r| is_ruby(r, &pieces));

    // Group base pieces into lines: same baseline (±2pt), split on wide horizontal gaps.
    let mut sorted = base;
    sorted.sort_by(|a, b| b.y.total_cmp(&a.y).then(a.x.total_cmp(&b.x)));
    let mut rows: Vec<Vec<Piece>> = Vec::new();
    for p in sorted {
        match rows.iter_mut().find(|r| (r[0].y - p.y).abs() <= 2.0) {
            Some(row) => row.push(p),
            None => rows.push(vec![p]),
        }
    }
    let mut groups: Vec<Vec<Piece>> = Vec::new();
    for mut row in rows {
        row.sort_by(|a, b| a.x.total_cmp(&b.x));
        let mut current: Vec<Piece> = Vec::new();
        for p in row {
            if let Some(last) = current.last() {
                if p.x - last.right() > 2.5 * last.size.max(p.size) {
                    groups.push(std::mem::take(&mut current));
                }
            }
            current.push(p);
        }
        groups.push(current);
    }

    let mut lines: Vec<Line> = groups.into_iter().map(|g| attach(page, g, &ruby)).collect();
    lines.sort_by(|a, b| b.y.total_cmp(&a.y).then(a.x.total_cmp(&b.x)));
    lines
}

/// A ruby piece is all kana, much smaller than a kanji piece that sits just below it.
fn is_ruby(r: &Piece, all: &[Piece]) -> bool {
    r.text.chars().all(is_kana)
        && all.iter().any(|b| {
            b.size >= r.size * 1.35
                && b.text.chars().any(is_kanji)
                && b.y < r.y
                && r.y - b.y < b.size * 1.3
                && r.x < b.right()
                && r.right() > b.x
        })
}

fn attach(page: usize, group: Vec<Piece>, ruby: &[Piece]) -> Line {
    let mut text = String::new();
    let mut centres = Vec::new();
    let mut size = 0f32;
    for p in &group {
        text.push_str(&p.text);
        centres.extend(p.char_centres());
        size = size.max(p.size);
    }
    let chars: Vec<char> = text.chars().collect();
    let x = group[0].x;
    let y = group[0].y;
    let x_end = group.last().map(Piece::right).unwrap_or(x);

    let mut found: Vec<Ruby> = Vec::new();
    for r in ruby {
        if r.y <= y || r.y - y > size * 1.3 || r.right() < x || r.x > x_end {
            continue;
        }
        let rc = r.x + r.w / 2.0;
        // Nearest kanji, then widen to the adjacent kanji the reading spans.
        let Some(seed) = (0..chars.len())
            .filter(|&i| is_kanji(chars[i]))
            .min_by(|&a, &b| (centres[a] - rc).abs().total_cmp(&(centres[b] - rc).abs()))
        else {
            continue;
        };
        let (mut s, mut e) = (seed, seed + 1);
        let covers = |i: usize| centres[i] >= r.x - 1.0 && centres[i] <= r.right() + 1.0;
        while s > 0 && is_kanji(chars[s - 1]) && covers(s - 1) {
            s -= 1;
        }
        while e < chars.len() && is_kanji(chars[e]) && covers(e) {
            e += 1;
        }
        found.push(Ruby {
            start: s,
            end: e,
            reading: r.text.replace([' ', '\u{3000}'], ""),
        });
    }
    // Several ruby pieces can belong to one word; merge overlapping ranges in reading order.
    found.sort_by_key(|r| (r.start, r.end));
    let mut merged: Vec<Ruby> = Vec::new();
    for r in found {
        match merged.last_mut() {
            Some(m) if r.start < m.end => {
                if r.end > m.end {
                    m.end = r.end;
                }
                m.reading.push_str(&r.reading);
            }
            _ => merged.push(r),
        }
    }
    Line { page, x, y, size, text, ruby: merged }
}
