mod layout;
mod model;
mod parse;
mod site;

use anyhow::Context;
use clap::{Parser, Subcommand};
use std::path::PathBuf;

#[derive(Parser)]
#[command(about = "Scrape and parse the Irodori textbooks")]
struct Cli {
    #[command(subcommand)]
    cmd: Cmd,
}

#[derive(Subcommand)]
enum Cmd {
    /// List the lessons on the download page.
    List,
    /// Download a lesson's PDF and audio, then write its lesson.json.
    Lesson {
        number: u32,
        #[arg(long, default_value = "data/elementary01")]
        out: PathBuf,
    },
    /// Print the layout lines of a PDF, with furigana as {reading|base}.
    Dump { pdf: PathBuf },
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    match Cli::parse().cmd {
        Cmd::List => {
            for l in site::Site::new()?.lessons().await? {
                println!("{:>2}  {} / {}  {}", l.number, l.topic, l.title, l.pdf_url);
            }
        }
        Cmd::Lesson { number, out } => {
            let site = site::Site::new()?;
            let meta = site
                .lessons()
                .await?
                .into_iter()
                .find(|l| l.number == number)
                .with_context(|| format!("lesson {number} not on the index page"))?;
            let dir = out.join(format!("L{number:02}"));

            let pdf = dir.join(format!("Y_L{number:02}.pdf"));
            site.fetch(&meta.pdf_url, &pdf).await?;

            let audio = site.audio(&meta).await?;
            for a in &audio {
                let dest = dir.join("audio").join(&a.file);
                if site.fetch(&a.url.parse()?, &dest).await? {
                    println!("downloaded {}", a.file);
                }
            }

            let pages = layout::read_pages(pdf.to_str().context("path")?)?;
            let lesson = parse::parse(number, &meta.topic, &meta.title, audio, &pages);
            let json = dir.join("lesson.json");
            std::fs::write(&json, serde_json::to_string_pretty(&lesson)?)?;
            println!("wrote {}", json.display());
        }
        Cmd::Dump { pdf } => {
            for page in layout::read_pages(pdf.to_str().context("path")?)? {
                for l in page {
                    let mut t = String::new();
                    for (i, c) in l.text.chars().enumerate() {
                        for r in l.ruby.iter().filter(|r| r.start == i) {
                            t.push('{');
                            t.push_str(&r.reading);
                            t.push('|');
                        }
                        t.push(c);
                        if l.ruby.iter().any(|r| r.end == i + 1) {
                            t.push('}');
                        }
                    }
                    println!("p{} y={:.0} x={:.0} s={:.1} {}", l.page, l.y, l.x, l.size, t);
                }
            }
        }
    }
    Ok(())
}
