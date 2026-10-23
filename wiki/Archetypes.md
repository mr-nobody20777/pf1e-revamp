# Archetypes

Requires **Pathfinder 1e Archetypes and Abilities** (`pf1e-archetypes`), which provides the archetype and archetype-feature items.

## How applying an archetype works

**Before:** the archetype items are text. Adding one to a character changes nothing about the class.

**Now:** drag an archetype (e.g. *Skald (Battle Scion)*) onto a character with that class. A review window lists:
- **Archetype features to add**, with the level each arrives at;
- **Base features to remove**, the ones the archetype replaces;
- **Proficiency changes**, when the archetype changes armor or weapon proficiencies;
- notes about features the archetype **alters** without replacing.

Click **Apply archetype** and:
- **Replaced features** are removed from the class, now and at future levels.
- **Archetype features** are added at their levels. PF1 grants later ones automatically as the character levels up.
- **Altered features are renamed and changed.** *Bardic Knowledge* becomes *Bardic Knowledge (Battle Scion)*: its bonuses change to match the archetype, and its description gains a line linking the feature that altered it.
- **Restatements are merged.** When an archetype lists a feature the class keeps (Battle Scion's *Raging Song*), the existing feature is renamed and linked rather than adding a second copy.
- **Proficiencies and spellbook settings** change where the archetype says so.

Features already on the sheet (characters set up by hand) aren't added twice.

**Removing:** delete the archetype item, or use the **Remove archetype** button in its note, and the class goes back exactly to how it was.

## Archetypes with full mechanics

Every archetype gets the structural changes above. These also have their **bonuses and rules written out**:

### Battle Scion (Skald)
- **Courtly Presence**: +½ character level on Intimidate. *Bardic Knowledge (Battle Scion)* now covers only Knowledge (geography), (history), (local) and (nobility).
- **Raging Song**: Dirge of Doom and Song of the Fallen are replaced (by Song of Questing at 10th level), so the song picker never offers them.
- **Battle Prowess** (3rd level): Rage Powers are renamed and noted as altered.
- **Once and Future Scion** replaces Master Skald at 20th.

### Blossoming Light (Cleric)
- **Promise of Faith**: no armor or shield proficiency.
- **Luminous Font**:
  - *Channel Energy (Blossoming Light)* can be used 5 + Charisma modifier times per day, +1 at 2nd level and every 2 levels after.
  - **No domain spell slot.** The cleric still has domains and domain powers.
  - +½ level on Diplomacy against good creatures, shown as a note on the roll.
- **3rd level**: harmful channel energy also includes chaotic evil outsiders, and evil creatures with light sensitivity or light blindness. See [Classes → Channel Energy](Classes#channel-energy).

### Chronomancer (Wizard)
- **Temporal Pool** replaces Arcane Bond. Its points equal ½ wizard level + Int modifier (minimum 1), refreshing daily.
- **Forewarned**: when the wizard's initiative is rolled, their player gets a private card with a **+1d4** button for themselves and for each ally within 30 ft. Each click spends 1 point and adds 1d4 to that character's initiative.
- **Rewind**: every spell card the chronomancer casts has a **Rewind** button, costing ½ the spell's level in points (minimum 1). Use it when the spell fizzled on a failed concentration check or had no effect (saved against, resisted, immune), and the spell is prepared again.

More archetypes will get full mechanics over time. If yours only has the structural changes and you'd like its bonuses written out, [open an issue](https://github.com/mr-nobody20777/pf1e-revamp/issues).
