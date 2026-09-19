import type { CloudParams } from "./params";
import { INSTANCE_STRIDE } from "./layout";
import { FRAG, VERT } from "./shaders";
import { SUN_TOP } from "../lib/scene";

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [0.56, 0.69, 0.85];
  const v = parseInt(m[1], 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
}

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const sh = gl.createShader(type);
  if (!sh) throw new Error("could not create shader");
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error(`shader compile failed: ${log}`);
  }
  return sh;
}

/**
 * A 256x256 RGBA tile of white noise, sampled instead of computed. LINEAR
 * filtering with REPEAT wrap and no mipmaps - the 3D lookup folds the z lattice
 * into xy, so it relies on the tile wrapping.
 */
function createNoiseTexture(gl: WebGL2RenderingContext, size = 256) {
  const data = new Uint8Array(size * size * 4);
  let s = 0x9e3779b9;
  for (let i = 0; i < data.length; i++) {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    data[i] = s & 255;
  }
  const tex = gl.createTexture();
  if (!tex) throw new Error("could not create noise texture");
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  gl.bindTexture(gl.TEXTURE_2D, null);
  return tex;
}

/**
 * The cloud pass, ported from `CLOUDS/arc-clouds`.
 *
 * Differences from the prototype, and why:
 *
 * - No HUD, no GPU timer query, no instance/fps readouts - the site has no
 *   debug chrome, and `EXT_disjoint_timer_query_webgl2` is disabled on some
 *   drivers anyway.
 * - No param panel, so the cloud set is built once and never rebuilt.
 * - A `still` mode for `prefers-reduced-motion`: with nothing moving in the
 *   shader, frames are drawn on change only rather than at the cap.
 * - `progress` and `visibilitychange` both park the loop. A backdrop nobody is
 *   looking at costs zero.
 *
 * The context is requested without `powerPreference`, so a laptop stays on its
 * integrated GPU: this workload never needed more, and asking for the discrete
 * one would spin up a fan for a background.
 */
export class CloudRenderer {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private instBuf: WebGLBuffer;
  private noiseTex: WebGLTexture;
  private u: Record<string, WebGLUniformLocation | null>;
  private params: CloudParams;
  private shadow: [number, number, number];
  private raf = 0;
  private started = false;
  private clock = 0;
  private lastDraw = 0;
  private paused = false;
  private still = false;
  private dirty = true;
  private count = 0;
  private spin = 0;
  /** cloud size, scaled with the sun */
  private size = 1;
  /** ring radius: how far out each cloud is pushed along its own orbit */
  private spread = 1;
  /** the sun's scroll motion, in CSS pixels, positive = down */
  private shift = 0;

