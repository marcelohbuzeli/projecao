import { SlidersHorizontal, Pencil, Play, Pause, RotateCcw, X, Presentation, ScreenShare, Square } from 'lucide-react'
import { useState } from 'react'
import { useStore, actions, setLive, getState, setState } from '../../core/store'
import { useUI, goLive, setUI, toast } from '../../ui/uiStore'
import { Btn, Slider, Toggle, useContextMenu, useDragScroll } from '../../ui/common'
import { SceneCard } from '../../ui/SceneCard'
import { pptxToWindowedShow, downloadBlob } from '../../core/files'
import { getBlob } from '../../core/db'
import { MediaLayer } from '../../render/Layers'
import { uid } from '../../core/defaults'
import { fmtDur } from './LeftPanel'

export function ScenePad() {
  const scenes = useStore((s) => s.scenes)
  const active = useStore((s) => s.live.sceneId)
  const ctx = useContextMenu()
  const gridRef = useDragScroll<HTMLDivElement>()
  return (
    <section className="scene-pad">
      <div className="sec-head">
        <h4>Cenas</h4>
        <Btn small kind="ghost" icon={SlidersHorizontal} onClick={() => setUI({ page: 'program' })}>Editar cenas</Btn>
      </div>
      <div className="scene-grid" ref={gridRef}>
        {scenes.map((sc, i) => (
          <SceneCard
            key={sc.id}
            scene={sc}
            active={sc.id === active}
            onClick={() => actions.applyScene(sc.id)}
            onContext={(e) =>
              ctx.open(e, [
                { label: 'Editar na Programação', onClick: () => setUI({ page: 'program' }) },
                {
                  label: 'Duplicar',
                  onClick: () => setState((s) => ({ ...s, scenes: [...s.scenes, { ...structuredClone(sc), id: uid(), name: sc.name + ' (cópia)' }] })),
                },
              ])
            }
          />
        ))}
      </div>
      {ctx.node}
    </section>
  )
}

export function SelectionView() {
  const sel = useUI((u) => u.selection)
  const slides = useUI((u) => u.selectionSlides)
  const title = useUI((u) => u.selectionTitle)
  const cursor = useUI((u) => u.cursor)
  if (!sel)
    return (
      <section className="selection empty-sel">
        <div className="empty">
          Escolha uma música, um versículo ou um arquivo à esquerda (ou no culto, à direita).
          <br />
          <small>Atalhos: → / PageDown / espaço = próximo · ← / PageUp = anterior · Esc = limpar letra · B = tela preta</small>
        </div>
      </section>
    )
  if (sel.type === 'media') return <MediaPanel mediaId={sel.mediaId} />
  if (sel.type === 'pptx') return <PptxPanel mediaId={sel.mediaId} />
  const key = sel.type === 'song' ? 'song:' + sel.songId : `bible:${sel.versionId}:${sel.book}:${sel.chapter}`
  const liveIdx = cursor?.key === key ? cursor.index : -1
  const target = sel.type === 'bible' ? sel.verse - 1 : -1
  return (
    <section className="selection">
      <div className="sec-head">
        <h4>
          {title}
          {sel.type === 'song' && (
            <button className="link" onClick={() => setUI({ editSongId: sel.songId })}><Pencil size={13} /> editar</button>
          )}
        </h4>
        <span className="hint">clique num slide para colocar no ar</span>
      </div>
      <div className={'slide-grid' + (sel.type === 'bible' ? ' bible' : '')}>
        {slides.map((s, i) => (
          <button
            key={i}
            className={'slide' + (i === liveIdx ? ' live' : '') + (i === target ? ' target' : '')}
            onClick={() => goLive(i)}
            onContextMenu={(e) => {
              e.preventDefault()
              if (sel.type === 'song') setUI({ editSongId: sel.songId })
            }}
          >
            <span className="slide-label">
              {i + 1}
              {s.label && sel.type === 'song' ? ' · ' + s.label : ''}
            </span>
            <span className="slide-text">{s.text}</span>
          </button>
        ))}
        {!slides.length && <div className="empty">Sem slides. Clique em editar para escrever a letra.</div>}
      </div>
    </section>
  )
}

function MediaPanel({ mediaId }: { mediaId: string }) {
  const m = useStore((s) => s.media.find((x) => x.id === mediaId))
  const live = useStore((s) => s.live.media)
  const [loop, setLoop] = useState(false)
  if (!m) return <section className="selection"><div className="empty">Arquivo não encontrado.</div></section>
  const isLive = live?.mediaId === m.id
  return (
    <section className="selection">
      <div className="sec-head">
        <h4>{m.name}</h4>
        <span className="hint">{m.kind === 'video' ? 'Vídeo' + (m.duration ? ' · ' + fmtDur(m.duration) : '') : 'Imagem'}</span>
      </div>
      <div className="media-panel">
        <div className="media-preview">
          {isLive && live ? (
            <div style={{ position: 'absolute', inset: 0, containerType: 'size' }}>
              <MediaLayer media={live} audible={false} />
            </div>
          ) : (
            <img src={m.thumb} />
          )}
          {isLive && <span className="sc-live" style={{ position: 'absolute', top: 8, left: 8 }}>NO AR</span>}
        </div>
        <div className="media-actions">
          <Btn kind="live" icon={Play} onClick={() => actions.playMedia(m, m.kind === 'video' && loop)}>Mostrar no telão</Btn>
          {m.kind === 'video' && (
            <>
              <Toggle label="Repetir em loop" value={isLive && live ? live.loop : loop} onChange={(v) => { setLoop(v); if (isLive) setLive((l) => (l.media ? { ...l, media: { ...l.media, loop: v } } : l)) }} />
              {isLive && (
                <>
                  <Btn icon={live!.playing ? Pause : Play} onClick={actions.togglePause}>{live!.playing ? 'Pausar' : 'Continuar'}</Btn>
                  <Btn icon={RotateCcw} onClick={actions.restartMedia}>Tocar de novo</Btn>
                  <Slider label="Volume" min={0} max={1} step={0.05} value={live!.volume} onChange={(v) => setLive((l) => (l.media ? { ...l, media: { ...l.media, volume: v } } : l))} />
                </>
              )}
            </>
          )}
          {isLive && <Btn kind="danger" icon={X} onClick={actions.clearMedia}>Tirar do ar</Btn>}
          <p className="hint">A mídia fica por cima de tudo. Ao tirar do ar, o fundo e a letra que estavam embaixo continuam.</p>
        </div>
      </div>
    </section>
  )
}

