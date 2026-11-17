# Magic Items

## Magic Qualities on weapons, armor and shields
Weapons, armor and shields have a **Magic Qualities** section on their Details tab, below PF1's materials.

- **Abilities.** Add them from **Add an ability**: the list holds every weapon, armor and shield ability in Pathfinder 1e Content, with its price, and filters to the ones that fit the item (melee or ranged weapon abilities, armor or shield abilities). Type in the search box to list the matches (the best match is picked), then click **Add** or double-click the ability; the book icon opens its full text. A gears icon marks the ones PF1e Revamp automates (see [Weapon qualities](Combat-Rules#weapon-qualities)), a clock the ones it records but doesn't automate yet. Remove one with its ✕.
- **From the name.** An item with nothing chosen reads its abilities from its name ("+1 Flaming Burst Longsword", "+1 Undead Bane Longsword", "+2 Moderate Fortification Full Plate"). The first change in the section starts from what the name gave.
- **Bane.** When a weapon has bane, choose its designated foe: a creature type, plus one subtype for humanoids and outsiders (the name then reads "Orc Bane").
- **Rules checks.** The section warns when an ability is on an item without at least a +1 enhancement bonus, when the total bonus (enhancement plus abilities) is above +10, and when an ability doesn't fit the weapon (keen on a club).
- **Specific magic item.** Tick it for named items such as Frost Brand or a Holy Avenger: their abilities still work, but their name and price are left as they are.

The enhancement bonus itself is PF1's own **Enhancement Bonus** field, as before.

## Name
While an item keeps its stock name ("Longsword", or the name of the compendium item it came from), it's named from its parts: "+1 Flaming Cold Iron Longsword", "Masterwork Longsword", "+2 Moderate Fortification Full Plate". Give it any other name and that name is kept. Players see an unidentified item's unidentified name, as usual.

## Price
**Price from parts** shows what the item is worth, and **Update price…** sets PF1's price field after asking for the plain item's price (taken from the compendium item, and remembered). The price adds up:
- the plain item;
- masterwork: +300 gp for a weapon, +150 gp for armor or a shield (every magic item is masterwork; adamantine and mithral include it);
- the special material (by the item's type, by weight, or, for cold iron, twice the item's price);
- the bonus: bonus² × 2,000 gp for weapons, bonus² × 1,000 gp for armor and shields, where the bonus is the enhancement bonus plus the abilities' bonus equivalents;
- abilities priced in gold (shadow armor +3,750 gp);
- cold iron's +2,000 gp the first time it's enchanted.

The price is never changed without the button.

## Special materials
PF1's **Material** choice now does what the material's rules say:
- **Hardness and hit points:** the material's hardness (adamantine 20, mithral 15), and hit points scaled by the material (adamantine: a third more), plus PF1's +2 hardness and +10 hit points per point of enhancement. A silvered weapon keeps its metal's hardness.
- **Weight:** mithral and darkwood items weigh half as much.
- **Masterwork:** adamantine, mithral and darkwood items are masterwork, with its +1 on attack rolls and −1 armor check penalty.
- **Armor:** mithral lowers the armor check penalty by 3, raises the maximum Dexterity bonus by 2 and lowers spell failure by 10%; a darkwood shield's armor check penalty is 2 lower. Other materials with armor changes (noqual, eel hide, singing steel) work the same way.
- **Mithral armor is one category lighter** for speed and other limitations (a mithral breastplate counts as light armor), but not for proficiency.
- **Adamantine armor** gives DR 1/— (light), 2/— (medium) or 3/— (heavy).
- **Alchemical silver:** −1 on damage rolls with a silvered slashing or piercing weapon. Only the GM can untick it in the roll window.

Bypassing damage reduction with cold iron, silver, adamantine and the like was already PF1's.

## Unidentified items
Players don't see an unidentified item's abilities: the section says *Unidentified*, the note on the item is hidden, and in the roll window its rows read *Unidentified quality*.

## Amulet of mighty fists
The amulet's enhancement bonus applies to unarmed strikes as well as natural weapons, and counts against damage reduction as a weapon's would (magic at +1, cold iron and silver at +3, adamantine at +4, alignments at +5). It has the Magic Qualities section too: the abilities chosen there apply to every unarmed strike and natural weapon while it's worn, and show on those attacks as *From the worn amulet*. Only abilities that can be applied to unarmed attacks are offered (not keen, vorpal or seeking), no +1 is needed first, and the total can't go above +5. It's named from its abilities ("+1 Flaming Amulet of Mighty Fists") and priced at 4,000 gp × the total bonus squared. A speed amulet gives one extra attack a round, not one per natural weapon.

## Armor and shield abilities
While the armor or shield is worn:
- **Shadow** and **slick**: +5 (improved +10, greater +15) competence bonus on Stealth or Escape Artist, in the sheet's totals.
- **Energy resistance**: resists 10 (improved 20, greater 30) of the energy chosen in the section.
- **Spell resistance** (13, 15, 17 or 19), unless the wearer's own is higher.
- **Invulnerability**: DR 5/magic.
- **Fortification**: see Combat Rules.

They're also read from the armor's name ("+1 Greater Shadow Leather Armor", "Improved Fire Resistance Breastplate"). Resistances and DR don't stack with others of their kind: the best applies.

## Weapon spells
*Magic weapon*, *greater magic weapon*, *keen edge*, *align weapon* and *bless weapon* act on one weapon. When the buff goes on a creature with several fitting weapons, the first is chosen and the owner gets a private message with a button for each; the buff's sheet has the same buttons (and *align weapon*'s alignments). While the buff is on:
- its enhancement bonus counts for that weapon only, and doesn't add to the weapon's own (the higher applies);
- the weapon counts as magic against damage reduction (only magic: a +3 from *greater magic weapon* doesn't bypass cold iron);
- *keen edge* makes a piercing or slashing weapon keen;
- *align weapon* adds its alignment against DR, unless the weapon already has one;
- *bless weapon* makes it good-aligned (other alignments are suppressed) and magic against evil creatures, and marks its critical threats against an evil foe as confirmed, unless the weapon is keen or vorpal.

The weapon's Magic Qualities section lists them under *For a time*. They count toward the +10 limit but never change the weapon's name or price.

## Not yet
Abilities added for a time by class features (divine bond, arcane pool, sacred weapon), spells on 50 projectiles, ammunition, double weapons, and armor abilities beyond those above (champion, arrow deflection, bashing, ghost touch, wild). See the roadmap.
