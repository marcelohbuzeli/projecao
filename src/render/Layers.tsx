import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Crop, CameraLayout, LiveMedia, ResolvedLook, Snapshot, TextStyle, Visual, AlertState } from '../core/types'
import { blobUrl } from '../core/db'
import { ShaderCanvas } from './ShaderCanvas'

const fill: React.CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%' }

// ---------------- arquivos ----------------
export function useBlobUrl(id?: string) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    setUrl(null)
    if (id) blobUrl(id).then((u) => alive && setUrl(u))
    return () => {
      alive = false
    }
  }, [id])
  return url
}

// ---------------- Visual (tema / sobreposição) ----------------
export function VisualView({ visual, maxW, quality = 'full' }: { visual: Visual; maxW?: number; quality?: 'full' | 'thumb' }) {
  switch (visual.type) {
    case 'none':
      return null
    case 'color':
      return <div style={{ ...fill, background: visual.color }} />
    case 'gradient': {
      const [a, b] = visual.colors
      const bg = visual.angle < 0 ? `radial-gradient(ellipse at center, ${a} 30%, ${b} 100%)` : `linear-gradient(${visual.angle}deg, ${a}, ${b})`
      return <div style={{ ...fill, background: bg }} />
    }
    case 'media':
      return <MediaVisual mediaId={visual.mediaId} kind={visual.kind} fit={visual.fit ?? 'cover'} thumb={quality === 'thumb'} />
    case 'shader':
      return <ShaderCanvas name={visual.shader} params={visual.params} maxW={maxW ?? (quality === 'thumb' ? 320 : 1600)} />
  }
}

function MediaVisual({ mediaId, kind, fit, thumb }: { mediaId: string; kind?: 'image' | 'video'; fit: 'cover' | 'contain'; thumb: boolean }) {
  const url = useBlobUrl(mediaId)
  const [isVideo, setIsVideo] = useState<boolean | null>(kind ? kind === 'video' : null)
  useEffect(() => {
    if (!url || kind) return
    fetch(url)
      .then((r) => r.blob())
      .then((b) => setIsVideo(b.type.startsWith('video')))
      .catch(() => setIsVideo(false))
  }, [url])
  if (!url || isVideo === null) return null
  if (isVideo) return <video src={url} autoPlay loop muted playsInline style={{ ...fill, objectFit: fit }} />
  return <img src={url} style={{ ...fill, objectFit: fit }} draggable={false} />
}

// ---------------- Câmera ----------------
const camCache = new Map<string, Promise<MediaStream | null>>()
export function getCameraStream(deviceId: string): Promise<MediaStream | null> {
  let p = camCache.get(deviceId)
  if (!p) {
    p = navigator.mediaDevices
      .getUserMedia({
        audio: false,
        video: {
          ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 },
        },
      })
      .catch((e) => {
        console.warn('câmera', e)
        camCache.delete(deviceId)
        return null
      })
    camCache.set(deviceId, p)
  }
  return p
}

function CameraFeed({ cam, deviceId }: { cam: CameraLayout; deviceId: string }) {
  const ref = useRef<HTMLVideoElement>(null)
  const [err, setErr] = useState(false)
  useEffect(() => {
    let alive = true
    getCameraStream(deviceId).then((s) => {
      if (!alive || !ref.current) return
      if (!s) return setErr(true)
      setErr(false)
      ref.current.srcObject = s
      ref.current.play().catch(() => {})
    })
    return () => {
      alive = false
    }
  }, [deviceId])
  const minD = 'min(100cqw, 100cqh)'
  return (
    <div
      style={{
        position: 'absolute',
        zIndex: 3,
        left: cam.x + '%',
        top: cam.y + '%',
        width: cam.w + '%',
        height: cam.h + '%',
        mixBlendMode: cam.blend as any,
        opacity: cam.opacity,
        borderRadius: `calc(${minD} * ${cam.radius / 100})`,
        overflow: 'hidden',
        boxShadow: cam.border ? `0 0 0 calc(${cam.border} * 100cqh / 1080) ${cam.borderColor}` : undefined,
        background: '#000',
      }}
    >
      <video
        ref={ref}
        muted
        playsInline
        autoPlay
        style={{
          ...fill,
          objectFit: cam.fit,
          transform: cam.mirror ? 'scaleX(-1)' : undefined,
          filter: `blur(${cam.blur}px) brightness(${cam.brightness}) saturate(${cam.saturation})`,
        }}
      />
      {err && (
        <div style={{ ...fill, display: 'grid', placeItems: 'center', color: '#fff8', fontSize: '3cqh', fontFamily: 'Inter' }}>
          Câmera indisponível
        </div>
      )}
    </div>
  )
}

