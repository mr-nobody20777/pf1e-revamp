// Buff definitions: only buffs no other source ships (PF1, pf-content, Roll Bonuses). Alignment
// wards like Protection from Evil and Holy Aura come from pf-content and are automated by name
// in module/ward.mjs.
// Each change is [target, bonusType, formula]. level = minimum caster level (drives @item.level);
// dur = [formula, units, end?]. flags go to flags["pf1e-revamp"].
const IMG = {
  shield: "icons/magic/defensive/shield-barrier-flaming-diamond-blue.webp",
  boots: "icons/skills/movement/feet-winged-boots-brown.webp",
  muscle: "icons/magic/control/buff-strength-muscle-damage-orange.webp",
};

module.exports = [
  { name: "Protection from Spells", spell: "Protection from Spells", level: 13, dur: ["@item.level * 10", "minute"], img: IMG.shield,
    changes: [], notes: [["allSavingThrows", "+[[8]] Resistance vs spells and spell-like abilities."]] },
  { name: "Spider Climb", spell: "Spider Climb", level: 3, dur: ["@item.level * 10", "minute"], img: IMG.boots,
    changes: [["climbSpeed", "untyped", "20"]] },
  // "Your next single attack roll (if it is made before the end of the next round) gains a +20
  // insight bonus." Applied to one attack and then used up by module/true-strike.mjs.
  { name: "True Strike", spell: "True Strike", level: 1, dur: ["1", "round", "turnEnd"], img: IMG.muscle,
    changes: [], flags: { trueStrike: true },
    note: "Automated: +20 insight on your next single attack roll, then the buff turns itself off. You also ignore the miss chance for a concealed target on that attack." },
];
