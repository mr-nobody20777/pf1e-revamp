// Ranged combat, phase 3: loaded weapons and reloading (opt-in), full attacks with thrown weapons, and
// the warning for shooting while threatened.

import { createTestActor, addItems, cleanup, useTestScene, placeToken, setTargets, deleteTokens, waitFor } from "./helpers.mjs";
import { _test as actions, reload, loadedShots } from "../ranged-actions.mjs";
import { _test as ranged } from "../ranged.mjs";

const MODULE_ID = "pf1e-revamp";

export function registerRangedActionTests(quench) {
  quench.registerBatch(
    "pf1e-revamp.ranged-actions",
    (context) => {
      const { describe, it, assert, before, after, afterEach } = context;

      describe("Ranged combat: action economy", function () {
        this.timeout(45000);
        let shooter, goblin, shooterToken, goblinToken, sceneCtl, messagesBefore, settingBefore;
        const made = [];
        const add = async (...items) => {
          const docs = await addItems(shooter, items);
          made.push(...docs);
          return docs;
        };
        const item = (name) => shooter.items.getName(name);
        const info = (name) => actions.loading(shooter, item(name));
        async function fire(name, options = {}) {
          const before = new Set(game.messages.keys());
          await item(name).use({ skipDialog: true, ...options });
          await new Promise((r) => setTimeout(r, 300));
          return game.messages.contents.find((m) => !before.has(m.id) && m.type === "action") ?? null;
        }

        before(async () => {
          messagesBefore = new Set(game.messages.keys());
          settingBefore = game.settings.get(MODULE_ID, actions.SETTING);
          sceneCtl = await useTestScene();
          shooter = await createTestActor("Quench Reload Shooter", {
            abilities: { dex: 16, str: 14 },
            items: [["pf1.classes", "Fighter", { system: { level: 6 } }], ["pf1.weapons-and-ammo", "Light Crossbow"], ["pf1.weapons-and-ammo", "Heavy Crossbow"], ["pf1.weapons-and-ammo", "Crossbow Bolt", { system: { quantity: 50 } }], ["pf1.weapons-and-ammo", "Sling"], ["pf1.weapons-and-ammo", "Longbow"], ["pf1.weapons-and-ammo", "Arrow", { system: { quantity: 50 } }], ["pf1.weapons-and-ammo", "Javelin", { system: { quantity: 10 } }], ["pf1.weapons-and-ammo", "Dagger", { system: { quantity: 10 } }], ["pf1.weapons-and-ammo", "Pistol"], ["pf1.weapons-and-ammo", "Revolver"], ["pf1.weapons-and-ammo", "Double-Barreled Pistol"], ["pf1.weapons-and-ammo", "Musket"]],
          });
          goblin = await createTestActor("Quench Reload Goblin", { items: [["pf1.classes", "Fighter", { system: { level: 1 } }]] });
          shooterToken = await placeToken(shooter, 1, 1);
          goblinToken = await placeToken(goblin, 5, 1, { disposition: CONST.TOKEN_DISPOSITIONS.HOSTILE });
          setTargets([goblinToken]);
        });
        afterEach(async () => {
          for (const doc of made.splice(0)) if (doc.parent?.items.has(doc.id)) await doc.delete();
          for (const i of shooter.items) if (i.getFlag(MODULE_ID, actions.LOADED) != null) await i.unsetFlag(MODULE_ID, actions.LOADED);
          await game.settings.set(MODULE_ID, actions.SETTING, settingBefore);
          await goblinToken.update({ x: shooterToken.x + 4 * canvas.grid.size, y: shooterToken.y }, { animate: false });
          if (goblin.statuses.has("unconscious")) await goblin.setCondition("unconscious", false);
          setTargets([goblinToken]);
        });
        after(async () => {
          await deleteTokens([shooterToken, goblinToken]);
          await cleanup([shooter, goblin], messagesBefore);
          await sceneCtl?.restore();
        });

        it("how each weapon loads, and the feats that speed it up", async () => {
          assert.deepInclude(info("Light Crossbow"), { capacity: 1, step: "move", provokes: true });
          assert.equal(info("Heavy Crossbow").step, "full-round");
          assert.deepInclude(info("Sling"), { step: "move" });
          assert.isNull(info("Longbow"), "bows draw arrows as a free action");
          assert.isNull(info("Javelin"));
          assert.deepInclude(info("Pistol"), { capacity: 1, step: "standard", firearm: true });
          assert.equal(info("Musket").step, "full-round");
          assert.deepInclude(info("Revolver"), { capacity: 6, step: "move" });
          assert.equal(info("Double-Barreled Pistol").capacity, 2);
          await add(["pf1.feats", "Rapid Reload"]);
          assert.equal(info("Light Crossbow").step, "free");
          assert.equal(info("Heavy Crossbow").step, "move");
          assert.equal(info("Pistol").step, "move", "firearms one step faster");
          await add(["pf-content.pf-feats", "Crossbow Mastery"]);
          assert.deepInclude(info("Heavy Crossbow"), { step: "free", provokes: false });
        });

        it("slings aren't thrown weapons for range feats (PF1 marks them thrown)", () => {
          const sling = item("Sling").defaultAction;
          assert.equal(sling.actionType, "twak");
          assert.isFalse(ranged.weaponKind(sling).thrown);
        });

        it("off by default: an empty crossbow still fires", async () => {
          await game.settings.set(MODULE_ID, actions.SETTING, false);
          await item("Light Crossbow").setFlag(MODULE_ID, actions.LOADED, 0);
          assert.isNotNull(await fire("Light Crossbow"));
        });

        it("on: firing empties it, an empty one is refused, reloading fills it", async () => {
          await game.settings.set(MODULE_ID, actions.SETTING, true);
          assert.isNotNull(await fire("Light Crossbow", { options: { fullAttack: false } }));
          assert.equal(loadedShots(item("Light Crossbow"), info("Light Crossbow")), 0);
          assert.isNull(await fire("Light Crossbow"), "refused");
          const before = new Set(game.messages.keys());
          await reload(item("Light Crossbow"));
          const note = game.messages.contents.find((m) => !before.has(m.id) && m.getFlag(MODULE_ID, "reloaded"));
          assert.match(note.content, /move action, provokes/);
          assert.equal(loadedShots(item("Light Crossbow"), info("Light Crossbow")), 1);
          assert.isNotNull(await fire("Light Crossbow"));
        });

        it("on: a full attack gets only the loaded shots", async () => {
          await game.settings.set(MODULE_ID, actions.SETTING, true);
          const crossbow = await fire("Light Crossbow");
          assert.lengthOf(crossbow.systemRolls.attacks, 1, "BAB +6 but one bolt loaded");
          await reload(item("Light Crossbow"));
          await add(["pf1.feats", "Rapid Reload"]);
          const rapid = await fire("Light Crossbow");
          assert.lengthOf(rapid.systemRolls.attacks, 2, "Rapid Reload: reloading is free, full rate");
        });

        it("on: weapons reload when combat ends", async () => {
          await game.settings.set(MODULE_ID, actions.SETTING, true);
          await item("Light Crossbow").setFlag(MODULE_ID, actions.LOADED, 0);
          const combat = await Combat.create({ scene: canvas.scene.id, active: true, flags: { [MODULE_ID]: { quench: true } } });
          await combat.createEmbeddedDocuments("Combatant", [{ tokenId: shooterToken.id, sceneId: canvas.scene.id, actorId: shooter.id, initiative: 10 }]);
          await combat.delete();
          await waitFor(() => item("Light Crossbow").getFlag(MODULE_ID, actions.LOADED) == null, { what: "the reload" });
        });

        it("shooting while threatened: a warning on the card (always on), not from a creature that can't act", async () => {
          await goblinToken.update({ x: shooterToken.x + canvas.grid.size, y: shooterToken.y }, { animate: false });
          const card = await fire("Longbow");
          assert.deepEqual(card.getFlag(MODULE_ID, "provokes"), [goblinToken.name]);
          assert.match((await card.renderHTML()).textContent, /Shooting while threatened by .*: provokes attacks of opportunity/);
          await goblin.setCondition("unconscious", true);
          const quiet = await fire("Longbow");
          assert.isUndefined(quiet.getFlag(MODULE_ID, "provokes"));
        });
      });
    },
    { displayName: "PF1e Revamp: Ranged Action Economy" }
  );
}
