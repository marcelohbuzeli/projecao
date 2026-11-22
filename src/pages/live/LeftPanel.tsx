import { Music, BookOpen, FolderOpen, Inbox } from 'lucide-react'
import { EnviosPanel, useEnvios } from './EnviosPanel'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore, setState, getState, actions } from '../../core/store'
import { useUI, setUI, select, goLive, toast } from '../../ui/uiStore'
import { Tabs, Btn, useContextMenu } from '../../ui/common'
import { norm, parseRef, BOOKS_PT, searchText } from '../../core/bible'
import { loadBible } from '../../core/db'
import type { BibleVersion, ServiceItem, MediaItem } from '../../core/types'
import { uid } from '../../core/defaults'
import { importMediaFiles } from '../../core/files'

type NewItem = ServiceItem extends infer T ? (T extends ServiceItem ? Omit<T, 'id'> : never) : never

export function addToService(item: NewItem) {
  setState((s) => ({ ...s, service: [...s.service, { ...item, id: uid() } as ServiceItem] }))
  toast('Adicionado ao culto')
}

export function dragData(e: React.DragEvent, item: NewItem) {
  e.dataTransfer.setData('application/x-service-item', JSON.stringify(item))
  e.dataTransfer.effectAllowed = 'copy'
}

export function LeftPanel() {
  const tab = useUI((u) => u.leftTab)
  const envios = useEnvios()
  const nNew = envios.list.filter((e) => e.status === 'novo').length
  return (
    <aside className="left-panel">
      <Tabs
        value={tab}
        onChange={(v) => setUI({ leftTab: v })}
        tabs={[
          { id: 'songs', label: <><Music size={14} /><span className="tl">Músicas</span></> },
          { id: 'bible', label: <><BookOpen size={14} /><span className="tl">Bíblia</span></> },
          { id: 'files', label: <><FolderOpen size={14} /><span className="tl">Arquivos</span></> },
          { id: 'envios', label: <><Inbox size={14} /><span className="tl">Envios</span>{nNew > 0 && <b className="tab-badge">{nNew}</b>}</> },
        ]}
      />
      {tab === 'songs' && <SongsList />}
      {tab === 'bible' && <BiblePanel />}
      {tab === 'files' && <FilesList />}
      {tab === 'envios' && <EnviosPanel />}
    </aside>
  )
}

function SongsList() {
  const songs = useStore((s) => s.songs)
  const sel = useUI((u) => u.selection)
  const cursorKey = useUI((u) => u.cursor?.key)
  const [q, setQ] = useState('')
  const ctx = useContextMenu()
  const list = useMemo(() => {
    const n = norm(q)
    const sorted = [...songs].sort((a, b) => a.title.localeCompare(b.title, 'pt'))
    if (!n) return sorted
    const byTitle = sorted.filter((s) => norm(s.title).includes(n) || norm(s.artist ?? '').includes(n))
    const byText = sorted.filter((s) => !byTitle.includes(s) && s.slides.some((sl) => norm(sl.text).includes(n)))
    return [...byTitle, ...byText]
  }, [songs, q])
  return (
    <div className="panel-col">
      <div className="search-row">
        <input placeholder="Buscar título, artista ou trecho…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
        <Btn small kind="primary" title="Nova música" onClick={() => setUI({ editSongId: 'new' })}>+</Btn>
      </div>
      <div className="list">
        {list.map((s) => (
          <div
            key={s.id}
            draggable
            onDragStart={(e) => dragData(e, { type: 'song', songId: s.id })}
            className={'list-item' + (sel?.type === 'song' && sel.songId === s.id ? ' sel' : '') + (cursorKey === 'song:' + s.id ? ' live' : '')}
            onClick={() => select({ type: 'song', songId: s.id })}
            onDoubleClick={async () => {
              await select({ type: 'song', songId: s.id })
              goLive(0)
            }}
            onContextMenu={(e) =>
              ctx.open(e, [
                { label: 'Editar letra', onClick: () => setUI({ editSongId: s.id }) },
                { label: 'Adicionar ao culto', onClick: () => addToService({ type: 'song', songId: s.id }) },
                {
                  label: 'Duplicar',
                  onClick: () => setState((st) => ({ ...st, songs: [...st.songs, { ...structuredClone(s), id: uid(), title: s.title + ' (cópia)' }] })),
                },
                {
                  label: 'Excluir',
                  danger: true,
                  onClick: () => confirm(`Excluir "${s.title}"?`) && setState((st) => ({ ...st, songs: st.songs.filter((x) => x.id !== s.id) })),
                },
              ])
            }
          >
            <div className="li-main">
              <span className="li-title">{s.title}</span>
              {s.artist && <span className="li-sub">{s.artist}</span>}
            </div>
            <span className="li-meta">{s.slides.length}</span>
            <button className="li-add" title="Adicionar ao culto" onClick={(e) => { e.stopPropagation(); addToService({ type: 'song', songId: s.id }) }}>+</button>
          </div>
        ))}
        {!list.length && <div className="empty">Nenhuma música. Importe na Biblioteca ou clique em +.</div>}
      </div>
      <div className="panel-foot">{songs.length} músicas · botão direito para editar</div>
      {ctx.node}
    </div>
  )
}

