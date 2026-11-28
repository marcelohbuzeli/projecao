import { useSyncExternalStore, useRef, useCallback } from 'react'
import type {
  MediaItem, Theme, Overlay, TextStyle, Song, Scene, ServiceItem, StageConfig, LiveState, OutputLook, SceneOutputId,
  ResolvedLook, Snapshot, LiveText,
} from './types'
import {
  defaultLive, defaultOverlays, defaultScenes, defaultStage, defaultStyles, defaultThemes, uid, DEMO_SONG_TEXT, baseStyle,
  defaultAlert, defaultTimer, BUILTIN_VERSION,
} from './defaults'
import { dbGet, dbSet } from './db'
import { parseSongText } from './songs'

export interface BibleMeta { id: string; name: string; abbrev: string }

export interface AppState {
  media: MediaItem[]
  themes: Theme[]
  overlays: Overlay[]
  styles: TextStyle[]
  songs: Song[]
  scenes: Scene[]
  service: ServiceItem[]
  bibles: BibleMeta[]
  stage: StageConfig
  live: LiveState
  settings: { roomId: string; bibleId: string; timerPresets: number[]; liveEnabled: boolean; screenMap: Record<string, string>; builtinVersion?: number; envios?: import('./envios').EnviosConfig; envioMedia?: Record<string, string>; autoFullscreen?: boolean }
}

const initial = (): AppState => ({
  media: [],
  themes: defaultThemes(),
  overlays: defaultOverlays(),
  styles: defaultStyles(),
  songs: [{ ...parseSongText(DEMO_SONG_TEXT), id: 'demo' }],
  scenes: defaultScenes(),
  service: [{ id: uid(), type: 'song', songId: 'demo' }],
  bibles: [],
  stage: defaultStage(),
  live: defaultLive(),
  settings: { roomId: Math.random().toString(36).slice(2, 8), bibleId: '', timerPresets: [5, 10, 15, 30, 45, 60], liveEnabled: true, screenMap: {}, builtinVersion: BUILTIN_VERSION },
})

let state: AppState = initial()
const listeners = new Set<() => void>()
let loaded = false

export const getState = () => state

export function setState(fn: (s: AppState) => AppState) {
  const next = fn(state)
  if (next === state) return
  state = next
  listeners.forEach((l) => l())
  schedulePersist()
}

export function setLive(fn: (l: LiveState) => LiveState) {
  setState((s) => ({ ...s, live: fn(s.live) }))
}

export function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function useStore<T>(sel: (s: AppState) => T): T {
  const selRef = useRef(sel)
  selRef.current = sel
  const cache = useRef<{ s: AppState | null; v: T }>({ s: null, v: undefined as T })
  cache.current.s = null // recalcula a cada render (seletor pode depender de props)
  // memoriza pelo estado: seletores que criam arrays/objetos novos não causam loop
  const get = useCallback(() => {
    if (cache.current.s !== state) cache.current = { s: state, v: selRef.current(state) }
    return cache.current.v
  }, [])
  return useSyncExternalStore(subscribe, get, get)
}

// ---- persistência ----
let persistTimer: number | undefined
function schedulePersist() {
  if (!loaded) return
  clearTimeout(persistTimer)
  persistTimer = window.setTimeout(() => {
    const live = { ...state.live }
    if (live.media?.kind === 'capture') live.media = null
    dbSet('app-state', { ...state, live }).catch((e) => console.error('persist', e))
  }, 400)
}

export async function loadState() {
  const saved = await dbGet<AppState>('app-state')
  if (saved) {
    const base = initial()
    state = {
      ...base,
      ...saved,
      settings: { ...base.settings, ...saved.settings, builtinVersion: saved.settings?.builtinVersion ?? 1 },
      stage: { ...base.stage, ...saved.stage },
      live: {
        ...base.live,
        ...saved.live,
        alert: { ...defaultAlert(), ...saved.live?.alert },
        timer: { ...defaultTimer(), ...saved.live?.timer },
      },
    }
  }
  // novos temas/sobreposições padrão de versões novas do sistema
  if ((state.settings.builtinVersion ?? 1) < BUILTIN_VERSION) {
    const th = new Set(state.themes.map((t) => t.id))
    const ov = new Set(state.overlays.map((t) => t.id))
    state = {
      ...state,
      themes: [...state.themes, ...defaultThemes().filter((t) => !th.has(t.id))],
      overlays: [...state.overlays, ...defaultOverlays().filter((t) => !ov.has(t.id))],
      settings: { ...state.settings, builtinVersion: BUILTIN_VERSION },
    }
  }
  loaded = true
  listeners.forEach((l) => l())
  schedulePersist()
}

// ---- resolução para as saídas ----
const fallbackStyle = baseStyle({ id: 'fallback', name: 'Padrão' })
export const findStyle = (s: AppState, id: string) => s.styles.find((x) => x.id === id) ?? s.styles[0] ?? fallbackStyle

function resolveLook(s: AppState, look: OutputLook): ResolvedLook {
  const l = s.live
  return {
    theme: look.theme ? s.themes.find((t) => t.id === l.themeId) ?? null : null,
    overlay: look.overlay ? s.overlays.find((o) => o.id === l.overlayId) ?? null : null,
    overlayOpacity: l.overlayOpacity,
    lyrics: look.lyrics,
    style: findStyle(s, look.textStyleId),
    camera: look.camera,
    media: look.media,
  }
}

