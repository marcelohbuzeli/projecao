import type { Snapshot } from './types'
import type Peer from 'peerjs'
import type { DataConnection } from 'peerjs'

const CH = 'projecao-sync'
const LS_KEY = 'projecao-snapshot'

type Msg = { t: 'snap'; snap: Snapshot } | { t: 'hello' }

// ================= Lado do PAINEL =================
let channel: BroadcastChannel | null = null
let last: Snapshot | null = null
let peer: Peer | null = null
const conns = new Set<DataConnection>()
export const peerStatus = { state: 'desligado' as string, clients: 0, listeners: new Set<() => void>() }
const notifyPeer = () => peerStatus.listeners.forEach((l) => l())

export function startPublisher() {
  if (channel) return
  channel = new BroadcastChannel(CH)
  channel.onmessage = (e: MessageEvent<Msg>) => {
    if (e.data?.t === 'hello' && last) channel!.postMessage({ t: 'snap', snap: last })
  }
}

let lsTimer: number | undefined
export function publish(snap: Snapshot) {
  last = snap
  channel?.postMessage({ t: 'snap', snap } satisfies Msg)
  clearTimeout(lsTimer)
  lsTimer = window.setTimeout(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(snap))
    } catch {
      /* ignore */
    }
  }, 300)
  const liveData = liveSubset(snap)
  conns.forEach((c) => {
    try {
      if (c.open) c.send(liveData)
    } catch {
      /* ignore */
    }
  })
}

/** Só o necessário para a saída da live (letras sem fundo) */
function liveSubset(s: Snapshot) {
  return { t: 'snap', snap: { ...s, media: null } }
}

/** Saída da live em outro computador (OBS) via WebRTC (PeerJS) */
export async function startLivePeer(roomId: string) {
  if (peer) return
  const { default: PeerCls } = await import('peerjs')
  const connect = () => {
    peerStatus.state = 'conectando'
    notifyPeer()
    const p = new PeerCls('projecao-' + roomId, { debug: 0 })
    peer = p
    p.on('open', () => {
      peerStatus.state = 'online'
      notifyPeer()
    })
    p.on('connection', (c) => {
      c.on('open', () => {
        conns.add(c)
        peerStatus.clients = conns.size
        notifyPeer()
        if (last) c.send(liveSubset(last))
      })
      c.on('close', () => {
        conns.delete(c)
        peerStatus.clients = conns.size
        notifyPeer()
      })
      c.on('error', () => {
        conns.delete(c)
        peerStatus.clients = conns.size
        notifyPeer()
      })
    })
    p.on('disconnected', () => {
      peerStatus.state = 'reconectando'
      notifyPeer()
      setTimeout(() => {
        try {
          if (!p.destroyed) p.reconnect()
        } catch {
          /* ignore */
        }
      }, 2000)
    })
    p.on('error', (err: any) => {
      peerStatus.state = 'erro: ' + (err?.type ?? 'desconhecido')
      notifyPeer()
      if (err?.type === 'unavailable-id' || err?.type === 'network' || err?.type === 'server-error' || err?.type === 'socket-error') {
        try {
          p.destroy()
        } catch {
          /* ignore */
        }
        peer = null
        setTimeout(connect, 4000)
      }
    })
  }
  connect()
}

export function stopLivePeer() {
  peer?.destroy()
  peer = null
  conns.clear()
  peerStatus.state = 'desligado'
  peerStatus.clients = 0
  notifyPeer()
}

// ================= Lado das SAÍDAS =================
export function subscribeSnapshots(cb: (s: Snapshot) => void) {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) cb(JSON.parse(raw))
  } catch {
    /* ignore */
  }
  const ch = new BroadcastChannel(CH)
  ch.onmessage = (e: MessageEvent<Msg>) => {
    if (e.data?.t === 'snap') cb(e.data.snap)
  }
  ch.postMessage({ t: 'hello' } satisfies Msg)
  const onStorage = (e: StorageEvent) => {
    if (e.key === LS_KEY && e.newValue) cb(JSON.parse(e.newValue))
  }
  window.addEventListener('storage', onStorage)
  return () => {
    ch.close()
    window.removeEventListener('storage', onStorage)
  }
}

/** Saída da live remota: conecta ao painel pela internet */
export async function subscribeRemote(roomId: string, cb: (s: Snapshot) => void, onStatus: (st: string) => void) {
  const { default: PeerCls } = await import('peerjs')
  let p: Peer | null = null
  let stopped = false
  let retry: number | undefined
  const start = () => {
    if (stopped) return
    onStatus('conectando')
    p = new PeerCls({ debug: 0 })
    p.on('open', () => {
      const c = p!.connect('projecao-' + roomId, { reliable: true })
      const fail = () => {
        onStatus('aguardando painel')
        try {
          p?.destroy()
        } catch {
          /* ignore */
        }
        clearTimeout(retry)
        retry = window.setTimeout(start, 3000)
      }
      const openTimeout = window.setTimeout(fail, 10000)
      c.on('open', () => {
        clearTimeout(openTimeout)
        onStatus('conectado')
      })
      c.on('data', (d: any) => {
        if (d?.t === 'snap') cb(d.snap)
      })
      c.on('close', fail)
      c.on('error', fail)
    })
    p.on('error', () => {
      onStatus('aguardando painel')
      try {
        p?.destroy()
      } catch {
        /* ignore */
      }
      clearTimeout(retry)
      retry = window.setTimeout(start, 3000)
    })
  }
  start()
  return () => {
    stopped = true
    clearTimeout(retry)
    p?.destroy()
  }
}
