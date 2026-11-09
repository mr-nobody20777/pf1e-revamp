// How each PF1 monster template changes a creature's type and subtypes, from the template's own text
// ("Type: The creature's type changes to undead. It retains any subtype except for alignment subtypes
// and subtypes that indicate kind."). Keyed by the template's name in lower case; creature-types.mjs
// applies it when the module reads a creature's type. Templates not listed don't change type or
// subtypes. Quick and rebuild versions of a simple template change the type the same way.
//
// Fields:
//   type        the new creature type (PF1's key); omitted when the type doesn't change
//   if          the type changes only for a creature of one of these types (Boreal: animals and vermin)
//   add         subtypes gained (PF1's keys)
//   ifAdd       the subtypes are gained only by a creature of one of these types (Nightmare Creature)
//   augmented   gains the augmented subtype, paired with its original type ("undead (augmented humanoid)")
//   drop        subtypes lost: "alignment", "alignmentKind" (alignment subtypes and subtypes that indicate
//               kind) or "all"; omitted when the text keeps them (or doesn't say)
//   note        shown in the template's footnote when a choice is left to the GM

export const TEMPLATE_TYPES = {
  // Simple templates (the subtype is in the rebuild rules)
  "aerial": { add: ["air"] },
  "aqueous": { add: ["water"] },
  "chthonic": { add: ["earth"] },
  "fiery": { add: ["fire"] },
  "deep creature (quick)": { add: ["aquatic", "deepOne"] },
  "deep creature (rebuild)": { add: ["aquatic", "deepOne"] },
  "hive creature (quick)": { add: ["hive"] },
  "hive creature (rebuild)": { add: ["hive"] },
  "lycanthropic creature (quick)": { add: ["shapechanger"] },
  "lycanthropic creature (rebuild)": { add: ["shapechanger"] },
  "fungoid creature": { type: "plant" },
  "vampiric creature": { type: "undead" },
  "winter-touched fey": { add: ["cold"] },

  // Templates that change only subtypes
  "boreal": { add: ["cold"], type: "magicalBeast", if: ["animal", "vermin"] },
  "commando construct": { add: ["augmented"] },
  "dark ice (3.5)": { add: ["cold"] },
  "enlightened construct": { add: ["augmented"] },
  "entothrope": { add: ["shapechanger"] },
  "hivemind swarm": { type: "magicalBeast", if: ["animal", "vermin"] },
  "lycanthrope": { add: ["shapechanger"] },
  "nightmare creature": { add: ["evil"], ifAdd: ["outsider"] },
  "shadowfire creature": { add: ["elemental", "fire"] },
  "silverblood lycanthrope": { add: ["shapechanger"] },
  "steam-powered construct": { add: ["augmented", "clockwork"] },
  "winter fey": { add: ["cold"] },
  "divine guardian": { note: "It may gain alignment or elemental subtypes from its deity's alignment and portfolio; add them to this template's Creature Subtypes." },
  "elemental-infused creature": { type: "outsider", add: ["native"], note: "It gains the air, earth, fire or water subtype of its element; add it to this template's Creature Subtypes." },

  // Templates that change the type
  "alebrije": { type: "magicalBeast", add: ["extraplanar"] },
  "alter ego": { type: "construct", drop: "alignmentKind" },
  "animal lord": { type: "outsider", add: ["native", "shapechanger"] },
  "animus shade": { type: "undead", add: ["incorporeal"] },
  "black-blooded (3.5)": { type: "aberration", add: ["aquatic"] },
  "child of yog-sothoth": { type: "aberration", augmented: true },
  "demonic vermin": { type: "magicalBeast", add: ["demon"] }, // "treated as if it had the demon subtype"
  "echohusk": { type: "undead", drop: "alignmentKind" },
  "ectoplasmic": { type: "undead", drop: "alignmentKind" },
  "exoskeleton": { type: "undead", drop: "alignmentKind" },
  "failed prophet": { type: "construct", augmented: true, drop: "alignment" },
  "fey animal": { type: "fey", augmented: true },
  "fey creature": { type: "fey" },
  "floodslain": { type: "undead", augmented: true },
  "foo creature": { type: "outsider", add: ["good"], augmented: true },
  "ghost": { type: "undead", add: ["incorporeal"] },
  "graveknight": { type: "undead", augmented: true },
  "half-celestial": { type: "outsider", add: ["native"] },
  "half-dragon": { type: "dragon" },
  "half-fiend": { type: "outsider", add: ["native"] },
  "half-janni": { type: "outsider", add: ["native"], augmented: true },
  "jiang-shi": { type: "undead", augmented: true },
  "juju zombie": { type: "undead", drop: "alignmentKind" },
  "kanabo": { type: "outsider", add: ["native"] },
  "lich": { type: "undead" },
  "man-eating animal": { type: "magicalBeast", drop: "alignment" },
  "mana wastes mutant": { type: "aberration" },
  "mummified animal": { type: "undead" },
  "mummified creature": { type: "undead", augmented: true, drop: "alignmentKind" },
  "mummy lord": { type: "undead", augmented: true },
  "mutant": { type: "aberration", augmented: true },
  "nosferatu": { type: "undead", augmented: true },
  "osirion mummy": { type: "undead", augmented: true, drop: "alignment" },
  "plagued beast": { type: "undead", augmented: true, drop: "alignmentKind" },
  "pod-spawned": { type: "plant" },
  "prana ghost": { type: "outsider", add: ["extraplanar", "incorporeal"], augmented: true },
  "psychic lich": { type: "undead" },
  "psychic vampire": { type: "undead", augmented: true },
  "psychoplasmic": { type: "outsider", augmented: true },
  "ravener": { type: "undead" },
  "runewarped creature": { type: "aberration" },
  "sea-sworn (3.5)": { type: "undead", add: ["aquatic"], augmented: true, drop: "alignment" },
  "seeded": { type: "undead", augmented: true },
  "shadow animal": { type: "outsider", add: ["native"] },
  "siabrae": { type: "undead", add: ["earth"] },
  "skeletal champion": { type: "undead", drop: "alignmentKind" },
  "skeleton": { type: "undead", drop: "alignmentKind" },
  "spore zombie": { type: "undead", augmented: true },
  "sunbaked zombie": { type: "undead", drop: "alignmentKind" },
  "taxidermic creature": { type: "construct", drop: "alignmentKind" },
  "trompe l'oleil": { type: "construct" },
  "tsukumogami": { type: "outsider", add: ["kami", "native"] },
  "tulpa": { type: "outsider", augmented: true },
  "unknown": { type: "fey", augmented: true },
  "vahana": { type: "magicalBeast" },
  "vampire": { type: "undead", augmented: true },
  "vampire spawn": { type: "undead" },
  "vetala": { type: "undead", augmented: true },
  "waxwork": { type: "construct", drop: "all" },
  "worm that walks": { type: "vermin", augmented: true },
  "zombie": { type: "undead", drop: "alignmentKind" },
  "zombie lord": { type: "undead", drop: "alignmentKind" },
};
