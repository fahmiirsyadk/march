import { useEffect, useRef } from 'react'

type StreamingShaderOverlayProps = {
  active: boolean
}

const VERTEX_SHADER = `
  attribute vec2 a_position;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`

const FRAGMENT_SHADER = `
  precision highp float;
  uniform float u_time;
  uniform vec2 u_res;
  uniform vec3 u_bg;

  void main() {
    vec2 uv = gl_FragCoord.xy / u_res;

    float wave = sin(uv.x * 6.0 + u_time * 1.2) * 0.03;
    wave += sin(uv.x * 12.0 - u_time * 1.8) * 0.015;
    wave += sin(uv.x * 20.0 + u_time * 2.5) * 0.008;
    wave += sin(uv.x * 35.0 - u_time * 3.2) * 0.004;

    float h = uv.y + wave;

    float intensity = 1.0 - smoothstep(0.18, 0.55, h);
    intensity = smoothstep(0.0, 1.0, intensity);
    intensity = pow(intensity, 0.9);
    intensity *= 0.95 + 0.05 * sin(u_time * 0.8);

    vec3 red = vec3(0.82, 0.0, 0.03);
    vec3 darkRed = vec3(0.45, 0.0, 0.01);

    vec3 color = mix(darkRed, red, intensity);
    color *= intensity * 1.3;

    float bottomBoost = pow(1.0 - uv.y, 6.0);
    color += vec3(0.25, 0.0, 0.0) * bottomBoost * intensity;

    vec3 result = mix(u_bg, color, intensity * 0.25);

    gl_FragColor = vec4(result, 1.0);
  }
`

function compileShader(gl: WebGLRenderingContext, type: number, src: string) {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, src)
  gl.compileShader(shader)
  return shader
}

function hexToRgb(hex: string): [number, number, number] {
  const cleaned = hex.replace('#', '')
  const r = parseInt(cleaned.substring(0, 2), 16) / 255
  const g = parseInt(cleaned.substring(2, 4), 16) / 255
  const b = parseInt(cleaned.substring(4, 6), 16) / 255
  return [r, g, b]
}

function getWorkspaceBg(): [number, number, number] {
  const workspace = getComputedStyle(document.documentElement)
    .getPropertyValue('--workspace')
    .trim()
  if (workspace.startsWith('#')) return hexToRgb(workspace)
  return [0.094, 0.094, 0.094]
}

export function StreamingShaderOverlay({ active }: StreamingShaderOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const glRef = useRef<WebGLRenderingContext | null>(null)
  const programRef = useRef<WebGLProgram | null>(null)
  const uTimeRef = useRef<WebGLUniformLocation | null>(null)
  const uResRef = useRef<WebGLUniformLocation | null>(null)
  const uBgRef = useRef<WebGLUniformLocation | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const opacityRef = useRef(0)
  const startTimeRef = useRef(performance.now())
  const activeRef = useRef(active)

  activeRef.current = active

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!(canvas && container)) return

    const gl = canvas.getContext('webgl', {
      alpha: false,
      antialias: true,
      depth: false,
    })
    if (!gl) return

    glRef.current = gl

    const vs = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER)
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER)
    if (!(vs && fs)) return

    const program = gl.createProgram()
    if (!program) return

    gl.attachShader(program, vs)
    gl.attachShader(program, fs)
    gl.linkProgram(program)
    // biome-ignore lint/correctness/useHookAtTopLevel: WebGL API, not a React hook
    gl.useProgram(program)

    programRef.current = program

    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)

    const loc = gl.getAttribLocation(program, 'a_position')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)

    uTimeRef.current = gl.getUniformLocation(program, 'u_time')
    uResRef.current = gl.getUniformLocation(program, 'u_res')
    uBgRef.current = gl.getUniformLocation(program, 'u_bg')

    const resize = () => {
      const rect = container.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = Math.floor(rect.width * dpr)
      const h = Math.floor(rect.height * dpr)
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
        gl.viewport(0, 0, w, h)
      }
    }

    resize()

    const observer = new ResizeObserver(() => resize())
    observer.observe(container)

    const render = () => {
      const now = performance.now()
      const elapsed = now - startTimeRef.current
      const currentlyActive = activeRef.current

      if (currentlyActive) {
        opacityRef.current = Math.min(1, opacityRef.current + 0.06)
      } else {
        opacityRef.current = Math.max(0, opacityRef.current - 0.04)
      }

      if (container) {
        container.style.opacity = String(opacityRef.current)
      }

      resize()

      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)

      const t = elapsed * 0.001
      const bg = getWorkspaceBg()

      gl.uniform1f(uTimeRef.current, t)
      gl.uniform2f(uResRef.current, canvas.width, canvas.height)
      gl.uniform3f(uBgRef.current, bg[0], bg[1], bg[2])
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

      animFrameRef.current = requestAnimationFrame(render)
    }

    animFrameRef.current = requestAnimationFrame(render)

    return () => {
      observer.disconnect()
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (active) {
      startTimeRef.current = performance.now()
      opacityRef.current = 0
    }
  }, [active])

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute inset-0 z-0 h-full w-full"
      style={{ opacity: 0 }}
    >
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  )
}
