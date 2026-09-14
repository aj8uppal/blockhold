import * as THREE from 'three'

/**
 * What surrounds the island.
 *
 * The campaign's sky is a two-colour dome, and at play pitch the camera looks
 * down past the horizon, so all a player ever saw of it was the bottom colour:
 * every board floated in a flat wash. A sky that is meant to be *seen* has to
 * paint the lower half of the dome, which is where these layers live - a cloud
 * sea far below, stars and a planet in the abyss under a drifting asteroid,
 * the glow of an eclipse behind the far rim.
 *
 * Each layer is compiled in only when a sky asks for it, so a board that is
 * just a gradient pays for exactly the gradient it had before.
 */
export interface SkyDef {
  /** 0..1 how many stars; brightness follows */
  stars?: number
  starColor?: number
  /** two colours of drifting nebula and how strongly they show */
  nebula?: { a: number, b: number, strength: number }
  /**
   * A body in the sky. `dir` points from the island toward it; at play pitch
   * the frame looks down, so bodies that should be seen sit below the horizon
   * (negative y) and behind the board (negative z).
   */
  body?: {
    dir: [number, number, number]
    /** angular radius in radians */
    size: number
    color: number
    /** second colour for bands (gas giant) or the corona (eclipse) */
    accent?: number
    kind: 'planet' | 'sun' | 'eclipse' | 'moon'
    ring?: number
    glow?: number
  }
  /** a sea of cloud below the island */
  cloudSea?: { color: number, shade: number, strength: number, scale?: number }
  /** curtains of light */
  aurora?: { a: number, b: number, strength: number }
  /** rolling storm cloud all around, lit by lightning */
  storm?: { color: number, strength: number }
  /** light shafts from above (underwater, cathedral glow) */
  rays?: { color: number, strength: number }
  /** soft glowing motes fixed in the dome (glowworms, plankton) */
  specks?: { color: number, density: number }
  /** cave rock all around, split by glowing seams */
  veins?: { rock: number, color: number, strength: number }
  /** a third gradient stop at the horizon, for skies whose nadir and horizon differ */
  horizon?: number
  /** the engine flashes the sky and the light now and then */
  lightning?: boolean
}

const NOISE = /* glsl */`
  float hash13(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.zyx + 31.32);
    return fract((p.x + p.y) * p.z);
  }
  float vnoise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash13(i), hash13(i + vec3(1,0,0)), f.x),
                   mix(hash13(i + vec3(0,1,0)), hash13(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash13(i + vec3(0,0,1)), hash13(i + vec3(1,0,1)), f.x),
                   mix(hash13(i + vec3(0,1,1)), hash13(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float fbm(vec3 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * vnoise(p); p = p * 2.03 + 11.7; a *= 0.5; }
    return v;
  }
`

