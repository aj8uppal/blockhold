import { VoxModel, VoxBox, box } from './builder.ts'

/**
 * Unit models. Authored in voxel units (1 vu = 0.1 world), y-up from ground,
 * facing +Z. Parts follow a convention the animator understands:
 *   legL/legR (pivot hip), armL/armR (pivot shoulder), head (pivot neck),
 *   body, wingL/wingR, legsL/legsR (spiders), tail.
 */

export interface HumanoidOpts {
  skin: number
  shirt: number
  pants: number
  hair?: number
  helmet?: number       // color; also adds crest for knights
  helmetCrest?: number
  shield?: number
  shieldTrim?: number
  weapon?: 'sword' | 'axe' | 'spear' | 'bow' | 'staff' | 'club' | 'none'
  weaponGlow?: number   // staff orb color
  cape?: number
  tabard?: number       // chest overlay color
  zombie?: boolean      // torn look
  beard?: number
  scale?: number
}

export function humanoid(o: HumanoidOpts): VoxModel {
  const s = o.scale ?? 0.1
  const legL: VoxBox[] = [box(-0.62, 0.8, 0, 1.05, 1.6, 1.05, o.pants)]
  const legR: VoxBox[] = [box(0.62, 0.8, 0, 1.05, 1.6, 1.05, o.pants)]
  const body: VoxBox[] = [box(0, 2.6, 0, 2.5, 2.0, 1.5, o.shirt)]
  if (o.tabard) body.push(box(0, 2.55, 0.05, 1.4, 1.9, 1.55, o.tabard))
  if (o.cape) body.push(box(0, 2.5, -0.85, 2.3, 2.6, 0.35, o.cape))
  if (o.zombie) {
    body.push(box(0.6, 2.1, 0.75, 0.8, 0.7, 0.12, o.skin)) // torn shirt, exposed skin
  }
  const head: VoxBox[] = [box(0, 4.5, 0, 1.8, 1.8, 1.8, o.skin)]
  // simple face: eyes
  const eye = o.zombie ? 0xd8e64f : 0x2a2a33
  head.push(box(-0.42, 4.7, 0.92, 0.32, 0.32, 0.1, eye))
  head.push(box(0.42, 4.7, 0.92, 0.32, 0.32, 0.1, eye))
  if (o.beard) head.push(box(0, 3.95, 0.85, 1.3, 0.9, 0.3, o.beard))
  if (o.helmet) {
    head.push(box(0, 5.2, 0, 2.0, 0.7, 2.0, o.helmet))
    head.push(box(0, 4.75, -0.15, 2.0, 0.6, 1.9, o.helmet))
    head.push(box(0, 4.6, 0.98, 0.5, 1.1, 0.14, o.helmet)) // nose guard
    if (o.helmetCrest) head.push(box(0, 5.75, 0, 0.4, 0.7, 1.6, o.helmetCrest))
  } else if (o.hair) {
    head.push(box(0, 5.35, 0, 1.9, 0.5, 1.9, o.hair))
    head.push(box(0, 4.8, -0.95, 1.9, 1.4, 0.25, o.hair))
  }
  const armL: VoxBox[] = [
    box(-1.55, 2.7, 0, 0.85, 1.9, 0.85, o.shirt),
    box(-1.55, 1.65, 0, 0.8, 0.5, 0.8, o.skin),
  ]
  const armR: VoxBox[] = [
    box(1.55, 2.7, 0, 0.85, 1.9, 0.85, o.shirt),
    box(1.55, 1.65, 0, 0.8, 0.5, 0.8, o.skin),
  ]
  if (o.shield) {
    armL.push(box(-2.15, 2.6, 0.3, 0.3, 2.4, 1.9, o.shield))
    armL.push(box(-2.32, 2.6, 0.3, 0.12, 1.2, 0.9, o.shieldTrim ?? 0xd8b64a))
  }
  switch (o.weapon ?? 'none') {
    case 'sword':
      armR.push(box(1.55, 3.1, 0.75, 0.28, 2.6, 0.28, 0xc8cdd6)) // blade up
      armR.push(box(1.55, 1.85, 0.75, 0.85, 0.25, 0.4, 0x7a5a30)) // guard
      break
    case 'axe':
      armR.push(box(1.55, 2.9, 0.75, 0.3, 2.8, 0.3, 0x7a5a30))
      armR.push(box(1.55, 3.9, 1.15, 0.34, 1.0, 1.1, 0xb7bcc4))
      break
    case 'spear':
      armR.push(box(1.55, 3.2, 0.75, 0.26, 4.4, 0.26, 0x8a6a3c))
      armR.push(box(1.55, 5.55, 0.75, 0.4, 0.9, 0.4, 0xc8cdd6))
      break
    case 'bow':
      armL.push(box(-1.6, 2.7, 1.0, 0.25, 2.6, 0.25, 0x7a5a30))
      armL.push(box(-1.6, 3.95, 0.8, 0.25, 0.3, 0.5, 0x7a5a30))
      armL.push(box(-1.6, 1.45, 0.8, 0.25, 0.3, 0.5, 0x7a5a30))
      break
    case 'staff':
      armR.push(box(1.55, 3.0, 0.75, 0.3, 4.2, 0.3, 0x5a4028))
      armR.push(box(1.55, 5.3, 0.75, 0.7, 0.7, 0.7, o.weaponGlow ?? 0x8f5aff, true))
      break
    case 'club':
      armR.push(box(1.55, 3.0, 0.75, 0.5, 2.4, 0.5, 0x6d4c28))
      armR.push(box(1.55, 4.3, 0.75, 1.1, 1.1, 1.1, 0x5a3f22))
      break
  }
  return {
    scale: s,
    parts: { body, head, legL, legR, armL, armR },
    pivots: {
      head: [0, 3.6, 0],
      legL: [-0.62, 1.6, 0], legR: [0.62, 1.6, 0],
      armL: [-1.55, 3.5, 0], armR: [1.55, 3.5, 0],
    },
  }
}

// ---------- enemy palette ----------
const P = {
  zombieSkin: 0x8fc457, zombieShirt: 0x7a5f8f, zombiePants: 0x4a4455,
  impSkin: 0xc4523a, impDark: 0x8a3527,
  steel: 0x9aa2ae, steelDark: 0x5c6470, knightTunic: 0x4a4f6b,
  cultRobe: 0x6a3f8f, cultTrim: 0xc9a0ff, cultDark: 0x452a61,
  warRobe: 0x2f2b3f, warTrim: 0x8f2f4f,
  gargoyle: 0x8f93b8, gargoyleDark: 0x62668a, wing: 0x494d70,
  bruteSkin: 0x6f8f3f, bruteDark: 0x55702e, brutePants: 0x6d4c28,
  spider: 0x3d3348, spiderDark: 0x2a2233, spiderRed: 0xd8452f,
  jugArmor: 0x3f434f, jugTrim: 0x8f2f2f, jugGlow: 0xff5a3c,
  kingFlesh: 0x9ab86a, kingDark: 0x6b8347, kingCrown: 0xe8b23c,
  kingBanner: 0x7a2f3f, kingBone: 0xe8e2cc,
}

export function huskModel(): VoxModel {
  return humanoid({ skin: P.zombieSkin, shirt: P.zombieShirt, pants: P.zombiePants, zombie: true, hair: 0x46543a })
}

export function shieldGruntModel(): VoxModel {
  return humanoid({
    skin: 0xd9a066, shirt: P.knightTunic, pants: P.steelDark,
    helmet: P.steel, shield: 0x7a2f2f, shieldTrim: 0xd8b64a, weapon: 'sword',
  })
}

