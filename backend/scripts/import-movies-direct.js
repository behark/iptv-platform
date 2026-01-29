#!/usr/bin/env node
/**
 * Direct movie import script
 * Imports movies using known Archive.org identifiers to avoid browse rate limiting
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

const POPULAR_MOVIES = [
  'HisNewJobCharlesChaplin-1915',
  'sex_madness',
  'charlie_chaplin_film_fest',
  'TheFastandtheFuriousJohnIreland1954goofyrip',
  'Return_of_the_Kung_Fu_Dragon',
  'his_girl_friday',
  'VoyagetothePlanetofPrehistoricWomen',
  'house_on_haunted_hill_ipod',
  'JungleBook',
  'reefer_madness1938',
  'Sita_Sings_the_Blues',
  'The_Pied_Piper_of_Hamelin',
  'utopia',
  'nazi_concentration_camps',
  'BloodyPitOfHorror',
  'abraham_lincoln',
  'dressed_to_kill',
  'DiaryofaNudist',
  '3stooges',
  'suddenly',
  'tarzans_revenge',
  'TheStranger_0',
  'Mclintock.avi',
  'mclintok_widescreen',
  'my_favorite_brunette',
  'TheNakedWitch',
  'gullivers_travels1939',
  'ThePhantomoftheOpera',
  'House_On_Haunted_Hill.avi',
  '20000LeaguesUndertheSea',
  'InvasionOfTheBeeGirls',
  'lost_world',
  'Grave_of_the_Vampire_movie',
  'new_adventures_of_tarzan',
  'Killers_from_space',
  'DasKabinettdesDoktorCaligariTheCabinetofDrCaligari',
  'AsYouLikeIt1936',
  'royal_wedding',
  'ScarletStreet',
  'CC_1916_10_02_ThePawnshop',
  'meet_john_doe',
  'TheFlyingDeuces',
  'little_princess',
  'impact',
  'Cyrano_DeBergerac',
  'night_of_the_living_dead',
  'Night_Of_The_Living_Dead',
  'nosferatu_1922',
  'Nosferatu',
  'metropolis1927',
  'Metropolis_1927',
  'plan_9_from_outer_space',
  'Plan9FromOuterSpace',
  'carnival_of_souls',
  'CarnivalOfSouls',
  'dementia_13',
  'Dementia13',
  'the_little_shop_of_horrors',
  'Little_Shop_of_Horrors',
  'the_terror',
  'TheTerror1963',
  'attack_of_the_giant_leeches',
  'AttackOfTheGiantLeeches',
  'teenagers_from_outer_space',
  'TeenagersFromOuterSpace',
  'the_brain_that_wouldnt_die',
  'TheBrainThatWouldntDie',
  'santa_claus_conquers_the_martians',
  'SantaClausConquersTheMartians',
  'manos_the_hands_of_fate',
  'ManosTheHandsOfFate',
  'creature_from_the_haunted_sea',
  'CreatureFromTheHauntedSea',
  'the_wasp_woman',
  'TheWaspWoman',
  'robot_monster',
  'RobotMonster',
  'mesa_of_lost_women',
  'MesaOfLostWomen',
  'the_killer_shrews',
  'TheKillerShrews',
  'the_giant_gila_monster',
  'TheGiantGilaMonster',
  'the_screaming_skull',
  'TheScreamingSkull',
  'detour',
  'Detour1945',
  'DOA_1949',
  'DOA1949',
  'kansas_city_confidential',
  'KansasCityConfidential',
  'the_hitchhiker',
  'TheHitchHiker1953',
  'gun_crazy',
  'GunCrazy',
  'angel_and_the_badman',
  'AngelAndTheBadman',
  'topper',
  'Topper1937',
  'charade',
  'Charade1963'
];

async function getMetadata(identifier) {
  try {
    const response = await axios.get(`https://archive.org/metadata/${identifier}`, {
      timeout: 30000
    });
    return response.data;
  } catch (error) {
    return null;
  }
}

function findVideoFile(files) {
  const videoExtensions = ['.mp4', '.avi', '.mkv', '.ogv', '.webm'];
  const videos = files.filter(f =>
    videoExtensions.some(ext => f.name?.toLowerCase().endsWith(ext)) &&
    f.format !== 'Thumbnail' &&
    !f.name?.includes('_thumb') &&
    !f.name?.includes('_small')
  );

  videos.sort((a, b) => (parseInt(b.size) || 0) - (parseInt(a.size) || 0));
  return videos[0] || null;
}

function parseDuration(runtime) {
  if (!runtime) return null;
  const match = runtime.match(/(\d+)/);
  return match ? parseInt(match[1]) : null;
}

async function importMovie(identifier) {
  const existing = await prisma.video.findFirst({
    where: { sourceType: 'archive', sourceId: identifier }
  });

  if (existing) {
    console.log(`  ⏭️  Skipped (exists): ${identifier}`);
    return { status: 'skipped', identifier };
  }

  const metadata = await getMetadata(identifier);
  if (!metadata?.metadata) {
    console.log(`  ❌ No metadata: ${identifier}`);
    return { status: 'failed', identifier, reason: 'no metadata' };
  }

  const files = metadata.files || [];
  const videoFile = findVideoFile(files);

  if (!videoFile) {
    console.log(`  ❌ No video file: ${identifier}`);
    return { status: 'failed', identifier, reason: 'no video file' };
  }

  const m = metadata.metadata;
  const streamUrl = `https://archive.org/download/${identifier}/${encodeURIComponent(videoFile.name)}`;

  try {
    const video = await prisma.video.create({
      data: {
        title: m.title || identifier,
        description: Array.isArray(m.description) ? m.description[0] : (m.description || ''),
        category: 'Movies',
        videoUrl: streamUrl,
        thumbnail: `https://archive.org/services/img/${identifier}`,
        duration: parseDuration(m.runtime),
        year: m.year ? parseInt(m.year) : null,
        sourceType: 'archive',
        sourceId: identifier,
        isActive: true
      }
    });

    console.log(`  ✅ Imported: ${video.title}`);
    return { status: 'imported', identifier, title: video.title, id: video.id };
  } catch (error) {
    console.log(`  ❌ DB error: ${identifier} - ${error.message}`);
    return { status: 'failed', identifier, reason: error.message };
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('Direct Movie Import from Archive.org');
  console.log('='.repeat(60));
  console.log(`Processing ${POPULAR_MOVIES.length} movies...\n`);

  const stats = { imported: 0, skipped: 0, failed: 0 };

  for (let i = 0; i < POPULAR_MOVIES.length; i++) {
    const identifier = POPULAR_MOVIES[i];
    console.log(`[${i + 1}/${POPULAR_MOVIES.length}] ${identifier}`);

    const result = await importMovie(identifier);
    stats[result.status]++;

    // Rate limiting - wait 2 seconds between requests
    if (i < POPULAR_MOVIES.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('Import Complete!');
  console.log('='.repeat(60));
  console.log(`✅ Imported: ${stats.imported}`);
  console.log(`⏭️  Skipped:  ${stats.skipped}`);
  console.log(`❌ Failed:   ${stats.failed}`);

  await prisma.$disconnect();
}

main().catch(console.error);
