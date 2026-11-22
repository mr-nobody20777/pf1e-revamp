// Spell-created attackers: their numbers from the caster, the caster's modifiers on each attack (buffs and
// conditions, never feats), iterative attacks and the weapon forms.

import { createTestActor, cleanup } from "./helpers.mjs";
import { _test as A } from "../attackers.mjs";

export function registerAttackerTests(quench) {
  quench.registerBatch(
    "pf1e-revamp.attackers",
    (context) => {
      const { describe, it, assert, before, after } = context;

      describe("Spell-created attackers", function () {
        this.timeout(60000);
        let cleric, messagesBefore;
        const attackOf = (built) => built.items.find((i) => i.type === "attack").system.actions[0];

        before(async () => {
          messagesBefore = new Set(game.messages.keys());
          cleric = await createTestActor("Quench Attacker Cleric", { abilities: { wis: 18, int: 14, cha: 12, dex: 14 }, items: [["pf1.classes", "Cleric", { system: { level: 9 } }]] });
        });
        after(async () => cleanup([cleric], messagesBefore));

        it("the caster's attack modifiers: buffs and conditions count, feats don't, same-type bonuses don't stack", async () => {
          await cleric.createEmbeddedDocuments("Item", [
            { name: "Bless", type: "buff", system: { active: true, changes: [{ target: "attack", formula: "1", type: "morale" }] } },
            { name: "Heroism", type: "buff", system: { active: true, changes: [{ target: "attack", formula: "2", type: "morale" }] } },
            { name: "Power Attack", type: "feat", system: { changes: [{ target: "mattack", formula: "-3", type: "untyped" }] } },
          ]);
          await cleric.setConditions({ shaken: true });
          assert.equal(A.casterModifiers(cleric, ["attack", "mattack"]), 2 - 2, "morale +2 (not +3), shaken -2, Power Attack left out");
          await cleric.setConditions({ shaken: false });
          await cleric.deleteEmbeddedDocuments("Item", cleric.items.filter((i) => ["buff", "feat"].includes(i.type) && /Bless|Heroism|Power Attack/.test(i.name)).map((i) => i.id));
        });

        it("Spiritual Weapon: base attack bonus + Wisdom, iteratives, 1d8 + 1 per 3 levels, the form's critical", () => {
          const bab = cleric.system.attributes.bab.total; // 6
          const built = A.ATTACKERS["spiritual weapon"].build({ caster: cleric, cl: 9, form: { name: "Longsword", critRange: 19, critMult: 2 } });
          const act = attackOf(built);
          assert.equal(act.attackBonus, String(bab + 4));
          assert.equal(act.damage.parts[0].formula, "1d8 + 3");
          assert.deepEqual(act.damage.parts[0].types, ["force"]);
          assert.equal(act.ability.critRange, 19);
          assert.equal(act.extraAttacks.manual.length, 1, "BAB 6: one iterative");
          assert.equal(built.ac, 2, "touch AC 12");
        });

        it("Mage's Sword, Twilight Knife, Chain of Perdition: their own numbers", () => {
          const item = { spellbook: { ability: "wis" } };
          const sword = attackOf(A.ATTACKERS["mage's sword"].build({ caster: cleric, cl: 13, item }));
          assert.equal(sword.attackBonus, String(13 + 4 + 3));
          assert.equal(sword.damage.parts[0].formula, "4d6 + 3");
          assert.equal(sword.ability.critRange, 19);
          const knife = A.ATTACKERS["twilight knife"].build({ caster: cleric, cl: 8 });
          assert.equal(attackOf(knife).attackBonus, String(cleric.system.attributes.bab.total + 2), "the better of Int (+2) and Cha (+1)");
          assert.equal(knife.items.find((i) => i.name === "Sneak Attack").system.actions[0].damage.parts[0].formula, "2d6");
          assert.equal(knife.ac, 2 + 2, "12 + Dex");
          const chain = A.ATTACKERS["chain of perdition"].build({ caster: cleric, cl: 7, item });
          assert.sameMembers(chain.items.filter((i) => i.type === "attack").map((i) => i.name), ["Dirty Trick", "Drag", "Reposition", "Trip"]);
          assert.equal(chain.items[0].system.actions[0].attackBonus, String(7 + 4));
        });

        it("the weapon forms carry their critical range, and the alignment's default", async () => {
          const forms = await A.weaponForms();
          assert.isAbove(forms.length, 100);
          assert.deepInclude(forms, { name: "Longsword", critRange: 19, critMult: 2 });
          assert.equal(A.defaultForm({ system: { details: { alignment: "cg" } } }), "Battleaxe");
          assert.equal(A.defaultForm({ system: { details: { alignment: "ne" } } }), "Flail, Light");
          assert.deepEqual(A.iteratives(16).map((x) => x.formula), ["-5", "-10", "-15"]);
        });
      });
    },
    { displayName: "PF1e Revamp: Spell-created attackers" },
  );
}
