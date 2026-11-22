import { Trash2, Pencil, Play, Image as ImageIcon } from 'lucide-react'
import { useRef, useState } from 'react'
import { useStore, setState, actions, getState } from '../core/store'
import type { Visual, Theme, Overlay, ShaderName, MediaItem } from '../core/types'
import { useUI, setUI, toast } from '../ui/uiStore'
import { Tabs, Btn, VisualThumb, Modal, Slider, ColorField, Select, BLEND_OPTIONS, fmtSize, useContextMenu } from '../ui/common'
import { VisualView } from '../render/Layers'
import { SHADER_LABELS } from '../render/shaders'
import { defaultShaderParams, uid } from '../core/defaults'
import { importMediaFiles, readSongFiles, decodeText } from '../core/files'
import { deleteBlob, saveBible, deleteBible } from '../core/db'
import { parseBible } from '../core/bible'
import { norm } from '../core/bible'

export function LibraryPage() {
  const tab = useUI((u) => u.libraryTab)
  return (
    <div className="library-page">
      <Tabs
        value={tab}
        onChange={(v) => setUI({ libraryTab: v })}
        tabs={[
          { id: 'files', label: 'Arquivos (imagens, vídeos, PowerPoint)' },
          { id: 'themes', label: 'Temas (fundos)' },
          { id: 'overlays', label: 'Sobreposições' },
          { id: 'songs', label: 'Músicas' },
          { id: 'bibles', label: 'Bíblias' },
        ]}
      />
      <div className="lib-body">
        {tab === 'files' && <FilesLib />}
        {tab === 'themes' && <VisualLib kind="theme" />}
        {tab === 'overlays' && <VisualLib kind="overlay" />}
        {tab === 'songs' && <SongsLib />}
        {tab === 'bibles' && <BiblesLib />}
      </div>
    </div>
  )
}

function DropZone({ onFiles, accept, label }: { onFiles: (f: FileList) => void; accept: string; label: string }) {
  const ref = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  return (
    <div
      className={'dropzone' + (over ? ' over' : '')}
      onClick={() => ref.current?.click()}
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files)
      }}
    >
      <b>{label}</b>
      <span>arraste aqui ou clique para escolher</span>
      <input
        ref={ref}
        type="file"
        multiple
        hidden
        accept={accept}
        onChange={(e) => {
          if (e.target.files?.length) onFiles(e.target.files)
          e.target.value = ''
        }}
      />
    </div>
  )
}

// ---------------- Arquivos ----------------
function FilesLib() {
  const media = useStore((s) => s.media)
  const [busy, setBusy] = useState(false)
  const ctx = useContextMenu()
  const total = media.reduce((a, m) => a + m.size, 0)
  const asTheme = (m: MediaItem, overlay = false) => {
    const id = uid()
    const visual: Visual = { type: 'media', mediaId: m.id, kind: m.kind as 'image' | 'video', fit: 'cover' }
    if (overlay) setState((s) => ({ ...s, overlays: [...s.overlays, { id, name: m.name, visual, blend: 'screen', opacity: 0.8 }] }))
    else setState((s) => ({ ...s, themes: [...s.themes, { id, name: m.name, visual, dim: 0 }] }))
    toast(overlay ? 'Sobreposição criada' : 'Tema criado')
  }
  const remove = async (m: MediaItem) => {
    if (!confirm(`Excluir "${m.name}"?`)) return
    await deleteBlob(m.id)
    setState((s) => ({
      ...s,
      media: s.media.filter((x) => x.id !== m.id),
      service: s.service.filter((x) => !('mediaId' in x) || x.mediaId !== m.id),
    }))
  }
  return (
    <div>
      <DropZone
        accept="image/*,video/*,.pptx,.ppsx,.ppt,.pps"
        label={busy ? 'Importando…' : 'Importar imagens, vídeos (MP4) e PowerPoint (PPTX)'}
        onFiles={async (f) => {
          setBusy(true)
          const r = await importMediaFiles(f)
          setBusy(false)
          toast(`${r.length} arquivo(s) importado(s)`)
        }}
      />
      <p className="hint">{media.length} arquivos · {fmtSize(total)} guardados neste navegador. Botão direito num arquivo para usar como tema/sobreposição.</p>
      <div className="lib-grid">
        {media.map((m) => (
          <div
            key={m.id}
            className="lib-card"
            onContextMenu={(e) =>
              ctx.open(e, [
                ...(m.kind !== 'pptx'
                  ? [
                      { label: 'Usar como tema (fundo em loop)', onClick: () => asTheme(m) },
                      { label: 'Usar como sobreposição', onClick: () => asTheme(m, true) },
                      { label: 'Mostrar no telão agora', onClick: () => actions.playMedia(m) },
                    ]
                  : []),
                {
                  label: 'Renomear',
                  onClick: () => {
                    const n = prompt('Nome', m.name)
                    if (n) setState((s) => ({ ...s, media: s.media.map((x) => (x.id === m.id ? { ...x, name: n } : x)) }))
                  },
                },
                { label: 'Excluir', danger: true, onClick: () => remove(m) },
              ])
            }
          >
            <div className="lc-thumb" style={{ background: m.thumb ? `#000 url(${m.thumb}) center/cover` : '#1a1a1a' }}>
              {m.kind === 'pptx' && <span className="pptx-ico big">P</span>}
              <span className="badge-r">{m.kind === 'video' ? 'VÍDEO' : m.kind === 'pptx' ? 'PPTX' : 'IMAGEM'}</span>
            </div>
            <div className="lc-info">
              <span>{m.name}</span>
              <small>{fmtSize(m.size)}</small>
            </div>
            <div className="lc-actions">
              {m.kind !== 'pptx' && <Btn small icon={ImageIcon} onClick={() => asTheme(m)}>Usar como tema</Btn>}
              <Btn small kind="ghost" icon={Trash2} title="Excluir" onClick={() => remove(m)} />
            </div>
          </div>
        ))}
      </div>
      {ctx.node}
    </div>
  )
}

