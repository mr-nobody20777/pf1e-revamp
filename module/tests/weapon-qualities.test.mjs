// Weapon qualities (phase 4a): read from the name or chosen on the weapon; energy dice on a hit, burst dice
// on a critical hit (once per multiplier step), aligned and bane dice against the right targets, keen's
// doubled threat range, merciful's nonlethal card, vicious's 1d6 to the wielder, aligned DR bypass.

import { createTestActor, cleanup, useTestScene, placeToken, deleteTokens, addItems, setTargets, useAndCollect, waitFor } from "./helpers.mjs";
import { _test } from "../weapon-qualities.mjs";
import * as MA from "../magic-arms.mjs";

const MODULE_ID = "pf1e-revamp";

export function registerWeaponQualityTests(quench) {
  quench.registerBatch(
    "pf1e-revamp.weapon-qualities",
    (context) => {
      const { describe, it, assert, before, after, afterEach } = context;

      describe("Weapon qualities", function () {
        this.timeout(60000);
        let fighter, goblin, priest, skeleton, tokens, sceneCtl, messagesBefore;
        const originalRandom = CONFIG.Dice.randomUniform;
        const fake = (name, flag = null) => ({ type: "weapon", name, _source: { name }, system: {}, flags: { [MODULE_ID]: { magicArms: flag } } });
        const ids = (name, flag) => [...MA.qualitiesOf(fake(name, flag)).ids].sort();
        /** A weapon on the fighter, named for its qualities. */
        const weapon = async (base, name, extra = {}) => (await addItems(fighter, [["pf1.weapons-and-ammo", base, { name, system: { equipped: true }, ...extra }]]))[0];
        const damage = async (item, critical = false) => {
          const action = item.defaultAction;
          return (await action.rollDamage({ data: action.getRollData(), critical })).map((r) => ({ formula: r.formula, types: [...(r.options.damageType ?? [])] }));
        };
        const text = (rolls) => rolls.map((r) => r.formula).join(" + ");
        /** Attack `target` with every d20 a natural `n`. */
        const attackWith = async (item, target, n) => {
          setTargets(target ? [target] : []);
          CONFIG.Dice.randomUniform = () => (21 - n) / 20 - 0.001;
          try {
            const [card] = await useAndCollect(item);
            return card;
          } finally {
            CONFIG.Dice.randomUniform = originalRandom;
          }
        };

        before(async function () {
          if (!game.users.activeGM?.isSelf) this.skip();
          messagesBefore = new Set(game.messages.keys());
          sceneCtl = await useTestScene();
          fighter = await createTestActor("Quench WQ Fighter", { abilities: { str: 14 }, items: [["pf1.classes", "Fighter", { system: { level: 5 } }]] });
          goblin = await createTestActor("Quench WQ Neutral", { abilities: { con: 10 }, system: { details: { alignment: "tn" } } });
          priest = await createTestActor("Quench WQ Evil", { system: { details: { alignment: "ne" } } });
          skeleton = await createTestActor("Quench WQ Undead", { items: [["pf1.racial-hd", "Undead", { system: { level: 1 } }]], system: { details: { alignment: "ne" } } });
          tokens = {
            fighter: await placeToken(fighter, 2, 2),
            goblin: await placeToken(goblin, 3, 2, { disposition: -1 }),
            priest: await placeToken(priest, 3, 3, { disposition: -1 }),
            skeleton: await placeToken(skeleton, 2, 3, { disposition: -1 }),
          };
        });
        afterEach(async () => {
          CONFIG.Dice.randomUniform = originalRandom;
          setTargets([]);
          const weapons = fighter?.itemTypes.weapon.map((w) => w.id) ?? [];
          if (weapons.length) await fighter.deleteEmbeddedDocuments("Item", weapons);
          await fighter?.update({ "system.attributes.hp.value": fighter.system.attributes.hp.max });
        });
        after(async () => {
          setTargets([]);
          await deleteTokens(Object.values(tokens ?? {}));
          await cleanup([fighter, goblin, priest, skeleton], messagesBefore);
          await sceneCtl?.restore();
        });

        it("reads qualities from the name; a burst brings its base quality; unholy isn't holy", () => {
          assert.deepEqual(ids("+1 Flaming Burst Longsword"), ["flaming", "flamingBurst"]);
          assert.deepEqual(ids("+1 Shocking Burst Rapier"), ["shock", "shockingBurst"]);
          assert.deepEqual(ids("+2 Unholy Keen Scimitar"), ["keen", "unholy"]);
          assert.deepEqual(ids("Frost Brand"), ["frost"]);
          assert.deepEqual(ids("Longsword"), []);
        });

        it("reads a bane weapon's designated foe from the name", () => {
          assert.deepEqual(MA.qualitiesOf(fake("+1 Undead Bane Longsword")).bane, { types: ["undead"], subtypes: [] });
          assert.deepEqual(MA.qualitiesOf(fake("+1 Orc-Bane Greataxe")).bane, { types: [], subtypes: ["orc"] });
          assert.deepEqual(MA.qualitiesOf(fake("+1 Magical Beast Bane Spear")).bane, { types: ["magicalbeast"], subtypes: [] });
          assert.isNull(MA.qualitiesOf(fake("+1 Bane Longsword")).bane);
        });

        it("qualities chosen on the weapon win over the name", () => {
          assert.deepEqual(ids("+1 Flaming Longsword", { qualities: ["Frost"] }), ["frost"]);
          assert.deepEqual(MA.qualitiesOf(fake("+1 Bane Longsword", { qualities: ["Bane"], bane: { types: ["dragon"], subtypes: [] } })).bane, { types: ["dragon"], subtypes: [] });
        });

        it("flaming: +1d6 fire in normal damage, never multiplied on a critical hit", async () => {
          const sword = await weapon("Longsword", "+1 Flaming Longsword");
          const normal = await damage(sword);
          const fire = normal.find((r) => /1d6\[Flaming\]/.test(r.formula));
          assert.isOk(fire, text(normal));
          assert.deepEqual(fire.types, ["fire"]);
          assert.notMatch(text(await damage(sword, true)), /Flaming/);
        });

        it("flaming isn't added twice when the action already has 1d6 fire typed in", async () => {
          const sword = await weapon("Longsword", "+1 Flaming Longsword");
          await sword.defaultAction.update({ "damage.nonCritParts": [{ formula: "1d6", types: ["fire"] }] });
          assert.notMatch(text(await damage(sword)), /\[Flaming\]/);
        });

        it("flaming burst: 1d10 fire per multiplier step on a critical hit (2d10 with a ×3 battleaxe)", async () => {
          const axe = await weapon("Battle Axe", "+1 Flaming Burst Battle Axe");
          const card = await attackWith(axe, tokens.goblin, 20);
          const crit = card.systemRolls.attacks[0].critDamage ?? [];
          const bursts = crit.filter((r) => /Flaming Burst/.test(r.formula));
          assert.equal(bursts.length, 2, crit.map((r) => r.formula).join(" | "));
          assert.deepEqual([...bursts[0].options.damageType], ["fire"]);
          assert.notMatch((card.systemRolls.attacks[0].damage ?? []).map((r) => r.formula).join(" + "), /Flaming Burst/);
        });

        it("holy: +2d6 against an evil target only", async () => {
          const mace = await weapon("Heavy Mace", "+1 Holy Heavy Mace");
          setTargets([tokens.priest]);
          assert.match(text(await damage(mace)), /2d6\[Holy\]/);
          setTargets([tokens.goblin]);
          assert.notMatch(text(await damage(mace)), /Holy/);
        });

        it("holy weapons count as good against DR in PF1's damage math", async () => {
          const mace = await weapon("Heavy Mace", "+1 Holy Heavy Mace");
          const instance = Object.assign(new pf1.models.action.DamagePartModel({ formula: "0", types: ["bludgeoning"] }), { value: 10 });
          const app = new pf1.applications.ApplyDamage({ value: 10, instances: [instance], action: mace.defaultAction, targets: [priest] });
          assert.isTrue(app.materials.has("good"));
        });

        it("bane: +2 attack and damage and +2d6 against the designated foe only", async () => {
          const sword = await weapon("Longsword", "+1 Undead Bane Longsword");
          let card = await attackWith(sword, tokens.skeleton, 10);
          assert.match(card.systemRolls.attacks[0].attack.formula, /2\[Bane \(undead\)\]/);
          assert.match((card.systemRolls.attacks[0].damage ?? []).map((r) => r.formula).join(" + "), /2d6\[Bane \(undead\)\]/);
          card = await attackWith(sword, tokens.goblin, 10);
          assert.notMatch(card.systemRolls.attacks[0].attack.formula, /Bane/);
        });

        it("keen doubles a slashing weapon's threat range, and not a club's", async () => {
          const sword = await weapon("Longsword", "+1 Keen Longsword");
          let card = await attackWith(sword, tokens.goblin, 17);
          assert.isOk(card.systemRolls.attacks[0].critConfirm, "17 threatens with a keen longsword (17–20)");
          const club = await weapon("Club", "+1 Keen Club");
          assert.isFalse(MA.keenWorks(club.defaultAction));
          card = await attackWith(club, tokens.goblin, 19);
          assert.notOk(card.systemRolls.attacks[0].critConfirm, "a club stays 20 only");
        });

        it("keen doesn't stack with Roll Bonuses' Improved Critical (17–20, not 13–20)", async function () {
          if (!game.modules.get("ckl-roll-bonuses")?.active) this.skip();
          const sword = await weapon("Longsword", "+1 Keen Longsword");
          const [feat] = await addItems(fighter, [["pf1.feats", "Improved Critical"]]);
          try {
            if (sword.defaultAction.critRange !== 17) this.skip(); // Roll Bonuses didn't pick the feat up
            let card = await attackWith(sword, tokens.goblin, 17);
            assert.isOk(card.systemRolls.attacks[0].critConfirm);
            card = await attackWith(sword, tokens.goblin, 15);
            assert.notOk(card.systemRolls.attacks[0].critConfirm, "not doubled again");
          } finally {
            await feat.delete();
          }
        });

        it("merciful: +1d6 and the whole card's damage is nonlethal", async () => {
          const sword = await weapon("Longsword", "+1 Merciful Longsword");
          const card = await attackWith(sword, tokens.goblin, 10);
          assert.isTrue(!!card.system.config?.nonlethal);
          assert.match((card.systemRolls.attacks[0].damage ?? []).map((r) => r.formula).join(" + "), /1d6\[Merciful\]/);
        });

        it("vicious: +2d6, and the wielder takes 1d6 on a hit the module can see", async () => {
          const sword = await weapon("Longsword", "+1 Vicious Longsword");
          const before = fighter.system.attributes.hp.value;
          const card = await attackWith(sword, tokens.goblin, 20);
          assert.match((card.systemRolls.attacks[0].damage ?? []).map((r) => r.formula).join(" + "), /2d6\[Vicious\]/);
          const applied = await waitFor(() => card.getFlag(MODULE_ID, _test.FLAG)?.vicious?.applied?.[0], { what: "vicious damage" });
          assert.isAtLeast(applied.total, 1);
          assert.equal(fighter.system.attributes.hp.value, before - applied.total);
        });

        /* Applying damage, the card's buttons, the roll window model and the Qualities window */

        const cardRolls = (card) => card.systemRolls.attacks[0].damage ?? [];
        /** Click the card's normal Apply button with `token` selected; returns the hit points it took. */
        const applyFromCard = async (card, token, actor) => {
          const button = await waitFor(() => document.querySelector(`[data-message-id="${card.id}"] [data-action="applyDamage"][data-type="normal"]:not([data-ratio])`) ?? document.querySelector(`[data-message-id="${card.id}"] [data-action="applyDamage"]`));
          token.object.control({ releaseOthers: true });
          const hp = () => actor.system.attributes.hp;
          const start = { value: hp().value, nonlethal: hp().nonlethal ?? 0 };
          button.click();
          await waitFor(() => hp().value !== start.value || (hp().nonlethal ?? 0) !== start.nonlethal, { what: "damage applied" });
          canvas.tokens.releaseAll();
          return { lost: start.value - hp().value, nonlethal: (hp().nonlethal ?? 0) - start.nonlethal };
        };
        /** Plenty of hit points (PF1 derives the maximum, so a buff raises it): nonlethal damage above the maximum turns lethal. */
        const sturdy = async (actor) => {
          await actor.createEmbeddedDocuments("Item", [{ name: "Quench Sturdy", type: "buff", system: { active: true, changes: [{ formula: "200", target: "mhp", type: "untyped" }] } }]);
          await actor.update({ "system.attributes.hp.offset": 0 });
        };
        const unsturdy = (actor) => actor.deleteEmbeddedDocuments("Item", actor.itemTypes.buff.filter((b) => b.name === "Quench Sturdy").map((b) => b.id));
        const heal = (actor) => actor.update({ "system.attributes.hp.value": actor.system.attributes.hp.max, "system.attributes.hp.nonlethal": 0 });

        it("bursts by multiplier: one 1d10 at ×2 (longsword), three at ×4 (scythe)", async () => {
          const sword = await weapon("Longsword", "+1 Flaming Burst Longsword");
          let card = await attackWith(sword, tokens.goblin, 20);
          assert.equal((card.systemRolls.attacks[0].critDamage ?? []).filter((r) => /Flaming Burst/.test(r.formula)).length, 1);
          const scythe = await weapon("Scythe", "+1 Icy Burst Scythe");
          card = await attackWith(scythe, tokens.goblin, 20);
          const bursts = (card.systemRolls.attacks[0].critDamage ?? []).filter((r) => /Icy Burst/.test(r.formula));
          assert.equal(bursts.length, 3);
          assert.deepEqual([...bursts[0].options.damageType], ["cold"]);
        });

        it("holy with mixed targets: Not Applied with the reason, so it can be ticked by hand", async () => {
          const mace = await weapon("Heavy Mace", "+1 Holy Heavy Mace");
          setTargets([tokens.priest, tokens.goblin]);
          const RE = await import("../roll-effects.mjs");
          const model = RE._test.buildModel(fighter, { kind: "attack", action: mace.defaultAction, flags: {} });
          const holy = model.provided.find((p) => p.id === "wq-holy");
          assert.isFalse(holy.applies);
          assert.match(holy.reason, /only some targets are evil/);
          assert.notMatch(text(await damage(mace)), /Holy/);
        });

        it("energy dice apply to each arrow of Manyshot (not only the first, unlike precision damage)", async () => {
          const bow = await weapon("Longbow", "+1 Flaming Longbow");
          const action = bow.defaultAction;
          const data = action.getRollData();
          Object.assign(data, { attackCount: 1, "pf1e-revampAttackFlags": { manyshotAttacks: [1] } });
          const rolls = await action.rollDamage({ data });
          assert.match(rolls.map((r) => r.formula).join(" + "), /1d6\[Flaming\]/);
        });

        it("applied from the card, the flaming die is reduced by fire resistance (resist fire 5)", async () => {
          await goblin.update({ "system.traits.eres": { value: [{ amount: 5, operator: true, types: ["fire", ""] }], custom: "" } });
          try {
            const sword = await weapon("Longsword", "+1 Flaming Longsword");
            const card = await attackWith(sword, tokens.goblin, 10);
            const rolls = cardRolls(card);
            const fire = rolls.filter((r) => [...(r.options.damageType ?? [])].includes("fire")).reduce((t, r) => t + r.total, 0);
            const other = rolls.reduce((t, r) => t + r.total, 0) - fire;
            assert.isAbove(fire, 0, "the card has a fire part");
            const { lost } = await applyFromCard(card, tokens.goblin, goblin);
            assert.equal(lost, other + Math.max(0, fire - 5));
          } finally {
            await goblin.update({ "system.traits.eres": { value: [], custom: "" } });
            await heal(goblin);
          }
        });

        it("applied from the card, a holy weapon gets through DR 5/good and a plain one doesn't", async () => {
          await priest.update({ "system.traits.dr": { value: [{ amount: 5, operator: true, types: ["good", ""] }], custom: "" } });
          try {
            const holy = await weapon("Heavy Mace", "+1 Holy Heavy Mace");
            let card = await attackWith(holy, tokens.priest, 10);
            let total = cardRolls(card).reduce((t, r) => t + r.total, 0);
            assert.equal((await applyFromCard(card, tokens.priest, priest)).lost, total, "holy: no DR");
            await heal(priest);
            const plain = await weapon("Heavy Mace", "+1 Heavy Mace", { system: { equipped: true, enh: 1 } });
            card = await attackWith(plain, tokens.priest, 10);
            total = cardRolls(card).reduce((t, r) => t + r.total, 0);
            assert.equal((await applyFromCard(card, tokens.priest, priest)).lost, Math.max(0, total - 5), "plain: DR 5/good");
          } finally {
            await priest.update({ "system.traits.dr": { value: [], custom: "" } });
            await heal(priest);
          }
        });

        it("applied from the card, merciful damage is nonlethal", async () => {
          await sturdy(goblin);
          try {
            const sword = await weapon("Longsword", "+1 Merciful Longsword");
            const card = await attackWith(sword, tokens.goblin, 10);
            const total = cardRolls(card).reduce((t, r) => t + r.total, 0);
            const { lost, nonlethal } = await applyFromCard(card, tokens.goblin, goblin);
            assert.equal(lost, 0, "no lethal damage");
            assert.equal(nonlethal, total);
          } finally {
            await unsturdy(goblin);
            await heal(goblin);
          }
        });

        it("vicious without a target: the card's Apply deals the wielder 1d6, and Undo gives it back", async () => {
          const sword = await weapon("Longsword", "+1 Vicious Longsword");
          const start = fighter.system.attributes.hp.value;
          const card = await attackWith(sword, null, 10);
          const apply = await waitFor(() => [...document.querySelectorAll(`[data-message-id="${card.id}"] .${MODULE_ID}-vicious button`)].find((b) => b.textContent === "Apply"));
          apply.click();
          const applied = await waitFor(() => card.getFlag(MODULE_ID, _test.FLAG)?.vicious?.applied?.[0]);
          assert.equal(fighter.system.attributes.hp.value, start - applied.total);
          const undo = await waitFor(() => [...document.querySelectorAll(`[data-message-id="${card.id}"] .${MODULE_ID}-vicious button`)].find((b) => b.textContent === "Undo"));
          undo.click();
          await waitFor(() => card.getFlag(MODULE_ID, _test.FLAG)?.vicious?.applied?.[0]?.undone);
          assert.equal(fighter.system.attributes.hp.value, start);
        });

        /* Phase 4b: qualities that act on a hit */

        const RIDERS = "naturalRiders";
        /** Saves that always fail: −30 on every save while the test runs. */
        const doomed = async (actor) => (await actor.createEmbeddedDocuments("Item", [{ name: "Quench Doomed", type: "buff", system: { active: true, changes: [{ formula: "-30", target: "allSavingThrows", type: "untyped" }] } }]))[0];
        const riderText = (card, key, index = 0) => {
          const data = card.getFlag(MODULE_ID, RIDERS);
          const r = data?.riders?.findIndex((x) => x.key === key);
          return data?.applied?.[index]?.[r]?.text ?? null;
        };
        const waitRider = (card, key, index = 0) => waitFor(() => riderText(card, key, index), { what: `${key} rider`, timeout: 15000 });

        it("wounding: 1 bleed per hit, adding up; creatures immune to critical hits are immune", async () => {
          const sword = await weapon("Longsword", "+1 Wounding Longsword");
          try {
            let card = await attackWith(sword, tokens.goblin, 20);
            assert.match(await waitRider(card, "bleed"), /bleeds 1/);
            card = await attackWith(sword, tokens.goblin, 20);
            await waitRider(card, "bleed");
            assert.equal(goblin.getFlag(MODULE_ID, "bleed")?.amount, 2, "the second hit adds 1");
          } finally {
            await goblin.setCondition("bleed", false);
            await goblin.unsetFlag(MODULE_ID, "bleed");
          }
          const ooze = await createTestActor("Quench WQ Ooze", { items: [["pf1.racial-hd", "Ooze", { system: { level: 1 } }]] });
          const oozeToken = await placeToken(ooze, 1, 1, { disposition: -1 }); // within the fighter's reach
          try {
            const card = await attackWith(sword, oozeToken, 20);
            assert.match(await waitRider(card, "bleed"), /immune to critical hits/);
          } finally {
            await deleteTokens([oozeToken]);
            await ooze.delete();
          }
        });

        it("disruption: an undead hit fails its DC 14 Will save and is destroyed (Undo brings it back); a living target is unaffected", async () => {
          const mace = await weapon("Heavy Mace", "+1 Disruption Heavy Mace");
          const buff = await doomed(skeleton);
          try {
            // A natural 19 hits, and the forced dice leave the save a 19 − 30 (a natural 20 would always save)
            const saves = () => game.messages.contents.filter((m) => (m.speaker?.actor === skeleton.id || m.speaker?.alias === skeleton.name) && /Will Saving Throw/i.test(`${m.flavor ?? ""} ${m.content ?? ""} ${m.rolls?.[0]?.options?.flavor ?? ""}`)).length;
            const savesBefore = saves();
            const card = await attackWith(mace, tokens.skeleton, 19);
            assert.match(await waitRider(card, "disruption"), /failed \(Will DC 14\): destroyed/);
            await new Promise((r) => setTimeout(r, 800));
            assert.equal(saves() - savesBefore, 1, "a full attack's later hits don't make a destroyed undead save again");
            assert.isTrue(skeleton.statuses.has("dead"));
            const { runRider } = await import("../natural-riders.mjs");
            const r = card.getFlag(MODULE_ID, RIDERS).riders.findIndex((x) => x.key === "disruption");
            await runRider(card, 0, r, "undo");
            assert.isFalse(skeleton.statuses.has("dead"));
            const living = await attackWith(mace, tokens.goblin, 19);
            assert.match(await waitRider(living, "disruption"), /not undead/);
          } finally {
            await buff.delete();
            await skeleton.update({ "system.attributes.hp.value": skeleton.system.attributes.hp.max });
          }
        });

        it("thundering: a confirmed critical hit deafens on a failed DC 14 Fortitude save; a plain hit doesn't", async () => {
          const axe = await weapon("Longsword", "+1 Thundering Longsword"); // threatens on 19–20
          const buff = await doomed(goblin);
          try {
            let card = await attackWith(axe, tokens.goblin, 15); // hits, no threat
            await new Promise((r) => setTimeout(r, 800));
            assert.isNull(riderText(card, "deafen"), "only on a critical hit");
            assert.isFalse(goblin.statuses.has("deaf"));
            card = await attackWith(axe, tokens.goblin, 19); // a threat, confirmed by another 19; the save a 19 − 30
            assert.match(await waitRider(card, "deafen"), /deafened permanently/);
            assert.isTrue(goblin.statuses.has("deaf"));
          } finally {
            await buff.delete();
            if (goblin.statuses.has("deaf")) await goblin.setCondition("deaf", false);
          }
        });

        it("vorpal: a confirmed natural 20 tells the GM and offers Sever, which kills; nothing happens on its own", async () => {
          const sword = await weapon("Longsword", "+5 Vorpal Longsword");
          const before = new Set(game.messages.keys());
          try {
            const card = await attackWith(sword, tokens.goblin, 20);
            const whisper = await waitFor(() => game.messages.contents.find((m) => !before.has(m.id) && /Vorpal:/.test(m.content)), { what: "GM whisper" });
            assert.isOk(whisper.whisper.length);
            assert.isFalse(goblin.statuses.has("dead"), "not automatic");
            const sever = await waitFor(() => [...document.querySelectorAll(`[data-message-id="${card.id}"] .${MODULE_ID}-natural-riders button`)].find((b) => b.textContent === "Sever"));
            sever.click();
            await waitFor(() => goblin.statuses.has("dead"), { what: "severed" });
          } finally {
            if (goblin.statuses.has("dead")) await goblin.setCondition("dead", false);
            await goblin.update({ "system.attributes.hp.value": goblin.system.attributes.hp.max });
          }
        });

        it("brilliant energy: the target's armor and shield bonuses are added to the attack; no damage to undead", async () => {
          const sword = await weapon("Longsword", "+4 Brilliant Energy Longsword");
          await addItems(priest, [["pf1.armors-and-shields", "Full Plate", { system: { equipped: true } }]]);
          try {
            const { armorAndShield } = await import("../weapon-qualities.mjs");
            const through = armorAndShield(priest);
            assert.equal(through, 9, "full plate's +9");
            const card = await attackWith(sword, tokens.priest, 10);
            assert.match(card.systemRolls.attacks[0].attack.formula, /9\[Brilliant energy\]/);
            await skeleton.update({ "system.attributes.hp.value": 30 });
            const instance = Object.assign(new pf1.models.action.DamagePartModel({ formula: "0", types: ["slashing"] }), { value: 12 });
            await skeleton.applyDamage(12, { instances: [instance], action: sword.defaultAction });
            assert.equal(skeleton.system.attributes.hp.value, 30, "a brilliant energy weapon can't harm undead");
          } finally {
            await priest.deleteEmbeddedDocuments("Item", priest.itemTypes.equipment.map((e) => e.id));
            await skeleton.update({ "system.attributes.hp.value": skeleton.system.attributes.hp.max });
          }
        });

        it("seeking: a ranged attack ignores the target's miss chances; a plain bow doesn't", async () => {
          const { missChances } = await import("../miss-chance.mjs");
          const [blur] = await goblin.createEmbeddedDocuments("Item", [{ name: "Blur", type: "buff", system: { active: true } }]);
          try {
            const seeking = await weapon("Longbow", "+1 Seeking Longbow");
            const plain = await weapon("Longbow", "Longbow");
            assert.deepEqual(missChances(goblin, fighter, seeking, "rwak"), []);
            assert.isAbove(missChances(goblin, fighter, plain, "rwak").length, 0, "blur's 20%");
          } finally {
            await blur.delete();
          }
        });

        it("incorporeal: immune to a nonmagical weapon, half from a +1 weapon, full from ghost touch (minimum 1)", async () => {
          const ghost = await createTestActor("Quench WQ Ghost");
          await ghost.createEmbeddedDocuments("Item", [{ name: "Quench Sturdy", type: "buff", system: { active: true, changes: [{ formula: "200", target: "mhp", type: "untyped" }] } }]);
          await ghost.setCondition("incorporeal", true);
          await ghost.update({ "system.attributes.hp.value": ghost.system.attributes.hp.max });
          const hp = () => ghost.system.attributes.hp.value;
          const part = () => Object.assign(new pf1.models.action.DamagePartModel({ formula: "0", types: ["slashing"] }), { value: 10 });
          const hit = async (item, amount = 10) => {
            const start = hp();
            await ghost.applyDamage(amount, { instances: [part()], action: item.defaultAction, forceDialog: false });
            return start - hp();
          };
          try {
            assert.equal(await hit(await weapon("Longsword", "Longsword")), 0, "nonmagical");
            assert.equal(await hit(await weapon("Longsword", "Plus One", { system: { equipped: true, enh: 1 } })), 5, "magic: half");
            assert.equal(await hit(await weapon("Longsword", "+1 Ghost Touch Longsword", { system: { equipped: true, enh: 1 } })), 10, "ghost touch: full");
            assert.equal(await hit(await weapon("Longsword", "Plus One Again", { system: { equipped: true, enh: 1 } }), 1), 1, "half of 1 is still 1");
            // An incorporeal attacker deals full damage
            await fighter.setCondition("incorporeal", true);
            try {
              assert.equal(await hit(await weapon("Longsword", "Longsword")), 10, "incorporeal attacker");
            } finally {
              await fighter.setCondition("incorporeal", false);
            }
          } finally {
            await ghost.delete();
          }
        });

        it("incorporeal: spells deal half, force spells (magic missile) full", async () => {
          const { incorporealDamage } = await import("../resistance.mjs");
          const ghost = await createTestActor("Quench WQ Ghost 2");
          await ghost.setCondition("incorporeal", true);
          // Unowned copies: a fighter has no spellbook to hold them
          const spell = async (name) => new Item.implementation((await game.packs.get("pf1.spells").getDocuments({ name }))[0].toObject());
          const missile = await spell("Magic Missile");
          const hands = await spell("Burning Hands");
          try {
            assert.isNull(incorporealDamage(ghost, missile.defaultAction), "force: full damage");
            assert.equal(incorporealDamage(ghost, hands.defaultAction)?.ratio, 0.5);
            assert.isNull(incorporealDamage(goblin, hands.defaultAction), "a corporeal target: nothing changes");
          } finally {
            await ghost.delete();
          }
        });

        /* Phase 4c: speed, furious, defending */

        it("speed: one extra attack on a full attack (PF1's haste attack, so never two)", async () => {
          const plain = await weapon("Longsword", "Longsword");
          const fast = await weapon("Longsword", "+3 Speed Longsword", { system: { equipped: true, enh: 3 } });
          const count = async (item) => (await attackWith(item, tokens.goblin, 10)).systemRolls.attacks.length;
          const base = await count(plain);
          assert.equal(await count(fast), base + 1);
        });

        it("furious: +2 on attack and damage only while raging", async () => {
          const axe = await weapon("Battle Axe", "+1 Furious Battle Axe", { system: { equipped: true, enh: 1 } });
          let card = await attackWith(axe, tokens.goblin, 10);
          assert.notMatch(card.systemRolls.attacks[0].attack.formula, /Furious/);
          const [rage] = await fighter.createEmbeddedDocuments("Item", [{ name: "Rage", type: "buff", system: { active: true } }]);
          try {
            card = await attackWith(axe, tokens.goblin, 10);
            assert.match(card.systemRolls.attacks[0].attack.formula, /2\[Furious\]/);
            assert.match((card.systemRolls.attacks[0].damage ?? []).map((r) => r.formula).join(" + "), /2\[Furious\]/);
          } finally {
            await rage.delete();
          }
        });

        it("furious: with raging climber, the weapon's enhancement bonus on Climb even when not raging", async () => {
          await weapon("Battle Axe", "+1 Furious Battle Axe", { system: { equipped: true, enh: 1 } });
          const [power] = await fighter.createEmbeddedDocuments("Item", [{ name: "Raging Climber", type: "feat", system: { subType: "classFeat" } }]);
          try {
            const before = new Set(game.messages.keys());
            await fighter.rollSkill("clm", { skipDialog: true });
            const card = await waitFor(() => game.messages.contents.find((m) => !before.has(m.id) && m.rolls?.length));
            assert.match(card.rolls[0].formula, /1\[Furious weapon\]/);
          } finally {
            await power.delete();
          }
        });

        it("defending: at the start of the turn a whisper offers the choice; it carries over; attacks lose what's moved", async () => {
          const { setDefending, defendingAC } = await import("../weapon-qualities.mjs");
          const sword = await weapon("Longsword", "+2 Defending Longsword", { system: { equipped: true, enh: 2 } });
          const ac = () => fighter.system.attributes.ac.normal.total;
          const startAC = ac();
          const [combat] = await Combat.createDocuments([{ scene: canvas.scene.id, active: true }]);
          try {
            await combat.createEmbeddedDocuments("Combatant", [{ tokenId: tokens.fighter.id, sceneId: canvas.scene.id, actorId: fighter.id, initiative: 10 }]);
            const before = new Set(game.messages.keys());
            await combat.startCombat();
            const offer = await waitFor(() => game.messages.contents.find((m) => !before.has(m.id) && /Defending/.test(m.content)), { what: "the defending whisper" });
            assert.isOk(offer.whisper.length, "whispered");
            assert.equal(defendingAC(fighter, sword), 0, "nothing moved at first");
            const plus2 = await waitFor(() => document.querySelector(`[data-message-id="${offer.id}"] [data-wq-defend="2"]`));
            plus2.click();
            await waitFor(() => defendingAC(fighter, sword) === 2, { what: "the AC buff" });
            assert.equal(ac(), startAC + 2);
            const card = await attackWith(sword, tokens.goblin, 10);
            assert.match(card.systemRolls.attacks[0].attack.formula, /-\s*2\[Defending\]/);
            // Next turn: the choice carries over
            const before2 = new Set(game.messages.keys());
            await combat.nextRound();
            const again = await waitFor(() => game.messages.contents.find((m) => !before2.has(m.id) && /Defending/.test(m.content)));
            assert.match(again.content, /\+2 on AC, as last turn/);
            assert.equal(defendingAC(fighter, sword), 2);
            await setDefending(fighter, sword, 0);
            assert.equal(ac(), startAC);
          } finally {
            await combat.delete();
            await new Promise((r) => setTimeout(r, 500));
          }
          assert.isUndefined(fighter.itemTypes.buff.find((b) => b.flags?.[MODULE_ID]?.defendingAC), "the buff goes with the combat");
        });
      });
    },
    { displayName: "PF1e Revamp: weapon qualities" },
  );
}
