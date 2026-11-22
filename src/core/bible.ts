import type { BibleBook, BibleVersion } from './types'
import { uid } from './defaults'

export const BOOKS_PT: [string, string][] = [
  ['Gênesis', 'Gn'], ['Êxodo', 'Êx'], ['Levítico', 'Lv'], ['Números', 'Nm'], ['Deuteronômio', 'Dt'], ['Josué', 'Js'],
  ['Juízes', 'Jz'], ['Rute', 'Rt'], ['1 Samuel', '1Sm'], ['2 Samuel', '2Sm'], ['1 Reis', '1Rs'], ['2 Reis', '2Rs'],
  ['1 Crônicas', '1Cr'], ['2 Crônicas', '2Cr'], ['Esdras', 'Ed'], ['Neemias', 'Ne'], ['Ester', 'Et'], ['Jó', 'Jó'],
  ['Salmos', 'Sl'], ['Provérbios', 'Pv'], ['Eclesiastes', 'Ec'], ['Cânticos', 'Ct'], ['Isaías', 'Is'], ['Jeremias', 'Jr'],
  ['Lamentações', 'Lm'], ['Ezequiel', 'Ez'], ['Daniel', 'Dn'], ['Oséias', 'Os'], ['Joel', 'Jl'], ['Amós', 'Am'],
  ['Obadias', 'Ob'], ['Jonas', 'Jn'], ['Miquéias', 'Mq'], ['Naum', 'Na'], ['Habacuque', 'Hc'], ['Sofonias', 'Sf'],
  ['Ageu', 'Ag'], ['Zacarias', 'Zc'], ['Malaquias', 'Ml'], ['Mateus', 'Mt'], ['Marcos', 'Mc'], ['Lucas', 'Lc'],
  ['João', 'Jo'], ['Atos', 'At'], ['Romanos', 'Rm'], ['1 Coríntios', '1Co'], ['2 Coríntios', '2Co'], ['Gálatas', 'Gl'],
  ['Efésios', 'Ef'], ['Filipenses', 'Fp'], ['Colossenses', 'Cl'], ['1 Tessalonicenses', '1Ts'], ['2 Tessalonicenses', '2Ts'],
  ['1 Timóteo', '1Tm'], ['2 Timóteo', '2Tm'], ['Tito', 'Tt'], ['Filemom', 'Fm'], ['Hebreus', 'Hb'], ['Tiago', 'Tg'],
  ['1 Pedro', '1Pe'], ['2 Pedro', '2Pe'], ['1 João', '1Jo'], ['2 João', '2Jo'], ['3 João', '3Jo'], ['Judas', 'Jd'],
  ['Apocalipse', 'Ap'],
]

export const norm = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

const clean = (t: string) => t.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()

function finish(name: string, books: BibleBook[]): BibleVersion {
  // completa nomes faltando pela ordem canônica
  books.forEach((b, i) => {
    if (books.length === 66 || !b.name) {
      if (!b.name || /^\d+$/.test(b.name)) b.name = BOOKS_PT[i]?.[0] ?? b.name
    }
    if (!b.abbrev) b.abbrev = BOOKS_PT.find((x) => norm(x[0]) === norm(b.name))?.[1] ?? b.name.slice(0, 3)
  })
  const abbrev = name.replace(/\.[^.]+$/, '').toUpperCase().slice(0, 8)
  return { id: uid(), name: name.replace(/\.[^.]+$/, ''), abbrev, books }
}

