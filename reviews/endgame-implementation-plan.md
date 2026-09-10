# Endgame release implementation plan

## Decision

Ship two permanent boss hunts, six hero specializations and three tier-six rewards together. The hunts supply the tactical problems, the hero paths supply different ways to solve them, and mastery rewards provide an earned reason to return. Implement them in that order. Keep the account cap at 40 and put mastery at level 30 plus demonstrated hunt victories; raising the cap to 50 now would add 26,800 XP beyond Seraph without enough different things to do.

The first hunts use Ossuary and the Veil Empress. Both already have distinctive models, combat definitions and mechanics, but are currently buried at deep post-clear waves. Bringing them into authored encounters is more valuable than adding two hurried new boss identities. Prism Warden and Ashen Conductor remain future additions requiring new encounter systems and dedicated balancing.

## Boss hunts

Unlock the hunt board at account level 25 or after clearing the campaign finale. Hunts use finite authored waves, an explicit preparation period, and Casual/Normal/Veteran choices. They are permanently available. Use existing maps with carefully chosen geometry for the initial release; no calendar dependency or separate currency.

The final audit measures roughly 11–13 minutes at normal speed without early calls. Begin with sufficient gold for a considered opening; supporting waves should fund multiple mature towers. A tier-five defense must be able to beat Normal. A mythic is an optional late investment, never the price of admission. The tuned hunt economy starts at 6,400 gold and pays 900 gold for each of the first nine cleared waves. It funds tier-five Seraph mastery and can fund Last Legion; the Seraph Mythics are explicitly described as extended-play goals because their full upgrade chains exceed short-hunt income. See hunt-balance.md for measured outcomes.

**Ossuary: The Bone Procession.** Mix armored escorts with lighter units and offer more than one useful firing position. The boss raises nearby slain escorts once as unrewarded husks. Show its resurrection radius on the ground and mark raised units with a consistent visual cue. Counterplay: focus the boss or hold and kill escorts outside its circle. Reject recursive resurrection and reward farming; inherited `noReward` and wave tags are mandatory. Telegraph the final boss before it enters.

**Veil Empress: The Fallen Crown.** Teach air coverage and short phase windows during preparation waves, then force a shift from flying boss to grounded boss. The entrance card and boss health UI must say that there are two phases. Keep the existing wing-fracture transition and clearly announce the grounded stage. Counterplay: reserve a ground defense behind the air coverage, and use reveal effects to maintain pressure during phasing. A phase replacement must preserve route, difficulty HP scale and wave ownership without awarding a first-phase kill. Poison damage must enter the same phase-transition path as direct attacks.

Hunt completion grants hunt records and XP only. It never unlocks campaign maps, grants campaign stars/trial rewards, enables freeplay, or enters campaign leaderboards by accident. A boss reaching the gate must not count as a successful boss hunt, even if a lives buffer would otherwise absorb it.

## Hero paths

Each hero earns one stamp for winning each distinct hunt while equipped. One distinct hunt unlocks its first path; both unlock its second. Casual victories can teach and unlock hero variety; family mastery requires Normal or Veteran. Wins credit participation and defense, with no last-hit requirement. Equip or remove a path freely between battles; existing in-run signature ranks remain shard purchases and strengthen the chosen ability.

| Hero/path | Actual behavior | Tactical difference |
| --- | --- | --- |
| Aldric / Bulwark | Guardian Standard retains the ground slam and plants a fixed five-second healing circle; five bounded ally-healing pulses. Can cast to heal wounded allies without enemies. | Choose a defensible rally position, then keep troops inside it. |
| Aldric / Vanguard | Breachmaker retains the slam; the strongest ground enemy takes a double hit and loses 0.20 armor. | Help physical towers break a heavy enemy instead of sustaining troops. |
| Liora / Hawkeye | Deadeye Volley concentrates damage on the three strongest enemies and pierces 65% of armor. | Trade coverage for priority-target pressure. |
| Liora / Gale Warden | Wind Corridor points toward the leading nearby foe, stays at the casting point for five seconds, and pulses damage/slow on air and ground targets within its rectangle. | Aim along the approach and catch new enemies, including flyers. |
| Zephyra / Tempest | Rolling Thunder emits three damaging, slowing rings of increasing radius at one-second intervals. | Cover a dense approach with delayed expanding area damage. |
| Zephyra / Riftbinder | Rift Anchor creates a compact five-second damage field that exposes phased enemies to the whole defense. | Enable focused tower damage during otherwise lost attack windows. |

