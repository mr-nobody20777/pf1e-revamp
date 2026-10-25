// Ranged combat, phase 1: range changes fed to Roll Bonuses, Point-Blank Shot within 30 ft, and the
// distance-dependent bonuses in the roll window.

import { createTestActor, addItems, cleanup, useTestScene, placeToken, setTargets, deleteTokens, waitFor } from "./helpers.mjs";
import { _test as effects } from "../roll-effects.mjs";
import { _test as ranged } from "../ranged.mjs";

const rollBonuses = () => !!game.modules.get("ckl-roll-bonuses")?.active;

export function registerRangedTests(quench) {
  quench.registerBatch(
    "pf1e-revamp.ranged",
    (context) => {
      const { describe, it, assert, before, after, afterEach } = context;

      describe("Ranged combat: range and Point-Blank Shot", function () {
        this.timeout(45000);
        let archer, goblin, archerToken, goblinToken, sceneCtl, messagesBefore;
        const made = [];
        const add = async (...items) => {
          const docs = await addItems(archer, items);
          made.push(...docs);
          return docs;
        };
        const at = (squares) => goblinToken.update({ x: archerToken.x + squares * canvas.grid.size, y: archerToken.y }, { animate: false });
        const dagger = () => archer.items.getName("Dagger").actions.find((a) => a.actionType === "twak");
        // Throw a dagger (10 ft increments; each throw uses one from the stack) and return the attack formula
        async function attackFormula(action = dagger()) {
          const before = new Set(game.messages.keys());
          await action.item.use({ actionId: action.id, skipDialog: true });
          const card = await waitFor(() => game.messages.contents.find((m) => !before.has(m.id) && m.type === "action"));
          return card.systemRolls.attacks[0].attack.formula;
        }
        // Roll Bonuses' range penalty part in an attack formula ("-4[Range ...]"), or 0
        const rangePenalty = (formula) => {
          const part = [...formula.matchAll(/-\s?(\d+)\[([^\]]*)\]/g)].find((m) => /range/i.test(m[2]));
          return part ? -Number(part[1]) : 0;
        };
        const entry = (id, flags = {}) => effects.buildModel(archer, { kind: "attack", action: dagger(), flags }).provided.find((p) => p.id === id);

        before(async () => {
          messagesBefore = new Set(game.messages.keys());
          sceneCtl = await useTestScene();
          archer = await createTestActor("Quench Range Archer", { abilities: { dex: 16, int: 14 }, items: [["pf1.classes", "Fighter", { system: { level: 6 } }], ["pf1.weapons-and-ammo", "Dagger", { system: { quantity: 50 } }], ["pf1.weapons-and-ammo", "Longbow"], ["pf1.weapons-and-ammo", "Arrow", { system: { quantity: 50 } }]] });
          goblin = await createTestActor("Quench Range Goblin", { items: [["pf1.classes", "Fighter", { system: { level: 1 } }]] });
          archerToken = await placeToken(archer, 1, 1);
          goblinToken = await placeToken(goblin, 8, 1, { disposition: CONST.TOKEN_DISPOSITIONS.HOSTILE });
          setTargets([goblinToken]);
        });
        afterEach(async () => {
          for (const doc of made.splice(0)) if (doc.parent?.items.has(doc.id)) await doc.delete();
          await goblinToken.update({ elevation: 0 });
          setTargets([goblinToken]);
        });
        after(async () => {
          await deleteTokens([archerToken, goblinToken]);
          await cleanup([archer, goblin], messagesBefore);
          await sceneCtl?.restore();
        });

        it("recognizes range changes: Far Shot, Distance Thrower, Longshot, the belt, distance weapons", async () => {
          assert.deepInclude(ranged.rangeChanges(archer, dagger()), { add: 0, double: false, perIncrement: 2, reduce: 0 });
          await add(["pf1.feats", "Far Shot"], ["pf-content.pf-feats", "Distance Thrower"], ["pf-content.pf-buffs", "Longshot", { system: { active: true } }], ["pf-content.pf-wondrous", "Belt of Mighty Hurling, Lesser", { system: { equipped: true } }]);
          const thrown = ranged.rangeChanges(archer, dagger());
          assert.deepInclude(thrown, { add: 20, perIncrement: 1, reduce: 2 });
          const bow = ranged.rangeChanges(archer, archer.items.getName("Longbow").defaultAction);
          assert.deepInclude(bow, { add: 10, reduce: 0 }, "the belt and Distance Thrower are for thrown weapons");
          const sword = archer.items.getName("Dagger");
          await sword.update({ name: "Distance Dagger" });
          try {
            assert.isTrue(ranged.rangeChanges(archer, archer.items.getName("Distance Dagger").actions.find((a) => a.actionType === "twak")).double);
          } finally {
            await sword.update({ name: "Dagger" });
          }
        });

        it("feeds Roll Bonuses: 35 ft with a dagger is −6; Distance Thrower −4; Far Shot −3; Longshot −2", async function () {
          if (!rollBonuses()) this.skip();
          await at(7);
          assert.equal(rangePenalty(await attackFormula()), -6, "4th increment: −2 × 3");
          const [thrower] = await add(["pf-content.pf-feats", "Distance Thrower"]);
          assert.equal(rangePenalty(await attackFormula()), -4);
          await thrower.delete();
          const [farShot] = await add(["pf1.feats", "Far Shot"]);
          assert.equal(rangePenalty(await attackFormula()), -3);
          await farShot.delete();
          await add(["pf-content.pf-buffs", "Longshot", { system: { active: true } }]);
          assert.equal(rangePenalty(await attackFormula()), -2, "20 ft increments: 2nd increment");
        });

        it("Point-Blank Shot: ticked within 30 ft, not beyond", async () => {
          await add(["pf1.feats", "Point-Blank Shot"]);
          await at(5);
          assert.match(await attackFormula(), /1\[Point-Blank Shot\]/, "25 ft");
          await at(7);
          assert.notMatch(await attackFormula(), /Point-Blank Shot/, "35 ft");
        });

        it("Point-Blank Shot in the attack window: the box starts ticked when the target is close", async () => {
          await add(["pf1.feats", "Point-Blank Shot"]);
          await at(3);
          const windowsBefore = new Set(Object.keys(ui.windows));
          const using = archer.items.getName("Dagger").use({ actionId: dagger().id, skipDialog: false });
          const dialog = await waitFor(() => Object.entries(ui.windows).find(([id, w]) => !windowsBefore.has(id) && w.constructor.name === "AttackDialog" && w.rendered)?.[1], { what: "the attack window" });
          try {
            assert.isTrue(!!dialog.flags["point-blank-shot"]);
            assert.isTrue(dialog.element[0].querySelector('input[name="point-blank-shot"]')?.checked);
          } finally {
            await waitFor(() => dialog._state === Application.RENDER_STATES.RENDERED);
            await dialog.close();
            await using;
          }
        });

        it("situational: Observant Archer by elevation, Canopy Shooter on higher ground, Focused Shot to tick, Mythic Point-Blank Shot", async () => {
          await add(["pf-content.pf-traits", "Observant Archer (Aquatic origin)"], ["pf-content.pf-traits", "Canopy Shooter (Grippli)"], ["pf-content.pf-feats", "Eagle-Eyed"], ["pf-content.pf-feats", "Point-Blank Shot (Mythic)"]);
          await at(4);
          assert.isFalse(entry("observant-archer").applies);
          await goblinToken.update({ elevation: 10 });
          assert.isTrue(entry("observant-archer").applies, `observant: ${JSON.stringify(entry("observant-archer"))}`);
          assert.isFalse(entry("canopy-shooter").applies);
          assert.isTrue(entry("canopy-shooter", { highGround: true }).applies, `canopy: ${JSON.stringify(entry("canopy-shooter", { highGround: true }))}`);
          assert.match(entry("eagle-eyed").reason, /100 ft/);
          assert.isUndefined(entry("pbs-mythic"));
          assert.deepInclude(entry("pbs-mythic", { pointBlankShot: true }), { atk: 1, dmg: 1, applies: true });
          // Focused Shot: bows and crossbows, a standard action
          await add(["pf-content.pf-feats", "Focused Shot"]);
          const bow = archer.items.getName("Longbow").defaultAction;
          const focused = effects.buildModel(archer, { kind: "attack", action: bow, flags: {} }).provided.find((p) => p.id === "focused-shot");
          assert.equal(focused.dmg, 2, "Int 14");
          assert.isFalse(focused.applies);
          assert.match(focused.reason, /single attack/);
        });
      });
    },
    { displayName: "PF1e Revamp: Ranged Combat" }
  );
}
