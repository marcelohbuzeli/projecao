import { useStore, useSnapshot, setState } from '../core/store'
import type { StageConfig, Snapshot } from '../core/types'
import { OutputPreview, Slider, Toggle, ColorField, FontSelect } from '../ui/common'
import { TimerControls, StageMessageControls } from './live/BottomPanel'

export function StagePage() {
  const cfg = useStore((s) => s.stage)
  const snap = useSnapshot()
  const set = (p: Partial<StageConfig>) => setState((s) => ({ ...s, stage: { ...s.stage, ...p } }))
  const demoSong: Snapshot = {
    ...snap,
    media: null,
    text: snap.text ?? { kind: 'song', title: 'Exemplo', text: 'Esta é a linha atual\nque está no telão', next: 'Esta é a próxima linha\ncontinua aqui', key: 'demo' },
    textVisible: true,
  }
  return (
    <div className="stage-page">
      <div className="sp-previews">
        <div>
          <h4>Agora (ao vivo)</h4>
          <OutputPreview kind="retorno" snap={snap} />
        </div>
        <div>
          <h4>Como fica com música / Bíblia</h4>
          <OutputPreview kind="retorno" snap={demoSong} />
          <p className="hint">Com imagem, vídeo ou PowerPoint no telão, a TV mostra a mídia em tela cheia com uma tarja em cima (relógio e cronômetro).</p>
        </div>
      </div>
      <div className="sp-controls">
        <section className="card">
          <h4>Cronômetro</h4>
          <p className="hint">Liga só quando precisar (retiros, eventos). Fica amarelo no aviso e vermelho no fim, e depois conta o tempo que passou.</p>
          <TimerControls />
          <Slider label="Ficar amarelo quando faltar" min={1} max={15} value={Math.round(useStore((s) => s.live.timer.warnAt) / 60)} onChange={(v) => setState((s) => ({ ...s, live: { ...s.live, timer: { ...s.live.timer, warnAt: v * 60 } } }))} suffix=" min" />
        </section>
        <section className="card">
          <h4>Mensagem para o pregador</h4>
          <StageMessageControls />
        </section>
        <section className="card">
          <h4>Aparência da TV de retorno</h4>
          <label className="field"><span>Fonte</span><FontSelect value={cfg.fontFamily} onChange={(v) => set({ fontFamily: v })} /></label>
          <Slider label="Tamanho da letra atual" min={4} max={16} step={0.5} value={cfg.fontSize} onChange={(v) => set({ fontSize: v })} />
          <Slider label="Tamanho da próxima linha" min={2} max={10} step={0.5} value={cfg.nextSize} onChange={(v) => set({ nextSize: v })} />
          <div className="row">
            <ColorField label="Cor do texto" value={cfg.textColor} onChange={(v) => set({ textColor: v })} />
            <ColorField label="Cor da próxima" value={cfg.nextColor} onChange={(v) => set({ nextColor: v })} />
          </div>
          <div className="toggles">
            <Toggle label="Mostrar próxima linha" value={cfg.showNext} onChange={(v) => set({ showNext: v })} />
            <Toggle label="Mostrar relógio" value={cfg.showClock} onChange={(v) => set({ showClock: v })} />
            <Toggle label="Relógio 24h" value={cfg.clock24} onChange={(v) => set({ clock24: v })} />
            <Toggle label="MAIÚSCULAS" value={cfg.uppercase} onChange={(v) => set({ uppercase: v })} />
          </div>
        </section>
      </div>
    </div>
  )
}
