// On-hit riders, phase 3: burn (catching fire, the turn's damage, putting it out, and burning those who touch
// it), rend (counted hits, once a round), the grapple on later rounds (maintain, rake, swallow whole, letting
// go), blood drain, and riders linked without "plus" (the stirge's touch attack).

import { createTestActor, cleanup, useTestScene, placeToken, deleteTokens, setTargets, waitFor } from "./helpers.mjs";
import { _test as riders } from "../natural-riders.mjs";
import { _test as grapple } from "../monster-grapple.mjs";
import { _test as burning, burningOf, burningSave, setBurning } from "../burning.mjs";
import { settled } from "../util.mjs";

const MODULE_ID = "pf1e-revamp";
const HIGH = 0.001; // CONFIG.Dice.randomUniform: the highest roll
const LOW = 0.999; // the lowest (a natural 1)

export function registerMonsterGrappleTests(quench) {
  quench.registerBatch(
    "pf1e-revamp.monster-grapple",
    (context) => {
      const { describe, it, assert, before, after, afterEach } = context;

      describe("Burn, rend and the monster's grapple", function () {
        this.timeout(90000);
        let monster, victim, tokens, sceneCtl, messagesBefore;
        const originalRandom = CONFIG.Dice.randomUniform;
        const feat = (name) => ({ name, type: "feat", system: { subType: "misc" } });
        const natural = (name, notes = [], { attacks = 1, type = "mwak" } = {}) => ({
          name,
          type: "attack",
          system: {
            subType: "natural",
            effectNotes: notes,
            actions: [
              {
                _id: foundry.utils.randomID(),
                name: "Attack",
                actionType: type,
                activation: { type: "attack" },
                range: type === "rwak" ? { value: "60", units: "ft" } : {},
                damage: { parts: [{ formula: "1d6", types: ["slashing"] }] },
                ability: { attack: "str", damage: "str" },
                ...(attacks > 1 ? { extraAttacks: { type: "custom", manual: Array.from({ length: attacks - 1 }, () => ({ name: name, formula: "0" })) } } : {}),
              },
            ],
          },
        });
        const forced = async (value, fn) => {
          CONFIG.Dice.randomUniform = () => value;
          try {
            return await fn();
          } finally {
            CONFIG.Dice.randomUniform = originalRandom;
          }
        };
        /** Attack `target` with the item data: natural 20s for the attack, then the lowest rolls (saves fail) until the automatic riders are done. */
        const attack = async (data, target, { then = LOW } = {}) => {
          const [item] = await monster.createEmbeddedDocuments("Item", [data]);
          setTargets([target]);
          const before = new Set(game.messages.keys());
          CONFIG.Dice.randomUniform = () => HIGH;
          Hooks.once("pf1PreDisplayActionUse", () => (CONFIG.Dice.randomUniform = () => then));
          try {
            await item.use({ skipDialog: true });
            const card = await waitFor(() => game.messages.contents.find((m) => !before.has(m.id) && m.getFlag(MODULE_ID, riders.FLAG)));
            await settled();
            await new Promise((r) => setTimeout(r, 1500)); // the GM's automatic riders
            return { card: game.messages.get(card.id), item };
          } finally {
            CONFIG.Dice.randomUniform = originalRandom;
          }
        };
        const flagOf = (card) => card.getFlag(MODULE_ID, riders.FLAG);
        const entry = (card, key) => flagOf(card).applied?.[0]?.[flagOf(card).riders.findIndex((r) => r.key === key)];
        const riderIndex = (card, key) => flagOf(card).riders.findIndex((r) => r.key === key);
        const temp = (actor) => actor.system.attributes.hp.temp ?? 0;
        /** Grab the victim with `attackName` (succeeds) and return the card. */
        const grab = async (attackName = "Claw") => {
          const { card, item } = await attack(natural(attackName, ["plus grab"]), tokens.victim, { then: 0.5 });
          await forced(HIGH, () => riders.runRider(card, 0, riderIndex(card, "grab"), "maneuver"));
          await item.delete();
          return card;
        };

        before(async function () {
          if (!game.users.activeGM?.isSelf) this.skip();
          messagesBefore = new Set(game.messages.keys());
          sceneCtl = await useTestScene();
          monster = await createTestActor("Quench Grappling Monster", { abilities: { str: 18, con: 14 } });
          victim = await createTestActor("Quench Grapple Victim", { abilities: { con: 10, str: 1, dex: 1 }, system: { traits: { size: "sm" } } });
          tokens = { monster: await placeToken(monster, 2, 2, { disposition: -1 }), victim: await placeToken(victim, 3, 2) };
        });
        afterEach(async () => {
          CONFIG.Dice.randomUniform = originalRandom;
          for (const a of [monster, victim]) {
            const on = ["grappled", "prone", "burning"].filter((s) => a.statuses.has(s));
            if (on.length) await a.setConditions(Object.fromEntries(on.map((s) => [s, false])));
            await a.unsetFlag(MODULE_ID, grapple.FLAG);
            await a.unsetFlag(MODULE_ID, burning.FLAG);
            await a.unsetFlag(MODULE_ID, "rendHits");
            const effects = a.effects.filter((e) => e.getFlag(MODULE_ID, "swallowedBy"));
            if (effects.length) await a.deleteEmbeddedDocuments("ActiveEffect", effects.map((e) => e.id));
            const feats = a.items.filter((i) => i.type === "feat" || i.type === "attack");
            if (feats.length) await a.deleteEmbeddedDocuments("Item", feats.map((i) => i.id));
            await a.update({ "system.attributes.hp.temp": 0, "system.attributes.hp.value": a.system.attributes.hp.max, "system.abilities.con.damage": 0 });
          }
        });
        after(async () => {
          setTargets([]);
          await deleteTokens(Object.values(tokens ?? {}));
          await cleanup([monster, victim], messagesBefore);
          await sceneCtl?.restore();
        });

        it("reads a rider linked without \"plus\" (the stirge's touch) and burn's damage", () => {
          const read = (item, action) => [...riders.ridersOf(item, action).keys()];
          assert.sameMembers(read({ name: "Touch", system: { effectNotes: [], attackNotes: [] } }, { notes: { attack: ["@Use[Attach;as=auto]"] } }), ["attach"]);
          const burn = riders.ridersOf({ name: "Slam", system: { effectNotes: ["plus burn (1d6, DC 14)"] } }, null);
          assert.equal(riders.detailsOf(monster, "burn", burn.get("burn")).formula, "1d6");
          assert.equal(riders.detailsOf(monster, "burn", burn.get("burn")).dc, 14);
        });

        it("burn: fire damage, a failed Reflex save sets the target on fire; Undo puts it out and gives the hit points back", async () => {
          await victim.update({ "system.attributes.hp.temp": 50 });
          const { card } = await attack(natural("Slam", ["plus burn (2d6, DC 40)"]), tokens.victim);
          assert.match(entry(card, "burn").text, /fire damage; failed \(Reflex DC 40\): catches fire for \d round/);
          assert.isOk(burningOf(victim), "on fire");
          assert.isBelow(temp(victim), 50);
          await riders.runRider(card, 0, riderIndex(card, "burn"), "undo");
          assert.isNull(burningOf(victim));
          assert.equal(temp(victim), 50);
        });

        it("burn only on a melee hit", async () => {
          const { card } = await attack(natural("Spit", ["plus bleed (1)", "plus burn (2d6, DC 40)"], { type: "rwak" }), tokens.victim);
          assert.equal(riderIndex(card, "burn"), -1);
        });

        it("hitting a creature with burn with a natural weapon burns the attacker", async () => {
          await victim.createEmbeddedDocuments("Item", [feat("Burn (1d6, DC 40)")]);
          await monster.update({ "system.attributes.hp.temp": 50 });
          const { card } = await attack(natural("Bite"), tokens.victim);
          assert.match(entry(card, "burn").text, /catches fire/);
          assert.isOk(burningOf(monster), "the attacker is on fire");
          assert.isNull(burningOf(victim));
          await riders.runRider(card, 0, riderIndex(card, "burn"), "undo");
          assert.isNull(burningOf(monster));
          assert.equal(temp(monster), 50);
        });

        it("on fire: damage at the start of its turn in combat; a save puts it out, dropping and rolling leaves it prone", async () => {
          await victim.update({ "system.attributes.hp.temp": 50 });
          await setBurning(victim, { formula: "3", dc: 15, source: "test" });
          await victim.setFlag(MODULE_ID, burning.FLAG, { ...burningOf(victim), rounds: 3 });
          const combat = await Combat.create({ scene: canvas.scene.id, active: true, flags: { [MODULE_ID]: { quench: true } } });
          try {
            await combat.createEmbeddedDocuments("Combatant", [{ tokenId: tokens.victim.id, sceneId: canvas.scene.id, actorId: victim.id, initiative: 20 }]);
            await combat.startCombat();
            await waitFor(() => burningOf(victim)?.rounds === 2, { what: "the turn's fire damage" });
            assert.equal(temp(victim), 47);
          } finally {
            await combat.delete();
          }
          await forced(HIGH, () => burningSave(victim, { dropAndRoll: true }));
          assert.isNull(burningOf(victim), "put out");
          assert.isTrue(victim.statuses.has("prone"));
        });

        it("rend: two claw hits on one card offer it (outside combat); Undo gives the damage back", async () => {
          await monster.createEmbeddedDocuments("Item", [feat("Rend (2 claws, 1d8+9)")]);
          await victim.update({ "system.attributes.hp.temp": 100 });
          const { card } = await attack(natural("Claws", [], { attacks: 2 }), tokens.victim, { then: 0.5 });
          assert.equal(card.systemRolls.attacks.length, 2, "two claw attacks on the card");
          assert.isTrue(flagOf(card).rendReady);
          const done = await riders.runRider(card, -1, -1, "rend");
          assert.match(done.text, /tears .* for \d+ damage/);
          assert.isBelow(temp(victim), 100);
          assert.isNull(await riders.runRider(card, -1, -1, "rend"), "once");
          await riders.runRider(game.messages.get(card.id), -1, -1, "rendUndo");
          assert.equal(temp(victim), 100);
        });

        it("rend in combat: hits add up across the round's cards, offered once a round", async () => {
          await monster.createEmbeddedDocuments("Item", [feat("Rend (2 claws, 1d8+9)")]);
          await victim.update({ "system.attributes.hp.temp": 100 });
          const combat = await Combat.create({ scene: canvas.scene.id, active: true, flags: { [MODULE_ID]: { quench: true } } });
          try {
            await combat.createEmbeddedDocuments("Combatant", [{ tokenId: tokens.monster.id, sceneId: canvas.scene.id, actorId: monster.id, initiative: 20 }]);
            await combat.startCombat();
            const { card: first } = await attack(natural("Claw"), tokens.victim, { then: 0.5 });
            assert.isUndefined(flagOf(first).rendReady, "one hit isn't enough");
            const { card: second } = await attack(natural("Claw"), tokens.victim, { then: 0.5 });
            assert.isTrue(flagOf(second).rendReady, "the second claw completes it");
            await riders.runRider(second, -1, -1, "rend");
            const { card: third } = await attack(natural("Claws", [], { attacks: 2 }), tokens.victim, { then: 0.5 });
            assert.isUndefined(flagOf(third).rendReady, "no more than once per round");
          } finally {
            await combat.delete();
          }
        });

        it("the grapple's turn card: maintain deals the grab attack's damage; a failed check ends the grapple", async () => {
          await victim.update({ "system.attributes.hp.temp": 100 });
          await grab("Claw");
          assert.isOk(grapple.grappleOf(monster), "the grab is remembered");
          let card = await grapple.grappleTurn(monster);
          assert.sameMembers(card.getFlag(MODULE_ID, grapple.CARD).actions, ["maintain", "release"]);
          assert.match(await forced(HIGH, () => grapple.runGrappleAction(card, "maintain")), /holds .*; \d+ damage \(Claw\)/);
          assert.isBelow(temp(victim), 100);
          card = await grapple.grappleTurn(monster);
          assert.match(await forced(LOW, () => grapple.runGrappleAction(card, "maintain")), /fails, and the grapple ends/);
          assert.isFalse(victim.statuses.has("grappled"));
          assert.isFalse(monster.statuses.has("grappled"));
          assert.isNull(grapple.grappleOf(monster));
        });

        it("rake: its claw attacks against the creature it holds", async () => {
          await monster.createEmbeddedDocuments("Item", [feat("Rake (2 claws +8, 1d4+2)")]);
          await victim.update({ "system.attributes.hp.temp": 100 });
          await grab("Claw");
          const card = await grapple.grappleTurn(monster);
          assert.include(card.getFlag(MODULE_ID, grapple.CARD).actions, "rake");
          assert.equal(await forced(HIGH, () => grapple.runGrappleAction(card, "rake")), "rake: 28: hits for 6; 28: hits for 6");
          assert.equal(temp(victim), 88);
        });

        it("swallow whole: a bite's hold, then damage inside each turn until it's out", async () => {
          await monster.createEmbeddedDocuments("Item", [feat("Swallow Whole (5 acid damage, AC 15, 18 hp)")]);
          await victim.update({ "system.attributes.hp.temp": 100 });
          await grab("Bite");
          let card = await grapple.grappleTurn(monster);
          assert.include(card.getFlag(MODULE_ID, grapple.CARD).actions, "swallow");
          assert.match(await forced(HIGH, () => grapple.runGrappleAction(card, "swallow")), /swallows Quench Grapple Victim \(bite: \d+ damage\)/);
          assert.isTrue(victim.statuses.has("grappled"), "the swallowed creature stays grappled");
          assert.isFalse(monster.statuses.has("grappled"), "the swallower isn't");
          assert.isOk(victim.effects.find((e) => e.getFlag(MODULE_ID, "swallowedBy") === monster.uuid));
          const hp = temp(victim);
          card = await grapple.grappleTurn(monster);
          assert.equal(temp(victim), hp - 5, "5 acid damage inside");
          assert.deepEqual(card.getFlag(MODULE_ID, grapple.CARD).actions, ["free"]);
          await grapple.runGrappleAction(card, "free");
          assert.isFalse(victim.statuses.has("grappled"));
          assert.isUndefined(victim.effects.find((e) => e.getFlag(MODULE_ID, "swallowedBy")));
          assert.isNull(grapple.grappleOf(monster));
        });

        it("swallow whole needs a bite and a smaller creature", async () => {
          await monster.createEmbeddedDocuments("Item", [feat("Swallow Whole (5 acid damage, AC 15, 18 hp)")]);
          await grab("Claw");
          const card = await grapple.grappleTurn(monster);
          assert.notInclude(card.getFlag(MODULE_ID, grapple.CARD).actions, "swallow");
        });

        it("blood drain at the end of its turn while attached", async () => {
          await monster.createEmbeddedDocuments("Item", [feat("Blood Drain (2 Constitution)")]);
          const { card } = await attack(natural("Touch", ["plus attach"]), tokens.victim, { then: 0.5 });
          assert.match(entry(card, "attach").text, /attached/);
          assert.equal(await grapple.bloodDrain(monster), 2);
          assert.equal(victim.system.abilities.con.damage, 2);
        });
      });
    },
    { displayName: "PF1e Revamp: Burn, rend and the monster's grapple" }
  );
}