export function acolyteModel(): VoxModel {
  const robe: VoxBox[] = [
    box(0, 1.1, 0, 2.6, 2.2, 1.9, P.cultRobe),
    box(0, 2.8, 0, 2.2, 1.4, 1.6, P.cultRobe),
    box(0, 1.15, 0.95, 0.7, 2.1, 0.14, P.cultTrim),
  ]
  const head: VoxBox[] = [
    box(0, 4.3, 0, 1.7, 1.7, 1.7, P.cultDark),
    box(0, 5.05, 0, 1.9, 0.6, 1.9, P.cultRobe),   // hood
    box(0, 4.45, -0.4, 1.9, 1.3, 1.4, P.cultRobe),
    box(-0.35, 4.4, 0.82, 0.3, 0.3, 0.12, 0xdd6bff, true),
    box(0.35, 4.4, 0.82, 0.3, 0.3, 0.12, 0xdd6bff, true),
  ]
  const armL: VoxBox[] = [box(-1.5, 2.5, 0.3, 0.8, 1.7, 0.8, P.cultRobe)]
  const armR: VoxBox[] = [
    box(1.5, 2.5, 0.3, 0.8, 1.7, 0.8, P.cultRobe),
    box(1.5, 3.6, 0.7, 0.55, 0.55, 0.55, 0xdd6bff, true), // channeling orb
  ]
  return {
    parts: { body: robe, head, armL, armR },
    pivots: { head: [0, 3.5, 0], armL: [-1.5, 3.3, 0.3], armR: [1.5, 3.3, 0.3] },
  }
}

export function warlockModel(): VoxModel {
  const m = humanoid({
    skin: 0xb9c2b5, shirt: P.warRobe, pants: P.warRobe,
    weapon: 'staff', weaponGlow: 0xff4f6b, hair: 0x1e1b26, cape: P.warTrim,
  })
  m.parts.body.push(box(0, 1.0, 0, 2.7, 1.4, 1.8, P.warRobe)) // robe skirt
  return m
}

export function gargoyleModel(): VoxModel {
  const body: VoxBox[] = [
    box(0, 3.4, 0, 2.2, 1.7, 1.5, P.gargoyle),
    box(0, 2.4, 0.2, 1.4, 0.7, 1.0, P.gargoyleDark),   // tucked legs
    box(-0.5, 2.0, 0.5, 0.5, 0.6, 0.5, P.gargoyleDark),
    box(0.5, 2.0, 0.5, 0.5, 0.6, 0.5, P.gargoyleDark),
    box(0, 3.2, -1.1, 0.5, 0.5, 1.2, P.gargoyleDark),   // tail
  ]
  const head: VoxBox[] = [
    box(0, 4.6, 0.4, 1.5, 1.3, 1.4, P.gargoyle),
    box(-0.45, 5.4, 0.2, 0.35, 0.7, 0.35, P.gargoyleDark), // horns
    box(0.45, 5.4, 0.2, 0.35, 0.7, 0.35, P.gargoyleDark),
    box(-0.35, 4.7, 1.05, 0.28, 0.28, 0.14, 0xffd23c, true),
    box(0.35, 4.7, 1.05, 0.28, 0.28, 0.14, 0xffd23c, true),
    box(0, 4.25, 1.1, 0.7, 0.4, 0.3, P.gargoyleDark),   // snout
  ]
  const wingL: VoxBox[] = [
    box(-1.9, 3.9, -0.3, 1.6, 0.35, 1.2, P.wing),
    box(-3.2, 4.1, -0.3, 1.3, 0.3, 2.0, P.wing),
  ]
  const wingR: VoxBox[] = [
    box(1.9, 3.9, -0.3, 1.6, 0.35, 1.2, P.wing),
    box(3.2, 4.1, -0.3, 1.3, 0.3, 2.0, P.wing),
  ]
  return {
    parts: { body, head, wingL, wingR },
    pivots: { head: [0, 4.0, 0.3], wingL: [-1.1, 3.9, -0.3], wingR: [1.1, 3.9, -0.3] },
  }
}

export function sprinterModel(): VoxModel {
  // lean four-legged hellhound
  const body: VoxBox[] = [
    box(0, 2.2, -0.2, 1.5, 1.3, 3.2, P.impSkin),
    box(0, 2.9, -1.4, 1.1, 0.5, 1.1, P.impDark),      // haunch
    box(0, 2.6, -2.1, 0.4, 0.4, 1.4, P.impDark),      // tail
  ]
  const head: VoxBox[] = [
    box(0, 2.7, 1.8, 1.3, 1.1, 1.3, P.impSkin),
    box(0, 2.45, 2.6, 0.8, 0.55, 0.7, P.impDark),     // muzzle
    box(-0.35, 3.0, 2.4, 0.24, 0.24, 0.12, 0xffd23c, true),
    box(0.35, 3.0, 2.4, 0.24, 0.24, 0.12, 0xffd23c, true),
    box(-0.4, 3.5, 1.6, 0.3, 0.6, 0.3, P.impDark),    // ears
    box(0.4, 3.5, 1.6, 0.3, 0.6, 0.3, P.impDark),
  ]
  const legFL: VoxBox[] = [box(-0.55, 0.8, 1.0, 0.55, 1.6, 0.55, P.impDark)]
  const legFR: VoxBox[] = [box(0.55, 0.8, 1.0, 0.55, 1.6, 0.55, P.impDark)]
  const legBL: VoxBox[] = [box(-0.55, 0.8, -1.2, 0.55, 1.6, 0.55, P.impDark)]
  const legBR: VoxBox[] = [box(0.55, 0.8, -1.2, 0.55, 1.6, 0.55, P.impDark)]
  return {
    parts: { body, head, legFL, legFR, legBL, legBR },
    pivots: {
      head: [0, 2.6, 1.4],
      legFL: [-0.55, 1.6, 1.0], legFR: [0.55, 1.6, 1.0],
      legBL: [-0.55, 1.6, -1.2], legBR: [0.55, 1.6, -1.2],
    },
  }
}

export function bruteModel(): VoxModel {
  const body: VoxBox[] = [
    box(0, 3.6, 0, 4.2, 3.0, 2.8, P.bruteSkin),
    box(0, 2.4, 0.3, 3.6, 1.4, 2.6, P.bruteDark),      // belly wrap
    box(0, 4.9, 0, 3.4, 0.6, 2.4, P.bruteDark),        // shoulder strap
  ]
  const head: VoxBox[] = [
    box(0, 6.1, 0.3, 2.2, 1.9, 2.0, P.bruteSkin),
    box(-0.5, 6.3, 1.32, 0.36, 0.36, 0.12, 0x2a2a33),
    box(0.5, 6.3, 1.32, 0.36, 0.36, 0.12, 0x2a2a33),
    box(0, 5.6, 1.25, 1.2, 0.6, 0.3, P.bruteDark),     // jaw
    box(-0.55, 5.75, 1.35, 0.22, 0.5, 0.2, 0xe8e4d4),  // tusks
    box(0.55, 5.75, 1.35, 0.22, 0.5, 0.2, 0xe8e4d4),
  ]
  const legL: VoxBox[] = [box(-1.0, 1.0, 0, 1.5, 2.0, 1.6, P.brutePants)]
  const legR: VoxBox[] = [box(1.0, 1.0, 0, 1.5, 2.0, 1.6, P.brutePants)]
  const armL: VoxBox[] = [
    box(-2.7, 3.4, 0, 1.2, 2.8, 1.3, P.bruteSkin),
    box(-2.7, 1.85, 0, 1.1, 0.8, 1.2, P.bruteDark),
  ]
  const armR: VoxBox[] = [
    box(2.7, 3.4, 0, 1.2, 2.8, 1.3, P.bruteSkin),
    box(2.7, 2.8, 1.0, 0.6, 3.0, 0.6, 0x6d4c28),       // club handle
    box(2.7, 1.2, 1.0, 1.5, 1.5, 1.5, 0x5a3f22),       // club head
  ]
  return {
    parts: { body, head, legL, legR, armL, armR },
    pivots: {
      head: [0, 5.1, 0], legL: [-1.0, 2.0, 0], legR: [1.0, 2.0, 0],
      armL: [-2.7, 4.6, 0], armR: [2.7, 4.6, 0],
    },
  }
}

