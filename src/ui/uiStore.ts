import { useSyncExternalStore, useRef, useCallback } from 'react'
import type { Song } from '../core/types'
import { getState, actions } from '../core/store'
import { loadBible } from '../core/db'
import { refLabel } from '../core/bible'

export type Selection =
  | { type: 'song'; songId: string }
  | { type: 'bible'; versionId: string; book: number; chapter: number; verse: number }
  | { type: 'media'; mediaId: string }
  | { type: 'pptx'; mediaId: string }
  | null

export interface SlideView {
  label?: string
  text: string
  reference?: string
}

export interface UIState {
  page: 'live' | 'program' | 'library' | 'stage' | 'settings'
  leftTab: 'songs' | 'bible' | 'files' | 'envios'
  bottomTab: 'themes' | 'overlays' | 'layers' | 'alert' | 'stage'
  selection: Selection
  selectionSlides: SlideView[]
  selectionTitle: string
  // o que está no ar
  cursor: { key: string; title: string; kind: 'song' | 'bible'; slides: SlideView[]; index: number } | null
  editSongId: string | null
  libraryTab: 'files' | 'themes' | 'overlays' | 'songs' | 'bibles'
  toast: string
}

let ui: UIState = {
  page: 'live',
  leftTab: 'songs',
  bottomTab: 'themes',
  selection: null,
  selectionSlides: [],
  selectionTitle: '',
  cursor: null,
  editSongId: null,
  libraryTab: 'files',
  toast: '',
}
const ls = new Set<() => void>()
export const getUI = () => ui
export function setUI(p: Partial<UIState> | ((u: UIState) => Partial<UIState>)) {
  const patch = typeof p === 'function' ? p(ui) : p
  ui = { ...ui, ...patch }
  ls.forEach((l) => l())
}
export function useUI<T>(sel: (u: UIState) => T): T {
  const r = useRef(sel)
  r.current = sel
  const get = useCallback(() => r.current(ui), [])
  return useSyncExternalStore(
    (l) => {
      ls.add(l)
      return () => ls.delete(l)
    },
    get,
    get,
  )
}

let toastT: number | undefined
export function toast(msg: string) {
  setUI({ toast: msg })
  clearTimeout(toastT)
  toastT = window.setTimeout(() => setUI({ toast: '' }), 3500)
}

export const songSlides = (s: Song): SlideView[] => s.slides.map((sl) => ({ label: sl.label, text: sl.text }))

/** Seleciona (pré-visualiza) um item no centro, sem colocar no ar */
export async function select(sel: Selection) {
  if (!sel) return setUI({ selection: null, selectionSlides: [], selectionTitle: '' })
  const s = getState()
  if (sel.type === 'song') {
    const song = s.songs.find((x) => x.id === sel.songId)
    if (!song) return
    setUI({ selection: sel, selectionSlides: songSlides(song), selectionTitle: song.title })
  } else if (sel.type === 'bible') {
    const b = await loadBible(sel.versionId)
    if (!b) return
    const ch = b.books[sel.book]?.chapters[sel.chapter - 1] ?? []
    const slides = ch.map((v, i) => ({
      label: String(i + 1),
      text: v,
      reference: refLabel(b, { book: sel.book, chapter: sel.chapter, verseFrom: i + 1, verseTo: i + 1 }),
    }))
    setUI({ selection: sel, selectionSlides: slides, selectionTitle: `${b.books[sel.book]?.name} ${sel.chapter} (${b.abbrev})` })
  } else {
    const m = s.media.find((x) => x.id === sel.mediaId)
    setUI({ selection: sel, selectionSlides: [], selectionTitle: m?.name ?? '' })
  }
}

/** Coloca o slide i da seleção atual no ar */
export function goLive(index: number) {
  const u = getUI()
  const sel = u.selection
  if (!sel || (sel.type !== 'song' && sel.type !== 'bible')) return
  const key = sel.type === 'song' ? 'song:' + sel.songId : `bible:${sel.versionId}:${sel.book}:${sel.chapter}`
  setUI({ cursor: { key, title: u.selectionTitle, kind: sel.type, slides: u.selectionSlides, index } })
  pushCursor()
}

function pushCursor() {
  const c = getUI().cursor
  if (!c) return
  const sl = c.slides[c.index]
  if (!sl) return
  const next = c.slides[c.index + 1]
  actions.showText({
    kind: c.kind,
    title: c.title,
    text: sl.text,
    next: next?.text ?? '',
    reference: sl.reference,
    key: c.key + ':' + c.index + ':' + sl.text.length,
  })
}

export function step(d: number) {
  const c = getUI().cursor
  if (!c) return
  const index = Math.max(0, Math.min(c.slides.length - 1, c.index + d))
  if (index === c.index) return
  setUI({ cursor: { ...c, index } })
  pushCursor()
}

/** Atualiza o cursor quando a música no ar foi editada */
export function refreshCursorFromSong(song: Song) {
  const c = getUI().cursor
  if (c && c.key === 'song:' + song.id) {
    const slides = songSlides(song)
    setUI({ cursor: { ...c, slides, title: song.title, index: Math.min(c.index, slides.length - 1) } })
    pushCursor()
  }
  const sel = getUI().selection
  if (sel?.type === 'song' && sel.songId === song.id) setUI({ selectionSlides: songSlides(song), selectionTitle: song.title })
}

export function clearText() {
  setUI({ cursor: null })
  actions.clearText()
}