All persistent fields are visibly bounded. They remain at the casting point when the hero moves; they expire or disappear on the hero's death. Enemy slow floors and stun recovery remain authoritative, preventing permanent boss control. Evolved names and descriptions must appear in the hero panel and signature tooltip, not only a menu card.

## Mastery and tier six

Mastery begins with two supported families, Seraph and Barracks. Win both distinct hunts on Normal or Veteran with a standing tier-five-or-higher family tower that has dealt at least 4,000 actual damage. Stamps can be earned before level 30; the upgrade opens permanently once both stamps and account level 30 are reached. The hunt board exposes this exact threshold.

Use the existing branch as the mythic choice; no extra branch menu is needed. The initial additional gold prices are:

| Tier-five branch | Tier-six reward | Additional gold | Mechanical transformation |
| --- | --- | ---: | --- |
| Seraph solar | Helios Engine | 15,000 | Independent beams charge a visibly marked, delayed ground strike. Multiple targets charge faster; enemies can walk out of the warning. |
| Seraph void | Event Horizon | 16,000 | A bounded timed rift reveals enemies and gives the entire defense a damage window. No additional stun chain. |
| Barracks defensive | Last Legion | 14,000 | A standard at the chosen rally position recalls/restores an elite squad and temporarily sustains nearby allies. Moving the rally changes the next formation. |

Other branches continue to end at tier five. Mythics use distinct silhouettes, names, tier badges and upgrade previews. Preserve the direct seven-beam Seraph identity. Limit the shared defense to one standing tier-six tower, including co-op; selling it frees the slot. Compute refunds from actual invested tier-six gold, and clear timed effects when selling. The check belongs in the deterministic purchase handler as well as the UI.

## Persistence, co-op and replay

- Store a bounded, validated monotonic `honors` identifier set and mutable `heroPaths` loadout. Merge honors by union and choices by actual write timestamp. Add both to local parsing, export/import, cloud sanitization, server validation and cloud application. Old saves default to no honors/paths; existing stars, roster and XP remain intact.
- Freeze unlock/loadout data at battle start. A local cloud update during a co-op run must not change which commands one client considers legal. Every client must receive the same hero paths and mastery permissions. Check the single-mythic limit against the shared board at command execution so simultaneous requests resolve deterministically.
- Record hunt identity, hero paths and loadout in run metadata. Journal player choices through the same deterministic command route; timed fields use simulation time and seeded damage rolls. Include specialization and new mechanics in state hashes where appropriate.
- Bump the ruleset once for this gameplay release. Existing checkpoint invalidation is preferable to silently continuing ruleset-seven battles under changed rules. New resumable hunts require hunt identity and frozen run permissions; snapshot signature rank/cooldown and mastery qualification progress as well as hero level/XP.
- Cleared-wave checkpointing cannot omit still-active hero fields. Delay the checkpoint until fields expire, or serialize those fields completely. Replaying a deterministic journal from the start also reconstructs them, provided result rewards cannot be paid twice during reconstruction.
- Enemy exposure needs a timed `revealedUntil` source merged with beacon reveal each simulation step. Setting `revealed = true` once fails because the current reveal pass resets it.

## Verification and release risks

Test each hero path against its actual effects: selection rejection, healing boundaries/dead allies, heavy-target priority, corridor direction and flyers, expanding pulses, phased targets, expiry and boss control limits. Test finite authored hunt waves, phase replacement under direct and poison damage, unrewarded summons, boss leaks, reward idempotence and result isolation. Test the exact mastery gate and purchase/refund/slot transitions, including simultaneous co-op purchases. Migration tests need missing fields, invalid IDs, export/import and cloud union/newest-choice behavior.

Use deterministic runs to compare at least two viable Normal strategies per hunt without tier six. Verify that the mastery tower can qualify. Explicitly separate the short-hunt budget from the extended-play economy needed by Seraph Mythics. Browser checks need the entire unlock/equip/start/result/upgrade path, narrow touch layouts, late crowded boards and all new silhouettes. Co-op must agree across differing account saves, reconnect/replay and game-speed changes. A passing typecheck alone does not validate the encounter economy or the readability of its warnings.

The largest risks are runaway scope, level-gated repetition, mythics priced beyond hunt income, run rewards leaking into campaign progression, cross-client unlock divergence, poison skipping the Empress's second phase, and checkpoint loss of temporary effects. The bounded roster and explicit mode/loadout boundaries above address those risks directly.
