import { Radio, SlidersHorizontal, Library, Timer, Settings2, MonitorUp } from 'lucide-react'
import { useEffect } from 'react'
import { subscribe, getState, snapshotOf, actions, useStore, setLive } from '../core/store'
import { startPublisher, publish, startLivePeer, peerStatus } from '../core/sync'
import { useUI, setUI, step, clearText, getUI, goLive } from '../ui/uiStore'
import { LeftPanel } from './live/LeftPanel'
import { ScenePad, SelectionView } from './live/Center'
import { BottomPanel } from './live/BottomPanel'
import { RightPanel } from './live/RightPanel'
import { ProgramPage } from './ProgramPage'
import { LibraryPage } from './LibraryPage'
import { StagePage } from './StagePage'
import { SettingsPage, openAllOutputs } from './SettingsPage'
import { SongEditor } from '../ui/SongEditor'
import { importMediaFiles } from '../core/files'
import { fmtClock, useNow } from '../render/Stage'
import { useState } from 'react'

function LivePage() {
  return (
    <div className="live-page">
      <LeftPanel />
      <main className="live-center">
        <ScenePad />
        <SelectionView />
        <BottomPanel />
      </main>
      <RightPanel />
    </div>
  )
}

function TopBar() {
  const page = useUI((u) => u.page)
  const black = useStore((s) => s.live.black)
  const now = useNow(1000)
  const [, force] = useState(0)
  useEffect(() => {
    const l = () => force((x) => x + 1)
    peerStatus.listeners.add(l)
    return () => {
      peerStatus.listeners.delete(l)
    }
  }, [])
  const tabs: { id: typeof page; label: string; icon: typeof Radio }[] = [
    { id: 'live', label: 'Ao vivo', icon: Radio },
    { id: 'program', label: 'Cenas', icon: SlidersHorizontal },
    { id: 'library', label: 'Biblioteca', icon: Library },
    { id: 'stage', label: 'Retorno', icon: Timer },
    { id: 'settings', label: 'Ajustes', icon: Settings2 },
  ]
  const live = peerStatus.state === 'online'
  return (
    <header className="topbar">
      <div className="brand">
        <span className="logo"><i /><i /><i /></span>
        <span>Projeção</span>
      </div>
      <nav>
        {tabs.map((t) => (
          <button key={t.id} className={page === t.id ? 'on' : ''} onClick={() => setUI({ page: t.id })}>
            <t.icon size={15} strokeWidth={1.75} />
            {t.label}
          </button>
        ))}
      </nav>
      <div className="grow" />
      {black && <span className="status-pill danger">Tela preta</span>}
      <span className={'status-dot ' + (live ? 'ok' : '')} title="Envio da letra para o OBS da live">
        <i />
        {live ? `Live · ${peerStatus.clients} OBS` : `Live · ${peerStatus.state}`}
      </span>
      <button className="btn btn-outputs" onClick={openAllOutputs} title="Abre telão, laterais e TV de retorno nos monitores configurados">
        <MonitorUp size={15} strokeWidth={1.75} /> Abrir saídas
      </button>
      <span className="clock">{fmtClock(now, true)}</span>
    </header>
  )
}

function Toast() {
  const t = useUI((u) => u.toast)
  return t ? <div className="toast">{t}</div> : null
}

function isTyping(e: KeyboardEvent) {
  const el = e.target as HTMLElement
  return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)
}

export function ControlApp() {
  const editSongId = useUI((u) => u.editSongId)
  const page = useUI((u) => u.page)

  // envia o estado para as saídas sempre que algo muda
  useEffect(() => {
    startPublisher()
    let raf = 0
    const push = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => publish(snapshotOf(getState())))
    }
    push()
    const un = subscribe(push)
    if (getState().settings.liveEnabled) startLivePeer(getState().settings.roomId)
    navigator.storage?.persist?.().catch(() => {})
    // reenvia periodicamente (janelas abertas depois, cronômetro etc.)
    const iv = setInterval(() => publish(snapshotOf(getState())), 3000)
    return () => {
      un()
      clearInterval(iv)
    }
  }, [])

  // atalhos de teclado e passador
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e) || getUI().editSongId || document.querySelector('.modal-bg')) return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const k = e.key
      const startIfNeeded = () => {
        const u = getUI()
        if (!u.cursor && u.selection && (u.selection.type === 'song' || u.selection.type === 'bible')) {
          goLive(u.selection.type === 'bible' ? u.selection.verse - 1 : 0)
          return true
        }
        return false
      }
      if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].includes(k)) {
        e.preventDefault()
        if (!startIfNeeded()) step(1)
      } else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(k)) {
        e.preventDefault()
        step(-1)
      } else if (k === 'Escape') {
        clearText()
      } else if (k === 'b' || k === 'B' || k === '.') {
        e.preventDefault()
        actions.toggleBlack()
      } else if (k === 'm' || k === 'M') {
        actions.clearMedia()
      } else if (k === 'a' || k === 'A') {
        setLive((l) => ({ ...l, alert: { ...l.alert, visible: !l.alert.visible } }))
      } else if (k === 'F5') {
        // passadores mandam F5 para "iniciar apresentação": não recarregar a página
        e.preventDefault()
      } else if (/^[1-9]$/.test(k)) {
        const sc = getState().scenes[parseInt(k) - 1]
        if (sc) actions.applyScene(sc.id)
      }
    }
    window.addEventListener('keydown', onKey)
    const beforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', beforeUnload)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('beforeunload', beforeUnload)
    }
  }, [])

  return (
    <div
      className="app"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) e.preventDefault()
      }}
      onDrop={(e) => {
        if (e.dataTransfer.files.length && !(e.target as HTMLElement).closest('.dropzone')) {
          e.preventDefault()
          importMediaFiles(e.dataTransfer.files).then((r) => r.length && setUI({ leftTab: 'files' }))
        }
      }}
    >
      <TopBar />
      <div className="page">
        {page === 'live' && <LivePage />}
        {page === 'program' && <ProgramPage />}
        {page === 'library' && <LibraryPage />}
        {page === 'stage' && <StagePage />}
        {page === 'settings' && <SettingsPage />}
      </div>
      {editSongId && <SongEditor songId={editSongId} />}
      <Toast />
    </div>
  )
}
