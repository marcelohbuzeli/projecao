import { useEffect, useState, type ReactNode } from 'react'
import type { BlendMode, Visual, Snapshot, ResolvedLook } from '../core/types'
import { useStore } from '../core/store'
import { Composite, LiveComposite } from '../render/Layers'
import { StageView } from '../render/Stage'

export function Btn({ children, onClick, kind = 'default', title, small, active, disabled, style }: {
  children: ReactNode; onClick?: (e: React.MouseEvent) => void; kind?: 'default' | 'primary' | 'danger' | 'ghost' | 'warn'
  title?: string; small?: boolean; active?: boolean; disabled?: boolean; style?: React.CSSProperties
}) {
  return (
    <button className={`btn btn-${kind}${small ? ' btn-sm' : ''}${active ? ' active' : ''}`} onClick={onClick} title={title} disabled={disabled} style={style}>
      {children}
    </button>
  )
}

export function Field({ label, children, row }: { label: string; children: ReactNode; row?: boolean }) {
  return (
    <label className={'field' + (row ? ' field-row' : '')}>
      <span>{label}</span>
      {children}
    </label>
  )
}

export function Slider({ label, value, min, max, step = 1, onChange, suffix = '' }: {
  label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; suffix?: string
}) {
  return (
    <label className="field slider">
      <span>
        {label} <b>{Number.isInteger(step) ? Math.round(value) : value.toFixed(2)}{suffix}</b>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} />
    </label>
  )
}

export function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="field color-field">
      <span>{label}</span>
      <div>
        <input type="color" value={value.slice(0, 7)} onChange={(e) => onChange(e.target.value)} />
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} />
      </div>
    </label>
  )
}

export function Toggle({ label, value, onChange, title }: { label: string; value: boolean; onChange: (v: boolean) => void; title?: string }) {
  return (
    <label className={'toggle' + (value ? ' on' : '')} title={title}>
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
      <i />
      <span>{label}</span>
    </label>
  )
}

export function Select<T extends string>({ label, value, options, onChange }: {
  label?: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void
}) {
  const sel = (
    <select value={value} onChange={(e) => onChange(e.target.value as T)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
  return label ? <Field label={label}>{sel}</Field> : sel
}

export function Tabs<T extends string>({ value, tabs, onChange, small }: { value: T; tabs: { id: T; label: ReactNode }[]; onChange: (v: T) => void; small?: boolean }) {
  return (
    <div className={'tabs' + (small ? ' tabs-sm' : '')}>
      {tabs.map((t) => (
        <button key={t.id} className={t.id === value ? 'on' : ''} onClick={() => onChange(t.id)}>
          {t.label}
        </button>
      ))}
    </div>
  )
}

export function Modal({ title, children, onClose, wide, footer }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean; footer?: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={'modal' + (wide ? ' wide' : '')}>
        <header>
          <h3>{title}</h3>
          <button className="x" onClick={onClose}>✕</button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer>{footer}</footer>}
      </div>
    </div>
  )
}

export const BLEND_OPTIONS: { value: BlendMode; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'screen', label: 'Tela (clarear)' },
  { value: 'multiply', label: 'Multiplicar (escurecer)' },
  { value: 'overlay', label: 'Sobrepor' },
  { value: 'soft-light', label: 'Luz suave' },
  { value: 'hard-light', label: 'Luz forte' },
  { value: 'lighten', label: 'Clarear' },
  { value: 'darken', label: 'Escurecer' },
  { value: 'color-dodge', label: 'Subexposição de cor' },
  { value: 'color-burn', label: 'Superexposição de cor' },
  { value: 'difference', label: 'Diferença' },
  { value: 'exclusion', label: 'Exclusão' },
  { value: 'luminosity', label: 'Luminosidade' },
]

/** Miniatura estática (sem WebGL) de um fundo */
export function visualCss(v: Visual, mediaThumb?: string): React.CSSProperties {
  switch (v.type) {
    case 'none':
      return { background: 'repeating-conic-gradient(#222 0 25%, #2a2a2a 0 50%) 0 0/16px 16px' }
    case 'color':
      return { background: v.color }
    case 'gradient':
      return { background: v.angle < 0 ? `radial-gradient(ellipse, ${v.colors[0]} 30%, ${v.colors[1]})` : `linear-gradient(${v.angle}deg, ${v.colors[0]}, ${v.colors[1]})` }
    case 'media':
      return { background: mediaThumb ? `#000 url(${mediaThumb}) center/cover` : '#111' }
    case 'shader':
      return {
        background: `radial-gradient(circle at 30% 70%, ${v.params.colorB}aa, transparent 55%), radial-gradient(circle at 75% 30%, ${v.params.colorC}88, transparent 50%), ${v.params.colorA}`,
      }
  }
}

