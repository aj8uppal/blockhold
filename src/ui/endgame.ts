import type { SaveData } from '../core/save.ts'
import { writeSave } from '../core/save.ts'
import type { Difficulty, HeroId } from '../game/types.ts'
import { HUNTS, huntAccess, heroHunts, masteryReady, type HuntId } from '../game/hunts.ts'
import { isUnlocked, levelForXp } from '../game/progress.ts'
import { HERO_DEFS } from '../game/hero.ts'
import { HERO_PATHS, heroPath } from '../game/heroPaths.ts'
import { icon } from './icons.ts'

export function renderEndgame(root: HTMLElement, save: SaveData,
  play: (id: HuntId, difficulty: Difficulty, hero: HeroId) => void, back: () => void): void {
  const wrap = document.createElement('div'); wrap.className = 'screen endgame-screen'; root.append(wrap)
  wrap.innerHTML = `<div class="endgame-top"><button class="btn ghost small endgame-back">← Main menu</button><span>Endgame challenges</span></div>
    <header class="endgame-heading"><h1>Boss hunts</h1><p>Hold ten waves, defeat a boss, and earn new abilities for your champion.</p></header>
    <div class="endgame-next" role="status"></div>
    <div class="endgame-loadout"><label>Champion <select class="endgame-hero" aria-label="Champion"></select></label><label>Difficulty <select class="endgame-difficulty" aria-label="Hunt difficulty"><option value="casual">Casual · learn the encounter</option><option value="normal">Normal · earn mastery</option><option value="veteran">Veteran · harder challenge</option></select></label></div>
    <div class="endgame-grid endgame-hunts"></div>
    <details class="endgame-disclosure endgame-paths"><summary></summary><div class="endgame-detail-body"></div></details>
    <details class="endgame-disclosure endgame-mastery"><summary>Mythic upgrades <span>Tier-six rewards & requirements</span></summary><div class="endgame-detail-body"></div></details>`
  wrap.querySelector<HTMLButtonElement>('.endgame-back')!.onclick = back
  const available = Object.values(HERO_DEFS).filter(def => isUnlocked(save, 'hero', def.id))
  let hero = (available.some(def => def.id === save.lastHero) ? save.lastHero : 'aldric') as HeroId
  let difficulty: Difficulty = heroHunts(save, hero) === 0 ? 'casual' : 'normal'
  const heroSelect = wrap.querySelector<HTMLSelectElement>('.endgame-hero')!
  const difficultySelect = wrap.querySelector<HTMLSelectElement>('.endgame-difficulty')!
  for (const def of available) {
    const option = document.createElement('option'); option.value = def.id; option.textContent = def.name; heroSelect.append(option)
  }
  heroSelect.value = hero; difficultySelect.value = difficulty
  const canHunt = huntAccess(save)
  const paths = wrap.querySelector<HTMLDetailsElement>('.endgame-paths')!
  const grid = wrap.querySelector<HTMLDivElement>('.endgame-hunts')!
  const next = wrap.querySelector<HTMLDivElement>('.endgame-next')!

  const paint = () => {
    const champion = HERO_DEFS[hero], count = heroHunts(save, hero)
    const equipped = heroPath(hero, save.heroPaths?.[hero])
    const recommended = HUNTS.find(h => !save.honors?.includes(`hero:${hero}:${h.id}`)) ?? HUNTS[0]
    next.innerHTML = !canHunt
      ? `<b>Your next step: reach account level 25.</b><span>You are level ${levelForXp(save.xp)}. Clearing Tidereach also opens both hunts.</span>`
      : count < 2
        ? `<b>Next: win ${recommended.name} with ${champion.name}.</b><span>Unlock ${HERO_PATHS[hero][count].name}, a new version of your champion’s signature. Any difficulty counts.</span>`
        : '<b>Both hero paths earned. Try a new defense.</b><span>Normal and Veteran wins can also earn tower mastery. See Mythic upgrades below.</span>'
    grid.replaceChildren()
    for (const hunt of HUNTS) {
      const completed = save.honors?.includes(`hunt:${hunt.id}:${difficulty}`)
      const newHeroWin = !save.honors?.includes(`hero:${hero}:${hunt.id}`)
      const card = document.createElement('section'); card.className = `endgame-card hunt-card${canHunt && count < 2 && hunt.id === recommended.id ? ' recommended' : ''}`
      card.innerHTML = `<div class="endgame-kicker">${hunt.id === 'ossuary' ? 'Ground assault · rising escorts' : 'Air & ground · two boss phases'}${completed ? ' · Cleared ✓' : ''}</div>
        <h2>${hunt.name}</h2><p>${hunt.id === 'ossuary' ? 'Break the bone colossus. Enemies killed near it rise once more.' : 'Break the Empress’s wings, then stop her armored ground form.'}</p>
        <div class="hunt-reward">${newHeroWin ? `${champion.name} victory → ${count === 0 ? HERO_PATHS[hero][0].name : HERO_PATHS[hero][1].name} path` : 'Replay for XP and a different defense.'}</div>`
      const start = document.createElement('button'); start.className = `btn hunt-start${hunt.id === recommended.id ? ' primary' : ''}`
      start.textContent = 'Start hunt'; start.setAttribute('aria-label', `Start ${hunt.name}`)
      start.disabled = !canHunt
      start.onclick = () => play(hunt.id, difficulty, hero)
      card.append(start)
      const advice = document.createElement('details'); advice.className = 'hunt-advice'
      advice.innerHTML = `<summary>How to beat this boss</summary><p>${hunt.briefing}</p>`
      card.append(advice); grid.append(card)
    }
    paths.querySelector('summary')!.innerHTML = `Champion abilities <span>${champion.name} · ${equipped?.name ?? 'Original signature'} · ${count}/2 paths earned</span>`
    const body = paths.querySelector<HTMLDivElement>('.endgame-detail-body')!
    body.innerHTML = '<p>Win one hunt with this champion to unlock the first path; win both different hunts to unlock the second. Choose freely between battles.</p>'
    const choices = document.createElement('div'); choices.className = 'endgame-grid'; body.append(choices)
    for (const [index, path] of HERO_PATHS[hero].entries()) {
      const unlocked = count >= index + 1
      const button = document.createElement('button'); button.className = `endgame-card path-option${equipped?.id === path.id ? ' picked' : ''}`
      button.innerHTML = `<h3>${icon(path.icon)} ${path.name}</h3><b>${path.abilityName}</b><p>${path.blurb}</p><small>${unlocked ? equipped?.id === path.id ? 'Equipped' : 'Equip path' : index === 0 ? `Win either hunt with ${champion.name}` : `Win both hunts with ${champion.name} (${count}/2)`}</small>`
      button.disabled = !unlocked
      button.onclick = () => { save.heroPaths = { ...save.heroPaths, [hero]: path.id }; writeSave(save); paint() }
      choices.append(button)
    }
    const baseline = document.createElement('button'); baseline.className = 'btn ghost small'
    baseline.textContent = equipped ? `Use original ${champion.ability.name}` : `${champion.ability.name} equipped`
    baseline.disabled = !equipped
    baseline.onclick = () => { if (save.heroPaths) delete save.heroPaths[hero]; writeSave(save); paint() }; body.append(baseline)
  }
  heroSelect.onchange = () => { hero = heroSelect.value as HeroId; save.lastHero = hero; writeSave(save); paint() }
  difficultySelect.onchange = () => { difficulty = difficultySelect.value as Difficulty; paint() }
  paint()

  const mastery = wrap.querySelector<HTMLDivElement>('.endgame-mastery .endgame-detail-body')!
  mastery.innerHTML = '<p>Earn a permanent tier-six upgrade for a tower family. These are goals after your first hunt wins.</p><ol><li>Reach account level 30.</li><li>Win both hunts on Normal or Veteran. In each win, finish with one tier-five tower of that family still standing and at least 4,000 damage dealt by that tower.</li><li>Buy its Mythic upgrade with battle gold. Only one Mythic can stand in the shared defense.</li></ol>'
  for (const family of ['barracks', 'seraph'] as const) {
    const item = document.createElement('div'); item.className = 'endgame-card'
    const progress = HUNTS.map(h => `${save.honors?.includes(`mastery:${family}:${h.id}`) ? '✓' : '○'} ${h.name}`).join(' · ')
    item.innerHTML = `<h3>${family === 'seraph' ? 'Seraph · Helios Engine / Event Horizon' : 'Barracks · Last Legion'}</h3><p>${family === 'seraph' ? 'Charge a solar strike or open a field that exposes enemies. Additional cost: 15,000 / 16,000 gold; save for these during extended play.' : 'Recall and restore an elite squad at your rally point. Additional cost: 14,000 gold, from Oathgate Citadel.'}</p><b>${masteryReady(save, family) ? 'Unlocked · available at tier five' : `Level ${Math.min(30, levelForXp(save.xp))}/30 · ${progress}`}</b>`
    mastery.append(item)
  }
}
