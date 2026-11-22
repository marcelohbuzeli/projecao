import type { Song, Slide } from './types'
import { uid } from './defaults'

/**
 * Formato de texto:
 *   Linha 1 = título; linha 2 (opcional, antes da 1ª linha em branco) = artista
 *   Estrofes separadas por linha em branco. "[Refrão]" numa linha sozinha nomeia o slide.
 */
export function parseSongText(raw: string, fallbackTitle = 'Sem título'): Song {
  const text = raw.replace(/\r\n?/g, '\n').replace(/ /g, ' ').trim()
  const blocks = text.split(/\n\s*\n/)
  let header = blocks.shift() ?? ''
  const headerLines = header.split('\n').map((l) => l.trim()).filter(Boolean)
  let title = headerLines[0] || fallbackTitle
  let artist = ''
  // se o "cabeçalho" tiver mais de 2 linhas, é estrofe (sem título)
  if (headerLines.length > 2) {
    blocks.unshift(header)
    title = fallbackTitle
  } else if (headerLines.length === 2) artist = headerLines[1]
  const slides: Slide[] = []
  for (const b of blocks) {
    let lines = b.split('\n').map((l) => l.trim()).filter(Boolean)
    if (!lines.length) continue
    let label: string | undefined
    const m = lines[0].match(/^\[(.+)\]$/) || lines[0].match(/^\((.+)\)$/)
    if (m) {
      label = m[1]
      lines = lines.slice(1)
    }
    if (!lines.length) continue
    slides.push({ id: uid(), label, text: lines.join('\n') })
  }
  return { id: uid(), title, artist: artist || undefined, slides, updatedAt: Date.now() }
}

export function songToText(s: Song) {
  const head = [s.title, s.artist].filter(Boolean).join('\n')
  const body = s.slides.map((sl) => (sl.label ? `[${sl.label}]\n` : '') + sl.text).join('\n\n')
  return head + '\n\n' + body
}

/** Divide slides com muitas linhas em slides de N linhas */
export function splitSlides(s: Song, maxLines: number): Song {
  const out: Slide[] = []
  for (const sl of s.slides) {
    const lines = sl.text.split('\n')
    for (let i = 0; i < lines.length; i += maxLines) {
      out.push({ id: uid(), label: i === 0 ? sl.label : undefined, text: lines.slice(i, i + maxLines).join('\n') })
    }
  }
  return { ...s, slides: out, updatedAt: Date.now() }
}

/** OpenLyrics (XML) — usado por OpenLP e outros */
export function parseOpenLyrics(xml: string): Song | null {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  const title = doc.querySelector('titles > title')?.textContent?.trim()
  const verses = [...doc.querySelectorAll('lyrics > verse')]
  if (!verses.length) return null
  const order = doc.querySelector('verseOrder')?.textContent?.trim().split(/\s+/)
  const map = new Map<string, Slide>()
  for (const v of verses) {
    const name = v.getAttribute('name') || ''
    const lines = [...v.querySelectorAll('lines')]
      .map((ln) => {
        let t = ''
        ln.childNodes.forEach((n) => {
          if (n.nodeName === 'br') t += '\n'
          else if (n.nodeType === 3 || n.nodeName === 'tag') t += n.textContent
        })
        return t.trim()
      })
      .join('\n')
    map.set(name, { id: uid(), label: labelFromCode(name), text: lines })
  }
  const slides = order?.length
    ? order.map((o) => map.get(o)).filter(Boolean).map((s) => ({ ...s!, id: uid() }))
    : [...map.values()]
  return { id: uid(), title: title || 'Sem título', artist: doc.querySelector('authors > author')?.textContent?.trim(), slides, updatedAt: Date.now() }
}

function labelFromCode(c: string) {
  const m = c.match(/^([a-z])(\d*)([a-z]?)$/i)
  if (!m) return c
  const names: Record<string, string> = { v: 'Verso', c: 'Refrão', b: 'Ponte', p: 'Pré-refrão', i: 'Intro', e: 'Final', o: 'Outro' }
  return `${names[m[1].toLowerCase()] ?? c} ${m[2]}${m[3]}`.trim()
}

/** Tenta interpretar qualquer arquivo de música */
export function parseSongFile(name: string, content: string): Song[] {
  const base = name.replace(/\.[^.]+$/, '')
  if (/<song[\s>]/i.test(content) && /<lyrics/i.test(content)) {
    const s = parseOpenLyrics(content)
    return s ? [s] : []
  }
  if (/^\s*[[{]/.test(content)) {
    try {
      const j = JSON.parse(content)
      const arr = Array.isArray(j) ? j : j.songs ?? j.musicas ?? [j]
      return arr.map((x: any) => jsonSong(x, base)).filter(Boolean) as Song[]
    } catch {
      /* segue como texto */
    }
  }
  const s = parseSongText(content, base)
  if (s.title === base || !s.title) s.title = base
  return s.slides.length ? [s] : []
}

function jsonSong(x: any, fallback: string): Song | null {
  if (!x || typeof x !== 'object') return null
  const title = x.title ?? x.titulo ?? x.name ?? x.nome ?? fallback
  const artist = x.artist ?? x.artista ?? x.author ?? x.autor
  let text: string | undefined = x.lyrics ?? x.letra ?? x.text ?? x.texto
  if (Array.isArray(x.slides)) {
    return {
      id: uid(), title, artist, updatedAt: Date.now(),
      slides: x.slides.map((sl: any) => ({ id: uid(), label: sl.label ?? sl.nome, text: typeof sl === 'string' ? sl : sl.text ?? sl.texto ?? '' })),
    }
  }
  if (Array.isArray(x.paragraphs)) text = x.paragraphs.map((p: any) => p.text ?? p).join('\n\n')
  if (!text) return null
  const s = parseSongText(title + '\n\n' + String(text).replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ''), title)
  return { ...s, title, artist }
}
