# PF1e Revamp – Pathfinder 1e Automation for Foundry VTT

PF1e Revamp makes the class features, archetypes, racial traits, character traits, feats and spells you already use in Pathfinder 1e **do what their rules text says**. It works on PF1's own items, so there is nothing to replace, and it stays out of the way of other modules that already handle something.

![Version](https://img.shields.io/github/v/release/mr-nobody20777/pf1e-revamp?label=version)
![Downloads](https://img.shields.io/github/downloads/mr-nobody20777/pf1e-revamp/total)
![Foundry v13](https://img.shields.io/badge/Foundry-v13-orange)
![PF1 11.x](https://img.shields.io/badge/PF1-11.x-blue)
![Built with Claude Code](https://img.shields.io/badge/built%20with-Claude%20Code-D97757)

📖 **Documentation:** the [Wiki](https://github.com/mr-nobody20777/pf1e-revamp/wiki) explains each feature in plain language.

---

## ✨ What it does

**Spells**
- A spell's chat card lists every creature it affects. Spell resistance is checked for you, each creature rolls its save from its own row, and the result is applied: conditions with their duration, buffs at the caster's level, ability penalties.
- Over 120 cantrips and 1st-level spells apply their effects, including Daze, Sleep, Color Spray, Cause Fear, Bless, Bane, Mage Armor and Ray of Enfeeblement. Immunities (mind-affecting, Hit Dice limits, creature types) are checked when the spell lands, never shown beforehand.
- Fixes for PF1's spell data: Magic Missile fires the right number of missiles, cure spells harm undead, and touch spells roll their touch attack.

→ [Spells and Buffs](https://github.com/mr-nobody20777/pf1e-revamp/wiki/Spells-and-Buffs)

**Combat**
- **Sneak attack** is added automatically when the target is flat-footed or flanked, with every class's dice, talents such as Bleeding Attack, and precision immunity respected.
- **Ranged combat**: Point-Blank Shot, range-changing feats and items, defenses against ranged attacks, firearms against touch AC, and optional tracking of loaded crossbows and firearms.
- **Fortification**, **miss chances** (Blur, Displacement, invisibility) and **bleed** are rolled and tracked for you.
- Save bonuses against fear, poison, charm and other effects apply on their own, and energy resistances never stack.

→ [Combat Rules](https://github.com/mr-nobody20777/pf1e-revamp/wiki/Combat-Rules)

**Characters**
- **Classes**: channel energy that heals or harms the right creatures in its burst, spontaneous cure casting, skald raging songs, slayer studied target and talents, sorcerer bloodlines and more. → [Classes](https://github.com/mr-nobody20777/pf1e-revamp/wiki/Classes)
- **Archetypes** really change the class: replaced features are removed, new ones arrive at the right levels, and removing the archetype puts everything back. → [Archetypes](https://github.com/mr-nobody20777/pf1e-revamp/wiki/Archetypes)
- **Races**: choose standard or alternate racial traits from a checklist. → [Races](https://github.com/mr-nobody20777/pf1e-revamp/wiki/Races)
- **Traits and feats**: traits ask for their choices, and feats such as Two-Weapon Fighting and Blind-Fight work as written. → [Traits](https://github.com/mr-nobody20777/pf1e-revamp/wiki/Traits) · [Feats](https://github.com/mr-nobody20777/pf1e-revamp/wiki/Feats)

Everything the module automates carries a short **PF1e Revamp** note on its sheet and chat card that explains what happens, often with buttons for the choices it offers.

---

## ✅ Requirements

- **Foundry VTT** v13
- **Pathfinder 1e** system 11.x

## 🧩 Recommended modules

- **[libWrapper](https://foundryvtt.com/packages/lib-wrapper)**, so PF1e Revamp can work safely alongside other modules.
- **[Pathfinder 1e Content](https://foundryvtt.com/packages/pf-content)**, for racial traits, character traits and spell buffs.
- **[Pathfinder 1e Archetypes and Abilities](https://foundryvtt.com/packages/pf1e-archetypes)**, for archetypes.
- **[Roll Bonuses PF1](https://foundryvtt.com/packages/ckl-roll-bonuses)**, for range-increment penalties.
- **Nevela's Automation Suite** works well alongside it; see [Compatibility](https://github.com/mr-nobody20777/pf1e-revamp/wiki/Compatibility).

## 🔌 Installation

1. In Foundry's setup screen, open **Add-on Modules → Install Module**.
2. Paste this manifest URL and click **Install**:
   ```
   https://github.com/mr-nobody20777/pf1e-revamp/releases/latest/download/module.json
   ```
3. Enable **PF1e Revamp** in your world under **Game Settings → Manage Modules**.

New versions arrive through Foundry's usual update check.

## 🧪 Testing

Every feature has automated tests (over 240, all run before each release), is played through as a player as well as a GM, and goes through a regular performance review. See [Testing and Reviews](https://github.com/mr-nobody20777/pf1e-revamp/wiki/Testing-and-Reviews).

## 🐞 Bugs and suggestions

Please [open an issue](https://github.com/mr-nobody20777/pf1e-revamp/issues). Include the item's name, what you expected and what happened.

## 🤖 How this was made

PF1e Revamp is written by **Claude**, Anthropic's AI, in [Claude Code](https://claude.com/claude-code): the code, the automated tests and this documentation. Claude reads each ability's rules text before automating it and tests every feature in a live Foundry world. **[mr-nobody20777](https://github.com/mr-nobody20777)** came up with the project, decides what to build and how it should play at the table, and reviews the results.

## 📜 License and credits

- Code: [MIT License](LICENSE).
- This module uses trademarks and/or copyrights owned by Paizo Inc., used under Paizo's Community Use Policy (paizo.com/communityuse). We are expressly prohibited from charging you to use or access this content. This module is not published, endorsed, or specifically approved by Paizo. For more information about Paizo Inc. and Paizo products, visit paizo.com.
- Game rules text is Open Game Content, used under the Open Game License v1.0a.
- Built on the [Pathfinder 1e system for Foundry VTT](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1).
