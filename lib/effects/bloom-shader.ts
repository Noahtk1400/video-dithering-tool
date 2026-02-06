export interface BloomConfig {
  intensity: number    // 0.0-2.0 (glow strength)
  radius: number       // 1-20 pixels (blur radius)
  threshold: number    // 0.0-1.0 (brightness cutoff)
}

/**
 * WebGL-based bloom effect using multi-pass rendering
 *
 * Pipeline:
 * 1. Threshold Pass - Extract bright pixels above threshold
 * 2. Horizontal Blur - Gaussian blur horizontally
 * 3. Vertical Blur - Gaussian blur vertically
 * 4. Combine Pass - Add blurred bloom to original
 */
export class BloomShader {
  private gl: WebGLRenderingContext
  private programs: {
    threshold: WebGLProgram | null
    blur: WebGLProgram | null
    combine: WebGLProgram | null
  }
  private framebuffers: WebGLFramebuffer[]
  private textures: WebGLTexture[]
  private quadBuffer: WebGLBuffer | null

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl', { preserveDrawingBuffer: true })
    if (!gl) {
      throw new Error('WebGL not supported')
    }
    this.gl = gl

    this.programs = {
      threshold: null,
      blur: null,
      combine: null
    }
    this.framebuffers = []
    this.textures = []
    this.quadBuffer = null

