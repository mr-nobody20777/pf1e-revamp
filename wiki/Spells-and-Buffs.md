# Spells and Buffs

- [Spells on their targets](#spells-on-their-targets)
- [Miss chances](#miss-chances)
- [Alignment wards](#alignment-wards)
- [One-roll buffs](#one-roll-buffs)
- [Buffs applied for you](#buffs-applied-for-you)
- [Save bonuses from buffs](#save-bonuses-from-buffs)
- [Buff Library compendium](#buff-library-compendium)

PF1e Revamp recognizes spell buffs from PF1 and **Pathfinder 1e Content** by name, so there is nothing special to use: put the buff on a character as usual and it does what the spell says.

---

## Spells on their targets

PF1 rolls a spell's attack and damage and adds a save button, but it doesn't say who is affected, check spell resistance, or apply what a failed save does. With PF1e Revamp, a spell's card lists every creature it affects (your targets, or the creatures in its template), one row each.

**What happens in each row**
- **Spell resistance** is rolled for you (1d20 + caster level, +2 each for Spell Penetration, Greater Spell Penetration and Elven Magic). Everyone sees the roll and whether it got through; only the GM sees the SR value.
- **Touch and ray spells** are checked against touch AC; only the GM sees the AC. Many touch spells have no attack roll in PF1's data (Touch of Fatigue, Touch of Blindness), so PF1e Revamp rolls the touch attack for them. Allies accept a touch without a roll.
- **Saving throws** are rolled from the row by the creature's owner, or by the GM for NPCs. PF1's own save button on the card works too. A natural 1 always fails and a natural 20 always succeeds.
- **The result is applied** as soon as it's known: conditions with their duration, the spell's buff at the caster's level, or a penalty. The row says what was applied. Conditions end on time in combat and out of it.
- **Damage** stays with PF1's damage buttons; the row says whether the creature takes full damage, half, or (for a cure spell on the living) healing.

**Rules it follows**
- **Harmless spells on allies** (Bless, Shield of Faith, Enlarge Person on a friend) need no save and no spell resistance check.
- **Personal spells** affect the caster.
- **Immunities are found when the spell lands**, never shown beforehand. An unaffected creature's row says "unaffected"; the GM also sees why. Checked: mind-affecting immunity (undead, constructs, plants and mindless creatures), undead and constructs against Fortitude effects, Hit Dice limits, creature types ("person" spells affect humanoids), sightless creatures, and condition immunities such as an elf's immunity to sleep.
- **Fear stacks**: a shaken creature made shaken again becomes frightened, and a frightened creature made shaken or frightened becomes panicked.
- **A row for a hidden token** is shown to the GM only.
- **Scrolls, wands and potions** of a spell work the same way.

**Spells with automated effects**

| Spells | Effect |
|---|---|
| Daze, Daze Monster | Dazed 1 round (Daze: humanoids of 4 HD or less), then immune to that spell for 1 minute |
| Flare, Flare Burst | Dazzled 1 minute |
| Touch of Fatigue, Litany of Weakness, Frostbite | Fatigued |
| Cause Fear | Frightened 1d4 rounds, or shaken 1 round on a save (5 HD or less) |
| Doom | Shaken 1 minute per level |
| Color Spray | By Hit Dice: 2 HD or less unconscious, blinded and stunned; 3–4 HD blinded and stunned; 5 HD or more stunned 1 round |
| Sleep, Hypnotism | A pool of Hit Dice (4, or 2d4), fewest HD first, then nearest; asleep, or fascinated |
| Lesser Confusion, Entangle, Grease, Vanish, Ear-Piercing Scream, Ray of Sickening | Confused, entangled, prone, invisible, dazed, sickened |
| Ray of Enfeeblement, Touch of Gracelessness | Strength or Dexterity penalty of 1d6 + 1 per two caster levels (max +5), halved on a save; a lower penalty doesn't replace a higher one |
| Chill Touch | Melee touch attack; 1d6 negative energy damage and 1 Strength damage on a failed Fortitude save. Undead instead make a Will save or are panicked. |
| Mudball | Ranged touch attack; blinded until a Reflex save at the start of its turn succeeds |
| Shadow Trap, Unlock Flesh | Entangled, staggered; a new save each turn |
| Sotto Voce, Endothermic Touch, Touch of Blindness, Nauseating Dart, Touch of Bloodletting, Advanced Scurvy | Shaken, staggered, blinded, nauseated, exhausted, fatigued |
| Itching Curse, Ironbeard, Hairline Fractures, Delusional Pride, Negative Reaction | Their bonuses or penalties, on a buff named after the spell |
| Bless, Bane | The buff on the allies (Bless) or enemies (Bane) in the area |
| Shield, Divine Favor, True Strike, Entropic Shield, Expeditious Retreat, Longstrider, Aspect of the Falcon, Lead Blades, and other personal spells | The buff on the caster |
| Resistance, Virtue, Shield of Faith, Mage Armor, Enlarge Person, Reduce Person, Magic Fang, Magic Weapon, Bless Weapon, Jump, Sanctuary, Remove Fear, Protection from Chaos/Evil/Good/Law, Faerie Fire and about 30 more | The spell's buff on each creature affected |
| Charm Person, Charm Animal, Calm Animals, Command, Hideous Laughter, Lock Gaze, Paranoia and similar | A buff named after the spell marks the creature for the duration, with a reminder of what it does |
| Stabilize, Bleed | Stabilized, or bleeding again (a living creature below 0 hit points) |

**Save modifiers.** Hypnotism's +2 in combat (−2 for a lone creature out of combat) and Hideous Laughter's +4 for a creature of a different type from the caster appear as ticked entries in the save window.

**New saves to end an effect.** On the affected creature's turn in combat, a card offers its owner and the GM a new save:
- **Hideous Laughter**: once, on its next turn. Failure means it lasts the full duration.
- **Mudball**, **Shadow Trap** and **Unlock Flesh**: every turn until a save succeeds, which ends the effect.

**Fixes to PF1's spell data**
- **Magic Missile** rolls 1d4+1 per missile (up to five at 9th level) and needs no attack roll.
- **Cure spells harm undead and inflict spells heal them**: the card's healing button damages an undead creature, and its damage button heals one.
- **Disrupt Undead** only affects undead.

Not automated: Entangle's saves while a creature stays in the area, Grease's Acrobatics checks, Command's chosen command and splitting Magic Missiles between targets (the row reminds the GM).

With **Nevela's Automation Suite**, a spell buff that Nevela applies itself is left to Nevela, and the row says so. PF1e Revamp applies the buffs Nevela doesn't have. See [Compatibility](Compatibility).

## Miss chances

When someone attacks a creature with one of these effects, the miss chance is **rolled for every attack** and shown under it on the card: red means a miss, green a hit.

| Effect | Miss chance |
|---|---|
| **Blur** | 20% |
| **Displacement** | 50% |
| **Blink** | 50% (20% if the attacker sees invisible creatures or uses a ghost touch or force attack). Single-target spells against a blinking creature have a 50% chance to fail, and the blinker's own attacks have 20%. |
| **Entropic Shield** | 20%, ranged attacks only |
| **Crystalline Dust** | 20% |
| Target is **invisible** and the attacker can't see invisible creatures | 50% |
| Attacker is **blinded** | 50% |

- **Miss chances don't stack**: only the highest is rolled.
- **True seeing** negates Blur and Displacement; **see invisibility** doesn't, but reduces Blink.
- **Blind-Fight** rerolls a concealment miss in melee. See [Feats](Feats#blind-fight).
- With **Nevela's Automation Suite**, its *Concealed* condition is left to Nevela; if a buff gives a higher miss chance, Nevela's roll is struck through so only one counts.

## Alignment wards

Protection from Evil, Good, Chaos and Law (+2) and Holy Aura, Unholy Aura, Shield of Law and Cloak of Chaos (+4) now work only against the opposed alignment:
- **AC:** when a creature of that alignment attacks, the target's AC on the card includes the deflection bonus.
- **Saves:** saves against that creature's effects get the resistance bonus.
- **No stacking:** if the character already has a higher deflection or resistance bonus, nothing is added.

## One-roll buffs

"On your next roll" bonuses appear as a ticked box in the roll window, such as **☑ Guidance +1 (one roll)**. Leave it ticked to use the bonus now, or untick it to save it. Rolls without a window (shift-click) use it automatically. Cancelling the window doesn't use it up.

| Buff | Effect |
|---|---|
| **True Strike** | +20 on your next attack roll (the first, if you make several), then it ends |
| **Guidance** | +1 on your next attack roll, saving throw or skill check, then it ends |
| **Bit of Luck** (Luck domain) | For a round, every d20 is rolled twice and the better kept. See [Classes](Classes#luck-domain-bit-of-luck). |
| **Prescience** (Foresight wizard) | A stored d20 you choose when to use. See [Classes](Classes#foresight-subschool-prescience). |

## Buffs applied for you

Casting **Guidance**, or using **Bit of Luck** or **Resistant Touch**, puts the buff on your target (yourself if no one is targeted; Resistant Touch needs an ally). Recasting on someone who already has it switches it back on. If Nevela's Automation Suite applies that buff itself, PF1e Revamp leaves it to Nevela.

## Save bonuses from buffs

Buffs that give a save bonus against a kind of effect apply it when the save is rolled from that effect's card:
- **Remove Fear**: +4 morale vs fear
- **Death Ward**: +4 morale vs death spells and effects
- **Mind Blank**: +8 resistance vs mind-affecting effects, minus any resistance bonus you already have

Details in [Combat Rules](Combat-Rules#save-bonuses-against-effects).

## Buff Library compendium

The module's **Buff Library** compendium has buffs that PF1 and Pathfinder 1e Content don't: **Protection from Spells**, **Spider Climb** (climb speed 20 ft) and **True Strike**.
