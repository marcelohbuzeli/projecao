import { useEffect, useRef, useState } from 'react'
import { useStore, useSnapshot, setState, getState, actions, findStyle } from '../core/store'
import type { Scene, SceneOutputId, TextStyle, CameraLayout, ResolvedLook, Snapshot } from '../core/types'
import { SceneCard } from '../ui/SceneCard'
import { Btn, Tabs, Toggle, Slider, Select, ColorField, VisualThumb, BLEND_OPTIONS, FontSelect, useContextMenu } from '../ui/common'
import { Composite, LiveComposite } from '../render/Layers'
import { CAMERA_PRESETS, defaultLook, uid, baseStyle } from '../core/defaults'
import { toast } from '../ui/uiStore'

type EditOut = SceneOutputId | 'live'
const COLORS = ['#7c3aed', '#ea580c', '#0891b2', '#16a34a', '#dc2626', '#db2777', '#ca8a04', '#475569']

export function ProgramPage() {
  const scenes = useStore((s) => s.scenes)
  const liveSceneId = useStore((s) => s.live.sceneId)
  const [editId, setEditId] = useState<string>(scenes[0]?.id ?? '')
  const [draft, setDraft] = useState<Scene | null>(null)
  const [out, setOut] = useState<EditOut>('telao')
  const ctx = useContextMenu()

  useEffect(() => {
    const sc = getState().scenes.find((s) => s.id === editId)
    setDraft(sc ? structuredClone(sc) : null)
  }, [editId])

  const saved = scenes.find((s) => s.id === editId)
  const dirty = draft && saved && JSON.stringify(draft) !== JSON.stringify(saved)

  const save = () => {
    if (!draft) return
    setState((s) => ({ ...s, scenes: s.scenes.map((x) => (x.id === draft.id ? draft : x)) }))
    toast('Cena salva')
  }
  const newScene = (fromLive = false) => {
    const l = getState().live
    const sc: Scene = fromLive
      ? { id: uid(), name: 'Nova cena', color: COLORS[scenes.length % COLORS.length], themeId: l.themeId, overlayId: l.overlayId, overlayOpacity: l.overlayOpacity, outputs: structuredClone(l.looks), liveStyleId: l.liveStyleId }
      : { id: uid(), name: 'Nova cena', color: COLORS[scenes.length % COLORS.length], themeId: getState().themes[0]?.id ?? null, overlayId: null, overlayOpacity: 1, outputs: { telao: defaultLook(), laterais: defaultLook({ textStyleId: 'st-laterais' }) }, liveStyleId: 'st-live' }
    setState((s) => ({ ...s, scenes: [...s.scenes, sc] }))
    setEditId(sc.id)
  }

  return (
    <div className="program-page">
      <aside className="pg-scenes">
        <div className="sec-head">
          <h4>Cenas</h4>
        </div>
        <div className="row" style={{ padding: '0 10px 8px' }}>
          <Btn small kind="primary" onClick={() => newScene(false)}>+ Nova</Btn>
          <Btn small onClick={() => newScene(true)} title="Cria uma cena com o que está no ar agora">+ Do ao vivo</Btn>
        </div>
        <div className="pg-scene-list">
          {scenes.map((sc, i) => (
            <div key={sc.id} className="pg-scene-wrap">
              <SceneCard
                scene={sc.id === draft?.id ? draft : sc}
                active={sc.id === liveSceneId}
                compact
                onClick={() => setEditId(sc.id)}
                onContext={(e) =>
                  ctx.open(e, [
                    { label: '▶ Aplicar ao vivo', onClick: () => actions.applyScene(sc.id) },
                    { label: '⧉ Duplicar', onClick: () => setState((s) => ({ ...s, scenes: [...s.scenes, { ...structuredClone(sc), id: uid(), name: sc.name + ' (cópia)' }] })) },
                    { label: '↑ Mover para cima', onClick: () => i > 0 && setState((s) => { const a = [...s.scenes]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; return { ...s, scenes: a } }) },
                    { label: '↓ Mover para baixo', onClick: () => i < scenes.length - 1 && setState((s) => { const a = [...s.scenes]; [a[i + 1], a[i]] = [a[i], a[i + 1]]; return { ...s, scenes: a } }) },
                    { label: '🗑 Excluir', danger: true, onClick: () => confirm(`Excluir a cena "${sc.name}"?`) && setState((s) => ({ ...s, scenes: s.scenes.filter((x) => x.id !== sc.id) })) },
                  ])
                }
              />
              {sc.id === editId && <div className="editing-mark">editando</div>}
            </div>
          ))}
        </div>
        {ctx.node}
      </aside>

      {draft ? (
        <>
          <main className="pg-canvas">
            <div className="pg-top">
              <input className="scene-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              <div className="color-dots">
                {COLORS.map((c) => (
                  <button key={c} style={{ background: c }} className={draft.color === c ? 'on' : ''} onClick={() => setDraft({ ...draft, color: c })} />
                ))}
              </div>
              <div className="grow" />
              {dirty && <span className="dirty">alterações não salvas</span>}
              <Btn onClick={() => setDraft(structuredClone(saved!))} disabled={!dirty}>Desfazer</Btn>
              <Btn kind="primary" onClick={save} disabled={!dirty}>Salvar cena</Btn>
              <Btn kind="warn" onClick={() => { save(); actions.applyScene(draft.id) }}>▶ Salvar e aplicar</Btn>
            </div>
            <Tabs
              value={out}
              onChange={setOut}
              tabs={[
                { id: 'telao', label: 'Telão central' },
                { id: 'laterais', label: 'Projetores laterais' },
                { id: 'live', label: 'Live (OBS)' },
              ]}
            />
            <SceneStage draft={draft} setDraft={setDraft} out={out} />
            <p className="hint text-center">Arraste as caixas para posicionar a <b style={{ color: '#38bdf8' }}>letra</b> e a <b style={{ color: '#f97316' }}>câmera</b>. O canto inferior direito redimensiona.</p>
          </main>
          <aside className="pg-props">
            <SceneProps draft={draft} setDraft={setDraft} out={out} />
          </aside>
        </>
      ) : (
        <main className="pg-canvas"><div className="empty">Crie ou escolha uma cena.</div></main>
      )}
    </div>
  )
}

