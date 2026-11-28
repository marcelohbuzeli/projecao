import { useMemo, useState } from 'react'
import { Shuffle, Save, Play, Layers } from 'lucide-react'
import { useStore, useSnapshot, setState, actions, findStyle } from '../core/store'
import type { ShaderName, ShaderParams, Snapshot, ResolvedLook, Theme } from '../core/types'
import { Btn, Slider, ColorField, Toggle } from '../ui/common'
import { Composite } from '../render/Layers'
import { ShaderCanvas } from '../render/ShaderCanvas'
import { SHADER_LABELS, SHADER_GROUPS } from '../render/shaders'
import { uid, defaultCamera } from '../core/defaults'
import { toast } from '../ui/uiStore'

const PALETTES: { name: string; c: [string, string, string] }[] = [
  { name: 'Brasa', c: ['#0b0503', '#ff6a1a', '#ffd29a'] },
  { name: 'Oceano', c: ['#020a14', '#1677ff', '#6ee7ff'] },
  { name: 'Aurora', c: ['#030a10', '#21d19f', '#7c5cff'] },
  { name: 'Ouro', c: ['#0a0702', '#c8932a', '#fff1c1'] },
  { name: 'Rosa', c: ['#0d0309', '#e0457b', '#ffc4a8'] },
  { name: 'Púrpura', c: ['#08030f', '#8b3dff', '#ff5fd2'] },
  { name: 'Floresta', c: ['#020a05', '#1f9d55', '#c6f68d'] },
  { name: 'Gelo', c: ['#05080c', '#8fb3d9', '#ffffff'] },
  { name: 'Vinho', c: ['#060309', '#99244f', '#ffcf8a'] },
  { name: 'Mono', c: ['#050505', '#8a8a8a', '#ffffff'] },
]

const START: { shader: ShaderName; params: ShaderParams } = {
  shader: 'seda',
  params: {
    colorA: '#060309', colorB: '#99244f', colorC: '#ffcf8a',
    speed: 0.6, intensity: 1, scale: 1,
    warp: 0.3, grain: 0.3, glow: 0.2, contrast: 1.15, vignette: 0.5, dark: 0, tint: '#0056d6', tintAmt: 0,
  },
}

type Step = 'visual' | 'cor' | 'acabamento' | 'movimento'
const STEPS: { id: Step; n: string; label: string }[] = [
  { id: 'visual', n: '01', label: 'Visual' },
  { id: 'cor', n: '02', label: 'Cor' },
  { id: 'acabamento', n: '03', label: 'Acabamento' },
  { id: 'movimento', n: '04', label: 'Movimento' },
]

const rnd = (a: number, b: number) => a + Math.random() * (b - a)
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)]

