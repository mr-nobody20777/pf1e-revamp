# Sneak attack: research

2026-10-24. Groundwork for automating sneak attack. Sources: the full rules text of the rogue's and slayer's Sneak Attack class features, the Pathfinder 1e system (v11.11) code and data, Nevela's Automation Suite and Roll Bonuses, and every Item compendium in the test world (PF1, Pathfinder 1e Content, Archetypes and Abilities). 534 entries mention sneak attack.

## What already exists

- **PF1 system.** Each Sneak Attack class feature has a "Use" action that rolls its dice separately (rogue `(ceil(@class.level / 2))d6`, slayer `(floor(@class.level / 3))d6`, cavalier, unchained rogue). Nothing adds them to an attack or checks when they apply. The attack window has a Flanking checkbox (+2 on the attack, recorded as `shared.flanking`) and a Conditional Modifiers section where damage can be added by hand. PF1 has a `precision` damage type and a `loseDexToAC` flag, which only buffs set; conditions that deny Dex do not set it.
- **Roll Bonuses (ckl-roll-bonuses).** Detects flanking and ticks PF1's Flanking box; blocks melee attacks against targets the attacker doesn't threaten. It is a general toolkit (damage bonuses with conditions such as "is flanking", "target has condition", "within range"), so a GM could build sneak attack by hand, but it ships nothing for sneak attack.
- **Nevela's Automation Suite.** Nothing for sneak attack.

## The core rule

Rogue and slayer text (the slayer's from 3rd level, 1d6 plus 1d6 every 3 levels; the rogue's 1d6 at 1st, plus 1d6 every 2 levels):

- Applies "anytime his target would be denied a Dexterity bonus to AC (whether the target actually has a Dexterity bonus or not), or when the slayer flanks his target."
- "Should the slayer score a critical hit with a sneak attack, this additional damage is not multiplied."
- "Ranged attacks can count as sneak attacks only if the target is within 30 feet."
- Nonlethal weapons deal nonlethal sneak attack damage; a lethal weapon can't be used for nonlethal sneak attack damage.
- "The slayer must be able to see the target well enough to pick out a vital spot and must be able to reach such a spot. A slayer cannot use sneak attack while striking a creature with concealment."
- Denied Dexterity in PF1: flat-footed, blinded, cowering, helpless (paralyzed, unconscious, asleep, petrified), pinned, stunned, or unable to see the attacker (invisible attacker).

## What touches sneak attack, by kind

### 1. Sources of dice
Class features with dice (rogue, unchained rogue, ninja, slayer, cavalier, many archetype and prestige versions), and other sources that add to them: Accomplished Sneak Attacker (+1d6, capped at half character level), Armor of the Shadow Lord (+1d6), Mantis Blade (1d6, stacks), Night Stalker's Tonic (+1d6 for 1 round), Sense Vitals, Naga Shape II/III, the Rogue and Commando Construct templates. Dice from different classes stack.

### 2. When it applies (widening the conditions)
- **Range:** Deadly Range (+10 ft each time), Sniping weapons (45 ft), Assassin's Sight (60 ft setting), Sniper Goggles (any distance).
- **Concealment:** Sniper's Eye (ranged, within 30 ft), Acute Shot, Shadow Strike, Headband of Ninjitsu, Shadow Cleaver, Mirrored.
- **Other:** Surprise Attack (opponents flat-footed in the surprise round), Onslaught, Sneaky weapons, Opportunity Attacker, Hunter's Surprise, Assassinate (study, then a flat-footed target).

### 3. Riders: effects when sneak attack damage is dealt
Bleeding Attack (+1 bleed per die), Slowing Strike, Slow Reactions, Befuddling Strike, Crippling Strike (2 Str damage), Offensive Defense (+1 dodge AC per die), Shadow's Chill, Distracting Attack, Emboldening Strike, Extinguishing Strike, Confounding Blades, Entanglement of Blades, Armor Piercer, Ki Block, Dispelling Attack, Petrifying Strike, Jaguar's Pounce and Jaguar's Protection, Mountainside Ambush; items such as Murderer's Blackcloth (+1 bleed) and Obliviating weapons; traits such as Blade of the Society and Briar Bandit (+1 trait bonus on sneak attack damage) and The Vessel Between (+1 on the attack roll). The talents marked with an asterisk in the rules can't be combined: only one applies to a given attack.

### 4. Trade-offs: giving up dice for an effect
Knock-Out Blow, Set-Up, Sever Alignment, Stem the Flow, Demand Attention, Hamstring Strike, Obscuring Blow, Resonating Rumbles, Treacherous Toxin, Pernicious Stab, Accurate Poisoner.

### 5. Changes to the dice
Powerful Sneak (−2 on attacks, 1s count as 2s) and Deadly Sneak (1s and 2s count as 3s), Vicious Claws and Mythic Knockout Artist (d8s), Sap Master (roll twice), Inspired Sneak Attack (reroll), Merciless Precision (+1d6 against afflicted targets), Sneaking Critical and Savage Critical (more dice on critical hits or Vital Strike), Improved Shadow's Chill (cold damage), Aligned and Sacred Sneak Attack (count as an alignment against DR), Sap Adept (+1 per die).

### 6. Defenses on the target
- **Immunity:** oozes, elementals and other amorphous creatures, Being of Ib, gaseous form, elemental body III and IV, particulate form.
- **Fortification-style chances to negate:** light, moderate and heavy fortification (25/50/75%), Shield of Fortification, Mental Barrier IV and V, Twisted Innards, Secured Armor, Sweeping Dodge, Fortified and Dormant Defense (traits), the Fortification monster rule, several wondrous items.
- **Once-off negation:** Ironskin, Nine Lives, Survivor, Bracelet of Second Chances, Jingasa of the Fortunate Soldier.
- **Flanking and flat-footed protection:** Uncanny Dodge (not caught flat-footed), Improved Uncanny Dodge (can't be flanked except by a character with at least four more rogue levels), Amulet of Uncanny Defense, Flanking Foil.
- **Attacker side:** Anatomical Savant (reduces fortification by 25%), Ghostslayer (precision damage against incorporeal creatures).

### 7. Special attack forms
Manyshot, Clustershot and Divine Fighting Technique apply precision damage once per volley; Strangler and Ambuscading Grapple deal sneak attack damage through a grapple; Vital Strike interactions (Savage Critical).

## Notes for the design
- PF1's own item formulas give the dice for the class features, so they don't need a separate table; other sources need a curated list.
- Denied Dexterity must be read from the target's conditions (PF1's `loseDexToAC` flag only covers buffs).
- The module's miss-chance code already handles concealment and could roll fortification chances.
- Talents and items are best handled as data entries (see the planned unified rules layer) rather than one-off code.
