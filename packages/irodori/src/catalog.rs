//! Builds `index.json`, the catalog the web app loads first: lessons grouped into chapters by topic.

use serde_json::{Value, json};
use std::path::Path;

fn count(v: &Value, key: &str) -> usize {
    v.get(key).and_then(Value::as_array).map_or(0, Vec::len)
}

/// Reads every `LNN/lesson.json` under `root` and writes `root/index.json`.
pub fn write(root: &Path) -> anyhow::Result<usize> {
    let mut lessons: Vec<Value> = Vec::new();
    for n in 1..=99 {
        let path = root.join(format!("L{n:02}/lesson.json"));
        let Ok(text) = std::fs::read_to_string(&path) else { continue };
        lessons.push(serde_json::from_str(&text)?);
    }

    // A chapter is a run of lessons that share a topic; the book prints two lessons under each.
    let mut chapters: Vec<Value> = Vec::new();
    let mut last_topic = String::new();
    for l in &lessons {
        let topic = l["topic"]["en"].as_str().unwrap_or_default().to_string();
        let entry = json!({
            "number": l["number"],
            "title": l["title"],
            "question": l["question"],
            "audio": count(l, "audio"),
            "images": count(l, "images"),
            "sections": sections(l),
        });
        if topic != last_topic {
            chapters.push(json!({ "number": chapters.len() + 1, "topic": l["topic"], "lessons": [] }));
            last_topic = topic;
        }
        if let Some(lessons) = chapters.last_mut().and_then(|c| c["lessons"].as_array_mut()) {
            lessons.push(entry);
        }
    }

    let index = json!({
        "book": { "id": "elementary01", "title": { "ja": "いろどり 初級1", "en": "Irodori Elementary 1" } },
        "chapters": chapters,
    });
    std::fs::write(root.join("index.json"), serde_json::to_string_pretty(&index)?)?;
    Ok(lessons.len())
}

/// The pages of a lesson: one per activity, then the kanji, grammar and listening scripts.
fn sections(lesson: &Value) -> Vec<Value> {
    let mut out: Vec<Value> = lesson["activities"]
        .as_array()
        .into_iter()
        .flatten()
        .map(|a| {
            json!({
                "id": format!("activity-{}", a["number"]),
                "kind": "activity",
                "title": a["title"],
                "can_do": a["can_do"],
                "can_do_en": a["can_do_en"],
            })
        })
        .collect();
    if count(&lesson["kanji"], "words") > 0 {
        out.push(json!({ "id": "kanji", "kind": "kanji" }));
    }
    if count(lesson, "notes") > 0 {
        out.push(json!({ "id": "grammar", "kind": "grammar" }));
    }
    if count(lesson, "scripts") > 0 {
        out.push(json!({ "id": "scripts", "kind": "scripts" }));
    }
    out
}
