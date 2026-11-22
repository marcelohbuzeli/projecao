import type { Scene, OutputLook, CameraLayout } from '../core/types'
import { useStore, findStyle } from '../core/store'
import { visualCss } from './common'
import { CAMERA_PRESETS } from '../core/defaults'

export function cameraDesc(c: CameraLayout) {
  if (!c.enabled) return ''
  const p = CAMERA_PRESETS.find((x) => {
    const k = x.cam
    return k.x === c.x && k.y === c.y && k.w === c.w && k.h === c.h && (k.blend ?? 'normal') === c.blend
  })
  if (p) return p.name
  if (c.blend !== 'normal') return 'Mesclada'
  return c.w >= 99 && c.h >= 99 ? 'Tela cheia' : 'Janela'
}

function OutRow({ label, look }: { label: string; look: OutputLook }) {
  const style = useStore((s) => findStyle(s, look.textStyleId))
  const cam = cameraDesc(look.camera)
  return (
    <div className="sc-row">
      <b>{label}</b>
      <span className={look.lyrics ? '' : 'off'} title="Letra">Aa {look.lyrics ? style.name.split('—')[0].trim() : 'sem letra'}</span>
      {cam && <span className="cam" title="Câmera">● {cam}</span>}
      {!look.theme && <span className="off">sem fundo</span>}
    </div>
  )
}

/** Mini-mapa visual de uma saída: fundo + câmera + caixa de texto */
function MiniMap({ scene, out }: { scene: Scene; out: 'telao' | 'laterais' }) {
  const theme = useStore((s) => s.themes.find((t) => t.id === scene.themeId))
  const media = useStore((s) => s.media)
  const look = scene.outputs[out]
  const style = useStore((s) => findStyle(s, look.textStyleId))
  const thumb = theme?.visual.type === 'media' ? media.find((m) => m.id === (theme.visual as any).mediaId)?.thumb : undefined
  const c = look.camera
  return (
    <div className="minimap" style={look.theme && theme ? visualCss(theme.visual, thumb) : { background: '#000' }}>
      {c.enabled && (
        <div className="mm-cam" style={{ left: c.x + '%', top: c.y + '%', width: c.w + '%', height: c.h + '%', opacity: c.blend === 'normal' ? 0.9 : 0.45 }} />
      )}
      {look.lyrics && (
        <div className="mm-text" style={{ left: style.box.x + '%', top: style.box.y + '%', width: style.box.w + '%', height: style.box.h + '%' }}>
          <i style={{ height: Math.max(8, style.fontSize * 2.2) + '%' }} />
          <i style={{ height: Math.max(8, style.fontSize * 2.2) + '%', width: '70%' }} />
        </div>
      )}
    </div>
  )
}

export function SceneCard({ scene, active, onClick, onContext, compact }: { scene: Scene; active?: boolean; onClick?: () => void; onContext?: (e: React.MouseEvent) => void; compact?: boolean }) {
  const theme = useStore((s) => s.themes.find((t) => t.id === scene.themeId))
  const overlay = useStore((s) => s.overlays.find((t) => t.id === scene.overlayId))
  return (
    <button className={'scene-card' + (active ? ' active' : '')} onClick={onClick} onContextMenu={onContext} style={{ ['--sc' as any]: scene.color }}>
      <div className="sc-head">
        <span className="sc-dot" />
        <span className="sc-name">{scene.name}</span>
        {active && <span className="sc-live">NO AR</span>}
      </div>
      <div className="sc-maps">
        <div>
          <MiniMap scene={scene} out="telao" />
          <small>Telão</small>
        </div>
        <div>
          <MiniMap scene={scene} out="laterais" />
          <small>Laterais</small>
        </div>
      </div>
      {!compact && (
        <div className="sc-info">
          <div className="sc-row">
            <b>Fundo</b>
            <span>{theme?.name ?? 'nenhum'}</span>
            {overlay && <span className="ov">+ {overlay.name}</span>}
          </div>
          <OutRow label="Telão" look={scene.outputs.telao} />
          <OutRow label="Laterais" look={scene.outputs.laterais} />
        </div>
      )}
    </button>
  )
}
