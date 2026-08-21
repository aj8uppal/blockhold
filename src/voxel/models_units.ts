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
export function heroModel(): VoxModel {
  return humanoid({
    skin: 0xd9a066, shirt: 0x3d5a8f, pants: 0x2d4066,
    helmet: 0xe8c95f, helmetCrest: 0x3d5a8f,
    weapon: 'sword', shield: 0x3d5a8f, shieldTrim: 0xe8c95f,
    tabard: 0xe8c95f, cape: 0x8f2f2f,
  })
}
export function zephyraModel(): VoxModel {
  const m = humanoid({
    skin: 0xe8c9a8, shirt: 0x3d5a8f, pants: 0x2a3f66,
    hair: 0xdfe8ee, weapon: 'staff', weaponGlow: 0x9fe8ff,
    cape: 0x5aa0d8, tabard: 0x9fe8ff,
  })
  // storm circlet
  m.parts.head.push(box(0, 5.5, 0, 1.95, 0.3, 1.95, 0x9fe8ff, true))
  return m
}

export function lioraModel(): VoxModel {
  const m = humanoid({
    skin: 0xe8b58a, shirt: 0x4a7a3f, pants: 0x33512b,
    hair: 0xc9803a, weapon: 'bow', cape: 0x2f4f28, tabard: 0x9fdf8f,
  })
  // quiver on the back
  m.parts.body.push(box(0.7, 3.1, -0.95, 0.7, 1.7, 0.5, 0x6d4c28))
  m.parts.body.push(box(0.7, 4.1, -0.95, 0.55, 0.5, 0.4, 0x9fdf8f))
  return m
}
