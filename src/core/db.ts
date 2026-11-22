import { createStore, get, set, del } from 'idb-keyval'
import type { BibleVersion } from './types'

const store = createStore('projecao-db', 'kv')

export const dbGet = <T>(key: string) => get<T>(key, store)
export const dbSet = (key: string, val: unknown) => set(key, val, store)
export const dbDel = (key: string) => del(key, store)

// ---- arquivos (imagens, vídeos, pptx) ----
const urlCache = new Map<string, Promise<string | null>>()

export async function saveBlob(id: string, blob: Blob) {
  await dbSet('blob:' + id, blob)
}

export function blobUrl(id: string): Promise<string | null> {
  let p = urlCache.get(id)
  if (!p) {
    p = dbGet<Blob>('blob:' + id).then((b) => (b ? URL.createObjectURL(b) : null))
    urlCache.set(id, p)
  }
  return p
}

export async function getBlob(id: string) {
  return dbGet<Blob>('blob:' + id)
}

export async function deleteBlob(id: string) {
  urlCache.delete(id)
  await dbDel('blob:' + id)
}

// ---- bíblias ----
const bibleCache = new Map<string, BibleVersion>()
export async function loadBible(id: string): Promise<BibleVersion | null> {
  if (bibleCache.has(id)) return bibleCache.get(id)!
  const b = await dbGet<BibleVersion>('bible:' + id)
  if (b) bibleCache.set(id, b)
  return b ?? null
}
export async function saveBible(b: BibleVersion) {
  bibleCache.set(b.id, b)
  await dbSet('bible:' + b.id, b)
}
export async function deleteBible(id: string) {
  bibleCache.delete(id)
  await dbDel('bible:' + id)
}
