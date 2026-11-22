import { useState } from 'react'
import { useStore, useSnapshot, actions, setState, setLive, type AppState } from '../../core/store'
import { useUI, select, goLive, clearText, setUI } from '../../ui/uiStore'
import { Btn, OutputPreview } from '../../ui/common'
import type { ServiceItem } from '../../core/types'
import { BOOKS_PT } from '../../core/bible'
import { uid } from '../../core/defaults'

export function RightPanel() {
  return (
    <aside className="right-panel">
      <Previews />
      <LiveButtons />
      <ServiceList />
    </aside>
  )
}

function Previews() {
  const snap = useSnapshot()
  return (
    <section className="previews">
      <div className="pv main">
        <span className="pv-label">TELÃO</span>
        <OutputPreview kind="telao" snap={snap} />
      </div>
      <div className="pv-row">
        <div className="pv">
          <span className="pv-label">LATERAIS</span>
          <OutputPreview kind="laterais" snap={snap} />
        </div>
        <div className="pv">
          <span className="pv-label">RETORNO</span>
          <OutputPreview kind="retorno" snap={snap} />
        </div>
      </div>
      <div className="pv-row">
        <div className="pv">
          <span className="pv-label">LIVE (OBS)</span>
          <OutputPreview kind="live" snap={snap} />
        </div>
        <NowPlaying />
      </div>
    </section>
  )
}

function NowPlaying() {
  const text = useStore((s) => s.live.text)
  const media = useStore((s) => s.live.media)
  const cursor = useUI((u) => u.cursor)
  return (
    <div className="now-playing">
      {media && <div><small>MÍDIA</small><b>{media.name}</b></div>}
      {text ? (
        <div>
          <small>LETRA</small>
          <b>{text.title}</b>
          {cursor && <span>{cursor.index + 1}/{cursor.slides.length}</span>}
        </div>
      ) : (
        !media && <div className="dim">Nada no ar</div>
      )}
    </div>
  )
}

function LiveButtons() {
  const black = useStore((s) => s.live.black)
  const textVisible = useStore((s) => s.live.textVisible)
  const hasText = useStore((s) => !!s.live.text)
  const hasMedia = useStore((s) => !!s.live.media)
  return (
    <section className="live-buttons">
      <Btn onClick={clearText} disabled={!hasText} title="Esc">✕ Letra</Btn>
      <Btn onClick={() => setLive((l) => ({ ...l, textVisible: !l.textVisible }))} active={!textVisible} disabled={!hasText}>{textVisible ? 'Ocultar letra' : 'Mostrar letra'}</Btn>
      <Btn onClick={actions.clearMedia} disabled={!hasMedia}>✕ Mídia</Btn>
      <Btn kind={black ? 'danger' : 'default'} onClick={actions.toggleBlack} active={black} title="B">■ Preto</Btn>
      <Btn kind="ghost" onClick={() => { clearText(); actions.clearAll() }}>Limpar tudo</Btn>
    </section>
  )
}

function itemInfo(it: ServiceItem, st: AppState): { icon: string; title: string; sub?: string } {
  switch (it.type) {
    case 'song': {
      const so = st.songs.find((x) => x.id === it.songId)
      return { icon: '♪', title: so?.title ?? '(música removida)', sub: so?.artist }
    }
    case 'bible': {
      const b = st.bibles.find((x) => x.id === it.versionId)
      return { icon: '✝', title: `${BOOKS_PT[it.book]?.[0] ?? ''} ${it.chapter}:${it.verseFrom}`, sub: b?.abbrev }
    }
    case 'media': {
      const m = st.media.find((x) => x.id === it.mediaId)
      return { icon: m?.kind === 'video' ? '▶' : '▣', title: m?.name ?? '(arquivo removido)', sub: m?.kind === 'video' ? 'vídeo' : 'imagem' }
    }
    case 'pptx': {
      const m = st.media.find((x) => x.id === it.mediaId)
      return { icon: 'P', title: m?.name ?? '(arquivo removido)', sub: 'PowerPoint' }
    }
    case 'note':
      return { icon: '✎', title: it.text, sub: 'anotação' }
  }
}

