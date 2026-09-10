import type { SaveData } from '../core/save.ts'
import { writeSave } from '../core/save.ts'
import type { Difficulty, HeroId } from '../game/types.ts'
import { HUNTS, huntAccess, heroHunts, masteryHint, masteryReady, type HuntId } from '../game/hunts.ts'
import { HERO_DEFS } from '../game/hero.ts'
import { HERO_PATHS } from '../game/heroPaths.ts'
import { icon } from './icons.ts'

export function renderEndgame(root: HTMLElement, save: SaveData,
  play: (id: HuntId, difficulty: Difficulty, hero: HeroId) => void, back: () => void): void {
  const wrap = document.createElement('div'); wrap.className = 'screen endgame-screen'; root.append(wrap)
  wrap.innerHTML = `<div class="endgame-heading"><h1>Boss hunts</h1><p>Master two encounters. Shape your champion. Forge a Mythic defense.</p></div>`
  const returnBtn = document.createElement('button'); returnBtn.className = 'btn ghost small'; returnBtn.textContent = '← Main menu'; returnBtn.onclick = back; wrap.prepend(returnBtn)
  let hero = (save.lastHero in HERO_DEFS ? save.lastHero : 'aldric') as HeroId
  const roster = document.createElement('div'); roster.className = 'hero-row'; wrap.append(roster)
  const paths = document.createElement('div'); paths.className = 'endgame-paths'; wrap.append(paths)
  const paintPaths = () => {
    roster.querySelectorAll('button').forEach(b => b.classList.toggle('picked', b.dataset.hero === hero))
    paths.innerHTML = `<h2>${HERO_DEFS[hero].name} · choose a path</h2><p>Win one hunt with this champion to open the first path; win both distinct hunts to open the second. Any difficulty counts. Switch freely before a battle.</p>`
    const choices = document.createElement('div'); choices.className = 'endgame-grid'; paths.append(choices)
    const count = heroHunts(save, hero)
    for (const [index, path] of HERO_PATHS[hero].entries()) {
      const button = document.createElement('button'); button.className = `endgame-card path-option${save.heroPaths?.[hero] === path.id ? ' picked' : ''}`
      button.innerHTML = `<h3>${icon(path.icon)} ${path.name}</h3><b>${path.abilityName}</b><p>${path.blurb}</p><small>${count >= index + 1 ? save.heroPaths?.[hero] === path.id ? 'Equipped' : 'Equip path' : `${count}/${index + 1} distinct hunts won with ${HERO_DEFS[hero].name}`}</small>`
      button.disabled = count < index + 1
      button.onclick = () => { save.heroPaths = { ...save.heroPaths, [hero]: path.id }; writeSave(save); paintPaths() }
      choices.append(button)
    }
    const baseline = document.createElement('button'); baseline.className = 'btn ghost small'; baseline.textContent = 'Use original signature'
    baseline.onclick = () => { if (save.heroPaths) delete save.heroPaths[hero]; writeSave(save); paintPaths() }; paths.append(baseline)
  }
  for (const def of Object.values(HERO_DEFS)) {
    const button = document.createElement('button'); button.className = 'hero-option'; button.dataset.hero = def.id
    button.innerHTML = `<img class="hero-portrait" src="art/hero-${def.id}.webp" alt=""><span class="hero-name">${def.name}</span>`
    button.onclick = () => { hero = def.id; save.lastHero = hero; writeSave(save); paintPaths() }; roster.append(button)
  }
  paintPaths()
  const grid = document.createElement('div'); grid.className = 'endgame-grid'; wrap.append(grid)
  for (const hunt of HUNTS) {
    const card = document.createElement('section'); card.className = 'endgame-card'; grid.append(card)
    card.innerHTML = `<span class="endgame-kicker">Ten waves · prepare your defense</span><h2>${hunt.name}</h2><p>${hunt.briefing}</p><ol>${hunt.phases.map(x => `<li>${x}</li>`).join('')}</ol>`
    const buttons = document.createElement('div'); buttons.className = 'endgame-difficulties'; card.append(buttons)
    for (const difficulty of ['casual', 'normal', 'veteran'] as const) {
      const button = document.createElement('button'); button.className = 'btn small'; button.textContent = `${difficulty[0].toUpperCase() + difficulty.slice(1)}${save.honors?.includes(`hunt:${hunt.id}:${difficulty}`) ? ' ✓' : ''}`
      button.disabled = !huntAccess(save); button.onclick = () => play(hunt.id, difficulty, hero); buttons.append(button)
    }
    if (!huntAccess(save)) { const gate = document.createElement('p'); gate.textContent = 'Opens at account level 25 or after clearing Tidereach.'; card.append(gate) }
  }
  const mastery = document.createElement('section'); mastery.className = 'endgame-mastery'; wrap.append(mastery)
  mastery.innerHTML = '<h2>Tier VI · Mythic mastery</h2><p>Win both hunts on Normal or Veteran with a tier-five tower of the family standing and at least 4,000 damage dealt by that tower. At account level 30, its Mythic upgrade opens permanently. Buy it with gold during a battle. The expensive Seraph transformations are goals for extended play. One Mythic may stand at a time.</p>'
  for (const family of ['seraph', 'barracks'] as const) {
    const item = document.createElement('div'); item.className = 'endgame-card'
    item.innerHTML = `<h3>${family === 'seraph' ? 'Helios Engine / Event Horizon' : 'Last Legion'}</h3><p>${family === 'seraph' ? 'Dawnbringer becomes a charged solar weapon. Eventide opens a temporary field that reveals enemies and amplifies team damage.' : 'The Oathgate Citadel becomes a four-soldier legion. Plant its standard to regroup, restore and support the squad.'}</p><b>${masteryReady(save, family) ? 'Mastery complete · upgrade unlocked' : masteryHint(save, family)}</b>`
    mastery.append(item)
  }
}
