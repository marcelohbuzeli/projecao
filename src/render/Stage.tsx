import { useEffect, useState } from 'react'
import type { Snapshot, TimerState } from '../core/types'
import { AlertBar, MediaLayer } from './Layers'

const fill: React.CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%' }

export function useNow(ms = 250) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(iv)
  }, [ms])
  return now
}

export function fmtTimer(sec: number) {
  const neg = sec < 0
  const s = Math.abs(Math.round(sec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = s % 60
  const body = h ? `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
  return (neg ? '-' : '') + body
}

export function timerColor(t: TimerState, rem: number) {
  if (rem <= 0) return '#ff3b3b'
  if (rem <= t.warnAt) return '#ffd02b'
  return '#ffffff'
}

export function fmtClock(now: number, h24: boolean) {
  return new Date(now).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: !h24 })
}

/**
 * TV de retorno
 *  - Música / Bíblia: fundo preto, texto atual grande + começo do próximo, relógio e cronômetro.
 *  - Imagem / vídeo / slide: mídia em tela cheia com uma tarja em cima (relógio + cronômetro).
 */
export function StageView({ snap }: { snap: Snapshot }) {
  const now = useNow(250)
  const cfg = snap.stage
  const t = snap.timer
  const rem = t.running ? (t.endsAt - now) / 1000 : t.remaining
  const mediaMode = !!snap.media && !snap.black
  const text = snap.text && snap.textVisible ? snap.text : null
  const nextLine = text?.next ? text.next.split('\n')[0] : ''

  const clock = cfg.showClock ? fmtClock(now, cfg.clock24) : ''
  const timer = t.enabled ? fmtTimer(rem) : ''
  const tColor = timerColor(t, rem)

  const msg = snap.stageMessageVisible && snap.stageMessage ? (
    <div className="msg-pulse" style={{
      position: 'absolute', left: '4%', right: '4%', bottom: mediaMode ? '4%' : '5%', zIndex: 8,
      background: '#ffd02b', color: '#000', fontWeight: 800, fontSize: '6.5cqh', textAlign: 'center',
      padding: '1.6cqh 2cqh', borderRadius: '1.4cqh', fontFamily: 'Inter, sans-serif',
    }}>{snap.stageMessage}</div>
  ) : null

  if (mediaMode) {
    return (
      <div style={{ ...fill, background: '#000', containerType: 'size', overflow: 'hidden', fontFamily: `'${cfg.fontFamily}', Inter, sans-serif` }}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: '9cqh', bottom: 0 }}>
          <MediaLayer media={snap.media!} audible={false} crop={snap.captureCrop} />
        </div>
        <div style={{
          position: 'absolute', left: 0, right: 0, top: 0, height: '9cqh', background: '#111', display: 'flex',
          alignItems: 'center', justifyContent: 'space-between', padding: '0 3cqh', color: '#fff', fontWeight: 800,
          fontSize: '6cqh', fontVariantNumeric: 'tabular-nums', borderBottom: '0.3cqh solid #333',
        }}>
          <span>{clock}</span>
          <span style={{ fontSize: '3cqh', color: '#888', fontWeight: 600 }}>{snap.media!.name}</span>
          <span style={{ color: tColor }}>{timer}</span>
        </div>
        {snap.alert.visible && snap.alert.outputs.retorno && snap.alert.text && <AlertBar alert={{ ...snap.alert, position: 'bottom' }} />}
        {msg}
      </div>
    )
  }

  return (
    <div style={{ ...fill, background: '#000', containerType: 'size', overflow: 'hidden', color: cfg.textColor, fontFamily: `'${cfg.fontFamily}', Inter, sans-serif` }}>
      <div style={{
        position: 'absolute', left: '3cqh', right: '3cqh', top: '2cqh', height: '10cqh', display: 'flex',
        justifyContent: 'space-between', alignItems: 'center', fontWeight: 800, fontSize: '8cqh', fontVariantNumeric: 'tabular-nums',
      }}>
        <span>{clock}</span>
        <span style={{ color: tColor }}>{timer}</span>
      </div>
      <div style={{
        position: 'absolute', left: '4%', right: '4%', top: '14cqh', bottom: cfg.showNext ? '22cqh' : '6cqh',
        display: 'flex', flexDirection: 'column', justifyContent: 'center', overflow: 'hidden',
      }}>
        {text ? (
          <div key={text.key} className="txt-in" style={{
            fontSize: cfg.fontSize + 'cqh', fontWeight: 800, lineHeight: 1.12, whiteSpace: 'pre-line',
            textTransform: cfg.uppercase ? 'uppercase' : 'none', textAlign: 'left',
          }}>
            <StageFit text={text.text} base={cfg.fontSize} />
            {text.reference && <div style={{ fontSize: '0.5em', color: '#9ad', marginTop: '0.4em', textTransform: 'none' }}>{text.reference}</div>}
          </div>
        ) : (
          <div style={{ color: '#333', fontSize: '5cqh', textAlign: 'center' }}>—</div>
        )}
      </div>
      {cfg.showNext && nextLine && (
        <div style={{
          position: 'absolute', left: '4%', right: '4%', bottom: '5cqh', height: '15cqh', display: 'flex', alignItems: 'center',
          color: cfg.nextColor, fontSize: cfg.nextSize + 'cqh', fontWeight: 700, borderTop: '0.3cqh solid #222',
          textTransform: cfg.uppercase ? 'uppercase' : 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          ▸ {nextLine}
        </div>
      )}
      {snap.alert.visible && snap.alert.outputs.retorno && snap.alert.text && <AlertBar alert={snap.alert} />}
      {msg}
    </div>
  )
}

/** Versículos longos: reduz a fonte proporcionalmente ao tamanho do texto */
function StageFit({ text, base }: { text: string; base: number }) {
  const len = text.length
  const lines = text.split('\n').length
  const scale = Math.min(len > 400 ? 0.5 : len > 260 ? 0.62 : len > 160 ? 0.78 : 1, lines > 4 ? 4 / lines : 1)
  return <span style={{ fontSize: `${scale}em` }}>{text}</span>
}
