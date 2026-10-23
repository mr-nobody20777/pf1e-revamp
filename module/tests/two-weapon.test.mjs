// Two-weapon fighting: penalties, off-hand attacks, Double Slice, Two-Weapon Defense, Shield-Trained.
// Expected values come from Rules Text/Two-Weapon Fighting.txt.

import { createTestActor, addItems, removeItems, useAndCollect, formulas, cleanup } from "./helpers.mjs";

const penalty = (n) => new RegExp(`-\\s*${n}\\[Two-Weapon Fighting\\]`);

export function registerTwoWeaponTests(quench) {
  quench.registerBatch(
    "pf1e-revamp.two-weapon",
    (context) => {
      const { describe, it, assert, before, after } = context;

      describe("Two-weapon fighting", function () {
        this.timeout(30000);
        let actor, longsword, shortsword, shield, messagesBefore;

        before(async () => {
          messagesBefore = new Set(game.messages.keys());
          actor = await createTestActor("Quench TWF", {
            abilities: { str: 16, dex: 17 },
            items: [
              ["pf1.classes", "Fighter", { system: { level: 6 } }],
              ["pf1.weapons-and-ammo", "Longsword"],
              ["pf1.weapons-and-ammo", "Shortsword"],
              ["pf1.armors-and-shields", "Heavy Steel Shield"],
            ],
          });
          longsword = actor.items.getName("Longsword");
          shortsword = actor.items.getName("Shortsword");
          shield = actor.items.getName("Heavy Steel Shield");
        });

        after(async () => cleanup([actor], messagesBefore));

        it("no feats, light off-hand: −4 main / −8 off, one off-hand attack, ½ Str", async () => {
          const [main, off] = await useAndCollect(longsword, { cards: 2, options: { twfOffhand: shortsword.id } });
          const m = formulas(main), o = formulas(off);
          assert.equal(m.length, 2, "two main-hand attacks at BAB +6");
          for (const a of m) assert.match(a.attack, penalty(4));
          assert.equal(o.length, 1, "one off-hand attack");
          assert.match(o[0].attack, penalty(8));
          assert.match(o[0].damage, /\+ 1\[Strength\]/, "½ of Str +3, rounded down");
        });

        it("Two-Weapon Fighting + Improved: −2/−2 and off-hand attacks at +0 and −5", async () => {
          await addItems(actor, [["pf1.feats", "Two-Weapon Fighting"], ["pf1.feats", "Improved Two-Weapon Fighting"]]);
          const [main, off] = await useAndCollect(longsword, { cards: 2, options: { twfOffhand: shortsword.id } });
          for (const a of formulas(main)) assert.match(a.attack, penalty(2));
          const o = formulas(off);
          assert.equal(o.length, 2);
          for (const a of o) assert.match(a.attack, penalty(2));
          assert.notMatch(o[0].attack, /Off-hand iterative/);
          assert.match(o[1].attack, /-\s*5\[Off-hand iterative\]/);
        });

        it("Double Slice adds the other half of Str to off-hand damage", async () => {
          await addItems(actor, [["pf1.feats", "Double Slice"]]);
          const [, off] = await useAndCollect(longsword, { cards: 2, options: { twfOffhand: shortsword.id } });
          assert.match(formulas(off)[0].damage, /2\[Double Slice\]/);
          await removeItems(actor, ["Double Slice"]);
        });

        it("non-light off-hand with the feat: −4/−4", async () => {
          const [main, off] = await useAndCollect(longsword, { cards: 2, options: { twfOffhand: shield.id } });
          assert.match(formulas(main)[0].attack, penalty(4));
          assert.match(formulas(off)[0].attack, penalty(4));
        });

        it("Two-Weapon Defense: +1 shield AC, +2 while fighting defensively", async () => {
          await addItems(actor, [["pf1.feats", "Two-Weapon Defense"]]);
          await useAndCollect(longsword, { cards: 2, options: { twfOffhand: shortsword.id } });
          let buff = actor.itemTypes.buff.find((b) => b.getFlag("pf1e-revamp", "twfDefense"));
          assert.ok(buff?.isActive, "defense buff active");
          assert.equal(buff.system.changes[0].formula, "1");
          await addItems(actor, [["pf1.buffs", "Fighting Defensively", { system: { active: true } }]]);
          await useAndCollect(longsword, { cards: 2, options: { twfOffhand: shortsword.id } });
          buff = actor.itemTypes.buff.find((b) => b.getFlag("pf1e-revamp", "twfDefense"));
          assert.equal(buff.system.changes[0].formula, "2");
          await removeItems(actor, ["Fighting Defensively", "Two-Weapon Defense"]);
        });

        it("Shield-Trained: heavy shield bash is proficient and counts as light", async () => {
          await addItems(actor, [["pf-content.pf-traits", "Shield-Trained (Gorum)"]]);
          assert.isTrue(actor.items.getName("Heavy Steel Shield").isProficient);
          const [main, off] = await useAndCollect(longsword, { cards: 2, options: { twfOffhand: shield.id } });
          assert.match(formulas(main)[0].attack, penalty(2), "light off-hand with the feat");
          assert.notMatch(formulas(off)[0].attack, /Proficiency|Nonproficient/i, "no −4 on the bash");
          await removeItems(actor, ["Shield-Trained (Gorum)"]);
        });

        it("without twfOffhand, attacks are normal", async () => {
          const [main] = await useAndCollect(longsword, { cards: 1 });
          for (const a of formulas(main)) assert.notMatch(a.attack, /Two-Weapon Fighting/);
        });
      });
    },
    { displayName: "PF1e Revamp: Two-Weapon Fighting" }
  );
}