/**
 * The Hollow King - Greenhollow's boss. Deliberately not a recoloured Brute:
 * the crown and the tall back-banner give it its own silhouette at the
 * distance this game is actually played at, which is the only scale where
 * a boss reads.
 */
export function hollowKingModel(): VoxModel {
  const body: VoxBox[] = [
    box(0, 3.7, 0, 4.6, 3.2, 3.0, P.kingFlesh),
    box(0, 2.4, 0.35, 4.0, 1.5, 2.7, P.kingDark),        // girdle
    box(0, 5.1, 0, 5.4, 0.8, 2.8, P.kingDark),           // broad shoulders
    box(-2.4, 5.6, 0, 1.1, 0.7, 1.6, P.kingBone),        // pauldron bone
    box(2.4, 5.6, 0, 1.1, 0.7, 1.6, P.kingBone),
    // the banner: a tall pole and rag that break the horizon line
    box(0, 6.4, -1.5, 0.28, 6.0, 0.28, 0x5a4326),
    box(0, 8.2, -1.85, 2.4, 3.0, 0.16, P.kingBanner),
    box(0, 6.6, -1.85, 2.4, 0.5, 0.18, P.kingCrown),
  ]
  const head: VoxBox[] = [
    box(0, 6.4, 0.3, 2.3, 2.0, 2.1, P.kingFlesh),
    box(-0.52, 6.6, 1.4, 0.34, 0.34, 0.14, 0xffd24a),    // lit eyes
    box(0.52, 6.6, 1.4, 0.34, 0.34, 0.14, 0xffd24a),
    box(0, 5.85, 1.3, 1.3, 0.55, 0.32, P.kingDark),      // jaw
    // crown
    box(0, 7.6, 0.3, 2.5, 0.5, 2.2, P.kingCrown),
    box(-0.9, 8.1, 0.3, 0.4, 0.7, 0.4, P.kingCrown),
    box(0, 8.3, 0.3, 0.4, 1.0, 0.4, P.kingCrown),
    box(0.9, 8.1, 0.3, 0.4, 0.7, 0.4, P.kingCrown),
  ]
  const legL: VoxBox[] = [box(-1.1, 1.0, 0, 1.6, 2.1, 1.7, P.kingDark)]
  const legR: VoxBox[] = [box(1.1, 1.0, 0, 1.6, 2.1, 1.7, P.kingDark)]
  const armL: VoxBox[] = [
    box(-2.9, 3.5, 0, 1.3, 3.0, 1.4, P.kingFlesh),
    box(-2.9, 1.9, 0, 1.2, 0.8, 1.3, P.kingDark),
  ]
  const armR: VoxBox[] = [
    box(2.9, 3.5, 0, 1.3, 3.0, 1.4, P.kingFlesh),
    box(2.9, 2.6, 1.1, 0.4, 3.4, 0.4, 0x5a4326),         // cleaver haft
    box(2.9, 0.9, 1.1, 1.9, 1.9, 0.5, P.kingBone),       // cleaver blade
  ]
  return {
    parts: { body, head, legL, legR, armL, armR },
    pivots: {
      head: [0, 5.4, 0], legL: [-1.1, 2.1, 0], legR: [1.1, 2.1, 0],
      armL: [-2.9, 4.8, 0], armR: [2.9, 4.8, 0],
    },
  }
}

export function spiderModel(big: boolean): VoxModel {
  const c = big ? P.spider : P.spiderDark
  const bodySize = big ? 2.6 : 1.6
  const body: VoxBox[] = [
    box(0, 1.7, -0.4, bodySize, bodySize * 0.7, bodySize * 1.15, c),
    box(0, 1.6, bodySize * 0.62, bodySize * 0.6, bodySize * 0.5, bodySize * 0.45, P.spiderDark), // head
    box(-bodySize * 0.14, 1.7, bodySize * 0.85, 0.22, 0.22, 0.1, P.spiderRed, true),
    box(bodySize * 0.14, 1.7, bodySize * 0.85, 0.22, 0.22, 0.1, P.spiderRed, true),
  ]
  if (big) {
    body.push(box(0, 2.6, -1.3, 1.8, 1.2, 1.6, 0xcfc7e8)) // egg sac
    body.push(box(0, 2.2, 0.6, 1.4, 0.5, 0.8, P.spiderRed))
  }
  const mkLegs = (side: number): VoxBox[] => {
    const legs: VoxBox[] = []
    for (let i = 0; i < 4; i++) {
      const z = 0.9 - i * 0.65 * (big ? 1.4 : 1)
      legs.push(box(side * (bodySize * 0.55 + 0.5), 1.3, z * (big ? 1.2 : 1), 1.3, 0.28, 0.28, c))
      legs.push(box(side * (bodySize * 0.55 + 1.1), 0.65, z * (big ? 1.2 : 1), 0.28, 1.3, 0.28, P.spiderDark))
    }
    return legs
  }
  return {
    parts: { body, legsL: mkLegs(-1), legsR: mkLegs(1) },
    pivots: { legsL: [-bodySize * 0.55, 1.4, 0], legsR: [bodySize * 0.55, 1.4, 0] },
  }
}

export function juggernautModel(): VoxModel {
  const body: VoxBox[] = [
    box(0, 4.0, 0, 4.6, 3.4, 3.0, P.jugArmor),
    box(0, 4.1, 1.55, 2.6, 2.6, 0.3, P.jugTrim),        // chest plate sigil
    box(0, 4.1, 1.72, 1.2, 1.2, 0.1, P.jugGlow, true),  // glowing core
    box(-2.6, 5.8, 0, 1.7, 1.3, 2.2, P.jugArmor),       // pauldrons
    box(2.6, 5.8, 0, 1.7, 1.3, 2.2, P.jugArmor),
    box(-2.6, 6.7, 0, 0.5, 0.9, 0.5, P.jugTrim),        // spikes
    box(2.6, 6.7, 0, 0.5, 0.9, 0.5, P.jugTrim),
  ]
  const head: VoxBox[] = [
    box(0, 6.9, 0.2, 2.2, 2.0, 2.1, P.jugArmor),
    box(0, 7.0, 1.3, 1.6, 0.5, 0.2, P.jugGlow, true),   // visor slit
    box(0, 8.15, 0.2, 0.5, 0.9, 1.7, P.jugTrim),        // crest
  ]
  const legL: VoxBox[] = [box(-1.15, 1.15, 0, 1.7, 2.3, 1.9, P.jugArmor), box(-1.15, 0.3, 0.4, 1.8, 0.6, 2.2, 0x2f333d)]
  const legR: VoxBox[] = [box(1.15, 1.15, 0, 1.7, 2.3, 1.9, P.jugArmor), box(1.15, 0.3, 0.4, 1.8, 0.6, 2.2, 0x2f333d)]
  const armL: VoxBox[] = [
    box(-3.0, 3.6, 0, 1.3, 3.2, 1.4, P.jugArmor),
    box(-3.0, 1.8, 0, 1.6, 1.0, 1.7, 0x2f333d),
  ]
  const armR: VoxBox[] = [
    box(3.0, 3.6, 0, 1.3, 3.2, 1.4, P.jugArmor),
    box(3.0, 3.2, 1.2, 0.7, 4.6, 0.7, 0x2f333d),        // greatblade
    box(3.0, 1.0, 1.2, 1.9, 2.2, 0.3, 0x9aa2ae),
  ]
  return {
    scale: 0.13,
    parts: { body, head, legL, legR, armL, armR },
    pivots: {
      head: [0, 5.7, 0], legL: [-1.15, 2.3, 0], legR: [1.15, 2.3, 0],
      armL: [-3.0, 5.2, 0], armR: [3.0, 5.2, 0],
    },
  }
}

