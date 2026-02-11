#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const COUNTRY_CODE_MAP = {
  gb: 'UK',
  uk: 'UK',
  xk: 'XK'
};

const ALLOWED_COUNTRIES = new Set([
  'AL', 'XK', 'MK', 'ME', 'RS', 'BA', 'HR', 'SI', 'BG', 'RO', 'GR',
  'US', 'UK', 'DE', 'FR', 'ES', 'IT', 'IN', 'BR', 'MX', 'CA', 'AU',
  'JP', 'KR', 'RU', 'TR', 'AE', 'SA', 'EG', 'CN', 'NZ'
]);

// ccTLDs with relatively high confidence as direct geo signals.
const SAFE_TLDS = new Set([
  'al', 'xk', 'mk', 'rs', 'ba', 'hr', 'si', 'bg', 'ro', 'gr',
  'de', 'fr', 'es', 'it', 'ru', 'tr', 'ae', 'sa', 'eg', 'cn',
  'jp', 'kr', 'au', 'nz', 'ca', 'mx', 'br', 'in', 'uk'
]);

// Avoid repurposed/ambiguous ccTLDs for country inference.
const EXCLUDED_TLDS = new Set(['tv', 'io', 'fm', 'cc', 'co', 'ws', 'to', 'ai', 'me']);

const NAME_HINTS = [
  { country: 'XK', score: 4, reason: 'name-kosovo', regex: /\b(kosov[aoë]?|prishtin[ae]|gjakov[ae]|mitrovic[ae]|dukagjini|rtk)\b/i },
  { country: 'AL', score: 4, reason: 'name-albania', regex: /\b(albania|shqip(eri|ëria)?|tiran[ae]|rtsh|top channel|klan)\b/i },
  { country: 'MK', score: 4, reason: 'name-macedonia', regex: /\b(macedonia|macedon(i[aj]|ski)|mrt)\b/i },
  { country: 'ME', score: 4, reason: 'name-montenegro', regex: /\b(montenegro|crna gora|rtcg)\b/i },
  { country: 'RS', score: 4, reason: 'name-serbia', regex: /\b(serbia|srbija|rts\s*[1-3]?)\b/i },
  { country: 'BA', score: 4, reason: 'name-bosnia', regex: /\b(bosnia|herzegovina|bht\s*1|rtrs|ftv)\b/i },
  { country: 'HR', score: 4, reason: 'name-croatia', regex: /\b(croatia|hrvatska|hrt\s*[1-4]?)\b/i },
  { country: 'SI', score: 4, reason: 'name-slovenia', regex: /\b(slovenia|slovenija|rtv slo)\b/i },
  { country: 'BG', score: 4, reason: 'name-bulgaria', regex: /\b(bulgaria|bulgaria|bnt\s*[1-4]?)\b/i },
  { country: 'RO', score: 4, reason: 'name-romania', regex: /\b(romania|rom[aâ]nia|tvr\s*[1-3]?)\b/i },
  { country: 'GR', score: 4, reason: 'name-greece', regex: /\b(greece|ellada|ert)\b/i }
];

function parseArgs(argv) {
  const args = argv.slice(2);
  const hasFlag = (name) => args.includes(`--${name}`);
  const getValue = (name, fallback) => {
    const inline = args.find((arg) => arg.startsWith(`--${name}=`));
    if (inline) {
      const value = inline.split('=').slice(1).join('=');
      return value || fallback;
    }
    const index = args.indexOf(`--${name}`);
    if (index !== -1 && args[index + 1] && !args[index + 1].startsWith('--')) {
      return args[index + 1];
    }
    return fallback;
  };

  const limitValue = Number.parseInt(getValue('limit', '50000'), 10);
  const minScoreValue = Number.parseInt(getValue('min-score', '4'), 10);
  const reportArg = getValue('report', null);

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const defaultReport = path.resolve(__dirname, '../../logs', `unknown-country-normalization-${stamp}.json`);

  return {
    apply: hasFlag('apply'),
    disallowHostOnly: hasFlag('disallow-host-only'),
    limit: Number.isInteger(limitValue) && limitValue > 0 ? limitValue : 50000,
    minScore: Number.isInteger(minScoreValue) && minScoreValue > 0 ? minScoreValue : 4,
    reportPath: reportArg ? path.resolve(reportArg) : defaultReport
  };
}

function normalizeCountryCode(code) {
  if (!code) return null;
  const lower = String(code).trim().toLowerCase();
  if (!lower) return null;
  const mapped = COUNTRY_CODE_MAP[lower] || lower.toUpperCase();
  return ALLOWED_COUNTRIES.has(mapped) ? mapped : null;
}

function addVote(votes, country, score, reason) {
  const normalizedCountry = normalizeCountryCode(country);
  if (!normalizedCountry) return;
  if (!votes.has(normalizedCountry)) {
    votes.set(normalizedCountry, { score: 0, reasons: [] });
  }
  const entry = votes.get(normalizedCountry);
  entry.score += score;
  entry.reasons.push(reason);
}

