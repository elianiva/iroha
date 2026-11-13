/* eslint-disable no-unused-vars */
// Shared renderers for the prototypes. Everything shown comes from /data/elementary01 (index.json, L??/lesson.json).
const IR = (() => {
  const BASE = '/data/elementary01'
  const esc = (s) =>
    String(s ?? '').replace(
      /[&<>"]/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c],
    )
  const pad = (n) => String(n).padStart(2, '0')
  const t = (x) => {
    if (!x) return ''
    const cps = Array.from(x.text ?? '')
    const rb = [...(x.ruby ?? [])].sort((a, b) => a.start - b.start)
    let out = '',
      at = 0
    for (const r of rb) {
      out += esc(cps.slice(at, r.start).join(''))
      out += `<ruby>${esc(cps.slice(r.start, r.end).join(''))}<rt>${esc(r.reading)}</rt></ruby>`
      at = r.end
    }
    return out + esc(cps.slice(at).join(''))
  }
  const plain = (x) => esc(x?.text ?? '')
  const get = (p) => fetch(p).then((r) => r.json())
  const load = (n) => get(`${BASE}/L${pad(n)}/lesson.json`).then((l) => ((l._n = n), l))
  const index = () => get(`${BASE}/index.json`)
  const url = (l, p) =>
    `${BASE}/L${pad(l.number)}/${p.split('/').map(encodeURIComponent).join('/')}`
  const play = (l, id) => {
    const f = l.audio.find((a) => a.id === id)
    return f
      ? `<button class="ir-play" data-src="${url(l, 'audio/' + f.file)}" aria-label="Play ${esc(id)}">▶</button>`
      : ''
  }
  const plays = (l, ids) => (ids ?? []).map((i) => play(l, i)).join('')
  const block = (b) =>
    `<p class="ir-block">${b.ja ? `<span class="ir-ja">${t(b.ja)}</span>` : ''}${b.en ? `<span class="ir-en">${esc(b.en)}</span>` : ''}</p>`
  const choice = (l, c) =>
    `<button class="ir-opt" data-label="${esc(c.label)}"><b>${esc(c.label)}</b>${c.image ? `<img src="${url(l, c.image)}" alt="">` : ''}<span class="ir-ja">${t(c.ja)}</span>${c.en ? `<span class="ir-en">${esc(c.en)}</span>` : ''}</button>`
  const opts = (l, list) => `<div class="ir-opts">${list.map((c) => choice(l, c)).join('')}</div>`
  const dialogue = (l, d) =>
    `<div class="ir-dialogue">${d.audio ? plays(l, [d.audio]) : ''}${d.turns.map((x) => `<div class="ir-turn" data-s="${esc(x.speaker)}"><b>${esc(x.speaker)}</b><span class="ir-ja">${t(x.text)}</span></div>`).join('')}</div>`
  const chooseQuiz = (l, q) =>
    q.items
      .map(
        (it) =>
          `<div class="ir-qitem">${it.audio ? plays(l, [it.audio]) : ''}${it.questions.map((qq) => `<div class="ir-q">${qq.prompt ? `<p class="ir-ja">${t(qq.prompt)}</p>` : ''}${opts(l, qq.options)}</div>`).join('')}</div>`,
      )
      .join('')
  const fillQuiz = (q) =>
    `<div class="ir-fill">${q.items
      .map((it, i) => {
        const ans = it.answers.map((a) => a.map((x) => x.text).join('|')).join('/')
        let h = ''
        it.parts.forEach((p, k) => {
          h += `<span class="ir-ja">${t(p)}</span>`
          if (k < it.parts.length - 1)
            h += `<input class="ir-in" data-i="${i}" data-k="${k}" data-ans="${esc(it.answers[0]?.[k]?.text ?? '')}" size="6" autocomplete="off">`
        })
        return `<div class="ir-fillrow" data-ans="${esc(ans)}">${h}<span class="ir-mark"></span></div>`
      })
      .join('')}<button class="ir-check">Check</button></div>`
  const vocab = (v) =>
    `<ul class="ir-vocab">${v.map((x) => `<li><span class="ir-ja">${t(x.ja)}</span><span class="ir-en">${esc(x.en)}</span></li>`).join('')}</ul>`
  const tables = (tb) =>
    tb
      .map(
        (x) =>
          `<table class="ir-table"><thead><tr>${x.headings.map((h) => `<th>${h.ja ? t(h.ja) : ''} ${esc(h.en ?? '')}</th>`).join('')}</tr></thead><tbody>${x.rows.map((r) => `<tr>${r.map((e) => `<td><span class="ir-ja">${t(e.term)}</span><small>${t(e.reading)}</small></td>`).join('')}</tr>`).join('')}</tbody></table>`,
      )
      .join('')
  const practice = (p) =>
    `<div class="ir-practice">${p.map((b) => `<div class="ir-bubble" data-side="${esc(b.side)}">${b.lines.map((x) => `<span class="ir-ja">${t(x)}</span>`).join('')}</div>`).join('')}</div>`
  const grid = (g) =>
    `<table class="ir-table"><thead><tr><th></th>${g.columns.map((c) => `<th>${t(c)}</th>`).join('')}</tr></thead><tbody>${g.rows.map((r) => `<tr><th>${t(r)}</th>${g.columns.map(() => '<td></td>').join('')}</tr>`).join('')}</tbody></table>`
  const kindLabel = {
    intro: 'Intro',
    choose: 'Choose',
    listen: 'Listen',
    mark: 'Mark',
    check: 'Check',
    notice: 'Notice',
    repeat: 'Repeat',
    shadow: 'Shadowing',
    speak: 'Speak',
    practice: 'Practice',
    diagram: 'Diagram',
    words: 'Words',
    vocab: 'Vocabulary',
    fill: 'Fill in',
  }
  const kind = (k) => kindLabel[k] ?? k ?? ''
  /** One exercise; sub-questions are rendered by the caller (see `units`). */
  const task = (l, k) => {
    let h = ''
    if (k.instruction?.text)
      h += `<p class="ir-instr"><span class="ir-ja">${t(k.instruction)}</span>${k.instruction_en ? `<span class="ir-en">${esc(k.instruction_en)}</span>` : ''}</p>`
    else if (k.instruction_en)
      h += `<p class="ir-instr"><span class="ir-en">${esc(k.instruction_en)}</span></p>`
    if (k.audio?.length && !k.dialogues.length)
      h += `<div class="ir-audios">${plays(l, k.audio)}</div>`
    h += (k.body ?? []).map(block).join('')
    h += k.dialogues.map((d) => dialogue(l, d)).join('')
    if (k.quiz?.type === 'choose') h += chooseQuiz(l, k.quiz)
    else if (k.choices.length) h += k.choices.map((c) => opts_(l, c)).join('')
    if (k.quiz?.type === 'fill') h += fillQuiz(k.quiz)
    if (k.vocab.length) h += vocab(k.vocab)
    if (k.tables?.length) h += tables(k.tables)
    if (k.grid) h += grid(k.grid)
    if (k.practice?.length) h += practice(k.practice)
    if (k.hints?.length) h += `<div class="ir-hints">${k.hints.map(block).join('')}</div>`
    return h
  }
  const opts_ = opts
  /** Tasks and sub-questions flattened into one list of screens, as the app's player does. */
  const units = (a) => {
    const out = []
    const add = (step, k) => {
      const has =
        k.instruction?.text ||
        k.instruction_en ||
        k.body.length ||
        k.choices.length ||
        k.practice?.length ||
        k.quiz ||
        k.dialogues.length ||
        k.vocab.length ||
        k.tables?.length ||
        k.audio.length
      if (has) out.push({ step, task: k })
      ;(k.subtasks ?? []).forEach((s) => add(step, s))
    }
    a.steps.forEach((s) => s.tasks.forEach((k) => add(s, k)))
    return out
  }
  const note = (l, n) => {
    let h = `<h3 class="ir-ja">${t(n.title)}</h3>`
    if (n.pattern?.length)
      h += `<p class="ir-pattern">${n.pattern.map((p) => `<span class="ir-ja">${t(p)}</span>`).join(' ')}</p>`
    h += (n.blocks ?? []).map(block).join('')
    h += (n.points ?? [])
      .map(
        (p) =>
          `<p class="ir-point"><span class="ir-en">${esc(p.en)}</span>${p.ja ? `<span class="ir-ja">${t(p.ja)}</span>` : ''}</p>`,
      )
      .join('')
    h += (n.examples ?? [])
      .map(
        (e) =>
          `<div class="ir-example">${e.label ? `<b>${esc(e.label)}</b>` : ''}${e.turns.map((x) => `<p>${x.speaker ? `<b>${esc(x.speaker)}</b>` : ''}<span class="ir-ja">${t(x.ja)}</span>${x.en ? `<span class="ir-en">${esc(x.en)}</span>` : ''}</p>`).join('')}</div>`,
      )
      .join('')
    return h
  }
  const kanji = (k) =>
    `<div class="ir-kanji"><div class="ir-words">${k.words.map((w) => `<span class="ir-ja ir-chip">${t(w)}</span>`).join('')}</div>${k.sentences.map((s) => `<p class="ir-ja">${t(s)}</p>`).join('')}</div>`
  const scripts = (l, s) => s.map((d) => dialogue(l, d)).join('')
  /** Wire up audio, option picking and fill checking for everything under `root`. */
  const wire = (root = document) => {
    if (root._wired) return
    root._wired = true
    let cur
    root.addEventListener('click', (e) => {
      const p = e.target.closest('.ir-play')
      if (p) {
        cur?.pause()
        document.querySelectorAll('.ir-play.on').forEach((x) => x.classList.remove('on'))
        cur = new Audio(p.dataset.src)
        p.classList.add('on')
        cur.onended = () => p.classList.remove('on')
        cur.play()
        return
      }
      const o = e.target.closest('.ir-opt')
      if (o) {
        o.parentElement.querySelectorAll('.ir-opt').forEach((x) => x.classList.remove('picked'))
        o.classList.add('picked')
        return
      }
      const c = e.target.closest('.ir-check')
      if (c) {
        const norm = (s) => s.replace(/[\s　、。]/g, '')
        c.parentElement.querySelectorAll('.ir-fillrow').forEach((row) => {
          const ins = [...row.querySelectorAll('.ir-in')]
          const ok = ins.every((i) => norm(i.value) === norm(i.dataset.ans))
          row.dataset.ok = ok ? '1' : '0'
          row.querySelector('.ir-mark').textContent = ok
            ? '✓'
            : '→ ' + ins.map((i) => i.dataset.ans).join('・')
        })
      }
    })
  }
  const qs = new URLSearchParams(location.search)
  const lessonNo = () => Number(qs.get('l') || 1)
  return {
    t,
    plain,
    esc,
    load,
    index,
    url,
    play,
    plays,
    task,
    units,
    note,
    kanji,
    scripts,
    dialogue,
    vocab,
    wire,
    lessonNo,
    kind,
    block,
  }
})()
