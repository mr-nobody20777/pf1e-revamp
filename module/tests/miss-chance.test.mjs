// Miss chances: Blur, Displacement, Blink and Entropic Shield are rolled under each attack on the
// card, with true seeing, see invisibility and Blind-Fight adjusting them per the spell text.

import { createTestActor, addItems, removeItems, waitFor, cleanup, useTestScene, placeToken, setTargets, deleteTokens } from "./helpers.mjs";
import { missChances } from "../miss-chance.mjs";

const MODULE_ID = "pf1e-revamp";

export function registerMissChanceTests(quench) {
  quench.registerBatch(
    "pf1e-revamp.miss-chance",
    (context) => {
      const { describe, it, assert, before, after, afterEach } = context;

      describe("Miss chances", function () {
        this.timeout(30000);
        let attacker, defender, attackerToken, defenderToken, sceneCtl, messagesBefore;

        // Attack with one of the item's actions and return its card's miss chance lines per attack
        async function attack(itemName, actionName) {
          const item = attacker.items.getName(itemName);
          const actionId = actionName ? item.actions.find((a) => a.name === actionName).id : undefined;
          const before = new Set(game.messages.keys());
          setTargets([defenderToken]);
          await item.use({ skipDialog: true, actionId });
          const card = await waitFor(() => game.messages.contents.find((m) => !before.has(m.id) && m.type === "action" && m.speaker.actor === attacker.id));
          return card.getFlag(MODULE_ID, "missChance")?.attacks ?? [];
        }
        const buff = (name, pack = "pf-content.pf-buffs") => [pack, name, { system: { active: true } }];

        before(async () => {
          messagesBefore = new Set(game.messages.keys());
          sceneCtl = await useTestScene();
          attacker = await createTestActor("Quench Miss Attacker", {
            items: [["pf1.classes", "Fighter", { system: { level: 6 } }], ["pf1.weapons-and-ammo", "Longsword"], ["pf1.weapons-and-ammo", "Javelin"]],
          });
          defender = await createTestActor("Quench Miss Defender", { items: [["pf1.classes", "Fighter", { system: { level: 1 } }]] });
          attackerToken = await placeToken(attacker, 2, 2);
          defenderToken = await placeToken(defender, 3, 2, { disposition: CONST.TOKEN_DISPOSITIONS.HOSTILE });
        });

        afterEach(async () => {
          await removeItems(defender, ["Blur", "Displacement", "Blink", "Entropic Shield"]);
          await removeItems(attacker, ["See Invisibility", "Blind-Fight"]);
          await attacker.update({ "system.traits.senses.tr.value": 0 });
        });

        after(async () => {
          await deleteTokens([attackerToken, defenderToken]);
          await cleanup([attacker, defender], messagesBefore);
          await sceneCtl.restore();
        });

        it("no miss chance buff: nothing rolled", async () => {
          assert.isEmpty(await attack("Longsword"));
        });

        it("Blur: 20% rolled under every attack", async () => {
          await addItems(defender, [buff("Blur")]);
          const attacks = await attack("Longsword");
          assert.lengthOf(attacks, 2, "BAB +6: two attacks");
          for (const [line] of attacks) {
            assert.equal(line.chance, 20);
            assert.equal(line.label, "Blur");
            assert.equal(line.miss, line.rolls[0] <= 20);
          }
        });

        it("Displacement beats Blur (miss chances don't stack)", async () => {
          await addItems(defender, [buff("Blur"), buff("Displacement")]);
          const [[line]] = await attack("Longsword");
          assert.equal(line.chance, 50);
          assert.equal(line.label, "Displacement");
        });

        it("true seeing negates Blur", async () => {
          await addItems(defender, [buff("Blur")]);
          await attacker.update({ "system.traits.senses.tr.value": 120 });
          assert.isEmpty((await attack("Longsword")).flat());
        });

        it("Blink: 50%, or 20% for an attacker who sees invisible creatures", async () => {
          await addItems(defender, [buff("Blink")]);
          assert.equal((await attack("Longsword"))[0][0].chance, 50);
          await addItems(attacker, [buff("See Invisibility", "pf1.buffs")]);
          assert.equal((await attack("Longsword"))[0][0].chance, 20);
        });

        it("Entropic Shield: ranged attacks only", async () => {
          await addItems(defender, [buff("Entropic Shield")]);
          assert.isEmpty((await attack("Javelin", "Melee")).flat(), "melee unaffected");
          const [[line]] = await attack("Javelin", "Throw");
          assert.equal(line.chance, 20);
        });

        it("Nevela's Concealed: left to Nevela unless ours is higher, then Nevela's roll is struck", async function () {
          if (!game.modules.get("nevelas-automation-suite")?.active) this.skip();
          // Added directly (not setCondition) so Nevela's Normal/Total picker doesn't open
          const [effect] = await defender.createEmbeddedDocuments("ActiveEffect", [{ name: "Concealed", img: "icons/svg/mystery-man.svg", statuses: ["concealed"] }]);
          try {
            const cardOf = async () => {
              const before = new Set(game.messages.keys());
              await attack("Longsword");
              return game.messages.contents.find((m) => !before.has(m.id) && m.type === "action");
            };
            const plain = await cardOf();
            assert.isUndefined(plain.getFlag(MODULE_ID, "missChance"), "Nevela rolls the 20%");
            assert.isNotEmpty((await plain.renderHTML()).querySelectorAll("[data-nas-concealment-footnote]"), "one Nevela roll per attack");

            await addItems(defender, [buff("Displacement")]);
            const displaced = await cardOf();
            assert.equal(displaced.getFlag(MODULE_ID, "missChance").attacks[0][0].chance, 50);
            for (const note of (await displaced.renderHTML()).querySelectorAll("[data-nas-concealment-footnote]")) {
              assert.equal(note.style.textDecoration, "line-through");
            }
          } finally {
            await effect.delete();
          }
        });

        it("Blind-Fight rerolls a concealment miss in melee", async () => {
          await addItems(defender, [buff("Blur")]);
          await addItems(attacker, [["pf1.feats", "Blind-Fight"]]);
          const random = CONFIG.Dice.randomUniform;
          CONFIG.Dice.randomUniform = () => 0.001; // every die rolls a 1
          let attacks;
          try {
            attacks = await attack("Longsword");
          } finally {
            CONFIG.Dice.randomUniform = random;
          }
          const [line] = attacks[0];
          assert.deepEqual(line.rolls, [1, 1], "missed, then rerolled");
          assert.isTrue(line.miss);
        });

        it("faerie fire, blindsight and Improved Precise Shot remove the miss chances they ignore", async () => {
          const longsword = attacker.items.getName("Longsword");
          const javelin = attacker.items.getName("Javelin");
          const labels = (item, type, opts) => missChances(defender, attacker, item, type, opts).map((c) => c.label);
          const [blur] = await defender.createEmbeddedDocuments("Item", [{ name: "Blur", type: "buff", system: { active: true } }]);
          const [ff] = await defender.createEmbeddedDocuments("Item", [{ name: "Faerie Fire", type: "buff", system: { active: true } }]);
          try {
            assert.notInclude(labels(longsword, "mwak"), "Blur", "faerie fire: no blur");
            await ff.delete();
            assert.include(labels(longsword, "mwak"), "Blur");
            const [ips] = await attacker.createEmbeddedDocuments("Item", [{ name: "Improved Precise Shot", type: "feat", system: { subType: "feat" } }]);
            assert.notInclude(labels(javelin, "twak"), "Blur", "less than total concealment");
            assert.include(labels(longsword, "mwak"), "Blur", "ranged attacks only");
            const [disp] = await defender.createEmbeddedDocuments("Item", [{ name: "Displacement", type: "buff", system: { active: true } }]);
            assert.include(labels(javelin, "twak"), "Displacement", "as if total concealment");
            await disp.delete();
            await ips.delete();
            await defender.setCondition("invisible", true);
            const [bs] = await attacker.createEmbeddedDocuments("Item", [{ name: "Blindsight 30'", type: "feat", system: { subType: "misc" } }]);
            assert.notInclude(labels(longsword, "mwak", { distance: 5 }), "Invisible", "within 30 ft.");
            assert.include(labels(longsword, "mwak", { distance: 40 }), "Invisible", "beyond its range");
            await bs.delete();
          } finally {
            await defender.setCondition("invisible", false);
            if (defender.items.has(blur.id)) await blur.delete();
            if (defender.items.has(ff.id)) await ff.delete();
          }
        });
      });
    },
    { displayName: "PF1e Revamp: Miss Chances" }
  );
}
