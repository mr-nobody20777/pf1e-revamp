// Shield bashes: martial proficiency setting, Shield-Trained (and the opt-in flag), Weapon Finesse.

import { createTestActor, addItems, removeItems, useAndCollect, formulas, cleanup } from "./helpers.mjs";

const MODULE_ID = "pf1e-revamp";
const SETTING = "shieldBashMartial";

export function registerShieldBashTests(quench) {
  quench.registerBatch(
    "pf1e-revamp.shield-bash",
    (context) => {
      const { describe, it, assert, before, after } = context;

      describe("Shield bashes", function () {
        this.timeout(30000);
        let fighter, cleric, messagesBefore, settingBefore;
        const heavy = (a) => a.items.getName("Heavy Steel Shield");
        const light = (a) => a.items.getName("Light Steel Shield");

        before(async () => {
          messagesBefore = new Set(game.messages.keys());
          settingBefore = game.settings.get(MODULE_ID, SETTING);
          await game.settings.set(MODULE_ID, SETTING, true);
          fighter = await createTestActor("Quench Shield Fighter", {
            abilities: { str: 14 },
            items: [["pf1.classes", "Fighter", { system: { level: 1 } }], ["pf1.armors-and-shields", "Heavy Steel Shield"]],
          });
          // Cleric: simple weapon proficiency only; Dex 18 / Str 10 for Weapon Finesse
          cleric = await createTestActor("Quench Shield Cleric", {
            abilities: { str: 10, dex: 18 },
            items: [
              ["pf1.classes", "Cleric", { system: { level: 1 } }],
              ["pf1.armors-and-shields", "Heavy Steel Shield"],
              ["pf1.armors-and-shields", "Light Steel Shield"],
            ],
          });
        });

        after(async () => {
          await game.settings.set(MODULE_ID, SETTING, settingBefore);
          await cleanup([fighter, cleric], messagesBefore);
        });

        it("martial setting on: a martial-proficient fighter bashes proficiently", () => {
          assert.isTrue(heavy(fighter).isProficient);
        });

        it("martial setting on: a simple-only cleric is not proficient", () => {
          assert.isFalse(heavy(cleric).isProficient);
        });

        it("martial setting off: PF1's default (nonproficient) is left alone", async () => {
          await game.settings.set(MODULE_ID, SETTING, false);
          assert.isFalse(heavy(fighter).isProficient);
          await game.settings.set(MODULE_ID, SETTING, true);
        });

        it("Shield-Trained makes bashes simple weapons: the cleric becomes proficient", async () => {
          await addItems(cleric, [["pf-content.pf-traits", "Shield-Trained (Gorum)"]]);
          assert.isTrue(heavy(cleric).isProficient);
          await removeItems(cleric, ["Shield-Trained (Gorum)"]);
          assert.isFalse(heavy(cleric).isProficient);
        });

        it("any item can opt in with flags.pf1e-revamp.shieldBash", async () => {
          await cleric.createEmbeddedDocuments("Item", [
            { name: "Homebrew Shieldwork", type: "feat", system: { subType: "misc" }, flags: { [MODULE_ID]: { shieldBash: { category: "simple", heavyIsLight: true } } } },
          ]);
          assert.isTrue(heavy(cleric).isProficient);
          await removeItems(cleric, ["Homebrew Shieldwork"]);
        });

        it("Weapon Finesse: light shield bash uses Dex and the shield's armor check penalty", async () => {
          await addItems(cleric, [["pf1.feats", "Weapon Finesse"]]);
          const [card] = await useAndCollect(light(cleric));
          const attack = formulas(card)[0].attack;
          assert.match(attack, /\[Dexterity\]/);
          assert.notMatch(attack, /\[Strength\]/);
          assert.match(attack, /-\s*1\[Weapon Finesse: shield ACP\]/);
        });

        it("Weapon Finesse: heavy shield bash stays Str without Shield-Trained", async () => {
          const [card] = await useAndCollect(heavy(cleric));
          assert.notMatch(formulas(card)[0].attack, /\[Dexterity\]/);
        });

        it("Weapon Finesse: heavy shield bash uses Dex with Shield-Trained (counts as light)", async () => {
          await addItems(cleric, [["pf-content.pf-traits", "Shield-Trained (Gorum)"]]);
          const [card] = await useAndCollect(heavy(cleric));
          const attack = formulas(card)[0].attack;
          assert.match(attack, /\[Dexterity\]/);
          assert.match(attack, /-\s*2\[Weapon Finesse: shield ACP\]/);
        });
      });
    },
    { displayName: "PF1e Revamp: Shield Bashes" }
  );
}
