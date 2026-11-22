import { createRoot } from 'react-dom/client'
import { useEffect, useState } from 'react'
import './styles.css'
import { loadState } from './core/store'
import { ControlApp } from './pages/ControlApp'
import { OutputPage } from './pages/OutputPage'
import type { OutputId } from './core/types'

function parseHash() {
  const h = location.hash.replace(/^#\/?/, '')
  const [path, query] = h.split('?')
  const params = new URLSearchParams(query ?? '')
  const m = path.match(/^out\/(telao|laterais|retorno|live)$/)
  return m ? { out: m[1] as OutputId, room: params.get('room') ?? undefined } : null
}

function Root() {
  const [route, setRoute] = useState(parseHash)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const on = () => setRoute(parseHash())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  useEffect(() => {
    if (!route) loadState().then(() => setReady(true))
  }, [route])
  if (route) return <OutputPage id={route.out} room={route.room} />
  if (!ready) return <div className="loading">Carregando…</div>
  return <ControlApp />
}

createRoot(document.getElementById('root')!).render(<Root />)
