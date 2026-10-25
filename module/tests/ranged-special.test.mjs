// Ranged combat, phase 4: firearms against touch AC, Pinpoint Targeting, Aspect of the Falcon,
// confirmation traits, and the situational bonuses in the roll window.

import { createTestActor, addItems, cleanup, useTestScene, placeToken, setTargets, deleteTokens, waitFor } from "./helpers.mjs";
import { _test as effects } from "../roll-effects.mjs";
import { _test as ranged } from "../ranged.mjs";
import { _test as defense } from "../ranged-defense.mjs";

const MODULE_ID = "pf1e-revamp";

export function registerRangedSpecialTests(quench) {
  quench.registerBatch(
    "pf1e-revamp.ranged-special",
    (context) => {
      const { describe, it, assert, before, after, afterEach } = context;

      describe("Ranged combat: special shots and firearms", function () {
        this.timeout(45000);
        let shooter, ally, goblin, shooterToken, allyToken, goblinToken, sceneCtl, messagesBefore;
        const made = [];
        const give = async (actor, ...items) => {
          const docs = await addItems(actor, items);
          made.push(...docs);
          return docs;
        };
        const action = (name) => shooter.items.getName(name).defaultAction;
        const entry = (name, id, flags = {}) => effects.buildModel(shooter, { kind: "attack", action: action(name), flags }).provided.find((p) => p.id === id);
        async function fire(name) {
          const before = new Set(game.messages.keys());
          await shooter.items.getName(name).use({ skipDialog: true });
          return waitFor(() => game.messages.contents.find((m) => !before.has(m.id) && m.type === "action"));
        }

        before(async () => {
          messagesBefore = new Set(game.messages.keys());
          sceneCtl = await useTestScene();
          shooter = await createTestActor("Quench Special Shooter", {
            abilities: { dex: 16 },
            items: [["pf1.classes", "Fighter", { system: { level: 6 } }], ["pf1.weapons-and-ammo", "Longbow"], ["pf1.weapons-and-ammo", "Arrow", { system: { quantity: 50 } }], ["pf1.weapons-and-ammo", "Light Crossbow"], ["pf1.weapons-and-ammo", "Crossbow Bolt", { system: { quantity: 50 } }], ["pf1.weapons-and-ammo", "Sling"], ["pf1.weapons-and-ammo", "Sling Bullet", { system: { quantity: 50 } }], ["pf1.weapons-and-ammo", "Pistol"], ["pf1.weapons-and-ammo", "Firearm Bullet", { system: { quantity: 20 } }], ["pf1.weapons-and-ammo", "Longsword"]],
          });
          ally = await createTestActor("Quench Special Ally", { items: [["pf1.classes", "Fighter", { system: { level: 1 } }]] });
          goblin = await createTestActor("Quench Special Goblin", { items: [["pf1.classes", "Fighter", { system: { level: 1 } }]] });
          shooterToken = await placeToken(shooter, 1, 1);
          goblinToken = await placeToken(goblin, 6, 1, { disposition: CONST.TOKEN_DISPOSITIONS.HOSTILE });
          allyToken = await placeToken(ally, 7, 1);
          setTargets([goblinToken]);
        });
        afterEach(async () => {
          for (const doc of made.splice(0)) if (doc.parent?.items.has(doc.id)) await doc.delete();
          setTargets([goblinToken]);
        });
        after(async () => {
          await deleteTokens([shooterToken, allyToken, goblinToken]);
          await cleanup([shooter, ally, goblin], messagesBefore);
          await sceneCtl?.restore();
        });

        it("a firearm within its first range increment resolves against touch AC (GM line)", async () => {
          const move = (squares) => goblinToken.update({ x: shooterToken.x + squares * canvas.grid.size, y: shooterToken.y }, { animate: false });
          try {
            await move(3);
            const near = await fire("Pistol");
            const t = near.getFlag(MODULE_ID, defense.FLAG)?.targets?.[0];
            assert.isTrue(t?.firearmTouch, "15 ft: within a pistol's 20 ft increment");
            assert.equal(t.ac, goblin.system.attributes.ac.touch.total);
            await move(6);
            const far = await fire("Pistol");
            assert.isNotTrue(far.getFlag(MODULE_ID, defense.FLAG)?.targets?.[0]?.firearmTouch, "30 ft: beyond it");
          } finally {
            await move(5);
          }
        });

        it("Aspect of the Falcon: bows threaten on 19–20 and crossbows deal ×3", async () => {
          await give(shooter, ["pf-content.pf-buffs", "Aspect of the Falcon", { system: { active: true } }]);
          let seen;
          const spy = Hooks.on("pf1PreAttackRoll", (a, c, rollData, rollOptions) => (seen = { range: rollOptions.critical, mult: rollData.critMult }));
          try {
            await fire("Light Crossbow");
            await new Promise((r) => setTimeout(r, 100));
          } finally {
            Hooks.off("pf1PreAttackRoll", spy);
          }
          assert.isAtMost(seen.range, 19);
          assert.equal(seen.mult, 3);
        });

        it("situational bonuses: Halfling Slinger, Large Target (precision), Bullseye Shot and Pinpoint Targeting to tick", async () => {
          await give(shooter, ["pf-content.pf-feats", "Halfling Slinger"], ["pf-content.pf-feats", "Large Target"], ["pf-content.pf-feats", "Bullseye Shot"], ["pf1.feats", "Pinpoint Targeting"]);
          assert.deepInclude(entry("Sling", "halfling-slinger"), { atk: 1, applies: true });
          assert.isUndefined(entry("Longbow", "halfling-slinger"), "slings only");
          assert.isUndefined(entry("Sling", "large-target"), "the goblin isn't larger");
          await goblin.update({ "system.traits.size": "lg" });
          try {
            const large = entry("Sling", "large-target");
            assert.deepInclude(large, { applies: true, damageType: "precision" });
            assert.equal(large.dice.dmg, "1");
          } finally {
            await goblin.update({ "system.traits.size": "med" });
          }
          assert.deepInclude(entry("Longbow", "bullseye-shot"), { atk: 4, applies: false });
          assert.isFalse(entry("Longbow", "pinpoint-targeting").applies);
        });

        it("Pinpoint Targeting ticked: the GM line shows AC without armor, natural armor and shield", async () => {
          await give(shooter, ["pf1.feats", "Pinpoint Targeting"]);
          const model = effects.buildModel(shooter, { kind: "attack", action: action("Longbow"), flags: {} });
          const state = effects.newState(model, new Map([["pinpoint-targeting", true]]));
          const plan = effects.planFor(model, state);
          assert.isTrue(plan.provided.some((p) => p.pinpoint));
          const before = new Set(game.messages.keys());
          const data = action("Longbow").getRollData();
          // Through the attack window the plan is set; here the hook reads it from the roll data
          Hooks.once("pf1CreateActionUse", (use) => (use.shared.rollData.pf1eRevampRollEffects = plan));
          await shooter.items.getName("Longbow").use({ skipDialog: true });
          const card = await waitFor(() => game.messages.contents.find((m) => !before.has(m.id) && m.type === "action"));
          assert.isTrue(card.getFlag(MODULE_ID, defense.FLAG)?.targets?.[0]?.pinpoint);
        });

        it("Coordinated Shot: +1 when an ally with the feat threatens the target", async () => {
          await give(shooter, ["pf-content.pf-feats", "Coordinated Shot"]);
          assert.isFalse(entry("Longbow", "coordinated-shot").applies, "the ally doesn't have it");
          await give(ally, ["pf-content.pf-feats", "Coordinated Shot"]);
          assert.deepInclude(entry("Longbow", "coordinated-shot"), { atk: 1, applies: true }, "the shooter doesn't flank");
        });

        it("Opening Volley: offered on melee attacks, to tick", async () => {
          await give(shooter, ["pf-content.pf-feats", "Opening Volley"]);
          assert.deepInclude(entry("Longsword", "opening-volley"), { atk: 4, applies: false });
          assert.isUndefined(entry("Longbow", "opening-volley"));
        });
      });
    },
    { displayName: "PF1e Revamp: Ranged Special Shots" }
  );
}