// ---------------- Texto (letra / bíblia) ----------------
export function TextBlock({ style, text, reference, k }: { style: TextStyle; text: string; reference?: string; k: string }) {
  const boxRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const box = boxRef.current
    const inner = innerRef.current
    if (!box || !inner) return
    const fit = () => {
      let f = 1
      inner.style.setProperty('--fit', '1')
      if (!style.autoFit) return
      for (let i = 0; i < 14; i++) {
        if (inner.scrollHeight <= box.clientHeight + 1 && inner.scrollWidth <= box.clientWidth + 1) break
        f *= 0.9
        inner.style.setProperty('--fit', String(f))
      }
    }
    fit()
    document.fonts?.ready.then(fit)
    const ro = new ResizeObserver(fit)
    ro.observe(box)
    return () => ro.disconnect()
  }, [text, reference, style])
  const stroke = style.outline > 0 ? `calc(${style.outline} * 100cqh / 1080 * var(--fit))` : undefined
  const justify = style.vAlign === 'top' ? 'flex-start' : style.vAlign === 'bottom' ? 'flex-end' : 'center'
  return (
    <div
      ref={boxRef}
      style={{
        position: 'absolute',
        left: style.box.x + '%',
        top: style.box.y + '%',
        width: style.box.w + '%',
        height: style.box.h + '%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: justify,
        alignItems: style.align === 'left' ? 'flex-start' : style.align === 'right' ? 'flex-end' : 'center',
        overflow: 'hidden',
      }}
    >
      <div
        key={k}
        ref={innerRef}
        className="txt-in"
        style={{
          fontFamily: `'${style.fontFamily}', Inter, sans-serif`,
          fontSize: `calc(${style.fontSize}cqh * var(--fit, 1))`,
          fontWeight: style.fontWeight,
          fontStyle: style.italic ? 'italic' : 'normal',
          color: style.color,
          textTransform: style.uppercase ? 'uppercase' : 'none',
          textAlign: style.align,
          lineHeight: style.lineHeight,
          letterSpacing: style.letterSpacing + 'em',
          whiteSpace: 'pre-line',
          textShadow: style.shadow > 0 ? `0 0.25cqh 1.2cqh rgba(0,0,0,${style.shadow}), 0 0 0.3cqh rgba(0,0,0,${style.shadow * 0.6})` : 'none',
          WebkitTextStroke: stroke ? `${stroke} ${style.outlineColor}` : undefined,
          paintOrder: 'stroke fill',
          background: style.bgOpacity > 0 ? hexA(style.bgColor, style.bgOpacity) : undefined,
          padding: style.bgOpacity > 0 ? '0.6cqh 1.4cqh' : undefined,
          borderRadius: style.bgOpacity > 0 ? '0.8cqh' : undefined,
          maxWidth: '100%',
          overflowWrap: 'break-word',
        }}
      >
        {text}
        {reference && (
          <div style={{ fontSize: style.refSize + '%', marginTop: '0.5em', opacity: 0.85, fontWeight: Math.min(style.fontWeight, 600), textTransform: 'none' }}>
            {reference}
          </div>
        )}
      </div>
    </div>
  )
}

