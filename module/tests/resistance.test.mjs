// Energy resistance/immunity on quick-applied damage (PF1 only applies them in its dialog).

import { createTestActor, cleanup } from "./helpers.mjs";

const MODULE_ID = "pf1e-revamp";
const SETTING = "quickApplyResistance";

export function registerResistanceTests(quench) {
  quench.registerBatch(
    "pf1e-revamp.resistance",
    (context) => {
      const { describe, it, assert, before, after, beforeEach } = context;

      describe("Quick-apply energy resistance", function () {
        this.timeout(30000);
        let actor, messagesBefore, settingBefore;
        const hp = () => actor.system.attributes.hp.value;
        const instance = (types) => new pf1.models.action.DamagePartModel({ formula: "0", types });
        const hit = (amount, types, extra = {}) => actor.applyDamage(amount, { instances: [instance(types)], ...extra });

        before(async () => {
          messagesBefore = new Set(game.messages.keys());
          settingBefore = game.settings.get(MODULE_ID, SETTING);
          await game.settings.set(MODULE_ID, SETTING, true);
          actor = await createTestActor("Quench Resistant", {
            abilities: { con: 30 },
            items: [["pf1.classes", "Fighter", { system: { level: 5 } }]],
          });
          await actor.update({ "system.traits.eres": { value: [{ amount: 10, operator: true, types: ["fire", ""] }], custom: "" } });
        });

        beforeEach(async () => actor.update({ "system.attributes.hp.value": actor.system.attributes.hp.max }));

        after(async () => {
          await game.settings.set(MODULE_ID, SETTING, settingBefore);
          await cleanup([actor], messagesBefore);
        });

        it("fire resistance 10 reduces 15 fire to 5", async () => {
          const start = hp();
          await hit(15, ["fire"]);
          assert.equal(hp(), start - 5);
        });

        it("7 fire is fully resisted", async () => {
          const start = hp();
          await hit(7, ["fire"]);
          assert.equal(hp(), start);
        });

        it("other energy types aren't reduced", async () => {
          const start = hp();
          await hit(15, ["cold"]);
          assert.equal(hp(), start - 15);
        });

        it("damage through PF1's dialog is left to the dialog", async () => {
          const start = hp();
          await hit(15, ["fire"], { [`${MODULE_ID}FromDialog`]: true });
          assert.equal(hp(), start - 15);
        });

        it("setting off: PF1's default (no reduction) is left alone", async () => {
          await game.settings.set(MODULE_ID, SETTING, false);
          const start = hp();
          await hit(15, ["fire"]);
          assert.equal(hp(), start - 15);
          await game.settings.set(MODULE_ID, SETTING, true);
        });

        // Interop: with or without Nevela's Automation Suite (which applies resistance itself when
        // active), a real chat-card Apply click must reduce damage exactly once.
        it("chat-card Apply reduces once (with or without Nevela's Automation Suite)", async () => {
          const H = await import("./helpers.mjs");
          const sceneCtl = await H.useTestScene();
          const attacker = await H.createTestActor("Quench Fire Attacker");
          await attacker.createEmbeddedDocuments("Item", [{ name: "Fire Strike", type: "attack", system: { subType: "weapon", proficient: true, actions: [{ _id: "firestrike000001", name: "Strike", actionType: "mwak", activation: { type: "attack" }, damage: { parts: [{ formula: "15", types: ["fire"] }] } }] } }]);
          const aTok = await H.placeToken(attacker, 2, 2), dTok = await H.placeToken(actor, 3, 2, { disposition: -1 });
          try {
            H.setTargets([dTok]);
            const [card] = await H.useAndCollect(attacker.items.getName("Fire Strike"));
            const button = await H.waitFor(() => document.querySelector(`[data-message-id="${card.id}"] [data-action="applyDamage"]`));
            dTok.object.control({ releaseOthers: true });
            const start = hp();
            button.click();
            await H.waitFor(() => hp() !== start);
            assert.equal(start - hp(), 5);
          } finally {
            canvas.tokens.releaseAll();
            await H.deleteTokens([aTok, dTok]);
            await attacker.delete();
            await sceneCtl.restore();
          }
        });

        it("immunity ignores the damage entirely", async () => {
          await actor.update({ "system.traits.di": ["fire"] });
          const start = hp();
          await hit(40, ["fire"]);
          assert.equal(hp(), start);
        });
      });
    },
    { displayName: "PF1e Revamp: Quick-Apply Resistance" }
  );
}
