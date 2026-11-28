import { useStore, useSnapshot, setState, bibleLook, getState } from '../core/store'
import type { Snapshot } from '../core/types'
import { Toggle, VisualThumb, Gallery } from '../ui/common'
import { Composite } from '../render/Layers'

const SAMPLE = {
  kind: 'bible' as const,
  title: 'João 3',
  text: 'Porque Deus amou o mundo de tal maneira que deu o seu Filho unigênito.',
  next: '',
  reference: 'João 3:16',
  key: 'bible-sample',
}

/** Layout fixo da Bíblia: a disposição da letra não muda — só o fundo. */
export function BibleLayoutPage({ onStudio }: { onStudio: () => void }) {
  const st = useStore((s) => s)
  const bl = st.bibleLayout
  const snap = useSnapshot()
  const set = (p: Partial<typeof bl>) => setState((s) => ({ ...s, bibleLayout: { ...s.bibleLayout, ...p } }))
  const fake: Snapshot = {
    ...snap,
    text: snap.text?.kind === 'bible' ? snap.text : SAMPLE,
    textVisible: true,
    media: null,
    black: false,
    alert: { ...snap.alert, visible: false },
  }
  const look = (o: 'telao' | 'laterais') => bibleLook(getState(), st.live.looks[o])
  return (
    <div className="bible-layout">
      <section className="bl-stage">
        <div className="bl-head">
          <div>
            <h3>Layout da Bíblia</h3>
            <p className="hint">Quando um versículo vai ao ar, as telas usam sempre este layout — mesma fonte, posição e tamanho, sem câmera e sem sobreposição. Aqui só o fundo muda.</p>
          </div>
          <Toggle label="Usar layout da Bíblia" value={bl.enabled} onChange={(v) => set({ enabled: v })} />
        </div>
        <div className={'bl-previews' + (bl.enabled ? '' : ' off')}>
          <figure>
            <div className="preview-box"><Composite look={look('telao')} snap={fake} preview out="telao" /></div>
            <figcaption>Telão central</figcaption>
          </figure>
          <figure>
            <div className="preview-box"><Composite look={look('laterais')} snap={fake} preview out="laterais" /></div>
            <figcaption>Projetores laterais</figcaption>
          </figure>
        </div>
        {!bl.enabled && <p className="hint text-center">Desligado: os versículos seguem a cena que estiver no ar.</p>}
      </section>
      <aside className="bl-side">
        <h5 className="studio-h">Fundo da Bíblia</h5>
        <Gallery className="bl-gallery">
          <VisualThumb visual={{ type: 'none' }} label="Fundo da cena atual" active={!bl.themeId} onClick={() => set({ themeId: null })} />
          {st.themes.map((t) => (
            <VisualThumb key={t.id} visual={t.visual} label={t.name} active={bl.themeId === t.id} onClick={() => set({ themeId: t.id })} />
          ))}
          <button className="vthumb add" onClick={onStudio}>
            <div className="vthumb-img">+</div>
            <span className="vthumb-label">Criar no Estúdio</span>
          </button>
        </Gallery>
        <p className="hint">
          A fonte e a posição do texto vêm do estilo <b>“Bíblia — elegante”</b> e ficam iguais em todo culto. A referência (ex.: João 3:16) aparece junto do versículo.
        </p>
      </aside>
    </div>
  )
}