export function shardbackModel(): VoxModel {
  const shell = 0x565a6b, shellDark = 0x3d4050, crystal = 0x8fdfff
  const body: VoxBox[] = [
    box(0, 1.8, 0, 3.2, 1.9, 4.2, shell),                 // carapace
    box(0, 2.9, -0.3, 2.2, 0.8, 2.8, shellDark),
    box(0, 1.2, 2.4, 1.6, 1.0, 1.0, shellDark),           // head
    box(-0.4, 1.35, 2.95, 0.24, 0.24, 0.12, 0xffd23c, true),
    box(0.4, 1.35, 2.95, 0.24, 0.24, 0.12, 0xffd23c, true),
    // crystal crust
    box(-0.8, 3.4, 0.6, 0.8, 1.5, 0.8, crystal, true),
    box(0.7, 3.5, -0.6, 0.7, 1.9, 0.7, crystal, true),
    box(0, 3.3, -1.5, 0.6, 1.2, 0.6, 0xb37aff, true),
  ]
  const mkLegs = (side: number): VoxBox[] => {
    const legs: VoxBox[] = []
    for (let i = 0; i < 3; i++) {
      legs.push(box(side * 1.9, 0.7, 1.4 - i * 1.4, 0.5, 1.4, 0.5, shellDark))
    }
    return legs
  }
  return {
    parts: { body, legsL: mkLegs(-1), legsR: mkLegs(1) },
    pivots: { legsL: [-1.9, 1.4, 0], legsR: [1.9, 1.4, 0] },
  }
}

export function mistwalkerModel(): VoxModel {
  const mist = 0x9fb8c9, mistDark = 0x6f8a9f
  const body: VoxBox[] = [
    box(0, 2.2, 0, 2.4, 3.0, 1.6, mist),                  // tattered robe
    box(0, 0.6, 0, 1.8, 0.9, 1.2, mistDark),              // fading hem
    box(-0.9, 0.35, 0.2, 0.5, 0.5, 0.5, mistDark),
    box(0.7, 0.3, -0.2, 0.5, 0.5, 0.5, mistDark),
  ]
  const head: VoxBox[] = [
    box(0, 4.3, 0, 1.6, 1.6, 1.6, mistDark),
    box(0, 5.0, -0.2, 1.8, 0.5, 1.8, mist),               // hood
    box(-0.35, 4.35, 0.82, 0.3, 0.3, 0.12, 0xbfffe8, true),
    box(0.35, 4.35, 0.82, 0.3, 0.3, 0.12, 0xbfffe8, true),
  ]
  const armL: VoxBox[] = [box(-1.5, 2.6, 0.3, 0.7, 1.8, 0.7, mist)]
  const armR: VoxBox[] = [box(1.5, 2.6, 0.3, 0.7, 1.8, 0.7, mist)]
  return {
    parts: { body, head, armL, armR },
    pivots: { head: [0, 3.6, 0], armL: [-1.5, 3.4, 0.3], armR: [1.5, 3.4, 0.3] },
  }
}

export function veilqueenModel(): VoxModel {
  const chitin = 0x4a3a5f, chitinDark = 0x352a45, glow = 0xdd6bff
  const body: VoxBox[] = [
    box(0, 3.6, 0, 2.8, 2.6, 2.0, chitin),
    box(0, 2.2, -0.8, 1.8, 1.4, 2.4, chitinDark),          // abdomen
    box(0, 2.0, -2.2, 1.0, 0.9, 1.6, chitin),              // tail
    box(0, 3.8, 1.15, 1.4, 1.4, 0.3, glow, true),           // chest sigil
    box(-1.0, 2.4, 0.8, 0.5, 1.4, 0.5, chitinDark),         // tucked claws
    box(1.0, 2.4, 0.8, 0.5, 1.4, 0.5, chitinDark),
  ]
  const head: VoxBox[] = [
    box(0, 5.6, 0.4, 1.8, 1.6, 1.6, chitin),
    box(-0.4, 5.8, 1.25, 0.3, 0.3, 0.12, glow, true),
    box(0.4, 5.8, 1.25, 0.3, 0.3, 0.12, glow, true),
    box(-0.7, 6.8, 0.2, 0.4, 1.3, 0.4, chitinDark),         // crown horns
    box(0.7, 6.8, 0.2, 0.4, 1.3, 0.4, chitinDark),
    box(0, 7.0, 0.2, 0.4, 1.7, 0.4, glow, true),            // crown jewel spike
  ]
  const wingL: VoxBox[] = [
    box(-2.4, 4.6, -0.4, 2.2, 0.4, 1.6, chitinDark),
    box(-4.3, 4.9, -0.4, 1.8, 0.35, 2.6, 0x6f5a8f),
    box(-5.4, 5.0, -0.4, 0.6, 0.3, 1.8, glow, true),
  ]
  const wingR: VoxBox[] = [
    box(2.4, 4.6, -0.4, 2.2, 0.4, 1.6, chitinDark),
    box(4.3, 4.9, -0.4, 1.8, 0.35, 2.6, 0x6f5a8f),
    box(5.4, 5.0, -0.4, 0.6, 0.3, 1.8, glow, true),
  ]
  return {
    scale: 0.12,
    parts: { body, head, wingL, wingR },
    pivots: { head: [0, 4.9, 0.3], wingL: [-1.3, 4.6, -0.4], wingR: [1.3, 4.6, -0.4] },
  }
}

/**
 * The Veil Regent - a phasing colossus. It used to be the Juggernaut with a
 * purple tint, which meant the two act-bosses were indistinguishable at play
 * distance. This one is taller and narrower, robed instead of armoured, and
 * carries a crown of veilcrystal spikes plus a rune halo, so its outline is a
 * spire where the Juggernaut's is a block.
 *
 * Animated by units.ts: body, head, legL, legR, armL, armR (humanoid walk).
 * 'crystal' is the halo of rune shards above the crown. Towers spin a part of
 * that name; units.ts leaves it alone, and it is authored to look right static.
 * Top of the crown is ~11.2 vu at scale 0.13, about 1.3x the Juggernaut.
 */
