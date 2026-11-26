import { useEffect, useState, useSyncExternalStore } from 'react'
import { Clock, Infinity as InfinityIcon, RefreshCw, Download, Trash2, Plus, Megaphone, Presentation, Film, Image as ImageIcon, Paperclip, Inbox, Settings2, Loader2 } from 'lucide-react'
import { useStore, getState, setState, setLive } from '../../core/store'
import { setUI, select, toast } from '../../ui/uiStore'
import { Btn, fmtSize, useContextMenu } from '../../ui/common'
import { deleteBlob } from '../../core/db'
import { listEnvios, downloadEnvio, deleteEnvio, setEnvioStatus, fmtServiceDate, isoDate, ENVIO_KINDS, isExpired, setEnvioExpiry, addDays, fmtShort, type Envio } from '../../core/envios'
import { importMediaFiles, kindOf, downloadBlob } from '../../core/files'
import { addToService } from './LeftPanel'

const KIND_ICONS = { slide: Presentation, aviso: Megaphone, video: Film, imagem: ImageIcon, outro: Paperclip }

// ---------- pequeno store com polling ----------
const st = { list: [] as Envio[], error: '', loading: false, loaded: false }
let snap = { ...st }
const subs = new Set<() => void>()
const emit = () => {
  snap = { ...st }
  subs.forEach((f) => f())
}
let timer: number | undefined
let users = 0

export async function refreshEnvios(quiet = false) {
  const cfg = getState().settings.envios
  if (!cfg?.url || !cfg.key) return
  st.loading = true
  emit()
  try {
    const before = new Set(st.list.map((e) => e.id))
    let list = await listEnvios(cfg)
    const expired = list.filter((e) => isExpired(e))
    if (expired.length) {
      for (const e of expired) await purge(e).catch(() => {})
      list = list.filter((e) => !expired.includes(e))
      toast(`${expired.length} envio(s) vencido(s) apagado(s)`)
    }
    const fresh = st.loaded ? list.filter((e) => !before.has(e.id)) : []
    st.list = list
    st.error = ''
    if (fresh.length && !quiet) toast(`${fresh.length} novo(s) envio(s) dos pastores`)
    st.loaded = true
  } catch (e: any) {
    st.error = e?.message || String(e)
  }
  st.loading = false
  emit()
}

export function useEnvios() {
  useEffect(() => {
    if (users++ === 0) {
      refreshEnvios(true)
      timer = window.setInterval(() => refreshEnvios(), 30000)
    }
    return () => {
      if (--users === 0) clearInterval(timer)
    }
  }, [])
  return useSyncExternalStore(
    (f) => {
      subs.add(f)
      return () => subs.delete(f)
    },
    () => snap,
  )
}

// ---------- limpeza automática ----------
/** Apaga do servidor e a cópia importada neste computador (se não estiver no ar nem virou tema). */
async function purge(e: Envio) {
  const cfg = getState().settings.envios!
  await deleteEnvio(cfg, e)
  const mediaId = getState().settings.envioMedia?.[e.id]
  const s = getState()
  const inUse =
    !!mediaId &&
    (s.live.media?.mediaId === mediaId ||
      [...s.themes, ...s.overlays].some((t) => t.visual.type === 'media' && t.visual.mediaId === mediaId))
  if (mediaId && !inUse) {
    await deleteBlob(mediaId).catch(() => {})
    setState((st) => ({
      ...st,
      media: st.media.filter((x) => x.id !== mediaId),
      service: st.service.filter((x) => !('mediaId' in x) || x.mediaId !== mediaId),
    }))
  }
  setState((st) => {
    const m = { ...st.settings.envioMedia }
    delete m[e.id]
    return { ...st, settings: { ...st.settings, envioMedia: m } }
  })
}

function parseBr(t: string | null) {
  const m = t?.trim().match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/)
  if (!m) return null
  const y = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : new Date().getFullYear()
  const d = new Date(y, +m[2] - 1, +m[1])
  return isNaN(+d) ? null : isoDate(d)
}