declare global {
  interface Window {
    __captureStream?: MediaStream | null
  }
}

export async function startCapture(name: string) {
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: { ideal: 30 }, cursor: 'never' } as any,
      audio: false,
      selfBrowserSurface: 'exclude',
      preferCurrentTab: false,
      surfaceSwitching: 'include',
    } as any)
    window.__captureStream?.getTracks().forEach((t) => t.stop())
    window.__captureStream = stream
    stream.getVideoTracks()[0].addEventListener('ended', () => {
      if (window.__captureStream === stream) window.__captureStream = null
      if (getState().live.media?.kind === 'capture') actions.clearMedia()
    })
    actions.showCapture(name)
    toast('Captura no ar')
  } catch (e) {
    console.warn(e)
    toast('Captura cancelada')
  }
}

export function stopCapture() {
  window.__captureStream?.getTracks().forEach((t) => t.stop())
  window.__captureStream = null
  if (getState().live.media?.kind === 'capture') actions.clearMedia()
}

function PptxPanel({ mediaId }: { mediaId: string }) {
  const m = useStore((s) => s.media.find((x) => x.id === mediaId))
  const live = useStore((s) => s.live.media)
  const crop = useStore((s) => s.live.captureCrop)
  const [busy, setBusy] = useState(false)
  if (!m) return <section className="selection"><div className="empty">Arquivo não encontrado.</div></section>
  const capturing = live?.kind === 'capture'
  const setCrop = (k: 't' | 'b' | 'l' | 'r', v: number) => setLive((l) => ({ ...l, captureCrop: { ...l.captureCrop, [k]: v } }))
  return (
    <section className="selection">
      <div className="sec-head">
        <h4>PowerPoint — {m.name}</h4>
        <span className="hint">com animações, pelo próprio PowerPoint</span>
      </div>
      <div className="pptx-panel">
        <ol className="steps">
          <li>
            <b>Abrir a apresentação</b>
            <p>Abre direto no PowerPoint, já em apresentação numa janela (com animações e transições).</p>
            <div className="row">
              <Btn
                kind="primary"
                disabled={busy}
                onClick={async () => {
                  setBusy(true)
                  const b = await pptxToWindowedShow(m.id)
                  setBusy(false)
                  if (b) downloadBlob(b, m.name + '.ppsx')
                  else toast('Não consegui preparar o arquivo — use "Arquivo original"')
                }}
              >
                <Presentation size={16} strokeWidth={1.75} /> Abrir no PowerPoint
              </Btn>
              <Btn
                onClick={async () => {
                  const b = await getBlob(m.id)
                  if (b) downloadBlob(b, m.name + '.pptx')
                }}
              >
                Arquivo original
              </Btn>
            </div>
            <small>Dica: na primeira vez, no download do Chrome escolha “Sempre abrir arquivos deste tipo”. Daí abre sozinho.</small>
          </li>
          <li>
            <b>Mandar para as telas</b>
            <p>Escolha a janela do PowerPoint na lista. Ela vai para o telão, para os laterais e para a TV de retorno.</p>
            <div className="row">
              {!capturing ? (
                <Btn kind="live" icon={ScreenShare} onClick={() => startCapture(m.name)}>Capturar janela do PowerPoint</Btn>
              ) : (
                <>
                  <Btn kind="danger" icon={Square} onClick={stopCapture}>Encerrar apresentação</Btn>
                  <Btn onClick={() => startCapture(m.name)}>Trocar janela</Btn>
                </>
              )}
            </div>
          </li>
          <li>
            <b>Passar os slides</b>
            <p>Clique uma vez na janela do PowerPoint (no monitor do operador). O passador e as setas passam a controlar a apresentação, com animações.</p>
          </li>
        </ol>
        <div className="pptx-side">
          <div className="media-preview">
            {capturing && live ? (
              <div style={{ position: 'absolute', inset: 0, containerType: 'size' }}>
                <MediaLayer media={live} audible={false} crop={crop} />
              </div>
            ) : (
              <div className="empty">Prévia da captura</div>
            )}
          </div>
          <details>
            <summary>Recortar bordas da janela</summary>
            <Slider label="Cima" min={0} max={20} step={0.5} value={crop.t} onChange={(v) => setCrop('t', v)} suffix="%" />
            <Slider label="Baixo" min={0} max={20} step={0.5} value={crop.b} onChange={(v) => setCrop('b', v)} suffix="%" />
            <Slider label="Esquerda" min={0} max={20} step={0.5} value={crop.l} onChange={(v) => setCrop('l', v)} suffix="%" />
            <Slider label="Direita" min={0} max={20} step={0.5} value={crop.r} onChange={(v) => setCrop('r', v)} suffix="%" />
          </details>
        </div>
      </div>
    </section>
  )
}
