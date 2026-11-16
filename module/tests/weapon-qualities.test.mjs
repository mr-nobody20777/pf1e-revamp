// Weapon qualities (phase 4a): read from the name or chosen on the weapon; energy dice on a hit, burst dice
// on a critical hit (once per multiplier step), aligned and bane dice against the right targets, keen's
// doubled threat range, merciful's nonlethal card, vicious's 1d6 to the wielder, aligned DR bypass.

import { createTestActor, cleanup, useTestScene, placeToken, deleteTokens, addItems, setTargets, useAndCollect, waitFor } from "./helpers.mjs";
import { _test } from "../weapon-qualities.mjs";

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
        const fake = (name, flag = null) => ({ type: "weapon", name, getFlag: () => flag });
        const ids = (name, flag) => [..._test.qualitiesOf(fake(name, flag)).ids].sort();
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
          assert.deepEqual(_test.qualitiesOf(fake("+1 Undead Bane Longsword")).bane, { types: ["undead"], subtypes: [] });
          assert.deepEqual(_test.qualitiesOf(fake("+1 Orc-Bane Greataxe")).bane, { types: [], subtypes: ["orc"] });
          assert.deepEqual(_test.qualitiesOf(fake("+1 Magical Beast Bane Spear")).bane, { types: ["magicalbeast"], subtypes: [] });
          assert.isNull(_test.qualitiesOf(fake("+1 Bane Longsword")).bane);
        });

        it("qualities chosen on the weapon win over the name", () => {
          assert.deepEqual(ids("+1 Flaming Longsword", { list: ["frost"] }), ["frost"]);
          assert.deepEqual(_test.qualitiesOf(fake("+1 Bane Longsword", { list: ["bane"], bane: { types: ["dragon"], subtypes: [] } })).bane, { types: ["dragon"], subtypes: [] });
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
          assert.isFalse(_test.keenWorks(club.defaultAction));
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

        it("the Qualities window saves a choice, warns about a humanoid bane without a subtype, and goes back to the name", async () => {
          const { chooseQualities } = await import("../weapon-qualities.mjs");
          const sword = await weapon("Longsword", "+1 Flaming Longsword");
          // A new window each time: a closed one stays in the page while it fades out
          const seen = new Set();
          const dialog = async () => {
            const d = await waitFor(() => [...document.querySelectorAll(".application.dialog")].find((x) => !seen.has(x) && /weapon qualities/.test(x.querySelector(".window-title")?.textContent ?? "")));
            seen.add(d);
            return d;
          };
          const tick = (d, id, on) => (d.querySelector(`input[name=q][value=${id}]`).checked = on);
          // Choose frost instead of flaming
          let done = chooseQualities(sword);
          let d = await dialog();
          tick(d, "flaming", false);
          tick(d, "frost", true);
          d.querySelector("button[data-action=save]").click();
          await done;
          assert.deepEqual(sword.getFlag(MODULE_ID, _test.FLAG).list, ["frost"]);
          assert.deepEqual([..._test.qualitiesOf(sword).ids], ["frost"]);
          // A humanoid bane needs a subtype: warned, and the window opens again
          done = chooseQualities(sword);
          d = await dialog();
          tick(d, "bane", true);
          d.querySelector("select[name=baneType]").value = "humanoid";
          d.querySelector("button[data-action=save]").click();
          const again = await dialog();
          assert.isTrue(again.querySelector("input[name=q][value=bane]").checked, "the reopened window keeps what was ticked");
          assert.equal(again.querySelector("select[name=baneType]").value, "humanoid");
          again.querySelector("select[name=baneSubtype]").value = "orc";
          again.querySelector("button[data-action=save]").click();
          await done;
          assert.deepEqual(sword.getFlag(MODULE_ID, _test.FLAG).bane, { types: ["humanoid"], subtypes: ["orc"] });
          // Back to the name
          done = chooseQualities(sword);
          d = await dialog();
          d.querySelector("button[data-action=name]").click();
          await done;
          assert.isUndefined(sword.getFlag(MODULE_ID, _test.FLAG));
          assert.deepEqual([..._test.qualitiesOf(sword).ids], ["flaming"]);
        });
      });
    },
    { displayName: "PF1e Revamp: weapon qualities" },
  );
}
