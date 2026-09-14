import * as env from '../voxel/models_env.ts'
import * as fx from '../voxel/models_frontier.ts'
import { skyMaterial } from '../core/sky.ts'
import { skyRegistry } from '../core/skyRegistry.ts'
import { FRONTIER_DECOR, THEMES, sceneryHooks, type ThemeColors } from './terrain.ts'
import type { ThemeId } from './types.ts'
import { frontierWeather, type WeatherFn } from './frontierWeather.ts'

/**
 * Everything the Frontier's boards look like, installed when they load: ten
 * themes and their painted skies, the props that grow on them, their
 * set-pieces and the colours of their gates and keeps. Loaded with the boards
 * (frontier.ts imports this), never with the campaign.
 */

const themes: Partial<Record<ThemeId, ThemeColors>> = {
  // Each of these is seen as much as it is played on: the sky is painted below
  // the horizon, where the play camera actually looks, and the island is lit to
  // stand clear of it.

  // spring terraces at golden hour, above a pink cloud sea
  blossom: {
    grass: 0x8fc26a, grassAlt: 0x82b65e, dirt: 0x7a5a44, road: 0xe6d5b0, roadAlt: 0xdac9a2,
    waterDeep: 0x3f86b0, waterShallow: 0x7fc6dd, waterGlow: 0,
    skyTop: 0x8fb8e8, skyBottom: 0xe9a8c4, fog: 0xf2d5dc,
    sunColor: 0xffe6c8, sunIntensity: 2.5, hemiSky: 0xffdbe8, hemiGround: 0x6f8f55, ambient: 0.3,
    roadWall: 0xc2ae90, bridge: 'wood', clouds: 0xffe4ee,
    sky: {
      horizon: 0xffd9c2,
      cloudSea: { color: 0xfff3f6, shade: 0xe7a0bf, strength: 0.95, scale: 0.9 },
    },
  },
  // sand and a turquoise pool under a white-hot sky
  desert: {
    grass: 0xe2c283, grassAlt: 0xd9b774, dirt: 0xb08250, road: 0xa07c55, roadAlt: 0x95724c,
    waterDeep: 0x178fa0, waterShallow: 0x52d6c8, waterGlow: 0,
    skyTop: 0x3c8fd8, skyBottom: 0xd9a86a, fog: 0xf0dcb0,
    sunColor: 0xfff1d6, sunIntensity: 2.7, hemiSky: 0xcfe3ff, hemiGround: 0xb08a55, ambient: 0.27,
    roadWall: 0xb88e5e, bridge: 'wood', waterBed: 0xe8d49c, bedrock: 0x9c6f45,
    sky: {
      horizon: 0xf7e2b6,
      cloudSea: { color: 0xf3d7a0, shade: 0xb9864e, strength: 0.75, scale: 0.55 },
      body: { kind: 'sun', dir: [-0.5, -0.8, -1], size: 0.035, color: 0xffffff, accent: 0xffe2a8, glow: 0.8 },
    },
  },
  // meadows adrift above a white cloud sea
  skyreach: {
    grass: 0x7cc46a, grassAlt: 0x6fb85e, dirt: 0x8a6a4a, road: 0xdcc79c, roadAlt: 0xd0bb90,
    waterDeep: 0x3d8fd0, waterShallow: 0x7fd0f0, waterGlow: 0,
    skyTop: 0x4a9ae8, skyBottom: 0x9fc8f0, fog: 0xcfe9ff,
    sunColor: 0xfff6e0, sunIntensity: 2.7, hemiSky: 0xd8ecff, hemiGround: 0x7aa060, ambient: 0.3,
    roadWall: 0xb8a684, bridge: 'wood', bedrock: 0x8a7a66,
    sky: {
      horizon: 0xe6f4ff,
      cloudSea: { color: 0xffffff, shade: 0xa9c0e0, strength: 1, scale: 1.1 },
    },
  },
  // a coral atoll over open ocean at the end of the day
  reef: {
    grass: 0xead9a6, grassAlt: 0xe0cd98, dirt: 0xb89a6a, road: 0xbf9f7e, roadAlt: 0xb49575,
    waterDeep: 0x14a0b4, waterShallow: 0x6fe8dc, waterGlow: 0,
    skyTop: 0x5f9fd8, skyBottom: 0x0f5e7a, fog: 0x9fd6d8,
    sunColor: 0xfff0d8, sunIntensity: 2.5, hemiSky: 0xbfeef0, hemiGround: 0x8a9a70, ambient: 0.32,
    roadWall: 0xd8c8a8, bridge: 'wood', waterBed: 0xf2e6c0, bedrock: 0x8a8a78,
    raised: { top: 0xe8a090, alt: 0xf0b8a2, wall: 0xc8806e },
    sky: {
      horizon: 0xffe2bf,
      cloudSea: { color: 0x7fe6dc, shade: 0x0e5a78, strength: 0.9, scale: 0.5 },
    },
  },
  // a crystal cavern: dark rock, glowing pools, glowworms overhead and below
  cavern: {
    grass: 0x5a5e70, grassAlt: 0x525667, dirt: 0x34343f, road: 0x7a7590, roadAlt: 0x716c86,
    waterDeep: 0x1a5f8f, waterShallow: 0x4fd8ff, waterGlow: 0.6,
    skyTop: 0x0a0a14, skyBottom: 0x0b0a18, fog: 0x141626,
    sunColor: 0xc4dcff, sunIntensity: 1.9, hemiSky: 0x7a8ac8, hemiGround: 0x2a2438, ambient: 0.5,
    roadWall: 0x44445a, bridge: 'crystal', bridgeRail: 0x9ff6ff, waterBed: 0x3a3a50, bedrock: 0x2a2a34, clouds: 'none',
    raised: { top: 0x6a6784, alt: 0x625f7c, wall: 0x403d52 },
    sky: {
      horizon: 0x141a30,
      veins: { rock: 0x2c2838, color: 0x5ff0ff, strength: 0.9 },
      specks: { color: 0x9fffe0, density: 1 },
    },
  },
  // asteroids strung together by light, a ringed giant in the abyss
  cosmos: {
    grass: 0x928eaa, grassAlt: 0x86829e, dirt: 0x4a4660, road: 0x5f6f96, roadAlt: 0x58688e,
    waterDeep: 0x3a1a8f, waterShallow: 0xa07aff, waterGlow: 1,
    skyTop: 0x05040c, skyBottom: 0x07061a, fog: 0x0c0a1a,
    sunColor: 0xe6ecff, sunIntensity: 2.5, hemiSky: 0x9a9ae0, hemiGround: 0x3a3450, ambient: 0.36,
    roadWall: 0x3c4a6a, bridge: 'energy', bridgeRail: 0x7fe8ff, bedrock: 0x3c3850, clouds: 'asteroids',
    sky: {
      horizon: 0x100c24,
      stars: 1,
      nebula: { a: 0x6a2fbf, b: 0x1f7fbf, strength: 0.5 },
      body: { kind: 'planet', dir: [0.45, -0.95, -1], size: 0.24, color: 0xd98f5a, accent: 0xf2d6a8, ring: 0.9, glow: 0.35 },
    },
  },
  // a drowned temple under a canopy of mist
  jungle: {
    grass: 0x4f9a3f, grassAlt: 0x468c38, dirt: 0x5a4632, road: 0xb8b08f, roadAlt: 0xaca485,
    waterDeep: 0x2f6f60, waterShallow: 0x5fb8a0, waterGlow: 0,
    skyTop: 0x6fa8a0, skyBottom: 0x5f8f6a, fog: 0xb8d0b0,
    sunColor: 0xfff0c8, sunIntensity: 2.3, hemiSky: 0xc8e8c0, hemiGround: 0x3f6a38, ambient: 0.34,
    roadWall: 0x8f8a70, bridge: 'wood', bedrock: 0x5a5040,
    raised: { top: 0xb5ae8e, alt: 0x93a06e, wall: 0x8a8468 },
    sky: {
      horizon: 0xd8e8c4,
      cloudSea: { color: 0xf2f8e8, shade: 0x6f9a72, strength: 0.9, scale: 0.7 },
    },
  },
  // a glacier at midnight under the aurora
  aurora: {
    grass: 0xdfeaf2, grassAlt: 0xd0dfea, dirt: 0x8a9aaa, road: 0x9fb4c8, roadAlt: 0x94aabf,
    waterDeep: 0x2a5f8f, waterShallow: 0x7fc8e8, waterGlow: 0,
    skyTop: 0x040a1a, skyBottom: 0x06122a, fog: 0x1a3050,
    sunColor: 0xcfe4ff, sunIntensity: 2.1, hemiSky: 0x8fb8e8, hemiGround: 0x5a6a80, ambient: 0.42,
    roadWall: 0xa8bed2, bridge: 'crystal', bridgeRail: 0xcff4ff, waterBed: 0x9fb8cc, bedrock: 0x5a7090, clouds: 'none',
    sky: {
      horizon: 0x0f2a44,
      stars: 0.7,
      aurora: { a: 0x3fffb0, b: 0x9f6fff, strength: 0.9 },
    },
  },
  // a bastion in the eye of a thunderstorm
  storm: {
    grass: 0x66776e, grassAlt: 0x5c6c64, dirt: 0x3f4440, road: 0x8a8f96, roadAlt: 0x80858c,
    waterDeep: 0x2a3f5a, waterShallow: 0x5a7a9a, waterGlow: 0,
    skyTop: 0x1a2230, skyBottom: 0x222c3a, fog: 0x3a4452,
    sunColor: 0xd0dcf0, sunIntensity: 2.0, hemiSky: 0x9aaac8, hemiGround: 0x3a4238, ambient: 0.44,
    roadWall: 0x60646c, bridge: 'stone', bedrock: 0x3a3e44, clouds: 0x566070,
    raised: { top: 0x858a92, alt: 0x7b8088, wall: 0x5c6068 }, battlements: 0x6e727a,
    sky: {
      horizon: 0x3a4658,
      storm: { color: 0x4a5566, strength: 0.9 },
      lightning: true,
    },
  },
  // the hour the sun went out: dusk, a black sun, a golden corona
  eclipse: {
    grass: 0x7d7494, grassAlt: 0x736a8a, dirt: 0x3f3552, road: 0xd2c9b2, roadAlt: 0xc5bca4,
    waterDeep: 0x8a5a14, waterShallow: 0xffc36a, waterGlow: 1,
    skyTop: 0x0d0a1f, skyBottom: 0x1f1236, fog: 0x3a2a4a,
    sunColor: 0xffdcae, sunIntensity: 2.2, hemiSky: 0x9a80d0, hemiGround: 0x3a2f48, ambient: 0.4,
    roadWall: 0x5a4f70, bridge: 'energy', bridgeRail: 0xffc36a, bedrock: 0x2e2640, clouds: 0x6a5a86,
    sky: {
      horizon: 0x6a2f4a,
      stars: 0.5,
      body: { kind: 'eclipse', dir: [-0.3, -0.95, -1], size: 0.17, color: 0x040206, accent: 0xffc36a, glow: 1.2 },
    },
  },
}
Object.assign(THEMES, themes)