function ServiceList() {
  const service = useStore((s) => s.service)
  const st = useStore((s) => s)
  const sel = useUI((u) => u.selection)
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [over, setOver] = useState<number | null>(null)

  const openItem = async (it: ServiceItem, live = false) => {
    if (it.type === 'song') {
      await select({ type: 'song', songId: it.songId })
      if (live) goLive(0)
    } else if (it.type === 'bible') {
      await select({ type: 'bible', versionId: it.versionId, book: it.book, chapter: it.chapter, verse: it.verseFrom })
      if (live) goLive(it.verseFrom - 1)
      setTimeout(() => document.querySelector('.slide.target')?.scrollIntoView({ block: 'center' }), 50)
    } else if (it.type === 'media') {
      await select({ type: 'media', mediaId: it.mediaId })
      const m = st.media.find((x) => x.id === it.mediaId)
      if (live && m) actions.playMedia(m)
    } else if (it.type === 'pptx') {
      await select({ type: 'pptx', mediaId: it.mediaId })
    }
  }
  const isSel = (it: ServiceItem) =>
    (it.type === 'song' && sel?.type === 'song' && sel.songId === it.songId) ||
    ((it.type === 'media' || it.type === 'pptx') && (sel?.type === 'media' || sel?.type === 'pptx') && sel.mediaId === it.mediaId) ||
    (it.type === 'bible' && sel?.type === 'bible' && sel.book === it.book && sel.chapter === it.chapter)

  const move = (from: number, to: number) =>
    setState((s) => {
      const arr = [...s.service]
      const [x] = arr.splice(from, 1)
      arr.splice(to > from ? to - 1 : to, 0, x)
      return { ...s, service: arr }
    })

  return (
    <section
      className="service"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('application/x-service-item')) e.preventDefault()
      }}
      onDrop={(e) => {
        const raw = e.dataTransfer.getData('application/x-service-item')
        if (!raw) return
        e.preventDefault()
        const item = { ...JSON.parse(raw), id: uid() } as ServiceItem
        setState((s) => {
          const arr = [...s.service]
          arr.splice(over ?? arr.length, 0, item)
          return { ...s, service: arr }
        })
        setOver(null)
      }}
    >
      <div className="sec-head">
        <h4>Culto</h4>
        <div className="row">
          <Btn small kind="ghost" title="Adicionar anotação" onClick={() => { const t = prompt('Anotação (ex.: Oração, Ofertório, Avisos)'); if (t) setState((s) => ({ ...s, service: [...s.service, { id: uid(), type: 'note', text: t }] })) }}>+ nota</Btn>
          <Btn small kind="ghost" title="Começar um culto novo (lista vazia)" onClick={() => confirm('Limpar a lista do culto?') && setState((s) => ({ ...s, service: [] }))}>Novo</Btn>
        </div>
      </div>
      <div className="service-list">
        {service.map((it, i) => {
          const info = itemInfo(it, st)
          return (
            <div
              key={it.id}
              className={'svc-item t-' + it.type + (isSel(it) ? ' sel' : '') + (over === i ? ' drop-before' : '')}
              draggable
              onDragStart={(e) => {
                setDragIdx(i)
                e.dataTransfer.effectAllowed = 'move'
              }}
              onDragEnd={() => {
                setDragIdx(null)
                setOver(null)
              }}
              onDragOver={(e) => {
                e.preventDefault()
                setOver(i)
              }}
              onDrop={(e) => {
                if (dragIdx !== null) {
                  e.preventDefault()
                  e.stopPropagation()
                  move(dragIdx, i)
                  setDragIdx(null)
                  setOver(null)
                }
              }}
              onClick={() => openItem(it)}
              onDoubleClick={() => openItem(it, true)}
              onContextMenu={(e) => {
                e.preventDefault()
                if (it.type === 'song') setUI({ editSongId: it.songId })
              }}
            >
              <span className="svc-ico">{info.icon}</span>
              <div className="li-main">
                <span className="li-title">{info.title}</span>
                {info.sub && <span className="li-sub">{info.sub}</span>}
              </div>
              <button className="li-del" title="Remover do culto" onClick={(e) => { e.stopPropagation(); setState((s) => ({ ...s, service: s.service.filter((x) => x.id !== it.id) })) }}>✕</button>
            </div>
          )
        })}
        <div
          className={'svc-drop' + (over === service.length ? ' drop-before' : '')}
          onDragOver={(e) => {
            e.preventDefault()
            setOver(service.length)
          }}
          onDrop={(e) => {
            if (dragIdx !== null) {
              e.preventDefault()
              e.stopPropagation()
              move(dragIdx, service.length)
              setDragIdx(null)
              setOver(null)
            }
          }}
        >
          Arraste músicas, versículos e arquivos para cá
        </div>
      </div>
    </section>
  )
}