export function VisualThumb({ visual, label, active, onClick, onContext, badge, style }: {
  visual: Visual; label?: string; active?: boolean; onClick?: () => void; onContext?: (e: React.MouseEvent) => void; badge?: string; style?: React.CSSProperties
}) {
  const media = useStore((s) => s.media)
  const thumb = visual.type === 'media' ? media.find((m) => m.id === visual.mediaId)?.thumb : undefined
  return (
    <button className={'vthumb' + (active ? ' active' : '')} onClick={onClick} onContextMenu={onContext} style={style}>
      <div className="vthumb-img" style={visualCss(visual, thumb)}>
        {visual.type === 'shader' && <span className="live-badge">AO VIVO</span>}
        {visual.type === 'media' && media.find((m) => m.id === visual.mediaId)?.kind === 'video' && <span className="live-badge">▶ LOOP</span>}
        {badge && <span className="badge-r">{badge}</span>}
      </div>
      {label && <span className="vthumb-label">{label}</span>}
    </button>
  )
}

/** Pré-visualização de uma saída numa caixa com proporção fixa */
export function OutputPreview({ kind, snap, look, aspect = 16 / 9 }: { kind: 'telao' | 'laterais' | 'retorno' | 'live'; snap: Snapshot; look?: ResolvedLook; aspect?: number }) {
  return (
    <div className="preview-box" style={{ aspectRatio: String(aspect) }}>
      {kind === 'retorno' ? (
        <StageView snap={snap} />
      ) : kind === 'live' ? (
        <div className="checker">
          <LiveComposite snap={snap} />
        </div>
      ) : (
        <Composite look={look ?? snap[kind]} snap={snap} preview out={kind} />
      )}
    </div>
  )
}

const GOOGLE_FONTS = ['Inter', 'Montserrat', 'Poppins', 'Bebas Neue', 'Playfair Display', 'Oswald', 'Lora', 'Anton', 'Raleway', 'Merriweather']
const SYSTEM_FONTS = ['Arial', 'Arial Black', 'Segoe UI', 'Calibri', 'Verdana', 'Georgia', 'Times New Roman', 'Impact', 'Trebuchet MS', 'Tahoma']
let localFonts: string[] = []
const fontListeners = new Set<() => void>()

export async function loadLocalFonts() {
  const q = (window as any).queryLocalFonts
  if (!q) throw new Error('Este navegador não permite listar fontes. Use o Google Chrome ou Edge.')
  const fonts: { family: string }[] = await q()
  localFonts = [...new Set(fonts.map((f) => f.family))].sort((a, b) => a.localeCompare(b))
  fontListeners.forEach((l) => l())
  return localFonts.length
}

export function FontSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [, force] = useState(0)
  useEffect(() => {
    const l = () => force((x) => x + 1)
    fontListeners.add(l)
    return () => {
      fontListeners.delete(l)
    }
  }, [])
  const all = [...new Set([...GOOGLE_FONTS, ...SYSTEM_FONTS, ...localFonts, value])]
  return (
    <div className="font-select">
      <select value={value} onChange={(e) => onChange(e.target.value)} style={{ fontFamily: value }}>
        <optgroup label="Web (sempre disponíveis)">
          {GOOGLE_FONTS.map((f) => (
            <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>
          ))}
        </optgroup>
        <optgroup label="Sistema">
          {all.filter((f) => !GOOGLE_FONTS.includes(f)).map((f) => (
            <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>
          ))}
        </optgroup>
      </select>
      {!localFonts.length && (
        <button
          className="btn btn-sm btn-ghost"
          title="Carregar todas as fontes instaladas no computador"
          onClick={(e) => {
            e.preventDefault()
            loadLocalFonts().catch((er) => alert(er.message))
          }}
        >
          + fontes do PC
        </button>
      )}
    </div>
  )
}

export function fmtSize(n: number) {
  if (n > 1e9) return (n / 1e9).toFixed(1) + ' GB'
  if (n > 1e6) return (n / 1e6).toFixed(1) + ' MB'
  return Math.round(n / 1e3) + ' KB'
}

export function ContextMenu({ x, y, items, onClose }: { x: number; y: number; items: { label: string; onClick: () => void; danger?: boolean }[]; onClose: () => void }) {
  useEffect(() => {
    const c = () => onClose()
    window.addEventListener('click', c)
    window.addEventListener('blur', c)
    return () => {
      window.removeEventListener('click', c)
      window.removeEventListener('blur', c)
    }
  }, [onClose])
  return (
    <div className="ctx-menu" style={{ left: Math.min(x, window.innerWidth - 200), top: Math.min(y, window.innerHeight - items.length * 34 - 10) }}>
      {items.map((it) => (
        <button key={it.label} className={it.danger ? 'danger' : ''} onClick={it.onClick}>
          {it.label}
        </button>
      ))}
    </div>
  )
}

export function useContextMenu() {
  const [menu, setMenu] = useState<{ x: number; y: number; items: { label: string; onClick: () => void; danger?: boolean }[] } | null>(null)
  const open = (e: React.MouseEvent, items: { label: string; onClick: () => void; danger?: boolean }[]) => {
    e.preventDefault()
    e.stopPropagation()
    setMenu({ x: e.clientX, y: e.clientY, items })
  }
  const node = menu ? <ContextMenu {...menu} onClose={() => setMenu(null)} /> : null
  return { open, node }
}
