// Buffs on a roll: roll windows list the buffs, conditions and situational bonuses PF1 counts, and
// changes made there apply to that one roll (corrections to PF1's totals, labeled "Buffs: ...").

import { createTestActor, addItems, fromPack, cleanup, waitFor } from "./helpers.mjs";

const MODULE_ID = "pf1e-revamp";
const SETTING = "rollEffectsInline";

const buffs = (names) => names.map((n) => ["pf1.buffs", n, { system: { active: true, level: 10 } }]);

/** Start an attack with its window open; returns { dialog, done } where done() rolls a single attack. */
const managers = () => [...foundry.applications.instances.values()].filter((a) => a.constructor.name === "EffectsManager" && a.rendered);

async function openAttack(item) {
  await waitFor(() => !managers().length && !Object.values(ui.windows).some((w) => w.constructor.name === "AttackDialog"), { what: "the last roll's windows to close" });
  const before = new Set(game.messages.keys());
  const using = item.use({ skipDialog: false });
  const dialog = await waitFor(() => Object.values(ui.windows).find((w) => w.constructor.name === "AttackDialog" && w.action?.item === item), { what: "the attack window" });
  await waitFor(() => dialog.element?.[0]?.querySelector(`.${MODULE_ID}-effects`), { what: "the buffs line" });
  const done = async () => {
    [...dialog.element[0].querySelectorAll("button")].find((b) => b.textContent.trim() === game.i18n.localize("PF1.SingleAttack"))?.click();
    await using;
    const card = await waitFor(() => game.messages.contents.find((m) => !before.has(m.id) && m.type === "action"), { what: "the attack card" });
    const attack = card.systemRolls.attacks[0];
    return { attack: attack.attack.formula, damage: attack.damage.map((d) => d.formula).join(" + ") };
  };
  return { dialog, done };
}

const managerOf = () => waitFor(() => managers()[0], { what: "the buff manager" });

async function toggle(root, key) {
  const box = root.querySelector(`input[data-key="${key}"]`);
  box.checked = !box.checked;
  box.dispatchEvent(new Event("change"));
  await new Promise((r) => setTimeout(r, 100));
}

