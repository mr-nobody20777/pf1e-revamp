# Ranged combat: research

2026-10-25. Groundwork for automating ranged combat. Sources: the Core Rulebook's combat and equipment chapters as stored in the test world (`pf1.rules`, `pf-content.pf-rules`), the Pathfinder 1e system (v11.11) code, Roll Bonuses (ckl-roll-bonuses 2.23.5) and Nevela's Automation Suite (2.2.9), the PF2e Ranged Combat module's documentation, and every Item compendium in the test world. 2,269 entries mention ranged combat; the ones with a mechanical effect on ranged attacks were read in full (about 350 feats, traits and racial traits; 245 class features; 132 spells; 46 weapon and armor special abilities; 134 wondrous items).

See also `docs/RULES-MAP.md` for how these rules connect to the rest of the system.

## The base rules

**Attack bonus.** "With a ranged weapon, your attack bonus is: base attack bonus + Dexterity modifier + size modifier + range penalty."

**Range increments.** "Any attack at more than this distance is penalized for range. Beyond this range, the attack takes a cumulative –2 penalty for each full range increment (or fraction thereof) of distance to the target. For example, a dagger (with a range of 10 feet) thrown at a target that is 25 feet away would incur a –4 penalty. A thrown weapon has a maximum range of five range increments. A projectile weapon can shoot to 10 range increments." Throwing a weapon not designed to be thrown: –4, range increment 10 ft, crits only on a 20 for ×2. Improvised thrown weapons: 10 ft.

**Shooting or throwing into a melee.** "If you shoot or throw a ranged weapon at a target engaged in melee with a friendly character, you take a –4 penalty on your attack roll. Two characters are engaged in melee if they are enemies of each other and either threatens the other. (An unconscious or otherwise immobilized character is not considered engaged unless he is actually being attacked.) If your target (or the part of your target you're aiming at, if it's a big target) is at least 10 feet away from the nearest friendly character, you can avoid the –4 penalty... If your target is two size categories larger than the friendly characters it is engaged with, this penalty is reduced to –2. There is no penalty for firing at a creature that is three size categories larger." Precise Shot removes it.

**Cover.** "To determine whether your target has cover from your ranged attack, choose a corner of your square. If any line from this corner to any corner of the target's square passes through a square or border that blocks line of effect or provides cover, or through a square occupied by a creature, the target has cover (+4 to AC)." Soft cover (creatures, even enemies): +4 AC against ranged attacks, no Reflex bonus. Low obstacles give cover only within 30 ft of the obstacle, and not if the attacker is closer to it than the target. Partial cover +2, improved cover +8, total cover blocks the attack. "You can't execute an attack of opportunity against an opponent with cover relative to you."

**Concealment.** Determined from a corner of the attacker's square like cover; 20% miss chance (total 50%). Already handled by `module/miss-chance.mjs`.

**Strength on damage.** "When you hit with a melee or thrown weapon, including a sling, add your Strength modifier... A Strength penalty, but not a bonus, applies on damage rolls made with a bow that is not a composite bow." Projectile weapons otherwise get no Strength bonus. Thrown weapons add Strength (not splash weapons).

