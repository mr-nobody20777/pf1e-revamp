// Lasting areas: who is inside a template, creatures entering and leaving, the caster's turns, and the end
// of the spell (Entangle, Stinking Cloud, Cloudkill, Black Tentacles, Solid Fog).

import { createTestActor, cleanup, useTestScene, placeToken, deleteTokens, waitFor } from "./helpers.mjs";
import * as LA from "../lasting-areas.mjs";
import { missChances } from "../miss-chance.mjs";
import { reaches, KIND_FLAG, areaKind } from "../area-reach.mjs";

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
          for (const a of [walker, small, undead]) {
            await a.setConditions({ entangled: false, nauseated: false, grappled: false, dead: false, prone: false });
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