export function registerRollEffectsTests(quench) {
  quench.registerBatch(
    "pf1e-revamp.roll-effects",
    (context) => {
      const { describe, it, assert, before, after } = context;

      describe("Buffs on a roll", function () {
        this.timeout(30000);
        let messagesBefore, fighter, sword, threshold;
        const actors = [];
        const id = (name) => fighter.items.getName(name).id;

        before(async () => {
          messagesBefore = new Set(game.messages.keys());
          threshold = game.settings.get(MODULE_ID, SETTING);
          fighter = await createTestActor("Quench Buffed Fighter", {
            abilities: { str: 16 },
            items: [["pf1.classes", "Fighter", { system: { level: 10 } }], ["pf1.weapons-and-ammo", "Longsword"]],
          });
          actors.push(fighter);
          await addItems(fighter, buffs(["Heroism, Greater", "Heroism", "Bless", "Haste", "Bull's Strength", "Fighting Defensively"]));
          await fighter.setCondition("shaken", true);
          sword = fighter.items.getName("Longsword");
        });
        after(async () => {
          await game.settings.set(MODULE_ID, SETTING, threshold);
          await cleanup(actors, messagesBefore);
        });

        it("above the threshold: totals and Manage…; the manager groups rows and marks what doesn't stack", async () => {
          await game.settings.set(MODULE_ID, SETTING, 0);
          const { dialog, done } = await openAttack(sword);
          const line = dialog.element[0].querySelector(`.${MODULE_ID}-effects`).textContent;
          // Greater Heroism +4, Haste +1, Fighting Defensively -4, Shaken -2, Str +4 score (+2 attack and damage)
          assert.match(line, /Attack \+1 · Damage \+2/);
          dialog.element[0].querySelector("[data-action=manage]").click();
          const manager = await managerOf();
          const text = manager.element.textContent;
          assert.match(text, /Attack only/);
          assert.match(text, /Not Applied/);
          assert.match(text, /Heroism · Heroism, Greater is higher/);
          assert.isTrue(manager.element.querySelector(`input[data-key="${id("Heroism")}"]`).disabled, "locked while Greater Heroism is on");
          const { attack } = await done();
          assert.notMatch(attack, /Buffs/, "nothing changed, nothing added");
        });

        it("turning off the top bonus unlocks the next; ticked, it counts, and the roll gets one correction", async () => {
          const { dialog, done } = await openAttack(sword);
          dialog.element[0].querySelector("[data-action=manage]").click();
          const manager = await managerOf();
          await toggle(manager.element, id("Heroism, Greater"));
          assert.isFalse(manager.element.querySelector(`input[data-key="${id("Heroism")}"]`).disabled);
          assert.isFalse(manager.element.querySelector(`input[data-key="${id("Heroism")}"]`).checked, "doesn't move up on its own");
          await toggle(manager.element, id("Heroism"));
          assert.isTrue(manager.element.querySelector(`input[data-key="${id("Bless")}"]`).disabled, "Bless stays locked: Heroism now beats it");
          assert.match(manager.element.textContent, /Bless · Heroism is higher/);
          const { attack, damage } = await done();
          assert.match(attack, /-\s?2\[Buffs: Heroism, Greater off; Heroism on\]/);
          assert.notMatch(damage, /Buffs/, "neither affects damage");
        });

        it("an ability buff turned off moves attack and damage by the modifier", async () => {
          const { dialog, done } = await openAttack(sword);
          dialog.element[0].querySelector("[data-action=manage]").click();
          const manager = await managerOf();
          manager.element.querySelector("[data-action=expand]").click();
          await waitFor(() => manager.element.querySelector(`input[data-key="${id("Bull's Strength")}"]`));
          await toggle(manager.element, id("Bull's Strength"));
          const { attack, damage } = await done();
          assert.match(attack, /-\s?2\[Buffs: Bull's Strength off\]/);
          assert.match(damage, /-\s?2\[Buffs: Bull's Strength off\]/);
        });

        it("conditions: only the GM can turn them off", async () => {
          const { dialog, done } = await openAttack(sword);
          dialog.element[0].querySelector("[data-action=manage]").click();
          let manager = await managerOf();
          const shaken = `cond.shaken`;
          assert.isFalse(manager.element.querySelector(`input[data-key="${shaken}"]`).disabled, "the GM can");
          Object.defineProperty(game.user, "isGM", { get: () => false, configurable: true });
          try {
            await manager.render();
            manager = await managerOf();
            assert.isTrue(manager.element.querySelector(`input[data-key="${shaken}"]`).disabled, "a player can't");
          } finally {
            delete game.user.isGM;
          }
          await done();
        });

        it("at or under the threshold: chips in the window", async () => {
          await game.settings.set(MODULE_ID, SETTING, 20);
          const { dialog, done } = await openAttack(sword);
          const root = dialog.element[0];
          assert.isOk(root.querySelector(`.${MODULE_ID}-chips`));
          await toggle(root, id("Haste"));
          const { attack } = await done();
          assert.match(attack, /-\s?1\[Buffs: Haste off\]/);
        });

        it("saves: the window's Situational Bonus field carries the correction", async () => {
          await game.settings.set(MODULE_ID, SETTING, 20);
          const rolling = fighter.rollSavingThrow("will");
          const root = await waitFor(() => [...foundry.applications.instances.values()].find((a) => a.element?.querySelector?.(`.${MODULE_ID}-effects`))?.element, { what: "the save window" });
          await toggle(root, id("Heroism, Greater"));
          assert.match(root.querySelector('input[name="bonus"]').value, /-\s?4\[Buffs: Heroism, Greater off\]/);
          root.querySelector('button[data-action="normal"]').click();
          const result = await rolling;
          assert.match(result.rolls[0].formula, /-\s?4\[Buffs: Heroism, Greater off\]/);
        });

        /** Open a roll window, open its manager, and return the manager's text; the roll is cancelled. */
        async function managerText(actor, start) {
          await game.settings.set(MODULE_ID, SETTING, 0);
          const open = () => [...foundry.applications.instances.values()].filter((a) => a.rendered && (a.element?.querySelector?.(`.${MODULE_ID}-effects`) || a.constructor.name === "EffectsManager"));
          await waitFor(() => !open().length, { what: "the last roll's windows to close" });
          const rolling = start();
          const root = await waitFor(() => [...foundry.applications.instances.values()].find((a) => a.rendered && a.title?.startsWith(`${actor.name}:`) && a.element.querySelector(`.${MODULE_ID}-effects`))?.element, { what: "the roll window" });
          root.querySelector("[data-action=manage]").click();
          const text = (await managerOf()).element.textContent;
          root.querySelector('button[data-action="normal"]').click();
          await rolling;
          return text;
        }

        it("saves without the effect's card: wards and bonuses vs effects are listed as Not Applied, with the reason", async () => {
          const halfling = await createTestActor("Quench Warded Halfling", { items: [["pf1.classes", "Fighter", { system: { level: 1 } }]] });
          actors.push(halfling);
          await halfling.createEmbeddedDocuments("Item", [await fromPack("pf1.races", "Halfling")], { pf1eRevampNoPrompt: true });
          await halfling.createEmbeddedDocuments("Item", [{ name: "Quench Ward", type: "buff", system: { active: true }, flags: { [MODULE_ID]: { ward: { vs: "evil", saves: { type: "resist", value: 2 } } } } }]);
          const text = await managerText(halfling, () => halfling.rollSavingThrow("will"));
          assert.match(text, /Quench Ward · roll from the effect's card, or target its source/);
          assert.match(text, /only vs fear/i);
        });

        it("ability checks list the ability's buffs", async () => {
          const text = await managerText(fighter, () => fighter.rollAbilityTest("str"));
          assert.match(text, /Strength \+4\s*\+2/, "Bull's Strength's +4 Strength: +2 on the check");
        });
      });
    },
    { displayName: "PF1e Revamp: Buffs on a Roll" }
  );
}