// ---------------- Temas e sobreposições ----------------
function VisualLib({ kind }: { kind: 'theme' | 'overlay' }) {
  const items = useStore((s) => (kind === 'theme' ? s.themes : s.overlays)) as (Theme | Overlay)[]
  const liveId = useStore((s) => (kind === 'theme' ? s.live.themeId : s.live.overlayId))
  const [edit, setEdit] = useState<Theme | Overlay | null>(null)
  const ctx = useContextMenu()
  const newItem = (): Theme | Overlay =>
    kind === 'theme'
      ? { id: uid(), name: 'Novo tema', visual: { type: 'shader', shader: 'aurora', params: defaultShaderParams() }, dim: 0 }
      : { id: uid(), name: 'Nova sobreposição', visual: { type: 'shader', shader: 'particulas', params: { ...defaultShaderParams(), colorA: '#000000', colorB: '#ffffff' } }, blend: 'screen', opacity: 0.8 }
  const save = (it: Theme | Overlay) => {
    setState((s) => {
      const key = kind === 'theme' ? 'themes' : 'overlays'
      const arr = s[key] as (Theme | Overlay)[]
      const next = arr.some((x) => x.id === it.id) ? arr.map((x) => (x.id === it.id ? it : x)) : [...arr, it]
      return { ...s, [key]: next }
    })
    setEdit(null)
  }
  const remove = (it: Theme | Overlay) => {
    if (!confirm(`Excluir "${it.name}"?`)) return
    setState((s) => (kind === 'theme' ? { ...s, themes: s.themes.filter((x) => x.id !== it.id) } : { ...s, overlays: s.overlays.filter((x) => x.id !== it.id) }))
  }
  return (
    <div>
      <div className="row" style={{ marginBottom: 12 }}>
        <Btn kind="primary" onClick={() => setEdit(newItem())}>+ {kind === 'theme' ? 'Novo tema' : 'Nova sobreposição'}</Btn>
        <span className="hint">
          {kind === 'theme'
            ? 'Tema = fundo base das telas. Vídeos de tema tocam sempre em loop.'
            : 'Sobreposição = camada de ajuste por cima do tema (partículas, luzes, texturas) com modo de mesclagem.'}
        </span>
      </div>
      <div className="lib-grid visual">
        {items.map((it) => (
          <div key={it.id} className="lib-card">
            <VisualThumb
              visual={it.visual}
              active={liveId === it.id}
              onClick={() => setEdit(structuredClone(it))}
              onContext={(e) =>
                ctx.open(e, [
                  { label: 'Editar', onClick: () => setEdit(structuredClone(it)) },
                  { label: 'Aplicar ao vivo', onClick: () => (kind === 'theme' ? actions.setTheme(it.id) : actions.setOverlay(it.id)) },
                  { label: 'Duplicar', onClick: () => save({ ...structuredClone(it), id: uid(), name: it.name + ' (cópia)' }) },
                  { label: 'Excluir', danger: true, onClick: () => remove(it) },
                ])
              }
            />
            <div className="lc-info">
              <span>{it.name}</span>
              <small>{visualLabel(it.visual)}{'blend' in it && it.blend !== 'normal' ? ' · ' + it.blend : ''}</small>
            </div>
            <div className="lc-actions">
              <Btn small onClick={() => (kind === 'theme' ? actions.setTheme(it.id) : actions.setOverlay(it.id))} icon={Play}>Ao vivo</Btn>
              <Btn small kind="ghost" icon={Pencil} title="Editar" onClick={() => setEdit(structuredClone(it))} />
              <Btn small kind="ghost" icon={Trash2} title="Excluir" onClick={() => remove(it)} />
            </div>
          </div>
        ))}
      </div>
      {edit && <VisualEditor item={edit} kind={kind} onClose={() => setEdit(null)} onSave={save} />}
      {ctx.node}
    </div>
  )
}