export function parseBible(fileName: string, content: string): BibleVersion {
  const c = content.replace(/^﻿/, '')
  if (/^\s*[[{]/.test(c)) {
    const j = JSON.parse(c)
    const arr: any[] = Array.isArray(j) ? j : j.books ?? j.livros ?? []
    const books: BibleBook[] = arr.map((b: any, i: number) => {
      const chapters: string[][] = (b.chapters ?? b.capitulos ?? []).map((ch: any) =>
        Array.isArray(ch) ? ch.map((v: any) => clean(typeof v === 'string' ? v : v.text ?? v.texto ?? '')) : (ch.verses ?? []).map((v: any) => clean(v.text ?? v)),
      )
      const bn = typeof b.name === 'string' ? b.name : typeof b.nome === 'string' ? b.nome : BOOKS_PT[i]?.[0] ?? ''
      return { name: bn, abbrev: '', chapters }
    })
    if (!books.length) throw new Error('JSON sem livros')
    return finish(j.name ?? j.version ?? fileName, books)
  }
  const doc = new DOMParser().parseFromString(c, 'application/xml')
  if (doc.querySelector('parsererror')) throw new Error('XML inválido')
  const root = doc.documentElement
  // Zefania
  if (root.nodeName.toUpperCase() === 'XMLBIBLE') {
    const books = [...doc.getElementsByTagName('BIBLEBOOK')].map((b) => ({
      name: b.getAttribute('bname') ?? '',
      abbrev: b.getAttribute('bsname') ?? '',
      chapters: [...b.getElementsByTagName('CHAPTER')].map((ch) => [...ch.getElementsByTagName('VERS')].map((v) => clean(v.textContent ?? ''))),
    }))
    return finish(root.getAttribute('biblename') ?? fileName, books)
  }
  // OSIS
  if (doc.getElementsByTagName('osisText').length) {
    const books = [...doc.querySelectorAll('div[type="book"]')].map((b) => ({
      name: '',
      abbrev: '',
      chapters: [...b.getElementsByTagName('chapter')].map((ch) => [...ch.getElementsByTagName('verse')].map((v) => clean(v.textContent ?? ''))),
    }))
    return finish(fileName, books)
  }
  // OpenSong (<bible><b n><c n><v n>) ou Beblia (<bible><testament><book><chapter><verse>)
  const bTags = doc.getElementsByTagName('b').length ? 'b' : 'book'
  const cTag = bTags === 'b' ? 'c' : 'chapter'
  const vTag = bTags === 'b' ? 'v' : 'verse'
  const books = [...doc.getElementsByTagName(bTags)].map((b) => ({
    name: b.getAttribute('n') ?? b.getAttribute('name') ?? '',
    abbrev: '',
    chapters: [...b.getElementsByTagName(cTag)].map((ch) => [...ch.getElementsByTagName(vTag)].map((v) => clean(v.textContent ?? ''))),
  }))
  if (!books.length) throw new Error('Formato de Bíblia não reconhecido')
  return finish(root.getAttribute('name') ?? root.getAttribute('translation') ?? fileName, books)
}

// ---- busca de referência: "jo 3 16", "joão 3:16-18", "1co 13", "sl 23.1" ----
export interface Ref { book: number; chapter: number; verseFrom: number; verseTo: number }

export function findBook(bible: BibleVersion, q: string): number[] {
  const n = norm(q).replace(/\s/g, '')
  if (!n) return []
  const hits: number[] = []
  bible.books.forEach((b, i) => {
    const names = [b.name, b.abbrev, BOOKS_PT[i]?.[0] ?? '', BOOKS_PT[i]?.[1] ?? ''].map((x) => norm(x).replace(/\s/g, ''))
    if (names.some((x) => x === n)) hits.unshift(i)
    else if (names.some((x) => x.startsWith(n))) hits.push(i)
  })
  return [...new Set(hits)]
}

export function parseRef(bible: BibleVersion, q: string): Ref | null {
  const m = norm(q).match(/^(\d?\s*[a-zçãõáéíóúâêô]+)\.?\s*(\d+)?(?:\s*[:.\s]\s*(\d+))?(?:\s*-\s*(\d+))?/)
  if (!m) return null
  const books = findBook(bible, m[1])
  if (!books.length) return null
  const book = books[0]
  const chapter = Math.max(1, parseInt(m[2] ?? '1'))
  const ch = bible.books[book].chapters[chapter - 1]
  if (!ch) return { book, chapter: 1, verseFrom: 1, verseTo: 1 }
  const vf = Math.min(ch.length, Math.max(1, parseInt(m[3] ?? '1')))
  const vt = Math.min(ch.length, Math.max(vf, parseInt(m[4] ?? m[3] ?? '1')))
  return { book, chapter, verseFrom: vf, verseTo: vt }
}

export function refLabel(bible: BibleVersion | null, r: Ref) {
  const name = bible?.books[r.book]?.name ?? BOOKS_PT[r.book]?.[0] ?? '?'
  const v = r.verseFrom === r.verseTo ? `${r.verseFrom}` : `${r.verseFrom}-${r.verseTo}`
  return `${name} ${r.chapter}:${v}${bible ? ' (' + bible.abbrev + ')' : ''}`
}

/** Busca por palavra no texto (limita resultados) */
export function searchText(bible: BibleVersion, q: string, limit = 60) {
  const n = norm(q)
  const out: { book: number; chapter: number; verse: number; text: string }[] = []
  if (n.length < 3) return out
  for (let b = 0; b < bible.books.length; b++) {
    const chs = bible.books[b].chapters
    for (let c = 0; c < chs.length; c++) {
      for (let v = 0; v < chs[c].length; v++) {
        if (norm(chs[c][v]).includes(n)) {
          out.push({ book: b, chapter: c + 1, verse: v + 1, text: chs[c][v] })
          if (out.length >= limit) return out
        }
      }
    }
  }
  return out
}
