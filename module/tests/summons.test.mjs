// Summons: the spells' tables against the Summons compendium, the celestial and fiendish templates, and summoned
// creatures vanishing (with their temporary actors) when the spell ends.

import { useTestScene, waitFor, createTestActor, cleanup, placeToken, deleteTokens } from "./helpers.mjs";
import { turnActors } from "../util.mjs";
import { _test as S, summonsActive } from "../summons.mjs";

const MODULE_ID = "pf1e-revamp";

export function registerSummonTests(quench) {
  quench.registerBatch(
    "pf1e-revamp.summons",
    (context) => {
      const { describe, it, assert, before, after } = context;

      describe("Summons", function () {
        this.timeout(60000);
        let pack, ctl;
        const creature = async (name) => pack.getDocument(pack.index.find((e) => e.name === name)._id);

        before(async function () {
          pack = game.packs.get(`${MODULE_ID}.summons`);
          if (!pack) this.skip();
          await pack.getIndex();
          ctl = await useTestScene();
        });
        after(async () => {
          await ctl?.restore();
        });

        it("reads the summoning spells and finds every creature of their tables in the compendium", () => {
          assert.deepEqual(S.summonSpell("Summon Monster IV"), { list: "monster", level: 4 });
          assert.deepEqual(S.summonSpell("Summon Nature's Ally IX"), { list: "nature", level: 9 });
          assert.isNull(S.summonSpell("Summon Swarm"));
          const names = new Set(pack.index.map((e) => e.name));
          const missing = Object.values(S.LISTS).flatMap((list) => list.flatMap((level) => (level ?? []).map(([n]) => n))).filter((n) => !names.has(n));
          assert.deepEqual([...new Set(missing)], []);
          assert.equal(S.closeRange(5), 35, "close range at caster level 5");
        });

        it("celestial template: resistances and DR by Hit Dice, SR = CR + 5, darkvision, smite evil", async () => {
          const wolf = S.templateData(await creature("Wolf"), "celestial"); // 2 HD, CR 1
          assert.equal(wolf.name, "Celestial Wolf");
          assert.sameMembers(wolf.system.traits.eres.value.filter((r) => r.amount === 5).map((r) => r.types[0]), ["acid", "cold", "electric"]);
          assert.notOk(wolf.system.traits.dr?.value?.some((d) => d.types.includes("evil")), "no DR under 5 HD");
          assert.equal(wolf.system.attributes.sr.formula, "6");
          assert.equal(wolf.system.traits.senses.dv.value, 60);
          assert.equal(wolf.item.name, "Smite Evil (Celestial)");
          const bear = S.templateData(await creature("Dire Bear"), "fiendish"); // 10 HD, CR 7
          assert.sameMembers(bear.system.traits.eres.value.filter((r) => r.amount === 10).map((r) => r.types[0]), ["cold", "fire"]);
          assert.ok(bear.system.traits.dr.value.some((d) => d.amount === 5 && d.types.includes("good")));
          assert.equal(bear.system.attributes.sr.formula, "13", "CR 7 + 1 for 5 or more HD, + 5");
        });

        it("a summoned creature's turn is its summoner's: what starts on its turn happens then", async function () {
          const caster = await createTestActor("Quench Summoner");
          const dog = await createTestActor("Quench Summoned Dog");
          const tokens = [await placeToken(caster, 1, 1), await placeToken(dog, 2, 1)];
          await dog.setFlag(MODULE_ID, S.FLAG, { summoner: caster.uuid, endsAt: null });
          const combat = await Combat.create({ scene: canvas.scene.id });
          try {
            const [c] = await combat.createEmbeddedDocuments("Combatant", [{ tokenId: tokens[0].id, sceneId: canvas.scene.id, initiative: 10 }]);
            assert.sameMembers(turnActors(combat, c).map((a) => a.id), [caster.id, dog.id]);
          } finally {
            await combat.delete();
            await deleteTokens(tokens);
            await cleanup([caster, dog], new Set(game.messages.keys()));
          }
        });

        it("a summoned creature vanishes when the spell ends, and its temporary actor with it", async function () {
          if (!summonsActive() || !game.tcal) this.skip();
          const actor = await game.tcal.importTransientActor(pack.index.find((e) => e.name === "Dog").uuid, { preferExisting: false }, {});
          await actor.setFlag(MODULE_ID, S.FLAG, { summoner: null, spell: "Summon Monster I", endsAt: game.time.worldTime + 1 });
          const token = (await actor.getTokenDocument({ x: canvas.dimensions.sceneX, y: canvas.dimensions.sceneY })).toObject();
          const [doc] = await canvas.scene.createEmbeddedDocuments("Token", [token]);
          await game.time.advance(6);
          await waitFor(() => !canvas.scene.tokens.has(doc.id), { what: "the token gone" });
          await waitFor(() => !game.actors.has(actor.id), { what: "the temporary actor gone" });
        });
      });
    },
    { displayName: "PF1e Revamp: Summons" },
  );
}
