//! Reads the Irodori download index and lesson audio pages, and downloads their files.

use crate::model::AudioFile;
use anyhow::{Context, bail};
use scraper::{Html, Selector};
use std::path::Path;
use std::time::Duration;
use url::Url;

const BASE: &str = "https://www.irodori.jpf.go.jp";
const INDEX: &str = "/en/elementary01/pdf.html";
/// The site answers 403 to default HTTP client user agents.
const USER_AGENT: &str = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";
const DELAY: Duration = Duration::from_millis(400);

#[derive(Debug, Clone)]
pub struct LessonMeta {
    pub number: u32,
    pub topic: String,
    pub title: String,
    pub pdf_url: Url,
    pub audio_page: Url,
}

pub struct Site {
    client: reqwest::Client,
}

impl Site {
    pub fn new() -> anyhow::Result<Site> {
        let client = reqwest::Client::builder().user_agent(USER_AGENT).build()?;
        Ok(Site { client })
    }

    async fn get(&self, url: &Url) -> anyhow::Result<reqwest::Response> {
        tokio::time::sleep(DELAY).await;
        let res = self.client.get(url.clone()).send().await?;
        if !res.status().is_success() {
            bail!("{url}: HTTP {}", res.status());
        }
        Ok(res)
    }

    pub async fn lessons(&self) -> anyhow::Result<Vec<LessonMeta>> {
        let base = Url::parse(BASE)?;
        let html = self.get(&base.join(INDEX)?).await?.text().await?;
        parse_index(&html, &base)
    }

    pub async fn audio(&self, lesson: &LessonMeta) -> anyhow::Result<Vec<AudioFile>> {
        let html = self.get(&lesson.audio_page).await?.text().await?;
        parse_audio_page(&html, &lesson.audio_page)
    }

    /// Downloads `url` to `dest` unless it is already there.
    pub async fn fetch(&self, url: &Url, dest: &Path) -> anyhow::Result<bool> {
        if dest.exists() {
            return Ok(false);
        }
        let bytes = self.get(url).await?.bytes().await?;
        if let Some(dir) = dest.parent() {
            tokio::fs::create_dir_all(dir).await?;
        }
        // Write to a temp name first so an interrupted run never leaves a truncated cache file.
        let tmp = dest.with_extension("part");
        tokio::fs::write(&tmp, &bytes).await?;
        tokio::fs::rename(&tmp, dest).await?;
        Ok(true)
    }
}

pub fn parse_index(html: &str, base: &Url) -> anyhow::Result<Vec<LessonMeta>> {
    let doc = Html::parse_document(html);
    let sel = |s: &str| Selector::parse(s).expect("valid selector");
    let (item, topic, heading, link) = (
        sel("ul.lesson_list > li"),
        sel(".topic h3 span:last-child"),
        sel(".lesson_text h4 span"),
        sel("a[href]"),
    );
    let mut lessons = Vec::new();
    for li in doc.select(&item) {
        let spans: Vec<String> = li.select(&heading).map(|s| clean(&s.text().collect::<String>())).collect();
        let [label, title] = spans.as_slice() else { continue };
        let number: u32 = label.trim_start_matches("Lesson").trim().parse().context("lesson number")?;
        let href = |needle: &str| {
            li.select(&link)
                .filter_map(|a| a.value().attr("href"))
                .find(|h| h.contains(needle))
                .map(|h| base.join(h))
        };
        let pdf = href(&format!("/pdf/Y_L{number:02}.pdf")).context("lesson PDF link")??;
        let page = href(&format!("lesson{number:02}.html")).context("lesson audio link")??;
        lessons.push(LessonMeta {
            number,
            topic: li.select(&topic).next().map(|t| clean(&t.text().collect::<String>())).unwrap_or_default(),
            title: title.clone(),
            pdf_url: pdf,
            audio_page: page,
        });
    }
    lessons.sort_by_key(|l| l.number);
    Ok(lessons)
}

pub fn parse_audio_page(html: &str, page: &Url) -> anyhow::Result<Vec<AudioFile>> {
    let doc = Html::parse_document(html);
    let sel = Selector::parse("audio source[src]").expect("valid selector");
    let mut files = Vec::new();
    for source in doc.select(&sel) {
        let src = source.value().attr("src").unwrap_or_default();
        let url = page.join(src)?;
        let file = src.rsplit('/').next().unwrap_or_default().to_string();
        // `Y_[01-04]_hanasu1.mp3` -> id `01-04`, kind `hanasu1`
        let stem = file.trim_end_matches(".mp3");
        let (Some(open), Some(close)) = (stem.find('['), stem.find(']')) else { continue };
        files.push(AudioFile {
            id: stem[open + 1..close].to_string(),
            kind: stem[close + 1..].trim_start_matches('_').to_string(),
            file,
            url: url.to_string(),
        });
    }
    Ok(files)
}

fn clean(s: &str) -> String {
    s.split_whitespace().collect::<Vec<_>>().join(" ")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn audio_page_ids_and_kinds() {
        let html = r#"<audio><source src="/assets/data/elementary01/audio/01/Y_[01-04]_hanasu1.mp3"></audio>"#;
        let page = Url::parse("https://example.test/en/elementary01/audio/lesson01.html").unwrap();
        let files = parse_audio_page(html, &page).unwrap();
        assert_eq!((files[0].id.as_str(), files[0].kind.as_str()), ("01-04", "hanasu1"));
        assert_eq!(files[0].file, "Y_[01-04]_hanasu1.mp3");
    }
}