export function veilRegentModel(): VoxModel {
  const robe = 0x3a2454, robeDark = 0x241638, skin = 0x8d7aa8
  const shard = 0x9f4fdf, shardPale = 0xd8a5ff, hollow = 0x140c22
  const body: VoxBox[] = [
    box(0, 5.0, 0, 3.2, 4.4, 2.3, robe),                  // torso, tall and slim
    box(0, 2.6, 0, 3.6, 1.4, 2.6, robe),                  // skirt hem, overlaps the legs
    box(0, 3.5, 0, 3.4, 0.4, 2.4, robeDark),              // belt
    box(0, 5.0, 1.2, 0.8, 4.0, 0.14, shard, true),         // lit sash down the front
    box(0, 7.4, 0, 4.0, 0.7, 2.5, robeDark),              // narrow shoulders
    box(0, 7.7, -0.3, 2.8, 0.7, 1.8, robeDark),           // cowl
    box(-1.75, 8.2, 0, 0.45, 1.4, 0.45, shard, true),      // shoulder shards
    box(1.75, 8.2, 0, 0.45, 1.4, 0.45, shard, true),
  ]
  const head: VoxBox[] = [
    box(0, 8.5, 0.15, 1.9, 1.8, 1.8, skin),
    box(0, 9.3, -0.2, 2.2, 0.7, 2.1, robe),               // hood
    box(0, 8.5, -0.95, 2.1, 1.7, 0.3, robe),
    box(0, 8.45, 1.0, 1.3, 1.1, 0.16, hollow),            // shadowed face
    box(-0.38, 8.65, 1.1, 0.3, 0.3, 0.12, shardPale, true),
    box(0.38, 8.65, 1.1, 0.3, 0.3, 0.12, shardPale, true),
    // crown: a band and five spikes, tallest at the front
    box(0, 9.7, 0, 2.1, 0.4, 2.0, shard, true),
    box(0, 10.5, 0.1, 0.42, 1.4, 0.42, shardPale, true),
    box(-0.65, 10.3, 0.1, 0.38, 1.0, 0.38, shard, true),
    box(0.65, 10.3, 0.1, 0.38, 1.0, 0.38, shard, true),
    box(-0.7, 10.15, -0.55, 0.34, 0.7, 0.34, shard, true),
    box(0.7, 10.15, -0.55, 0.34, 0.7, 0.34, shard, true),
  ]
  const legL: VoxBox[] = [box(-0.85, 1.4, 0, 1.3, 2.8, 1.4, robeDark), box(-0.85, 0.3, 0.2, 1.4, 0.6, 1.6, hollow)]
  const legR: VoxBox[] = [box(0.85, 1.4, 0, 1.3, 2.8, 1.4, robeDark), box(0.85, 0.3, 0.2, 1.4, 0.6, 1.6, hollow)]
  // arms hang past the belt: the long reach is what makes it read as a wraith
  const armL: VoxBox[] = [
    box(-2.3, 5.4, 0, 1.0, 3.6, 1.1, robe),
    box(-2.3, 3.5, 0, 1.2, 0.5, 1.3, robeDark),           // cuff
    box(-2.3, 2.6, 0.1, 0.7, 1.4, 0.7, skin),             // claw
  ]
  const armR: VoxBox[] = [
    box(2.3, 5.4, 0, 1.0, 3.6, 1.1, robe),
    box(2.3, 3.5, 0, 1.2, 0.5, 1.3, robeDark),
    box(2.3, 2.6, 0.1, 0.7, 1.4, 0.7, skin),
    box(2.3, 4.6, 0.9, 0.3, 6.0, 0.3, robeDark),          // sceptre haft
    box(2.3, 8.1, 0.9, 0.7, 1.2, 0.7, shardPale, true),    // sceptre shard
  ]
  // halo of eight rune shards above the crown. It sits outside the arm swing
  // and clear of the crown spikes, so nothing intersects whether or not it spins.
  const crystal: VoxBox[] = []
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    crystal.push(box(Math.cos(a) * 1.9, 10.3, Math.sin(a) * 1.9, 0.45, 0.35, 0.45, i % 2 ? shard : shardPale, true))
  }
  return {
    scale: 0.13,
    parts: { body, head, legL, legR, armL, armR, crystal },
    pivots: {
      head: [0, 7.6, 0], legL: [-0.85, 2.8, 0], legR: [0.85, 2.8, 0],
      armL: [-2.3, 7.0, 0], armR: [2.3, 7.0, 0], crystal: [0, 10.3, 0],
    },
  }
}

/**
 * The Ossuary - a bone colossus that raises the dead around it. Built as a
 * knuckle-walker: hips low and back, ribcage pushed forward and up, skull
 * hanging out over the front, forelimbs planted on the ground. That hunch is
 * the whole silhouette; upright it would be another Brute in bone paint.
 * The ribcage is striped with dark gaps and one sickly green band so the thing
 * animating it shows between the ribs.
 *
 * Animated by units.ts: body, head, legL, legR, armL, armR (humanoid walk;
 * the arms are the front legs, so the swing reads as a lope).
 * Top of the skull crest is ~9.3 vu at scale 0.14; the widest boss on the field.
 */
export function ossuaryModel(): VoxModel {
  const bone = 0xe8e4d4, boneMid = 0xc9c2ae, boneDark = 0x8f8778
  const hollow = 0x1a1612, marrow = 0x8fe08a
  const body: VoxBox[] = [
    box(0, 3.6, -1.6, 4.4, 2.0, 2.4, boneMid),            // pelvis, low and back
    box(0, 4.8, -0.9, 1.2, 1.0, 1.4, boneDark),           // spine, stepping up and forward
    box(0, 5.5, 0.2, 1.2, 1.0, 1.4, boneDark),
    box(0, 5.8, 0.9, 5.0, 3.2, 3.0, bone),                // ribcage mass
    // gap bands slightly wider than the cage: they read as space between ribs
    box(0, 6.55, 0.9, 5.12, 0.45, 3.12, hollow),
    box(0, 5.8, 0.9, 5.14, 0.5, 3.14, marrow, true),      // the light inside
    box(0, 5.05, 0.9, 5.12, 0.45, 3.12, hollow),
    box(0, 5.8, 2.5, 0.7, 3.2, 0.25, boneDark),           // sternum
    box(0, 7.4, 0.6, 6.2, 1.0, 2.4, boneMid),             // shoulder girdle
    box(0, 7.9, -0.4, 0.6, 1.0, 0.6, boneDark),           // vertebrae standing off the hunch
    box(0, 6.6, -1.4, 0.6, 1.0, 0.6, boneDark),
    box(0, 4.9, -2.6, 0.6, 1.0, 0.6, boneDark),
  ]
  const head: VoxBox[] = [
    box(0, 7.6, 2.4, 2.4, 2.1, 2.2, bone),                // skull, out over the front
    box(0, 6.4, 2.6, 1.9, 0.6, 1.6, boneMid),             // jaw
    box(-0.55, 7.8, 3.52, 0.6, 0.6, 0.14, hollow),        // sockets
    box(0.55, 7.8, 3.52, 0.6, 0.6, 0.14, hollow),
    box(-0.55, 7.8, 3.6, 0.3, 0.3, 0.1, marrow, true),    // pinprick lights in them
    box(0.55, 7.8, 3.6, 0.3, 0.3, 0.1, marrow, true),
    box(0, 7.2, 3.52, 0.4, 0.5, 0.12, hollow),            // nasal hollow
    box(0, 8.9, 2.0, 0.6, 0.8, 1.4, boneDark),            // crest
  ]
  const legL: VoxBox[] = [
    box(-1.5, 1.4, -1.4, 1.7, 2.8, 1.9, boneMid),
    box(-1.5, 0.35, -1.0, 1.9, 0.7, 2.4, boneDark),       // foot
    box(-1.5, 2.4, -0.4, 1.0, 0.9, 0.7, bone),            // kneecap
  ]
  const legR: VoxBox[] = [
    box(1.5, 1.4, -1.4, 1.7, 2.8, 1.9, boneMid),
    box(1.5, 0.35, -1.0, 1.9, 0.7, 2.4, boneDark),
    box(1.5, 2.4, -0.4, 1.0, 0.9, 0.7, bone),
  ]
  // forelimbs long enough to reach the ground from the raised shoulders
  const armL: VoxBox[] = [
    box(-3.3, 4.6, 0.6, 1.4, 5.4, 1.5, boneMid),
    box(-3.3, 5.2, -0.3, 0.6, 1.4, 0.7, bone),            // elbow spur
    box(-3.3, 0.9, 1.0, 1.8, 1.8, 1.9, boneDark),         // knuckles
    box(-3.3, 0.35, 2.2, 1.6, 0.7, 0.8, bone),            // fingers
  ]
  const armR: VoxBox[] = [
    box(3.3, 4.6, 0.6, 1.4, 5.4, 1.5, boneMid),
    box(3.3, 5.2, -0.3, 0.6, 1.4, 0.7, bone),
    box(3.3, 0.9, 1.0, 1.8, 1.8, 1.9, boneDark),
    box(3.3, 0.35, 2.2, 1.6, 0.7, 0.8, bone),
  ]
  return {
    scale: 0.14,
    parts: { body, head, legL, legR, armL, armR },
    pivots: {
      head: [0, 6.9, 1.6], legL: [-1.5, 2.8, -1.4], legR: [1.5, 2.8, -1.4],
      armL: [-3.3, 7.3, 0.6], armR: [3.3, 7.3, 0.6],
    },
  }
}