**Ammunition.** Bows: draw ammunition as a free action; crossbows and slings need an action to reload (as in each weapon's entry). "Ammunition that hits its target is destroyed or rendered useless, while ammunition that misses has a 50% chance of being destroyed or lost." Shuriken count as ammunition for drawing, crafting and loss.

**Reloading** (weapon entries and Table 8-2): hand and light crossbow, move action (provokes); heavy and repeating crossbow, full-round action (provokes); sling, move action. Without Rapid Reload a crossbow fires once per round even with a full attack.

**Attacks of opportunity.** A ranged attack provokes from creatures threatening the attacker; so does loading a crossbow.

**Situational modifiers (Table 8-5/8-6).** Attacker prone: most ranged weapons can't be used (crossbows and shuriken can, without penalty); attacker invisible +2 (defender loses Dex); dazzled –1, entangled –2, shaken/frightened –2, squeezing –4. Defender prone +4 AC against ranged (–4 against melee); kneeling or sitting +2 against ranged; higher ground gives +1 to melee only.

**Splash weapons.** Ranged touch attack, no proficiency needed; direct hit plus splash within 5 ft; a grid intersection is AC 5; a miss scatters 1d8 directions by range increments. "Splash weapons cannot deal precision-based damage."

**Wind.** Strong wind –2 on ranged attacks, severe wind –4 (gust of wind), windstorm makes ranged weapon attacks impossible (siege –4), hurricane impossible (siege –8).

**Firearms (optional rules).** Early firearms target touch AC within the first range increment, max 5 increments; advanced firearms touch AC within 5 increments, max 10. Misfire range: the shot misses and the gun gains the broken condition (early firearms explode on a second misfire). Loading provokes; early firearms need a standard (one-handed) or full-round action (two-handed) per barrel, advanced a move action.

**Underwater, mounted.** Ranged attacks underwater: thrown weapons ineffective, projectiles –2 per 5 ft of water. Mounted: –4 if the mount takes a double move, –8 if it runs.

## What already exists

| Rule | Pathfinder 1e system | Roll Bonuses | Nevela | PF1e Revamp |
|---|---|---|---|---|
| Range increment penalty, maximum range | Highlights increments on the map; no penalty | **Yes**: –2 per increment and refuses attacks beyond the maximum; a checkbox to skip it. Range changes need manual setup per item ("Ranged Increment Penalty" bonus) | – | – |
| Shooting into melee | – | **Yes**, including the size rules and Precise Shot (recognized by name) | – | – |
| Higher ground, flanking | Checkboxes | **Yes** (detects and ticks) | – | Sneak attack uses Flanking |
| Point-Blank Shot | Checkbox: +1 attack and damage, **no 30 ft check** | – | – | – |
| Rapid Shot, Manyshot, Deadly Aim | Checkboxes and extra attacks | – | – | Sneak attack once per Manyshot volley |
| Clustered Shots | – | – | **Yes** (button) | – |
| Concealment and miss chances | – | – | Concealed condition roll | **Yes** (`miss-chance.mjs`) |
| Ammunition | Select, consume, 50% recovery button, abundant ammunition, misfire value | Ammunition bonuses | – | – |
| Loaded/unloaded, reload actions | – | – | – | – |
| Cover (hard, soft, partial) | Condition-like buffs in pf-content only | – | – | – |
| AoO when shooting while threatened | – | Melee "require threatens" only | – | – |

The PF2e Ranged Combat module (JDCalvert) is built around reloading (a Loaded effect, firing blocked when unloaded, capacity and double-barrel weapons, repeating magazines), an optional advanced ammunition system (choose ammunition before attacking, loaded ammunition tracked), thrown weapons tracked individually (a thrown weapon moves to a dropped stack until drawn again), Hunt Prey, and NPC weapon setup. Its settings: prevent firing if not loaded (on), advanced ammunition (off), advanced thrown weapons (on), message visibility. The parts that carry over to PF1: loaded state for crossbows and firearms, thrown weapons leaving the hand, and ammunition choice.

## What touches ranged combat, by rule

### 1. Range increments and maximum range
- **Penalty per increment:** Far Shot (–1 instead of –2; mythic: none for a turn), Sniper's Accuracy (archetype, halves with bows and crossbows), Distance Thrower (–2 less, thrown), Arc Slinger (–2 less, slings), Wasteland Hunter (–2 less, some thrown weapons), Hunter's Eye trait (no penalty for the second increment, bows), Bull's Eye (none for the first increment, cursed target), Flying Blade's precise throw (none, 1 panache), Arrow Champion's precise strike, Acute Shot (penalty moves to damage when a magic bonus applies).
- **Longer increments:** Distance weapon (double), Longshot (+10 ft), Hawkeye (archer, +5 ft per 4 levels), Roving Range trait (+5 ft, not thrown), Strong Arm Supple Wrist trait (+10 ft after moving 10 ft), Belt of Mighty Hurling (+10 ft), Bomber's Eye (+10 ft thrown), Raging Hurler (double, thrown while raging), Unfolding Wind Strike (double, thrown), Ki Range (+20 ft thrown monk weapons), zen archer ki (+50 ft for a round), Skilled Thrower (+10 ft), Winding Path Renegade (+10 ft), Flying Blade (+5 ft per 4 levels), Musket Master's steady aim (+10 ft), Huntmaster's Spear (80 ft), Gravity Bow and Weaken Powder (size and halving), Rock Throwing (120 ft).
- **Bonuses at a distance:** Eagle-Eyed (+2 beyond 100 ft), Observant Archer trait (+1 when 10 ft above or below).

### 2. Point-blank range (30 ft)
Point-Blank Shot (+1/+1; mythic +2), Focused Shot (+Int to damage within 30 ft, bows and crossbows), Canopy Shooter trait (+1 damage on higher ground within 30 ft), Charging Hurler, Improved Charging Hurler (+2 damage within 30 ft), Disrupting Shot, Target of Opportunity, Shatter Control, Murderous Sniper, Ranged Study, Sniper Goggles and sneak attack (already automated), Arc Slinger (Point-Blank Shot to the first increment with slings).

### 3. Shooting into melee and soft cover
Precise Shot (and the EitR and WiS variants), Reckless Aim (+2 competence, –1 AC; a natural 1 hits an adjacent creature), Friendly Fire (+2, risk to the ally), Friendly Fire Maneuvers, Low Profile and Combat Sandals (no soft cover from these creatures), Precise Minstrel, Volley Fire and Artillery Team (allies don't give cover), Coordinated Shot (+1/+2 when an ally threatens), Enfilading Fire (+2 against flanked foes), Duck and Cover, Auspicious Birth (eclipse).

### 4. Cover and concealment
- **Ignore cover:** Improved Precise Shot (everything short of total cover and total concealment), Pinpoint Targeting (also ignores armor, natural armor and shield), Lob Shot (cover except from above, +1 increment), Circuitous Shot and Ricochet Shot deed (ricochet), Seeker Arrow and Phase Arrow (arcane archer), zen archer's trick shot, Veering weapons (partial cover ignored, cover reduced), Bull's Eye, Mind's Eye, Seeking Spell, Phase Strike, Grazing Shot.
- **Ignore concealment / miss chances:** Seeking weapons (all miss chances), Elven Accuracy (reroll; mythic ignores concealment), Dusksight (reroll), Improved Precise Shot, Lyrune-Quah Klar, Named Bullet, Tracer Fire.
- **Defenders' miss chances against ranged attacks:** Entropic Shield (automated), Wind Wall (arrows and bolts miss, other ranged weapons 30%), Air Barrier, Spirit Shield and Wind Ward (20–50%), Arrow-Collecting armor (20%), Catching Cape, Harp of Storms, Stormlure (50%), Crystalline Dust, Distracting Pattern, Wind Stance (20% after moving), Cape of Wasps, Inhibiting Patterns, Condensed Ether.

### 5. Attack and damage bonuses on ranged attacks
Already PF1 changes in most cases (weapon training, favored enemy, buffs). Ranged-specific ones to check: Expert Archer and Crossbow Expert (+1 per 4 levels), Aspect of the Falcon (+1 competence, 19–20/×3 with bows and crossbows), Channel Vigor (mind, +4), Bastion Banner (Erastil +1/+1), Halfling Slinger (+1 racial), Order of the Land challenge, Arrow-Splitter (+1 against creatures two sizes smaller), Large Target (+1 damage per size larger, precision), Covered Sniper trait (+1 damage with cover), River Sniper, Tarnished Halls Runner, Sniper's Lantern (+2 insight), Bullseye Shot (+4 after a move action), Tracer Fire (+2 for others), Eagle-Eyed, Deadshot and Greater Deadshot (crossbowman readied actions), Justiciar's sure shot. Penalties: Dayrunner (–2), Scattershot Bracers (–2), Veiled Eye, Hostile Levitation and Levitate (–1 to –5 per attack), Cloak of Winds (–4 against the subject), Greater Air Totem (–4), Gunner's Buckler.
- **Ability swaps:** Zen Archery and Erastil's Blessing (Wisdom for bow attacks), Furious Huntress (Strength), Belt of Mighty Hurling (Strength for thrown attacks), Hand of the Acolyte (Wisdom).

### 6. Extra attacks and volleys
Rapid Shot (–2, one extra), Manyshot (first attack two arrows; precision and crit damage once, DR separately; mythic for the first two), Clustered Shots (total before DR; Nevela automates), Concentrated Fire, Hail of Arrows (arcane archer), Master Sniper, Shot on the Run (and mythic), Parting Shot, Startoss Comet and Shower, Bow Spirit, Arrow Eruption, Penetrating ammunition and Penetrating Shot, Ricochet Shot, Twin Bows, Furious Barrage (Rapid Shot for thrown, raging).

### 7. Reloading and action economy
- **Reload time:** Rapid Reload (hand/light crossbow free, heavy move; firearms per type; mythic all), Crossbow Mastery (all crossbows free, full attack like a bow, no AoO for the Rapid Reload type), Crossbow Training (elves), Warslinger (sling free), Ammo Drop (sling swift or move, no AoO), Juggle Load (sling free, full attack), Inexplicable Reload (bolt ace), Lightning Reload, Fast Musket, Mobile Reload, Reloading Hands (spell), Shadowshooting and Endless Ammunition weapons (never reload).
- **Thrown weapons at the full rate:** Quick Draw (and Quick Throwing), Two-Handed Thrower, Raging Hurler, returning weapons, Ricochet Toss.

### 8. Attacks of opportunity when shooting or reloading
- **No AoO:** Point-Blank Master (chosen weapon), Safe Shot (archer, crossbowman), Close-Quarters Thrower, Nimble Shot weapons, Deft Shootist and Art of the Gun (firearms with grit), Protective Line, Sword and Pistol, Empty Quiver Flurry, Stock-Striker Style, Spring-Heeled Style (Mobility AC), Illusion of Calm, Rapid Reload (EitR), Crossbow Mastery.
- **Threatening with a ranged weapon:** Snap Shot (5 ft; Improved +5 ft; Greater adds damage), Reflexive Shot (zen archer), Interfering weapons, Whip-Slinger, Relentless Shot, Empty Quiver Flexibility, Snap Shot's AoO without provoking.
- **Provoking on purpose:** False Opening, Reckless Contempt trait.

### 9. Ammunition and projectile effects
Flame Arrow, Abundant Ammunition, Gravity Bow, Keen Edge and Magic Weapon (50 projectiles), Bless Weapon, Daybreak Arrow, Moonrise Arrow, Divine Arrow, Venomous Bolt, Bloody Arrows, Named Bullet (spell and feat), Weapon of Awe, enhance arrows and imbue arrow (arcane archer), Ki Arrows, Explosive Missile, Volatile Arrows, Launch Trap, Ammunition special abilities (Clustershot, Conserving, Penetrating, Phantom Ammunition, Healer's Sorrow, Sparkfly Crystal Arrow, Ghost Touch). Recovery: PF1 handles the 50% chance; Conserving returns missed ammunition.

### 10. Defenses against ranged attacks
- **Deflect or catch (once per round, reaction):** Deflect Arrows (and EitR, mythic), Snatch Arrows, Throw Back Arrows, Missile Shield, Ray Shield, Arrow Deflection shields, Cut from the Air and Smash from the Air, Vambraces of Defense, Gloves of Arrow Snaring, Juggler's fast reactions, duelist, Bow Nomad, Sandals of Interception, Dueling Cuffs (firearms).
- **AC or DR against ranged:** Protection from Arrows (DR 10/magic against ranged weapons, absorbs 10 per caster level, max 100), Arrowmaster's Bracers (DR 5/magic, +1 deflection), Ranged Defense (archer, DR 5/–), Bullet Shield (+4 deflection, up to +8), Shield Focus (EitR, +5 against ranged), Low Profile (+1 dodge), Breeze-Kissed (+2 racial against nonmagical ranged), Charau-Ka Slayer (+1 against thrown), Prone Shooter (prone +6), Arrow Catching shield (+1 deflection, draws attacks within 5 ft), Rebounding shield (+2 against thrown), Armor of Arrow Attraction (–15, cursed), Stone Dodger (+4 dodge against rocks).
- **Ranged attacks impossible or blocked:** Solid Fog, Blade Snare, windstorm, Wind Wall (arrows and bolts), Prismatic Wall, Warp Wood (warped ranged weapons useless), Winds of Vengeance, Fickle Winds, Wall of Sound, Wall of Brine, Arrow Magnet.

### 11. Environment
Wind: Weathered Warrior (half the penalty; windstorm at –4), Abendego Pilot and Storm Hunter traits (one step less), Silver Nocking Point (one step less, –8 instead of deflection), Hurricane Queen, Gust of Wind and Hurricane Blast (–4 in the area), Gusting Sphere, Cloak of Winds, Deadly Weather. Underwater: Aquadynamic Shot (–1 per 5 ft), Aquatic Action, Shark Tooth Amulet, Water Sense, Gauntlets of the Deep. Mounted: Mounted Archery (halved), Improved Mounted Archery, Stable Gallop, Steady Saddle. Prone: crossbows, shuriken and firearms only; Prone Slinger (slings).

### 12. Combat maneuvers and special shots
Ranged Trip, Ranged Disarm, Ace Trip, Ace Disarm, Hammer Throw (and Improved, Master), Sliding Axe Throw, Impact Critical Shot, Meteor Shot, Driving weapons, Trick Shot (archer), Warning Shot, Ranged Feint, Liberating Shot, Burrowing Shot, Suppressive Fire, Covering Fire (two versions), Opening Volley (+4 on the next melee attack), Overwatch Style, Disrupting Shot and Casterbane Shot (readied actions against casters), Plummeting, Designating weapons.

### 13. Firearms (optional rules)
Touch AC within the first (early) or fifth (advanced) increment; misfire and the broken condition (PF1 tracks misfire values); grit deeds (Deadeye, Sharp Shoot, Targeting, Startling Shot…), Alkenstar Defender, Grand Duchy Familiarity, Just Like New, Volatile Fuse, Damp/Destabilize/Stabilize Powder, Sonic Boom and Dazzling weapons.

## Notes for the design
- Roll Bonuses already owns the range penalty and shooting into melee; the module should **feed it** rather than duplicate it: recognize the range-changing feats, traits, spells and items in section 1 and adjust Roll Bonuses' range penalty data, so tables don't have to configure each item by hand.
- Point-Blank Shot is the most common ranged feat and PF1's checkbox ignores the 30 ft limit: tick it automatically when the target is within 30 ft and untick it beyond.
- Cover is the biggest missing rule: soft cover from creatures in the line of fire happens in most ranged fights, and Improved Precise Shot, Low Profile and similar abilities hinge on it. Detection follows the corner-to-corners rule; walls need Foundry's wall collision checks.
- Reloading and thrown-weapon tracking follow the PF2e module's model (a loaded state; thrown weapons leave the hand), opt-in like there.
- Defenses that need the defender's decision (Deflect Arrows and similar) fit the card-button pattern used for fortification's one-off negations.
- Many entries are already handled by PF1 changes (flat attack and damage bonuses); those need only a check, not new code.