const decor: typeof FRONTIER_DECOR = {
  blossom: { near: 0.08, far: 0.3, props: [
    { weight: 5, make: fx.blossomTree }, { weight: 2, make: env.bush }, { weight: 2, make: env.flowers },
    { weight: 1.2, make: fx.stoneLantern }, { weight: 1, make: env.rock },
  ] },
  desert: { near: 0.05, far: 0.2, props: [
    { weight: 3, make: fx.cactus }, { weight: 3, make: fx.duneRock }, { weight: 2, make: fx.palmTree },
    { weight: 0.8, make: env.deadTree },
  ] },
  skyreach: { near: 0.08, far: 0.28, props: [
    { weight: 3, make: env.roundTree }, { weight: 2, make: env.pineTree }, { weight: 2.5, make: env.flowers },
    { weight: 2, make: env.bush }, { weight: 1, make: env.rock },
  ] },
  reef: { near: 0.06, far: 0.24, props: [
    { weight: 4, make: fx.coral }, { weight: 2, make: fx.palmTree }, { weight: 2, make: fx.seaShell },
    { weight: 1, make: env.rock },
  ] },
  cavern: { near: 0.06, far: 0.26, props: [
    { weight: 3, make: rng => fx.glowCrystal(rng), animated: true }, { weight: 3, make: fx.glowMushroom },
    { weight: 3, make: fx.stalagmite }, { weight: 1, make: env.rock },
  ] },
  cosmos: { near: 0.05, far: 0.22, props: [
    { weight: 3, make: fx.moonRock }, { weight: 2.2, make: fx.crater },
    { weight: 2, make: rng => fx.glowCrystal(rng, [0x7fe8ff, 0xb37aff]), animated: true }, { weight: 2, make: fx.alienBulb },
  ] },
  jungle: { near: 0.07, far: 0.32, props: [
    { weight: 4, make: fx.jungleTree }, { weight: 3, make: fx.fern }, { weight: 1.5, make: env.bush },
    { weight: 1.2, make: rng => fx.brokenPillar(rng) }, { weight: 1, make: env.flowers },
  ] },
  aurora: { near: 0.05, far: 0.22, props: [
    { weight: 4, make: fx.snowPine }, { weight: 3, make: fx.iceSpike }, { weight: 2, make: env.rock },
  ] },
  storm: { near: 0.05, far: 0.22, props: [
    { weight: 3, make: env.deadTree }, { weight: 3, make: env.rock }, { weight: 1.2, make: fx.lightningRod },
    { weight: 1.2, make: fx.tatteredBanner }, { weight: 1.2, make: rng => fx.brokenPillar(rng, 0x80848c) },
  ] },
  eclipse: { near: 0.05, far: 0.22, props: [
    { weight: 3, make: fx.obsidianShard, animated: true }, { weight: 2.5, make: fx.silverTree },
    { weight: 2, make: fx.moonRock }, { weight: 1, make: rng => fx.brokenPillar(rng, 0xcfc6b0) },
  ] },
}
Object.assign(FRONTIER_DECOR, decor)

