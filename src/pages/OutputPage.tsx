import { useEffect, useState } from 'react'
import type { OutputId, Snapshot } from '../core/types'
import { subscribeSnapshots, subscribeRemote } from '../core/sync'
import { Composite, LiveComposite } from '../render/Layers'
import { StageView } from '../render/Stage'

const NAMES: Record<OutputId, string> = { telao: 'Telão central', laterais: 'Projetores laterais', retorno: 'TV de retorno', live: 'Live (OBS)' }

export function OutputPage({ id, room }: { id: OutputId; room?: string }) {
  const [snap, setSnap] = useState<Snapshot | null>(null)
  const [hint, setHint] = useState(true)
  const [remoteStatus, setRemoteStatus] = useState('')
  const [isFs, setIsFs] = useState(!!document.fullscreenElement)

  useEffect(() => {
    document.title = NAMES[id] + ' — Projeção'
    document.body.classList.add('output-body')
    if (id === 'live') document.body.classList.add('transparent-body')
    let stop: (() => void) | undefined
    if (id === 'live' && room) {
      subscribeRemote(room, setSnap, setRemoteStatus).then((s) => (stop = s))
    } else {
      stop = subscribeSnapshots(setSnap)
    }
    const fs = () => setIsFs(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', fs)
    const t = setTimeout(() => setHint(false), 6000)
    // esconde o cursor parado
    let ct: number | undefined
    const move = () => {
      document.body.style.cursor = 'default'
      clearTimeout(ct)
      ct = window.setTimeout(() => (document.body.style.cursor = 'none'), 2000)
    }
    window.addEventListener('mousemove', move)
    move()
    return () => {
      stop?.()
      clearTimeout(t)
      document.removeEventListener('fullscreenchange', fs)
      window.removeEventListener('mousemove', move)
    }
  }, [id, room])

  const goFs = () => {
    if (id === 'live') return
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {})
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: id === 'live' ? 'transparent' : '#000' }}
      onClick={goFs}
      onDoubleClick={() => (document.fullscreenElement ? document.exitFullscreen() : goFs())}
    >
      {snap &&
        (id === 'telao' ? (
          <Composite look={snap.telao} snap={snap} audible out="telao" />
        ) : id === 'laterais' ? (
          <Composite look={snap.laterais} snap={snap} out="laterais" />
        ) : id === 'retorno' ? (
          <StageView snap={snap} />
        ) : (
          <LiveComposite snap={snap} />
        ))}
      {!snap && id !== 'live' && (
        <div className="out-wait">
          Aguardando o painel de controle…
          <small>Abra o painel nesta mesma máquina e navegador.</small>
        </div>
      )}
      {id !== 'live' && !isFs && (hint || !snap) && (
        <div className="out-hint">
          <b>{NAMES[id]}</b> — clique para tela cheia · duplo clique para sair
        </div>
      )}
      {id === 'live' && room && remoteStatus !== 'conectado' && (
        <div className="out-hint" style={{ background: '#0008' }}>Live: {remoteStatus || 'iniciando'} (sala {room})</div>
      )}
    </div>
  )
}
