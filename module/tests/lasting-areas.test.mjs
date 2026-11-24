// Lasting areas: who is inside a template, creatures entering and leaving, the caster's turns, and the end
// of the spell (Entangle, Stinking Cloud, Cloudkill, Black Tentacles, Solid Fog).

import { createTestActor, cleanup, useTestScene, placeToken, deleteTokens, waitFor } from "./helpers.mjs";
import * as LA from "../lasting-areas.mjs";
import { missChances } from "../miss-chance.mjs";
import { reaches, KIND_FLAG, areaKind, _test as AR } from "../area-reach.mjs";
import { burningOf } from "../burning.mjs";
import { bleedOf, stopBleed } from "../bleed.mjs";

const MODULE_ID = "pf1e-revamp";

export function registerLastingAreaTests(quench) {
  quench.registerBatch(
    "pf1e-revamp.lasting-areas",
    (context) => {
      const { describe, it, assert, before, after, afterEach } = context;

      describe("Lasting areas", function () {
        this.timeout(60000);
        let caster, walker, undead, small, tokens, ctl, messagesBefore;
        const templates = [];
        const originalRandom = CONFIG.Dice.randomUniform;
        const forceDice = (u) => (CONFIG.Dice.randomUniform = () => u);
        const size = () => canvas.scene.grid.size;
        /** A circle of the spell's area 2 squares right of the walker's start, tracked as if just cast. */
        const area = async (key, name, extra = {}) => {
          const x = canvas.dimensions.sceneX + 6 * size();
          const y = canvas.dimensions.sceneY + 2 * size();
          const [t] = await canvas.scene.createEmbeddedDocuments("MeasuredTemplate", [{ t: "circle", x, y, distance: 5, flags: { [MODULE_ID]: { [LA._test.FLAG]: { key, name, caster: caster.uuid, message: null, dc: 15, cl: 9, endsAt: null, inside: [], creatures: {}, ...extra } } } }]);
          templates.push(t);
          return t;
        };
        /** Move a token to a square (col, row) of the scene. */
        const moveTo = (token, col, row) => token.update({ x: canvas.dimensions.sceneX + col * size(), y: canvas.dimensions.sceneY + row * size() }, { animate: false });
        const into = (token) => moveTo(token, 5, 1); // its center at (5.5, 1.5) squares: within 5 ft of (6, 2)
        const out = (token) => moveTo(token, 1, 1);

        before(async function () {
          if (!game.users.activeGM?.isSelf) this.skip();
          messagesBefore = new Set(game.messages.keys());
          ctl = await useTestScene();
          caster = await createTestActor("Quench Area Caster", { items: [["pf1.classes", "Wizard", { system: { level: 9 } }]] });
          walker = await createTestActor("Quench Area Walker", { abilities: { con: 12 }, items: [["pf1.classes", "Fighter", { system: { level: 8 } }]] });
          small = await createTestActor("Quench Area Weakling", { items: [["pf1.classes", "Warrior", { system: { level: 2 } }]] });
          undead = await createTestActor("Quench Area Skeleton", { items: [["pf1.racial-hd", "Undead", { system: { level: 1 } }]] });
          tokens = { caster: await placeToken(caster, 1, 4), walker: await placeToken(walker, 1, 1), small: await placeToken(small, 1, 2, { disposition: -1 }), undead: await placeToken(undead, 1, 3, { disposition: -1 }) };
        });
        afterEach(async () => {
          CONFIG.Dice.randomUniform = originalRandom;
          for (const t of templates.splice(0)) if (canvas.scene.templates.has(t.id)) await t.delete();
          await out(tokens.walker);
          // A deleted area releases what it held on the GM's hooks (lingering conditions get their rounds): let that land
          await new Promise((r) => setTimeout(r, 500));
          for (const a of [walker, small, undead]) {
            const clear = { entangled: false, nauseated: false, grappled: false, dead: false, prone: false, fascinated: false, sickened: false };
            await a.setConditions(clear).catch(async () => {
              await new Promise((r) => setTimeout(r, 300));
              await a.setConditions(clear);
            });
            if (bleedOf(a)) await stopBleed(a);
            if (burningOf(a)) await a.unsetFlag(MODULE_ID, "burning");
            if (a.statuses.has("burning")) await a.setConditions({ burning: false });
            const buffs = a.itemTypes.buff.map((b) => b.id);
            if (buffs.length) await a.deleteEmbeddedDocuments("Item", buffs);
            await a.update({ "system.abilities.con.damage": 0, "system.attributes.hp.value": a.system.attributes.hp.max });
          }
        });
        after(async () => {
          await deleteTokens(Object.values(tokens ?? {}));
          await cleanup([caster, walker, small, undead], messagesBefore);
          await ctl?.restore();
        });

        it("areas and walls: a burst stops at a wall; a spread goes around it as far as its radius allows", async () => {
          assert.equal(areaKind("webs in a 20-ft.-radius spread"), "spread");
          assert.equal(areaKind("cone-shaped burst"), "burst");
          const g = size();
          const px = (c) => canvas.dimensions.sceneX + c * g;
          const py = (r) => canvas.dimensions.sceneY + r * g;
          await moveTo(tokens.walker, 8, 6); // its square: 2 squares right of the point of origin (6, 6)
          const circle = async (distance, kind) => {
            const [t] = await canvas.scene.createEmbeddedDocuments("MeasuredTemplate", [{ t: "circle", x: px(6), y: py(6), distance, flags: { [MODULE_ID]: { [KIND_FLAG]: kind } } }]);
            templates.push(t);
            return t;
          };
          assert.isTrue(reaches(await circle(20, "burst"), tokens.walker), "no wall: reached");
          // A wall along the grid line between them, from row 4 to row 8
          const [wall] = await canvas.scene.createEmbeddedDocuments("Wall", [{ c: [px(8), py(4), px(8), py(8)] }]);
          try {
            assert.isFalse(reaches(await circle(20, "burst"), tokens.walker), "a burst doesn't turn the corner");
            assert.isFalse(reaches(await circle(20, "spread"), tokens.walker), "around the wall is 30 feet: a 20-foot spread falls short");
            assert.isTrue(reaches(await circle(30, "spread"), tokens.walker), "a 30-foot spread reaches around it");
            assert.isFalse(LA._test.insideTemplate(await circle(20, "spread"), tokens.walker), "the lasting areas use it too");
          } finally {
            await wall.delete();
          }
        });

        it("a spread placed on a square's center reaches its full radius (that square is the point of origin)", async () => {
          const g = size();
          const at = (c, r) => ({ x: canvas.dimensions.sceneX + (c + 0.5) * g, y: canvas.dimensions.sceneY + (r + 0.5) * g });
          const [t] = await canvas.scene.createEmbeddedDocuments("MeasuredTemplate", [{ t: "circle", ...at(6, 6), distance: 20, flags: { [MODULE_ID]: { [KIND_FLAG]: "spread" } } }]);
          templates.push(t);
          const reached = AR.spreadSquares(t);
          const key = (c, r) => { const o = canvas.grid.getOffset(at(c, r)); return `${o.i},${o.j}`; };
          assert.isTrue(reached.has(key(10, 6)), "4 squares away: 20 feet");
          assert.isFalse(reached.has(key(11, 6)), "5 squares away: 25 feet");
        });

        it("a dead creature in a lasting area is a corpse: nothing happens to it", async () => {
          await area("stinkingCloud", "Stinking Cloud");
          forceDice(0.999);
          await walker.setConditions({ dead: true });
          await into(tokens.walker);
          await new Promise((r) => setTimeout(r, 1500));
          assert.isFalse(walker.statuses.has("nauseated"));
          assert.isFalse(game.messages.contents.some((m) => /Stinking Cloud/.test(m.content) && /Quench Area Walker/.test(m.content)), "no line for it");
        });

        it("knows who is inside a circle or a rectangle", async () => {
          const t = await area("silence", "Silence");
          await into(tokens.walker);
          assert.isTrue(LA._test.insideTemplate(t, tokens.walker));
          assert.isFalse(LA._test.insideTemplate(t, tokens.small));
          const [rect] = await canvas.scene.createEmbeddedDocuments("MeasuredTemplate", [{ t: "rect", x: canvas.dimensions.sceneX, y: canvas.dimensions.sceneY + size(), distance: Math.hypot(10, 10), direction: 45 }]);
          templates.push(rect);
          assert.isTrue(LA._test.insideTemplate(rect, tokens.small), "the 10-by-10-foot square from (0, 1)");
        });

        it("entangle: entering means a save; a failure entangles until it leaves", async () => {
          await area("entangle", "Entangle");
          forceDice(0.999);
          await into(tokens.walker);
          await waitFor(() => walker.statuses.has("entangled"), { what: "entangled on entering" });
          CONFIG.Dice.randomUniform = originalRandom;
          await out(tokens.walker);
          await waitFor(() => !walker.statuses.has("entangled"), { what: "freed on leaving" });
        });

        it("entangle: a creature that saved saves again at the end of the caster's turn", async () => {
          const t = await area("entangle", "Entangle");
          forceDice(0.001);
          await into(tokens.walker);
          await waitFor(() => LA._test.zoneOf(canvas.scene.templates.get(t.id))?.inside.length === 1, { what: "inside" });
          assert.isFalse(walker.statuses.has("entangled"));
          forceDice(0.999);
          await LA._test.act(canvas.scene.templates.get(t.id), [tokens.walker], "casterTurnEnd", "end of the caster's turn");
          assert.isTrue(walker.statuses.has("entangled"));
        });

        it("stinking cloud: nauseated while inside and for 1d4+1 rounds after leaving; undead are unaffected", async () => {
          await area("stinkingCloud", "Stinking Cloud");
          forceDice(0.999);
          await into(tokens.walker);
          await waitFor(() => walker.statuses.has("nauseated"), { what: "nauseated" });
          await moveTo(tokens.undead, 5, 1);
          await waitFor(() => game.messages.contents.some((m) => /Quench Area Skeleton: not living/.test(m.content)), { what: "the skeleton's line" });
          assert.isFalse(undead.statuses.has("nauseated"));
          await moveTo(tokens.undead, 1, 3);
          await out(tokens.walker);
          await waitFor(() => walker.effects.some((e) => e.statuses.has("nauseated") && e.duration?.seconds), { what: "nauseated for a few rounds" });
        });

        it("cloudkill: a creature of 3 or fewer Hit Dice dies on entering", async () => {
          await area("cloudkill", "Cloudkill");
          await moveTo(tokens.small, 5, 1);
          await waitFor(() => small.statuses.has("dead"), { what: "slain" });
          await moveTo(tokens.small, 1, 2);
        });

        it("black tentacles: one grapple roll a round; a hit grapples and deals 1d6+4", async () => {
          await area("blackTentacles", "Black Tentacles", { roll: 40 });
          const hp = walker.system.attributes.hp.value;
          await into(tokens.walker);
          await waitFor(() => walker.statuses.has("grappled"), { what: "grappled" });
          // The 1d6+4 lands just after the grapple: wait for it
          await waitFor(() => walker.system.attributes.hp.value < hp - 4, { what: "the tentacles' damage" });
        });

        it("solid fog: −2 on melee attacks and damage while inside, gone on leaving", async () => {
          await area("solidFog", "Solid Fog");
          await into(tokens.walker);
          const buff = await waitFor(() => walker.itemTypes.buff.find((b) => /Solid Fog/.test(b.name)), { what: "the fog's buff" });
          assert.deepInclude(buff.system.changes.map((c) => c.target), "mattack");
          await out(tokens.walker);
          await waitFor(() => !walker.itemTypes.buff.some((b) => /Solid Fog/.test(b.name)), { what: "the buff gone" });
        });

        it("acid fog: 2d6 acid to each creature inside on the caster's turn; ice storm: -4 Perception inside", async () => {
          const t = await area("acidFog", "Acid Fog");
          await into(tokens.walker);
          await waitFor(() => LA._test.zoneOf(canvas.scene.templates.get(t.id))?.inside.length === 1, { what: "inside" });
          const hp = walker.system.attributes.hp.value;
          forceDice(0.001);
          await LA._test.act(canvas.scene.templates.get(t.id), [tokens.walker], "casterTurnStart", "the caster's turn");
          assert.equal(walker.system.attributes.hp.value, hp - 12);
          CONFIG.Dice.randomUniform = originalRandom;
          await out(tokens.walker);
          await area("iceStorm", "Ice Storm");
          await into(tokens.walker);
          const buff = await waitFor(() => walker.itemTypes.buff.find((b) => /Ice Storm/.test(b.name)), { what: "the storm's buff" });
          assert.deepInclude(buff.system.changes.map((c) => [c.target, c.formula]), ["skill.per", "-4"]);
        });

        it("drifting clouds: 10 feet a round along their direction, stopping at a wall; a GM drag sets a missing direction", async () => {
          const g = size();
          const t = await area("cloudkill", "Cloudkill", { at: null, drift: { x: 1, y: 0 } });
          const x0 = t.x;
          await t.update({ [`flags.${MODULE_ID}.${LA._test.FLAG}.at`]: { x: t.x, y: t.y } });
          assert.isNull(await LA._test.drift(canvas.scene.templates.get(t.id)));
          assert.closeTo(canvas.scene.templates.get(t.id).x, x0 + 2 * g, 1, "10 feet: 2 squares");
          // A wall 1 square ahead: the cloud stops just short of it
          const [wall] = await canvas.scene.createEmbeddedDocuments("Wall", [{ c: [x0 + 3 * g, t.y - 3 * g, x0 + 3 * g, t.y + 3 * g] }]);
          try {
            assert.match(await LA._test.drift(canvas.scene.templates.get(t.id)), /wall/);
            const x = canvas.scene.templates.get(t.id).x;
            assert.isBelow(x, x0 + 3 * g);
            assert.isAbove(x, x0 + 3 * g - 5);
            assert.isTrue(LA._test.zoneOf(canvas.scene.templates.get(t.id)).stopped);
          } finally {
            await wall.delete();
          }
          // No direction (cast on the caster's square): the GM's first drag gives it one
          const u = await area("cloudkill", "Cloudkill", { drift: null });
          await u.update({ [`flags.${MODULE_ID}.${LA._test.FLAG}.at`]: { x: u.x, y: u.y } });
          assert.match(await LA._test.drift(canvas.scene.templates.get(u.id)), /drag the template/);
          await u.update({ y: u.y + g });
          await waitFor(() => LA._test.zoneOf(canvas.scene.templates.get(u.id)).drift?.y === 1, { what: "the direction from the drag" });
        });

        /** A line wall down column `col` (a grid line, or square centers with .5), rows 0 to 6, raised as if just cast. */
        const wall = async (key, name, col) => {
          const [t] = await canvas.scene.createEmbeddedDocuments("MeasuredTemplate", [{ t: "ray", x: canvas.dimensions.sceneX + col * size(), y: canvas.dimensions.sceneY, direction: 90, distance: 30, width: 5 }]);
          templates.push(t);
          await LA._test.castWall(t, { key, name, caster: caster.uuid, message: null, dc: 15, cl: 9, endsAt: null, inside: [], creatures: {} }, caster);
          return canvas.scene.templates.get(t.id);
        };

        it("wall of fire: passing through deals 2d6 + caster level; the heat faces away from the caster, 1d4 past 10 feet", async () => {
          const t = await wall("wallOfFire", "Wall of Fire", 4); // the caster (column 1) is on its left
          const hp = walker.system.attributes.hp.value;
          forceDice(0.001);
          await moveTo(tokens.walker, 6, 1); // across the wall
          await waitFor(() => walker.system.attributes.hp.value === hp - 21, { what: "2d6 + 9 fire" });
          const { tokens: hot, feet } = LA._test.heated(t, LA._test.zoneOf(t));
          assert.deepEqual(hot.map((x) => x.id), [tokens.walker.id], "the hot side is away from the caster (column 1)");
          assert.equal(feet[tokens.walker.id], 12.5);
          assert.isFalse(LA._test.crosses(t, { x: t.x + 2 * size(), y: t.y + size() }, { x: t.x + 3 * size(), y: t.y + size() }), "a move on one side doesn't cross");
        });

        it("blade barrier: a creature where it appears avoids it with a Reflex save, or takes 1d6 per caster level", async () => {
          await moveTo(tokens.small, 4, 2); // in the wall's squares
          const hp = small.system.attributes.hp.value;
          forceDice(0.999); // the save fails, each die rolls 1
          await wall("bladeBarrier", "Blade Barrier", 4.5);
          assert.equal(small.system.attributes.hp.value, hp - 9);
          CONFIG.Dice.randomUniform = originalRandom;
          await moveTo(tokens.small, 1, 2);
        });

        it("flaming sphere: moved into a creature's space, a Reflex save or 3d6 fire", async () => {
          const t = await area("flamingSphere", "Flaming Sphere");
          await t.update({ [`flags.${MODULE_ID}.${LA._test.FLAG}.at`]: { x: t.x, y: t.y } });
          const hp = walker.system.attributes.hp.value;
          forceDice(0.999); // the save fails, each die rolls 1
          await t.update({ x: tokens.walker.x + size() / 2, y: tokens.walker.y + size() / 2 });
          await waitFor(() => walker.system.attributes.hp.value === hp - 3, { what: "3d6 fire" });
        });

        it("grease: moving in needs DC 10 Acrobatics; failing by 5 or more is a fall", async () => {
          await area("grease", "Grease");
          forceDice(0.999);
          await into(tokens.walker);
          await waitFor(() => walker.statuses.has("prone"), { what: "fell" });
        });

        it("spike growth: piercing damage for the feet moved through it, then a Reflex save or half speed", async () => {
          await area("spikeGrowth", "Spike Growth");
          const hp = walker.system.attributes.hp.value;
          forceDice(0.999);
          await into(tokens.walker);
          await waitFor(() => walker.itemTypes.buff.some((b) => /Spike Growth injury/.test(b.name)), { what: "slowed" });
          assert.isBelow(walker.system.attributes.hp.value, hp);
        });

        it("create pit: a creature walking in falls (1d6 per 10 feet of depth) and is prone", async () => {
          await area("createPit", "Create Pit");
          const hp = walker.system.attributes.hp.value;
          await into(tokens.walker);
          await waitFor(() => walker.statuses.has("prone"), { what: "in the pit" });
          assert.isBelow(walker.system.attributes.hp.value, hp);
        });

        it("fog: 20% concealment within 5 feet, 50% beyond, also seen through the fog", async () => {
          await area("fogCloud", "Fog Cloud");
          await into(tokens.walker);
          await waitFor(() => LA._test.zoneOf(templates.at(-1))?.inside?.length || true);
          const near = missChances(walker, small, null, "mwak", { distance: 5, defenderToken: tokens.walker, attackerToken: tokens.small }).find((c) => /Fog Cloud/.test(c.label));
          const far = missChances(walker, caster, null, "rwak", { distance: 30, defenderToken: tokens.walker, attackerToken: tokens.caster }).find((c) => /Fog Cloud/.test(c.label));
          assert.equal(near?.chance, 20);
          assert.equal(far?.chance, 50);
          await out(tokens.walker);
          const clear = missChances(walker, caster, null, "rwak", { distance: 15, defenderToken: tokens.walker, attackerToken: tokens.caster }).find((c) => /Fog Cloud/.test(c.label));
          assert.isUndefined(clear, "no fog between them");
        });

        // The other books' lasting areas
        const inside = (t) => waitFor(() => LA._test.zoneOf(canvas.scene.templates.get(t.id))?.inside.length === 1, { what: "inside" });
        /** The area has recorded a condition it holds on the walker (its flag lands just after the condition). */
        const held = (t, id) => waitFor(() => Object.values(LA._test.zoneOf(canvas.scene.templates.get(t.id))?.creatures ?? {}).some((c) => c.held?.includes(id)), { what: `the area holding ${id}` });
        const fogChance = (name, attacker, attackerToken, distance) => missChances(walker, attacker, null, "rwak", { distance, defenderToken: tokens.walker, attackerToken }).find((c) => c.label.startsWith(name))?.chance;

        it("clouds after stinking cloud: euphoric cloud fascinates, cloud of seasickness sickens, drunkard's breath has no fog", async () => {
          await area("euphoricCloud", "Euphoric Cloud");
          forceDice(0.999);
          await into(tokens.walker);
          await waitFor(() => walker.statuses.has("fascinated"), { what: "fascinated" });
          await out(tokens.walker);
          await waitFor(() => walker.effects.some((e) => e.statuses.has("fascinated") && e.duration?.seconds), { what: "fascinated for 1d4+1 rounds" });
          await walker.setConditions({ fascinated: false });
          await area("cloudOfSeasickness", "Cloud of Seasickness");
          await into(tokens.walker);
          await waitFor(() => walker.statuses.has("sickened"), { what: "sickened" });
          await out(tokens.walker);
          // Its sickness lingers 1d4+1 rounds: let it land, then clear it for the next test
          await waitFor(() => walker.effects.some((e) => e.statuses.has("sickened") && e.duration?.seconds), { what: "sickened for 1d4+1 rounds" });
          await walker.setConditions({ sickened: false });
          await area("drunkardsBreath", "Drunkard's Breath");
          await into(tokens.walker);
          assert.isUndefined(fogChance("Drunkard's Breath", caster, tokens.caster, 30), "it doesn't obscure vision");
          await waitFor(() => walker.statuses.has("nauseated"), { what: "nauseated" });
          await out(tokens.walker);
          await waitFor(() => walker.effects.some((e) => e.statuses.has("nauseated") && e.duration?.seconds), { what: "nauseated for 1d4+1 rounds" });
          await walker.setConditions({ nauseated: false });
        });

        it("sickening entanglement: a creature that saved saves again against the sap at the end of its own turn", async () => {
          const t = await area("sickeningEntanglement", "Sickening Entanglement");
          forceDice(0.001); // both saves succeed
          await into(tokens.walker);
          await inside(t);
          // Its entering is handled once the area records the creature (only then change the dice)
          await waitFor(() => LA._test.zoneOf(canvas.scene.templates.get(t.id))?.creatures?.[tokens.walker.id], { what: "the entering handled" });
          assert.isFalse(walker.statuses.has("sickened"), `saved on entering: ${[...walker.statuses].join(", ")}`);
          forceDice(0.999);
          await LA._test.act(canvas.scene.templates.get(t.id), [tokens.walker], "ownTurnEnd", "end of its turn");
          assert.isTrue(walker.statuses.has("sickened"));
          assert.isFalse(walker.statuses.has("entangled"), "the entangle save comes on the caster's turn");
        });

        it("burning entanglement: 4d6 fire (Reflex half) to an entangled creature at the start of its turn; smoke conceals past 5 feet", async () => {
          const t = await area("burningEntanglement", "Burning Entanglement");
          forceDice(0.999);
          await into(tokens.walker);
          await held(t, "entangled");
          const hp = walker.system.attributes.hp.value;
          await LA._test.act(canvas.scene.templates.get(t.id), [tokens.walker], "ownTurnStart", "start of its turn");
          assert.equal(walker.system.attributes.hp.value, hp - 4);
          CONFIG.Dice.randomUniform = originalRandom;
          assert.isUndefined(fogChance("Burning Entanglement", small, tokens.small, 5), "clear within 5 feet");
          assert.equal(fogChance("Burning Entanglement", caster, tokens.caster, 30), 20);
        });

        it("barrow haze: fog to everyone but its caster", async () => {
          const t = await area("barrowHaze", "Barrow Haze");
          await into(tokens.walker);
          await inside(t);
          assert.isUndefined(fogChance("Barrow Haze", caster, tokens.caster, 30));
          assert.equal(fogChance("Barrow Haze", small, tokens.small, 30), 50);
        });

        it("flashfire: Reflex or 1d6 fire per 3 caster levels and catching fire; concealment inside", async () => {
          await area("flashfire", "Flashfire");
          const hp = walker.system.attributes.hp.value;
          forceDice(0.999);
          await into(tokens.walker);
          await waitFor(() => burningOf(walker), { what: "on fire" });
          assert.equal(walker.system.attributes.hp.value, hp - 3, "3d6 at caster level 9");
          CONFIG.Dice.randomUniform = originalRandom;
          assert.equal(fogChance("Flashfire", caster, tokens.caster, 30), 20);
        });

        it("Constitution damage: poisonous cloud, thirsting entanglement, hungry darkness", async () => {
          forceDice(0.999);
          await area("poisonousCloud", "Poisonous Cloud");
          await into(tokens.walker);
          await waitFor(() => walker.system.abilities.con.damage === 1, { what: "1d2 Con" });
          await out(tokens.walker);
          await walker.update({ "system.abilities.con.damage": 0 });
          await area("thirstingEntanglement", "Thirsting Entanglement");
          await into(tokens.walker);
          await waitFor(() => walker.statuses.has("entangled") && walker.system.abilities.con.damage === 1, { what: "entangled and 1d2 Con" });
          await out(tokens.walker);
          await walker.update({ "system.abilities.con.damage": 0 });
          const dark = await area("hungryDarkness", "Hungry Darkness");
          await into(tokens.walker);
          await inside(dark);
          const { value: hp, max } = walker.system.attributes.hp;
          await LA._test.act(canvas.scene.templates.get(dark.id), [tokens.walker], "ownTurnStart", "start of its turn");
          // The Con damage lowers the maximum (and current) hit points too
          const lostMax = max - walker.system.attributes.hp.max;
          assert.equal(hp - walker.system.attributes.hp.value - lostMax, 3, "3d6 force");
          assert.equal(walker.system.abilities.con.damage, 2);
        });

        it("winter grasp, impossible angles and sawtooth terrain", async () => {
          forceDice(0.999);
          const ice = await area("winterGrasp", "Winter Grasp");
          await into(tokens.walker);
          await inside(ice);
          let hp = walker.system.attributes.hp.value;
          await LA._test.act(canvas.scene.templates.get(ice.id), [tokens.walker], "ownTurnStart", "start of its turn");
          assert.equal(walker.system.attributes.hp.value, hp - 1, "1d6 cold");
          await out(tokens.walker);
          const angles = await area("impossibleAngles", "Impossible Angles");
          await into(tokens.walker);
          await waitFor(() => walker.statuses.has("sickened"), { what: "disoriented" });
          await held(angles, "sickened");
          forceDice(0.001);
          await LA._test.act(canvas.scene.templates.get(angles.id), [tokens.walker], "ownTurnStart", "start of its turn");
          assert.isFalse(walker.statuses.has("sickened"), "the new save ends it");
          await out(tokens.walker);
          forceDice(0.999);
          const saw = await area("sawtoothTerrain", "Sawtooth Terrain");
          hp = walker.system.attributes.hp.value;
          await LA._test.act(canvas.scene.templates.get(saw.id), [tokens.walker], "enter", "cast", { atCasting: true });
          assert.equal(walker.system.attributes.hp.value, hp - 3, "3d8 piercing");
          assert.equal(bleedOf(walker)?.amount, 2, "2d6 bleed");
          assert.isTrue(walker.itemTypes.buff.some((b) => /Sawtooth Terrain injury/.test(b.name)), "half speed for 24 hours");
        });

        it("spheres and walls: greater flaming sphere, aggressive thundercloud, wall of clockwork; condensed ether", async () => {
          const strike = async (key, name) => {
            const t = await area(key, name);
            await t.update({ [`flags.${MODULE_ID}.${LA._test.FLAG}.at`]: { x: t.x, y: t.y } });
            const hp = walker.system.attributes.hp.value;
            await t.update({ x: tokens.walker.x + size() / 2, y: tokens.walker.y + size() / 2 });
            return hp;
          };
          forceDice(0.999); // the saves fail, each die rolls 1
          let hp = await strike("flamingSphereGreater", "Flaming Sphere, Greater");
          await waitFor(() => walker.system.attributes.hp.value === hp - 6 && burningOf(walker), { what: "6d6 fire and on fire" });
          hp = await strike("aggressiveThundercloud", "Aggressive Thundercloud");
          await waitFor(() => walker.system.attributes.hp.value === hp - 3, { what: "3d6 electricity" });
          await wall("wallOfClockwork", "Wall of Clockwork", 4);
          hp = walker.system.attributes.hp.value;
          await moveTo(tokens.walker, 6, 1);
          await waitFor(() => walker.system.attributes.hp.value === hp - 4, { what: "4d6 at caster level 9" });
          CONFIG.Dice.randomUniform = originalRandom;
          await area("condensedEther", "Condensed Ether");
          await into(tokens.walker);
          const buff = await waitFor(() => walker.itemTypes.buff.find((b) => /Condensed Ether/.test(b.name)), { what: "the ether's buff" });
          assert.deepInclude(buff.system.changes.map((c) => [c.target, c.formula]), ["ref", "-2"]);
        });

        it("the spell ends: its template goes and what it held is released", async () => {
          const t = await area("entangle", "Entangle");
          forceDice(0.999);
          await into(tokens.walker);
          await waitFor(() => walker.statuses.has("entangled"), { what: "entangled" });
          // The area records what it holds just after applying it: wait for that
          await waitFor(() => Object.values(LA._test.zoneOf(canvas.scene.templates.get(t.id))?.creatures ?? {}).some((c) => c.held?.includes("entangled")), { what: "the area's record" });
          CONFIG.Dice.randomUniform = originalRandom;
          await LA._test.endZone(canvas.scene.templates.get(t.id));
          assert.isFalse(canvas.scene.templates.has(t.id));
          assert.isFalse(walker.statuses.has("entangled"));
        });
      });
    },
    { displayName: "PF1e Revamp: Lasting areas" },
  );
}