/**
 * The Veil Empress - the Veilqueen's matriarch, in two phases that must read
 * as one creature. Both share the thorax, tail, head and crown; the palette
 * never changes. Winged, she has two wing pairs: the big front pair flaps
 * (wingL / wingR) and a smaller rear pair is static in the body. Landed, the
 * same body stands on two legs and every wing is reduced to a broken spar, so
 * the phase change reads as "she shed her wings and walks" rather than as a
 * different enemy being swapped in.
 *
 * Animated by units.ts: winged - body, head, wingL, wingR (veilqueen flight);
 * landed - body, head, legL, legR, armL, armR (humanoid walk, claws swinging).
 * Top of the crown is ~9.4 vu at scale 0.14; wingspan is about 16 vu.
 */
export function veilEmpressModel(landed: boolean): VoxModel {
  const violet = 0x3a1d5c, violetPale = 0x5f3d8f, violetDeep = 0x2a1440
  const membrane = 0x7a5aa8, glow = 0x9fe8ff, crown = 0xbfefff
  // the tail droops to the ground once she is walking
  const tY = landed ? -1.2 : 0
  const body: VoxBox[] = [
    box(0, 4.2, 0, 3.4, 3.0, 2.4, violet),                // thorax
    box(0, 2.8, -1.2, 2.4, 1.8, 3.0, violetPale),         // abdomen
    box(0, 4.5, 1.35, 1.8, 1.8, 0.3, glow, true),          // chest sigil
    box(0, 2.6 + tY * 0.4, -3.2, 1.4, 1.2, 2.2, violet),  // tail
    box(0, 2.8 + tY * 0.8, -4.9, 0.9, 0.8, 1.8, violetPale),
    box(0, 3.1 + tY, -6.2, 0.5, 0.5, 1.2, glow, true),     // stinger
  ]
  const head: VoxBox[] = [
    box(0, 6.6, 0.5, 2.2, 2.0, 2.0, violet),
    box(-0.5, 6.9, 1.55, 0.34, 0.34, 0.12, glow, true),
    box(0.5, 6.9, 1.55, 0.34, 0.34, 0.12, glow, true),
    box(-0.5, 5.9, 1.4, 0.35, 0.7, 0.5, violetPale),      // mandibles
    box(0.5, 5.9, 1.4, 0.35, 0.7, 0.5, violetPale),
    box(-0.9, 8.3, -0.5, 0.4, 1.3, 0.4, violetPale),      // horns
    box(0.9, 8.3, -0.5, 0.4, 1.3, 0.4, violetPale),
    // crown of crystal: band and three spikes
    box(0, 7.75, 0.3, 2.3, 0.4, 2.1, crown, true),
    box(0, 8.6, 0.3, 0.45, 1.6, 0.45, crown, true),
    box(-0.8, 8.4, 0.3, 0.4, 1.1, 0.4, crown, true),
    box(0.8, 8.4, 0.3, 0.4, 1.1, 0.4, crown, true),
  ]
  const pivots: VoxModel['pivots'] = { head: [0, 5.7, 0.4] }
  const parts: VoxModel['parts'] = { body, head }

  if (!landed) {
    // claws tucked up under the thorax, as on the queen
    body.push(box(-1.2, 2.7, 1.0, 0.6, 1.6, 0.6, violetPale), box(1.2, 2.7, 1.0, 0.6, 1.6, 0.6, violetPale))
    // rear wing pair: smaller, lower, swept back, and static
    for (const s of [-1, 1]) {
      body.push(
        box(s * 2.6, 3.6, -1.4, 2.6, 0.35, 1.4, violetPale),
        box(s * 4.4, 3.7, -1.6, 1.4, 0.3, 2.0, membrane),
        box(s * 5.4, 3.8, -1.6, 0.5, 0.25, 1.4, glow, true),
      )
    }
    const wing = (s: number): VoxBox[] => [
      box(s * 2.8, 5.4, -0.2, 2.6, 0.4, 2.0, violetPale),
      box(s * 5.2, 5.7, -0.3, 2.4, 0.35, 3.2, membrane),
      box(s * 7.0, 5.9, -0.3, 1.2, 0.3, 2.6, violetPale),
      box(s * 7.9, 6.0, -0.3, 0.6, 0.3, 2.0, glow, true),  // lit leading edge
      box(s * 5.2, 5.95, -0.3, 2.4, 0.12, 0.3, glow, true), // vein
    ]
    parts.wingL = wing(-1)
    parts.wingR = wing(1)
    pivots.wingL = [-1.5, 5.4, -0.2]
    pivots.wingR = [1.5, 5.4, -0.2]
  } else {
    // both pairs reduced to broken spars, with the ice light leaking from the breaks
    for (const s of [-1, 1]) {
      body.push(
        box(s * 2.4, 5.5, -0.2, 1.8, 0.45, 1.2, violetPale),
        box(s * 3.5, 5.4, -0.4, 0.6, 0.7, 0.6, violetDeep),
        box(s * 3.45, 5.75, -0.2, 0.4, 0.3, 0.9, glow, true),
        box(s * 2.4, 3.6, -1.4, 1.4, 0.35, 1.0, violetPale),
        box(s * 3.2, 3.55, -1.5, 0.5, 0.55, 0.5, violetDeep),
      )
    }
    const leg = (s: number): VoxBox[] => [
      box(s * 1.0, 1.35, 0.2, 1.3, 2.7, 1.4, violetPale),
      box(s * 1.0, 0.3, 0.7, 1.4, 0.6, 1.9, violetDeep),    // splayed foot
      box(s * 1.0, 1.9, 0.9, 0.5, 0.8, 0.5, violet),        // knee spur
    ]
    const arm = (s: number): VoxBox[] => [
      box(s * 2.2, 4.0, 0.4, 0.8, 2.6, 0.8, violetPale),
      box(s * 2.2, 2.4, 0.6, 0.6, 1.0, 0.9, violetDeep),    // claw
    ]
    parts.legL = leg(-1); parts.legR = leg(1)
    parts.armL = arm(-1); parts.armR = arm(1)
    pivots.legL = [-1.0, 2.7, 0.2]; pivots.legR = [1.0, 2.7, 0.2]
    pivots.armL = [-2.2, 5.3, 0.4]; pivots.armR = [2.2, 5.3, 0.4]
  }
  return { scale: 0.14, parts, pivots }
}

