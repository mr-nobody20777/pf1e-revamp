// Next-roll effects: Bit of Luck (every d20 rolled twice, keep the better), Guidance (+1 on the
// next attack, save or skill), Prescience (a stored d20 used on the roll it's armed for).

import { createTestActor, addItems, useAndCollect, formulas, waitFor, waitForItem, cleanup, useTestScene, placeToken, setTargets, deleteTokens } from "./helpers.mjs";

const MODULE_ID = "pf1e-revamp";
const save = (actor) => actor.rollSavingThrow("will", { skipDialog: true });

export function registerFortuneTests(quench) {
  quench.registerBatch(
    "pf1e-revamp.fortune",
    (context) => {
      const { describe, it, assert, before, after } = context;

      describe("Next-roll effects", function () {
        this.timeout(30000);
        let cleric, ally, clericToken, allyToken, sceneCtl, messagesBefore;

        before(async () => {
          messagesBefore = new Set(game.messages.keys());
          sceneCtl = await useTestScene();
          cleric = await createTestActor("Quench Luck Cleric", {
            items: [["pf1.classes", "Cleric", { system: { level: 1 } }], ["pf1.class-abilities", "Bit of Luck", { system: { uses: { value: 5 } } }]],
          });
          ally = await createTestActor("Quench Lucky Ally", {
            items: [["pf1.classes", "Fighter", { system: { level: 6 } }], ["pf1.weapons-and-ammo", "Longsword"]],
          });
          clericToken = await placeToken(cleric, 2, 2);
          allyToken = await placeToken(ally, 3, 2);
        });

        after(async () => {
          await deleteTokens([clericToken, allyToken]);
          await cleanup([cleric, ally], messagesBefore);
          await sceneCtl.restore();
        });

        describe("Bit of Luck", function () {
          it("using it on an ally gives them the Bit of Luck buff", async () => {
            setTargets([allyToken]);
            await useAndCollect(cleric.items.getName("Bit of Luck"));
            const buff = await waitForItem(ally, "Bit of Luck");
            assert.isTrue(buff.isActive);
            assert.equal(buff.getFlag(MODULE_ID, "fortune"), "best");
          });

          it("the ally's saves and every attack roll 2d20, keeping the better", async () => {
            const message = await save(ally);
            assert.match(message.rolls[0].formula, /^2d20kh/);
            const [card] = await useAndCollect(ally.items.getName("Longsword"));
            for (const f of formulas(card)) assert.match(f.attack, /^2d20kh/);
          });

          it("gone with the buff", async () => {
            await ally.items.getName("Bit of Luck").update({ "system.active": false });
            assert.match((await save(ally)).rolls[0].formula, /^1d20/);
          });
        });

        describe("Resistant Touch", function () {
          it("lends the Protection domain's +1 resistance to the ally for 1 minute; the cleric gets it back after", async () => {
            await addItems(cleric, [["pf1.class-abilities", "Protection Domain"], ["pf1.class-abilities", "Resistant Touch", { system: { uses: { value: 5 } } }]]);
            const clericWill = cleric.system.attributes.savingThrows.will.total;
            const allyWill = ally.system.attributes.savingThrows.will.total;
            setTargets([allyToken]);
            await useAndCollect(cleric.items.getName("Resistant Touch"));
            await waitForItem(ally, "Resistant Touch");
            await waitFor(() => cleric.items.getName("Protection Domain").system.disabled);
            assert.equal(ally.system.attributes.savingThrows.will.total, allyWill + 1);
            assert.equal(cleric.system.attributes.savingThrows.will.total, clericWill - 1);

            await cleric.items.getName("Resistant Touch (lent)").update({ "system.active": false });
            await waitFor(() => !cleric.items.getName("Protection Domain").system.disabled);
            assert.equal(cleric.system.attributes.savingThrows.will.total, clericWill);
          });
        });

        describe("Guidance", function () {
          it("+1 on the next save only, then the buff switches off", async () => {
            const [guide] = await addItems(ally, [["pf-content.pf-buffs", "Guidance", { system: { active: true } }]]);
            assert.match((await save(ally)).rolls[0].formula, /1\[Guidance\]/);
            await waitFor(() => !guide.isActive);
            assert.notMatch((await save(ally)).rolls[0].formula, /Guidance/);
          });

          it("the roll window has a ticked box: unticked, that roll goes without it and the bonus waits", async () => {
            const guide = ally.items.getName("Guidance");
            await guide.update({ "system.active": true });
            const rolling = ally.rollSavingThrow("will");
            const box = await waitFor(() => document.querySelector(".pf1e-revamp-next-roll input"), { what: "the one-roll checkbox" });
            assert.isTrue(box.checked, "ticked by default");
            box.checked = false;
            box.dispatchEvent(new Event("change"));
            box.closest(".application").querySelector('button[data-action="normal"]').click();
            const result = await rolling;
            assert.notMatch(result.rolls[0].formula, /Guidance/);
            assert.isTrue(guide.isActive, "kept for a later roll");
            assert.match((await save(ally)).rolls[0].formula, /1\[Guidance\]/, "a roll without a window uses it");
            await waitFor(() => !guide.isActive);
          });

          it("on a full attack, only the first attack", async () => {
            const guide = ally.items.getName("Guidance");
            await guide.update({ "system.active": true });
            const [card] = await useAndCollect(ally.items.getName("Longsword"));
            const f = formulas(card);
            assert.match(f[0].attack, /1\[Guidance\]/);
            assert.notMatch(f[1].attack, /Guidance/);
            await waitFor(() => !guide.isActive);
          });
        });

        describe("Prescience", function () {
          let wizard;
          before(async () => {
            wizard = await createTestActor("Quench Prescient Wizard", {
              abilities: { int: 16 },
              items: [["pf1.classes", "Wizard", { system: { level: 1 } }], ["pf1.class-abilities", "Prescience", { system: { uses: { value: 6 } } }]],
            });
          });
          after(async () => wizard?.delete());

          const stored = () => wizard.itemTypes.buff.find((b) => b.flags[MODULE_ID]?.prescience);

          it("using it spends a use and stores the d20 on a buff, not armed", async () => {
            const item = wizard.items.getName("Prescience");
            await item.use({ skipDialog: true });
            const buff = await waitFor(stored);
            assert.isFalse(buff.flags[MODULE_ID].prescience.armed);
            assert.equal(item.system.uses.value, 5);
          });

          it("not armed: rolls normally", async () => {
            const message = await save(wizard);
            assert.notMatch(message.rolls[0].formula, /Prescience/);
            assert.ok(stored(), "still stored");
          });

          it("armed: the next roll uses the stored result, then it's gone", async () => {
            const value = stored().flags[MODULE_ID].prescience.value;
            await stored().update({ [`flags.${MODULE_ID}.prescience.armed`]: true });
            const message = await save(wizard);
            assert.equal(message.rolls[0].d20.total, value);
            await waitFor(() => !stored());
          });

          it("in combat: offered at the start of the wizard's turn; an unused result is lost then", async () => {
            const wizardToken = await placeToken(wizard, 5, 5);
            const prescience = wizard.items.getName("Prescience");
            const offers = () => game.messages.contents.filter((m) => m.getFlag(MODULE_ID, "prescienceOffer") === prescience.uuid);
            await wizard.items.getName("Prescience").use({ skipDialog: true });
            await waitFor(stored);
            const combat = await Combat.create({ scene: canvas.scene.id, active: true, flags: { [MODULE_ID]: { quench: true } } });
            try {
              await combat.createEmbeddedDocuments("Combatant", [
                { tokenId: wizardToken.id, sceneId: canvas.scene.id, actorId: wizard.id, initiative: 20 },
                { tokenId: allyToken.id, sceneId: canvas.scene.id, actorId: ally.id, initiative: 10 },
              ]);
              await combat.startCombat();
              const [first] = await waitFor(() => (offers().length === 1 ? offers() : null));
              await waitFor(() => !stored(), {}).catch(() => assert.fail("the old result should be lost at the start of the turn"));
              await combat.nextTurn(); // ally
              await combat.nextTurn(); // wizard, round 2: a fresh offer replaces the old one
              await waitFor(() => offers().length === 1 && offers()[0].id !== first.id);
            } finally {
              await combat.delete();
              await deleteTokens([wizardToken]);
            }
          });
        });
      });
    },
    { displayName: "PF1e Revamp: Next-Roll Effects" }
  );
}
