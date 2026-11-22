import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate'
import type { MediaItem } from './types'
import { uid } from './defaults'
import { saveBlob, getBlob, dbGet, dbSet } from './db'
import { getState, setState, type AppState } from './store'
import { parseSongFile } from './songs'

export function kindOf(file: File): MediaItem['kind'] | null {
  const n = file.name.toLowerCase()
  if (file.type.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg|avif)$/.test(n)) return 'image'
  if (file.type.startsWith('video/') || /\.(mp4|webm|mov|m4v|mkv|ogv)$/.test(n)) return 'video'
  if (/\.(pptx|ppsx|ppt|pps)$/.test(n)) return 'pptx'
  return null
}

async function makeThumb(file: File, kind: MediaItem['kind']): Promise<{ thumb?: string; duration?: number }> {
  const W = 320
  const H = 180
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, W, H)
  const url = URL.createObjectURL(file)
  const drawCover = (el: CanvasImageSource, w: number, h: number) => {
    const s = Math.max(W / w, H / h)
    ctx.drawImage(el, (W - w * s) / 2, (H - h * s) / 2, w * s, h * s)
  }
  try {
    if (kind === 'image') {
      const img = new Image()
      img.src = url
      await img.decode()
      drawCover(img, img.naturalWidth || W, img.naturalHeight || H)
      return { thumb: canvas.toDataURL('image/jpeg', 0.7) }
    }
    if (kind === 'video') {
      const v = document.createElement('video')
      v.muted = true
      v.preload = 'auto'
      v.src = url
      await new Promise<void>((res, rej) => {
        v.onloadedmetadata = () => res()
        v.onerror = () => rej(new Error('vídeo'))
        setTimeout(() => res(), 5000)
      })
      const duration = v.duration
      v.currentTime = Math.min(1, (duration || 2) / 3)
      await new Promise<void>((res) => {
        v.onseeked = () => res()
        setTimeout(res, 3000)
      })
      try {
        drawCover(v, v.videoWidth || W, v.videoHeight || H)
      } catch {
        /* ignore */
      }
      return { thumb: canvas.toDataURL('image/jpeg', 0.7), duration }
    }
  } catch (e) {
    console.warn('thumb', e)
  } finally {
    URL.revokeObjectURL(url)
  }
  return {}
}

export async function importMediaFiles(files: FileList | File[]): Promise<MediaItem[]> {
  const out: MediaItem[] = []
  for (const f of Array.from(files)) {
    const kind = kindOf(f)
    if (!kind) continue
    const id = uid()
    await saveBlob(id, f)
    const { thumb, duration } = await makeThumb(f, kind)
    out.push({ id, name: f.name.replace(/\.[^.]+$/, ''), kind, thumb, duration, size: f.size, createdAt: Date.now() })
  }
  if (out.length) setState((s) => ({ ...s, media: [...out, ...s.media] }))
  return out
}

// ---------------- PowerPoint ----------------
/**
 * Converte o .pptx para .ppsx em "modo janela" (Apresentado por uma pessoa — janela).
 * Ao abrir o arquivo, o PowerPoint já inicia a apresentação, com animações, numa janela
 * que o painel consegue capturar e mandar para o telão.
 */
