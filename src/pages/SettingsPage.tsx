import { RefreshCw, MonitorUp, Download, Upload, Copy, QrCode, ExternalLink } from 'lucide-react'
import qrcode from 'qrcode-generator'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore, setState, setLive, getState } from '../core/store'
import { Btn, Toggle, Modal } from '../ui/common'
import { peerStatus, stopLivePeer, startLivePeer } from '../core/sync'
import { exportBackup, importBackup, downloadBlob } from '../core/files'
import { toast } from '../ui/uiStore'
import { getCameraStream } from '../render/Layers'
import { toggleFullscreen, rearmAutoFullscreen } from '../ui/fullscreen'
import { randomCode, setupSql, uploadLink, listEnvios, checkUploadCode, schemaVersion, SCHEMA_VERSION, type EnviosConfig } from '../core/envios'
import { refreshEnvios } from './live/EnviosPanel'

// ---------------- telas / janelas de saída ----------------
type OutKey = 'telao' | 'laterais' | 'retorno'
const OUT_NAMES: Record<OutKey, string> = { telao: 'Telão central', laterais: 'Projetores laterais (splitter)', retorno: 'TV de retorno' }

export interface ScreenInfo { key: string; label: string; left: number; top: number; width: number; height: number; primary: boolean }

const screenKey = (s: any) => `${s.left},${s.top},${s.width}x${s.height}`

export async function detectScreens(): Promise<ScreenInfo[] | null> {
  const w = window as any
  if (!w.getScreenDetails) return null
  try {
    const d = await w.getScreenDetails()
    return d.screens.map((s: any, i: number) => ({
      key: screenKey(s),
      label: s.label || `Tela ${i + 1}`,
      left: s.left,
      top: s.top,
      width: s.width,
      height: s.height,
      primary: s.isPrimary,
    }))
  } catch {
    return null
  }
}

export const baseUrl = () => location.href.split('#')[0]

const opened: Partial<Record<string, Window | null>> = {}
export async function openOutput(id: OutKey | 'live') {
  const url = `${baseUrl()}#/out/${id}`
  const map = getState().settings.screenMap
  const screens = await detectScreens()
  const scr = screens?.find((s) => s.key === map[id])
  const feat = scr
    ? `popup,fullscreen,left=${scr.left},top=${scr.top},width=${scr.width},height=${scr.height}`
    : `popup,width=960,height=540,left=${80 + Object.keys(opened).length * 40},top=${80 + Object.keys(opened).length * 40}`
  const w = window.open(url, 'projecao-' + id, feat)
  if (!w) {
    alert('O navegador bloqueou a janela. Permita pop-ups para este site (ícone na barra de endereço) e tente de novo.')
    return
  }
  opened[id] = w
  if (scr) {
    try {
      w.moveTo(scr.left, scr.top)
      w.resizeTo(scr.width, scr.height)
    } catch {
      /* ignore */
    }
  }
}

export async function openAllOutputs() {
  for (const id of ['telao', 'laterais', 'retorno'] as OutKey[]) await openOutput(id)
  // abrir janelas tira o painel da tela cheia: volta no próximo clique
  rearmAutoFullscreen()
}

function OperatorScreenSection() {
  const auto = useStore((s) => s.settings.autoFullscreen ?? true)
  return (
    <section className="card">
      <h4>Tela do operador</h4>
      <p className="hint">
        Em tela cheia o painel ocupa o monitor inteiro, sem abas, endereço nem os botões de fechar/minimizar.
        Um toque no <b>Esc</b> continua limpando a letra; para sair da tela cheia, <b>segure o Esc</b> ou use o botão ⛶ no canto de cima.
      </p>
      <div className="row">
        <Toggle label="Entrar em tela cheia sozinho ao abrir (no primeiro clique)" value={auto} onChange={(v) => setState((s) => ({ ...s, settings: { ...s.settings, autoFullscreen: v } }))} />
        <Btn small onClick={toggleFullscreen}>Tela cheia agora</Btn>
      </div>
      <details style={{ marginTop: 10 }}>
        <summary>Abrir como aplicativo (ícone na área de trabalho)</summary>
        <p className="hint">
          No Chrome, clique no ícone de instalar na barra de endereço (ou menu ⋮ → <i>Transmitir, salvar e compartilhar → Instalar página como app</i>).
          Aparece o ícone “Projeção” na área de trabalho e na barra de tarefas, abrindo numa janela própria, sem abas.
        </p>
      </details>
    </section>
  )
}