// ---------- soldiers ----------

/** small hexing imp: horned head, glowing eyes, whip tail */
export function hexlingModel(): VoxModel {
  const skin = 0x7a4fd0, dark = 0x5a3aa0, glow = 0xffe89f
  const body: VoxBox[] = [box(0, 1.7, 0, 2.2, 1.8, 1.6, skin)]
  const head: VoxBox[] = [
    box(0, 3.4, 0, 2.4, 1.9, 2.0, skin),
    box(-0.9, 4.6, 0, 0.5, 1.1, 0.5, dark),      // horns
    box(0.9, 4.6, 0, 0.5, 1.1, 0.5, dark),
    box(-0.55, 3.5, 1.02, 0.5, 0.4, 0.12, glow), // wicked eyes
    box(0.55, 3.5, 1.02, 0.5, 0.4, 0.12, glow),
    box(0, 2.85, 1.0, 1.2, 0.35, 0.14, 0x2a1a44), // grin
  ]
  const armL: VoxBox[] = [box(-1.35, 1.9, 0, 0.7, 1.4, 0.7, dark)]
  const armR: VoxBox[] = [box(1.35, 1.9, 0, 0.7, 1.4, 0.7, dark)]
  const legL: VoxBox[] = [box(-0.55, 0.55, 0, 0.8, 1.1, 0.8, dark)]
  const legR: VoxBox[] = [box(0.55, 0.55, 0, 0.8, 1.1, 0.8, dark)]
  const tail: VoxBox[] = [
    box(0, 1.4, -1.2, 0.45, 0.45, 1.4, skin),
    box(0, 1.7, -2.2, 0.6, 0.6, 0.7, dark),
  ]
  return {
    parts: { body, head, armL, armR, legL, legR, tail },
    pivots: { head: [0, 2.9, 0], armL: [-1.35, 2.5, 0], armR: [1.35, 2.5, 0], legL: [-0.55, 1.1, 0], legR: [0.55, 1.1, 0], tail: [0, 1.5, -0.6] },
  }
}

/** armored banner-carrier whose rune-standard shields the horde ahead */
export function wardbearerModel(): VoxModel {
  const m = humanoid({
    skin: 0x9a8fb0, shirt: 0x3a3448, pants: 0x2c2738,
    helmet: 0x4d5266, tabard: 0x5f3d8f, weapon: 'none',
  })
  // rune-banner: tall standard clutched at the right shoulder
  const banner: VoxBox[] = [
    box(1.7, 3.6, -0.3, 0.4, 7.2, 0.4, 0x3a2e1f),
    box(1.7, 6.9, 0.55, 0.16, 2.2, 1.7, 0x8fdfff, true),
    box(1.7, 5.6, 0.35, 0.16, 0.6, 1.3, 0x8fdfff, true),
    box(1.7, 7.3, 0.55, 0.4, 0.4, 0.4, 0xd8b64a),
  ]
  m.parts.banner = banner
  m.pivots = { ...(m.pivots ?? {}), banner: [1.7, 3.6, -0.3] }
  return m
}

export function militiaModel(): VoxModel {
  return humanoid({ skin: 0xd9a066, shirt: 0x8a6a4a, pants: 0x5c4a35, hair: 0x6b4a2a, weapon: 'spear' })
}
export function footmanModel(): VoxModel {
  return humanoid({ skin: 0xd9a066, shirt: 0x5d708f, pants: 0x3d4a5f, helmet: 0x9aa2ae, weapon: 'sword', shield: 0x37548f })
}
export function knightModel(): VoxModel {
  return humanoid({
    skin: 0xd9a066, shirt: 0x9aa2ae, pants: 0x5c6470, helmet: 0xb7bcc4, helmetCrest: 0xc03a2f,
    weapon: 'sword', shield: 0x37548f, shieldTrim: 0xd8b64a, tabard: 0x37548f,
  })
}
export function paladinModel(): VoxModel {
  return humanoid({
    skin: 0xd9a066, shirt: 0xe8e4d4, pants: 0xb7ac8f, helmet: 0xd8b64a, helmetCrest: 0xffffff,
    weapon: 'sword', shield: 0xe8e4d4, shieldTrim: 0xd8b64a, tabard: 0xd8b64a, cape: 0xe8e4d4,
  })
}
export function berserkerModel(): VoxModel {
  return humanoid({
    skin: 0xc98a5a, shirt: 0x8f2f2f, pants: 0x4a3527, hair: 0xc03a2f, beard: 0xc03a2f,
    weapon: 'axe', cape: 0x6b2222,
  })
}
export function reinforcementModel(): VoxModel {
  return humanoid({ skin: 0xd9a066, shirt: 0x7f8f5a, pants: 0x5c4a35, hair: 0x3d2f1f, weapon: 'spear', shield: 0x8a6a4a })
}
/**
 * Hero detailing.
 *
 * A hero used the same `humanoid` silhouette as a militia with two or three
 * boxes bolted on, which was survivable at the old 1.72-1.85 scale and stopped
 * being so once heroes grew past the bosses: at that size the player is looking
 * straight at a militia wearing a different palette. These layer real armour
 * onto the same six parts and the same pivots, so the walk rig is untouched and
 * only the block count goes up.
 */

/** full plate: the Bulwark reads as the heaviest thing on the field */
function plateArmour(m: VoxModel, metal: number, trim: number, leather: number): VoxModel {
  const { body, head, legL, legR, armL, armR } = m.parts
  body.push(
    // narrower than the torso on purpose: the shirt shows at the shoulders and
    // flanks, so the hero keeps his colours instead of reading as a grey slab
    box(0, 2.85, 0.08, 1.92, 1.42, 1.62, metal),     // cuirass over the tabard
    box(0, 2.95, 0.9, 0.9, 1.05, 0.12, trim),        // heraldry plate
    box(0, 2.02, 0.05, 2.14, 0.5, 1.58, metal),      // fauld
    box(0, 3.48, 0, 2.05, 0.36, 1.4, trim),          // gorget
    box(0, 1.72, 0, 2.56, 0.42, 1.6, leather),       // belt
    box(0, 1.72, 0.84, 0.56, 0.42, 0.14, trim),      // buckle
    box(-0.76, 1.36, 0.05, 0.9, 0.72, 1.52, metal),  // tassets
    box(0.76, 1.36, 0.05, 0.9, 0.72, 1.52, metal),
  )
  // the helm is trim-coloured, so its guards must be too or the face reads broken
  head.push(
    box(-0.74, 4.46, 0.52, 0.34, 0.9, 0.85, trim),   // cheek guards
    box(0.74, 4.46, 0.52, 0.34, 0.9, 0.85, trim),
    box(0, 5.02, 0.86, 1.92, 0.3, 0.26, metal),      // brow band
  )
  for (const [arm, sx] of [[armL, -1], [armR, 1]] as const) {
    arm.push(
      box(sx * 1.62, 3.5, 0, 1.36, 0.72, 1.36, metal),   // pauldron
      box(sx * 1.62, 3.88, 0, 1.16, 0.26, 1.16, trim),   // pauldron cap
      box(sx * 1.55, 2.06, 0, 0.96, 0.76, 0.96, metal),  // bracer
    )
  }
  for (const [leg, sx] of [[legL, -0.62], [legR, 0.62]] as const) {
    leg.push(
      box(sx, 0.72, 0, 1.14, 1.12, 1.14, metal),      // greave
      box(sx, 1.22, 0.56, 0.96, 0.4, 0.34, trim),     // knee plate
      box(sx, 0.13, 0.14, 1.2, 0.36, 1.42, leather),  // boot
    )
  }
  return m
}