function inferFromEpgId(channel, votes) {
  if (!channel.epgId) return;
  const epgId = String(channel.epgId).trim();
  if (!epgId) return;

  const suffixMatch = epgId.match(/\.([a-z]{2})$/i);
  if (suffixMatch) {
    addVote(votes, suffixMatch[1], 5, 'epg-suffix');
  }
}

function inferFromStreamHost(channel, votes) {
  if (!channel.streamUrl) return;
  let parsed;
  try {
    parsed = new URL(channel.streamUrl);
  } catch {
    return;
  }

  const host = parsed.hostname.toLowerCase();
  const labels = host.split('.');
  if (labels.length < 2) return;

  const tld = labels[labels.length - 1];
  if (EXCLUDED_TLDS.has(tld)) return;
  if (SAFE_TLDS.has(tld)) {
    addVote(votes, tld, 4, 'host-tld');
  }
}

function inferFromName(channel, votes) {
  const name = String(channel.name || '');
  for (const hint of NAME_HINTS) {
    if (hint.regex.test(name)) {
      addVote(votes, hint.country, hint.score, hint.reason);
    }
  }
}

function chooseSuggestion(channel, options) {
  const { minScore, disallowHostOnly } = options;
  const votes = new Map();
  inferFromEpgId(channel, votes);
  inferFromStreamHost(channel, votes);
  inferFromName(channel, votes);

  if (votes.size === 0) return null;

  const ranked = Array.from(votes.entries())
    .map(([country, details]) => ({ country, ...details }))
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  if (!best || best.score < minScore) return null;

  if (ranked[1] && ranked[1].score === best.score && ranked[1].country !== best.country) {
    return null;
  }

  const confidence = Math.min(99, 60 + (best.score * 8));
  if (disallowHostOnly && best.reasons.length === 1 && best.reasons[0] === 'host-tld') {
    return null;
  }

  return {
    id: channel.id,
    name: channel.name,
    from: channel.country || 'Unknown',
    to: best.country,
    score: best.score,
    confidence,
    reasons: best.reasons
  };
}

async function writeReport(reportPath, payload) {
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, JSON.stringify(payload, null, 2), 'utf8');
}

async function main() {
  const opts = parseArgs(process.argv);
  console.log('=== Unknown Country Normalization ===');
  console.log(`Mode: ${opts.apply ? 'APPLY' : 'DRY-RUN'}`);
  console.log(`Limit: ${opts.limit}`);
  console.log(`Min score: ${opts.minScore}`);
  console.log(`Disallow host-only: ${opts.disallowHostOnly ? 'yes' : 'no'}`);

  const candidates = await prisma.channel.findMany({
    where: {
      isActive: true,
      OR: [
        { country: null },
        { country: '' },
        { country: 'INT' },
        { country: 'Unknown' },
        { country: 'UNKNOWN' }
      ]
    },
    select: {
      id: true,
      name: true,
      country: true,
      epgId: true,
      streamUrl: true
    },
    take: opts.limit
  });

  console.log(`Candidates loaded: ${candidates.length}`);

  const suggestions = [];
  for (const channel of candidates) {
    const suggestion = chooseSuggestion(channel, opts);
    if (suggestion) suggestions.push(suggestion);
  }

  const byCountry = suggestions.reduce((acc, row) => {
    acc[row.to] = (acc[row.to] || 0) + 1;
    return acc;
  }, {});
  const byReason = {};
  const byReasonCombo = {};
  for (const row of suggestions) {
    for (const reason of row.reasons) {
      byReason[reason] = (byReason[reason] || 0) + 1;
    }
    const combo = [...row.reasons].sort().join('+');
    byReasonCombo[combo] = (byReasonCombo[combo] || 0) + 1;
  }

  console.log(`High-confidence suggestions: ${suggestions.length}`);
  const sortedCountries = Object.entries(byCountry).sort((a, b) => b[1] - a[1]);
  for (const [country, count] of sortedCountries.slice(0, 20)) {
    console.log(`  ${country}: ${count}`);
  }

  let applied = 0;
  if (opts.apply && suggestions.length > 0) {
    const batchSize = 300;
    for (let i = 0; i < suggestions.length; i += batchSize) {
      const batch = suggestions.slice(i, i + batchSize);
      await prisma.$transaction(
        batch.map((row) =>
          prisma.channel.update({
            where: { id: row.id },
            data: { country: row.to }
          })
        )
      );
      applied += batch.length;
      console.log(`Applied ${applied}/${suggestions.length}`);
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    mode: opts.apply ? 'apply' : 'dry-run',
    limit: opts.limit,
    minScore: opts.minScore,
    disallowHostOnly: opts.disallowHostOnly,
    totals: {
      candidates: candidates.length,
      suggestions: suggestions.length,
      applied
    },
    byCountry,
    byReason,
    byReasonCombo,
    sample: suggestions.slice(0, 200)
  };

  await writeReport(opts.reportPath, report);
  console.log(`Report: ${opts.reportPath}`);
  if (!opts.apply) {
    console.log('No DB updates were applied.');
  }
}

main()
  .catch((error) => {
    console.error('Normalization failed:', error.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