sceneryHooks.asteroid = fx.moonRock
env.frontierHooks.landmark = fx.frontierLandmark
Object.assign(env.frontierHooks.heights, fx.FRONTIER_LANDMARK_HEIGHT)
Object.assign(env.frontierHooks.portal, fx.PORTAL_PALETTE)
Object.assign(env.frontierHooks.castle, fx.CASTLE_PALETTE)
skyRegistry.paint = skyMaterial

const weather: Partial<Record<ThemeId, WeatherFn>> = {
  blossom: (particles, dt, rx, rz) => {
    // petals on the wind, and now and then a lantern rising off the terraces
    if (Math.random() < dt * 9) {
      particles.normal.emit({
        x: rx(), y: 2 + Math.random() * 1.8, z: rz(), count: 1,
        color: [0xf6b8cf, 0xfbd3e0, 0xe98fb4], speed: 0.25, gravity: 0.1, drag: 0.05,
        life: 6, size: 0.1, sizeEnd: 0.08, dirY: 0.1, spread: 0.4,
      })
    }
    if (Math.random() < dt * 0.9) {
      particles.add.emit({
        x: rx(), y: 0.4, z: rz(), count: 1,
        color: 0xffb35a, speed: 0.04, gravity: -0.16, drag: 0.02,
        life: 8, size: 0.2, sizeEnd: 0.14, dirY: 1, spread: 0.1,
      })
    }
  },
  desert: (particles, dt, rx, rz) => {
    if (Math.random() < dt * 14) {
      particles.normal.emit({
        x: rx(), y: 0.15 + Math.random() * 0.6, z: rz(), count: 1,
        color: [0xf2d8a0, 0xe0bf85], speed: 0.6, gravity: 0.02, drag: 0.05,
        life: 3, size: 0.06, sizeEnd: 0.03, dirY: 0.05, spread: 0.6,
      })
    }
  },
  skyreach: (particles, dt, rx, rz) => {
    if (Math.random() < dt * 4) {
      particles.add.emit({
        x: rx(), y: 1 + Math.random() * 2, z: rz(), count: 1,
        color: [0xffffff, 0xfff4c8], speed: 0.08, gravity: -0.04, drag: 0.1,
        life: 5, size: 0.08, sizeEnd: 0.02, dirY: 0.4, spread: 0.3,
      })
    }
  },
  reef: (particles, dt, rx, rz) => {
    if (Math.random() < dt * 6) {
      particles.add.emit({
        x: rx(), y: 0.3 + Math.random(), z: rz(), count: 1,
        color: [0xbff8ff, 0xffffff], speed: 0.1, gravity: -0.05, drag: 0.1,
        life: 4, size: 0.07, sizeEnd: 0.02, dirY: 0.6, spread: 0.4,
      })
    }
  },
  cavern: (particles, dt, rx, rz) => {
    // spores lifting off the glowing caps
    if (Math.random() < dt * 14) {
      particles.add.emit({
        x: rx(), y: 0.2, z: rz(), count: 1,
        color: [0x7fffd4, 0x9fd8ff, 0xd28cff], speed: 0.06, gravity: -0.18, drag: 0.2,
        life: 6, size: 0.1, sizeEnd: 0.02, dirY: 0.9, spread: 0.3,
      })
    }
  },
  cosmos: (particles, dt, rx, rz) => {
    if (Math.random() < dt * 10) {
      particles.add.emit({
        x: rx(), y: 0.2 + Math.random() * 2.5, z: rz(), count: 1,
        color: [0xffffff, 0x9fe8ff, 0xd8b8ff], speed: 0.03, gravity: -0.01, drag: 0.05,
        life: 5, size: 0.09, sizeEnd: 0.01, dirY: 0.5, spread: 0.4,
      })
    }
  },
  jungle: (particles, dt, rx, rz) => {
    if (Math.random() < dt * 9) {
      particles.add.emit({
        x: rx(), y: 0.3 + Math.random() * 0.9, z: rz(), count: 1,
        color: [0xe8ff8f, 0xb8ff7f], speed: 0.1, gravity: -0.05, drag: 0.1,
        life: 4.5, size: 0.1, sizeEnd: 0.02, dirY: 0.5, spread: 0.25,
      })
    }
  },
  aurora: (particles, dt, rx, rz) => {
    if (Math.random() < dt * 18) {
      particles.normal.emit({
        x: rx(), y: 3 + Math.random() * 2, z: rz(), count: 1,
        color: 0xffffff, speed: 0.05, gravity: 0.35, drag: 0.25,
        life: 6, lifeVar: 0.2, size: 0.11, sizeEnd: 0.09, dirY: 0.1, spread: 0.3,
      })
    }
  },
  storm: (particles, dt, rx, rz) => {
    // driving rain
    if (Math.random() < dt * 60) {
      particles.normal.emit({
        x: rx(), y: 3.5 + Math.random(), z: rz(), count: 1,
        color: [0xaebcd0, 0xc8d4e4], speed: 0.4, gravity: 9, drag: 0,
        life: 0.9, size: 0.05, sizeEnd: 0.05, dirY: -1, spread: 0.2,
      })
    }
  },
  eclipse: (particles, dt, rx, rz) => {
    if (Math.random() < dt * 9) {
      particles.add.emit({
        x: rx(), y: 0.1, z: rz(), count: 1,
        color: [0xffc36a, 0xffe2a8, 0x9a80d0], speed: 0.08, gravity: -0.25, drag: 0.15,
        life: 4.5, size: 0.09, sizeEnd: 0.02, dirY: 0.85, spread: 0.3,
      })
    }
  },
}
Object.assign(frontierWeather, weather)
