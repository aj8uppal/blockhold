import { afterEach, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { addBurnZone, updateBurnZones, updateBurnVisuals, clearBurnZones, clearOwnedEffects } from '../src/game/projectiles.ts'
import type { World, KillCredit } from '../src/game/world.ts'
import { updateFireLights } from '../src/game/effects/groundFire.ts'

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

it('shares flame geometry and bounds lighting across patches, then clears it on expiry and reset',()=>{
  const lights=[new THREE.PointLight(),new THREE.PointLight()]
  for(let i=0;i<12;i++)addBurnZone(world,new THREE.Vector3(i*2,0,0),1,10,1)
  world.time=.5;updateBurnVisuals(world)
  const first=world.dynamic.children[0].children[1] as THREE.Mesh
  for(const patch of world.dynamic.children){
    expect((patch.children[1] as THREE.Mesh).geometry).toBe(first.geometry)
    expect(patch.children).toHaveLength(4)
  }
  updateFireLights(lights,new THREE.Vector3(0,5,5))
  for(const light of lights){
    expect(light.intensity).toBeGreaterThan(0)
    expect(light.intensity).toBeLessThanOrEqual(.35)
    expect(light.position.y).toBeCloseTo(2.355)
    expect(light.castShadow).toBe(false)
  }
  world.time=1.1;updateBurnZones(.1,world);updateBurnVisuals(world)
  updateFireLights(lights,new THREE.Vector3())
  expect(lights.every(l=>l.intensity===0)).toBe(true)
  clearBurnZones(world);updateFireLights(lights,new THREE.Vector3())
  expect(lights.every(l=>l.intensity===0)).toBe(true)
})
