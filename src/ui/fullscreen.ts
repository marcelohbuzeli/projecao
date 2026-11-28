import { useEffect, useState } from 'react'
import { getState } from '../core/store'

/**
 * Tela cheia do painel do operador (sem barra do navegador, abas, fechar/minimizar).
 * O Esc fica "travado": um toque continua limpando a letra; para sair da tela cheia, segure o Esc.
 */
export const isFullscreen = () => !!document.fullscreenElement

export async function enterFullscreen() {
  if (isFullscreen()) return
  try {
    await document.documentElement.requestFullscreen({ navigationUI: 'hide' } as FullscreenOptions)
    await (navigator as any).keyboard?.lock?.(['Escape']).catch(() => {})
  } catch {
    /* o navegador recusou (precisa de um clique) */
  }
}

export async function exitFullscreen() {
  ;(navigator as any).keyboard?.unlock?.()
  if (isFullscreen()) await document.exitFullscreen().catch(() => {})
}

export const toggleFullscreen = () => (isFullscreen() ? exitFullscreen() : enterFullscreen())

export function useIsFullscreen() {
  const [fs, setFs] = useState(isFullscreen)
  useEffect(() => {
    const on = () => setFs(isFullscreen())
    document.addEventListener('fullscreenchange', on)
    return () => document.removeEventListener('fullscreenchange', on)
  }, [])
  return fs
}

/**
 * O navegador só deixa entrar em tela cheia depois de um clique/tecla.
 * Então, se a opção estiver ligada, entra no primeiro clique ou tecla depois de abrir o painel.
 * Se o operador sair de propósito, não força de novo até recarregar.
 */
export function useAutoFullscreen() {
  useEffect(() => {
    let done = false
    const go = (e: Event) => {
      if (done) return
      if (e instanceof KeyboardEvent && e.key === 'Escape') return
      done = true
      if ((getState().settings.autoFullscreen ?? true) && !isFullscreen()) enterFullscreen()
      off()
    }
    const off = () => {
      window.removeEventListener('pointerdown', go, true)
      window.removeEventListener('keydown', go, true)
    }
    window.addEventListener('pointerdown', go, true)
    window.addEventListener('keydown', go, true)
    return off
  }, [])
}
