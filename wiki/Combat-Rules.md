# Combat Rules

- [Save bonuses against effects](#save-bonuses-against-effects)
- [Energy resistance](#energy-resistance)
- [Miss chances](#miss-chances)

---

## Save bonuses against effects

**Before:** bonuses like *"+2 racial bonus on saves vs. fear"* or *"+4 morale vs. death spells"* appeared as reminders on the save, to be added by hand.

**Now:** when a save is rolled **from the effect's chat card** (the save button on a spell's card), PF1e Revamp looks at what the effect is: its school, subschool and descriptors, and whether it's a spell or a spell-like ability. Every matching bonus the character has is then added to the roll.

It understands bonuses against:

| Kind | Examples |
|---|---|
| **Descriptors** | fear, mind-affecting, emotion, death, poison, disease, curse, pain, fire, cold, acid, electricity, sonic |
| **Schools and subschools** | enchantment, illusion, necromancy (and the other schools), charm, compulsion, polymorph |
| **Spells and spell-like abilities** | "against spells", "against spell-like abilities" |

The bonuses can come from anywhere on the character: race, racial traits, character traits, feats and buffs. Some examples:

- **Halfling** +2 vs fear: applies against *Cause Fear*, not against *Charm Person*.
- **Dwarf** +2 vs poison, spells and spell-like abilities: applies against *Poison*, and against any spell.
- **Elf / Half-Elf** +2 vs enchantment: applies against *Charm Person*, not against *Cause Fear*.
- **Remove Fear** +4 vs fear; **Death Ward** +4 vs death spells; **Mind Blank** +8 vs mind-affecting.
- The **Lonely** drawback: −2 vs charm spells and spell-like abilities.

### Stacking follows the rules
- **Racial, untyped, dodge and circumstance** bonuses stack. Halfling *Fearless* stacks with Halfling Luck, as the trait says.
- **Every other type** (morale, resistance, luck, sacred…) only uses the **highest**, and only the part above a bonus of that type the character already has. *Mind Blank*'s +8 resistance on top of a *Cloak of Resistance +1* adds 7.
- The same racial bonus stated on both the race and one of its racial traits counts **once**.

### When it doesn't apply
- **Saves rolled without the effect's card** (typed in or rolled from the sheet) get no automatic bonus. The reminders still show on the roll.
- **Bonuses against creatures** ("vs. evil creatures") are handled by the alignment wards, not here.
- **Conditional bonuses** ("when adjacent to an ally", "once per day") and notes about immunities or rerolls are left as reminders, because the module can't know whether the condition is met.

## Energy resistance

### Resistances never stack
Several resistances against the same energy don't add up. Only the highest counts. A character with racial fire resistance 5 and fire resistance 10 from their bloodline has **fire resistance 10**, not 15. This holds wherever the resistances come from, including values typed in by hand, and for both ways of applying damage below.

### Quick-applied damage
**Before:** PF1 only applies energy resistance and immunity through its **Apply Damage** dialog. Clicking the damage buttons on a chat card applied the full amount.

**Now:** damage applied straight from a card is also reduced by the target's best matching energy resistance, or ignored if they're immune. A private message tells the target's owner and the GM what was resisted. This is a world setting, on by default; see [Settings](Settings). Damage through PF1's dialog is left to PF1, so it's never reduced twice.

### Where resistance comes from
Racial traits (*"you have fire resistance 5"*), bloodline powers (Solar), and anything PF1 already tracks. With **Nevela's Automation Suite**, its *Resist Energy* and *Protection from Energy* buffs are handled by Nevela and work alongside this.

## Halving: minimum 1
The core rules: *"if you wind up with a fraction, round down… Exception: Certain rolls, such as damage and hit points, have a minimum of 1."* Whenever damage or healing is halved (PF1's **½** buttons, a ratio in the Apply Damage dialog, a save for half, or variant channeling), the result is rounded down but never below 1. Energy resistance can still reduce damage to nothing.

## Miss chances

Miss chances from Blur, Displacement, Blink, Entropic Shield, invisibility and blindness are rolled on attack cards. See [Spells and Buffs](Spells-and-Buffs#miss-chances).
