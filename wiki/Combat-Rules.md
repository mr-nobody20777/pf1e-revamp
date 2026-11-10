# Combat Rules

- [Buffs on a roll](#buffs-on-a-roll)
- [Save bonuses against effects](#save-bonuses-against-effects)
- [Sneak attack](#sneak-attack)
- [Fortification](#fortification)
- [Ranged combat](#ranged-combat)
- [Energy resistance](#energy-resistance)
- [Halving: minimum 1](#halving-minimum-1)
- [Miss chances](#miss-chances)

---

## Buffs on a roll

PF1 adds every buff and condition into one number, so you can't see which ones count or leave one out for a single roll. PF1e Revamp adds a **Buffs** line to the attack, save, skill and ability-check windows.

- **With a few effects** (4 or fewer by default), each shows as a chip you can untick for this roll.
- **With more**, the line shows totals (*Attack +7 · Damage +8 from 8 effects · 4 not applied*) and a **Manage…** button opens the full list:
  - grouped into **Attack only**, **Damage only** and **Attack and damage**, with each effect's value and bonus type;
  - ability-score buffs combine into one row per ability (*Strength +8*), which expands to show its sources;
  - **Not Applied** lists bonuses that don't stack (*Bless · Heroism is higher*) and situational bonuses that don't apply right now (*Studied Target · your target isn't studied*).
- **Changes affect only that roll.** The chat card shows them as one labeled part, such as *−2 [Buffs: Heroism off]*.

**Rules it follows**
- PF1's stacking: bonuses of the same type don't stack (the highest counts); dodge, untyped, circumstance and racial bonuses stack; penalties always stack.
- A bonus that loses to a higher one can only be ticked once everything beating it is off.
- **Conditions** (shaken, sickened…) are marked 🔒: only the GM can leave them out of a roll.
- Situational bonuses that don't apply right now can still be ticked by anyone, for theater-of-mind play.
- Rolls made without a window (shift-click) use PF1's totals plus the situational bonuses that apply.

How many effects show as chips is a per-player setting; see [Settings](Settings).

## Save bonuses against effects

Bonuses like *"+2 racial bonus on saves vs. fear"* used to be reminders you added by hand. Now, when a save is rolled **from the effect's chat card**, PF1e Revamp checks what the effect is (school, subschool, descriptors, spell or spell-like ability) and adds every matching bonus the character has.

| Kind | Examples |
|---|---|
| **Descriptors** | fear, mind-affecting, emotion, death, poison, disease, curse, pain, fire, cold, acid, electricity, sonic |
| **Schools and subschools** | enchantment, illusion, necromancy and the other schools; charm, compulsion, polymorph |
| **Spells and spell-like abilities** | "against spells", "against spell-like abilities" |

The bonuses can come from the race, racial traits, character traits, feats or buffs. For example:
- **Halfling** +2 vs fear applies against *Cause Fear*, not *Charm Person*.
- **Dwarf** +2 vs poison, spells and spell-like abilities applies against any spell.
- **Elf** +2 vs enchantment applies against *Charm Person*, not *Cause Fear*.
- **Remove Fear** +4 vs fear, **Death Ward** +4 vs death spells, **Mind Blank** +8 vs mind-affecting.

**Stacking**
- Racial, untyped, dodge and circumstance bonuses stack.
- Every other type (morale, resistance, luck, sacred…) counts only the part above a bonus of that type the character already has: *Mind Blank*'s +8 resistance on top of a *Cloak of Resistance +1* adds 7.
- A racial bonus stated on both a race and one of its traits counts once.

**Good to know**
- PF1 lists an item's save notes under the roll. When PF1e Revamp has already added a bonus, its note is ticked and faded so nobody adds it twice.
- PF1's save button rolls for the token you have selected. If that token isn't one of the card's targets, you get a warning (the roll still happens).
- Saves rolled from the sheet, without the effect's card, get no automatic bonus.
- Bonuses against creatures ("vs. evil creatures") are handled by the [alignment wards](Spells-and-Buffs#alignment-wards). Conditional bonuses ("when adjacent to an ally") stay as reminders.

## Sneak attack

Attacks add the dice of every Sneak Attack class feature the attacker has (dice from different classes stack) when:
- **the target is denied its Dexterity bonus to AC**: flat-footed, blinded, cowering, helpless, paralyzed, pinned, stunned, unconscious, asleep or petrified, or the attacker is invisible and the target can't see invisible creatures; **or**
- **the attacker flanks the target** (melee only), using the attack window's Flanking box (Roll Bonuses ticks it automatically).

It is **not** applied when:
- a ranged attack is beyond 30 ft (Deadly Range adds 10 ft each time it's taken);
- the target has concealment (Sniper's Eye allows ranged sneak attacks within 30 ft);
- the target has Uncanny Dodge and is only flat-footed, or Improved Uncanny Dodge and the attacker doesn't have four more sneak attack levels;
- there isn't exactly one target.

**How the dice work**
- They're a separate part of the damage roll ("2d6[Sneak Attack]"), typed as precision damage.
- A creature immune to precision damage takes none of them when damage is applied. This is deliberately not shown before the attack: the attacker finds out when the damage lands. Oozes, elementals, incorporeal and amorphous creatures are immune, as is anything with a precision damage immunity.
- They aren't multiplied on a critical hit, and count once per Manyshot volley.
- The roll window lists sneak attack with the reason it applies. Untick it if the GM rules that a vital spot can't be reached; when it wasn't detected, it's under **Not Applied** and can be ticked.

### Sneak attack talents

When the character has talents that change sneak attack, a **With:** dropdown appears next to the sneak attack entry. Only one talent applies to an attack, chosen before rolling; on a full attack the choice covers every sneak attack. The dropdown starts on the talent used last (except once-a-day talents).

- **Adds an effect:** Bleeding Attack, Crippling Strike, Petrifying Strike, Befuddling Strike, Slow Reactions, Confounding Blades, Entanglement of Blades, Slowing Strike, Ki Block, Offensive Defense, Emboldening Strike, Dispelling Attack, Extinguishing Strike, Focusing Attack, Shadow's Chill, Improved Shadow's Chill, Powerful Sneak.
- **Replaces the dice:** Knock-Out Blow, Hamstring Strike, Obscuring Blow, Distracting Attack, Sever Alignment, Set-Up, Accurate Poisoner, Sneaky Maneuver, Harrow Strike, Stem the Flow, Resonating Rumbles, Armor Piercer, Demand Attention.

Some talents change the dice themselves: Powerful Sneak (1s count as 2s, −2 on the attack; Deadly Sneak raises that to 3s), Shadow's Chill (part of the damage becomes cold), Marksman's Shot (double dice), Mountainside Ambush (maximum damage), Vicious Claws (d8s with claws).

The attack card shows the talent's effect and save DC under each attack. Once the attack hits, click **Apply**: the target's save is rolled where the talent allows one, and the result is applied. A natural 1 always fails and a natural 20 always succeeds. Effects that need the GM's judgment (Dispelling Attack, Set-Up and similar) are shown as text. Talents that add an effect do nothing against a creature immune to precision damage.

**Assassinate** has its own entry in the roll window: tick it once the target has been studied for a round, and the card offers the target's Fortitude save. **Hunter's Surprise** has a **Designate prey** button on the talent.

### Bleed

Bleeding Attack's bleed is tracked with its amount, since PF1's Bleed condition has none. The creature takes it at the start of each of its turns, once per round, ignoring damage reduction. Any healing stops it, as does a DC 15 Heal check (a button on the bleed message) or removing the condition. A higher bleed replaces a lower one; a lower one is ignored.

### Feats, items, traits and spells

- **More dice:** Accomplished Sneak Attacker, Armor of the Shadow Lord, the Mantis Blade, Sense Vitals, Merciless Precision.
- **Bonuses on sneak attacks:** The Vessel Between, Blade of the Society, Headband of Ninjitsu, Sniper Goggles, Sap Adept, Sap Master.
- **Concealment and range:** Shadow Strike, Mirrored armor, the Shadow Cleaver and Acute Shot allow sneak attacks against concealed targets (the Headband of Ninjitsu even against total concealment). A Sniping weapon raises the ranged limit to 45 ft; Sniper Goggles remove it.
- **Critical hits:** Sneaking Critical and Savage Critical.
- **Other:** Murderer's Blackcloth (+1 bleed), obliviating weapons, Night Stalker's Tonic, and a reminder for Surprise Attack and Onslaught in surprise rounds.
- **On the target:** the Amulet of Uncanny Defense.

Not automated: Ghostslayer, the Assassin's Sight, Briar Bandit, Inspired Sneak Attack, Opportunity Attacker, Strangler, Savage Critical with Vital Strike, Sweeping Dodge, Ironskin, Nine Lives and Survivor.

## Fortification

Fortification can negate a critical hit or sneak attack ("damage is instead rolled normally"). When an attack is a critical threat or a sneak attack against a target with fortification, the chance is rolled once for that attack, before its damage, and shown on the card for everyone. On a negation, the critical damage and sneak attack dice are dropped, so PF1's damage buttons apply the right amount.

- **Sources:** fortification armor and shields (light 25%, moderate 50%, heavy 75%), the monster quality "Fortification (X%)", Shield of Fortification, Twisted Innards, Armor Master, Phantom Fortification, Dormant Defense.
- **Stacking:** the highest chance counts. Secured Armor adds 25% to light or moderate fortification. Anatomical Savant on the attacker reduces the chance by 25%.
- **One-off negations:** a Bracelet of Second Chances, a Jingasa of the Fortunate Soldier or the Fortified trait gives the target's owner (or the GM) a button on the card that spends the use and shows the attack's normal damage.

## Ranged combat

Range penalties and shooting into melee come from **Roll Bonuses**: −2 per range increment beyond the first, no attacks beyond maximum range, and the shooting-into-melee penalty. PF1e Revamp feeds it the range changes below. Without Roll Bonuses, those range changes do nothing; everything else on this page still works.

### Point-Blank Shot
PF1's Point-Blank Shot box gives +1 on attack and damage at any distance. PF1e Revamp ticks it when every target is within 30 ft and leaves it off beyond; you can still change it. Mythic Point-Blank Shot adds its extra +1, and Arc Slinger extends it to a sling's whole first range increment.

### Range changes
Recognized on the character with no setup:
- **Smaller penalty per increment:** Far Shot, the sniper's accuracy.
- **Penalty reduced by 2:** Distance Thrower, Arc Slinger, Wasteland Hunter, Hunter's Eye. A reduction never becomes a bonus.
- **Longer increment:** Longshot, Hawkeye, Roving Range, the Belt of Mighty Hurling, Bomber's Eye, Skilled Thrower, the Winding Path Renegade, the flying blade. Distance weapons and Raging Hurler then double it.

### Bonuses that depend on distance
In the roll window, where they can be unticked (or ticked when not detected): Eagle-Eyed, Observant Archer, Canopy Shooter, Improved Charging Hurler, Bomber's Eye, and Focused Shot (listed under Not Applied, since it needs a standard action).

### Defenses against ranged attacks
- **AC on the card.** When something changes a target's AC against a ranged attack, the card shows the adjusted AC and whether the roll hits, to the GM and the target's owner only. This covers prone (+4, +6 with Prone Shooter), deflection against ranged weapons (Bullet Shield, Arrowmaster's Bracers, arrow catching shields), Low Profile, Breeze-Kissed, Charau-Ka Slayer, rebounding shields and Armor of Arrow Attraction.
- **Deflecting.** A target that can deflect a ranged attack (Deflect Arrows and its variants, Missile Shield, Vambraces of Defense, Wicked Wings, arrow deflection shields, Cut from the Air) gets a **Deflect** button for its owner or the GM. It works once per round, not while flat-footed, and not against spells or rays.
- **Damage reduction.** Protection from Arrows, Arrowmaster's Bracers and the archer's ranged defense reduce ranged weapon damage applied from the card. The best one applies.
- **Shooting while prone** gives a warning: only crossbows, shuriken and firearms can be used prone.

### Loaded weapons (optional)
With **Track loaded ranged weapons** turned on in [Settings](Settings), crossbows, slings and firearms track their loaded shots. Firing an empty weapon is refused until it's reloaded with the **Reload** button (in the weapon's note, or on the card once it's empty). The button names the action reloading takes and whether it provokes. A full attack fires only the loaded shots, and weapons reload when combat ends.

| Weapon | Capacity | Reload |
|---|---|---|
| Hand and light crossbow, sling | 1 | Move action |
| Heavy crossbow | 1 | Full-round action |
| Repeating crossbows | 5 | Full-round action (new case) |
| Double crossbow, double sling | 2 | As above |
| Early firearms | 1 per barrel | Standard action per barrel (one-handed), full-round (two-handed) |
| Advanced firearms | 6 for a revolver | Move action |

Rapid Reload, Crossbow Mastery, Crossbow Training, Warslinger, Juggle Load and Ammo Drop make reloading faster. A weapon that reloads as a free action isn't tracked. Bows and thrown weapons don't need loading.

### Shooting while threatened
When a ranged attack is made next to an enemy that can act, the card notes that it provokes attacks of opportunity. It's a reminder only. Point-Blank Master, safe shot, Close-Quarters Thrower, nimble shot weapons, Sword and Pistol, Deft Shootist and Art of the Gun silence it.

### Special shots and firearms
- **Firearms against touch AC** within the first range increment (five for advanced firearms), shown on the GM's AC line.
- **Aspect of the Falcon:** bows and crossbows threaten on 19–20 with a ×3 multiplier.
- **Critical confirmation:** Toxophilite and Alkenstar Defender.
- **Applied when they fit:** Halfling Slinger, Arrow-Splitter, Large Target (precision damage), Coordinated Shot.
- **To tick:** Bullseye Shot, Pinpoint Targeting, and Opening Volley on melee attacks; they depend on actions the module can't see.

Not automated: wind and cover (the GM's call). Not yet automated: range changes that depend on something the module can't see (Strong Arm, Ki Range and similar), full attacks with thrown weapons, gunslinger deeds and misfires.

## Bonuses against kinds of creatures
Many racial traits, traits and feats give a bonus only against certain creatures: the dwarf's +1 on attack rolls against orcs and goblinoids, Defensive Training's +4 dodge bonus to AC against giants, a trait's +1 against evil creatures. PF1 prints these as reminders; PF1e Revamp applies them when the creature they name is involved:
- **Attack rolls, weapon damage and combat maneuver checks**: against the attack's targets, in the roll window. Without a target, or against a creature that doesn't qualify, the bonus is listed under Not Applied with the reason, and can be ticked.
- **Several targets**: when only some of them qualify, the roll goes without the bonus and the card shows each qualifying target's own attack total. Its extra damage is added when the card's damage is applied to that creature.
- **AC and CMD**: against the attacker, in the target's AC on the attack card (seen by the GM and the target's owner). Dodge bonuses aren't added to flat-footed AC.
- **Skill and ability checks**: against the single target.
- **Saving throws**: against effects from that kind of creature ("+2 vs fear effects created by outsiders"), when the save is rolled from the effect's card.
- **Choosing the creatures**: items that say to choose (pf-content's variant Hatred, Defensive Training, Lesser, Vengeful) ask when they're added; the choice can be changed from the item's note.
- **Not applied automatically**: bonuses with a condition the module can't check (opposed checks, a specific combat maneuver, a critical hit, the terrain). They stay in the roll window to tick.

Creatures are recognized by their type, subtypes and alignment, as described under [Creature types and templates](#creature-types-and-templates). A creature whose type is unknown gets no bonus until it's known.

## Creature types and templates
Spells that affect only certain creatures, channel energy, immunity to precision damage and similar rules depend on a creature's type and subtypes. PF1e Revamp reads them from the race and the creature's other items, and applies its monster templates as their rules text says:
- **A template's type replaces the race's.** A half-fiend goblin is an outsider (native), not a humanoid, so *Hold Person* doesn't affect it. A template that gives the augmented subtype keeps the original type only as "augmented humanoid" for effects that name it.
- **Subtypes follow the template's text.** Templates such as Zombie and Skeleton keep subtypes "except for alignment subtypes and subtypes that indicate kind". PF1e Revamp reads "kind" as species (giant, goblinoid, human, elf, orc and similar) and keeps trait and origin subtypes (elemental, cold, aquatic, native, incorporeal, shapechanger). The template's note lists the subtypes it dropped. To keep one, add it to the template's **Creature Subtypes** on its Details tab.
- **Two templates that change the type**: a window asks which template sets it. Until one is chosen, the creature's type is unknown and rules that depend on it don't apply. The template's note has a button to choose again.
- **Monsters with racial Hit Dice and no race** (many of PF1's bestiary monsters) take their type from the racial Hit Dice class.
- **Subtypes typed by hand** match regardless of capitals, spaces and hyphens; PF1's misspelled "Reptillian" on kobolds and lizardfolk counts as reptilian.

## Auras
Auras give their effect to the creatures within their radius as a buff named for the aura and its bearer ("Aura of Courage (Seelah)"), added and removed as tokens move, are hidden or leave the scene. The active GM's client keeps them in sync, so a GM must be connected. Only scenes in play count: the active scene, or one a connected user is viewing.
- **Covered:** Aura of Courage, Resolve and Righteousness (paladin); Aura of Cowardice, Despair and Depravity (antipaladin); Foretell and Aura of Despair (wizard); Aura of Heroism, Aura of Protection (domain power and warpriest blessing) and Aura of Menace (cleric).
- **Who:** allies or enemies by token disposition (friendly and hostile are enemies of each other; neutral tokens are neither). "Allies" includes the bearer. Paladin and antipaladin auras work only while the bearer is conscious. The enchanter's Aura of Despair is mind-affecting, so mindless creatures, undead, constructs and plants ignore it.
- **Stacking:** two creatures with the same aura give one buff, from the higher level. Aura of Despair and Aura of Cowardice together give −4 on saves against fear, not −6.
- **Auras used in rounds per day** start from the feature's Use button (or the button in its note). The window asks how many rounds to spend and, for Foretell, whether to aid allies or hinder enemies. The bearer gets a buff for the aura; turning it off or deleting it ends the aura and gives back the rounds not yet used (the round in progress counts as used). Using the feature again replaces the running aura.
- **Leaving someone out:** turn off a creature's aura buff; it stays off until the creature leaves the aura. A deleted aura buff comes back while the creature is still inside.
- **Not yet:** the bearer's own benefits (fear immunity, DR), Foretell's bonus on caster level checks (add it by hand), and auras that force saves or deal damage.

## Fast healing and regeneration
A creature with fast healing or regeneration heals at the start of each of its turns in combat, once a round (stepping the tracker back and forward doesn't heal it twice). The amount comes from the sheet's Fast Healing and Regeneration fields, items named for them ("Fast Healing 5", "Regeneration 10 (fire)"), and the buffs of Infernal Healing and Celestial Healing. Nonlethal damage heals too if PF1's dual-heal setting is on.
- **Regeneration** is stopped for the creature's next turn by damage of a type in its entry ("5 (acid, fire)"), when that damage is applied with its type through PF1. Its line says when it can die normally.
- **A dead creature** doesn't heal. Out of combat, healing over time is left to the GM.

## Damage reduction, resistances and immunities from features
PF1's class features and templates mostly describe their DR, resistances and immunities in text only. PF1e Revamp gives them to the creature, at its level or Hit Dice, and the feature's note says what it gives right now.
- **Covered:** barbarian and bloodrager Damage Reduction; the Energy Resistance rage power (while raging); Armor Mastery (in armor or with a shield); monk Diamond Body, Purity of Body and Perfect Self; paladin Divine Health, the immunities and DR of Aura of Courage, Resolve and Righteousness, and Holy Champion; antipaladin Aura of Depravity and Unholy Champion; Venom Immunity and Poison Immunity; sorcerer bloodline resistances, Death's Gift and the 20th-level powers; the Celestial, Fiendish, Entropic, Resolute, Shadow Creature, Half-Celestial, Half-Fiend, Vampire, Lich, Skeleton and Zombie templates.
- **"Your energy type"** (Draconic and Elemental bloodlines, the Energy Resistance rage power) is asked when the power is added, and can be changed from its note.
- **Only the best DR counts.** "If a creature has damage reduction from more than one source, the two forms of damage reduction do not stack." DR 5/— and DR 10/magic stop 10 from a mundane sword, not 15; against a +1 sword, DR 5/— is the one that counts.
- **Death's Gift** gives DR 5/— (10/— at 9th level) against nonlethal damage only; the Apply Damage dialog lists it as "(nonlethal only)".
- **Charm and compulsion immunity** (Aura of Resolve, Aura of Righteousness) make the spell rows skip charm and compulsion spells; PF1 has no option for them, so they don't show on the sheet.
- **Silver:** an alchemical silver weapon gets past DR/silver.

## Energy resistance

- **Resistances never stack.** Against the same energy, only the highest counts: racial fire resistance 5 and fire resistance 10 from a bloodline give **fire resistance 10**.
- **Damage applied from the card is reduced too.** PF1 only applies resistance and damage reduction through its Apply Damage dialog; PF1e Revamp also reduces damage applied straight from a card's buttons (DR with the weapon's material, alignment and enhancement, as the dialog does), and tells the target's owner and the GM what was stopped. This is a setting, on by default.
- **Halving comes first.** A save for half is applied before resistance (20 fire, halved to 10, against resistance 10 is fully resisted). There's no official ruling; this is the common reading and the more favorable one for the creature.
- **Precision and nonlethal immunity** stop damage that has another type as well ("piercing, precision"), which PF1 alone doesn't.
- **Sources:** racial traits, bloodline powers and anything PF1 already tracks. With Nevela's Automation Suite, its Resist Energy and Protection from Energy work alongside.

## Halving: minimum 1

"Certain rolls, such as damage and hit points, have a minimum of 1." Whenever damage or healing is halved (PF1's **½** buttons, a save for half, variant channeling), the result rounds down but never below 1. Energy resistance can still reduce damage to nothing.

## Miss chances

Miss chances from Blur, Displacement, Blink, Entropic Shield, invisibility and blindness are rolled on attack cards, as are these against ranged attacks only: Air Barrier, Spirit Shield, Wind Ward, Stormlure, Distracting Pattern and Arrow-Collecting armor. See [Spells and Buffs](Spells-and-Buffs#miss-chances).

Some things cancel them: **faerie fire** on the defender removes blur, displacement and invisibility; an attacker's **blindsight** ignores concealment within its range; **Improved Precise Shot** ignores, on ranged attacks, miss chances below total concealment (blur, a plain Concealed condition), but not displacement or invisibility.