// ---------- palco com arrastar/redimensionar ----------
function SceneStage({ draft, setDraft, out }: { draft: Scene; setDraft: (s: Scene) => void; out: EditOut }) {
  const snap = useSnapshot()
  const st = useStore((s) => s)
  const ref = useRef<HTMLDivElement>(null)
  const styleId = out === 'live' ? draft.liveStyleId : draft.outputs[out].textStyleId
  const style = findStyle(st, styleId)
  const sampleText = snap.text ?? { kind: 'song' as const, title: 'Exemplo', text: 'Texto de exemplo\nda letra da música', next: '', key: 'sample' }
  const resolve = (o: SceneOutputId): ResolvedLook => {
    const look = draft.outputs[o]
    return {
      theme: look.theme ? st.themes.find((t) => t.id === draft.themeId) ?? null : null,
      overlay: look.overlay ? st.overlays.find((t) => t.id === draft.overlayId) ?? null : null,
      overlayOpacity: draft.overlayOpacity,
      lyrics: look.lyrics,
      style: findStyle(st, look.textStyleId),
      camera: look.camera,
      media: false,
    }
  }
  const fake: Snapshot = { ...snap, text: sampleText, textVisible: true, media: null, black: false, alert: { ...snap.alert, visible: false }, liveStyle: findStyle(st, draft.liveStyleId) }

  const setStyleBox = (box: TextStyle['box']) => setState((s) => ({ ...s, styles: s.styles.map((x) => (x.id === style.id ? { ...x, box } : x)) }))
  const setCam = (c: Partial<CameraLayout>) => {
    if (out === 'live') return
    setDraft({ ...draft, outputs: { ...draft.outputs, [out]: { ...draft.outputs[out], camera: { ...draft.outputs[out].camera, ...c } } } })
  }

  const drag = (e: React.PointerEvent, kind: 'text' | 'cam', mode: 'move' | 'resize') => {
    e.preventDefault()
    e.stopPropagation()
    const rect = ref.current!.getBoundingClientRect()
    const start = { x: e.clientX, y: e.clientY }
    const cam = out !== 'live' ? draft.outputs[out].camera : null
    const base = kind === 'text' ? { ...style.box } : { x: cam!.x, y: cam!.y, w: cam!.w, h: cam!.h }
    const snapV = (v: number) => (Math.abs(v) < 1.2 ? 0 : Math.abs(v - 100) < 1.2 ? 100 : Math.abs(v - 50) < 1 ? 50 : Math.round(v * 2) / 2)
    const onMove = (ev: PointerEvent) => {
      const dx = ((ev.clientX - start.x) / rect.width) * 100
      const dy = ((ev.clientY - start.y) / rect.height) * 100
      let b = { ...base }
      if (mode === 'move') {
        b.x = snapV(Math.max(-50, Math.min(100, base.x + dx)))
        b.y = snapV(Math.max(-50, Math.min(100, base.y + dy)))
        if (Math.abs(b.x + b.w - 100) < 1.2) b.x = 100 - b.w
        if (Math.abs(b.y + b.h - 100) < 1.2) b.y = 100 - b.h
      } else {
        b.w = Math.max(5, snapV(base.x + base.w + dx) - base.x)
        b.h = Math.max(5, snapV(base.y + base.h + dy) - base.y)
      }
      if (kind === 'text') setStyleBox(b)
      else setCam(b)
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const cam = out !== 'live' ? draft.outputs[out].camera : null
  const showText = out === 'live' || draft.outputs[out].lyrics
  return (
    <div className="stage-wrap">
      <div className={'stage-box' + (out === 'live' ? ' checker' : '')} ref={ref}>
        {out === 'live' ? <LiveComposite snap={fake} /> : <Composite look={resolve(out)} snap={fake} preview out={out} />}
        <div className="handles">
          {cam?.enabled && (
            <div className="handle cam" style={{ left: cam.x + '%', top: cam.y + '%', width: cam.w + '%', height: cam.h + '%' }} onPointerDown={(e) => drag(e, 'cam', 'move')}>
              <span>Câmera</span>
              <i onPointerDown={(e) => drag(e, 'cam', 'resize')} />
            </div>
          )}
          {showText && (
            <div className="handle txt" style={{ left: style.box.x + '%', top: style.box.y + '%', width: style.box.w + '%', height: style.box.h + '%' }} onPointerDown={(e) => drag(e, 'text', 'move')}>
              <span>Letra · {style.name}</span>
              <i onPointerDown={(e) => drag(e, 'text', 'resize')} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------- propriedades ----------
function SceneProps({ draft, setDraft, out }: { draft: Scene; setDraft: (s: Scene) => void; out: EditOut }) {
  const themes = useStore((s) => s.themes)
  const overlays = useStore((s) => s.overlays)
  const styles = useStore((s) => s.styles)
  const [sec, setSec] = useState<'fundo' | 'saida'>('saida')
  const look = out !== 'live' ? draft.outputs[out] : null
  const setLook = (p: Partial<typeof look>) => out !== 'live' && setDraft({ ...draft, outputs: { ...draft.outputs, [out]: { ...draft.outputs[out], ...p } } })
  const setCam = (p: Partial<CameraLayout>) => look && setLook({ camera: { ...look.camera, ...p } })
  const styleId = out === 'live' ? draft.liveStyleId : look!.textStyleId
  const setStyleId = (id: string) => (out === 'live' ? setDraft({ ...draft, liveStyleId: id }) : setLook({ textStyleId: id }))

  return (
    <div className="props">
      <Tabs
        value={sec}
        onChange={setSec}
        tabs={[
          { id: 'saida', label: out === 'live' ? 'Letra da live' : 'Esta tela' },
          { id: 'fundo', label: 'Fundo da cena' },
        ]}
      />
      {sec === 'fundo' && (
        <div className="props-sec">
          <h5>Tema (fundo base, sempre em loop)</h5>
          <div className="thumb-grid">
            <VisualThumb visual={{ type: 'none' }} label="Nenhum" active={!draft.themeId} onClick={() => setDraft({ ...draft, themeId: null })} />
            {themes.map((t) => (
              <VisualThumb key={t.id} visual={t.visual} label={t.name} active={draft.themeId === t.id} onClick={() => setDraft({ ...draft, themeId: t.id })} />
            ))}
          </div>
          <h5>Sobreposição (camada de ajuste)</h5>
          <div className="thumb-grid">
            <VisualThumb visual={{ type: 'none' }} label="Nenhuma" active={!draft.overlayId} onClick={() => setDraft({ ...draft, overlayId: null })} />
            {overlays.map((t) => (
              <VisualThumb key={t.id} visual={t.visual} label={t.name} badge={t.blend !== 'normal' ? t.blend : undefined} active={draft.overlayId === t.id} onClick={() => setDraft({ ...draft, overlayId: t.id })} />
            ))}
          </div>
          <Slider label="Intensidade da sobreposição" min={0} max={1} step={0.05} value={draft.overlayOpacity} onChange={(v) => setDraft({ ...draft, overlayOpacity: v })} />
          <p className="hint">Crie temas e sobreposições novos (cores, gradientes, geradores ao vivo, imagens e vídeos) na Biblioteca.</p>
        </div>
      )}
      {sec === 'saida' && (
        <div className="props-sec">
          {look && (
            <>
              <h5>Camadas nesta tela</h5>
              <div className="toggles">
                <Toggle label="Fundo" value={look.theme} onChange={(v) => setLook({ theme: v })} />
                <Toggle label="Sobreposição" value={look.overlay} onChange={(v) => setLook({ overlay: v })} />
                <Toggle label="Letra" value={look.lyrics} onChange={(v) => setLook({ lyrics: v })} />
                <Toggle label="Mídia/slides" value={look.media} onChange={(v) => setLook({ media: v })} />
              </div>
            </>
          )}
          <h5>Estilo da letra</h5>
          <div className="row">
            <select value={styleId} onChange={(e) => setStyleId(e.target.value)} style={{ flex: 1 }}>
              {styles.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <Btn
              small
              title="Criar um estilo novo a partir deste"
              onClick={() => {
                const cur = styles.find((s) => s.id === styleId) ?? baseStyle()
                const name = prompt('Nome do novo estilo', cur.name + ' 2')
                if (!name) return
                const ns = { ...structuredClone(cur), id: uid(), name }
                setState((s) => ({ ...s, styles: [...s.styles, ns] }))
                setStyleId(ns.id)
              }}
            >
              + Novo
            </Btn>
          </div>
          <StyleEditor styleId={styleId} />
          {look && (
            <>
              <h5>Câmera (sinal da live)</h5>
              <Toggle label="Mostrar câmera nesta tela" value={look.camera.enabled} onChange={(v) => setCam({ enabled: v })} />
              {look.camera.enabled && (
                <>
                  <div className="preset-grid">
                    {CAMERA_PRESETS.map((p) => (
                      <button key={p.name} className="chip" onClick={() => setCam(p.cam)}>{p.name}</button>
                    ))}
                  </div>
                  <Select label="Mesclagem" value={look.camera.blend} onChange={(v) => setCam({ blend: v })} options={BLEND_OPTIONS} />
                  <Slider label="Opacidade" min={0} max={1} step={0.05} value={look.camera.opacity} onChange={(v) => setCam({ opacity: v })} />
                  <Select label="Enquadramento" value={look.camera.fit} onChange={(v) => setCam({ fit: v })} options={[{ value: 'cover', label: 'Preencher (corta bordas)' }, { value: 'contain', label: 'Inteira (com bordas)' }]} />
                  <Slider label="Cantos arredondados" min={0} max={50} value={look.camera.radius} onChange={(v) => setCam({ radius: v })} />
                  <Slider label="Borda" min={0} max={20} value={look.camera.border} onChange={(v) => setCam({ border: v })} />
                  {look.camera.border > 0 && <ColorField label="Cor da borda" value={look.camera.borderColor} onChange={(v) => setCam({ borderColor: v })} />}
                  <Slider label="Desfoque" min={0} max={30} value={look.camera.blur} onChange={(v) => setCam({ blur: v })} suffix="px" />
                  <Slider label="Brilho" min={0} max={2} step={0.05} value={look.camera.brightness} onChange={(v) => setCam({ brightness: v })} />
                  <Slider label="Saturação (0 = P&B)" min={0} max={2} step={0.05} value={look.camera.saturation} onChange={(v) => setCam({ saturation: v })} />
                  <Toggle label="Espelhar" value={look.camera.mirror} onChange={(v) => setCam({ mirror: v })} />
                  <div className="row">
                    <Slider label="X" min={-50} max={100} step={0.5} value={look.camera.x} onChange={(v) => setCam({ x: v })} suffix="%" />
                    <Slider label="Y" min={-50} max={100} step={0.5} value={look.camera.y} onChange={(v) => setCam({ y: v })} suffix="%" />
                  </div>
                  <div className="row">
                    <Slider label="Largura" min={5} max={150} step={0.5} value={look.camera.w} onChange={(v) => setCam({ w: v })} suffix="%" />
                    <Slider label="Altura" min={5} max={150} step={0.5} value={look.camera.h} onChange={(v) => setCam({ h: v })} suffix="%" />
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

/** Editor de estilo de texto (compartilhado entre cenas) */
export function StyleEditor({ styleId }: { styleId: string }) {
  const style = useStore((s) => s.styles.find((x) => x.id === styleId))
  const used = useStore((s) => s.scenes.filter((sc) => sc.outputs.telao.textStyleId === styleId || sc.outputs.laterais.textStyleId === styleId || sc.liveStyleId === styleId).length)
  if (!style) return null
  const set = (p: Partial<TextStyle>) => setState((s) => ({ ...s, styles: s.styles.map((x) => (x.id === styleId ? { ...x, ...p } : x)) }))
  return (
    <div className="style-editor">
      {used > 1 && <p className="hint">Este estilo é usado em {used} cenas — mudanças valem para todas.</p>}
      <label className="field"><span>Nome</span><input value={style.name} onChange={(e) => set({ name: e.target.value })} /></label>
      <label className="field"><span>Fonte</span><FontSelect value={style.fontFamily} onChange={(v) => set({ fontFamily: v })} /></label>
      <Slider label="Tamanho" min={1.5} max={20} step={0.1} value={style.fontSize} onChange={(v) => set({ fontSize: v })} />
      <div className="row">
        <Select label="Peso" value={String(style.fontWeight)} onChange={(v) => set({ fontWeight: parseInt(v) })} options={[400, 500, 600, 700, 800, 900].map((w) => ({ value: String(w), label: String(w) }))} />
        <ColorField label="Cor" value={style.color} onChange={(v) => set({ color: v })} />
      </div>
      <div className="toggles">
        <Toggle label="MAIÚSCULAS" value={style.uppercase} onChange={(v) => set({ uppercase: v })} />
        <Toggle label="Itálico" value={style.italic} onChange={(v) => set({ italic: v })} />
        <Toggle label="Ajustar ao espaço" value={style.autoFit} onChange={(v) => set({ autoFit: v })} title="Diminui a fonte automaticamente quando o texto não cabe" />
      </div>
      <div className="row">
        <div className="seg">
          {(['left', 'center', 'right'] as const).map((a) => (
            <button key={a} className={style.align === a ? 'on' : ''} onClick={() => set({ align: a })}>{a === 'left' ? '⇤' : a === 'center' ? '≡' : '⇥'}</button>
          ))}
        </div>
        <div className="seg">
          {(['top', 'center', 'bottom'] as const).map((a) => (
            <button key={a} className={style.vAlign === a ? 'on' : ''} onClick={() => set({ vAlign: a })}>{a === 'top' ? '⤒' : a === 'center' ? '↕' : '⤓'}</button>
          ))}
        </div>
      </div>
      <Slider label="Altura da linha" min={0.8} max={2} step={0.05} value={style.lineHeight} onChange={(v) => set({ lineHeight: v })} />
      <Slider label="Espaçamento das letras" min={-0.05} max={0.3} step={0.01} value={style.letterSpacing} onChange={(v) => set({ letterSpacing: v })} />
      <Slider label="Sombra" min={0} max={1} step={0.05} value={style.shadow} onChange={(v) => set({ shadow: v })} />
      <Slider label="Contorno" min={0} max={10} step={0.5} value={style.outline} onChange={(v) => set({ outline: v })} />
      {style.outline > 0 && <ColorField label="Cor do contorno" value={style.outlineColor} onChange={(v) => set({ outlineColor: v })} />}
      <Slider label="Caixa atrás do texto" min={0} max={1} step={0.05} value={style.bgOpacity} onChange={(v) => set({ bgOpacity: v })} />
      {style.bgOpacity > 0 && <ColorField label="Cor da caixa" value={style.bgColor} onChange={(v) => set({ bgColor: v })} />}
      <Slider label="Tamanho da referência (Bíblia)" min={30} max={100} value={style.refSize} onChange={(v) => set({ refSize: v })} suffix="%" />
    </div>
  )
}
