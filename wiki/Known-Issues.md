# Known Issues

Current limitations. If you hit something not listed here, please [open an issue](https://github.com/mr-nobody20777/pf1e-revamp/issues) with the item name, what you expected and what happened.

## Spells
- **Players can see an NPC's save total** on a spell's row, and on PF1's save card when the GM rolls publicly. Roll NPC saves as a GM or blind roll to keep them private. Hiding the number from players is planned.
- **Silence** centered on a moving creature, **Command**'s chosen command and splitting **Magic Missile** between targets are left to the GM.
- **Lasting areas** treat the map as flat (a creature flying above a cloud counts as inside), and wind, slopes and range limits on moving clouds and spheres are left to the GM. See [Lasting Areas](Lasting-Areas#limits).
- **Summoning spells** other than *Summon Monster* and *Summon Nature's Ally* (*Summon Cacodaemon*, *Summon Genie*...), and the dragon, fey, ooze and naga form spells, are applied by hand. Summoned creatures and polymorph forms don't change the token's picture yet.
- **Metamagic** covers the 16 feats of the *Core Rulebook* and *Advanced Player's Guide*; the others are applied by hand. See [Metamagic](Metamagic#not-covered-yet).
- **Tracked spells**: many spells from the later books are tracked as a buff with a reminder rather than automated, where their effect is for the table to judge. See [Spells and Buffs](Spells-and-Buffs#spells-on-their-targets).
- **New saves to end an effect** (Hideous Laughter, Mudball and others) are offered on the creature's turn in combat only.

## Rules the module can't judge
- **Save bonuses need the effect's chat card.** Saves rolled from the character sheet, or with no card, don't know what they're against, so automatic "+X vs. …" bonuses don't apply. The reminders still show on the roll.
- **Blossoming Light** channel energy can't tell who worships a chaotic evil deity (a deity is free text on the sheet). The GM applies the damage to those creatures by hand.
- **Oppressive Expectations** and **Dependent** stay as reminders. They trigger on a failed check, and most checks are rolled without a DC.
- **Rewind** (Chronomancer) relies on the player to judge that a spell "had no effect".
- **Student of Philosophy** shows both totals; the player picks the one that fits the check.

## Coverage
- Archetypes other than **Battle Scion**, **Blossoming Light** and **Chronomancer** get the structural changes (replaced, added and renamed features), but their bonuses aren't written out yet.
- Raging songs cover **Inspired Rage**, **Song of Strength**, **Song of Marching** and **Dirge of Doom**.
- Of the bloodlines, **Solar** has every power fully supported. Other bloodlines, domains and schools get their powers granted, but special rules on those powers may still be reminders.

## Other modules
- **Roll Bonuses PF1** logs a console error from its flanking check when a creature with no token on the scene attacks while something is targeted. It doesn't affect the roll.
- **Monsters from PF1's bestiary** often have no race, only racial Hit Dice (a Human Skeleton has "Undead" levels), and PF1 doesn't read their creature type from those. PF1e Revamp does, so its own features treat them correctly; PF1's sheet still shows no type.
- **Templates change a creature's type only for PF1e Revamp's features.** PF1 adds a template's type to the race's instead of replacing it (a half-fiend goblin shows as both humanoid and outsider), and most of PF1's templates don't set a type at all. PF1e Revamp reads each template's type change from its rules text, so its own features treat the creature correctly; PF1's sheet still shows its own result. See [Combat Rules](Combat-Rules#creature-types-and-templates).