    this.initialize()
  }

  private initialize(): void {
    // Create shader programs
    this.programs.threshold = this.createProgram(this.vertexShaderSource, this.thresholdFragmentShader)
    this.programs.blur = this.createProgram(this.vertexShaderSource, this.blurFragmentShader)
    this.programs.combine = this.createProgram(this.vertexShaderSource, this.combineFragmentShader)

    // Create quad buffer for full-screen rendering
    this.quadBuffer = this.gl.createBuffer()
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.quadBuffer)
    const quad = new Float32Array([
      -1, -1,  0, 0,
       1, -1,  1, 0,
      -1,  1,  0, 1,
       1,  1,  1, 1
    ])
    this.gl.bufferData(this.gl.ARRAY_BUFFER, quad, this.gl.STATIC_DRAW)
  }

  private createShader(type: number, source: string): WebGLShader {
    const shader = this.gl.createShader(type)!
    this.gl.shaderSource(shader, source)
    this.gl.compileShader(shader)

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      const info = this.gl.getShaderInfoLog(shader)
      this.gl.deleteShader(shader)
      throw new Error('Shader compilation failed: ' + info)
    }

    return shader
  }

  private createProgram(vertexSource: string, fragmentSource: string): WebGLProgram {
    const vertexShader = this.createShader(this.gl.VERTEX_SHADER, vertexSource)
    const fragmentShader = this.createShader(this.gl.FRAGMENT_SHADER, fragmentSource)

    const program = this.gl.createProgram()!
    this.gl.attachShader(program, vertexShader)
    this.gl.attachShader(program, fragmentShader)
    this.gl.linkProgram(program)

    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      const info = this.gl.getProgramInfoLog(program)
      throw new Error('Program linking failed: ' + info)
    }

    return program
  }

  private createTexture(width: number, height: number): WebGLTexture {
    const texture = this.gl.createTexture()!
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture)
    this.gl.texImage2D(
      this.gl.TEXTURE_2D, 0, this.gl.RGBA,
      width, height, 0,
      this.gl.RGBA, this.gl.UNSIGNED_BYTE, null
    )
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR)
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR)
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE)
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE)
    return texture
  }

  private createFramebuffer(texture: WebGLTexture): WebGLFramebuffer {
    const fb = this.gl.createFramebuffer()!
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, fb)
    this.gl.framebufferTexture2D(
      this.gl.FRAMEBUFFER,
      this.gl.COLOR_ATTACHMENT0,
      this.gl.TEXTURE_2D,
      texture,
      0
    )
    return fb
  }

  private renderQuad(program: WebGLProgram): void {
    const posLoc = this.gl.getAttribLocation(program, 'a_position')
    const texLoc = this.gl.getAttribLocation(program, 'a_texCoord')

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.quadBuffer)
    this.gl.enableVertexAttribArray(posLoc)
    this.gl.vertexAttribPointer(posLoc, 2, this.gl.FLOAT, false, 16, 0)
    this.gl.enableVertexAttribArray(texLoc)
    this.gl.vertexAttribPointer(texLoc, 2, this.gl.FLOAT, false, 16, 8)

    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4)
  }

  /**
   * Apply bloom effect to ImageData
   */
  public applyBloom(imageData: ImageData, config: BloomConfig): ImageData {
    const { width, height } = imageData

    // Create textures and framebuffers
    const originalTex = this.createTexture(width, height)
    const thresholdTex = this.createTexture(width, height)
    const blurHorizTex = this.createTexture(width, height)
    const blurVertTex = this.createTexture(width, height)

    this.textures.push(originalTex, thresholdTex, blurHorizTex, blurVertTex)

    const thresholdFB = this.createFramebuffer(thresholdTex)
    const blurHorizFB = this.createFramebuffer(blurHorizTex)
    const blurVertFB = this.createFramebuffer(blurVertTex)

    this.framebuffers.push(thresholdFB, blurHorizFB, blurVertFB)

    // Upload original image data
    this.gl.bindTexture(this.gl.TEXTURE_2D, originalTex)
    this.gl.texImage2D(
      this.gl.TEXTURE_2D, 0, this.gl.RGBA,
      width, height, 0,
      this.gl.RGBA, this.gl.UNSIGNED_BYTE, imageData.data
    )

    this.gl.viewport(0, 0, width, height)

    // Pass 1: Threshold extraction
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, thresholdFB)
    this.gl.useProgram(this.programs.threshold!)
    this.gl.uniform1i(this.gl.getUniformLocation(this.programs.threshold!, 'u_image'), 0)
    this.gl.uniform1f(this.gl.getUniformLocation(this.programs.threshold!, 'u_threshold'), config.threshold)
    this.gl.activeTexture(this.gl.TEXTURE0)
    this.gl.bindTexture(this.gl.TEXTURE_2D, originalTex)
    this.renderQuad(this.programs.threshold!)

    // Pass 2: Horizontal blur
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, blurHorizFB)
    this.gl.useProgram(this.programs.blur!)
    this.gl.uniform1i(this.gl.getUniformLocation(this.programs.blur!, 'u_image'), 0)
    this.gl.uniform2f(this.gl.getUniformLocation(this.programs.blur!, 'u_resolution'), width, height)
    this.gl.uniform2f(this.gl.getUniformLocation(this.programs.blur!, 'u_direction'), 1, 0)
    this.gl.uniform1f(this.gl.getUniformLocation(this.programs.blur!, 'u_radius'), config.radius)
    this.gl.activeTexture(this.gl.TEXTURE0)
    this.gl.bindTexture(this.gl.TEXTURE_2D, thresholdTex)
    this.renderQuad(this.programs.blur!)

    // Pass 3: Vertical blur
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, blurVertFB)
    this.gl.uniform2f(this.gl.getUniformLocation(this.programs.blur!, 'u_direction'), 0, 1)
    this.gl.activeTexture(this.gl.TEXTURE0)
    this.gl.bindTexture(this.gl.TEXTURE_2D, blurHorizTex)
    this.renderQuad(this.programs.blur!)

    // Pass 4: Combine original + bloom
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null)
    this.gl.useProgram(this.programs.combine!)
    this.gl.uniform1i(this.gl.getUniformLocation(this.programs.combine!, 'u_original'), 0)
    this.gl.uniform1i(this.gl.getUniformLocation(this.programs.combine!, 'u_bloom'), 1)
    this.gl.uniform1f(this.gl.getUniformLocation(this.programs.combine!, 'u_intensity'), config.intensity)
    this.gl.activeTexture(this.gl.TEXTURE0)
    this.gl.bindTexture(this.gl.TEXTURE_2D, originalTex)
    this.gl.activeTexture(this.gl.TEXTURE1)
    this.gl.bindTexture(this.gl.TEXTURE_2D, blurVertTex)
    this.renderQuad(this.programs.combine!)

    // Read result
    const result = new Uint8ClampedArray(width * height * 4)
    this.gl.readPixels(0, 0, width, height, this.gl.RGBA, this.gl.UNSIGNED_BYTE, result)

    return new ImageData(result, width, height)
  }

  /**
   * Clean up WebGL resources
   */
  public dispose(): void {
    this.framebuffers.forEach(fb => this.gl.deleteFramebuffer(fb))
    this.textures.forEach(tex => this.gl.deleteTexture(tex))
    if (this.quadBuffer) this.gl.deleteBuffer(this.quadBuffer)
    if (this.programs.threshold) this.gl.deleteProgram(this.programs.threshold)
    if (this.programs.blur) this.gl.deleteProgram(this.programs.blur)
    if (this.programs.combine) this.gl.deleteProgram(this.programs.combine)

    this.framebuffers = []
    this.textures = []
  }

  // Shader sources
  private get vertexShaderSource(): string {
    return `
      attribute vec2 a_position;
      attribute vec2 a_texCoord;
      varying vec2 v_texCoord;

      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_texCoord = a_texCoord;
      }
    `
  }

  private get thresholdFragmentShader(): string {
    return `
      precision mediump float;
      uniform sampler2D u_image;
      uniform float u_threshold;
      varying vec2 v_texCoord;

      void main() {
        vec4 color = texture2D(u_image, v_texCoord);
        float brightness = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));

        if (brightness > u_threshold) {
          gl_FragColor = color;
        } else {
          gl_FragColor = vec4(0.0);
        }
      }
    `
  }

  private get blurFragmentShader(): string {
    return `
      precision mediump float;
      uniform sampler2D u_image;
      uniform vec2 u_resolution;
      uniform vec2 u_direction;
      uniform float u_radius;
      varying vec2 v_texCoord;

      void main() {
        vec4 color = vec4(0.0);
        vec2 offset = u_direction / u_resolution;

        // 9-tap Gaussian kernel
        float weights[9];
        weights[0] = 0.05;
        weights[1] = 0.09;
        weights[2] = 0.12;
        weights[3] = 0.15;
        weights[4] = 0.18;
        weights[5] = 0.15;
        weights[6] = 0.12;
        weights[7] = 0.09;
        weights[8] = 0.05;

        for (int i = 0; i < 9; i++) {
          float dist = float(i - 4) * u_radius;
          color += texture2D(u_image, v_texCoord + offset * dist) * weights[i];
        }

        gl_FragColor = color;
      }
    `
  }

  private get combineFragmentShader(): string {
    return `
      precision mediump float;
      uniform sampler2D u_original;
      uniform sampler2D u_bloom;
      uniform float u_intensity;
      varying vec2 v_texCoord;

      void main() {
        vec4 original = texture2D(u_original, v_texCoord);
        vec4 bloom = texture2D(u_bloom, v_texCoord);

        gl_FragColor = original + bloom * u_intensity;
      }
    `
  }
}