const FRAGMENT = /* glsl */`
  uniform vec3 uTop;
  uniform vec3 uBottom;
  uniform float uTime;
  uniform float uFlash;
  varying vec3 vPos;
  #ifdef HORIZON
  uniform vec3 uHorizon;
  #endif
  #ifdef STARS
  uniform float uStars;
  uniform vec3 uStarColor;
  #endif
  #ifdef NEBULA
  uniform vec3 uNebulaA;
  uniform vec3 uNebulaB;
  uniform float uNebula;
  #endif
  #ifdef BODY
  uniform vec3 uBodyDir;
  uniform float uBodySize;
  uniform vec3 uBodyColor;
  uniform vec3 uBodyAccent;
  uniform float uBodyRing;
  uniform float uBodyGlow;
  uniform int uBodyKind;
  #endif
  #ifdef CLOUDSEA
  uniform vec3 uCloudColor;
  uniform vec3 uCloudShade;
  uniform float uCloudSea;
  uniform float uCloudScale;
  #endif
  #ifdef AURORA
  uniform vec3 uAuroraA;
  uniform vec3 uAuroraB;
  uniform float uAurora;
  #endif
  #ifdef STORM
  uniform vec3 uStormColor;
  uniform float uStorm;
  #endif
  #ifdef RAYS
  uniform vec3 uRayColor;
  uniform float uRays;
  #endif
  #ifdef SPECKS
  uniform vec3 uSpeckColor;
  uniform float uSpecks;
  #endif
  #ifdef VEINS
  uniform vec3 uVeinColor;
  uniform vec3 uRockColor;
  uniform float uVeins;
  #endif
  ${NOISE}

  float starField(vec3 d, float scale, float density, float t) {
    vec3 g = d * scale;
    vec3 cell = floor(g);
    float h = hash13(cell);
    if (h < 1.0 - density) return 0.0;
    vec3 jitter = vec3(hash13(cell + 7.1), hash13(cell + 3.3), hash13(cell + 5.9)) * 0.6 + 0.2;
    float r = length(fract(g) - jitter);
    float twinkle = 0.65 + 0.35 * sin(t * (1.5 + h * 3.0) + h * 40.0);
    return smoothstep(0.16, 0.0, r) * twinkle;
  }

  void main() {
    vec3 d = normalize(vPos);
    float h = d.y * 0.5 + 0.5;
    vec3 col = mix(uBottom, uTop, smoothstep(0.42, 0.75, h));
    #ifdef HORIZON
    // nadir -> horizon -> zenith
    col = d.y < 0.0 ? mix(uHorizon, uBottom, smoothstep(0.0, 0.85, -d.y)) : mix(uHorizon, uTop, smoothstep(0.0, 0.6, d.y));
    #endif

    #ifdef NEBULA
    {
      float n = fbm(d * 2.2 + vec3(0.0, uTime * 0.004, 0.0));
      float m = fbm(d * 4.1 + 17.0);
      float cloud = smoothstep(0.42, 0.78, n);
      col += mix(uNebulaA, uNebulaB, smoothstep(0.3, 0.7, m)) * cloud * uNebula;
    }
    #endif

    #ifdef STARS
    {
      float s = starField(d, 150.0, 0.10 * uStars, uTime) + starField(d, 70.0, 0.045 * uStars, uTime * 0.7) * 1.4;
      col += uStarColor * s;
    }
    #endif

    #ifdef STORM
    {
      vec2 sp = d.xz / max(0.12, -d.y + 0.15);
      float n = fbm(vec3(sp * 1.6 + vec2(uTime * 0.05, uTime * 0.02), uTime * 0.015));
      float billow = smoothstep(0.32, 0.7, n);
      float rim = smoothstep(0.0, 0.1, n - fbm(vec3(sp * 1.6 + vec2(0.12, 0.2) + vec2(uTime * 0.05, uTime * 0.02), uTime * 0.015)));
      vec3 cloud = mix(uStormColor * 0.25, uStormColor * 2.4, billow * (0.35 + 0.65 * rim));
      col = mix(col, cloud, uStorm * (0.45 + 0.55 * billow));
      col += vec3(0.75, 0.82, 1.0) * uFlash * (0.2 + billow * 1.1);
    }
    #endif

    #ifdef CLOUDSEA
    if (d.y < -0.02) {
      vec2 uv = d.xz / max(0.08, -d.y) * uCloudScale * 3.2;
      vec2 drift = vec2(uTime * 0.03, uTime * 0.012);
      float n = fbm(vec3(uv + drift, uTime * 0.01));
      float puff = smoothstep(0.4, 0.62, n);
      // the sunward side of each billow is lit, the far side sits in shade
      float lit = smoothstep(0.0, 0.12, n - fbm(vec3(uv + drift + vec2(0.18, 0.25), uTime * 0.01)));
      vec3 cloud = mix(uCloudShade, uCloudColor, lit);
      float fade = smoothstep(0.0, 0.25, -d.y);
      col = mix(col, cloud, puff * fade * uCloudSea);
    }
    #endif

    #ifdef AURORA
    {
      // ribbons wandering across the dark below the island, shimmering along their length
      vec2 ap = d.xz / max(0.15, -d.y + 0.2);
      for (int i = 0; i < 3; i++) {
        float fi = float(i);
        float w = fbm(vec3(ap * (0.45 + fi * 0.12) + fi * 7.3, uTime * 0.04 + fi * 2.0));
        float line = abs(w - 0.5 + fi * 0.035);
        float ribbon = smoothstep(0.06, 0.0, line);
        float glow = smoothstep(0.2, 0.0, line) * 0.4;
        float shimmer = 0.6 + 0.4 * sin(ap.x * 9.0 - ap.y * 5.0 + uTime * 1.1 + fi * 2.1);
        col += mix(uAuroraA, uAuroraB, fi * 0.5) * (ribbon * shimmer + glow) * uAurora;
      }
    }
    #endif

    #ifdef RAYS
    {
      float ang = atan(d.x, d.z);
      float shaft = pow(max(0.0, sin(ang * 9.0 + sin(uTime * 0.2 + ang * 3.0) * 1.3)), 6.0);
      float fall = smoothstep(-0.9, 0.5, d.y);
      col += uRayColor * shaft * fall * uRays;
    }
    #endif

    #ifdef VEINS
    {
      // a cavern's walls: dark banded rock split by glowing crystal seams
      vec3 q = d * 7.0;
      float rock = fbm(q * 0.8);
      col = mix(col, uRockColor * (0.5 + rock * 1.0), 0.85);
      float seam = abs(fbm(q + 5.0) - 0.5);
      float fleck = smoothstep(0.55, 0.75, fbm(q * 0.6 + 9.0));
      col += uVeinColor * (smoothstep(0.012, 0.0, seam) * 1.2 + smoothstep(0.06, 0.0, seam) * 0.18) * fleck * uVeins;
    }
    #endif

    #ifdef SPECKS
    {
      float s = starField(d + vec3(0.0, sin(uTime * 0.05) * 0.01, 0.0), 45.0, 0.05 * uSpecks, uTime * 0.4);
      float halo = starField(d, 22.0, 0.03 * uSpecks, uTime * 0.3);
      col += uSpeckColor * (s * 1.6 + halo * 0.6);
    }
    #endif

    #ifdef BODY
    {
      vec3 bd = normalize(uBodyDir);
      float cosA = dot(d, bd);
      float ang = acos(clamp(cosA, -1.0, 1.0));
      float r = ang / uBodySize;
      // a basis on the body's face, so it can be shaded as a sphere
      vec3 t1 = normalize(cross(bd, abs(bd.y) > 0.9 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0)));
      vec3 t2 = cross(bd, t1);
      vec2 p = vec2(dot(d - bd * cosA, t1), dot(d - bd * cosA, t2)) / sin(uBodySize);
      float disc = smoothstep(1.0, 0.985, r);
      if (uBodyKind == 0 || uBodyKind == 3) {
        // planet / moon: lit from the upper left, banded or cratered
        float z = sqrt(max(0.0, 1.0 - dot(p, p)));
        vec3 n = vec3(p, z);
        float light = clamp(dot(n, normalize(vec3(-0.55, 0.6, 0.6))), 0.0, 1.0);
        float bands = uBodyKind == 0 ? fbm(vec3(p.y * 5.0, p.x * 0.6, 1.0)) : fbm(vec3(p * 3.5, 4.0));
        vec3 surf = mix(uBodyColor, uBodyAccent, smoothstep(0.35, 0.7, bands));
        vec3 lit = surf * (0.12 + light * 1.05) + uBodyColor * pow(1.0 - z, 3.0) * 0.35;
        // ring: a tilted ellipse, hidden where the planet stands in front of its far half
        if (uBodyRing > 0.0) {
          vec2 q = vec2(p.x * 0.94 + p.y * 0.34, (p.y * 0.94 - p.x * 0.34) * 3.4);
          float rr = length(q);
          float band = smoothstep(1.35, 1.42, rr) * smoothstep(2.25, 2.1, rr) * (0.6 + 0.4 * sin(rr * 40.0));
          float behind = (q.y < 0.0 && r < 1.0) ? 0.0 : 1.0;
          col = mix(col, uBodyAccent * 1.1, band * behind * uBodyRing * (r < 1.0 && q.y >= 0.0 ? 1.0 : 0.85));
          if (r < 1.0 && q.y >= 0.0 && band > 0.0) disc *= 1.0 - band * 0.9;
        }
        col = mix(col, lit, disc);
        col += uBodyColor * smoothstep(1.35, 1.0, r) * (1.0 - disc) * uBodyGlow;
      } else if (uBodyKind == 1) {
        // sun: a hot disc and a wide soft bloom
        col = mix(col, uBodyColor * 1.6, disc);
        col += uBodyAccent * exp(-max(0.0, r - 1.0) * 1.6) * uBodyGlow;
      } else {
        // eclipse: a black disc with a burning corona
        float corona = exp(-max(0.0, r - 1.0) * 4.2);
        float streak = 0.75 + 0.25 * fbm(vec3(atan(p.y, p.x) * 3.0, r * 2.0, uTime * 0.05));
        col += uBodyAccent * corona * streak * uBodyGlow * (1.0 - disc);
        col = mix(col, uBodyColor, disc);
        col += uBodyAccent * smoothstep(0.93, 1.0, r) * disc * 1.4;
      }
    }
    #endif

    #ifdef SKY_SRGB
    // a painted sky is authored in the colours it should show, not in light
    col = pow(max(col, vec3(0.0)), vec3(1.0 / 2.2));
    #endif
    gl_FragColor = vec4(col, 1.0);
  }
`

