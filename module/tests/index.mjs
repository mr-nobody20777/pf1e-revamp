// PF1e Revamp's Quench test batches. Loaded only when Quench is active.

import { registerTwoWeaponTests } from "./two-weapon.test.mjs";
import { registerShieldBashTests } from "./shield-bash.test.mjs";
import { registerWardTests } from "./wards.test.mjs";
import { registerStudiedTargetTests } from "./studied-target.test.mjs";
import { registerSongTests } from "./songs.test.mjs";
import { registerSolarTests } from "./solar.test.mjs";
import { registerResistanceTests } from "./resistance.test.mjs";
import { registerQuarryTests } from "./quarry.test.mjs";
import { registerTrueStrikeTests } from "./true-strike.test.mjs";
import { registerMissChanceTests } from "./miss-chance.test.mjs";
import { registerArchetypeTests } from "./archetypes.test.mjs";
import { registerSubclassTests } from "./subclass.test.mjs";
import { registerFortuneTests } from "./fortune.test.mjs";
import { registerChannelEnergyTests } from "./channel-energy.test.mjs";
import { registerSpontaneousCastingTests } from "./spontaneous-casting.test.mjs";
import { registerTemporalPoolTests } from "./temporal-pool.test.mjs";
import { registerRaceTests } from "./races.test.mjs";
import { registerSaveBonusTests } from "./save-bonuses.test.mjs";
import { registerTraitTests } from "./traits.test.mjs";
import { registerTalentTests } from "./talents.test.mjs";

export function registerTests(quench) {
  registerTwoWeaponTests(quench);
  registerShieldBashTests(quench);
  registerWardTests(quench);
  registerStudiedTargetTests(quench);
  registerSongTests(quench);
  registerSolarTests(quench);
  registerResistanceTests(quench);
  registerQuarryTests(quench);
  registerTrueStrikeTests(quench);
  registerMissChanceTests(quench);
  registerArchetypeTests(quench);
  registerSubclassTests(quench);
  registerFortuneTests(quench);
  registerChannelEnergyTests(quench);
  registerSpontaneousCastingTests(quench);
  registerTemporalPoolTests(quench);
  registerRaceTests(quench);
  registerSaveBonusTests(quench);
  registerTraitTests(quench);
  registerTalentTests(quench);
}