const visualLabel = (v: Visual) =>
  v.type === 'shader' ? 'Gerador ao vivo · ' + SHADER_LABELS[v.shader] : v.type === 'media' ? (v.kind === 'video' ? 'Vídeo em loop' : 'Imagem') : v.type === 'gradient' ? 'Gradiente' : v.type === 'color' ? 'Cor sólida' : 'Nada'

function VisualEditor({ item, kind, onClose, onSave }: { item: Theme | Overlay; kind: 'theme' | 'overlay'; onClose: () => void; onSave: (it: Theme | Overlay) => void }) {
  const [it, setIt] = useState(item)
  const media = useStore((s) => s.media.filter((m) => m.kind !== 'pptx'))
  const v = it.visual
  const setV = (nv: Visual) => setIt({ ...it, visual: nv })
  const switchType = (t: Visual['type']) => {
    if (t === v.type) return
    if (t === 'color') setV({ type: 'color', color: '#101010' })
    if (t === 'gradient') setV({ type: 'gradient', colors: ['#ff7a18', '#7a1fa2'], angle: 135 })
    if (t === 'shader') setV({ type: 'shader', shader: 'aurora', params: defaultShaderParams() })
    if (t === 'media') setV({ type: 'media', mediaId: media[0]?.id ?? '', kind: (media[0]?.kind as any) ?? 'image', fit: 'cover' })
  }
  const previewTheme = kind === 'overlay' ? getState().themes.find((t) => t.id === getState().live.themeId) : null
  return (
    <Modal
      title={kind === 'theme' ? 'Tema' : 'Sobreposição'}
      onClose={onClose}
      wide
      footer={
        <>
          <Btn onClick={onClose}>Cancelar</Btn>
          <Btn kind="primary" onClick={() => onSave(it)}>Salvar</Btn>
        </>
      }
    >
      <div className="visual-editor">
        <div className="ve-preview">
          <div className="preview-box" style={{ aspectRatio: '16/9' }}>
            <div style={{ position: 'absolute', inset: 0, isolation: 'isolate', background: '#000' }}>
              {previewTheme && <VisualView visual={previewTheme.visual} maxW={900} />}
              <div style={{ position: 'absolute', inset: 0, mixBlendMode: ('blend' in it ? it.blend : 'normal') as any, opacity: 'opacity' in it ? it.opacity : 1 }}>
                <VisualView visual={it.visual} maxW={900} />
              </div>
              {'dim' in it && it.dim > 0 && <div style={{ position: 'absolute', inset: 0, background: `rgba(0,0,0,${it.dim})` }} />}
            </div>
          </div>
          {kind === 'overlay' && <p className="hint">Prévia por cima do tema que está no ar agora.</p>}
        </div>
        <div className="ve-props">
          <label className="field"><span>Nome</span><input value={it.name} onChange={(e) => setIt({ ...it, name: e.target.value })} /></label>
          <div className="seg wide">
            {(['shader', 'gradient', 'color', 'media'] as const).map((t) => (
              <button key={t} className={v.type === t ? 'on' : ''} onClick={() => switchType(t)}>
                {t === 'shader' ? 'Gerador ao vivo' : t === 'gradient' ? 'Gradiente' : t === 'color' ? 'Cor' : 'Imagem/Vídeo'}
              </button>
            ))}
          </div>
          {v.type === 'shader' && (
            <>
              <div className="shader-grid">
                {(Object.keys(SHADER_LABELS) as ShaderName[]).map((n) => (
                  <button key={n} className={'chip' + (v.shader === n ? ' on' : '')} onClick={() => setV({ ...v, shader: n })}>{SHADER_LABELS[n]}</button>
                ))}
              </div>
              <div className="row">
                <ColorField label="Base" value={v.params.colorA} onChange={(c) => setV({ ...v, params: { ...v.params, colorA: c } })} />
                <ColorField label="Cor 1" value={v.params.colorB} onChange={(c) => setV({ ...v, params: { ...v.params, colorB: c } })} />
                <ColorField label="Cor 2" value={v.params.colorC} onChange={(c) => setV({ ...v, params: { ...v.params, colorC: c } })} />
              </div>
              <Slider label="Velocidade" min={0} max={2} step={0.05} value={v.params.speed} onChange={(x) => setV({ ...v, params: { ...v.params, speed: x } })} />
              <Slider label="Intensidade" min={0} max={2} step={0.05} value={v.params.intensity} onChange={(x) => setV({ ...v, params: { ...v.params, intensity: x } })} />
              <Slider label="Escala" min={0.3} max={3} step={0.05} value={v.params.scale} onChange={(x) => setV({ ...v, params: { ...v.params, scale: x } })} />
            </>
          )}
          {v.type === 'gradient' && (
            <>
              <div className="row">
                <ColorField label="Cor 1" value={v.colors[0]} onChange={(c) => setV({ ...v, colors: [c, v.colors[1]] })} />
                <ColorField label="Cor 2" value={v.colors[1]} onChange={(c) => setV({ ...v, colors: [v.colors[0], c] })} />
              </div>
              <Slider label="Ângulo (−1 = radial)" min={-1} max={360} value={v.angle} onChange={(x) => setV({ ...v, angle: x })} suffix="°" />
            </>
          )}
          {v.type === 'color' && <ColorField label="Cor" value={v.color} onChange={(c) => setV({ ...v, color: c })} />}
          {v.type === 'media' && (
            <>
              <div className="media-pick">
                {media.map((m) => (
                  <button key={m.id} className={'mp' + (v.mediaId === m.id ? ' on' : '')} onClick={() => setV({ ...v, mediaId: m.id, kind: m.kind as any })} style={{ background: `#000 url(${m.thumb}) center/cover` }} title={m.name}>
                    {m.kind === 'video' && <span className="badge-r">VÍDEO</span>}
                  </button>
                ))}
                {!media.length && <p className="hint">Importe imagens ou vídeos na aba Arquivos primeiro.</p>}
              </div>
              <Select label="Enquadramento" value={v.fit ?? 'cover'} onChange={(f) => setV({ ...v, fit: f })} options={[{ value: 'cover', label: 'Preencher' }, { value: 'contain', label: 'Inteiro' }]} />
            </>
          )}
          {'dim' in it && <Slider label="Escurecer (melhora a leitura da letra)" min={0} max={0.9} step={0.05} value={it.dim} onChange={(x) => setIt({ ...it, dim: x })} />}
          {'blend' in it && (
            <>
              <Select label="Modo de mesclagem" value={it.blend} onChange={(b) => setIt({ ...it, blend: b })} options={BLEND_OPTIONS} />
              <Slider label="Opacidade" min={0} max={1} step={0.05} value={it.opacity} onChange={(x) => setIt({ ...it, opacity: x })} />
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}

// ---------------- Músicas ----------------
function SongsLib() {
  const songs = useStore((s) => s.songs)
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const list = songs.filter((s) => norm(s.title + ' ' + (s.artist ?? '')).includes(norm(q))).sort((a, b) => a.title.localeCompare(b.title, 'pt'))
  return (
    <div>
      <DropZone
        accept=".txt,.xml,.json,.zip,.lyrics"
        label={busy ? 'Importando…' : 'Importar músicas (TXT, ZIP com TXT, OpenLyrics XML, JSON)'}
        onFiles={async (f) => {
          setBusy(true)
          try {
            const r = await readSongFiles(f)
            const existing = new Set(getState().songs.map((s) => norm(s.title)))
            const fresh = r.filter((s) => !existing.has(norm(s.title)))
            setState((s) => ({ ...s, songs: [...s.songs, ...fresh] }))
            toast(`${fresh.length} música(s) importada(s)` + (r.length - fresh.length ? ` · ${r.length - fresh.length} já existiam` : ''))
          } catch (e: any) {
            alert('Erro ao importar: ' + e.message)
          }
          setBusy(false)
        }}
      />
      <div className="help-box">
        <b>Do Holyrics:</b> exporte as músicas como <b>texto (.txt)</b>. Pode selecionar vários arquivos de uma vez ou mandar um <b>.zip</b> com todos.
        Formato: 1ª linha = título, 2ª = artista (opcional), linha em branco separa os slides, e <code>[Refrão]</code> numa linha sozinha nomeia o slide.
      </div>
      <div className="row" style={{ margin: '10px 0' }}>
        <input placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: 1 }} />
        <Btn kind="primary" onClick={() => setUI({ editSongId: 'new' })}>+ Nova música</Btn>
        <Btn
          kind="ghost"
          onClick={() => {
            const n = parseInt(prompt('Dividir TODAS as músicas em slides de quantas linhas? (ex.: 2)', '2') ?? '')
            if (!n) return
            import('../core/songs').then(({ splitSlides }) => setState((s) => ({ ...s, songs: s.songs.map((x) => splitSlides(x, n)) })))
          }}
        >
          Dividir todas…
        </Btn>
      </div>
      <table className="table">
        <thead>
          <tr><th>Título</th><th>Artista</th><th>Slides</th><th /></tr>
        </thead>
        <tbody>
          {list.map((s) => (
            <tr key={s.id}>
              <td>{s.title}</td>
              <td>{s.artist}</td>
              <td>{s.slides.length}</td>
              <td className="right">
                <Btn small icon={Pencil} onClick={() => setUI({ editSongId: s.id })}>Editar</Btn>
                <Btn small kind="ghost" onClick={() => confirm(`Excluir "${s.title}"?`) && setState((st) => ({ ...st, songs: st.songs.filter((x) => x.id !== s.id) }))}>🗑</Btn>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------- Bíblias ----------------
function BiblesLib() {
  const bibles = useStore((s) => s.bibles)
  const def = useStore((s) => s.settings.bibleId)
  const [busy, setBusy] = useState(false)
  return (
    <div>
      <DropZone
        accept=".json,.xml,.zefania,.osis,.txt"
        label={busy ? 'Importando…' : 'Importar Bíblia (JSON, Zefania XML, OSIS, OpenSong, Beblia)'}
        onFiles={async (files) => {
          setBusy(true)
          for (const f of Array.from(files)) {
            try {
              const b = parseBible(f.name, decodeText(new Uint8Array(await f.arrayBuffer())))
              const abbr = prompt(`Sigla da versão para "${b.name}" (ex.: NVI, ARA, NAA)`, b.abbrev) || b.abbrev
              b.abbrev = abbr.toUpperCase()
              b.name = abbr.toUpperCase()
              await saveBible(b)
              setState((s) => ({ ...s, bibles: [...s.bibles, { id: b.id, name: b.name, abbrev: b.abbrev }], settings: { ...s.settings, bibleId: s.settings.bibleId || b.id } }))
              const verses = b.books.reduce((a, bk) => a + bk.chapters.reduce((c, ch) => c + ch.length, 0), 0)
              toast(`${b.abbrev}: ${b.books.length} livros, ${verses} versículos`)
            } catch (e: any) {
              alert(`Não consegui ler "${f.name}": ${e.message}`)
            }
          }
          setBusy(false)
        }}
      />
      <div className="help-box">
        As versões mais usadas (NVI, NAA, ARA, ARC, NVT) têm direitos autorais e não vêm junto com o sistema.
        Importe aqui os arquivos das versões que a igreja tem direito de usar. Formatos aceitos: JSON (lista de livros com capítulos), Zefania XML, OSIS, OpenSong e Beblia XML.
      </div>
      <table className="table">
        <thead>
          <tr><th>Versão</th><th>Padrão</th><th /></tr>
        </thead>
        <tbody>
          {bibles.map((b) => (
            <tr key={b.id}>
              <td><b>{b.abbrev}</b></td>
              <td>
                <input type="radio" checked={def === b.id} onChange={() => setState((s) => ({ ...s, settings: { ...s.settings, bibleId: b.id } }))} />
              </td>
              <td className="right">
                <Btn
                  small
                  kind="ghost"
                  onClick={async () => {
                    if (!confirm(`Excluir a versão ${b.abbrev}?`)) return
                    await deleteBible(b.id)
                    setState((s) => ({ ...s, bibles: s.bibles.filter((x) => x.id !== b.id), settings: { ...s.settings, bibleId: s.settings.bibleId === b.id ? '' : s.settings.bibleId } }))
                  }}
                >
                  <Trash2 size={14} />
                </Btn>
              </td>
            </tr>
          ))}
          {!bibles.length && (
            <tr><td colSpan={3} className="dim">Nenhuma versão importada ainda.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