// ---------- ações ----------
async function importEnvio(e: Envio): Promise<string | null> {
  const cfg = getState().settings.envios!
  const existing = getState().settings.envioMedia?.[e.id]
  if (existing && getState().media.some((m) => m.id === existing)) return existing
  const file = await downloadEnvio(cfg, e)
  if (!kindOf(file)) {
    downloadBlob(file, file.name)
    toast('Esse tipo de arquivo não abre no painel — baixei para o computador')
    return null
  }
  const [m] = await importMediaFiles([file])
  if (!m) return null
  if (e.title) setState((s) => ({ ...s, media: s.media.map((x) => (x.id === m.id ? { ...x, name: e.title! } : x)) }))
  setState((s) => ({ ...s, settings: { ...s.settings, envioMedia: { ...s.settings.envioMedia, [e.id]: m.id } } }))
  await setEnvioStatus(cfg, e.id, 'importado').catch(() => {})
  refreshEnvios(true)
  return m.id
}

function EnvioRow({ e }: { e: Envio }) {
  const [busy, setBusy] = useState(false)
  const media = useStore((s) => s.media)
  const localId = useStore((s) => s.settings.envioMedia?.[e.id])
  const imported = !!localId && media.some((m) => m.id === localId)
  const I = KIND_ICONS[e.kind] ?? Paperclip
  const ctx = useContextMenu()
  const setExp = (d: string | null) =>
    run(async () => {
      await setEnvioExpiry(getState().settings.envios!, e.id, d)
      await refreshEnvios(true)
      toast(d ? `Será apagado depois de ${fmtShort(d)}` : 'Marcado como permanente')
    })
  const expMenu = (ev: React.MouseEvent) =>
    ctx.open(ev, [
      { label: `Até o culto (${fmtShort(e.service_date)})`, onClick: () => setExp(e.service_date) },
      { label: '1 semana depois do culto', onClick: () => setExp(addDays(e.service_date, 7)) },
      { label: '1 mês depois do culto', onClick: () => setExp(addDays(e.service_date, 30)) },
      {
        label: 'Escolher data…',
        onClick: () => {
          const raw = prompt('Apagar depois de qual dia? (dd/mm/aaaa)', e.expires_on ? fmtShort(e.expires_on) : '')
          if (raw === null) return
          const d = parseBr(raw)
          if (d) setExp(d)
          else toast('Data inválida')
        },
      },
      { label: 'Permanente (nunca apagar)', onClick: () => setExp(null) },
    ])
  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    try {
      await fn()
    } catch (err: any) {
      toast('Erro: ' + (err?.message || err))
    }
    setBusy(false)
  }
  const open = (id: string) => {
    const m = getState().media.find((x) => x.id === id)
    if (m) select(m.kind === 'pptx' ? { type: 'pptx', mediaId: m.id } : { type: 'media', mediaId: m.id })
  }
  return (
    <div className={'envio' + (e.status === 'novo' && !imported ? ' new' : '')}>
      <div className="envio-ico"><I size={16} strokeWidth={1.75} /></div>
      <div className="envio-body">
        <div className="envio-title">{e.title || e.file_name || ENVIO_KINDS.find((k) => k.id === e.kind)?.label}</div>
        <div className="envio-meta">
          {ENVIO_KINDS.find((k) => k.id === e.kind)?.label} · {e.sender || 'sem nome'}
          {e.file_size ? ' · ' + fmtSize(e.file_size) : ''}
        </div>
        {'expires_on' in e && (
          <button className={'envio-exp' + (e.expires_on ? '' : ' perm')} onClick={expMenu} title="Mudar quando este envio é apagado">
            {e.expires_on ? <><Clock size={11} /> apaga depois de {fmtShort(e.expires_on)}</> : <><InfinityIcon size={11} /> permanente</>}
          </button>
        )}
        {e.note && <div className="envio-note">{e.note}</div>}
        <div className="envio-actions">
          {e.file_path ? (
            imported ? (
              <>
                <Btn small onClick={() => open(localId!)}>Abrir</Btn>
                <Btn small icon={Plus} onClick={() => { const m = media.find((x) => x.id === localId)!; addToService(m.kind === 'pptx' ? { type: 'pptx', mediaId: m.id } : { type: 'media', mediaId: m.id }) }}>Culto</Btn>
              </>
            ) : (
              <>
                <Btn small kind="primary" icon={busy ? Loader2 : Download} disabled={busy} onClick={() => run(async () => { const id = await importEnvio(e); if (id) { open(id); toast('Importado para Arquivos') } })}>Importar</Btn>
                <Btn small icon={Plus} disabled={busy} onClick={() => run(async () => { const id = await importEnvio(e); const m = id && getState().media.find((x) => x.id === id); if (m) addToService(m.kind === 'pptx' ? { type: 'pptx', mediaId: m.id } : { type: 'media', mediaId: m.id }) })}>Culto</Btn>
              </>
            )
          ) : null}
          {e.kind === 'aviso' && e.note && (
            <Btn small icon={Megaphone} onClick={() => { setLive((l) => ({ ...l, alert: { ...l.alert, text: e.note! } })); setUI({ bottomTab: 'alert' }); toast('Texto colocado na aba Aviso') }}>Usar aviso</Btn>
          )}
          {e.file_path && (
            <button className="icon-btn" title="Baixar arquivo original" disabled={busy} onClick={() => run(async () => { const f = await downloadEnvio(getState().settings.envios!, e); downloadBlob(f, f.name) })}><Download size={14} /></button>
          )}
          <button
            className="icon-btn"
            title="Apagar envio"
            disabled={busy}
            onClick={() => {
              if (!confirm(`Apagar "${e.title || e.file_name || 'envio'}" do servidor? (Se já importou, a cópia em Arquivos continua.)`)) return
              run(async () => { await deleteEnvio(getState().settings.envios!, e); await refreshEnvios(true) })
            }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      {ctx.node}
    </div>
  )
}

