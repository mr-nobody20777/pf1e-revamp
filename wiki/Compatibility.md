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
| **Roll Bonuses PF1** (`ckl-roll-bonuses`) | No range-increment penalties, so the range changes in [Combat Rules](Combat-Rules#ranged-combat) do nothing. It also ticks Flanking for you. |

## Nevela's Automation Suite
The two modules complement each other. Where they overlap, PF1e Revamp steps aside:

| Area | Who handles it |
|---|---|
| Stoneskin, Resist Energy, Protection from Energy and Protection from Arrows (damage absorption), Fire Shield, Mirror Image, temporary HP | **Nevela** |
| Its *Concealed* condition's miss chance | **Nevela**. PF1e Revamp only rolls when a buff gives a *higher* miss chance, and then strikes Nevela's roll through. |
| A spell's buff on its targets | **Nevela**, when it applies the buff itself. By default Nevela applies a buff for every spell, using the buffs in the compendiums chosen in its settings (PF1's and its own). PF1e Revamp applies the buffs Nevela doesn't have, such as Pathfinder 1e Content's Linebreaker or Protection from Evil. The spell's row says which module applied it. |
| A spell's saves, spell resistance and conditions | **PF1e Revamp** |
| Energy resistance in PF1's Apply Damage dialog | **Nevela / PF1**. PF1e Revamp only adds resistance to damage applied straight from a card, so nothing is reduced twice. |

## Also tested alongside
These were active through all testing with no conflicts found: **Koboldworks – Little Helper**, **Koboldworks – Item Hints**, **PF1 Buff Bundles**, **PF1 Mighty Morphin**, **Target Context Notes**, **Statblock Converter**, **Statblock Library**, **socketlib**.

## Multiplayer

Foundry doesn't let players change what they don't own: another character's hit points, an enemy's items, a combatant's initiative. Features that need to are passed to the **GM's client**, which makes the change:
- a spell's effects on its targets, and its spell resistance checks;
- buffs on allies (Bit of Luck, Guidance, Resistant Touch, raging songs);
- channel energy's healing, damage and saves;
- sneak attack talents' effects, bleed, and fortification or deflection used by a defender;
- Studied Target and Quarry markers on enemies;
- Forewarned's initiative bonus.

So **a GM must be logged in** for these to finish. Everything that only touches the player's own character (spontaneous casting, Prescience, archetypes, racial traits, one-roll buffs) works without one.

Players can't open the token controls (HUD) of tokens they don't own, so any control placed there is also available as a button in the item's note. For example, players stop studying a target from Studied Target's note or their own buff.

All of this has been tested logged in as a regular player with a separate GM connected. See [Testing and Reviews](Testing-and-Reviews).
