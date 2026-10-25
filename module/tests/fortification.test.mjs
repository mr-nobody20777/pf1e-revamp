// Fortification and sneak attack phase 3: chances to negate critical hits and sneak attacks, the
// defender's one-off negations, and the feats/items/traits that change sneak attack.

import { createTestActor, addItems, cleanup, useTestScene, placeToken, setTargets, deleteTokens, waitFor } from "./helpers.mjs";
import { _test as effects } from "../roll-effects.mjs";
import { _test as fort } from "../fortification.mjs";
import { applyRider } from "../sneak-talents.mjs";

const MODULE_ID = "pf1e-revamp";

export function registerFortificationTests(quench) {
  quench.registerBatch(
    "pf1e-revamp.fortification",
    (context) => {
      const { describe, it, assert, before, after, afterEach } = context;

      describe("Fortification and sneak attack phase 3", function () {
        this.timeout(45000);
        let slayer, goblin, slayerToken, goblinToken, sceneCtl, messagesBefore;
        const made = [];
        const item = async (actor, data) => {
          const [doc] = await actor.createEmbeddedDocuments("Item", [data]);
          made.push(doc);
          return doc;
        };
        const armor = (name) => ({ type: "equipment", name, system: { subType: "armor", equipped: true } });
        const wondrous = (name) => ({ type: "equipment", name, system: { subType: "wondrous", equipped: true } });
        const buff = (name, level = 1) => ({ type: "buff", name, system: { subType: "spell", active: true, level } });
        const sneakEntry = () => effects.buildModel(slayer, { kind: "attack", action: slayer.items.getName("Longsword").defaultAction, flags: {} }).provided.find((p) => p.id === "sneak-attack");

        // Attack with the d100 and d20 fixed: the fortification roll comes first, then the attack roll
        async function attack(values) {
          const original = CONFIG.Dice.randomUniform;
          let call = 0;
          CONFIG.Dice.randomUniform = () => values[Math.min(call++, values.length - 1)];
          const before = new Set(game.messages.keys());
          try {
            await slayer.items.getName("Longsword").use({ skipDialog: true });
          } finally {
            CONFIG.Dice.randomUniform = original;
          }
          return waitFor(() => game.messages.contents.find((m) => !before.has(m.id) && m.type === "action"));
        }
        const damage = (card) => card.systemRolls.attacks[0].damage.map((d) => d.formula).join(" + ");

        before(async () => {
          messagesBefore = new Set(game.messages.keys());
          sceneCtl = await useTestScene();
          slayer = await createTestActor("Quench Fort Slayer", { abilities: { str: 16 }, items: [["pf1.classes", "Slayer", { system: { level: 6 } }], ["pf1.weapons-and-ammo", "Longsword"]] });
          goblin = await createTestActor("Quench Fort Goblin", { abilities: { con: 30 }, items: [["pf1.classes", "Fighter", { system: { level: 3 } }]] });
          await waitFor(() => slayer.items.getName("Sneak Attack (SLA)"));
          slayerToken = await placeToken(slayer, 2, 2);
          goblinToken = await placeToken(goblin, 3, 2, { disposition: CONST.TOKEN_DISPOSITIONS.HOSTILE });
          setTargets([goblinToken]);
          await goblin.setCondition("flatFooted", true);
        });
        afterEach(async () => {
          for (const doc of made.splice(0)) if (doc.parent?.items.has(doc.id)) await doc.delete();
          setTargets([goblinToken]);
        });
        after(async () => {
          await deleteTokens([slayerToken, goblinToken]);
          await cleanup([slayer, goblin], messagesBefore);
          await sceneCtl?.restore();
        });

        it("chances: armor, Secured Armor stacking, spells, the highest counts", async () => {
          assert.isNull(fort.fortificationOf(goblin));
          await item(goblin, armor("Chainmail of Moderate Fortification"));
          assert.equal(fort.fortificationOf(goblin).chance, 50);
          const [secured] = await addItems(goblin, [["pf-content.pf-feats", "Secured Armor"]]);
          made.push(secured);
          assert.equal(fort.fortificationOf(goblin).chance, 75, "stacks with moderate");
          await item(goblin, buff("Twisted Innards", 13));
          assert.equal(fort.fortificationOf(goblin).chance, 75, "doesn't stack: the highest");
        });

        it("negated: no sneak attack dice, and the card says so", async () => {
          await item(goblin, armor("Chainmail of Heavy Fortification"));
          const card = await attack([0.01, 0.5]); // fortification 1 (negated), attack 11
          assert.notMatch(damage(card), /Sneak Attack/);
          const data = card.getFlag(MODULE_ID, fort.FLAG);
          assert.isTrue(data.attacks[0].roll.negated);
          const text = (await card.renderHTML()).querySelector(".pf1e-revamp-fortification")?.textContent ?? "";
          assert.match(text, /75%: rolled 1 → sneak attack negated/);
        });

        it("negated: the sneak attack's flat bonuses go too (Blade of the Society)", async () => {
          await item(goblin, armor("Chainmail of Heavy Fortification"));
          const [blade] = await addItems(slayer, [["pf-content.pf-traits", "Blade of the Society (Rogue, Pathfinder Society)"]]);
          made.push(blade);
          const card = await attack([0.01, 0.5]);
          assert.notMatch(damage(card), /Sneak Attack/);
        });

        it("not negated: the dice stay", async () => {
          await item(goblin, armor("Chainmail of Light Fortification"));
          const card = await attack([0.99, 0.5]);
          assert.match(damage(card), /Sneak Attack/);
          assert.isFalse(card.getFlag(MODULE_ID, fort.FLAG).attacks[0].roll.negated);
        });

        it("a critical threat negated: the critical damage is 0", async () => {
          await item(goblin, armor("Chainmail of Heavy Fortification"));
          const card = await attack([0.01, 0.01]); // fortification 1; Foundry's dice count down from the top, so a natural 20
          const attack0 = card.systemRolls.attacks[0];
          assert.isTrue(card.getFlag(MODULE_ID, fort.FLAG).attacks[0].crit);
          assert.equal((attack0.critDamage ?? []).reduce((t, r) => t + r.total, 0), 0, "not even the Strength bonus PF1 adds after the hook");
        });

        it("talents are offered only where the sneak attack wasn't negated", async () => {
          await item(goblin, armor("Chainmail of Moderate Fortification"));
          const [bleeding] = await addItems(slayer, [["pf1.class-abilities", "Bleeding Attack"]]);
          made.push(bleeding);
          await slayer.setFlag(MODULE_ID, "lastSneakRider", "bleeding");
          // Full attack: the first attack's fortification roll is 1 (negated), everything after rolls high
          const card = await attack([0.01, 0.99]);
          const fortData = card.getFlag(MODULE_ID, fort.FLAG);
          assert.isTrue(fortData.attacks[0].roll.negated);
          assert.isFalse(fortData.attacks[1].roll.negated);
          const riders = card.getFlag(MODULE_ID, "sneakRiders");
          assert.notInclude(riders.attacks, 0, "no Bleeding Attack on the negated attack");
          assert.include(riders.attacks, 1);
          assert.match(await applyRider(card, 0, 0), /negated/, "and it can't be applied there");
          await slayer.unsetFlag(MODULE_ID, "lastSneakRider");
        });

        it("a talent keeps Sap Master's doubled dice", async () => {
          const [master, bleeding] = await addItems(slayer, [["pf-content.pf-feats", "Sap Master"], ["pf1.class-abilities", "Bleeding Attack"]]);
          made.push(master, bleeding);
          const [sap] = await addItems(slayer, [["pf1.weapons-and-ammo", "Sap"]]);
          made.push(sap);
          await sap.defaultAction.update({ nonlethal: true });
          const model = effects.buildModel(slayer, { kind: "attack", action: sap.defaultAction, flags: {} });
          const state = effects.newState(model);
          state.choices.set("sneak-attack", "bleeding");
          const planned = effects.planFor(model, state).provided.find((p) => p.id === "sneak-attack");
          assert.equal(planned.dice.dmg, "4d6", "2d6 doubled, with Bleeding Attack chosen");
        });

        it("Manyshot: the extra arrow gets no sneak attack, no fortification line and no talent", async () => {
          await item(goblin, armor("Chainmail of Light Fortification"));
          const extras = await addItems(slayer, [["pf1.weapons-and-ammo", "Shortbow"], ["pf1.feats", "Manyshot"], ["pf1.weapons-and-ammo", "Arrow", { system: { quantity: 20 } }], ["pf1.class-abilities", "Bleeding Attack"]]);
          made.push(...extras);
          await slayer.setFlag(MODULE_ID, "lastSneakRider", "bleeding");
          const before = new Set(game.messages.keys());
          const windowsBefore = new Set(Object.keys(ui.windows));
          const using = slayer.items.getName("Shortbow").use({ skipDialog: false });
          const dialog = await waitFor(() => Object.entries(ui.windows).find(([id, w]) => !windowsBefore.has(id) && w.constructor.name === "AttackDialog" && w.rendered)?.[1], { what: "the attack window" });
          const box = dialog.element[0].querySelector('input[name="manyshot"]');
          box.checked = true;
          box.dispatchEvent(new Event("change", { bubbles: true }));
          await waitFor(() => dialog.flags.manyshot && dialog._state === Application.RENDER_STATES.RENDERED);
          [...dialog.element[0].querySelectorAll("button")].find((b) => b.textContent.trim() === game.i18n.localize("PF1.FullAttack")).click();
          await using;
          const card = await waitFor(() => game.messages.contents.find((m) => !before.has(m.id) && m.type === "action"));
          await slayer.unsetFlag(MODULE_ID, "lastSneakRider");
          assert.notMatch(card.systemRolls.attacks[1].damage.map((d) => d.formula).join(" + "), /Sneak Attack/, "the Manyshot arrow");
          assert.notOk(card.getFlag(MODULE_ID, fort.FLAG)?.attacks?.[1]?.sneak, "fortification doesn't treat it as a sneak attack");
          assert.notInclude(card.getFlag(MODULE_ID, "sneakRiders").attacks, 1, "no talent on it");
        });

        it("Anatomical Savant lowers the chance by 25%", async () => {
          await item(goblin, armor("Chainmail of Light Fortification"));
          const [savant] = await addItems(slayer, [["pf-content.pf-feats", "Anatomical Savant"]]);
          made.push(savant);
          const card = await attack([0.01, 0.5]);
          assert.isNull(card.getFlag(MODULE_ID, fort.FLAG)?.attacks?.[0]?.roll ?? null, "25% − 25%: no roll");
          assert.match(damage(card), /Sneak Attack/);
        });

        it("Bracelet of Second Chances: the defender negates it; a bead is spent and the normal damage computed", async () => {
          const bracelet = await item(goblin, wondrous("Bracelet of Second Chances"));
          const card = await attack([0.5, 0.5]);
          const result = await fort.negate(card, "0", "bracelet");
          const rolls = card.systemRolls.attacks[0].damage;
          const normal = rolls.filter((r) => !/Sneak Attack/.test(r.formula)).reduce((t, r) => t + r.total, 0);
          assert.equal(result.amount, normal);
          assert.equal(bracelet.getFlag(MODULE_ID, "beads"), 6);
          assert.isNull(await fort.negate(card, "0", "bracelet"), "once per attack");
        });

        it("dice and bonuses: Accomplished Sneak Attacker (capped), traits, Headband of Ninjitsu, Sniper Goggles", async () => {
          const [accomplished, vessel, blade] = await addItems(slayer, [["pf-content.pf-feats", "Accomplished Sneak Attacker"], ["pf-content.pf-traits", "The Vessel Between (Daggermark)"], ["pf-content.pf-traits", "Blade of the Society (Rogue, Pathfinder Society)"]]);
          made.push(accomplished, vessel, blade);
          const e = sneakEntry();
          assert.equal(e.dice.dmg, "3d6", "slayer 6: 2d6 + 1d6, within the cap of 3");
          assert.equal(e.atk, 1);
          assert.equal(e.dmg, 1);
          await item(slayer, wondrous("Headband of Ninjitsu"));
          assert.equal(sneakEntry().atk, 3, "+2 insight");
          const [effect] = await goblin.createEmbeddedDocuments("ActiveEffect", [{ name: "Concealed", img: "icons/svg/mystery-man.svg", statuses: ["concealed"] }]);
          try {
            assert.isTrue(sneakEntry().applies, "the headband allows concealment");
          } finally {
            await effect.delete();
          }
        });

        it("critical hits: Sneaking Critical adds dice equal to the multiplier; Savage Critical adds sneak attack", async () => {
          const action = slayer.items.getName("Longsword").defaultAction;
          const critFormula = async () => (await action.rollDamage({ data: action.getRollData(), critical: true })).map((r) => r.formula).join(" + ");
          const [sneaking] = await addItems(slayer, [["pf-content.pf-feats", "Sneaking Critical"]]);
          made.push(sneaking);
          assert.match(await critFormula(), /2d6\[Sneaking Critical\]/, "longsword ×2");
          // PF1 rolls the critical damage critMult − 1 times: only the first gets the dice
          const second = action.getRollData();
          second.critCount = 2;
          assert.notMatch((await action.rollDamage({ data: second, critical: true })).map((r) => r.formula).join(" + "), /Sneaking Critical/);
          await sneaking.delete();
          await goblin.setCondition("flatFooted", false);
          try {
            const [savage] = await addItems(slayer, [["pf-content.pf-feats", "Savage Critical"]]);
            made.push(savage);
            assert.match(await critFormula(), /2d6\[Savage Critical\]/, "sneak attack didn't apply: added to the critical hit");
          } finally {
            await goblin.setCondition("flatFooted", true);
          }
        });

        it("Murderer's Blackcloth: +1 bleed; an obliviating weapon: DC 16 on the card", async () => {
          const [bleeding] = await addItems(slayer, [["pf1.class-abilities", "Bleeding Attack"]]);
          made.push(bleeding);
          await item(slayer, armor("Murderer's Blackcloth"));
          const model = effects.buildModel(slayer, { kind: "attack", action: slayer.items.getName("Longsword").defaultAction, flags: {} });
          const state = effects.newState(model);
          state.choices.set("sneak-attack", "bleeding");
          assert.equal(effects.planFor(model, state).provided.find((p) => p.id === "sneak-attack").rider.n, 3, "2 dice + 1");
          await bleeding.delete();
          const sword = slayer.items.getName("Longsword");
          await sword.update({ name: "Obliviating Longsword" });
          try {
            const before = new Set(game.messages.keys());
            await sword.use({ skipDialog: true });
            const card = await waitFor(() => game.messages.contents.find((m) => !before.has(m.id) && m.type === "action"));
            const riders = card.getFlag(MODULE_ID, "sneakRiders")?.riders ?? [];
            assert.deepInclude(riders.map((r) => [r.id, r.dc]), ["obliviating", 16]);
          } finally {
            await sword.update({ name: "Longsword" });
          }
        });

        it("concealment: Shadow Strike; Merciless Precision; Amulet of Uncanny Defense", async () => {
          const [effect] = await goblin.createEmbeddedDocuments("ActiveEffect", [{ name: "Concealed", img: "icons/svg/mystery-man.svg", statuses: ["concealed"] }]);
          try {
            assert.isFalse(sneakEntry().applies);
            const [strike] = await addItems(slayer, [["pf-content.pf-feats", "Shadow Strike"]]);
            made.push(strike);
            assert.isTrue(sneakEntry().applies);
          } finally {
            await effect.delete();
          }
          const [merciless] = await addItems(slayer, [["pf-content.pf-feats", "Merciless Precision"]]);
          made.push(merciless);
          assert.equal(sneakEntry().dice.dmg, "2d6");
          await goblin.setCondition("stunned", true);
          assert.equal(sneakEntry().dice.dmg, "3d6");
          await goblin.setCondition("stunned", false);
          // Uncanny Dodge with the amulet: a 3rd-level goblin can't be flanked by a 6th-level slayer
          await goblin.setCondition("flatFooted", false);
          const [ud] = await addItems(goblin, [["pf1.class-abilities", "Uncanny Dodge"]]);
          made.push(ud);
          const flank = () => effects.buildModel(slayer, { kind: "attack", action: slayer.items.getName("Longsword").defaultAction, flags: { flanking: true } }).provided.find((p) => p.id === "sneak-attack");
          assert.isTrue(flank().applies);
          await item(goblin, wondrous("Amulet of Uncanny Defense"));
          assert.isFalse(flank().applies);
          await goblin.setCondition("flatFooted", true);
        });
      });
    },
    { displayName: "PF1e Revamp: Fortification" }
  );
}
