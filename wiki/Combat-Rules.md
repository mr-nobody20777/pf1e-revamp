# Combat Rules

- [Buffs on a roll](#buffs-on-a-roll)
- [Save bonuses against effects](#save-bonuses-against-effects)
- [Energy resistance](#energy-resistance)
- [Miss chances](#miss-chances)

---

## Buffs on a roll

**Before:** PF1 adds up every buff and condition into one number. You couldn't see which ones counted, which lost to a higher bonus of the same type, or leave one out for a single roll without switching the buff off.

**Now:** attack, save, skill and ability-check windows have a **Buffs** line.

- **A few effects** (4 or fewer by default) show right in the window as small chips. Untick one to leave it out of this roll.
- **More than that**, the line shows the totals instead, e.g. *Attack +7 · Damage +8 from 8 effects · 4 not applied*, and a **Manage…** button opens a small window listing every effect:
  - grouped into **Attack only**, **Damage only** and **Attack and damage** (saves and skills have one group), with each effect's value and bonus type;
  - ability-score buffs combine into one row per ability (*Strength +8*), which expands to its sources (Rage, Bull's Strength, Enlarge Person);
  - **Not Applied** lists bonuses that don't stack (*Bless · Heroism is higher*) and situational bonuses that don't apply right now (*Studied Target · your target isn't studied*).
- **Changes apply to that one roll only.** The chat card shows them as one labeled part, e.g. *−2 [Buffs: Heroism, Greater off; Heroism on]*.

### The rules it follows
- Stacking is PF1's own: bonuses of the same type don't stack (the highest counts); dodge, untyped, circumstance and racial bonuses stack; penalties always stack.
- A bonus that loses to a higher one can be ticked only after everything beating it is turned off, and it never moves up on its own.
- **Conditions** (shaken, sickened...) are marked 🔒: only the GM can turn them off for a roll. Everything else, anyone can change.
- Situational bonuses that don't apply right now can be ticked by anyone, for theater-of-mind play: Studied Target or Quarry when that creature isn't targeted, an alignment ward when the save's source isn't known or isn't of that alignment, a bonus "vs fear" on a save that isn't against fear.
- The module's own bonuses follow the same stacking: Quarry's insight bonus doesn't add to True Strike's (only the +20 counts on that attack).
- The Weapon Finesse shield penalty (armor check penalty on a finessed shield bash) is imposed by the rules: 🔒, GM only.
- Rolls made without a window (shift-click) use PF1's totals plus the situational bonuses that apply.

How many effects show as chips is a per-player setting: see [Settings](Settings).

## Save bonuses against effects

**Before:** bonuses like *"+2 racial bonus on saves vs. fear"* or *"+4 morale vs. death spells"* appeared as reminders on the save, to be added by hand.

**Now:** when a save is rolled **from the effect's chat card** (the save button on a spell's card), PF1e Revamp looks at what the effect is: its school, subschool and descriptors, and whether it's a spell or a spell-like ability. Every matching bonus the character has is then added to the roll.

It understands bonuses against:

| Kind | Examples |
|---|---|
| **Descriptors** | fear, mind-affecting, emotion, death, poison, disease, curse, pain, fire, cold, acid, electricity, sonic |
| **Schools and subschools** | enchantment, illusion, necromancy (and the other schools), charm, compulsion, polymorph |
| **Spells and spell-like abilities** | "against spells", "against spell-like abilities" |

The bonuses can come from anywhere on the character: race, racial traits, character traits, feats and buffs. Some examples:

- **Halfling** +2 vs fear: applies against *Cause Fear*, not against *Charm Person*.
- **Dwarf** +2 vs poison, spells and spell-like abilities: applies against *Poison*, and against any spell.
- **Elf / Half-Elf** +2 vs enchantment: applies against *Charm Person*, not against *Cause Fear*.
- **Remove Fear** +4 vs fear; **Death Ward** +4 vs death spells; **Mind Blank** +8 vs mind-affecting.
- The **Lonely** drawback: −2 vs charm spells and spell-like abilities.

### Stacking follows the rules
- **Racial, untyped, dodge and circumstance** bonuses stack. Halfling *Fearless* stacks with Halfling Luck, as the trait says.
- **Every other type** (morale, resistance, luck, sacred…) only uses the **highest**, and only the part above a bonus of that type the character already has. *Mind Blank*'s +8 resistance on top of a *Cloak of Resistance +1* adds 7.
- The same racial bonus stated on both the race and one of its racial traits counts **once**.

### Reminder notes on the card
PF1 lists an item's save notes under the roll ("+2 vs fear effects"). When PF1e Revamp has already added that bonus to the roll, the note is ticked and faded, with "already added to this roll" on hover, so nobody adds it a second time.

### Rolling for the right creature
PF1's save button on a card rolls for whatever token you have selected (or your own character). If that isn't one of the card's targets, PF1e Revamp warns you who it's rolling for. The roll still goes ahead, so the GM can roll for anyone on purpose.

### When it doesn't apply
- **Saves rolled without the effect's card** (typed in or rolled from the sheet) get no automatic bonus. The reminders still show on the roll.
- **Bonuses against creatures** ("vs. evil creatures") are handled by the alignment wards, not here.
- **Conditional bonuses** ("when adjacent to an ally", "once per day") and notes about immunities or rerolls are left as reminders, because the module can't know whether the condition is met.

## Ranged combat

Range penalties and shooting into melee come from **Roll Bonuses**, which PF1e Revamp builds on rather than duplicating: Roll Bonuses applies –2 per full range increment beyond the first, refuses attacks beyond the weapon's maximum range, and applies the shooting-into-melee penalty (with Precise Shot). Without Roll Bonuses, the range changes below have no effect; Point-Blank Shot and the roll-window bonuses still work.

### Point-Blank Shot
PF1's Point-Blank Shot checkbox gives +1 on attack and damage rolls at any distance. PF1e Revamp ticks it when every target is within 30 ft (measured between the nearest squares) and leaves it off beyond, both in the attack window and for attacks rolled without it. You can still change the box by hand. Mythic Point-Blank Shot adds its extra +1 in the roll window; with Arc Slinger, a sling counts its whole first range increment.

### Range changes passed to Roll Bonuses
These are recognized on the character and adjust Roll Bonuses' range penalty automatically, with no setup on the item:

- **Smaller penalty per increment:** Far Shot (–1 per increment), the sniper's accuracy (halved, with bows and crossbows).
- **Penalty reduced by 2:** Distance Thrower (thrown weapons), Arc Slinger (slings), Wasteland Hunter (thrown clubs, spears and javelins), Hunter's Eye (the second increment, bows). A reduction never becomes a bonus.
- **Longer range increment:** Longshot (+10 ft), Hawkeye (+5 ft per 4 levels, bows), Roving Range (+5 ft, not thrown), the Belt of Mighty Hurling and Bomber's Eye (+10 ft, thrown), Skilled Thrower (+10 ft, thrown), the Winding Path Renegade (+10 ft), the flying blade (+5 ft per 4 levels and +5 ft from precise throw, daggers and starknives). Distance weapons and Raging Hurler (thrown, while raging) double it, after the additions.

### Bonuses that depend on distance
Shown in the roll window, where they can be unticked (or ticked when not detected):

- **Eagle-Eyed:** +2 circumstance against targets more than 100 ft away.
- **Observant Archer:** +1 trait when the target is at least 10 ft above or below you (token elevation).
- **Canopy Shooter:** +1 trait damage with Higher Ground ticked and the target within 30 ft.
- **Improved Charging Hurler:** +2 damage on a charge with a thrown weapon within 30 ft.
- **Bomber's Eye:** +1 insight on thrown weapon attacks.
- **Focused Shot:** your Intelligence modifier on damage with a bow or crossbow within 30 ft. It needs a standard action, so it is listed under Not Applied: tick it for a single attack.

### Defenses against ranged attacks

**AC on the card.** When something changes a target's AC against a ranged attack, the attack card shows the adjusted AC under the attack and whether the roll hits, to the GM and the target's owner only (players don't see enemy statistics):

- prone: +4 (+6 with Prone Shooter); PF1's Prone condition doesn't apply this itself;
- deflection against ranged weapons: Bullet Shield (+4, +1 per 5 caster levels, up to +8), Arrowmaster's Bracers (+1), arrow catching shields (+1). Deflection bonuses don't stack, so only the part above the target's existing deflection bonus counts;
- Low Profile (+1 dodge), Breeze-Kissed (+2 against nonmagical ranged attacks), Charau-Ka Slayer (+1 against thrown weapons), rebounding shields (+2 against thrown weapons), Armor of Arrow Attraction (–15).

**Deflecting.** A target that can deflect a ranged weapon attack gets a **Deflect** button on the card for its owner or the GM: Deflect Arrows (and the ninja trick, duelist, juggler and Ulfen Guard versions), Missile Shield with a shield, Vambraces of Defense, Wicked Wings (when not flying), an arrow deflection shield (the button rolls its Reflex save, DC 20 plus the attack's enhancement bonus) and Cut from the Air (the defender's melee attack must beat the shown total). It works once per round (more with the mythic versions), not while flat-footed, and not against natural attacks, spells or rays. The card then marks the attack "deflected: no damage" (or "caught" with Snatch Arrows).

**Damage reduction against ranged weapons.** Applied when ranged weapon damage is applied from the card: Protection from Arrows (DR 10/magic, used up after absorbing 10 points per caster level, up to 100; the buff ends then), Arrowmaster's Bracers (DR 5/magic), the archer's ranged defense (DR 5/–). The best one applies; a weapon with an enhancement bonus overcomes /magic. With PF1's Apply Damage dialog, the GM applies it there.

**Shooting while prone.** Firing a bow or sling (without Prone Slinger) while prone gives a warning: only crossbows, shuriken and firearms can be used prone.

Not automated: **wind** (the GM's call, along with Weathered Warrior, Storm Hunter and similar), cover.

Not automated yet: range changes that depend on something the module can't see (Strong Arm, Supple Wrist; Ki Range; Unfolding Wind Strike; steady aim; Bull's Eye), reloading, and firearms. See the roadmap.

## Sneak attack

Attacks add the dice of every Sneak Attack class feature the attacker has (from PF1's own formula on each feature; dice from different classes stack) when the module detects that they apply:

- **The target is denied its Dexterity bonus to AC:** flat-footed, blinded, cowering, helpless, paralyzed, pinned, stunned, unconscious, asleep or petrified; a buff that removes its Dexterity bonus; or the attacker is invisible and the target can't see invisible creatures.
- **Or the attacker flanks the target** (melee only): the attack window's Flanking box, which Roll Bonuses ticks automatically if installed.

It is not applied when:

- a ranged attack is beyond 30 ft (Deadly Range adds 10 ft each time it is taken);
- the target has concealment (Sniper's Eye allows ranged attacks within 30 ft against a target without total concealment);
- the target has Uncanny Dodge and is only flat-footed or facing an invisible attacker, or has Improved Uncanny Dodge and the attacker doesn't have at least four more levels in sneak attack classes;
- there is no single target.

The dice are added as their own part of the damage roll ("2d6[Sneak Attack]"), typed as precision damage as well as the weapon's type, so a creature immune to precision damage takes none of it when the damage is applied. Immunity is deliberately not shown before the attack: the roll window offers sneak attack whenever its conditions are met, and the attacker finds out when the damage lands. Immune creatures are oozes, elementals, incorporeal creatures (unless the weapon has ghost touch), amorphous creatures, creatures under gaseous form, elemental body III/IV or particulate form, and any creature with a precision damage immunity. They are not multiplied on a critical hit and count only once per Manyshot volley; dice of different sizes are rolled separately ("3d6 + 1d8"). Attacks rolled without the attack window (shift-click) use PF1's own Flanking setting. The roll window lists sneak attack with the reason it applies; untick it if the GM rules that the attacker can't see or reach a vital spot. When it wasn't detected, it is listed under **Not Applied** with the reason and can be ticked by hand.

### Sneak attack talents

When the character has talents that change sneak attack, the attack window shows a **With:** dropdown next to the sneak attack entry. Per the rules, only one such talent applies to an attack and it is chosen before rolling; on a full attack the choice covers every sneak attack in it. The dropdown starts on the talent used last (once-a-day talents never become the default). Options are grouped:

- **Adds an effect (one per attack):** Bleeding Attack, Crippling Strike, Petrifying Strike, Befuddling Strike, Slow Reactions, Confounding Blades, Entanglement of Blades, Slowing Strike, Ki Block, Offensive Defense, Emboldening Strike, Dispelling Attack, Extinguishing Strike, Focusing Attack, Shadow's Chill, Improved Shadow's Chill, Powerful Sneak.
- **Instead of the dice:** Knock-Out Blow, Hamstring Strike, Obscuring Blow, Distracting Attack, Sever Alignment, Set-Up, Accurate Poisoner, Sneaky Maneuver, Harrow Strike, Stem the Flow and Resonating Rumbles (3 dice), Armor Piercer and Demand Attention (choose how many dice).

Talents that change the dice do so in the roll: Powerful Sneak counts 1s as 2s and gives −2 on the attack (Deadly Sneak: 1s and 2s count as 3s; the unchained versions reroll them once), Shadow's Chill makes part of the damage cold and Improved Shadow's Chill all of it, Marksman's Shot doubles the dice and Mountainside Ambush deals maximum damage. Vicious Claws rolls d8s with claw attacks.

The attack card shows the chosen talent's effect under each attack, with its save DC (10 + half the class level + the talent's ability modifier). Once the attack has hit, the GM clicks **Apply** (the attacker can apply effects on themselves, such as Offensive Defense). Where the talent allows a save, Apply rolls the target's save and applies the right result. Effects that need the GM's judgment (Dispelling Attack, Set-Up, Sever Alignment and the like) are shown as text. Talents that add an effect do nothing against a creature immune to precision damage, since no sneak attack damage was dealt.

**Assassinate** is its own entry in the roll window: tick it once the target has been studied for a round; the card then offers the target's Fortitude save. **Hunter's Surprise** has a **Designate prey** button on the talent: target the adjacent enemy and click it.

### Bleed

Bleeding Attack's bleed is tracked with its amount (PF1's Bleed condition has none). The bleeding creature takes the damage at the start of each of its turns, ignoring damage reduction. Any healing stops it, as does a DC 15 Heal check (a button on the bleed message) or removing the Bleed condition. Bleed doesn't stack: a higher bleed replaces a lower one, a lower one is ignored.

### Feats, items, traits and spells

- **More dice:** Accomplished Sneak Attacker (+1d6, no more dice than half the character level), Armor of the Shadow Lord (+1d6), the Mantis Blade (+1d6), Sense Vitals (+1d6 per 3 caster levels beyond 3rd, up to 5d6, with manufactured weapons; it also gives sneak attack to characters without it), Merciless Precision (+1d6 against a blinded, dying, entangled, exhausted, frightened, helpless, nauseated, panicked, paralyzed or stunned target).
- **Bonuses on sneak attacks:** The Vessel Between (+1 on the attack), Blade of the Society (+1 damage), Headband of Ninjitsu (+2 insight on the attack), Sniper Goggles (+2 per die on ranged sneak attacks within 30 ft, at any range with the greater goggles), Sap Adept (+1 per die with nonlethal bludgeoning attacks), Sap Master (double dice against a flat-footed target).
- **Concealment and range:** Shadow Strike, Mirrored armor, the Shadow Cleaver and Acute Shot (no more dice than the weapon's enhancement bonus) allow sneak attacks against concealed targets; the Headband of Ninjitsu even against total concealment. A Sniping weapon raises the ranged limit to 45 ft (not added to Deadly Range); Sniper Goggles remove it.
- **Critical hits:** Sneaking Critical adds as many dice as the weapon's critical multiplier to a critical sneak attack; Savage Critical adds the sneak attack dice to a critical hit that isn't a sneak attack.
- **Other:** Murderer's Blackcloth adds 1 to Bleeding Attack's bleed; an obliviating weapon offers its DC 16 memory loss on the card; Night Stalker's Tonic is listed to tick when its drinker accepts the alchemical burn; with Surprise Attack or Onslaught, the Not Applied reason reminds you to tick sneak attack in a surprise round.
- **On the target:** the Amulet of Uncanny Defense makes Uncanny Dodge work as Improved Uncanny Dodge, or counts 4 more levels for Improved Uncanny Dodge.

Not automated: Ghostslayer, the Assassin's Sight, Briar Bandit, Inspired Sneak Attack, Opportunity Attacker, Strangler, Savage Critical with Vital Strike, Sweeping Dodge, Ironskin, Nine Lives and Survivor.

## Fortification

Fortification gives a chance to negate a critical hit or sneak attack, "and damage is instead rolled normally". When an attack is a critical threat or a sneak attack against a single target that has fortification, the chance is rolled once for that attack, before its damage. On a negation the critical damage is 0 and the sneak attack dice are dropped, so PF1's own damage buttons apply the right amount. The roll is shown under the attack on the card for everyone, like a miss chance.

- **Sources:** fortification armor or shields (light 25%, moderate 50%, heavy 75%, recognized by name), the monster quality "Fortification (X%)", Shield of Fortification (25%; greater 50%), Twisted Innards (25%, 50% from caster level 7, 75% from 13), Armor Master's fortification (light, moderate from 13th level), Phantom Fortification (50%), Dormant Defense (25% while dazed, stunned or helpless).
- **Stacking:** the highest chance counts. Secured Armor adds 25% to light or moderate fortification, or gives 25% on its own. Anatomical Savant on the attacker reduces the chance by 25%.
- **Once-off negations:** a target wearing a Bracelet of Second Chances (7 beads) or a Jingasa of the Fortunate Soldier (once), or with the Fortified trait, gets a button on the card for its owner or the GM. Using it spends the bead or use and shows the attack's normal damage (without precision damage or critical damage), with a button for the GM to apply it.

## Energy resistance

### Resistances never stack
Several resistances against the same energy don't add up. Only the highest counts. A character with racial fire resistance 5 and fire resistance 10 from their bloodline has **fire resistance 10**, not 15. This holds wherever the resistances come from, including values typed in by hand, and for both ways of applying damage below.

### Quick-applied damage
**Before:** PF1 only applies energy resistance and immunity through its **Apply Damage** dialog. Clicking the damage buttons on a chat card applied the full amount.

**Now:** damage applied straight from a card is also reduced by the target's best matching energy resistance, or ignored if they're immune. A private message tells the target's owner and the GM what was resisted. This is a world setting, on by default; see [Settings](Settings). Damage through PF1's dialog is left to PF1, so it's never reduced twice.

### Halving and resistance
The rules don't say whether a saving throw for half damage or energy resistance applies first, and there's no official ruling. PF1e Revamp halves first, then applies resistance, which is the most common reading and the order most favorable to the creature. For example, 20 fire damage, saved for half, against fire resistance 10 is fully resisted (20 → 10 → 0), rather than leaving 5. Doubled damage (the ×2 button) keeps resistance first, for the same reason.

### Precision and nonlethal immunity
Precision and nonlethal damage usually come with another type (sneak attack is "piercing, precision"). A creature immune to precision or nonlethal damage takes none of such damage, in PF1's Apply Damage dialog and on quick-applied damage; PF1 alone only counts damage as immune when all of its types match. Oozes, elementals, and incorporeal and amorphous creatures are immune to precision damage without needing it listed.

### Where resistance comes from
Racial traits (*"you have fire resistance 5"*), bloodline powers (Solar), and anything PF1 already tracks. With **Nevela's Automation Suite**, its *Resist Energy* and *Protection from Energy* buffs are handled by Nevela and work alongside this.

## Halving: minimum 1
The core rules: *"if you wind up with a fraction, round down… Exception: Certain rolls, such as damage and hit points, have a minimum of 1."* Whenever damage or healing is halved (PF1's **½** buttons, a ratio in the Apply Damage dialog, a save for half, or variant channeling), the result is rounded down but never below 1. Energy resistance can still reduce damage to nothing.

## Miss chances

Miss chances from Blur, Displacement, Blink, Entropic Shield, invisibility and blindness are rolled on attack cards, as are these against ranged attacks only: Air Barrier and Spirit Shield (50% from 13th level), Wind Ward (20%, 50% from 16th level), Stormlure (50%), Distracting Pattern (20%) and Arrow-Collecting armor (20% against projectiles, not thrown weapons). See [Spells and Buffs](Spells-and-Buffs#miss-chances).
