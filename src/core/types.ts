// ---------- Biblioteca ----------

export type MediaKind = 'image' | 'video' | 'pptx'

export interface MediaItem {
  id: string
  name: string
  kind: MediaKind
  thumb?: string // dataURL pequeno
  duration?: number
  size: number
  createdAt: number
}

export type ShaderName =
  | 'aurora' | 'ondas' | 'particulas' | 'raios' | 'bokeh' | 'nebulosa' | 'gradiente' | 'grade'
  | 'plexus' | 'fogos' | 'plasma' | 'espiral' | 'aneis' | 'caleidoscopio' | 'tunel' | 'estrelas'

export interface ShaderParams {
  colorA: string
  colorB: string
  colorC: string
  speed: number // 0..2
  intensity: number // 0..2
  scale: number // 0.3..3
}

export type Visual =
  | { type: 'none' }
  | { type: 'color'; color: string }
  | { type: 'gradient'; colors: [string, string]; angle: number }
  | { type: 'media'; mediaId: string; kind?: 'image' | 'video'; fit?: 'cover' | 'contain' }
  | { type: 'shader'; shader: ShaderName; params: ShaderParams }

export type BlendMode =
  | 'normal' | 'multiply' | 'screen' | 'overlay' | 'soft-light' | 'hard-light'
  | 'lighten' | 'darken' | 'color-dodge' | 'color-burn' | 'difference' | 'exclusion' | 'luminosity'

export interface Theme {
  id: string
  name: string
  visual: Visual
  dim: number // escurecer 0..1
}

export interface Overlay {
  id: string
  name: string
  visual: Visual
  blend: BlendMode
  opacity: number
}

export interface TextStyle {
  id: string
  name: string
  fontFamily: string
  fontSize: number // % da altura da saída
  fontWeight: number
  color: string
  uppercase: boolean
  italic: boolean
  align: 'left' | 'center' | 'right'
  vAlign: 'top' | 'center' | 'bottom'
  box: { x: number; y: number; w: number; h: number } // % da saída
  lineHeight: number
  letterSpacing: number // em
  shadow: number // 0..1
  outline: number // px relativo (0..10)
  outlineColor: string
  bgColor: string
  bgOpacity: number
  autoFit: boolean
  refSize: number // tamanho da referência (bíblia) % da fonte
}

export interface Slide {
  id: string
  label?: string // Verso 1, Refrão...
  text: string // linhas separadas por \n
}

export interface Song {
  id: string
  title: string
  artist?: string
  slides: Slide[]
  updatedAt: number
}

export interface BibleVersion {
  id: string
  name: string
  abbrev: string
  books: BibleBook[]
}

export interface BibleBook {
  name: string
  abbrev: string
  chapters: string[][]
}

// ---------- Cenas ----------

export type OutputId = 'telao' | 'laterais' | 'retorno' | 'live'
export type SceneOutputId = 'telao' | 'laterais'

export interface CameraLayout {
  enabled: boolean
  x: number
  y: number
  w: number
  h: number // % da saída
  fit: 'cover' | 'contain'
  blend: BlendMode
  opacity: number
  radius: number // % da menor dimensão
  mirror: boolean
  blur: number // px
  brightness: number // 0..2
  saturation: number // 0..2
  border: number
  borderColor: string
}

export interface OutputLook {
  theme: boolean
  overlay: boolean
  lyrics: boolean
  textStyleId: string
  camera: CameraLayout
  media: boolean // mostrar imagens/vídeos/slides
}

export interface Scene {
  id: string
  name: string
  color: string
  themeId: string | null
  overlayId: string | null
  overlayOpacity: number
  outputs: Record<SceneOutputId, OutputLook>
  liveStyleId: string
}

// ---------- Culto ----------

export type ServiceItem =
  | { id: string; type: 'song'; songId: string }
  | { id: string; type: 'bible'; versionId: string; book: number; chapter: number; verseFrom: number; verseTo: number }
  | { id: string; type: 'media'; mediaId: string }
  | { id: string; type: 'pptx'; mediaId: string }
  | { id: string; type: 'note'; text: string }

// ---------- Estado ao vivo ----------

export interface LiveText {
  kind: 'song' | 'bible' | 'custom'
  title: string
  text: string // slide atual
  next: string // próximo slide
  reference?: string
  key: string // para transição
}

export interface LiveMedia {
  kind: 'image' | 'video' | 'capture'
  mediaId?: string
  name: string
  loop: boolean
  playing: boolean
  startedAt: number // epoch ms quando começou (playing)
  offset: number // segundos já tocados ao pausar
  nonce: number
  volume: number
}

export interface StageConfig {
  fontSize: number // % altura
  nextSize: number
  textColor: string
  nextColor: string
  showNext: boolean
  showClock: boolean
  clock24: boolean
  showPreview: boolean
  uppercase: boolean
  fontFamily: string
}

export interface TimerState {
  enabled: boolean
  durationSec: number
  running: boolean
  endsAt: number // quando running
  remaining: number // quando pausado (s)
  warnAt: number // segundos para amarelo
}

export interface AlertState {
  text: string
  visible: boolean
  position: 'top' | 'bottom'
  color: string
  bg: string
  outputs: Record<'telao' | 'laterais' | 'retorno', boolean>
  scroll: boolean
}

export interface LiveState {
  sceneId: string | null
  themeId: string | null
  overlayId: string | null
  overlayOpacity: number
  looks: Record<SceneOutputId, OutputLook>
  liveStyleId: string
  text: LiveText | null
  textVisible: boolean
  media: LiveMedia | null
  alert: AlertState
  stageMessage: string
  stageMessageVisible: boolean
  timer: TimerState
  black: boolean
  cameraDeviceId: string
  liveChroma: boolean
  captureCrop: Crop
}

export interface Crop { t: number; b: number; l: number; r: number }

// ---------- Snapshot resolvido enviado às saídas ----------

export interface ResolvedLook {
  theme: Theme | null
  overlay: Overlay | null
  overlayOpacity: number
  lyrics: boolean
  style: TextStyle
  camera: CameraLayout
  media: boolean
}

export interface Snapshot {
  v: number
  telao: ResolvedLook
  laterais: ResolvedLook
  liveStyle: TextStyle
  text: LiveText | null
  textVisible: boolean
  media: LiveMedia | null
  alert: AlertState
  stage: StageConfig
  stageMessage: string
  stageMessageVisible: boolean
  timer: TimerState
  black: boolean
  cameraDeviceId: string
  liveChroma: boolean
  captureCrop: Crop
}
