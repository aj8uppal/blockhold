import { expect, it, vi } from 'vitest'
import { Particles } from '../src/game/particles.ts'

it('fades smoke transparently while preserving its gray color, then retires the particle',()=>{
  const random=vi.spyOn(Math,'random').mockReturnValue(.5)
  try{
    const particles=new Particles(),pool=particles.normal
    pool.emit({x:0,y:1,z:0,count:1,color:0x888888,life:1,lifeVar:0})
    pool.update(.2)
    const color=pool.geometry.attributes.aColor.getX(0)
    expect(pool.geometry.attributes.aAlpha.getX(0)).toBe(1)
    pool.update(.65)
    expect(pool.geometry.attributes.aColor.getX(0)).toBeCloseTo(color)
    expect(pool.geometry.attributes.aAlpha.getX(0)).toBeCloseTo(.15/.35)
    pool.update(.2)
    expect(pool.geometry.attributes.aSize.getX(0)).toBe(0)
  }finally{random.mockRestore()}
})
