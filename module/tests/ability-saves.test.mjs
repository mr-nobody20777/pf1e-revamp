// Abilities that aren't spells: their save rows, the effect read from their text, and attack delivery.

import { createTestActor, cleanup, useTestScene, placeToken, setTargets, deleteTokens, waitFor } from "./helpers.mjs";
import { abilityDef } from "../ability-effects.mjs";
import { settled } from "../util.mjs";

const MODULE_ID = "pf1e-revamp";
const FLAG = "spell";

export function registerAbilitySaveTests(quench) {
  quench.registerBatch(
    "pf1e-revamp.ability-saves",
    (context) => {
      const { describe, it, assert, before, after, afterEach } = context;
      const fake = (name, text) => ({ name, type: "feat", system: { description: { value: `<p>${text}</p>` } } });

      describe("Reading an ability's effect", function () {
        it("conditions, durations, permanent effects and what a successful save leaves", () => {
          assert.deepEqual(abilityDef(fake("A", "The target must succeed at a Fortitude save or be blinded for 1d6 rounds."), "fort").effect.conditions, [["blind", "1d6"]]);
          assert.deepEqual(abilityDef(fake("B", "Any living creature it hits must succeed on a Fortitude save or be permanently @Condition[paralyzed]."), "fort").effect.conditions, [["paralyzed", null]]);
          const crit = abilityDef(fake("C", "The target is blinded permanently. A successful Fortitude save reduces this to dazzled for 1d4 rounds."), "fort");
          assert.deepEqual(crit.effect.conditions, [["blind", null]]);
          assert.deepEqual(crit.onSave.conditions, [["dazzled", "1d4"]]);
          assert.deepEqual(abilityDef(fake("D", "Deals no damage but staggers creatures for 1 round and deafens them for 1d4 rounds (DC 15 Fortitude save negates)."), "fort").effect.conditions, [["staggered", "1"], ["deaf", "1d4"]]);
          assert.deepEqual(abilityDef(fake("E", "It must succeed at a Fortitude save or become fatigued for a number of rounds equal to your Wisdom modifier (minimum 1)."), "fort").effect.conditions, [["fatigued", "max(1, @abilities.wis.mod)"]]);
          assert.deepEqual(abilityDef(fake("F", "Creatures within 30 feet must make a Will save or be shaken for 1 minute."), "will").effect.conditions, [["shaken", "(1) * 10"]]);
        });

        it("what it can't read: a condition with no duration is a reminder; no condition at all is unread", () => {
          assert.deepEqual(abilityDef(fake("G", "Creatures in the cloud must succeed at a Fortitude save or be nauseated as long as they remain inside."), "fort").reminder, ["nauseated"]);
          assert.isTrue(abilityDef(fake("H", "The target takes 3d6 fire damage (Reflex half)."), "ref").unread);
        });

        it("a sentence about another save type (a list of several items) isn't this action's", () => {
          const text = "Bang Grenade: staggers creatures for 1 round (DC 15 Fortitude save negates). Flash Grenade: blinds creatures for 1d4 rounds (DC 15 Fortitude save negates).";
          assert.deepEqual(abilityDef(fake("Grenade (bang grenade)", text), "fort").effect.conditions, [["staggered", "1"]]);
          assert.isTrue(abilityDef(fake("Grenade (frag)", text), "ref").unread);
        });
      });

      describe("Ability save rows", function () {
        this.timeout(45000);
        let user, goblin, userToken, goblinToken, sceneCtl, messagesBefore, uniform;
        const row = (card, actor) => card.getFlag(MODULE_ID, FLAG)?.rows?.find((r) => r.name === actor.name);
        const dice = (u) => (CONFIG.Dice.randomUniform = () => u);
        const ability = (name, actionType, text, extra = {}) => ({
          name,
          type: "feat",
          system: { subType: "misc", description: { value: `<p>${text}</p>` }, actions: [{ _id: foundry.utils.randomID(16), name: "Use", actionType, save: { type: "fort", dc: "15", description: "Fortitude negates" }, ...extra }] },
        });
        async function use(item) {
          setTargets([goblinToken]);
          const before = new Set(game.messages.keys());
          await item.use({ skipDialog: true });
          const card = await waitFor(() => game.messages.contents.find((m) => !before.has(m.id) && m.type === "action"));
          await waitFor(() => !card.getFlag(MODULE_ID, FLAG) || card.getFlag(MODULE_ID, FLAG).resolved, { what: "the rows" });
          return card;
        }
        async function save(card) {
          await goblin.rollSavingThrow("fort", { skipDialog: true, dc: 15, reference: card.uuid });
          await waitFor(() => row(card, goblin)?.state === "done", { what: "the save" });
          await settled();
        }

        before(async () => {
          messagesBefore = new Set(game.messages.keys());
          uniform = CONFIG.Dice.randomUniform;
          sceneCtl = await useTestScene();
          user = await createTestActor("Quench Ability User", { items: [["pf1.classes", "Fighter", { system: { level: 5 } }]] });
          goblin = await createTestActor("Quench Ability Goblin", { items: [["pf1.races", "Human"], ["pf1.classes", "Warrior", { system: { level: 1 } }]] });
          await user.createEmbeddedDocuments("Item", [
            ability("Quench Paralyzing Gaze", "save", "The target must succeed at a Fortitude save or be paralyzed for 1d4 rounds."),
            ability("Quench Odd Power", "save", "Something strange happens to the target."),
            ability("Quench Venom Spit", "rwak", "If you hit, the target must make a successful Fortitude save or be blinded for 1d6 rounds.", { range: { units: "ft", value: "30" }, attackBonus: "" }),
          ]);
          userToken = await placeToken(user, 2, 2);
          goblinToken = await placeToken(goblin, 3, 2, { disposition: CONST.TOKEN_DISPOSITIONS.HOSTILE });
        });
        afterEach(async () => {
          CONFIG.Dice.randomUniform = uniform;
          await settled();
          const effects = goblin.effects.map((e) => e.id);
          if (effects.length) await goblin.deleteEmbeddedDocuments("ActiveEffect", effects);
        });
        after(async () => {
          CONFIG.Dice.randomUniform = uniform;
          await deleteTokens([userToken, goblinToken]);
          await cleanup([user, goblin], messagesBefore);
          await sceneCtl?.restore();
        });

        it("a failed save applies the condition read from the text, with its duration", async () => {
          const card = await use(user.items.getName("Quench Paralyzing Gaze"));
          assert.isTrue(card.getFlag(MODULE_ID, FLAG).ability);
          assert.equal(row(card, goblin).state, "save");
          dice(0.99); // a natural 1
          await save(card);
          assert.isTrue(goblin.statuses.has("paralyzed"));
          assert.match(row(card, goblin).applied.join(), /paralyzed \d round/);
        });

        it("an effect it can't read: the save still rolls, and the row says to apply it by hand", async () => {
          const card = await use(user.items.getName("Quench Odd Power"));
          dice(0.99);
          await save(card);
          assert.include(row(card, goblin).applied.join(), "apply its effect by hand");
        });

        it("delivered by an attack: a miss means no save", async () => {
          dice(0.99); // the attack rolls a natural 1
          const card = await use(user.items.getName("Quench Venom Spit"));
          assert.equal(row(card, goblin).state, "missed");
          dice(0.01); // a natural 20
          const hit = await use(user.items.getName("Quench Venom Spit"));
          assert.equal(row(hit, goblin).state, "save");
        });
      });
    },
    { displayName: "PF1e Revamp: Saves against abilities" }
  );
}
