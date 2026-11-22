import type {
  CameraLayout, OutputLook, Scene, StageConfig, TextStyle, Theme, Overlay, TimerState, AlertState, LiveState, ShaderParams,
} from './types'

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)

export const defaultCamera = (): CameraLayout => ({
  enabled: false, x: 0, y: 0, w: 100, h: 100, fit: 'cover', blend: 'normal', opacity: 1,
  radius: 0, mirror: false, blur: 0, brightness: 1, saturation: 1, border: 0, borderColor: '#ffffff',
})

export const CAMERA_PRESETS: { name: string; cam: Partial<CameraLayout> }[] = [
  { name: 'Tela cheia', cam: { x: 0, y: 0, w: 100, h: 100, radius: 0, opacity: 1, blend: 'normal', border: 0 } },
  { name: 'Mesclada (fundo)', cam: { x: 0, y: 0, w: 100, h: 100, radius: 0, opacity: 0.45, blend: 'soft-light', border: 0 } },
  { name: 'Mesclada (tela)', cam: { x: 0, y: 0, w: 100, h: 100, radius: 0, opacity: 0.6, blend: 'screen', saturation: 0, border: 0 } },
  { name: 'Metade superior', cam: { x: 0, y: 0, w: 100, h: 62, radius: 0, opacity: 1, blend: 'normal', border: 0 } },
  { name: 'Metade esquerda', cam: { x: 0, y: 0, w: 50, h: 100, radius: 0, opacity: 1, blend: 'normal', border: 0 } },
  { name: 'Metade direita', cam: { x: 50, y: 0, w: 50, h: 100, radius: 0, opacity: 1, blend: 'normal', border: 0 } },
  { name: 'Janela canto', cam: { x: 66, y: 6, w: 30, h: 30, radius: 4, opacity: 1, blend: 'normal', border: 4 } },
  { name: 'Janela central', cam: { x: 15, y: 8, w: 70, h: 60, radius: 3, opacity: 1, blend: 'normal', border: 0 } },
]

export const baseStyle = (over: Partial<TextStyle> = {}): TextStyle => ({
  id: uid(), name: 'Estilo', fontFamily: 'Montserrat', fontSize: 7, fontWeight: 800, color: '#ffffff',
  uppercase: true, italic: false, align: 'center', vAlign: 'center',
  box: { x: 6, y: 8, w: 88, h: 84 }, lineHeight: 1.15, letterSpacing: 0, shadow: 0.6, outline: 0,
  outlineColor: '#000000', bgColor: '#000000', bgOpacity: 0, autoFit: true, refSize: 55, ...over,
})

export const defaultStyles = (): TextStyle[] => [
  baseStyle({ id: 'st-telao', name: 'Telão — pequena', fontSize: 5.2, box: { x: 10, y: 60, w: 80, h: 32 }, vAlign: 'center' }),
  baseStyle({ id: 'st-grande', name: 'Grande central', fontSize: 9, box: { x: 5, y: 8, w: 90, h: 84 } }),
  baseStyle({ id: 'st-laterais', name: 'Laterais — grande', fontSize: 8.5 }),
  baseStyle({
    id: 'st-live', name: 'Live — rodapé', fontFamily: 'Montserrat', fontSize: 5.4, fontWeight: 700, uppercase: false,
    box: { x: 8, y: 72, w: 84, h: 22 }, vAlign: 'bottom', shadow: 0.9, outline: 1.5,
  }),
  baseStyle({
    id: 'st-biblia', name: 'Bíblia — elegante', fontFamily: 'Playfair Display', fontWeight: 700, uppercase: false,
    fontSize: 6, align: 'center', lineHeight: 1.25,
  }),
]

export const defaultShaderParams = (): ShaderParams => ({
  colorA: '#1b0f3b', colorB: '#ff6a2b', colorC: '#3ad1ff', speed: 0.6, intensity: 1, scale: 1,
})

export const defaultThemes = (): Theme[] => [
  { id: 'th-preto', name: 'Preto', visual: { type: 'color', color: '#000000' }, dim: 0 },
  { id: 'th-aurora', name: 'Aurora', visual: { type: 'shader', shader: 'aurora', params: { ...defaultShaderParams(), colorA: '#070b24', colorB: '#3b2bff', colorC: '#19e3b1' } }, dim: 0.15 },
  { id: 'th-laranja', name: 'Laranja quente', visual: { type: 'gradient', colors: ['#ff7a18', '#7a1fa2'], angle: 135 }, dim: 0.1 },
  { id: 'th-nebulosa', name: 'Nebulosa', visual: { type: 'shader', shader: 'nebulosa', params: { ...defaultShaderParams(), colorA: '#05010f', colorB: '#8a2be2', colorC: '#ff4f9a' } }, dim: 0.1 },
  { id: 'th-ondas', name: 'Ondas azuis', visual: { type: 'shader', shader: 'ondas', params: { ...defaultShaderParams(), colorA: '#020617', colorB: '#0ea5e9', colorC: '#e0f2fe' } }, dim: 0.1 },
]

