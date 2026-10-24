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

        it("halving comes before resistance: 20 fire saved for half against resist 10 is fully resisted", async () => {
          const start = hp();
          await hit(20, ["fire"], { ratio: 0.5 });
          assert.equal(hp(), start, "20 halved to 10, then resist 10: nothing");
          await hit(30, ["fire"], { ratio: 0.5 });
          assert.equal(hp(), start - 5, "30 halved to 15, then resist 10: 5");
        });

        it("doubling keeps resistance first (the more favorable order): 15 fire ×2 against resist 10 is 10", async () => {
          const start = hp();
          await hit(15, ["fire"], { ratio: 2 });
          assert.equal(hp(), start - 10);
        });

        const part = (types, value) => Object.assign(instance(types), { value });

        it("mixed damage halved: each type gets its share of the halved total before resistance", async () => {
          const start = hp();
          await actor.applyDamage(12, { instances: [part(["slashing"], 6), part(["fire"], 6)], ratio: 0.5 });
          assert.equal(hp(), start - 3, "12 halved to 6 (3 slashing + 3 fire); the fire is resisted");
          await actor.applyDamage(8, { instances: [part(["fire"], 4), part(["cold"], 4)], ratio: 0.5 });
          assert.equal(hp(), start - 5, "8 halved to 4 (2 fire + 2 cold): the cold still lands");
        });

        it("several types without amounts and no card to read them from: left to the GM, not guessed", async () => {
          const start = hp();
          await actor.applyDamage(10, { instances: [instance(["slashing"]), instance(["fire"])] });
          assert.equal(hp(), start - 10);
        });

        it("later hooks still see the ½ ratio; the note shows the whole damage taken", async () => {
          let seen = null;
          const spy = Hooks.on("pf1ApplyDamage", (a, options) => a === actor && (seen = options.ratio));
          const before = new Set(game.messages.keys());
          try {
            await hit(30, ["fire"], { ratio: 0.5 });
          } finally {
            Hooks.off("pf1ApplyDamage", spy);
          }
          assert.equal(seen, 0.5);
          const start = hp();
          await hit(15, ["fire"], { ratio: 1.5 });
          assert.equal(start - hp(), 7, "15 − 10 resisted = 5, ×1.5 = 7");
          const note = game.messages.contents.filter((m) => !before.has(m.id)).at(-1);
          assert.match(note.content, /Took 7\./);
        });

        it("halved damage and healing never drop below 1 (½ button on 1 point)", async () => {
          const start = hp();
          await actor.applyDamage(1, { ratio: 0.5 });
          assert.equal(hp(), start - 1, "1 damage halved is still 1");
          await actor.applyDamage(-1, { ratio: 0.5 });
          assert.equal(hp(), start, "1 healing halved is still 1");
          await actor.applyDamage(5, { ratio: 0.5 });
          assert.equal(hp(), start - 2, "larger amounts still round down");
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

        it("chat-card ½ on mixed damage: halved before resistance (6 slashing + 4 fire, resist fire 10: 3)", async () => {
          const H = await import("./helpers.mjs");
          const sceneCtl = await H.useTestScene();
          const attacker = await H.createTestActor("Quench Mixed Attacker");
          const parts = [{ formula: "6", types: ["slashing"] }, { formula: "4", types: ["fire"] }];
          await attacker.createEmbeddedDocuments("Item", [{ name: "Flaming Strike", type: "attack", system: { subType: "weapon", proficient: true, actions: [{ _id: "flamestrike00001", name: "Strike", actionType: "mwak", activation: { type: "attack" }, damage: { parts } }] } }]);
          const aTok = await H.placeToken(attacker, 2, 2), dTok = await H.placeToken(actor, 3, 2, { disposition: -1 });
          try {
            H.setTargets([dTok]);
            const [card] = await H.useAndCollect(attacker.items.getName("Flaming Strike"));
            const half = await H.waitFor(() => document.querySelector(`[data-message-id="${card.id}"] [data-action="applyDamage"][data-ratio="0.5"][data-type="normal"]`));
            dTok.object.control({ releaseOthers: true });
            const start = hp();
            half.click();
            await H.waitFor(() => hp() !== start);
            assert.equal(start - hp(), 3, "half of 6 slashing; the 2 fire is resisted");
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