export function buildSnapshot(s: AppState = state): Snapshot {
  const l = s.live
  return {
    v: Date.now(),
    telao: resolveLook(s, l.looks.telao),
    laterais: resolveLook(s, l.looks.laterais),
    liveStyle: findStyle(s, l.liveStyleId),
    text: l.text,
    textVisible: l.textVisible,
    media: l.media,
    alert: l.alert,
    stage: s.stage,
    stageMessage: l.stageMessage,
    stageMessageVisible: l.stageMessageVisible,
    timer: l.timer,
    black: l.black,
    cameraDeviceId: l.cameraDeviceId,
    liveChroma: l.liveChroma,
    captureCrop: l.captureCrop ?? { t: 0, b: 0, l: 0, r: 0 },
  }
}

// ---- ações ----
export const actions = {
  applyScene(sceneId: string) {
    setState((s) => {
      const sc = s.scenes.find((x) => x.id === sceneId)
      if (!sc) return s
      return {
        ...s,
        live: {
          ...s.live,
          sceneId: sc.id,
          themeId: sc.themeId,
          overlayId: sc.overlayId,
          overlayOpacity: sc.overlayOpacity,
          looks: structuredClone(sc.outputs),
          liveStyleId: sc.liveStyleId,
        },
      }
    })
  },
  setTheme(themeId: string | null) {
    setLive((l) => ({ ...l, themeId }))
  },
  setOverlay(overlayId: string | null) {
    setLive((l) => ({ ...l, overlayId }))
  },
  setLook(out: SceneOutputId, patch: Partial<OutputLook>) {
    setLive((l) => ({ ...l, looks: { ...l.looks, [out]: { ...l.looks[out], ...patch } } }))
  },
  showText(t: LiveText | null) {
    setLive((l) => ({ ...l, text: t, textVisible: true }))
  },
  clearText() {
    setLive((l) => ({ ...l, text: null }))
  },
  clearMedia() {
    setLive((l) => ({ ...l, media: null }))
  },
  toggleBlack() {
    setLive((l) => ({ ...l, black: !l.black }))
  },
  clearAll() {
    setLive((l) => ({ ...l, text: null, media: null, alert: { ...l.alert, visible: false } }))
  },
  playMedia(item: MediaItem, loop = false) {
    if (item.kind === 'pptx') return
    setLive((l) => ({
      ...l,
      media: {
        kind: item.kind as 'image' | 'video',
        mediaId: item.id,
        name: item.name,
        loop,
        playing: true,
        startedAt: Date.now(),
        offset: 0,
        nonce: Math.random(),
        volume: l.media?.volume ?? 1,
      },
    }))
  },
  showCapture(name = 'PowerPoint') {
    setLive((l) => ({
      ...l,
      media: { kind: 'capture', name, loop: false, playing: true, startedAt: Date.now(), offset: 0, nonce: Math.random(), volume: 1 },
    }))
  },
  togglePause() {
    setLive((l) => {
      const m = l.media
      if (!m || m.kind !== 'video') return l
      if (m.playing) return { ...l, media: { ...m, playing: false, offset: m.offset + (Date.now() - m.startedAt) / 1000 } }
      return { ...l, media: { ...m, playing: true, startedAt: Date.now() } }
    })
  },
  restartMedia() {
    setLive((l) => (l.media ? { ...l, media: { ...l.media, playing: true, startedAt: Date.now(), offset: 0, nonce: Math.random() } } : l))
  },
  // ---- cronômetro ----
  timerStart(sec?: number) {
    setLive((l) => {
      const t = l.timer
      const remaining = sec ?? (t.running ? Math.max(0, (t.endsAt - Date.now()) / 1000) : t.remaining)
      return { ...l, timer: { ...t, enabled: true, durationSec: sec ?? t.durationSec, running: true, endsAt: Date.now() + remaining * 1000, remaining } }
    })
  },
  timerPause() {
    setLive((l) => {
      const t = l.timer
      if (!t.running) return l
      return { ...l, timer: { ...t, running: false, remaining: (t.endsAt - Date.now()) / 1000 } }
    })
  },
  timerReset(sec?: number) {
    setLive((l) => {
      const d = sec ?? l.timer.durationSec
      return { ...l, timer: { ...l.timer, durationSec: d, running: false, remaining: d } }
    })
  },
  timerAdd(sec: number) {
    setLive((l) => {
      const t = l.timer
      return t.running
        ? { ...l, timer: { ...t, endsAt: t.endsAt + sec * 1000 } }
        : { ...l, timer: { ...t, remaining: t.remaining + sec } }
    })
  },
}

export function timerRemaining(t: { running: boolean; endsAt: number; remaining: number }) {
  return t.running ? (t.endsAt - Date.now()) / 1000 : t.remaining
}

let snapState: AppState | null = null
let snapCache: Snapshot | null = null
export function snapshotOf(s: AppState): Snapshot {
  if (s !== snapState || !snapCache) {
    snapState = s
    snapCache = buildSnapshot(s)
  }
  return snapCache
}
export const useSnapshot = () => useStore(snapshotOf)