/** a layered shield: rim, boss and a cross, instead of one flat slab */
function heraldicShield(m: VoxModel, face: number, trim: number): VoxModel {
  const a = m.parts.armL
  a.push(
    box(-2.22, 3.78, 0.3, 0.34, 0.3, 1.96, trim),   // rim
    box(-2.22, 1.42, 0.3, 0.34, 0.3, 1.96, trim),
    box(-2.3, 2.6, 0.3, 0.2, 2.4, 0.24, trim),      // cross, upright
    box(-2.3, 2.6, 0.3, 0.2, 0.26, 1.5, trim),      // cross, arms
    box(-2.38, 2.6, 0.3, 0.22, 0.72, 0.72, face),   // boss
  )
  return m
}

/** a blade with a fuller, a guard and a pommel reads as a weapon, not a stick */
function knightSword(m: VoxModel, steel: number, trim: number): VoxModel {
  const a = m.parts.armR
  a.push(
    box(1.55, 3.1, 0.75, 0.12, 2.3, 0.32, steel),   // fuller
    box(1.55, 4.42, 0.75, 0.2, 0.5, 0.2, steel),    // point
    box(1.55, 1.56, 0.75, 0.44, 0.36, 0.44, trim),  // pommel
    box(1.55, 1.72, 0.75, 0.3, 0.32, 0.3, 0x5a4028),// grip wrap
  )
  return m
}

export function heroModel(): VoxModel {
  const m = humanoid({
    skin: 0xd9a066, shirt: 0x3d5a8f, pants: 0x2d4066,
    helmet: 0xe8c95f, helmetCrest: 0x3d5a8f,
    weapon: 'sword', shield: 0x3d5a8f, shieldTrim: 0xe8c95f,
    tabard: 0xe8c95f, cape: 0x8f2f2f,
  })
  plateArmour(m, 0xb9c2d0, 0xe8c95f, 0x6a4a2c)
  heraldicShield(m, 0xe8c95f, 0xd8b64a)
  knightSword(m, 0xdfe6f0, 0xe8c95f)
  // a longer cape, clasped: the silhouette that says "this one is yours"
  m.parts.body.push(
    box(0, 2.3, -0.92, 2.36, 3.2, 0.34, 0x8f2f2f),
    box(0, 3.42, -0.72, 1.0, 0.34, 0.3, 0xe8c95f),
  )
  return m
}
export function zephyraModel(): VoxModel {
  const m = humanoid({
    skin: 0xe8c9a8, shirt: 0x3d5a8f, pants: 0x2a3f66,
    hair: 0xdfe8ee, weapon: 'staff', weaponGlow: 0x9fe8ff,
    cape: 0x5aa0d8, tabard: 0x9fe8ff,
  })
  // storm circlet, with the stone it channels through
  m.parts.head.push(
    box(0, 5.5, 0, 1.95, 0.3, 1.95, 0x9fe8ff, true),
    box(0, 5.66, 0.82, 0.42, 0.42, 0.3, 0xffffff, true),
    box(-0.86, 5.5, 0.5, 0.24, 0.5, 0.5, 0x5aa0d8),
    box(0.86, 5.5, 0.5, 0.24, 0.5, 0.5, 0x5aa0d8),
  )
  // robes rather than plate: a mantle, a sash, and a hem that falls past the knee
  m.parts.body.push(
    box(0, 3.4, 0, 2.7, 0.6, 1.85, 0x5aa0d8),        // shoulder mantle
    box(0, 3.62, 0, 2.2, 0.24, 1.6, 0x9fe8ff, true), // mantle trim, lit
    box(0, 1.72, 0, 2.5, 0.4, 1.58, 0x2a3f66),       // sash
    box(0, 1.74, 0.82, 0.5, 0.5, 0.14, 0x9fe8ff, true),
  )
  for (const [leg, sx] of [[m.parts.legL, -0.62], [m.parts.legR, 0.62]] as const) {
    leg.push(
      box(sx, 1.0, 0, 1.22, 1.5, 1.22, 0x3d5a8f),  // robe skirt
      box(sx, 0.16, 0.1, 1.16, 0.4, 1.34, 0x2a3f66),
    )
  }
  // a staff worth carrying: rings around the orb
  m.parts.armR.push(
    box(1.55, 5.3, 0.75, 1.1, 0.16, 0.16, 0x9fe8ff, true),
    box(1.55, 5.3, 0.75, 0.16, 1.1, 0.16, 0x9fe8ff, true),
    box(1.55, 4.6, 0.75, 0.48, 0.3, 0.48, 0xc8cdd6),
  )
  return m
}

export function lioraModel(): VoxModel {
  const m = humanoid({
    skin: 0xe8b58a, shirt: 0x4a7a3f, pants: 0x33512b,
    hair: 0xc9803a, weapon: 'bow', cape: 0x2f4f28, tabard: 0x9fdf8f,
  })
  const leather = 0x6d4c28, dark = 0x4a3520
  // quiver on the back, with arrows actually in it
  m.parts.body.push(
    box(0.7, 3.1, -0.95, 0.72, 1.7, 0.52, leather),
    box(0.7, 4.15, -0.95, 0.58, 0.6, 0.42, 0x9fdf8f),
    box(0.52, 4.5, -0.95, 0.12, 0.7, 0.12, 0xdfe6f0),
    box(0.86, 4.44, -0.95, 0.12, 0.6, 0.12, 0xdfe6f0),
    // a ranger's kit: hood, jerkin, belt and pouch
    box(0, 3.44, -0.18, 2.3, 0.6, 1.7, 0x2f4f28),
    box(0, 2.8, 0.08, 2.16, 1.3, 1.6, 0x3f6a35),
    box(0, 1.74, 0, 2.52, 0.38, 1.58, leather),
    box(-0.82, 1.62, 0.5, 0.6, 0.62, 0.5, dark),
  )
  m.parts.head.push(
    box(0, 5.3, -0.3, 2.0, 0.7, 2.1, 0x2f4f28),   // hood
    box(0, 4.6, -1.02, 1.9, 1.5, 0.3, 0x2f4f28),
  )
  for (const [arm, sx] of [[m.parts.armL, -1], [m.parts.armR, 1]] as const) {
    arm.push(box(sx * 1.55, 2.08, 0, 0.94, 0.7, 0.94, leather))   // bracers
  }
  for (const [leg, sx] of [[m.parts.legL, -0.62], [m.parts.legR, 0.62]] as const) {
    leg.push(
      box(sx, 0.55, 0, 1.12, 0.9, 1.12, dark),      // high boots
      box(sx, 1.02, 0, 1.16, 0.26, 1.16, leather),  // boot cuff
      box(sx, 0.13, 0.14, 1.18, 0.36, 1.4, dark),
    )
  }
  return m
}
