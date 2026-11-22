import { TriangleAlert, Timer, Image as ImageIcon, Sparkles, Layers, Pause, Play, RotateCcw } from 'lucide-react'
import { useStore, actions, setLive, timerRemaining } from '../../core/store'
import { useUI, setUI } from '../../ui/uiStore'
import { useState } from 'react'
import { Tabs, VisualThumb, Btn, Slider, Toggle, Select, ColorField, Gallery } from '../../ui/common'
import { CAMERA_PRESETS } from '../../core/defaults'
import type { SceneOutputId } from '../../core/types'
import { fmtTimer, timerColor, useNow } from '../../render/Stage'
import { cameraDesc } from '../../ui/SceneCard'

const H_KEY = 'projecao-bottom-h'
const readH = () => {
  try {
    return Math.max(160, Math.min(700, parseInt(localStorage.getItem(H_KEY) || '') || Math.round(window.innerHeight * 0.3)))
  } catch {
    return Math.round(window.innerHeight * 0.3)
  }
}

export function BottomPanel() {
  const tab = useUI((u) => u.bottomTab)
  const [h, setH] = useState(readH)
  const startResize = (e: React.PointerEvent) => {
    e.preventDefault()
    const y0 = e.clientY
    const h0 = h
    let cur = h0
    const move = (ev: PointerEvent) => {
      cur = Math.max(160, Math.min(window.innerHeight * 0.7, h0 - (ev.clientY - y0)))
      setH(cur)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      try {
        localStorage.setItem(H_KEY, String(Math.round(cur)))
      } catch {
        /* ignore */
      }
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }
  return (
    <section className="bottom-panel" style={{ height: h }}>
      <div className="resize-handle" onPointerDown={startResize} title="Arraste para aumentar ou diminuir" />
      <Tabs
        value={tab}
        onChange={(v) => setUI({ bottomTab: v })}
        tabs={[
          { id: 'themes', label: <><ImageIcon size={14} /> Temas</> },
          { id: 'overlays', label: <><Sparkles size={14} /> Sobreposição</> },
          { id: 'layers', label: <><Layers size={14} /> Camadas</> },
          { id: 'alert', label: <><TriangleAlert size={14} /> Aviso</> },
          { id: 'stage', label: <><Timer size={14} /> Retorno</> },
        ]}
      />
      <div className="bp-body">
        {tab === 'themes' && <ThemesStrip />}
        {tab === 'overlays' && <OverlaysStrip />}
        {tab === 'layers' && <LayersQuick />}
        {tab === 'alert' && <AlertQuick />}
        {tab === 'stage' && <StageQuick />}
      </div>
    </section>
  )
}

function ThemesStrip() {
  const themes = useStore((s) => s.themes)
  const cur = useStore((s) => s.live.themeId)
  return (
    <Gallery>
      <VisualThumb visual={{ type: 'none' }} label="Nenhum" active={!cur} onClick={() => actions.setTheme(null)} />
      {themes.map((t) => (
        <VisualThumb key={t.id} visual={t.visual} label={t.name} active={cur === t.id} onClick={() => actions.setTheme(t.id)} />
      ))}
      <button className="vthumb add" onClick={() => setUI({ page: 'library', libraryTab: 'themes' })}>
        <div className="vthumb-img">+</div>
        <span className="vthumb-label">Novo tema</span>
      </button>
    </Gallery>
  )
}

function OverlaysStrip() {
  const overlays = useStore((s) => s.overlays)
  const cur = useStore((s) => s.live.overlayId)
  const op = useStore((s) => s.live.overlayOpacity)
  return (
    <div className="strip-wrap">
      <div className="ov-intensity">
        <Slider label="Intensidade" min={0} max={1} step={0.05} value={op} onChange={(v) => setLive((l) => ({ ...l, overlayOpacity: v }))} />
      </div>
      <Gallery>
        <VisualThumb visual={{ type: 'none' }} label="Nenhuma" active={!cur} onClick={() => actions.setOverlay(null)} />
        {overlays.map((t) => (
          <VisualThumb key={t.id} visual={t.visual} label={t.name} badge={t.blend !== 'normal' ? t.blend : undefined} active={cur === t.id} onClick={() => actions.setOverlay(t.id)} />
        ))}
        <button className="vthumb add" onClick={() => setUI({ page: 'library', libraryTab: 'overlays' })}>
          <div className="vthumb-img">+</div>
          <span className="vthumb-label">Nova</span>
        </button>
      </Gallery>
    </div>
  )
}

function LayersQuick() {
  const looks = useStore((s) => s.live.looks)
  const styles = useStore((s) => s.styles)
  const liveStyleId = useStore((s) => s.live.liveStyleId)
  const row = (out: SceneOutputId, label: string) => {
    const l = looks[out]
    const preset = cameraDesc(l.camera) || 'Desligada'
    return (
      <div className="layer-row">
        <b>{label}</b>
        <Toggle label="Fundo" value={l.theme} onChange={(v) => actions.setLook(out, { theme: v })} />
        <Toggle label="Sobreposição" value={l.overlay} onChange={(v) => actions.setLook(out, { overlay: v })} />
        <Toggle label="Letra" value={l.lyrics} onChange={(v) => actions.setLook(out, { lyrics: v })} />
        <Toggle label="Mídia/slides" value={l.media} onChange={(v) => actions.setLook(out, { media: v })} />
        <Toggle label="Câmera" value={l.camera.enabled} onChange={(v) => actions.setLook(out, { camera: { ...l.camera, enabled: v } })} />
        <select
          value={l.camera.enabled ? preset : ''}
          onChange={(e) => {
            const p = CAMERA_PRESETS.find((x) => x.name === e.target.value)
            if (p) actions.setLook(out, { camera: { ...l.camera, ...p.cam, enabled: true } })
          }}
        >
          <option value="">Posição da câmera…</option>
          {CAMERA_PRESETS.map((p) => (
            <option key={p.name} value={p.name}>{p.name}</option>
          ))}
          {l.camera.enabled && !CAMERA_PRESETS.some((p) => p.name === preset) && <option value={preset}>{preset}</option>}
        </select>
        <select value={l.textStyleId} onChange={(e) => actions.setLook(out, { textStyleId: e.target.value })} title="Estilo da letra">
          {styles.map((s) => (
            <option key={s.id} value={s.id}>Aa {s.name}</option>
          ))}
        </select>
      </div>
    )
  }
  return (
    <div className="layers-quick">
      {row('telao', 'Telão')}
      {row('laterais', 'Laterais')}
      <div className="layer-row">
        <b>Live (OBS)</b>
        <select value={liveStyleId} onChange={(e) => setLive((l) => ({ ...l, liveStyleId: e.target.value }))}>
          {styles.map((s) => (
            <option key={s.id} value={s.id}>Aa {s.name}</option>
          ))}
        </select>
        <span className="hint">Ajustes aqui valem só para o momento. Para guardar, salve como cena em Programação.</span>
      </div>
    </div>
  )
}

const ALERT_TEMPLATES = [
  'Proprietário do veículo placa ____, favor comparecer à recepção.',
  'Responsável pela criança ____, favor comparecer ao ministério infantil.',
  'Atenção: ____',
]

function AlertQuick() {
  const a = useStore((s) => s.live.alert)
  const set = (p: Partial<typeof a>) => setLive((l) => ({ ...l, alert: { ...l.alert, ...p } }))
  return (
    <div className="alert-quick">
      <div className="aq-main">
        <textarea value={a.text} placeholder="Texto do aviso que aparece nas telas…" onChange={(e) => set({ text: e.target.value })} rows={3} />
        <div className="row wrap">
          {ALERT_TEMPLATES.map((t) => (
            <button key={t} className="chip" onClick={() => set({ text: t })}>{t.slice(0, 38)}…</button>
          ))}
        </div>
      </div>
      <div className="aq-side">
        <div className="row wrap">
          <Toggle label="Telão" value={a.outputs.telao} onChange={(v) => set({ outputs: { ...a.outputs, telao: v } })} />
          <Toggle label="Laterais" value={a.outputs.laterais} onChange={(v) => set({ outputs: { ...a.outputs, laterais: v } })} />
          <Toggle label="Retorno" value={a.outputs.retorno} onChange={(v) => set({ outputs: { ...a.outputs, retorno: v } })} />
          <Toggle label="Rolando" value={a.scroll} onChange={(v) => set({ scroll: v })} />
        </div>
        <div className="row">
          <Select value={a.position} onChange={(v) => set({ position: v })} options={[{ value: 'bottom', label: 'Embaixo' }, { value: 'top', label: 'Em cima' }]} />
          <ColorField label="Fundo" value={a.bg} onChange={(v) => set({ bg: v })} />
          <ColorField label="Texto" value={a.color} onChange={(v) => set({ color: v })} />
        </div>
        <Btn kind={a.visible ? 'danger' : 'warn'} onClick={() => set({ visible: !a.visible })} style={{ width: '100%' }}>
          {a.visible ? 'Esconder aviso' : 'Mostrar aviso'}
        </Btn>
      </div>
    </div>
  )
}

export function TimerControls() {
  const t = useStore((s) => s.live.timer)
  const presets = useStore((s) => s.settings.timerPresets)
  useNow(250)
  const rem = timerRemaining(t)
  return (
    <div className="timer-ctl">
      <div className="timer-display" style={{ color: t.enabled ? timerColor(t, rem) : '#555' }}>{fmtTimer(rem)}</div>
      <div className="row wrap">
        <Toggle label="Mostrar no retorno" value={t.enabled} onChange={(v) => setLive((l) => ({ ...l, timer: { ...l.timer, enabled: v } }))} />
      </div>
      <div className="row wrap">
        {presets.map((m) => (
          <button key={m} className="chip" onClick={() => actions.timerReset(m * 60)}>{m} min</button>
        ))}
        <input
          type="number"
          min={1}
          className="num"
          title="Minutos personalizados"
          placeholder="min"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const v = parseFloat((e.target as HTMLInputElement).value)
              if (v > 0) actions.timerReset(v * 60)
            }
          }}
        />
      </div>
      <div className="row wrap">
        {t.running ? <Btn kind="warn" icon={Pause} onClick={actions.timerPause}>Pausar</Btn> : <Btn kind="primary" icon={Play} onClick={() => actions.timerStart()}>Iniciar</Btn>}
        <Btn icon={RotateCcw} onClick={() => actions.timerReset()}>Zerar</Btn>
        <Btn onClick={() => actions.timerAdd(60)}>+1 min</Btn>
        <Btn onClick={() => actions.timerAdd(-60)}>−1 min</Btn>
      </div>
    </div>
  )
}