export async function pptxToWindowedShow(id: string): Promise<Blob | null> {
  const blob = await getBlob(id)
  if (!blob) return null
  try {
    const files = unzipSync(new Uint8Array(await blob.arrayBuffer()))
    const ct = files['[Content_Types].xml']
    if (ct) {
      const x = strFromU8(ct).replace(
        /application\/vnd\.openxmlformats-officedocument\.presentationml\.(presentation|template)\.main\+xml/g,
        'application/vnd.openxmlformats-officedocument.presentationml.slideshow.main+xml',
      )
      files['[Content_Types].xml'] = strToU8(x)
    }
    const ppKey = 'ppt/presProps.xml'
    if (files[ppKey]) {
      let x = strFromU8(files[ppKey])
      const browse = '<p:browse showScrollbar="0"/>'
      if (/<p:showPr\b[^>]*\/>/.test(x)) {
        x = x.replace(/<p:showPr\b([^>]*)\/>/, `<p:showPr$1>${browse}</p:showPr>`)
      } else if (/<p:showPr\b/.test(x)) {
        x = x.replace(/<p:(present|browse|kiosk)\b[^>]*\/>/g, '').replace(/<p:kiosk\b[^>]*>.*?<\/p:kiosk>/g, '')
        x = x.replace(/(<p:showPr\b[^>]*>)/, `$1${browse}`)
      } else {
        const tag = `<p:showPr>${browse}</p:showPr>`
        if (/<p:clrMru\b/.test(x)) x = x.replace(/<p:clrMru\b/, tag + '<p:clrMru')
        else if (/<p:extLst\b/.test(x)) x = x.replace(/<p:extLst\b/, tag + '<p:extLst')
        else x = x.replace(/<\/p:presentationPr>/, tag + '</p:presentationPr>')
      }
      files[ppKey] = strToU8(x)
    }
    const z = zipSync(files, { level: 6 })
    return new Blob([z], { type: 'application/vnd.openxmlformats-officedocument.presentationml.slideshow' })
  } catch (e) {
    console.error('pptx', e)
    return null
  }
}

export function downloadBlob(blob: Blob, name: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 60000)
}

// ---------------- Músicas (arquivos / zip) ----------------
export async function readSongFiles(files: FileList | File[]) {
  const songs = []
  for (const f of Array.from(files)) {
    if (/\.zip$/i.test(f.name)) {
      const entries = unzipSync(new Uint8Array(await f.arrayBuffer()))
      for (const [name, data] of Object.entries(entries)) {
        if (name.endsWith('/') || !/\.(txt|xml|json|lyrics)$/i.test(name)) continue
        songs.push(...parseSongFile(name.split('/').pop()!, decodeText(data)))
      }
    } else {
      songs.push(...parseSongFile(f.name, decodeText(new Uint8Array(await f.arrayBuffer()))))
    }
  }
  return songs
}

export function decodeText(data: Uint8Array) {
  // UTF-8, com fallback para Windows-1252 (arquivos antigos)
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(data)
  } catch {
    return new TextDecoder('windows-1252').decode(data)
  }
}

// ---------------- Backup completo (.zip) ----------------
export async function exportBackup() {
  const s = getState()
  const files: Record<string, Uint8Array> = {}
  files['estado.json'] = strToU8(JSON.stringify({ ...s, live: { ...s.live, media: null } }))
  for (const m of s.media) {
    const b = await getBlob(m.id)
    if (b) files['arquivos/' + m.id] = new Uint8Array(await b.arrayBuffer())
  }
  for (const b of s.bibles) {
    const data = await dbGet('bible:' + b.id)
    if (data) files['biblias/' + b.id + '.json'] = strToU8(JSON.stringify(data))
  }
  const z = zipSync(files, { level: 0 })
  downloadBlob(new Blob([z], { type: 'application/zip' }), `projecao-backup-${new Date().toISOString().slice(0, 10)}.zip`)
}

export async function importBackup(file: File) {
  const entries = unzipSync(new Uint8Array(await file.arrayBuffer()))
  const st = entries['estado.json']
  if (!st) throw new Error('Backup inválido (sem estado.json)')
  const state = JSON.parse(strFromU8(st)) as AppState
  for (const [name, data] of Object.entries(entries)) {
    if (name.startsWith('arquivos/') && name.length > 9) {
      const id = name.slice(9)
      const m = state.media.find((x) => x.id === id)
      const type = m?.kind === 'video' ? 'video/mp4' : m?.kind === 'pptx' ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation' : 'image/*'
      await saveBlob(id, new Blob([data], { type }))
    } else if (name.startsWith('biblias/') && name.endsWith('.json')) {
      await dbSet('bible:' + name.slice(8, -5), JSON.parse(strFromU8(data)))
    }
  }
  await dbSet('app-state', state)
  location.reload()
}
