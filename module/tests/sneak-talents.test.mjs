// Sneak attack talents (phase 2): the "With:" dropdown, dice changes, card riders and their effects,
// bleed, and Hunter's Surprise.

import { createTestActor, addItems, cleanup, useTestScene, placeToken, setTargets, deleteTokens, waitFor } from "./helpers.mjs";
import { _test as effects } from "../roll-effects.mjs";
import { _test as talents, applyRider } from "../sneak-talents.mjs";
import { _test as sneak } from "../sneak-attack.mjs";
import { setBleed, bleedOf, stopBleed } from "../bleed.mjs";

const MODULE_ID = "pf1e-revamp";

export function registerSneakTalentTests(quench) {
  quench.registerBatch(
    "pf1e-revamp.sneak-talents",
    (context) => {
      const { describe, it, assert, before, after, afterEach } = context;

      describe("Sneak attack talents", function () {
        this.timeout(45000);
        let rogue, goblin, rogueToken, goblinToken, sceneCtl, messagesBefore;

        const entry = (choice) => {
          const action = rogue.items.getName("Shortsword").defaultAction;
          const model = effects.buildModel(rogue, { kind: "attack", action, flags: {} });
          const state = effects.newState(model);
          if (choice) state.choices.set("sneak-attack", choice);
          return { model, state, plan: effects.planFor(model, state), sa: effects.planFor(model, state).provided.find((p) => p.id === "sneak-attack") };
        };
        const attack = async (rider) => {
          if (rider) await rogue.setFlag(MODULE_ID, talents.LAST, rider);
          else await rogue.unsetFlag(MODULE_ID, talents.LAST);
          const before = new Set(game.messages.keys());
          await rogue.items.getName("Shortsword").use({ skipDialog: true });
          return waitFor(() => game.messages.contents.find((m) => !before.has(m.id) && m.type === "action"));
        };
        const fullHp = () => goblin.update({ "system.attributes.hp.value": goblin.system.attributes.hp.max });

        before(async () => {
          messagesBefore = new Set(game.messages.keys());
          sceneCtl = await useTestScene();
          rogue = await createTestActor("Quench Rider Rogue", {
            abilities: { int: 14 },
            items: [["pf1.classes", "Rogue", { system: { level: 6 } }], ["pf1.weapons-and-ammo", "Shortsword"], ["pf1.class-abilities", "Bleeding Attack"], ["pf1.class-abilities", "Powerful Sneak"], ["pf1.class-abilities", "Knock-Out Blow"], ["pf1.class-abilities", "Armor Piercer"], ["pf1.class-abilities", "Offensive Defense"], ["pf1.class-abilities", "Crippling Strike"], ["pf1.class-abilities", "Shadow's Chill"]],
          });
          goblin = await createTestActor("Quench Rider Goblin", { abilities: { con: 30 }, items: [["pf1.classes", "Fighter", { system: { level: 3 } }]] });
          await waitFor(() => rogue.itemTypes.feat.some((f) => /^sneakAttack/.test(f.system.tag ?? "")));
          rogueToken = await placeToken(rogue, 2, 2);
          goblinToken = await placeToken(goblin, 3, 2, { disposition: CONST.TOKEN_DISPOSITIONS.HOSTILE });
          setTargets([goblinToken]);
          await goblin.setCondition("flatFooted", true);
        });
        afterEach(async () => {
          await stopBleed(goblin);
          setTargets([goblinToken]);
          if (!goblin.statuses.has("flatFooted")) await goblin.setCondition("flatFooted", true);
        });
        after(async () => {
          await deleteTokens([rogueToken, goblinToken]);
          await cleanup([rogue, goblin], messagesBefore);
          await sceneCtl?.restore();
        });

        it("the dropdown lists the character's talents, grouped, with DCs from class level and Int", () => {
          const { sa } = entry("knockOut");
          const options = sa.choice.options.map((o) => o.id);
          assert.includeMembers(options, ["none", "bleeding", "powerful", "knockOut", "armorPiercer:1", "armorPiercer:3", "offensiveDefense", "crippling", "shadowsChill"]);
          assert.notInclude(options, "slowReactions");
          assert.equal(sa.choice.options.find((o) => o.id === "knockOut").group, "Instead of the dice");
          assert.equal(sa.rider.dc, 10 + 3 + 2, "10 + half rogue level 6 + Int 14");
        });

        it("dice changes: Powerful Sneak, Armor Piercer, Knock-Out Blow, Shadow's Chill", async () => {
          const powerful = entry("powerful").sa;
          assert.equal(powerful.dice.dmg, "3d6min2");
          assert.equal(powerful.atk, -2);
          assert.equal(entry("armorPiercer:2").sa.dice.dmg, "1d6", "two dice given up");
          assert.isNull(entry("knockOut").sa.dice, "no dice instead");
          const action = rogue.items.getName("Shortsword").defaultAction;
          const data = action.getRollData();
          data.pf1eRevampRollEffects = entry("shadowsChill").plan;
          const rolls = await action.rollDamage({ data });
          const formulas = rolls.map((r) => r.formula).join(" + ");
          assert.match(formulas, /\(3d6 - 3\)\[Sneak Attack\]/);
          const cold = rolls.find((r) => /Shadow's Chill/.test(r.formula));
          assert.includeMembers([...cold.options.damageType], ["cold", "precision"]);
        });

        it("the card: the last-used rider, its line per attack, and Apply sets bleed", async () => {
          const card = await attack("bleeding");
          const data = card.getFlag(MODULE_ID, talents.FLAG);
          assert.equal(data.riders[0].id, "bleeding");
          assert.equal(data.riders[0].text, "3 bleed");
          assert.equal(rogue.getFlag(MODULE_ID, talents.LAST), "bleeding", "remembered for next time");
          const result = await applyRider(card, 0, 0);
          assert.match(result, /bleeds 3/);
          assert.equal(bleedOf(goblin)?.amount, 3);
          assert.isTrue(goblin.statuses.has("bleed"));
          assert.isNull(await applyRider(card, 0, 0), "once per attack");
        });

        it("bleed: a lower one doesn't replace a higher one; start of turn damage; healing stops it", async () => {
          await setBleed(goblin, 3, "test");
          assert.match(await setBleed(goblin, 2, "test"), /doesn't stack/);
          assert.equal(bleedOf(goblin).amount, 3);
          await setBleed(goblin, 5, "test");
          assert.equal(bleedOf(goblin).amount, 5);
          await fullHp();
          const combat = await Combat.create({ scene: canvas.scene.id, active: true, flags: { [MODULE_ID]: { quench: true } } });
          try {
            await combat.createEmbeddedDocuments("Combatant", [
              { tokenId: rogueToken.id, sceneId: canvas.scene.id, actorId: rogue.id, initiative: 20 },
              { tokenId: goblinToken.id, sceneId: canvas.scene.id, actorId: goblin.id, initiative: 10 },
            ]);
            await combat.startCombat();
            const start = goblin.system.attributes.hp.value;
            await combat.nextTurn(); // the goblin's turn starts
            await waitFor(() => goblin.system.attributes.hp.value === start - 5, { what: "bleed damage" });
          } finally {
            await combat.delete();
          }
          await goblin.applyDamage(-1, { forceDialog: false });
          await waitFor(() => !goblin.statuses.has("bleed") && !bleedOf(goblin), { what: "healing to stop the bleed" });
        });

        it("riders need sneak attack damage: none against a creature immune to precision damage", async () => {
          const card = await attack("crippling");
          await goblin.update({ "system.traits.di": ["precision"] });
          try {
            assert.match(await applyRider(card, 0, 0), /immune to precision damage/);
            assert.equal(goblin.system.abilities.str.damage ?? 0, 0);
          } finally {
            await goblin.update({ "system.traits.di": [] });
          }
          const card2 = await attack("crippling");
          await applyRider(card2, 0, 0);
          assert.equal(goblin.system.abilities.str.damage, 2);
          await goblin.update({ "system.abilities.str.damage": 0 });
        });

        it("Offensive Defense: a dodge bonus on the rogue for 1 round; a second hit refreshes it", async () => {
          const card = await attack("offensiveDefense");
          await applyRider(card, 0, 0);
          await applyRider(await attack("offensiveDefense"), 0, 0);
          const buffs = rogue.itemTypes.buff.filter((b) => b.name === "Offensive Defense");
          assert.lengthOf(buffs, 1, "doesn't stack with itself");
          assert.equal(buffs[0].system.changes[0].formula, "3");
          await buffs[0].delete();
        });

        it("Knock-Out Blow, picked in the attack window: the target's Fortitude save decides unconscious or staggered", async () => {
          await rogue.setFlag(MODULE_ID, talents.LAST, "knockOut");
          assert.equal(entry().sa.chosen, "none", "a once-a-day rider is never the default");
          const before = new Set(game.messages.keys());
          const windowsBefore = new Set(Object.keys(ui.windows));
          const using = rogue.items.getName("Shortsword").use({ skipDialog: false });
          const dialog = await waitFor(() => Object.entries(ui.windows).find(([id, w]) => !windowsBefore.has(id) && w.constructor.name === "AttackDialog" && w.rendered)?.[1], { what: "the attack window" });
          const select = await waitFor(() => dialog.element[0].querySelector('select[data-choice="sneak-attack"]'));
          select.value = "knockOut";
          select.dispatchEvent(new Event("change", { bubbles: true }));
          await waitFor(() => dialog.rollData.pf1eRevampRollEffects?.provided?.find((p) => p.id === "sneak-attack")?.chosen === "knockOut");
          [...dialog.element[0].querySelectorAll("button")].find((b) => b.textContent.trim() === game.i18n.localize("PF1.SingleAttack")).click();
          await using;
          const card = await waitFor(() => game.messages.contents.find((m) => !before.has(m.id) && m.type === "action"));
          assert.notMatch(card.systemRolls.attacks[0].damage.map((d) => d.formula).join(" + "), /Sneak Attack/, "no dice instead");
          const result = await applyRider(card, 0, 0);
          assert.match(result, /^(saved: staggered|failed: unconscious)/);
          assert.isTrue(goblin.statuses.has("staggered") || goblin.statuses.has("unconscious"));
          for (const id of ["staggered", "unconscious"]) if (goblin.statuses.has(id)) await goblin.setCondition(id, false);

        });

        it("Hunter's Surprise: sneak attack against the designated prey, flat-footed or not", async () => {
          await goblin.setCondition("flatFooted", false);
          assert.isFalse(entry().model.provided.find((p) => p.id === "sneak-attack").applies);
          const [talent] = await addItems(rogue, [["pf1.class-abilities", "Hunter's Surprise"]]);
          await sneak.designatePrey(talent);
          assert.isTrue(entry().model.provided.find((p) => p.id === "sneak-attack").applies);
          await rogue.deleteEmbeddedDocuments("Item", [...rogue.itemTypes.buff.filter((b) => b.getFlag(MODULE_ID, "hunterPrey")).map((b) => b.id), talent.id]);
        });
      });
    },
    { displayName: "PF1e Revamp: Sneak Attack Talents" }
  );
}
