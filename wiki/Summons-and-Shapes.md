# Summons and Shapes

Spells that bring creatures onto the map, or change a creature's shape: *Summon Monster* and *Summon Nature's Ally*, spell-created attackers such as *Spiritual Weapon*, and the polymorph spells. Each works with a companion module (see [Compatibility](Compatibility)); without it, the spell's card works as before and the rest is done by hand.

## Summons

With the **Foundry Summons** module active (it needs **tcal**, **Sequencer** and **socketlib**), *Summon Monster* I–IX and *Summon Nature's Ally* I–IX summon for you. The creatures come from PF1e Revamp's **Summons** compendium: every creature on the Core Rulebook's summoning tables, from the Bestiary.

1. **Cast the spell.** Choose the option: 1 creature from the spell's level, 1d3 from the level below, or 1d4+1 from a lower level. The count is rolled.
2. **Choose the creature** from the list (type in the search box to narrow it). On *Summon Monster*'s table, creatures marked * get the celestial template if the caster is good and the fiendish template if evil; a neutral caster is asked.
3. **Place each creature** with the crosshair. It can't go beyond the spell's range (close: 25 feet + 5 feet per 2 caster levels), drawn on the map from the caster's token. A spot the caster has no line of effect to (a wall in the way) asks you to place it again. When a player summons, the GM may be asked to approve it (Foundry Summons' own setting).

**Templates.** Celestial: resist acid, cold and electricity 5 (1–4 HD), 10 (5–10 HD) or 15 (11+ HD); DR 5/evil from 5 HD, 10/evil from 11 HD; spell resistance equal to its CR (+1 from 5 HD) + 5; darkvision 60 feet; *smite evil* once a day. Fiendish: the same with cold and fire, DR/good and *smite good*. **Augment Summoning** adds +4 Strength and Constitution.

**While they're here.** The caster's player owns the summoned creatures: double-click a token for its sheet. They aren't added to the combat tracker; they act on their summoner's turn, and the summoner's owner gets a reminder listing them when that turn starts. Effects that happen at the start of a creature's turn (bleed, burning, fast healing, poisons and diseases, *Web Cloud*'s save) happen to a summoned creature at the start of its summoner's turn.

**When they go.** After the spell's rounds (1 per caster level) the creatures vanish and the GM gets a card. The casting's card has a **Dismiss** button for the caster's player and the GM. Each creature's temporary actor is deleted with its last token.

## Spell-created attackers

*Spiritual Weapon*, *Spiritual Ally*, *Mage's Sword*, *Twilight Knife* and *Chain of Perdition* are placed like summoned creatures (Foundry Summons needed): within the spell's range and line of effect, owned by the caster's player, gone when the spell ends or is dismissed. Each has a small sheet; open it from the token and use its attack on the caster's turn.

| Spell | Attack | Damage | Critical | Other |
|---|---|---|---|---|
| *Spiritual Weapon* | base attack bonus + Wisdom modifier, with iterative attacks | 1d8 force + 1 per 3 caster levels (max +5) | the weapon form's | touch AC 12 |
| *Spiritual Ally* | base attack bonus + Wisdom bonus, with iterative attacks | 1d10 force + 1 per 3 caster levels (max +5) | the weapon form's | touch AC 10; speed 30, fly 30 |
| *Mage's Sword* | caster level + Intelligence or Charisma bonus + 3 | 4d6+3 force | 19–20/×2 | AC 13 |
| *Twilight Knife* | base attack bonus + the better of Intelligence or Charisma bonus | 1d4 force | 19–20/×2 | sneak attack 1d6 per 4 caster levels; touch AC 12 + your Dexterity |
| *Chain of Perdition* | dirty trick, drag, reposition, trip: caster level + casting modifier | | | reach 10 feet |

- **The weapon's form**: casting *Spiritual Weapon* or *Spiritual Ally* asks for the weapon (searchable), which sets the critical range and multiplier. The default is the caster's alignment's: law longsword, chaos battleaxe, good warhammer, evil light flail.
- **The caster's modifiers**: each attack adds the caster's attack and weapon damage modifiers from buffs and conditions at the moment it's rolled (*bless*, *inspire courage*, shaken), but never the caster's feats ("Your feats or combat actions do not affect the weapon"). This follows Paizo's FAQs on weapon-like spells.
- **Spell resistance**: the first attack against a creature with spell resistance rolls the caster level check; if it fails, the card offers to dismiss the spell.
- **Force**: the damage is force, which damage reduction doesn't stop. The sheet notes that physical attacks can't harm it.

## Polymorph

With the *PF1 Mighty Morphin* module active, polymorph spells pick their form for you:

- **Casting** (these spells are personal: they always transform the caster, whoever is targeted) *Alter Self*, *Beast Shape*, *Magical Beast Shape*, *Elemental Body*, *Plant Shape*, *Vermin Shape*, *Giant Form* or *Form of the Dragon* opens Mighty Morphin's form picker for the caster, at the spell's level and caster level. Pick the form; Mighty Morphin applies its size, ability scores, natural armor, attacks, speeds and senses, and the token's size follows.
- ***Polymorph*, *Greater Polymorph* and *Shapechange*** ask first which kind of form the spell should play (for *Polymorph*: an animal as *Beast Shape II*, an elemental as *Elemental Body I*, a humanoid as *Alter Self*). Target the willing creature you touch; if you don't own it, the picker opens on the GM's screen.
- ***Wild Shape***: using the class ability opens the picker at the druid's level, with the kinds of form that level allows.
- ***Baleful Polymorph***: on a failed Fortitude save the picker opens on the GM's screen (choose a Small or smaller animal of 1 HD); the target's other polymorphs end. Its Will save is a reminder on the card.
- **Ending**: when the form's buff ends (its duration, doubled by *Extend Spell*; turned off; deleted), the form reverts.
- **One at a time**: a creature already transformed asks before taking a new form, and spells that change size (*Enlarge Person*, *Reduce Person*, *Righteous Might*, *Animal Growth*, *Legendary Proportions*) have no effect on a polymorphed creature.
- ***Monstrous Physique* and *Undead Anatomy*** (not in Mighty Morphin, so they work without it): pick the form's size; the buff applies the spell's size bonuses, natural armor, size change and save bonus, and lists the abilities the spell level allows. Add the form's attacks, speeds and senses by hand.

The form's token keeps its picture unless Mighty Morphin's image folder has one named after the form. Without Mighty Morphin, the polymorph spells other than *Monstrous Physique* and *Undead Anatomy* keep their reminders.

## Not covered yet

- **Other summoning spells**, such as *Summon Cacodaemon*, *Summon Genie* or *Summon Infernal Host*, place no creatures yet; their cards work as before.
- **Token art**: summoned creatures and polymorph forms use the compendium's or Mighty Morphin's pictures.
- **Forms beyond Mighty Morphin**: the dragon, fey, ooze and naga form spells of later books are applied by hand. *Monstrous Physique* and *Undead Anatomy* apply only their size bonuses.
