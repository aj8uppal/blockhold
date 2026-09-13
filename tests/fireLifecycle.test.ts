import { afterEach, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { addBurnZone, updateBurnZones, updateBurnVisuals, clearBurnZones, clearOwnedEffects } from '../src/game/projectiles.ts'
import type { World, KillCredit } from '../src/game/world.ts'

const enemy={alive:true,airborne:false,pos:new THREE.Vector3(),radius:.2,takeDamage:vi.fn()}
const world={time:0,dynamic:new THREE.Group(),enemies:[enemy],groundY:()=>2,particles:{burnEmber:vi.fn()}} as unknown as World
const at=new THREE.Vector3()
afterEach(()=>{clearBurnZones(world);world.time=0;enemy.takeDamage.mockClear()})

it('keeps cooling embers on the ground after damage expires, then releases the visual',()=>{
  addBurnZone(world,at,1,10,1)
  expect(world.dynamic.children[0].position.y).toBeCloseTo(2.035)
  world.time=.5;updateBurnZones(.1,world)
  expect(enemy.takeDamage).toHaveBeenCalledTimes(1)
  world.time=1.1;updateBurnZones(.1,world);updateBurnVisuals(world)
  expect(world.dynamic.children).toHaveLength(1)
  const flames=world.dynamic.children[0].children[1]
  expect(flames.visible).toBe(false)
  world.time=2;updateBurnZones(.1,world);updateBurnVisuals(world)
  expect(enemy.takeDamage).toHaveBeenCalledTimes(1)
  world.time=3;updateBurnVisuals(world)
  expect(world.dynamic.children).toHaveLength(0)
})

it('selling the owner clears its cooling patches without erasing another tower’s fire',()=>{
  const first={} as KillCredit,second={} as KillCredit
  addBurnZone(world,at,1,10,1,first)
  world.time=1.1;updateBurnZones(.1,world)
  addBurnZone(world,at,1,10,2,second)
  clearOwnedEffects(world,first)
  expect(world.dynamic.children).toHaveLength(1)
  clearOwnedEffects(world,second)
  expect(world.dynamic.children).toHaveLength(0)
})

it('bounds cooling effects even when many patches expire at once and clears them on reset',()=>{
  for(let i=0;i<40;i++)addBurnZone(world,at,1,10,1)
  world.time=1.1;updateBurnZones(.1,world)
  expect(world.dynamic.children.length).toBeLessThanOrEqual(24)
  clearBurnZones(world)
  expect(world.dynamic.children).toHaveLength(0)
})