export const defaultOverlays = (): Overlay[] => [
  { id: 'ov-particulas', name: 'Partículas', visual: { type: 'shader', shader: 'particulas', params: { ...defaultShaderParams(), colorA: '#000000', colorB: '#ffffff', colorC: '#ffd27a', speed: 0.4 } }, blend: 'screen', opacity: 0.8 },
  { id: 'ov-raios', name: 'Raios de luz', visual: { type: 'shader', shader: 'raios', params: { ...defaultShaderParams(), colorA: '#000000', colorB: '#fff3d6', colorC: '#ffb347', speed: 0.3 } }, blend: 'screen', opacity: 0.7 },
  { id: 'ov-bokeh', name: 'Bokeh', visual: { type: 'shader', shader: 'bokeh', params: { ...defaultShaderParams(), colorA: '#000000', colorB: '#ffcf8a', colorC: '#8ad8ff', speed: 0.3 } }, blend: 'screen', opacity: 0.6 },
  { id: 'ov-vinheta', name: 'Vinheta escura', visual: { type: 'gradient', colors: ['#00000000', '#000000'], angle: -1 }, blend: 'normal', opacity: 0.8 },
]

export const defaultLook = (over: Partial<OutputLook> = {}): OutputLook => ({
  theme: true, overlay: true, lyrics: true, textStyleId: 'st-grande', camera: defaultCamera(), media: true, ...over,
})

export const defaultScenes = (): Scene[] => [
  {
    id: 'sc-louvor', name: 'Louvor', color: '#7c3aed', themeId: 'th-aurora', overlayId: 'ov-particulas', overlayOpacity: 0.8,
    outputs: { telao: defaultLook({ textStyleId: 'st-grande' }), laterais: defaultLook({ textStyleId: 'st-laterais' }) },
    liveStyleId: 'st-live',
  },
  {
    id: 'sc-louvor-cam', name: 'Louvor + câmera', color: '#ea580c', themeId: 'th-laranja', overlayId: 'ov-raios', overlayOpacity: 0.6,
    outputs: {
      telao: defaultLook({ textStyleId: 'st-telao', camera: { ...defaultCamera(), enabled: true, opacity: 0.45, blend: 'soft-light' } }),
      laterais: defaultLook({ textStyleId: 'st-laterais', theme: true, camera: { ...defaultCamera(), enabled: false } }),
    },
    liveStyleId: 'st-live',
  },
  {
    id: 'sc-pregacao', name: 'Pregação', color: '#0891b2', themeId: 'th-preto', overlayId: null, overlayOpacity: 1,
    outputs: {
      telao: defaultLook({ textStyleId: 'st-biblia' }),
      laterais: defaultLook({ textStyleId: 'st-biblia', lyrics: false, camera: { ...defaultCamera(), enabled: true } }),
    },
    liveStyleId: 'st-live',
  },
  {
    id: 'sc-camera', name: 'Só câmera nas laterais', color: '#16a34a', themeId: 'th-nebulosa', overlayId: null, overlayOpacity: 1,
    outputs: {
      telao: defaultLook({ textStyleId: 'st-grande' }),
      laterais: defaultLook({ textStyleId: 'st-laterais', lyrics: false, camera: { ...defaultCamera(), enabled: true } }),
    },
    liveStyleId: 'st-live',
  },
]

export const defaultStage = (): StageConfig => ({
  fontSize: 9, nextSize: 5, textColor: '#ffffff', nextColor: '#8b8b8b', showNext: true, showClock: true,
  clock24: true, showPreview: true, uppercase: true, fontFamily: 'Inter',
})

export const defaultTimer = (): TimerState => ({
  enabled: false, durationSec: 30 * 60, running: false, endsAt: 0, remaining: 30 * 60, warnAt: 5 * 60,
})

export const defaultAlert = (): AlertState => ({
  text: '', visible: false, position: 'bottom', color: '#ffffff', bg: '#dc2626',
  outputs: { telao: true, laterais: true, retorno: true }, scroll: false,
})

export const defaultLive = (): LiveState => {
  const sc = defaultScenes()[0]
  return {
    sceneId: sc.id, themeId: sc.themeId, overlayId: sc.overlayId, overlayOpacity: sc.overlayOpacity,
    looks: structuredClone(sc.outputs), liveStyleId: sc.liveStyleId,
    text: null, textVisible: true, media: null, alert: defaultAlert(),
    stageMessage: '', stageMessageVisible: false, timer: defaultTimer(), black: false,
    cameraDeviceId: '', liveChroma: false, captureCrop: { t: 0, b: 0, l: 0, r: 0 },
  }
}

export const DEMO_SONG_TEXT = `Música de exemplo
Apague ou edite esta música

[Verso 1]
Esta é a primeira linha do verso
E esta é a segunda linha

[Verso 2]
Clique em um slide para enviar ao telão
Use as setas ou o passador para avançar

[Refrão]
Este é o refrão de exemplo
Botão direito na música para editar

[Final]
Importe suas músicas na Biblioteca`