  constructor(canvas: HTMLCanvasElement, params: CloudParams) {
    this.params = { ...params };
    this.shadow = hexToRgb(params.shadow);

    const gl = canvas.getContext("webgl2", {
      alpha: true,
      // premultiplied output, so the canvas composites over the CSS sky cleanly
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      // NOT set: preserveDrawingBuffer:true forces a framebuffer copy every
      // frame, which is pure waste in shipping code.
      preserveDrawingBuffer: false,
    });
    if (!gl) throw new Error("WebGL2 is not available in this browser");
    this.gl = gl;

    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    const program = gl.createProgram();
    if (!program) throw new Error("could not create program");
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`program link failed: ${gl.getProgramInfoLog(program)}`);
    }
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    this.program = program;

    const loc = (n: string) => gl.getUniformLocation(program, n);
    this.u = {
      noise: loc("uNoise"),
      res: loc("uRes"),
      sun: loc("uSun"),
      shift: loc("uShift"),
      size: loc("uSize"),
      spread: loc("uSpread"),
      spin: loc("uSpin"),
      time: loc("uTime"),
      drift: loc("uDrift"),
      erode: loc("uErode"),
      edgeRag: loc("uEdgeRag"),
      detailScale: loc("uDetailScale"),
      soft: loc("uSoft"),
      contrast: loc("uContrast"),
      lump: loc("uLump"),
      bump: loc("uBump"),
      taper: loc("uTaper"),
      variety: loc("uVariety"),
      flow: loc("uFlow"),
      tailCurl: loc("uTailCurl"),
      filament: loc("uFilament"),
      pixel: loc("uPixel"),
      bodyMin: loc("uBodyMin"),
      endFade: loc("uEndFade"),
      alongWarp: loc("uAlongWarp"),
      spineWobble: loc("uSpineWobble"),
      octaves: loc("uOctaves"),
      ambient: loc("uAmbient"),
      rim: loc("uRim"),
      glow: loc("uGlow"),
      glowFall: loc("uGlowFall"),
      shadow: loc("uShadow"),
      silhouette: loc("uSilhouette"),
    };

    const quadBuf = gl.createBuffer();
    const instBuf = gl.createBuffer();
    if (!quadBuf || !instBuf) throw new Error("could not create buffers");
    this.instBuf = instBuf;

    const vao = gl.createVertexArray();
    if (!vao) throw new Error("could not create VAO");
    this.vao = vao;

    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const stride = INSTANCE_STRIDE * 4;
    gl.bindBuffer(gl.ARRAY_BUFFER, instBuf);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, stride, 0);
    gl.vertexAttribDivisor(1, 1);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 4, gl.FLOAT, false, stride, 16);
    gl.vertexAttribDivisor(2, 1);

    gl.bindVertexArray(null);

    this.noiseTex = createNoiseTexture(gl);
  }

  setParams(next: CloudParams) {
    if (next.shadow !== this.params.shadow) this.shadow = hexToRgb(next.shadow);
    this.params = { ...next };
    this.dirty = true;
  }

  setClouds(data: Float32Array, count: number) {
    const gl = this.gl;
    this.count = count;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instBuf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  }

  /**
   * The sun's motion, mirrored onto the field: the whole composition rotates by
   * `spin`, the clouds scale by `size`, the ring pushes out by `spread`, and all
   * of it follows the sun by `shift` pixels.
   *
   * Size and spread are separate because a zoomed-out sky has to do two things
   * at once - the clouds shrink with their sun, and the ring stays wide enough
   * that the composition still fills the screen instead of pooling in the middle.
   */
  setField(spin: number, size: number, spread: number, shift: number) {
    this.spin = spin;
    this.size = Math.max(0.05, size);
    this.spread = spread;
    this.shift = shift;
    this.dirty = true;
  }

  /** Reduced motion: nothing in the shader moves, so draw on change only. */
  setStill(value: boolean) {
    this.still = value;
    this.dirty = true;
  }

  setPaused(value: boolean) {
    this.paused = value;
  }

  start() {
    if (this.started) return;
    this.started = true;
    this.lastDraw = 0;
    this.raf = requestAnimationFrame(this.frame);
  }

  stop() {
    this.started = false;
    cancelAnimationFrame(this.raf);
  }

  dispose() {
    this.stop();
    const gl = this.gl;
    gl.deleteProgram(this.program);
    gl.deleteBuffer(this.instBuf);
    gl.deleteVertexArray(this.vao);
    gl.deleteTexture(this.noiseTex);
  }

  private frame = (now: number) => {
    if (!this.started) return;
    this.raf = requestAnimationFrame(this.frame);
    if (this.paused) return;

    const p = this.params;
    const gl = this.gl;
    const canvas = gl.canvas as HTMLCanvasElement;

    const scale = Math.min(2, window.devicePixelRatio || 1) * p.renderScale;
    const w = Math.max(1, Math.round(canvas.clientWidth * scale));
    const h = Math.max(1, Math.round(canvas.clientHeight * scale));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      this.dirty = true;
    }

    // Measure the cap against the previous DRAW, not the previous rAF: on a
    // display faster than the cap every frame would look "too soon" and nothing
    // would ever be drawn. The 1ms tolerance stops a cap that lands on the
    // refresh interval from skipping every other frame.
    const minDelta = p.fpsCap > 0 ? 1000 / p.fpsCap : 0;
    if (this.lastDraw !== 0 && minDelta > 0 && now - this.lastDraw < minDelta - 1) return;

    if (this.still && !this.dirty) return;

    const dt = this.lastDraw === 0 ? 1 / 60 : Math.min(0.1, (now - this.lastDraw) / 1000);
    this.lastDraw = now;
    this.dirty = false;
    if (!this.still) this.clock += dt;

    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);

    // Premultiplied source-over. Cloud order barely matters because separation
    // keeps overlaps low, which is also why overdraw stays near 1x.
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    const u = this.u;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.noiseTex);
    gl.uniform1i(u.noise, 0);

    // the sun anchor, in pixels from the bottom-left, matching gl_FragCoord
    const ratio = h / Math.max(1, canvas.clientHeight);

    gl.uniform2f(u.res, w, h);
    gl.uniform2f(u.sun, w * 0.5, (1 - SUN_TOP / 100) * h);
    gl.uniform2f(u.shift, 0, -this.shift * ratio);
    gl.uniform1f(u.size, this.size);
    gl.uniform1f(u.spread, this.spread);
    gl.uniform1f(u.spin, this.spin);
    gl.uniform1f(u.time, this.clock);
    gl.uniform1f(u.drift, p.drift);

    gl.uniform1f(u.erode, p.erode);
    gl.uniform1f(u.edgeRag, p.edgeRag);
    gl.uniform1f(u.detailScale, Math.max(0.5, p.detailScale));
    gl.uniform1f(u.soft, Math.max(0.01, p.soft));
    gl.uniform1f(u.contrast, p.contrast);
    gl.uniform1f(u.lump, p.lump);
    gl.uniform1f(u.bump, p.bump);
    gl.uniform1f(u.taper, p.taper);
    gl.uniform1f(u.variety, p.variety);
    gl.uniform1f(u.flow, p.flow);
    gl.uniform1f(u.tailCurl, p.tailCurl);
    gl.uniform1f(u.filament, p.filament);
    // one device pixel in world units: the field can be scaled, so a pixel is
    // not a fixed fraction of the frame. Thin wisps are clamped to this so they
    // neither alias nor strobe.
    gl.uniform1f(u.pixel, 1 / (h * this.size));
    gl.uniform1f(u.bodyMin, p.bodyMin);
    gl.uniform1f(u.endFade, p.endFade);
    gl.uniform1f(u.alongWarp, p.alongWarp);
    gl.uniform1f(u.spineWobble, p.spineWobble);
    gl.uniform1i(u.octaves, Math.max(1, Math.min(5, Math.round(p.octaves))));

    gl.uniform1f(u.ambient, p.ambient);
    gl.uniform1f(u.rim, p.rim);
    gl.uniform1f(u.glow, p.glow);
    gl.uniform1f(u.glowFall, p.glowFall);
    gl.uniform3f(u.shadow, this.shadow[0], this.shadow[1], this.shadow[2]);
    gl.uniform1f(u.silhouette, p.silhouette ? 1 : 0);

    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.count);
    gl.bindVertexArray(null);
  };
}