function ScreensSection() {
  const map = useStore((s) => s.settings.screenMap)
  const [screens, setScreens] = useState<ScreenInfo[] | null | undefined>(undefined)
  const detect = async () => setScreens(await detectScreens())
  useEffect(() => {
    detect()
  }, [])
  return (
    <section className="card">
      <h4>Telas (saídas HDMI)</h4>
      <p className="hint">
        Escolha em qual monitor cada saída abre. Na primeira vez o Chrome pede permissão para “gerenciar janelas” — aceite.
        Depois de abrir, <b>clique uma vez em cada tela</b> para entrar em tela cheia.
      </p>
      {screens === null && (
        <div className="help-box warn">
          Não consegui listar os monitores. Use o <b>Google Chrome</b> ou <b>Edge</b> atualizado e clique em “Detectar telas”.
          Se continuar, as janelas abrem soltas: arraste cada uma para o monitor certo e clique nela para tela cheia.
        </div>
      )}
      <div className="row" style={{ marginBottom: 10 }}>
        <Btn icon={RefreshCw} onClick={detect}>Detectar telas</Btn>
        {screens && <span className="hint">{screens.length} tela(s) encontrada(s)</span>}
      </div>
      {screens && (
        <div className="screen-map">
          <div className="screens-vis">
            {(() => {
              const minL = Math.min(...screens.map((s) => s.left))
              const minT = Math.min(...screens.map((s) => s.top))
              const maxR = Math.max(...screens.map((s) => s.left + s.width))
              const maxB = Math.max(...screens.map((s) => s.top + s.height))
              const W = maxR - minL
              const H = maxB - minT
              return (
                <div style={{ position: 'relative', width: '100%', aspectRatio: `${W}/${H}` }}>
                  {screens.map((s, i) => {
                    const outs = (Object.keys(OUT_NAMES) as OutKey[]).filter((k) => map[k] === s.key)
                    return (
                      <div key={s.key} className="screen-box" style={{ left: ((s.left - minL) / W) * 100 + '%', top: ((s.top - minT) / H) * 100 + '%', width: (s.width / W) * 100 + '%', height: (s.height / H) * 100 + '%' }}>
                        <b>{i + 1}</b>
                        <small>{s.width}×{s.height}{s.primary ? ' · principal' : ''}</small>
                        {outs.map((o) => <span key={o}>{OUT_NAMES[o].split(' (')[0]}</span>)}
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </div>
          {(Object.keys(OUT_NAMES) as OutKey[]).map((k) => (
            <div key={k} className="row screen-row">
              <b>{OUT_NAMES[k]}</b>
              <select value={map[k] ?? ''} onChange={(e) => setState((s) => ({ ...s, settings: { ...s.settings, screenMap: { ...s.settings.screenMap, [k]: e.target.value } } }))}>
                <option value="">— janela solta —</option>
                {screens.map((s, i) => (
                  <option key={s.key} value={s.key}>Tela {i + 1}: {s.label} ({s.width}×{s.height}){s.primary ? ' — principal' : ''}</option>
                ))}
              </select>
              <Btn small onClick={() => openOutput(k)}>Abrir</Btn>
            </div>
          ))}
        </div>
      )}
      {!screens && (
        <div className="row">
          {(Object.keys(OUT_NAMES) as OutKey[]).map((k) => (
            <Btn key={k} small onClick={() => openOutput(k)}>Abrir {OUT_NAMES[k].split(' (')[0]}</Btn>
          ))}
        </div>
      )}
      <div className="row" style={{ marginTop: 10 }}>
        <Btn icon={MonitorUp} kind="primary" onClick={openAllOutputs}>Abrir todas as saídas</Btn>
      </div>
    </section>
  )
}

// ---------------- câmera ----------------
function CameraSection() {
  const deviceId = useStore((s) => s.live.cameraDeviceId)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [err, setErr] = useState('')
  const vref = useRef<HTMLVideoElement>(null)
  const list = async () => {
    try {
      const d = await navigator.mediaDevices.enumerateDevices()
      setDevices(d.filter((x) => x.kind === 'videoinput'))
    } catch (e: any) {
      setErr(e.message)
    }
  }
  const allow = async () => {
    setErr('')
    const s = await getCameraStream(deviceId)
    if (!s) setErr('Não foi possível abrir a câmera / placa de captura. Verifique se está conectada e se outro programa (ex.: OBS) não está usando.')
    else if (vref.current) {
      vref.current.srcObject = s
      vref.current.play().catch(() => {})
    }
    list()
  }
  useEffect(() => {
    list()
  }, [])
  useEffect(() => {
    if (devices.some((d) => d.label)) allow()
  }, [deviceId])
  return (
    <section className="card">
      <h4>Câmera / placa de captura (sinal da live)</h4>
      <p className="hint">A placa HDMI→USB aparece como uma câmera. Escolha ela aqui. Ela vai para as cenas que têm câmera ligada.</p>
      <div className="row">
        <select value={deviceId} onChange={(e) => setLive((l) => ({ ...l, cameraDeviceId: e.target.value }))} style={{ flex: 1 }}>
          <option value="">Padrão do sistema</option>
          {devices.map((d, i) => (
            <option key={d.deviceId || i} value={d.deviceId}>{d.label || `Câmera ${i + 1} (permita o acesso para ver o nome)`}</option>
          ))}
        </select>
        <Btn onClick={allow}>Permitir / testar</Btn>
      </div>
      {err && <div className="help-box warn">{err}</div>}
      <div className="preview-box" style={{ aspectRatio: '16/9', marginTop: 10, maxWidth: 420 }}>
        <video ref={vref} muted playsInline autoPlay style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      </div>
      <p className="hint">Importante: a placa de captura só pode ser usada por um programa por vez no Windows. Feche o OBS deste computador antes de usar.</p>
    </section>
  )
}

// ---------------- live / OBS ----------------
function LiveSection() {
  const room = useStore((s) => s.settings.roomId)
  const enabled = useStore((s) => s.settings.liveEnabled)
  const chroma = useStore((s) => s.live.liveChroma)
  const [, force] = useState(0)
  useEffect(() => {
    const l = () => force((x) => x + 1)
    peerStatus.listeners.add(l)
    return () => {
      peerStatus.listeners.delete(l)
    }
  }, [])
  const url = `${baseUrl()}#/out/live?room=${room}`
  return (
    <section className="card">
      <h4>Letra para a live (OBS no computador da live)</h4>
      <p className="hint">
        No OBS do computador da live: <b>Fontes → + → Navegador</b>, cole o endereço abaixo, largura <b>1920</b> e altura <b>1080</b>.
        A letra chega com fundo transparente pela internet/rede, sem cabo. Use o estilo “Live” nas cenas para definir o visual.
      </p>
      <div className="row">
        <input readOnly value={url} style={{ flex: 1, fontFamily: 'monospace' }} onFocus={(e) => e.target.select()} />
        <Btn kind="primary" onClick={() => { navigator.clipboard.writeText(url); toast('Endereço copiado') }}>Copiar</Btn>
      </div>
      <div className="row" style={{ marginTop: 8 }}>
        <Toggle
          label="Enviar letra para a live"
          value={enabled}
          onChange={(v) => {
            setState((s) => ({ ...s, settings: { ...s.settings, liveEnabled: v } }))
            if (v) startLivePeer(room)
            else stopLivePeer()
          }}
        />
        <span className={'status-pill ' + (peerStatus.state === 'online' ? 'ok' : '')}>
          {peerStatus.state}{peerStatus.state === 'online' ? ` · ${peerStatus.clients} OBS conectado(s)` : ''}
        </span>
        <Btn
          small
          kind="ghost"
          onClick={() => {
            if (!confirm('Gerar um novo código de sala? Vai precisar colar o novo endereço no OBS.')) return
            const r = Math.random().toString(36).slice(2, 8)
            stopLivePeer()
            setState((s) => ({ ...s, settings: { ...s.settings, roomId: r } }))
            if (enabled) setTimeout(() => startLivePeer(r), 500)
          }}
        >
          Novo código
        </Btn>
      </div>
      <details style={{ marginTop: 10 }}>
        <summary>Alternativa por cabo (chroma key)</summary>
        <p className="hint">
          Se preferir mandar por HDMI, abra a saída “Live” numa tela e no OBS use o filtro <b>Chroma Key</b> (verde).
        </p>
        <div className="row">
          <Toggle label="Fundo verde (chroma)" value={chroma} onChange={(v) => setLive((l) => ({ ...l, liveChroma: v }))} />
          <Btn small onClick={() => openOutput('live')}>Abrir saída Live neste PC</Btn>
        </div>
      </details>
    </section>
  )
}

function EnviosSection() {
  const saved = useStore((s) => s.settings.envios)
  const [status, setStatus] = useState<'' | 'ok' | 'testing' | string>('')
  const [qr, setQr] = useState(false)
  useEffect(() => {
    if (!getState().settings.envios)
      setState((s) => ({ ...s, settings: { ...s.settings, envios: { url: '', key: '', up: randomCode(), admin: randomCode() } } }))
  }, [])
  if (!saved) return null
  const cfg: EnviosConfig = saved
  const set = (p: Partial<EnviosConfig>) => setState((s) => ({ ...s, settings: { ...s.settings, envios: { ...cfg, ...p } } }))
  const ready = !!(cfg.url && cfg.key)
  const link = ready ? uploadLink(baseUrl(), cfg) : ''
  const copy = (t: string, msg: string) => {
    navigator.clipboard.writeText(t)
    toast(msg)
  }
  const test = async () => {
    setStatus('testing')
    try {
      const okUp = await checkUploadCode(cfg)
      await listEnvios(cfg)
      if (!okUp) throw new Error('os códigos não batem — rode o script do passo 2 de novo')
      if ((await schemaVersion(cfg)) < SCHEMA_VERSION) throw new Error('o sistema foi atualizado — copie o script do passo 2 e rode de novo no Supabase')
      setStatus('ok')
      refreshEnvios(true)
    } catch (e: any) {
      setStatus(e?.message || String(e))
    }
  }
  const steps = (
    <>
      <ol className="steps env-steps">
        <li>
          <b>Crie uma conta grátis</b>
          <p>Em <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer">supabase.com</a> → <i>New project</i> (qualquer nome, região São Paulo, guarde a senha).</p>
        </li>
        <li>
          <b>Crie a estrutura</b>
          <p>No projeto: <i>SQL Editor</i> → <i>New query</i> → cole o script → <i>Run</i>.</p>
          <Btn small kind="primary" onClick={() => copy(setupSql(cfg), 'Script copiado')}>Copiar script</Btn>
        </li>
        <li>
          <b>Conecte este painel</b>
          <p>Em <i>Project Settings → API Keys</i>/<i>Data API</i>: copie a <i>Project URL</i> e a chave <i>publishable</i> (ou <i>anon</i>).</p>
          <div className="env-fields">
            <input placeholder="https://xxxx.supabase.co" value={cfg.url} onChange={(e) => { set({ url: e.target.value.trim() }); setStatus('') }} />
            <input placeholder="Chave publishable / anon" value={cfg.key} onChange={(e) => { set({ key: e.target.value.trim() }); setStatus('') }} />
          </div>
          <div className="row">
            <Btn small disabled={!ready || status === 'testing'} onClick={test}>Testar conexão</Btn>
            {status === 'ok' && <span className="status-pill ok">conectado</span>}
            {status === 'testing' && <span className="status-pill">testando…</span>}
            {status && status !== 'ok' && status !== 'testing' && <span className="hint" style={{ color: 'var(--live)' }}>{status}</span>}
          </div>
        </li>
      </ol>
      <p className="hint" style={{ marginTop: 12 }}>
        <b>Trocar códigos (se o link vazar):</b> gera códigos novos; depois rode o script de novo e mande o link novo — o antigo para de funcionar.
      </p>
      <Btn small kind="danger" onClick={() => { if (confirm('Gerar códigos novos? O link atual para de funcionar até você rodar o script de novo no Supabase.')) { set({ up: randomCode(), admin: randomCode() }); setStatus('') } }}>Gerar novos códigos</Btn>
    </>
  )
  return (
    <section className="card">
      <h4>Link de envio para os pastores</h4>
      {ready ? (
        <>
          <p className="hint">Mande este link (ou mostre o QR code) para quem vai enviar slides, vídeos e avisos. Quem tem o link só consegue enviar — a lista fica só aqui, na aba <b>Envios</b>.</p>
          <div className="row">
            <input readOnly value={link} style={{ flex: 1, fontFamily: 'var(--mono)', fontSize: 11 }} onFocus={(e) => e.target.select()} />
            <Btn kind="primary" icon={Copy} onClick={() => copy(link, 'Link copiado')}>Copiar</Btn>
            <Btn icon={QrCode} onClick={() => setQr(true)}>QR code</Btn>
            <Btn icon={ExternalLink} onClick={() => window.open(link, '_blank')} title="Abrir a página de envio">Abrir</Btn>
          </div>
          <details style={{ marginTop: 12 }}>
            <summary>Configuração do servidor (Supabase)</summary>
            {steps}
          </details>
        </>
      ) : (
        <>
          <p className="hint">Configure o servidor gratuito uma vez para gerar o link.</p>
          {steps}
        </>
      )}
      {qr && <QrModal link={link} onClose={() => setQr(false)} />}
    </section>
  )
}

function QrModal({ link, onClose }: { link: string; onClose: () => void }) {
  const svg = useMemo(() => {
    const q = qrcode(0, 'M')
    q.addData(link)
    q.make()
    return q.createSvgTag({ cellSize: 8, margin: 3, scalable: true })
  }, [link])
  const download = () => {
    const img = new Image()
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = c.height = 1200
      const g = c.getContext('2d')!
      g.fillStyle = '#fff'
      g.fillRect(0, 0, 1200, 1200)
      g.drawImage(img, 0, 0, 1200, 1200)
      c.toBlob((b) => b && downloadBlob(b, 'qr-envio-projecao.png'))
    }
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
  }
  return (
    <Modal title="QR code — envio para a projeção" onClose={onClose} footer={<><Btn icon={Download} onClick={download}>Baixar imagem</Btn><Btn kind="primary" onClick={onClose}>Fechar</Btn></>}>
      <div className="qr-box">
        <div className="qr-img" dangerouslySetInnerHTML={{ __html: svg }} />
        <p>Aponte a câmera do celular para abrir a página de envio.</p>
      </div>
    </Modal>
  )
}

function BackupSection() {
  const ref = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  return (
    <section className="card">
      <h4>Backup / levar para outro computador</h4>
      <p className="hint">
        Tudo (músicas, cenas, temas, arquivos, Bíblias) fica guardado <b>neste navegador, neste computador</b>.
        Para levar para outro computador ou se prevenir, exporte um backup e importe lá.
      </p>
      <div className="row">
        <Btn kind="primary" disabled={busy} onClick={async () => { setBusy(true); await exportBackup(); setBusy(false) }} icon={Download}>Exportar backup (.zip)</Btn>
        <Btn icon={Upload} onClick={() => ref.current?.click()}>Importar backup</Btn>
        <input
          ref={ref}
          type="file"
          accept=".zip"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0]
            if (f && confirm('Importar vai SUBSTITUIR tudo que está neste computador. Continuar?')) {
              try {
                await importBackup(f)
              } catch (er: any) {
                alert(er.message)
              }
            }
            e.target.value = ''
          }}
        />
      </div>
      <p className="hint">Dica: no Chrome, o site pode pedir para “armazenamento persistente” — isso evita que o navegador apague os dados.</p>
    </section>
  )
}

function ShortcutsSection() {
  const rows = [
    ['→  ↓  PageDown  Espaço', 'Próximo slide (passador)'],
    ['←  ↑  PageUp', 'Slide anterior'],
    ['Esc', 'Limpar letra'],
    ['B  ou  .', 'Tela preta'],
    ['M', 'Tirar mídia do ar'],
    ['A', 'Mostrar/esconder aviso'],
    ['1 … 9', 'Aplicar cena 1 a 9'],
  ]
  return (
    <section className="card">
      <h4>Atalhos do teclado e do passador</h4>
      <table className="table">
        <tbody>
          {rows.map(([k, d]) => (
            <tr key={k}><td><code>{k}</code></td><td>{d}</td></tr>
          ))}
        </tbody>
      </table>
      <p className="hint">Durante uma apresentação de PowerPoint, clique na janela do PowerPoint para o passador controlar ela.</p>
    </section>
  )
}

export function SettingsPage() {
  return (
    <div className="settings-page">
      <OperatorScreenSection />
      <ScreensSection />
      <CameraSection />
      <LiveSection />
      <EnviosSection />
      <BackupSection />
      <ShortcutsSection />
    </div>
  )
}