export function EnviosPanel() {
  const cfg = useStore((s) => s.settings.envios)
  const { list, error, loading, loaded } = useEnvios()
  const [showOld, setShowOld] = useState(false)
  if (!cfg?.url || !cfg.key)
    return (
      <div className="panel-col">
        <div className="empty">
          <Inbox size={26} strokeWidth={1.5} />
          <p>Receba slides, vídeos e avisos dos pastores por um link, já separados por culto.</p>
          <Btn kind="primary" icon={Settings2} onClick={() => setUI({ page: 'settings' })}>Configurar envios</Btn>
        </div>
      </div>
    )
  const today = isoDate(new Date())
  const shown = list.filter((e) => showOld || e.service_date >= today)
  const old = list.length - list.filter((e) => e.service_date >= today).length
  const groups = new Map<string, Envio[]>()
  for (const e of shown) groups.set(e.service_date, [...(groups.get(e.service_date) ?? []), e])
  return (
    <div className="panel-col">
      <div className="search-row envios-head">
        <span className="hint">{loading ? 'atualizando…' : `${list.filter((e) => e.status === 'novo').length} novo(s)`}</span>
        <Btn small kind="ghost" icon={RefreshCw} onClick={() => refreshEnvios(true)}>Atualizar</Btn>
      </div>
      {error && <p className="up-err" style={{ margin: '0 10px' }}>{error}</p>}
      <div className="list envios-list">
        {[...groups].map(([d, items]) => (
          <div key={d} className="envio-group">
            <h5>{fmtServiceDate(d)}</h5>
            {items.map((e) => <EnvioRow key={e.id} e={e} />)}
          </div>
        ))}
        {loaded && !shown.length && <div className="empty">Nenhum envio para os próximos cultos.</div>}
        {old > 0 && (
          <button className="link" style={{ margin: '8px auto' }} onClick={() => setShowOld(!showOld)}>
            {showOld ? 'Esconder cultos passados' : `Ver cultos passados (${old})`}
          </button>
        )}
      </div>
    </div>
  )
}