export const hexA = (hex: string, a: number) => {
  const m = hex.replace('#', '')
  const n = parseInt(m.length === 3 ? m.split('').map((c) => c + c).join('') : m.slice(0, 6), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}

// ---------------- Mídia (imagem / vídeo / captura do PowerPoint) ----------------
declare global {
  interface Window {
    __captureStream?: MediaStream | null
  }
}

export function getCaptureStream(): MediaStream | null {
  const own = window.__captureStream
  if (own && own.active) return own
  try {
    const op = window.opener as Window | null
    const s = op?.__captureStream
    if (s && s.active) return s
  } catch {
    /* cross-origin */
  }
  return null
}

export function MediaLayer({ media, audible, contain = true, crop }: { media: LiveMedia; audible: boolean; contain?: boolean; crop?: Crop }) {
  if (media.kind === 'capture') return <CaptureView nonce={media.nonce} crop={crop} />
  if (media.kind === 'image') return <ImageView id={media.mediaId!} contain={contain} />
  return <VideoView media={media} audible={audible} contain={contain} />
}

function ImageView({ id, contain }: { id: string; contain: boolean }) {
  const url = useBlobUrl(id)
  return <div style={{ ...fill, background: '#000' }}>{url && <img src={url} className="fade-in" style={{ ...fill, objectFit: contain ? 'contain' : 'cover' }} draggable={false} />}</div>
}

function VideoView({ media, audible, contain }: { media: LiveMedia; audible: boolean; contain: boolean }) {
  const url = useBlobUrl(media.mediaId)
  const ref = useRef<HTMLVideoElement>(null)
  const mRef = useRef(media)
  mRef.current = media
  useEffect(() => {
    const v = ref.current
    if (!v || !url) return
    const expected = () => {
      const m = mRef.current
      let pos = m.playing ? m.offset + (Date.now() - m.startedAt) / 1000 : m.offset
      if (v.duration && isFinite(v.duration)) pos = m.loop ? pos % v.duration : Math.min(pos, v.duration - 0.05)
      return Math.max(0, pos)
    }
    const sync = () => {
      const m = mRef.current
      if (!v.duration) return
      const exp = expected()
      if (Math.abs(v.currentTime - exp) > 0.35) v.currentTime = exp
      if (m.playing && v.paused && !(v.ended && !m.loop)) v.play().catch(() => {})
      if (!m.playing && !v.paused) v.pause()
    }
    v.addEventListener('loadedmetadata', sync)
    const iv = setInterval(sync, 1000)
    sync()
    return () => {
      clearInterval(iv)
      v.removeEventListener('loadedmetadata', sync)
    }
  }, [url, media.nonce, media.playing, media.loop, media.offset, media.startedAt])
  useEffect(() => {
    if (ref.current) ref.current.volume = media.volume
  }, [media.volume])
  return (
    <div style={{ ...fill, background: '#000' }}>
      {url && <video ref={ref} src={url} loop={media.loop} muted={!audible} playsInline autoPlay style={{ ...fill, objectFit: contain ? 'contain' : 'cover' }} />}
    </div>
  )
}

function CaptureView({ nonce, crop }: { nonce: number; crop?: Crop }) {
  const ref = useRef<HTMLVideoElement>(null)
  const [ok, setOk] = useState(true)
  useEffect(() => {
    let cur: MediaStream | null = null
    const attach = () => {
      const s = getCaptureStream()
      if (s !== cur && ref.current) {
        cur = s
        ref.current.srcObject = s
        if (s) ref.current.play().catch(() => {})
      }
      setOk(!!s)
    }
    attach()
    const iv = setInterval(attach, 1000)
    return () => clearInterval(iv)
  }, [nonce])
  return (
    <div style={{ ...fill, background: '#000' }}>
      {crop && (crop.t || crop.b || crop.l || crop.r) ? (
        <div style={{
          position: 'absolute',
          left: `${(-crop.l / (100 - crop.l - crop.r)) * 100}%`,
          top: `${(-crop.t / (100 - crop.t - crop.b)) * 100}%`,
          width: `${(100 * 100) / (100 - crop.l - crop.r)}%`,
          height: `${(100 * 100) / (100 - crop.t - crop.b)}%`,
        }}>
          <video ref={ref} muted playsInline autoPlay style={{ ...fill, objectFit: 'fill' }} />
        </div>
      ) : (
        <video ref={ref} muted playsInline autoPlay style={{ ...fill, objectFit: 'contain' }} />
      )}
      {!ok && (
        <div style={{ ...fill, display: 'grid', placeItems: 'center', color: '#fff6', fontFamily: 'Inter', fontSize: '3cqh' }}>
          Aguardando captura do PowerPoint…
        </div>
      )}
    </div>
  )
}

// ---------------- Aviso ----------------
export function AlertBar({ alert }: { alert: AlertState }) {
  return (
    <div
      className="alert-in"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        [alert.position]: 0,
        background: alert.bg,
        color: alert.color,
        fontFamily: 'Inter, sans-serif',
        fontWeight: 700,
        fontSize: '4.2cqh',
        padding: '1.6cqh 3cqh',
        overflow: 'hidden',
        whiteSpace: alert.scroll ? 'nowrap' : 'normal',
        textAlign: 'center',
        zIndex: 6,
      }}
    >
      {alert.scroll ? <div className="marquee">{alert.text}</div> : alert.text}
    </div>
  )
}

