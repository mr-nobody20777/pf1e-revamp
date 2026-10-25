// Sneak attack (phase 1): dice from the class features, when they apply, and no multiplication on
// critical hits.

import { createTestActor, addItems, cleanup, useTestScene, placeToken, setTargets, deleteTokens, waitFor, waitForItem } from "./helpers.mjs";
import { _test as effects } from "../roll-effects.mjs";
import { _test as sneak } from "../sneak-attack.mjs";

const sneakEntry = (actor, flanking = false) => {
  const action = actor.items.getName("Longsword").defaultAction;
  return effects.buildModel(actor, { kind: "attack", action, flags: { flanking } }).provided.find((p) => p.id === "sneak-attack");
};
const FLAGS = "pf1e-revampAttackFlags";
// The attack window a use just opened (closed ones can linger in ui.windows)
const newAttackWindow = (before) => Object.entries(ui.windows).find(([id, w]) => !before.has(id) && w.constructor.name === "AttackDialog" && w.rendered)?.[1];

export function registerSneakAttackTests(quench) {
  quench.registerBatch(
    "pf1e-revamp.sneak-attack",
    (context) => {
      const { describe, it, assert, before, after, afterEach } = context;

      describe("Sneak attack", function () {
        this.timeout(45000);
        let slayer, goblin, slayerToken, goblinToken, sceneCtl, messagesBefore;
        const actors = [];

        before(async function () {
          messagesBefore = new Set(game.messages.keys());
          sceneCtl = await useTestScene();
          slayer = await createTestActor("Quench Sneak Slayer", { abilities: { str: 14 }, items: [["pf1.classes", "Slayer", { system: { level: 6 } }], ["pf1.weapons-and-ammo", "Longsword"], ["pf1.weapons-and-ammo", "Shortbow"]] });
          goblin = await createTestActor("Quench Sneak Goblin", { items: [["pf1.classes", "Fighter", { system: { level: 1 } }]] });
          actors.push(slayer, goblin);
          await waitForItem(slayer, "Sneak Attack (SLA)");
          slayerToken = await placeToken(slayer, 2, 2);
          goblinToken = await placeToken(goblin, 3, 2, { disposition: CONST.TOKEN_DISPOSITIONS.HOSTILE });
          setTargets([goblinToken]);
        });
        afterEach(async () => {
          for (const id of ["flatFooted", "invisible"]) {
            if (goblin.statuses.has(id)) await goblin.setCondition(id, false);
            if (slayer.statuses.has(id)) await slayer.setCondition(id, false);
          }
          setTargets([goblinToken]);
        });
        after(async () => {
          await deleteTokens([slayerToken, goblinToken]);
          await cleanup(actors, messagesBefore);
          await sceneCtl?.restore();
        });

        it("slayer 6: 2d6, from PF1's own formula on the feature; different die sizes stay apart", () => {
          const [src] = sneak.sources(slayer);
          assert.equal(src.dice, 2);
          assert.equal(sneakEntry(slayer).dice.dmg, "2d6");
          assert.equal(sneak.diceText([{ dice: 3, size: 6 }, { dice: 1, size: 8 }, { dice: 1, size: 6 }]), "4d6 + 1d8");
        });

        it("formulas without wrapping parentheses still count", async () => {
          const feature = slayer.items.getName("Sneak Attack (SLA)");
          const action = feature.defaultAction;
          const before = foundry.utils.deepClone(action._source.damage.parts);
          await action.update({ "damage.parts": [{ formula: "ceil(@class.level / 2)d6", types: [] }] });
          try {
            assert.equal(sneak.sources(slayer)[0]?.dice, 3);
          } finally {
            await feature.defaultAction.update({ "damage.parts": before });
          }
        });

        it("not flanked and not denied Dex: listed as not applying, with the reason", () => {
          const e = sneakEntry(slayer);
          assert.isFalse(e.applies);
          assert.match(e.reason, /isn't flanked or denied its Dexterity bonus/);
        });

        it("applies against a flat-footed target, and when flanking (melee only)", async () => {
          await goblin.setCondition("flatFooted", true);
          assert.isTrue(sneakEntry(slayer).applies);
          await goblin.setCondition("flatFooted", false);
          assert.isTrue(sneakEntry(slayer, true).applies, "the Flanking box");
        });

        it("Uncanny Dodge: not caught flat-footed; Improved Uncanny Dodge: flanked only with 4 more levels", async () => {
          const added = await addItems(goblin, [["pf1.class-abilities", "Uncanny Dodge"], ["pf1.class-abilities", "Improved Uncanny Dodge"]]);
          const fighter = goblin.itemTypes.class[0];
          try {
            await goblin.setCondition("flatFooted", true);
            assert.isFalse(sneakEntry(slayer).applies, "uncanny dodge");
            await goblin.setCondition("flatFooted", false);
            assert.isTrue(sneakEntry(slayer, true).applies, "slayer 6 flanks a 1st-level target");
            await fighter.update({ "system.level": 3 });
            const e = sneakEntry(slayer, true);
            assert.isFalse(e.applies, "but not a 3rd-level one");
            assert.match(e.reason, /Improved Uncanny Dodge/);
          } finally {
            await goblin.deleteEmbeddedDocuments("Item", added.map((i) => i.id));
            await fighter.update({ "system.level": 1 });
          }
        });

        it("ranged: only within 30 ft (+10 ft with Deadly Range)", async () => {
          await goblin.setCondition("flatFooted", true);
          await goblinToken.update({ x: slayerToken.x + 7 * canvas.grid.size }, { animate: false }); // 35 ft
          const bow = slayer.items.getName("Shortbow").defaultAction;
          const ranged = () => effects.buildModel(slayer, { kind: "attack", action: bow }).provided.find((p) => p.id === "sneak-attack");
          assert.match(ranged().reason, /beyond 30 ft/);
          const [range] = await addItems(slayer, [["pf1.class-abilities", "Deadly Range (SLA)"]]);
          assert.isTrue(ranged().applies, "40 ft with Deadly Range");
          await range.delete();
          await goblinToken.update({ x: slayerToken.x + canvas.grid.size }, { animate: false });
        });

        it("concealment blocks it; an invisible attacker makes the target lose its Dex bonus", async () => {
          await goblin.setCondition("flatFooted", true);
          // Added directly (not setCondition) so Nevela's Normal/Total picker doesn't open
          const [effect] = await goblin.createEmbeddedDocuments("ActiveEffect", [{ name: "Concealed", img: "icons/svg/mystery-man.svg", statuses: ["concealed"] }]);
          assert.match(sneakEntry(slayer).reason, /concealment/);
          await effect.delete();
          await goblin.setCondition("flatFooted", false);
          await slayer.setCondition("invisible", true);
          const e = sneakEntry(slayer);
          assert.isTrue(e.applies);
          assert.match(e.tooltip, /: the target can't see you/);
        });

        it("concealment counts even when a bigger miss chance (Blink) isn't concealment", async () => {
          await goblin.setCondition("flatFooted", true);
          const [blink] = await addItems(goblin, [["pf-content.pf-buffs", "Blink", { system: { active: true } }]]);
          const [effect] = await goblin.createEmbeddedDocuments("ActiveEffect", [{ name: "Concealed", img: "icons/svg/mystery-man.svg", statuses: ["concealed"] }]);
          try {
            assert.match(sneakEntry(slayer).reason ?? "", /concealment/);
          } finally {
            await effect.delete();
            await blink.delete();
          }
        });

        it("immune creatures (oozes, precision immunity): blocked, nobody can tick it", async () => {
          await goblin.setCondition("flatFooted", true);
          const [race] = await addItems(goblin, [["pf1.races", "Human"]]);
          await race.update({ "system.creatureTypes.base": ["ooze"] });
          try {
            const e = sneakEntry(slayer);
            assert.match(e.reason, /oozes/);
            assert.isTrue(e.blocked);
          } finally {
            await race.delete();
          }
          await goblin.update({ "system.traits.di": ["precision"] });
          try {
            const action = slayer.items.getName("Longsword").defaultAction;
            const model = effects.buildModel(slayer, { kind: "attack", action, flags: {} });
            const state = effects.newState(model, new Map([["sneak-attack", true]]));
            assert.isFalse(state.provided.get("sneak-attack"), "a tick doesn't override the block");
            const row = effects.rows(model, state).find((r) => r.key === "sneak-attack");
            assert.isTrue(row.disabled);
            assert.match(row.tooltip, /immune to precision damage/);
          } finally {
            await goblin.update({ "system.traits.di": [] });
          }
        });

        it("damage: its own part in normal damage, never in critical damage", async () => {
          await goblin.setCondition("flatFooted", true);
          const action = slayer.items.getName("Longsword").defaultAction;
          const formulas = async (critical) => (await action.rollDamage({ data: action.getRollData(), critical })).map((r) => r.formula).join(" + ");
          assert.match(await formulas(false), /2d6\[Sneak Attack\]/);
          assert.notMatch(await formulas(true), /Sneak Attack/, "not multiplied on a critical hit");
          const [, sneakRoll] = await action.rollDamage({ data: action.getRollData() });
          assert.includeMembers([...sneakRoll.options.damageType], ["slashing", "precision"], "typed precision as well as the weapon's type");
        });

        it("once per volley: not on Manyshot's extra arrow", async () => {
          await goblin.setCondition("flatFooted", true);
          const action = slayer.items.getName("Shortbow").defaultAction;
          const roll = async (attackCount) => {
            const data = action.getRollData();
            Object.assign(data, { attackCount, [FLAGS]: { manyshotAttacks: [1] } });
            return (await action.rollDamage({ data })).map((r) => r.formula).join(" + ");
          };
          assert.match(await roll(0), /Sneak Attack/);
          assert.notMatch(await roll(1), /Sneak Attack/);
        });

        it("without the attack window: flanking from PF1's action use", async () => {
          const before = new Set(game.messages.keys());
          await slayer.items.getName("Longsword").use({ skipDialog: true, options: { flanking: true } });
          const card = await waitFor(() => game.messages.contents.find((m) => !before.has(m.id) && m.type === "action"));
          assert.match(card.systemRolls.attacks[0].damage.map((d) => d.formula).join(" + "), /2d6\[Sneak Attack\]/);
        });

        it("ticking Flanking keeps the choices already made in the window", async () => {
          await goblin.setCondition("flatFooted", true);
          const windowsBefore = new Set(Object.keys(ui.windows));
          const using = slayer.items.getName("Longsword").use({ skipDialog: false });
          const dialog = await waitFor(() => newAttackWindow(windowsBefore), { what: "the attack window" });
          const root = () => dialog.element[0];
          const sneakBox = await waitFor(() => root().querySelector('.pf1e-revamp-effects input[data-key="sneak-attack"]'));
          assert.isTrue(sneakBox.checked);
          sneakBox.checked = false;
          sneakBox.dispatchEvent(new Event("change", { bubbles: true }));
          const flank = root().querySelector('input[name="flanking"]');
          flank.checked = true;
          flank.dispatchEvent(new Event("change", { bubbles: true }));
          await waitFor(() => dialog.flags.flanking && root().querySelector('.pf1e-revamp-effects input[data-key="sneak-attack"]'));
          assert.isFalse(root().querySelector('.pf1e-revamp-effects input[data-key="sneak-attack"]').checked, "still unticked");
          assert.isFalse(!!dialog.rollData.pf1eRevampRollEffects?.provided?.some?.((p) => p.id === "sneak-attack"));
          await waitFor(() => dialog._state === Application.RENDER_STATES.RENDERED); // not mid re-render
          await dialog.close();
          await using;
        });

        it("the attack window: ticking Flanking adds it, and the roll carries it", async () => {
          const before = new Set(game.messages.keys());
          const windowsBefore = new Set(Object.keys(ui.windows));
          const using = slayer.items.getName("Longsword").use({ skipDialog: false });
          const dialog = await waitFor(() => newAttackWindow(windowsBefore), { what: "the attack window" });
          const box = await waitFor(() => dialog.element[0].querySelector('input[name="flanking"]'));
          box.checked = true;
          box.dispatchEvent(new Event("change", { bubbles: true }));
          // Ticked (not merely listed under Not Applied) once the window has re-rendered
          await waitFor(() => dialog.flags.flanking && dialog.element[0].querySelector('.pf1e-revamp-effects input[data-key="sneak-attack"]')?.checked, { what: "sneak attack to be ticked" });
          [...dialog.element[0].querySelectorAll("button")].find((b) => b.textContent.trim() === game.i18n.localize("PF1.SingleAttack")).click();
          await using;
          const card = await waitFor(() => game.messages.contents.find((m) => !before.has(m.id) && m.type === "action"));
          assert.match(card.systemRolls.attacks[0].damage.map((d) => d.formula).join(" + "), /2d6\[Sneak Attack\]/);
        });
      });
    },
    { displayName: "PF1e Revamp: Sneak Attack" }
  );
}