export function BgStudio() {
  const themes = useStore((s) => s.themes)
  const styles = useStore((s) => s.styles)
  const snap = useSnapshot()
  const [shader, setShader] = useState<ShaderName>(START.shader)
  const [params, setParams] = useState<ShaderParams>(START.params)
  const [step, setStep] = useState<Step>('visual')
  const [group, setGroup] = useState('todos')
  const [name, setName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [withText, setWithText] = useState(false)
  const set = (p: Partial<ShaderParams>) => setParams((x) => ({ ...x, ...p }))

  const visual = useMemo(() => ({ type: 'shader' as const, shader, params }), [shader, params])
  const look: ResolvedLook = {
    theme: { id: 'studio', name: 'Estúdio', visual, dim: 0 },
    overlay: null,
    overlayOpacity: 0,
    lyrics: withText,
    style: findStyle({ styles } as any, 'st-telao'),
    camera: { ...defaultCamera(), enabled: false },
    media: false,
  }
  const fake: Snapshot = {
    ...snap,
    text: { kind: 'song', title: 'Exemplo', text: 'Santo, Santo, Santo\nDeus todo-poderoso', next: '', key: 'studio' },
    textVisible: true,
    media: null,
    black: false,
    alert: { ...snap.alert, visible: false },
  }

  const surprise = () => {
    const p = pick(PALETTES).c
    setShader(pick(SHADER_GROUPS.flatMap((g) => g.items)))
    setParams({
      colorA: p[0], colorB: p[1], colorC: p[2],
      speed: rnd(0.3, 1), intensity: rnd(0.8, 1.3), scale: rnd(0.7, 1.5),
      warp: rnd(0, 0.5), grain: rnd(0.1, 0.5), glow: rnd(0, 0.4), contrast: rnd(1, 1.35), vignette: rnd(0.2, 0.7), dark: 0,
      tint: '#ffffff', tintAmt: 0,
    })
  }

  const label = name.trim() || `${SHADER_LABELS[shader]} ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
  const saveTheme = (goLive = false) => {
    let id = editingId
    if (id && themes.some((t) => t.id === id)) {
      setState((s) => ({ ...s, themes: s.themes.map((t) => (t.id === id ? { ...t, name: name.trim() || t.name, visual } : t)) }))
      toast('Tema atualizado')
    } else {
      id = uid()
      const th: Theme = { id, name: label, visual, dim: 0 }
      setState((s) => ({ ...s, themes: [...s.themes, th] }))
      setEditingId(id)
      setName(label)
      toast('Tema salvo — já aparece na galeria de Temas')
    }
    if (goLive) actions.setTheme(id)
  }
  const saveOverlay = () => {
    setState((s) => ({ ...s, overlays: [...s.overlays, { id: uid(), name: label, visual, blend: 'screen', opacity: 0.8 }] }))
    toast('Sobreposição salva (modo Tela)')
  }
  const load = (id: string) => {
    const t = themes.find((x) => x.id === id)
    if (!t || t.visual.type !== 'shader') return
    setShader(t.visual.shader)
    setParams({ ...START.params, warp: 0, grain: 0, glow: 0, contrast: 1, vignette: 0, tintAmt: 0, ...t.visual.params })
    setEditingId(t.id)
    setName(t.name)
  }

  const shown = group === 'todos' ? SHADER_GROUPS.flatMap((g) => g.items) : SHADER_GROUPS.find((g) => g.id === group)!.items

  return (
    <div className="studio">
      <section className="studio-stage">
        <div className="studio-preview">
          <Composite look={look} snap={fake} out="telao" />
        </div>
        <div className="studio-bar">
          <span className="hint mono">{SHADER_LABELS[shader]} · {PALETTES.find((p) => p.c[1] === params.colorB)?.name ?? 'cores próprias'} · tempo real</span>
          <div className="grow" />
          <Toggle label="Ver com letra" value={withText} onChange={setWithText} />
        </div>
        <div className="studio-actions">
          <input placeholder="Nome do fundo…" value={name} onChange={(e) => setName(e.target.value)} />
          <select value={editingId ?? ''} onChange={(e) => (e.target.value ? load(e.target.value) : (setEditingId(null), setName('')))} title="Editar um tema que já existe">
            <option value="">Novo fundo</option>
            {themes.filter((t) => t.visual.type === 'shader').map((t) => (
              <option key={t.id} value={t.id}>Editar: {t.name}</option>
            ))}
          </select>
          <Btn icon={Save} onClick={() => saveTheme(false)}>{editingId ? 'Atualizar tema' : 'Salvar como tema'}</Btn>
          <Btn icon={Layers} onClick={saveOverlay}>Salvar como sobreposição</Btn>
          <Btn kind="live" icon={Play} onClick={() => saveTheme(true)}>Salvar e pôr no ar</Btn>
        </div>
      </section>

      <aside className="studio-panel">
        <nav className="studio-steps">
          {STEPS.map((s) => (
            <button key={s.id} className={step === s.id ? 'on' : ''} onClick={() => setStep(s.id)}>
              <small>{s.n}</small>
              {s.label}
            </button>
          ))}
        </nav>
        <div className="studio-body">
          {step === 'visual' && (
            <>
              <div className="row wrap">
                {[{ id: 'todos', label: 'Todos' }, ...SHADER_GROUPS].map((g) => (
                  <button key={g.id} className={'chip' + (group === g.id ? ' on' : '')} onClick={() => setGroup(g.id)}>{g.label}</button>
                ))}
              </div>
              <div className="studio-grid">
                {shown.map((n) => (
                  <button key={n} className={'studio-tile' + (shader === n ? ' on' : '')} onClick={() => setShader(n)}>
                    <div className="studio-tile-img">
                      <ShaderCanvas name={n} params={params} maxW={220} />
                    </div>
                    <span>{SHADER_LABELS[n]}</span>
                  </button>
                ))}
              </div>
              <h5 className="studio-h">Ajustes</h5>
              <Slider label="Intensidade" min={0.2} max={2} step={0.05} value={params.intensity} onChange={(v) => set({ intensity: v })} />
              <Slider label="Tamanho / densidade" min={0.3} max={3} step={0.05} value={params.scale} onChange={(v) => set({ scale: v })} />
            </>
          )}
          {step === 'cor' && (
            <>
              <h5 className="studio-h">Paletas</h5>
              <div className="studio-palettes">
                {PALETTES.map((p) => (
                  <button key={p.name} className={'pal' + (params.colorB === p.c[1] && params.colorC === p.c[2] ? ' on' : '')} onClick={() => set({ colorA: p.c[0], colorB: p.c[1], colorC: p.c[2] })}>
                    <i style={{ background: `linear-gradient(135deg, ${p.c[0]} 0%, ${p.c[1]} 55%, ${p.c[2]} 100%)` }} />
                    {p.name}
                  </button>
                ))}
              </div>
              <h5 className="studio-h">Cores próprias</h5>
              <ColorField label="Fundo" value={params.colorA} onChange={(v) => set({ colorA: v })} />
              <ColorField label="Cor principal" value={params.colorB} onChange={(v) => set({ colorB: v })} />
              <ColorField label="Destaque" value={params.colorC} onChange={(v) => set({ colorC: v })} />
              <h5 className="studio-h">Tingir</h5>
              <ColorField label="Cor do tom" value={params.tint ?? '#ffffff'} onChange={(v) => set({ tint: v })} />
              <Slider label="Força do tom" min={0} max={1} step={0.01} value={params.tintAmt ?? 0} onChange={(v) => set({ tintAmt: v })} />
            </>
          )}
          {step === 'acabamento' && (
            <>
              <Slider label="Granulação (filme)" min={0} max={1} step={0.01} value={params.grain ?? 0} onChange={(v) => set({ grain: v })} />
              <Slider label="Brilho (glow)" min={0} max={1} step={0.01} value={params.glow ?? 0} onChange={(v) => set({ glow: v })} />
              <Slider label="Contraste" min={0.5} max={2} step={0.01} value={params.contrast ?? 1} onChange={(v) => set({ contrast: v })} />
              <Slider label="Vinheta (escurecer bordas)" min={0} max={1} step={0.01} value={params.vignette ?? 0} onChange={(v) => set({ vignette: v })} />
              <Slider label="Escurecer (para a letra ler melhor)" min={0} max={1} step={0.01} value={params.dark ?? 0} onChange={(v) => set({ dark: v })} />
              <div className="row wrap">
                <button className="chip" onClick={() => set({ grain: 0, glow: 0, contrast: 1, vignette: 0, dark: 0 })}>Limpo</button>
                <button className="chip" onClick={() => set({ grain: 0.45, glow: 0.1, contrast: 1.25, vignette: 0.55, dark: 0.1 })}>Fosco</button>
                <button className="chip" onClick={() => set({ grain: 0.1, glow: 0.55, contrast: 1.1, vignette: 0.3, dark: 0 })}>Luminoso</button>
                <button className="chip" onClick={() => set({ grain: 0.6, glow: 0.2, contrast: 1.4, vignette: 0.75, dark: 0.2 })}>Cinema</button>
              </div>
            </>
          )}
          {step === 'movimento' && (
            <>
              <Slider label="Velocidade" min={0} max={2} step={0.01} value={params.speed} onChange={(v) => set({ speed: v })} />
              <Slider label="Distorção (ondular)" min={0} max={1} step={0.01} value={params.warp ?? 0} onChange={(v) => set({ warp: v })} />
              <Slider label="Tamanho / densidade" min={0.3} max={3} step={0.05} value={params.scale} onChange={(v) => set({ scale: v })} />
              <p className="hint">O fundo é gerado ao vivo, sem fim e sem emenda — não precisa exportar vídeo.</p>
            </>
          )}
        </div>
        <div className="studio-foot">
          <Btn icon={Shuffle} onClick={surprise}>Surpreenda-me</Btn>
          <div className="grow" />
          {step !== 'movimento' && (
            <Btn kind="primary" onClick={() => setStep(STEPS[STEPS.findIndex((s) => s.id === step) + 1].id)}>
              {STEPS[STEPS.findIndex((s) => s.id === step) + 1].label} →
            </Btn>
          )}
        </div>
      </aside>
    </div>
  )
}

