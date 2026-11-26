/**
 * Busca de letras na internet pelo LRCLIB (lrclib.net) — banco aberto e gratuito, sem chave.
 */
import { norm } from './bible'
import { parseSongText, songToText, splitSlides } from './songs'

export interface WebLyric {
  id: number
  title: string
  artist: string
  album: string
  duration: number
  lyrics: string
  blocks: number
}

const clean = (s: string) =>
  s
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

export async function searchLyrics(q: string, signal?: AbortSignal): Promise<WebLyric[]> {
  const r = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(q.trim())}`, { signal })
  if (!r.ok) throw new Error(`Erro ${r.status}`)
  const data: any[] = await r.json()
  const best = new Map<string, WebLyric>()
  for (const x of data) {
    if (x.instrumental || !x.plainLyrics) continue
    const lyrics = clean(x.plainLyrics)
    const item: WebLyric = {
      id: x.id,
      title: x.trackName || x.name || 'Sem título',
      artist: x.artistName || '',
      album: /^(unknown|null|desconhecido)$/i.test(x.albumName || '') ? '' : x.albumName || '',
      duration: x.duration || 0,
      lyrics,
      blocks: lyrics.split('\n\n').length,
    }
    // agrupa versões repetidas da mesma música e fica com a mais bem dividida
    const key = norm(item.title.replace(/\(.*?\)|-\s*ao vivo/gi, '')) + '|' + norm(item.artist)
    const prev = best.get(key)
    if (!prev || item.blocks > prev.blocks) best.set(key, item)
  }
  return [...best.values()]
}

/** Texto no formato do editor (título, artista, estrofes). Letras sem estrofes são divididas a cada 4 linhas. */
export function webLyricToText(w: WebLyric) {
  const text = `${w.title}\n${w.artist}\n\n${w.lyrics}`
  if (w.blocks > 1) return text
  return songToText(splitSlides(parseSongText(text), 4))
}