const VERTEX = /* glsl */`
  varying vec3 vPos;
  void main() {
    vPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const color = (c: number) => new THREE.Color(c)

/** the dome for a theme; `sky` absent is the campaign's plain gradient */
export function skyMaterial(top: number, bottom: number, sky?: SkyDef): THREE.ShaderMaterial {
  const defines: Record<string, string> = {}
  const uniforms: Record<string, THREE.IUniform> = {
    uTop: { value: color(top) },
    uBottom: { value: color(bottom) },
    uTime: { value: 0 },
    uFlash: { value: 0 },
  }
  // The campaign's dome has always written linear colour straight to the
  // screen, and its palettes were tuned that way; only a painted sky is
  // converted, so no existing board changes shade.
  if (sky) defines.SKY_SRGB = ''
  if (sky?.horizon !== undefined) { defines.HORIZON = ''; uniforms.uHorizon = { value: color(sky.horizon) } }
  if (sky?.stars) {
    defines.STARS = ''
    uniforms.uStars = { value: sky.stars }
    uniforms.uStarColor = { value: color(sky.starColor ?? 0xffffff) }
  }
  if (sky?.nebula) {
    defines.NEBULA = ''
    uniforms.uNebulaA = { value: color(sky.nebula.a) }
    uniforms.uNebulaB = { value: color(sky.nebula.b) }
    uniforms.uNebula = { value: sky.nebula.strength }
  }
  if (sky?.body) {
    const b = sky.body
    defines.BODY = ''
    uniforms.uBodyDir = { value: new THREE.Vector3(...b.dir).normalize() }
    uniforms.uBodySize = { value: b.size }
    uniforms.uBodyColor = { value: color(b.color) }
    uniforms.uBodyAccent = { value: color(b.accent ?? b.color) }
    uniforms.uBodyRing = { value: b.ring ?? 0 }
    uniforms.uBodyGlow = { value: b.glow ?? 0.4 }
    uniforms.uBodyKind = { value: { planet: 0, sun: 1, eclipse: 2, moon: 3 }[b.kind] }
  }
  if (sky?.cloudSea) {
    defines.CLOUDSEA = ''
    uniforms.uCloudColor = { value: color(sky.cloudSea.color) }
    uniforms.uCloudShade = { value: color(sky.cloudSea.shade) }
    uniforms.uCloudSea = { value: sky.cloudSea.strength }
    uniforms.uCloudScale = { value: sky.cloudSea.scale ?? 1 }
  }
  if (sky?.aurora) {
    defines.AURORA = ''
    uniforms.uAuroraA = { value: color(sky.aurora.a) }
    uniforms.uAuroraB = { value: color(sky.aurora.b) }
    uniforms.uAurora = { value: sky.aurora.strength }
  }
  if (sky?.storm) {
    defines.STORM = ''
    uniforms.uStormColor = { value: color(sky.storm.color) }
    uniforms.uStorm = { value: sky.storm.strength }
  }
  if (sky?.rays) {
    defines.RAYS = ''
    uniforms.uRayColor = { value: color(sky.rays.color) }
    uniforms.uRays = { value: sky.rays.strength }
  }
  if (sky?.veins) {
    defines.VEINS = ''
    uniforms.uRockColor = { value: color(sky.veins.rock) }
    uniforms.uVeinColor = { value: color(sky.veins.color) }
    uniforms.uVeins = { value: sky.veins.strength }
  }
  if (sky?.specks) {
    defines.SPECKS = ''
    uniforms.uSpeckColor = { value: color(sky.specks.color) }
    uniforms.uSpecks = { value: sky.specks.density }
  }
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    defines,
    uniforms,
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
  })
}