export function StageMessageControls() {
  const msg = useStore((s) => s.live.stageMessage)
  const vis = useStore((s) => s.live.stageMessageVisible)
  const quick = ['Encerrar', 'Mais 5 minutos', 'Mais 10 minutos', 'Chamar os músicos', 'Microfone com problema']
  return (
    <div className="stage-msg">
      <div className="row">
        <input value={msg} placeholder="Mensagem só para o pregador (TV de retorno)…" onChange={(e) => setLive((l) => ({ ...l, stageMessage: e.target.value }))} onKeyDown={(e) => e.key === 'Enter' && setLive((l) => ({ ...l, stageMessageVisible: true }))} />
        <Btn kind={vis ? 'danger' : 'warn'} onClick={() => setLive((l) => ({ ...l, stageMessageVisible: !l.stageMessageVisible }))}>{vis ? 'Esconder' : 'Mostrar'}</Btn>
      </div>
      <div className="row wrap">
        {quick.map((q) => (
          <button key={q} className="chip" onClick={() => setLive((l) => ({ ...l, stageMessage: q, stageMessageVisible: true }))}>{q}</button>
        ))}
      </div>
    </div>
  )
}

function StageQuick() {
  return (
    <div className="stage-quick">
      <TimerControls />
      <StageMessageControls />
    </div>
  )
}
