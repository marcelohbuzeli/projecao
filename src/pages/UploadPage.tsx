import { useEffect, useRef, useState } from 'react'
import { Upload, Check, Clock, Infinity as InfinityIcon, CalendarX, FileText, X, Presentation, Megaphone, Film, Image as ImageIcon, Paperclip, Loader2 } from 'lucide-react'
import { parseUploadParam, checkUploadCode, uploadFile, createEnvio, ENVIO_KINDS, MAX_FILE, nextWeekday, isoDate, fmtServiceDate, schemaVersion, fmtShort, type EnvioKind } from '../core/envios'
import { fmtSize } from '../ui/common'

const KIND_ICONS = { slide: Presentation, aviso: Megaphone, video: Film, imagem: ImageIcon, outro: Paperclip }
const NAME_KEY = 'projecao-envio-nome'

export function UploadPage({ param }: { param: string | null }) {
  const cfg = parseUploadParam(param)
  const [valid, setValid] = useState<boolean | null>(null)
  const [name, setName] = useState(() => {
    try {
      return localStorage.getItem(NAME_KEY) || ''
    } catch {
      return ''
    }
  })
  const [date, setDate] = useState(() => nextWeekday(0))
  const [kind, setKind] = useState<EnvioKind>('slide')
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [keep, setKeep] = useState<'culto' | 'data' | 'sempre'>('culto')
  const [delDate, setDelDate] = useState('')
  const [schema, setSchema] = useState(1)
  const [files, setFiles] = useState<File[]>([])
  const [progress, setProgress] = useState<number[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [done, setDone] = useState(false)
  const [over, setOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const prev = document.title
    document.title = 'Enviar para a projeção'
    if (cfg) {
      checkUploadCode(cfg).then(setValid, () => setValid(false))
      schemaVersion(cfg).then(setSchema)
    }
    else setValid(false)
    return () => {
      document.title = prev
    }
  }, [])

  if (!cfg || valid === false)
    return (
      <div className="up-page">
        <div className="up-card up-center">
          <X size={28} />
          <h2>Link inválido</h2>
          <p className="hint">Peça um novo link para a equipe de projeção.</p>
        </div>
      </div>
    )

  const add = (list: FileList | null) => {
    if (!list) return
    const arr = Array.from(list)
    const big = arr.filter((f) => f.size > MAX_FILE)
    if (big.length) setErr(`Arquivo grande demais (máx. 50 MB): ${big.map((f) => f.name).join(', ')}`)
    else setErr('')
    setFiles((f) => [...f, ...arr.filter((x) => x.size <= MAX_FILE)])
  }

  const needsFile = kind !== 'aviso'
  const expires = keep === 'sempre' ? null : keep === 'data' ? delDate || date : date
  const canSend = !busy && (keep !== 'data' || (delDate && delDate >= isoDate(new Date()))) && name.trim() && date && (files.length > 0 || (!needsFile && note.trim()))

  const send = async () => {
    if (!canSend) return
    setBusy(true)
    setErr('')
    try {
      localStorage.setItem(NAME_KEY, name.trim())
    } catch {
      /* */
    }
    try {
      const base = { service_date: date, kind, sender: name.trim(), title: title.trim() || null, note: note.trim() || null, ...(schema >= 2 ? { expires_on: expires } : {}) }
      if (!files.length) {
        await createEnvio(cfg, { ...base, file_path: null, file_name: null, file_size: null, mime: null })
      } else {
        setProgress(files.map(() => 0))
        for (let i = 0; i < files.length; i++) {
          const f = files[i]
          const path = await uploadFile(cfg, f, date, kind, (p) => setProgress((a) => a.map((v, j) => (j === i ? p : v))))
          await createEnvio(cfg, { ...base, file_path: path, file_name: f.name, file_size: f.size, mime: f.type || null })
        }
      }
      setDone(true)
    } catch (e: any) {
      setErr('Não foi possível enviar: ' + (e?.message || e) + '. Tente de novo.')
    }
    setBusy(false)
  }

  if (done)
    return (
      <div className="up-page">
        <div className="up-card up-center">
          <div className="up-ok"><Check size={30} strokeWidth={2.5} /></div>
          <h2>Recebido!</h2>
          <p className="hint">
            Já está no painel da projeção, no culto de <b>{fmtServiceDate(date).toLowerCase()}</b>.
          </p>
          <p className="hint">{expires ? <>Será apagado automaticamente depois de <b>{fmtShort(expires)}</b>.</> : <>Marcado como <b>permanente</b>: não será apagado automaticamente.</>}</p>
          <button
            className="up-btn"
            onClick={() => {
              setDone(false)
              setFiles([])
              setProgress([])
              setTitle('')
              setNote('')
            }}
          >
            Enviar outro
          </button>
        </div>
      </div>
    )

  const today = isoDate(new Date())
  const quick = [
    { d: today, l: 'Hoje' },
    { d: nextWeekday(3), l: 'Quarta' },
    { d: nextWeekday(0), l: 'Domingo' },
  ].filter((q, i, a) => a.findIndex((x) => x.d === q.d) === i)

  return (
    <div className="up-page">
      <div className="up-card">
        <header className="up-head">
          <span className="logo"><i /><i /><i /></span>
          <div>
            <h1>Enviar para a projeção</h1>
            <p className="hint">O arquivo chega direto no computador da projeção, já separado por culto.</p>
          </div>
        </header>

        {valid === null && <p className="hint up-checking"><Loader2 size={14} className="spin" /> conferindo o link…</p>}

        <label className="up-field">
          <span>Seu nome</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Pr. João" />
        </label>

        <div className="up-field">
          <span>Para qual culto?</span>
          <div className="up-row">
            {quick.map((q) => (
              <button key={q.d} className={'chip' + (date === q.d ? ' on' : '')} onClick={() => setDate(q.d)}>{q.l}</button>
            ))}
            <input type="date" value={date} min={today} onChange={(e) => setDate(e.target.value)} />
          </div>
          <small className="hint">{date && fmtServiceDate(date)}</small>
        </div>

        <div className="up-field">
          <span>O que é?</span>
          <div className="up-kinds">
            {ENVIO_KINDS.map((k) => {
              const I = KIND_ICONS[k.id]
              return (
                <button key={k.id} className={'up-kind' + (kind === k.id ? ' on' : '')} onClick={() => setKind(k.id)}>
                  <I size={18} strokeWidth={1.75} />
                  {k.label}
                </button>
              )
            })}
          </div>
        </div>

        <label className="up-field">
          <span>Título <em>(opcional)</em></span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={kind === 'aviso' ? 'Ex.: Retiro de jovens' : 'Ex.: Pregação — A fé que move montanhas'} />
        </label>

        <label className="up-field">
          <span>{kind === 'aviso' ? 'Texto do aviso' : 'Recado para a projeção'} {kind !== 'aviso' && <em>(opcional)</em>}</span>
          <textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={kind === 'aviso' ? 'Escreva o aviso como deve aparecer na tela…' : 'Ex.: o vídeo entra depois do slide 5'}
          />
        </label>

        <div className="up-field">
          <span>Arquivos {!needsFile && <em>(opcional)</em>}</span>
          <div
            className={'up-drop' + (over ? ' over' : '')}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault()
              setOver(true)
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setOver(false)
              add(e.dataTransfer.files)
            }}
          >
            <Upload size={20} strokeWidth={1.75} />
            <b>Toque para escolher</b>
            <small>PowerPoint, PDF, imagem ou vídeo · até 50 MB cada</small>
            <input ref={inputRef} type="file" multiple hidden onChange={(e) => { add(e.target.files); e.target.value = '' }} />
          </div>
          {files.length > 0 && (
            <ul className="up-files">
              {files.map((f, i) => (
                <li key={i}>
                  <FileText size={15} />
                  <span className="up-fname">{f.name}</span>
                  <small>{fmtSize(f.size)}</small>
                  {busy ? (
                    <i className="up-prog"><b style={{ width: `${Math.round((progress[i] ?? 0) * 100)}%` }} /></i>
                  ) : (
                    <button className="icon-btn" onClick={() => setFiles((a) => a.filter((_, j) => j !== i))} title="Remover"><X size={14} /></button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="up-field">
          <span>Por quanto tempo guardar?</span>
          <div className="up-keep">
            <button className={'up-kind' + (keep === 'culto' ? ' on' : '')} onClick={() => setKeep('culto')}>
              <Clock size={18} strokeWidth={1.75} />
              <span>Até o culto<small>apaga depois de {fmtShort(date)}</small></span>
            </button>
            <button className={'up-kind' + (keep === 'data' ? ' on' : '')} onClick={() => { setKeep('data'); if (!delDate) setDelDate(date) }}>
              <CalendarX size={18} strokeWidth={1.75} />
              <span>Escolher data<small>apaga depois do dia</small></span>
            </button>
            <button className={'up-kind' + (keep === 'sempre' ? ' on' : '')} onClick={() => setKeep('sempre')}>
              <InfinityIcon size={18} strokeWidth={1.75} />
              <span>Permanente<small>nunca apaga sozinho</small></span>
            </button>
          </div>
          {keep === 'data' && <input type="date" value={delDate} min={isoDate(new Date())} onChange={(e) => setDelDate(e.target.value)} />}
          <p className="up-notice">
            {expires ? (
              <>Para economizar espaço, este envio será <b>apagado automaticamente depois de {fmtShort(expires)}</b>. Se precisar dele por mais tempo, escolha outra data ou marque <b>Permanente</b>.</>
            ) : (
              <>Este envio ficará guardado <b>sem prazo</b>. Use só para o que vai ser reaproveitado (vinhetas, logos, vídeos fixos).</>
            )}
          </p>
        </div>

        {err && <p className="up-err">{err}</p>}

        <button className="up-btn" disabled={!canSend} onClick={send}>
          {busy ? <><Loader2 size={16} className="spin" /> Enviando…</> : <>Enviar</>}
        </button>
      </div>
    </div>
  )
}
