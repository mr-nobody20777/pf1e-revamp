# Known Issues

Current limitations. If you hit something not listed here, please [open an issue](https://github.com/mr-nobody20777/pf1e-revamp/issues) with the item name, what you expected and what happened.

## Spells
- **Players can see an NPC's save total** on a spell's row, and on PF1's save card when the GM rolls publicly. Roll NPC saves as a GM or blind roll to keep them private. Hiding the number from players is planned.
- **Entangle**'s saves while a creature stays in the area, **Grease**'s Acrobatics checks, **Command**'s chosen command and splitting **Magic Missile** between targets are left to the GM.
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
