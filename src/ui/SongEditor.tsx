import { useMemo, useState } from 'react'
import { getState, setState } from '../core/store'
import { parseSongText, songToText, splitSlides } from '../core/songs'
import { Modal, Btn } from './common'
import { setUI, refreshCursorFromSong, toast, select } from './uiStore'
import type { Song } from '../core/types'
import { uid } from '../core/defaults'

const NEW_TEMPLATE = `Título da música
Artista (opcional)

[Verso 1]
Primeira linha
Segunda linha

[Refrão]
Linha do refrão
Outra linha`

export function SongEditor({ songId }: { songId: string }) {
  const original = songId === 'new' ? null : getState().songs.find((s) => s.id === songId) ?? null
  const [text, setText] = useState(original ? songToText(original) : NEW_TEMPLATE)
  const [maxLines, setMaxLines] = useState(2)
  const parsed = useMemo(() => parseSongText(text), [text])
  const close = () => setUI({ editSongId: null })

  const save = () => {
    const song: Song = { ...parsed, id: original?.id ?? uid(), updatedAt: Date.now() }
    setState((s) => ({
      ...s,
      songs: original ? s.songs.map((x) => (x.id === song.id ? song : x)) : [...s.songs, song],
    }))
    refreshCursorFromSong(song)
    if (!original) select({ type: 'song', songId: song.id })
    toast('Música salva')
    close()
  }

  const applySplit = () => setText(songToText(splitSlides(parsed, maxLines)))

  return (
    <Modal
      title={original ? 'Editar música' : 'Nova música'}
      onClose={close}
      wide
      footer={
        <>
          <span className="hint">Linha 1 = título · linha 2 = artista · linha em branco separa os slides · [Refrão] nomeia o slide</span>
          <Btn onClick={close}>Cancelar</Btn>
          <Btn kind="primary" onClick={save}>Salvar</Btn>
        </>
      }
    >
      <div className="song-editor">
        <div className="se-text">
          <textarea value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} autoFocus />
          <div className="row">
            <span>Dividir slides a cada</span>
            <input type="number" min={1} max={8} value={maxLines} onChange={(e) => setMaxLines(parseInt(e.target.value) || 2)} className="num" />
            <span>linhas</span>
            <Btn small onClick={applySplit}>Aplicar</Btn>
            <Btn small kind="ghost" onClick={() => setText(text.replace(/\n{3,}/g, '\n\n'))}>Limpar linhas vazias extras</Btn>
          </div>
        </div>
        <div className="se-preview">
          <div className="se-title">
            <b>{parsed.title}</b>
            {parsed.artist && <span> · {parsed.artist}</span>}
            <span className="hint"> — {parsed.slides.length} slides</span>
          </div>
          <div className="slide-grid small">
            {parsed.slides.map((s, i) => (
              <div key={i} className="slide">
                <span className="slide-label">{i + 1}{s.label ? ' · ' + s.label : ''}</span>
                <span className="slide-text">{s.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}
