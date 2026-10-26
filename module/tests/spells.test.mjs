// Spells on the creatures they affect: the card's rows, spell resistance, saves rolled against the card,
// and the conditions, buffs and penalties applied.

import { createTestActor, addItems, cleanup, useTestScene, placeToken, setTargets, deleteTokens, waitFor } from "./helpers.mjs";
import { _test as spells } from "../spells.mjs";
import { settled } from "../util.mjs";
import { SPELLS } from "../spell-data.mjs";
import { _test as effects } from "../roll-effects.mjs";
import { nevelaAppliesBuff } from "../buff-grants.mjs";

const MODULE_ID = "pf1e-revamp";

export function registerSpellTests(quench) {
  quench.registerBatch(
    "pf1e-revamp.spells",
    (context) => {
      const { describe, it, assert, before, after, afterEach } = context;

      describe("Spells: effects on the creatures affected", function () {
        this.timeout(45000);
        let wizard, human, ogre, friend, zombie, wizardToken, humanToken, ogreToken, friendToken, zombieToken, sceneCtl, messagesBefore, uniform;
        const SPELL_NAMES = ["Daze", "Bless", "Bane", "Sleep", "Color Spray", "Cause Fear", "Ray of Enfeeblement", "Shield", "Flare", "Magic Missile", "Cure Light Wounds", "Chill Touch", "Hypnotism", "Hideous Laughter", "Touch of Fatigue", "Mudball", "Linebreaker", "Shadow Trap", "Doom"];
        const spell = (level) => ({ system: { spellbook: "primary", level, preparation: { value: 9, max: 9 } } });
        const rows = (card) => card.getFlag(MODULE_ID, spells.FLAG)?.rows ?? [];
        const row = (card, actor) => rows(card).find((r) => r.name === actor.name);
        /** Dice that roll their lowest (0.99) or highest (0.01): Foundry turns the random number around. */
        const dice = (u) => (CONFIG.Dice.randomUniform = () => u);

        async function cast(name, targets) {
          setTargets(targets);
          const before = new Set(game.messages.keys());
          Hooks.once("pf1CreateActionUse", (use) => (use.shared.useMeasureTemplate = false));
          await wizard.items.getName(name).use({ skipDialog: true });
          const card = await waitFor(() => game.messages.contents.find((m) => !before.has(m.id) && m.type === "action"));
          await waitFor(() => !card.getFlag(MODULE_ID, spells.FLAG) || card.getFlag(MODULE_ID, spells.FLAG).resolved, { what: "the rows" });
          return card;
        }
        async function save(card, actor) {
          const data = card.getFlag(MODULE_ID, spells.FLAG);
          await actor.rollSavingThrow(data.save.type, { skipDialog: true, dc: data.save.dc, reference: card.uuid });
          await waitFor(() => row(card, actor)?.state === "done", { what: `${actor.name}'s save` });
          await settled();
        }

        before(async () => {
          messagesBefore = new Set(game.messages.keys());
          uniform = CONFIG.Dice.randomUniform;
          sceneCtl = await useTestScene();
          wizard = await createTestActor("Quench Spell Wizard", { abilities: { int: 18 }, items: [["pf1.races", "Human"], ["pf1.classes", "Wizard", { system: { level: 5 } }]] });
          await addItems(wizard, SPELL_NAMES.map((n) => ["pf1.spells", n, spell(["Daze", "Touch of Fatigue"].includes(n) ? 0 : 1)]));
          human = await createTestActor("Quench Spell Human", { items: [["pf1.races", "Human"], ["pf1.classes", "Warrior", { system: { level: 1 } }]] });
          ogre = await createTestActor("Quench Spell Ogre", { items: [["pf1.races", "Human"], ["pf1.classes", "Warrior", { system: { level: 6 } }]] });
          friend = await createTestActor("Quench Spell Friend", { items: [["pf1.races", "Human"], ["pf1.classes", "Warrior", { system: { level: 1 } }]] });
          zombie = await createTestActor("Quench Spell Zombie", { items: [["pf1.classes", "Warrior", { system: { level: 1 } }]] });
          await zombie.createEmbeddedDocuments("Item", [{ name: "Zombie", type: "race", system: { creatureTypes: ["undead"] } }]);
          wizardToken = await placeToken(wizard, 1, 1);
          friendToken = await placeToken(friend, 2, 1);
          humanToken = await placeToken(human, 4, 1, { disposition: CONST.TOKEN_DISPOSITIONS.HOSTILE });
          ogreToken = await placeToken(ogre, 5, 1, { disposition: CONST.TOKEN_DISPOSITIONS.HOSTILE });
          zombieToken = await placeToken(zombie, 6, 1, { disposition: CONST.TOKEN_DISPOSITIONS.HOSTILE });
        });
        afterEach(async () => {
          CONFIG.Dice.randomUniform = uniform;
          await settled();
          for (const actor of [human, ogre, friend, wizard]) {
            const buffs = actor.itemTypes.buff.map((b) => b.id);
            if (buffs.length) await actor.deleteEmbeddedDocuments("Item", buffs);
            const effects = actor.effects.map((e) => e.id);
            if (effects.length) await actor.deleteEmbeddedDocuments("ActiveEffect", effects);
            if (actor.getFlag(MODULE_ID, "spellCooldown")) await actor.unsetFlag(MODULE_ID, "spellCooldown");
          }
          await human.update({ "system.attributes.sr.formula": "" });
        });
        after(async () => {
          CONFIG.Dice.randomUniform = uniform;
          await deleteTokens([wizardToken, friendToken, humanToken, ogreToken, zombieToken]);
          await cleanup([wizard, human, ogre, friend, zombie], messagesBefore);
          await sceneCtl?.restore();
        });

        it("every spell in the table exists, with its buff, conditions and change targets", async () => {
          const spellNames = new Set((await game.packs.get("pf1.spells").getIndex()).map((e) => e.name.toLowerCase()));
          const buffNames = new Set();
          for (const id of ["pf1.buffs", "pf-content.pf-buffs", `${MODULE_ID}.buffs`]) for (const e of (await game.packs.get(id)?.getIndex({ fields: ["type"] })) ?? []) if (e.type === "buff") buffNames.add(e.name);
          const targets = new Set(Object.keys(pf1.config.buffTargets));
          const problems = [];
          for (const [name, def] of Object.entries(SPELLS)) {
            if (!spellNames.has(name)) problems.push(`${name}: no such spell`);
            const effects = [def.effect, def.onSave, ...(def.tiers ?? []).map((t) => t[1])].filter(Boolean);
            for (const e of effects) {
              if (e.buff && !buffNames.has(e.buff)) problems.push(`${name}: no buff "${e.buff}"`);
              for (const [id] of e.conditions ?? []) if (!pf1.registry.conditions.get(id)) problems.push(`${name}: no condition "${id}"`);
              for (const c of [...(e.changes ?? []), ...(e.penalty ? [e.penalty] : [])]) if (!targets.has(c.target) && !/^skill\.\w+$/.test(c.target)) problems.push(`${name}: no change target "${c.target}"`);
            }
          }
          assert.deepEqual(problems, []);
        });

        it("Daze: a failed Will save dazes the humanoid for 1 round; one over 4 HD is unaffected", async () => {
          const card = await cast("Daze", [humanToken, ogreToken]);
          assert.equal(row(card, human).state, "save");
          assert.deepInclude(row(card, ogre), { state: "unaffected", why: "4 HD or less only" });
          dice(0.99);
          await save(card, human);
          assert.isFalse(row(card, human).save.passed);
          assert.isTrue(human.statuses.has("dazed"));
          assert.include(row(card, human).applied.join(), "dazed 1 round");
        });

        it("undead are immune to mind-affecting spells (found when the spell resolves)", async () => {
          const card = await cast("Daze", [zombieToken]);
          assert.deepInclude(row(card, zombie), { state: "unaffected", why: "only humanoid creatures" });
          const sleep = await cast("Sleep", [zombieToken]);
          assert.deepInclude(row(sleep, zombie), { state: "unaffected", why: "immune to mind-affecting effects" });
        });

        it("Magic Missile: a missile per two caster levels beyond 1st, no attack needed", async () => {
          const card = await cast("Magic Missile", [humanToken]);
          assert.match(card.systemRolls.attacks[0].damage[0].formula, /^3d4 \+ 3/, "CL 5: three missiles");
          assert.isUndefined(row(card, human).attack);
          assert.equal(row(card, human).state, "done");
        });

        it("Cure Light Wounds on an ally: the row says healing, not damage", async () => {
          const card = await cast("Cure Light Wounds", [friendToken]);
          assert.deepEqual(row(card, friend).applied, ["healing"]);
        });

        it("Cure Light Wounds harms undead (the card's healing button deals damage)", async () => {
          const card = await cast("Cure Light Wounds", [zombieToken]);
          const hp = zombie.system.attributes.hp.value;
          await zombie.applyDamage(-4, { message: card, forceDialog: false });
          assert.equal(zombie.system.attributes.hp.value, hp - 4);
          await zombie.applyDamage(4, { forceDialog: false });
        });

        it("Chill Touch: a melee touch attack rolled for it, 1d6 on a hit, 1 Strength damage on a failed Fortitude save", async () => {
          dice(0.01); // natural 20 hits; the damage rolls its highest
          const hp = human.system.attributes.hp.value;
          const card = await cast("Chill Touch", [humanToken]);
          const r = row(card, human);
          assert.isTrue(r.attack.hit);
          assert.equal(r.hitDamage, "6 negative energy damage");
          await waitFor(() => human.system.attributes.hp.value === hp - 6, { what: "the damage" });
          dice(0.99);
          await save(card, human);
          assert.equal(human.system.abilities.str.damage, 1);
          await human.update({ "system.abilities.str.damage": 0, "system.attributes.hp.offset": 0 });
        });

        it("Chill Touch on undead: no damage, a Will save or panicked", async () => {
          dice(0.01);
          const hp = zombie.system.attributes.hp.value;
          const card = await cast("Chill Touch", [zombieToken]);
          const r = row(card, zombie);
          assert.equal(r.saveType, "will");
          assert.isUndefined(r.hitDamage);
          assert.equal(zombie.system.attributes.hp.value, hp);
          dice(0.99);
          await zombie.rollSavingThrow("will", { skipDialog: true, dc: card.getFlag(MODULE_ID, spells.FLAG).save.dc, reference: card.uuid });
          await waitFor(() => row(card, zombie).state === "done", { what: "the Will save" });
          assert.isTrue(zombie.statuses.has("panicked"));
        });

        it("Hypnotism and Hideous Laughter: their save modifiers in the save window", async () => {
          const hyp = await cast("Hypnotism", [humanToken]);
          const entries = (actor, card, saveId) => effects.buildModel(actor, { kind: "save", saveId, reference: card.uuid }).provided.filter((p) => p.id.startsWith("spell-save"));
          const h = entries(human, hyp, "will");
          assert.deepInclude(h.find((p) => p.id === "spell-save.aloneOutOfCombat"), { roll: -2, applies: true }, "one creature, no combat");
          assert.isFalse(h.find((p) => p.id === "spell-save.inCombat").applies);
          const laugh = await cast("Hideous Laughter", [humanToken, zombieToken]);
          assert.isFalse(entries(human, laugh, "will")[0].applies, "a human, like the caster");
          assert.deepInclude(entries(zombie, laugh, "will")[0], { roll: 4, applies: true });
        });

        it("Hideous Laughter: prone, and a new save on its next turn ends it", async () => {
          const card = await cast("Hideous Laughter", [humanToken]);
          dice(0.99);
          await save(card, human);
          assert.isTrue(human.statuses.has("prone"));
          const laughing = () => human.itemTypes.buff.find((b) => b.name === "Hideous Laughter");
          assert.isOk(laughing()?.getFlag(MODULE_ID, "resave"));
          const combat = await Combat.create({ scene: canvas.scene.id, active: true, flags: { [MODULE_ID]: { quench: true } } });
          try {
            await combat.createEmbeddedDocuments("Combatant", [
              { tokenId: wizardToken.id, sceneId: canvas.scene.id, actorId: wizard.id, initiative: 20 },
              { tokenId: humanToken.id, sceneId: canvas.scene.id, actorId: human.id, initiative: 10 },
            ]);
            await combat.startCombat();
            const before = new Set(game.messages.keys());
            await combat.nextTurn();
            const resave = await waitFor(() => game.messages.contents.find((m) => !before.has(m.id) && m.getFlag(MODULE_ID, spells.FLAG)?.ends), { what: "the new save" });
            dice(0.01);
            await save(resave, human);
            await waitFor(() => !laughing(), { what: "the laughter to end" });
            assert.include(row(resave, human).applied, "Hideous Laughter ends");
          } finally {
            await combat.delete();
          }
        });

        it("a touch spell with no attack roll in PF1's data gets a melee touch attack", async () => {
          dice(0.99); // natural 1: misses
          const card = await cast("Touch of Fatigue", [humanToken]);
          assert.isFalse(card.getFlag(MODULE_ID, spells.FLAG).touchRoll.ranged);
          assert.deepInclude(row(card, human), { state: "missed" });
          assert.match((await card.renderHTML()).textContent, /melee touch \d+ vs touch AC \d+: misses/);
        });

        it("touch attacks: an ally accepts the touch; a harmless touch spell on an enemy still needs one", async () => {
          dice(0.99);
          const ally = await cast("Touch of Fatigue", [friendToken]);
          assert.isUndefined(row(ally, friend).attack, "no attack against an ally");
          assert.equal(row(ally, friend).state, "save", "not harmless: the ally still saves");
          const undead = await cast("Cure Light Wounds", [zombieToken]);
          assert.isOk(undead.getFlag(MODULE_ID, spells.FLAG).touchRoll, "an unwilling zombie");
          assert.equal(row(undead, zombie).state, "missed");
        });

        it("a ranged touch into melee: -4 unless Precise Shot", async () => {
          await friendToken.update({ x: humanToken.x - canvas.grid.size, y: humanToken.y }, { animate: false });
          try {
            dice(0.5);
            const card = await cast("Mudball", [humanToken]);
            assert.isTrue(row(card, human).attack.intoMelee);
            assert.equal(row(card, human).attack.total, card.getFlag(MODULE_ID, spells.FLAG).touchRoll.total - 4);
          } finally {
            await friendToken.update({ x: wizardToken.x + canvas.grid.size, y: wizardToken.y }, { animate: false });
          }
        });

        it("new saves: every effect gets its card; an unrolled every-turn save comes back; a gone buff still lifts its condition", async () => {
          dice(0.01);
          await cast("Mudball", [humanToken]);
          const trap = await cast("Shadow Trap", [humanToken]);
          dice(0.99);
          await save(trap, human);
          assert.isTrue(human.statuses.has("entangled"));
          const combat = await Combat.create({ scene: canvas.scene.id, active: true, flags: { [MODULE_ID]: { quench: true } } });
          const cards = async () => {
            const before = new Set(game.messages.keys());
            await combat.nextTurn();
            await waitFor(() => game.messages.contents.filter((m) => !before.has(m.id) && m.getFlag(MODULE_ID, spells.FLAG)?.ends).length === 2, { what: "two new saves" });
            return game.messages.contents.filter((m) => !before.has(m.id) && m.getFlag(MODULE_ID, spells.FLAG)?.ends);
          };
          try {
            await combat.createEmbeddedDocuments("Combatant", [
              { tokenId: wizardToken.id, sceneId: canvas.scene.id, actorId: wizard.id, initiative: 20 },
              { tokenId: humanToken.id, sceneId: canvas.scene.id, actorId: human.id, initiative: 10 },
            ]);
            await combat.startCombat();
            await cards(); // neither rolled
            await combat.nextTurn();
            const again = await cards();
            const mud = again.find((m) => m.getFlag(MODULE_ID, spells.FLAG).name === "Mudball");
            await human.itemTypes.buff.find((b) => b.name === "Mudball").delete();
            dice(0.99);
            await human.rollSavingThrow("ref", { skipDialog: true, dc: mud.getFlag(MODULE_ID, spells.FLAG).save.dc, reference: mud.uuid });
            await waitFor(() => !human.statuses.has("blind"), { what: "the blindness lifted" });
          } finally {
            await combat.delete();
          }
        });

        it("a personal spell goes on the caster", async () => {
          const card = await cast("Linebreaker", [humanToken]);
          assert.deepEqual(rows(card).map((r) => r.name), [wizard.name]);
          await waitFor(() => wizard.itemTypes.buff.some((b) => b.name === "Linebreaker"), { what: "Linebreaker" });
        });

        it("Mudball: a ranged touch blinds with no save; a Reflex save each turn until it's shaken off", async () => {
          dice(0.01);
          const card = await cast("Mudball", [humanToken]);
          assert.isTrue(card.getFlag(MODULE_ID, spells.FLAG).touchRoll.ranged);
          assert.equal(row(card, human).state, "done");
          await waitFor(() => human.statuses.has("blind"), { what: "blinded" });
          const combat = await Combat.create({ scene: canvas.scene.id, active: true, flags: { [MODULE_ID]: { quench: true } } });
          const resaveCard = async () => {
            const before = new Set(game.messages.keys());
            await combat.nextTurn();
            return waitFor(() => game.messages.contents.find((m) => !before.has(m.id) && m.getFlag(MODULE_ID, spells.FLAG)?.ends), { what: "the new save" });
          };
          try {
            await combat.createEmbeddedDocuments("Combatant", [
              { tokenId: wizardToken.id, sceneId: canvas.scene.id, actorId: wizard.id, initiative: 20 },
              { tokenId: humanToken.id, sceneId: canvas.scene.id, actorId: human.id, initiative: 10 },
            ]);
            await combat.startCombat();
            const first = await resaveCard();
            assert.equal(first.getFlag(MODULE_ID, spells.FLAG).save.type, "ref");
            dice(0.99);
            await save(first, human);
            assert.isTrue(human.statuses.has("blind"), "failed: still blinded");
            await combat.nextTurn(); // the wizard
            const second = await resaveCard();
            dice(0.01);
            await save(second, human);
            await waitFor(() => !human.statuses.has("blind"), { what: "the mud wiped off" });
          } finally {
            await combat.delete();
          }
        });

        it("conditions expire on time in combat, whatever other combat is running (seconds of world time)", async () => {
          const card = await cast("Daze", [humanToken]);
          dice(0.99);
          await save(card, human);
          const effect = human.effects.find((e) => e.statuses.has("dazed"));
          assert.equal(effect.duration.seconds, 6);
          const combat = await Combat.create({ scene: canvas.scene.id, active: true, flags: { [MODULE_ID]: { quench: true } } });
          try {
            await combat.createEmbeddedDocuments("Combatant", [
              { tokenId: wizardToken.id, sceneId: canvas.scene.id, actorId: wizard.id, initiative: 20 },
              { tokenId: humanToken.id, sceneId: canvas.scene.id, actorId: human.id, initiative: 10 },
            ]);
            await combat.startCombat();
            await combat.nextTurn();
            await combat.nextTurn(); // round 2: a round has passed
            await waitFor(() => !human.statuses.has("dazed"), { what: "dazed to expire" });
          } finally {
            await combat.delete();
          }
        });

        it("fear stacks: shaken and shaken again is frightened, frightened and more fear is panicked", async () => {
          await human.setCondition("shaken", true);
          const card = await cast("Cause Fear", [humanToken]);
          dice(0.01); // a successful save: shaken 1 round, on top of shaken
          await save(card, human);
          assert.isTrue(human.statuses.has("frightened"), "shaken + shaken");
          assert.include(row(card, human).applied.join(), "frightened 1 round");
          const again = await cast("Cause Fear", [humanToken]);
          dice(0.99);
          await save(again, human);
          assert.isTrue(human.statuses.has("panicked"), "frightened + frightened");
        });

        it("a condition already on with a longer duration isn't shortened", async () => {
          const doom = await cast("Doom", [humanToken]);
          dice(0.99);
          await save(doom, human);
          const before = human.effects.find((e) => e.statuses.has("shaken")).duration.seconds;
          await human.setCondition("frightened", false);
          assert.isAbove(before, 6);
        });

        it("a wand casts the spell: rows, its effect, and the spell's descriptors from the compendium", async () => {
          // As PF1's "create wand" dialog makes it: with the spell level, caster level and ability modifier
          const data = await pf1.documents.item.ItemSpellPF.toConsumable({ ...wizard.items.getName("Daze").toObject(), sl: 0, cl: 1, ablMod: 0 }, "wand");
          const [wand] = await wizard.createEmbeddedDocuments("Item", [data]);
          try {
            setTargets([humanToken, zombieToken]);
            const before = new Set(game.messages.keys());
            await wand.use({ skipDialog: true });
            const card = await waitFor(() => game.messages.contents.find((m) => !before.has(m.id) && m.type === "action"));
            await waitFor(() => card.getFlag(MODULE_ID, spells.FLAG)?.resolved, { what: "the rows" });
            assert.equal(card.getFlag(MODULE_ID, spells.FLAG).name, "Daze");
            assert.equal(row(card, human).state, "save");
            assert.deepInclude(row(card, zombie), { state: "unaffected" });
            dice(0.99);
            await save(card, human);
            assert.isTrue(human.statuses.has("dazed"));
          } finally {
            await wand.delete();
          }
        });

        it("buffs: left to Nevela's Automation Suite when it applies them; otherwise a recast doesn't lower the caster level", async () => {
          const first = await cast("Bless", [friendToken]);
          const bless = () => friend.itemTypes.buff.find((b) => b.name === "Bless");
          await waitFor(() => bless());
          if (nevelaAppliesBuff(wizard.items.getName("Bless"), wizard.items.getName("Bless").defaultAction.id, "Bless")) {
            assert.include(row(first, friend).applied.join(), "applied by Nevela's Automation Suite");
            return;
          }
          await bless().update({ "system.level": 9 });
          const card = await cast("Bless", [friendToken]);
          assert.include(row(card, friend).applied.join(), "already at caster level 9");
          assert.equal(bless().system.level, 9);
        });

        it("stepping the combat tracker back doesn't offer a new save again", async () => {
          const card = await cast("Hideous Laughter", [humanToken]);
          dice(0.99);
          await save(card, human);
          const combat = await Combat.create({ scene: canvas.scene.id, active: true, flags: { [MODULE_ID]: { quench: true } } });
          const offers = () => game.messages.contents.filter((m) => m.getFlag(MODULE_ID, spells.FLAG)?.ends && m.timestamp >= combat._stats.createdTime).length;
          try {
            await combat.createEmbeddedDocuments("Combatant", [
              { tokenId: humanToken.id, sceneId: canvas.scene.id, actorId: human.id, initiative: 20 },
              { tokenId: wizardToken.id, sceneId: canvas.scene.id, actorId: wizard.id, initiative: 10 },
            ]);
            await combat.startCombat();
            await combat.nextTurn(); // the wizard
            await combat.nextTurn(); // round 2, the human: offered
            await waitFor(() => offers() === 1, { what: "the offer" });
            await human.itemTypes.buff.find((b) => b.name === "Hideous Laughter").setFlag(MODULE_ID, "resave", { save: { type: "will", dc: 15 }, cl: 5 });
            await combat.previousTurn();
            await combat.previousTurn(); // back to the human in round 1
            await new Promise((r) => setTimeout(r, 500));
            assert.equal(offers(), 1, "no second offer going backwards");
          } finally {
            await combat.delete();
          }
        });

        it("unlinked tokens of the same creature: each save goes to its own row", async () => {
          const size = canvas.grid.size;
          const unlinked = async (col) => {
            const data = await ogre.getTokenDocument({ x: canvas.dimensions.sceneX + col * size, y: canvas.dimensions.sceneY + 4 * size, disposition: CONST.TOKEN_DISPOSITIONS.HOSTILE, actorLink: false });
            const [doc] = await canvas.scene.createEmbeddedDocuments("Token", [data.toObject()]);
            await waitFor(() => doc.object);
            return doc;
          };
          const a = await unlinked(4), b = await unlinked(5);
          try {
            const card = await cast("Color Spray", [a, b]);
            const rowOf = (t) => rows(card).find((r) => r.uuid === t.uuid);
            dice(0.99); // b fails first
            await b.actor.rollSavingThrow("will", { skipDialog: true, dc: card.getFlag(MODULE_ID, spells.FLAG).save.dc, reference: card.uuid, token: b });
            await waitFor(() => rowOf(b).state === "done", { what: "b's save" });
            assert.isFalse(rowOf(b).save.passed);
            assert.equal(rowOf(a).state, "save", "a's row still waits for a's save");
            dice(0.01);
            await a.actor.rollSavingThrow("will", { skipDialog: true, dc: card.getFlag(MODULE_ID, spells.FLAG).save.dc, reference: card.uuid, token: a });
            await waitFor(() => rowOf(a).state === "done", { what: "a's save" });
            assert.isTrue(rowOf(a).save.passed);
            assert.isTrue(b.actor.statuses.has("stunned"));
            assert.isFalse(a.actor.statuses.has("stunned"));
          } finally {
            await deleteTokens([a, b]);
          }
        });

        it("Daze: immune for a minute after being dazed by it", async () => {
          await human.setFlag(MODULE_ID, "spellCooldown", { daze: game.time.worldTime + 60 });
          const card = await cast("Daze", [humanToken]);
          assert.equal(row(card, human).state, "unaffected");
        });

        it("a successful save: no effect; a natural 20 always saves", async () => {
          const card = await cast("Flare", [humanToken]);
          dice(0.01);
          await save(card, human);
          assert.isTrue(row(card, human).save.passed);
          assert.isFalse(human.statuses.has("dazzled"));
          assert.include(row(card, human).applied, "no effect");
        });

        it("Cause Fear: frightened on a failed save, shaken 1 round on a successful one", async () => {
          const card = await cast("Cause Fear", [humanToken, friendToken]);
          dice(0.99);
          await save(card, human);
          assert.isTrue(human.statuses.has("frightened"));
          dice(0.01);
          await save(card, friend);
          assert.isTrue(friend.statuses.has("shaken"));
          assert.include(row(card, friend).applied.join(), "shaken 1 round");
        });

        it("spell resistance: rolled automatically; a resisted spell has no save; only the GM sees the SR", async () => {
          await human.update({ "system.attributes.sr.formula": "40" });
          const card = await cast("Daze", [humanToken]);
          const r = row(card, human);
          assert.equal(r.state, "resisted");
          assert.equal(r.sr.value, 40);
          assert.isFalse(r.sr.passed);
          assert.match((await card.renderHTML()).textContent, /SR check \d+ vs SR 40: resisted/);
        });

        it("Bless: allies among the targets get the buff, enemies aren't listed", async () => {
          const card = await cast("Bless", [friendToken, humanToken]);
          assert.deepEqual(rows(card).map((r) => r.name), [friend.name]);
          await waitFor(() => friend.itemTypes.buff.some((b) => b.name === "Bless" && b.isActive), { what: "Bless" });
          assert.equal(friend.itemTypes.buff.find((b) => b.name === "Bless").system.level, 5);
          const bane = await cast("Bane", [friendToken, humanToken]);
          assert.deepEqual(rows(bane).map((r) => r.name), [human.name]);
        });

        it("Shield: on the caster, with no targets", async () => {
          const card = await cast("Shield", []);
          assert.deepEqual(rows(card).map((r) => r.name), [wizard.name]);
          await waitFor(() => wizard.itemTypes.buff.some((b) => b.name === "Shield" && b.isActive), { what: "Shield" });
        });

        it("Sleep: 4 HD in all, fewest HD first", async () => {
          const card = await cast("Sleep", [ogreToken, humanToken, friendToken]);
          assert.equal(row(card, ogre).state, "unaffected", "6 HD: more than the pool");
          assert.equal(row(card, human).state, "save");
          assert.equal(row(card, friend).state, "save");
          dice(0.99);
          await save(card, human);
          assert.isTrue(human.statuses.has("sleep"));
        });

        it("Color Spray: by Hit Dice", async () => {
          const card = await cast("Color Spray", [humanToken, ogreToken]);
          dice(0.99);
          await save(card, human);
          await save(card, ogre);
          for (const id of ["unconscious", "blind", "stunned"]) assert.isTrue(human.statuses.has(id), `1 HD: ${id}`);
          assert.isTrue(ogre.statuses.has("stunned"));
          assert.isFalse(ogre.statuses.has("blind"), "5 HD or more: stunned only");
          assert.include(row(card, ogre).applied.join(), "stunned 1 round");
        });

        it("Ray of Enfeeblement: hits touch AC, a Strength penalty; a lower one later doesn't replace it", async () => {
          dice(0.01); // natural 20: hits
          const card = await cast("Ray of Enfeeblement", [humanToken]);
          assert.isTrue(row(card, human).attack.hit);
          dice(0.99); // fails the save; the penalty rolls its lowest: 1 + 2
          await save(card, human);
          const buff = human.itemTypes.buff.find((b) => b.name === "Ray of Enfeeblement");
          assert.equal(buff.system.changes[0].formula, "-3");
          await buff.update({ "system.changes": [{ formula: "-6", target: "str", type: "untyped" }] });
          dice(0.01);
          const again = await cast("Ray of Enfeeblement", [humanToken]);
          dice(0.99);
          await save(again, human);
          assert.equal(human.itemTypes.buff.find((b) => b.name === "Ray of Enfeeblement").system.changes[0].formula, "-6");
        });
      });
    },
    { displayName: "PF1e Revamp: Spells" }
  );
}
