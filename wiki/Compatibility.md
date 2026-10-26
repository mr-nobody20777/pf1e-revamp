# Compatibility

## Requirements
- **Foundry VTT** v13 (tested on build 351)
- **Pathfinder 1e** system 11.x (tested on 11.11)

Nothing else is required. Features that use another module simply stay inactive without it.

## Recommended modules

| Module | Without it |
|---|---|
| **libWrapper** | PF1e Revamp hooks into PF1's attack and proficiency code directly instead. It still works, but is more likely to conflict with other modules that change the same code. |
| **Pathfinder 1e Content** (`pf-content`) | No racial-trait review, and the pf-content spell buffs (Blur, Displacement, Protection from Evil, Guidance, Remove Fear...) aren't there to recognize. |
| **Pathfinder 1e Archetypes and Abilities** (`pf1e-archetypes`) | No archetypes to apply. |

## Nevela's Automation Suite
The two modules complement each other, and PF1e Revamp steps aside where they overlap:

| Area | Who handles it |
|---|---|
| Stoneskin, Resist Energy, Protection from Energy and Protection from Arrows (damage absorption), Fire Shield, Mirror Image, temporary HP | **Nevela** |
| Its *Concealed* condition's miss chance | **Nevela**. PF1e Revamp only rolls when a buff (Blur, Displacement...) gives a *higher* miss chance, and then strikes Nevela's roll through. |
| Putting a buff on targets when an action is used | **Nevela** applies a buff for every spell and consumable by default (and for actions set up in its buff automation), when it finds a buff of that name in the compendiums chosen in its settings (PF1's buffs and its own, by default). PF1e Revamp leaves those to Nevela and applies the rest itself (Bit of Luck, Resistant Touch, and spell buffs Nevela doesn't have, such as pf-content's Linebreaker or Protection from Evil); the spell's row says which. Spell rows (spell resistance, saves, conditions) are always PF1e Revamp's. |
| Energy resistance on damage applied through PF1's dialog | Nevela / PF1. PF1e Revamp only adds resistance on quick-applied damage, so nothing is reduced twice. |

## Also tested alongside
These were active through all testing with no conflicts found: **Roll Bonuses PF1** (PF1e Revamp's range changes rely on its range-increment penalty), **Koboldworks – Little Helper**, **Koboldworks – Item Hints**, **PF1 Buff Bundles**, **PF1 Mighty Morphin**, **Target Context Notes**, **Statblock Converter**, **Statblock Library**, **socketlib**.

## Multiplayer

Foundry doesn't let players change things they don't own: another character's HP, an enemy's items, a combatant's initiative. Features that need to are routed through the chat card, and the **GM's client makes the change**:
- buffs on allies (Bit of Luck, Guidance, Resistant Touch, raging songs);
- channel energy healing, damage and saves;
- Studied Target and Quarry markers on enemies;
- Forewarned's initiative bonus.

So **a GM needs to be logged in** for these to finish. Everything else, such as spontaneous casting, Prescience, Rewind, archetypes, racial traits and next-roll effects, only touches the player's own character and works without one.

Players can't open the token controls (HUD) of tokens they don't own, so any control placed there is also available as a button in the item's note. For example, players stop studying a target from Studied Target's note or their own buff.

All of this has been tested logged in as a regular player with a separate GM connected. See [Testing and Reviews](Testing-and-Reviews).