// ---------------- Composição das saídas Telão / Laterais ----------------
export function Composite({ look, snap, audible = false, preview = false, out }: { look: ResolvedLook; snap: Snapshot; audible?: boolean; preview?: boolean; out?: 'telao' | 'laterais' }) {
  const maxW = preview ? 480 : 1920
  const showText = look.lyrics && snap.text && snap.textVisible
  const showMedia = look.media && snap.media
  return (
    <div className="out-root" style={{ ...fill, background: '#000', overflow: 'hidden', isolation: 'isolate', containerType: 'size' }}>
      {look.theme && (
        <div style={{ ...fill, zIndex: 1 }}>
          <VisualView visual={look.theme.visual} maxW={maxW} />
          {look.theme.dim > 0 && <div style={{ ...fill, background: `rgba(0,0,0,${look.theme.dim})` }} />}
        </div>
      )}
      {look.overlay && (
        <div style={{ ...fill, zIndex: 2, mixBlendMode: look.overlay.blend as any, opacity: look.overlay.opacity * look.overlayOpacity }}>
          <VisualView visual={look.overlay.visual} maxW={maxW} />
        </div>
      )}
      {look.camera.enabled && <CameraFeed cam={look.camera} deviceId={snap.cameraDeviceId} />}
      {showText && (
        <div style={{ ...fill, zIndex: 4 }}>
          <TextBlock style={look.style} text={snap.text!.text} reference={snap.text!.reference} k={snap.text!.key} />
        </div>
      )}
      {showMedia && (
        <div style={{ ...fill, zIndex: 5 }}>
          <MediaLayer media={snap.media!} audible={audible} crop={snap.captureCrop} />
        </div>
      )}
      {snap.alert.visible && snap.alert.text && (!out || snap.alert.outputs[out]) && <AlertBar alert={snap.alert} />}
      {snap.black && <div style={{ ...fill, background: '#000', zIndex: 9 }} />}
    </div>
  )
}

// ---------------- Saída da Live (OBS) ----------------
export function LiveComposite({ snap }: { snap: Snapshot }) {
  const show = snap.text && snap.textVisible && !snap.black
  return (
    <div style={{ ...fill, background: snap.liveChroma ? '#00ff00' : 'transparent', overflow: 'hidden', containerType: 'size' }}>
      {show && <TextBlock style={snap.liveStyle} text={snap.text!.text} reference={snap.text!.reference} k={snap.text!.key} />}
    </div>
  )
}
