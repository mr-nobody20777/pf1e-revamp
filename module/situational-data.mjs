// Situational bonuses PF1's compendium items state only in their description (situational bonuses, phase 2B).
// Each entry was read from the item's text and reviewed by hand (DECISIONS.md, "Situational bonuses"): only
// the character's own passive bonuses are listed (not an ally's, not a penalty on a foe, not a temporary
// effect after an action, not the cost of an option), written as the notes PF1 would carry. The note readers
// treat them exactly like an item's own context notes (util.notesOf): a situation the module checks applies
// on its own; anything else is listed in the roll window to tick. Keyed by the item's name, lowercased.
//
// Feats and traits, attack, damage and combat maneuver rolls (batch 1, 2026-11-17).

export const DESCRIPTION_NOTES = {
  // Applied when the situation holds (situational-bonuses.mjs) or against the creatures named (creature-bonuses.mjs)
  "orc rampage": [{ target: "attack", text: "+[[1]] on attack and damage rolls against shaken opponents" }],
  "night stalker": [{ target: "attack", text: "+[[2]] on attack rolls against flat-footed enemies" }],
  "shark tear": [{ target: "attack", text: "+[[1]] on attack and damage rolls against bleeding creatures" }],
  "robot's bane": [{ target: "attack", text: "+[[1]] on attack and damage rolls vs Constructs (Robot)" }],
  "totem spirit": [{ target: "attack", text: "+[[2]] on weapon damage rolls vs Undead" }],
  "demon hunter": [{ target: "attack", text: "+[[2]] Morale on attack rolls vs Outsiders (Demon)" }],
  "ancestral enmity": [{ target: "melee", text: "+[[2]] on melee attack rolls vs Humanoids (Dwarf, Gnome)" }],
  "improved beast hunter": [{ target: "cmb", text: "+[[4]] on combat maneuver checks vs Animals" }],
  "ancient tradition": [{ target: "attack", text: "+[[2]] on damage rolls vs Magical Beasts" }],
  "illusive gnome surprise": [{ target: "cmb", text: "+[[2]] on combat maneuver checks to perform a dirty trick" }],
  "sinuous vines": [{ target: "cmb", text: "+[[2]] on combat maneuver checks to grapple" }],
  "weapon shift": [{ target: "cmb", text: "+[[2]] on combat maneuver checks to trip" }],
  "oath of the unbound": [{ target: "cmb", text: "+[[2]] on combat maneuver checks to break free of a grapple or pin" }],

  // Listed in the roll window to tick (the module can't tell when they apply)
  "throw anything": [{ target: "attack", text: "+[[1]] Circumstance on attack rolls made with thrown splash weapons" }],
  firebug: [{ target: "attack", text: "+[[1]] Trait on attack rolls made with thrown splash weapons and alchemist bombs" }],
  "paired opportunists": [{ target: "attack", text: "+[[4]] Circumstance on attacks of opportunity against creatures you and an ally with this feat both threaten" }],
  "true love": [{ target: "attack", text: "+[[2]] on attack rolls whenever you are below a quarter of your total hit points" }],
  "bulette charge style": [{ target: "cmb", text: "+[[4]] on combat maneuver checks to overrun, while using this style" }],
  "improved called shot": [{ target: "attack", text: "+[[2]] on attack rolls when making a called shot" }],
  "reap the infirm": [{ target: "cmb", text: "+[[2]] on combat maneuver checks against diseased creatures" }],
  "ferocious loyalty": [{ target: "attack", text: "+[[1]] Morale on attack rolls against a foe that threatens an ally who also has this feat" }],
  "skyseeker impact": [{ target: "cmb", text: "+[[4]] on sunder checks against targets larger than you" }],
  "we are the wall": [{ target: "attack", text: "+[[1]] on attack rolls against your mark" }],
  "solo maneuvers": [{ target: "cmb", text: "+[[1]] on combat maneuver checks against a creature no ally threatens" }],
  "bear hug": [{ target: "attack", text: "+[[2]] on damage rolls against foes you are grappling" }],
  "mutual hatred": [{ target: "attack", text: "+[[1]] on attack and damage rolls against creatures whose hatred or favored enemy applies to you" }],
  "agent of purity": [{ target: "attack", text: "+[[1]] on attack rolls against creatures corrupted by the relevant blight" }],
  "dragonfly style": [{ target: "melee", text: "+[[1]] on melee attack rolls against opponents your size or smaller, while using this style" }],
  "giant vendetta": [{ target: "attack", text: "+[[1]] on attack rolls against giants of the chosen kind" }],
  "balor whip": [{ target: "cmb", text: "+[[2]] on drag checks when using a whip" }],
  "volley fire": [{ target: "ranged", text: "+[[1]] on ranged attack rolls for each ally with this feat who made a ranged attack at the target since your last turn" }],
  "traditional weapons": [{ target: "cmb", text: "+[[2]] on combat maneuver checks against creatures wielding exotic weapons, firearms or technological weapons" }],
  "marksman's utility": [{ target: "attack", text: "+[[4]] on attack rolls made as part of a utility shot" }],
  "anticipate dodge": [{ target: "attack", text: "+[[2]] on attack rolls against a target that has a dodge bonus" }],
  "self-exiled noble": [{ target: "attack", text: "+[[1]] on attack and damage rolls against members of your former family" }],
  "dog killer, horse hunter": [{ target: "attack", text: "+[[2]] Morale on attack and damage rolls against dogs and horses" }],
  "grudge fighter": [{ target: "attack", text: "+[[1]] Morale on attack and damage rolls against a creature that attacked you this combat" }],
  "twin thunders flurry": [{ target: "attack", text: "+[[2]] on damage rolls against giants, while making a flurry of blows" }],
  liberator: [{ target: "attack", text: "+[[1]] on attack and damage rolls when your actions would directly lead to freeing prisoners or slaves" }],
  "duelist of the roaring falls": [{ target: "attack", text: "+[[1]] Competence on damage rolls made with an Aldori dueling sword" }],
  "kobold style": [{ target: "cmb", text: "+[[4]] on combat maneuver checks against enemies denied their Dexterity bonus to AC, while using this style" }],
  "undermining exploit": [{ target: "cmb", text: "+[[4]] Insight on combat maneuver checks against opponents in a square of rocky difficult terrain" }],
  "damned soldier": [{ target: "attack", text: "+[[1]] Profane on weapon damage rolls with your god's favored weapon" }],
  "timely coordination": [{ target: "attack", text: "+[[1]] on attack rolls made as part of readied actions triggered by an ally who also has this feat" }],
  "weapon material mastery": [{ target: "cmb", text: "+[[2]] on trip checks made with the chosen weapon" }],
  "planar hunter": [{ target: "attack", text: "+[[2]] on weapon attack rolls against outsiders native to the chosen plane" }],
  "gray maiden initiate": [{ target: "attack", text: "+[[1]] on damage rolls against a creature that dealt damage to you during the previous round" }],
  "chain mastery": [{ target: "cmb", text: "+[[2]] on disarm or trip checks with a spiked chain" }],
  "nature's wrath": [{ target: "attack", text: "+[[1]] Trait on attack rolls against humanoid creatures, where the trait applies" }],
  "dolphin style": [{ target: "melee", text: "+[[1]] on melee attack rolls against a creature adjacent to at least two of its allies, while using this style" }],
  "orc weapon expertise": [{ target: "attack", text: "+[[1]] on damage rolls against creatures at least one size smaller than you" }],
  "gloom strike": [{ target: "attack", text: "+[[1]] on attack rolls against enemies within dim light or darkness" }],
  "tar taargadth trained": [{ target: "attack", text: "+[[1]] Trait on damage rolls with a weapon whose name includes dwarven" }],
  "sworn enemy": [{ target: "attack", text: "+[[1]] Trait on attacks of opportunity against the chosen foe" }],
  "weapon training (human; ulfen)": [{ target: "attack", text: "+[[1]] Trait on damage rolls with a bastard sword, battleaxe, greataxe, greatsword, handaxe or light hammer" }],
  "heirloom weapon": [{ target: "attack", text: "+[[1]] Trait on attacks of opportunity with the heirloom weapon" }],
};
