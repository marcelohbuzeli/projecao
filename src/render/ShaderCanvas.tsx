import { useEffect, useRef } from 'react'
import type { ShaderName, ShaderParams } from '../core/types'
import { VERTEX, fragmentSource } from './shaders'

/**
 * Um único contexto WebGL por janela renderiza todos os geradores (fundos ao vivo)
 * e copia o resultado para cada <canvas> 2D. Assim não estouramos o limite de contextos WebGL.
 */
interface Inst {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  name: ShaderName
  params: ShaderParams
  maxW: number
  t0: number
}

const insts = new Set<Inst>()
let gl: WebGLRenderingContext | null = null
let glCanvas: HTMLCanvasElement | null = null
const programs = new Map<ShaderName, { prog: WebGLProgram; loc: Record<string, WebGLUniformLocation | null> }>()
let raf = 0
const startTime = performance.now()

const hex = (h: string): [number, number, number] => {
  const m = h.replace('#', '')
  const n = parseInt(m.length === 3 ? m.split('').map((c) => c + c).join('') : m.slice(0, 6), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

function initGL() {
  if (gl) return gl
  glCanvas = document.createElement('canvas')
  gl = glCanvas.getContext('webgl', { antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: true })
  if (!gl) return null
  const buf = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW)
  glCanvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault()
    programs.clear()
    gl = null
  })
  return gl
}

function getProgram(name: ShaderName) {
  const g = initGL()
  if (!g) return null
  let p = programs.get(name)
  if (p) return p
  const sh = (type: number, src: string) => {
    const s = g.createShader(type)!
    g.shaderSource(s, src)
    g.compileShader(s)
    if (!g.getShaderParameter(s, g.COMPILE_STATUS)) console.error('shader', name, g.getShaderInfoLog(s))
    return s
  }
  const prog = g.createProgram()!
  g.attachShader(prog, sh(g.VERTEX_SHADER, VERTEX))
  g.attachShader(prog, sh(g.FRAGMENT_SHADER, fragmentSource(name)))
  g.linkProgram(prog)
  const loc: Record<string, WebGLUniformLocation | null> = {}
  for (const u of ['uRes', 'uTime', 'cA', 'cB', 'cC', 'uInt', 'uScale', 'uWarp', 'uGrain', 'uGlow', 'uContrast', 'uVig', 'uDark', 'uTint', 'uTintAmt']) loc[u] = g.getUniformLocation(prog, u)
  p = { prog, loc }
  programs.set(name, p)
  return p
}

function frame() {
  raf = requestAnimationFrame(frame)
  const g = initGL()
  if (!g || !glCanvas) return
  const now = (performance.now() - startTime) / 1000
  for (const it of insts) {
    const rect = it.canvas.getBoundingClientRect()
    if (rect.width < 2 || rect.height < 2) continue
    const scale = Math.min(1, it.maxW / rect.width) * Math.min(window.devicePixelRatio || 1, 1.5)
    const w = Math.max(2, Math.round(rect.width * scale))
    const h = Math.max(2, Math.round(rect.height * scale))
    if (it.canvas.width !== w || it.canvas.height !== h) {
      it.canvas.width = w
      it.canvas.height = h
    }
    if (glCanvas.width < w || glCanvas.height < h) {
      glCanvas.width = Math.max(glCanvas.width, w)
      glCanvas.height = Math.max(glCanvas.height, h)
    }
    const p = getProgram(it.name)
    if (!p) continue
    g.useProgram(p.prog)
    const loc = g.getAttribLocation(p.prog, 'p')
    g.enableVertexAttribArray(loc)
    g.vertexAttribPointer(loc, 2, g.FLOAT, false, 0, 0)
    g.viewport(0, 0, w, h)
    g.uniform2f(p.loc.uRes, w, h)
    g.uniform1f(p.loc.uTime, now * it.params.speed * 2 + it.t0)
    g.uniform3fv(p.loc.cA, hex(it.params.colorA))
    g.uniform3fv(p.loc.cB, hex(it.params.colorB))
    g.uniform3fv(p.loc.cC, hex(it.params.colorC))
    g.uniform1f(p.loc.uInt, it.params.intensity)
    g.uniform1f(p.loc.uScale, it.params.scale)
    const pr = it.params
    g.uniform1f(p.loc.uWarp, pr.warp ?? 0)
    g.uniform1f(p.loc.uGrain, pr.grain ?? 0)
    g.uniform1f(p.loc.uGlow, pr.glow ?? 0)
    g.uniform1f(p.loc.uContrast, pr.contrast ?? 1)
    g.uniform1f(p.loc.uVig, pr.vignette ?? 0)
    g.uniform1f(p.loc.uDark, pr.dark ?? 0)
    g.uniform3fv(p.loc.uTint, hex(pr.tint ?? '#ffffff'))
    g.uniform1f(p.loc.uTintAmt, pr.tintAmt ?? 0)
    g.drawArrays(g.TRIANGLES, 0, 6)
    // WebGL desenha de baixo para cima: copia a região inferior-esquerda
    it.ctx.drawImage(glCanvas, 0, glCanvas.height - h, w, h, 0, 0, w, h)
  }
  if (!insts.size) {
    cancelAnimationFrame(raf)
    raf = 0
  }
}

export function ShaderCanvas({ name, params, maxW = 1600, style }: { name: ShaderName; params: ShaderParams; maxW?: number; style?: React.CSSProperties }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const inst = useRef<Inst | null>(null)
  useEffect(() => {
    const c = ref.current!
    const ctx = c.getContext('2d')!
    const it: Inst = { canvas: c, ctx, name, params, maxW, t0: 0 }
    inst.current = it
    insts.add(it)
    if (!raf) raf = requestAnimationFrame(frame)
    return () => {
      insts.delete(it)
    }
  }, [])
  useEffect(() => {
    if (inst.current) {
      inst.current.name = name
      inst.current.params = params
      inst.current.maxW = maxW
    }
  }, [name, params, maxW])
  return <canvas ref={ref} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', ...style }} />
}
