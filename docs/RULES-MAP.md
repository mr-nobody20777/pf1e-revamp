# Rules map

How the Pathfinder 1e rules that PF1e Revamp touches connect: the **rule points** an attack (or save, or damage) passes through, who already handles each one (the PF1 system, other modules, this module), which kinds of sources change it, and how they interact. Built up one area at a time from the research documents (`SNEAK-ATTACK-RESEARCH.md`, `RANGED-COMBAT-RESEARCH.md`); read it before designing a feature to see what else it touches.

Owners: **PF1** (the system), **RB** (Roll Bonuses), **NAS** (Nevela's Automation Suite), **Revamp** (this module), **–** (nobody).

## An attack, in order

| # | Rule point | What happens | Owner | Revamp code |
|---|---|---|---|---|
| 1 | Targeting and line of effect | Target in range and in line of effect; total cover blocks | PF1 (range highlight), RB (max range) | – |
| 2 | Attack window choices | Flanking, higher ground, charge, Point-Blank Shot, Rapid Shot, Manyshot, Deadly Aim, Power Attack, fighting defensively, talent riders | PF1, RB (ticks Flanking) | `roll-effects.mjs` (buffs, flags, dropdowns) |
| 3 | Attack bonus | BAB, ability, size, buffs and conditions (typed, highest of a type), situational bonuses | PF1, Revamp (roll window) | `roll-effects.mjs`, `fortune.mjs`, `quarry.mjs`, `studied-target.mjs` |
| 4 | Range penalty | –2 per full increment beyond the first; feats and items change it | RB | – (ranged combat phase 1) |
| 5 | Shooting into melee | –4 (–2, 0 by size), Precise Shot | RB | – |
| 6 | Cover | +4 AC (soft from creatures, partial +2, improved +8) | – | – (deferred: stays manual) |
| 7 | AC the attack targets | Normal, touch (rays, splash, early firearms within one increment), flat-footed | PF1 | – |
| 8 | Concealment and miss chance | Rolled after a hit; highest applies | NAS (Concealed condition), Revamp | `miss-chance.mjs` |
| 9 | Critical threat and confirmation | Threat range, confirmation roll | PF1 | `traits.mjs` (confirmation bonuses) |
| 10 | Fortification | Chance to negate a crit or sneak attack | Revamp | `fortification.mjs` |
| 11 | Damage roll | Weapon, ability (Strength rules differ for thrown and projectile weapons), bonuses, precision dice (not multiplied), crit multiplier | PF1, Revamp | `roll-effects.mjs`, `sneak-attack.mjs`, `sneak-talents.mjs` |
| 12 | Card riders | Effects to apply once the hit is judged (bleed, ability damage, conditions, negations) | Revamp | `sneak-talents.mjs`, `fortification.mjs`, `bleed.mjs` |
| 13 | Damage application | Ratio (halving minimum 1), immunity (including precision/nonlethal modifiers), DR, energy resistance, hardness | PF1 (dialog), Revamp (quick apply) | `resistance.mjs` |
| 14 | Ongoing effects | Bleed, durations, start/end of turn costs | PF1 (buff durations), Revamp | `bleed.mjs`, `raging-song.mjs` |
| 15 | Ammunition | Choose, consume, recover 50% | PF1 | – |
| 16 | Action economy | Reload actions, drawing thrown weapons, AoO for shooting or reloading while threatened | – | – (ranged combat) |

## Interactions to remember

- **Precision damage** (sneak attack and others): not multiplied on crits (#11), once per Manyshot volley, blocked by immunity at #13 (not revealed earlier), negated by fortification at #10, lost against splash weapons, requires the target not be concealed (#8) unless an ability allows it.
- **Concealment** (#8) affects both the miss chance and whether precision damage applies; cover (#6) affects AC only and whether attacks of opportunity are possible.
- **Same-type bonuses** don't stack (#3): the roll window's provided entries and PF1's changes share one "highest of a type" rule (`roll-effects.mjs` TYPED).
- **Range** (#4) feeds several other points: sneak attack's 30 ft limit, Point-Blank Shot's 30 ft, early firearms' touch AC within one increment, Focused Shot, Eagle-Eyed beyond 100 ft.
- **The attack window's checkboxes** (#2) change what applies at #3–#11 (Flanking enables sneak attack); when they change, the roll window rebuilds and keeps the player's choices.
- **Damage changes after the hook:** PF1 adds damage changes, extra parts and the ability modifier to the first damage part after `pf1PreDamageRoll`; anything that must remove damage (fortification) has to account for it.

## Slices

### Sneak attack (done: phases 1–3)
Sources: class features (dice), talents (riders and dice changes), feats/items/traits/spells (dice, bonuses, range, concealment). Rule points: #2 (talent dropdown, Flanking), #4 (30 ft range, Deadly Range, Sniping, Sniper Goggles), #8 (concealment blocks unless Sniper's Eye, Shadow Strike…), #10 (fortification), #11 (precision dice), #12 (riders), #13 (immunity). Research: `SNEAK-ATTACK-RESEARCH.md`.

### Ranged combat (researched)
Sources: base rules, about 350 feats/traits/racial traits, 245 class features, 132 spells, 46 weapon and armor abilities, 134 wondrous items. Rule points: #1, #2 (Point-Blank Shot), #4 (range modifiers to feed RB), #5, #6 (cover), #7 (touch AC for firearms), #8 (miss chances against ranged attacks), #13 (DR against ranged weapons: Protection from Arrows), #15, #16 (reloading, thrown weapons, AoO). Research: `RANGED-COMBAT-RESEARCH.md`.