function BiblePanel() {
  const bibles = useStore((s) => s.bibles)
  const bibleId = useStore((s) => s.settings.bibleId) || bibles[0]?.id || ''
  const sel = useUI((u) => u.selection)
  const [bible, setBible] = useState<BibleVersion | null>(null)
  const [q, setQ] = useState('')
  const [book, setBook] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (bibleId) loadBible(bibleId).then(setBible)
    else setBible(null)
  }, [bibleId])

  if (!bibles.length)
    return (
      <div className="panel-col">
        <div className="empty">
          Nenhuma Bíblia importada.
          <br />
          <br />
          <Btn kind="primary" onClick={() => setUI({ page: 'library', libraryTab: 'bibles' })}>Importar Bíblia</Btn>
        </div>
      </div>
    )

  const ref = bible && q ? parseRef(bible, q) : null
  const textHits = bible && q.length >= 4 && !ref ? searchText(bible, q, 40) : []
  const go = async (b: number, c: number, v: number, live = false) => {
    await select({ type: 'bible', versionId: bibleId, book: b, chapter: c, verse: v })
    if (live) goLive(v - 1)
    setTimeout(() => document.querySelector('.slide.target')?.scrollIntoView({ block: 'center' }), 50)
  }
  const curSelBook = sel?.type === 'bible' ? sel.book : null

  return (
    <div className="panel-col">
      <div className="search-row">
        <select value={bibleId} onChange={(e) => setState((s) => ({ ...s, settings: { ...s.settings, bibleId: e.target.value } }))} style={{ maxWidth: 90 }}>
          {bibles.map((b) => (
            <option key={b.id} value={b.id}>{b.abbrev}</option>
          ))}
        </select>
        <input
          ref={inputRef}
          placeholder='Ex.: "jo 3 16" ou palavra'
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && ref) go(ref.book, ref.chapter, ref.verseFrom, true)
          }}
        />
      </div>
      {ref && bible && (
        <div className="ref-preview" onClick={() => go(ref.book, ref.chapter, ref.verseFrom)}>
          <b>{bible.books[ref.book].name} {ref.chapter}:{ref.verseFrom}</b>
          <p>{bible.books[ref.book].chapters[ref.chapter - 1]?.[ref.verseFrom - 1]}</p>
          <small>Enter = colocar no ar · clique = abrir capítulo</small>
        </div>
      )}
      {textHits.length > 0 && (
        <div className="list">
          {textHits.map((h, i) => (
            <div key={i} className="list-item col" onClick={() => go(h.book, h.chapter, h.verse)}>
              <b>{bible!.books[h.book].name} {h.chapter}:{h.verse}</b>
              <span className="li-sub">{h.text}</span>
            </div>
          ))}
        </div>
      )}
      {!q && bible && (
        <div className="list">
          {book === null ? (
            <div className="book-grid">
              {bible.books.map((b, i) => (
                <button key={i} className={curSelBook === i ? 'on' : ''} onClick={() => setBook(i)} title={b.name}>
                  {BOOKS_PT[i]?.[1] ?? b.abbrev}
                </button>
              ))}
            </div>
          ) : (
            <>
              <div className="book-head">
                <Btn small kind="ghost" onClick={() => setBook(null)}>← Livros</Btn>
                <b>{bible.books[book].name}</b>
              </div>
              <div className="book-grid ch">
                {bible.books[book].chapters.map((_, c) => (
                  <button key={c} className={sel?.type === 'bible' && sel.book === book && sel.chapter === c + 1 ? 'on' : ''} onClick={() => go(book, c + 1, 1)}>
                    {c + 1}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
      <div className="panel-foot">
        {sel?.type === 'bible' && (
          <Btn small onClick={() => addToService({ type: 'bible', versionId: sel.versionId, book: sel.book, chapter: sel.chapter, verseFrom: sel.verse, verseTo: sel.verse })}>
            + Adicionar capítulo ao culto
          </Btn>
        )}
      </div>
    </div>
  )
}

function FilesList() {
  const media = useStore((s) => s.media)
  const sel = useUI((u) => u.selection)
  const live = useStore((s) => s.live.media)
  const [filter, setFilter] = useState<'all' | MediaItem['kind']>('all')
  const [q, setQ] = useState('')
  const ctx = useContextMenu()
  const fileRef = useRef<HTMLInputElement>(null)
  const list = media.filter((m) => (filter === 'all' || m.kind === filter) && norm(m.name).includes(norm(q)))
  const openItem = (m: MediaItem) => select(m.kind === 'pptx' ? { type: 'pptx', mediaId: m.id } : { type: 'media', mediaId: m.id })
  return (
    <div className="panel-col">
      <div className="search-row">
        <input placeholder="Buscar arquivo…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Btn small kind="primary" title="Importar imagens, vídeos ou PowerPoint" onClick={() => fileRef.current?.click()}>+</Btn>
        <input
          ref={fileRef}
          type="file"
          multiple
          hidden
          accept="image/*,video/*,.pptx,.ppsx,.ppt,.pps"
          onChange={async (e) => {
            if (e.target.files) {
              const n = await importMediaFiles(e.target.files)
              toast(`${n.length} arquivo(s) importado(s)`)
            }
            e.target.value = ''
          }}
        />
      </div>
      <Tabs
        small
        value={filter}
        onChange={setFilter}
        tabs={[
          { id: 'all', label: 'Todos' },
          { id: 'image', label: 'Imagens' },
          { id: 'video', label: 'Vídeos' },
          { id: 'pptx', label: 'PowerPoint' },
        ]}
      />
      <div className="list file-grid">
        {list.map((m) => (
          <div
            key={m.id}
            draggable
            onDragStart={(e) => dragData(e, m.kind === 'pptx' ? { type: 'pptx', mediaId: m.id } : { type: 'media', mediaId: m.id })}
            className={'file-item' + ((sel?.type === 'media' || sel?.type === 'pptx') && sel.mediaId === m.id ? ' sel' : '') + (live?.mediaId === m.id ? ' live' : '')}
            onClick={() => openItem(m)}
            onDoubleClick={() => (m.kind === 'pptx' ? openItem(m) : actions.playMedia(m, false))}
            onContextMenu={(e) =>
              ctx.open(e, [
                ...(m.kind !== 'pptx'
                  ? [
                      { label: 'Mostrar no telão', onClick: () => actions.playMedia(m, false) },
                      ...(m.kind === 'video' ? [{ label: 'Mostrar em loop', onClick: () => actions.playMedia(m, true) }] : []),
                      {
                        label: 'Usar como tema (fundo)',
                        onClick: () => {
                          const id = uid()
                          setState((s) => ({ ...s, themes: [...s.themes, { id, name: m.name, visual: { type: 'media', mediaId: m.id, kind: m.kind as 'image' | 'video' }, dim: 0 }] }))
                          actions.setTheme(id)
                          toast('Tema criado e aplicado')
                        },
                      },
                    ]
                  : []),
                { label: 'Adicionar ao culto', onClick: () => addToService(m.kind === 'pptx' ? { type: 'pptx', mediaId: m.id } : { type: 'media', mediaId: m.id }) },
              ])
            }
          >
            <div className="fi-thumb" style={{ background: m.thumb ? `#000 url(${m.thumb}) center/cover` : '#1a1a1a' }}>
              {m.kind === 'video' && <span className="badge-r">{m.duration ? fmtDur(m.duration) : 'VÍDEO'}</span>}
              {m.kind === 'pptx' && <span className="pptx-ico">P</span>}
            </div>
            <span className="fi-name">{m.name}</span>
          </div>
        ))}
        {!list.length && <div className="empty">Arraste arquivos para cá ou clique em +.</div>}
      </div>
      <div className="panel-foot">Clique = ver · duplo clique = no ar · botão direito = opções</div>
      {ctx.node}
    </div>
  )
}

export const fmtDur = (d: number) => `${Math.floor(d / 60)}:${String(Math.floor(d % 60)).padStart(2, '0')}`

export function getStateSong(id: string) {
  return getState().songs.find((s) => s.id === id)
}
