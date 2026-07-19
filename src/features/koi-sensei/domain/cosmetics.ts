import {
  KOI_DOMAINS,
  KOI_RANKS,
  type KoiCosmetic,
  type KoiCosmeticSlot,
  type KoiDomain,
  type KoiProgressionStateV1,
  type KoiRank,
} from './types';

export const KOI_COSMETIC_SLOT_BY_DOMAIN: Record<KoiDomain, KoiCosmeticSlot> = {
  vocabulary: 'crest',
  grammar: 'face',
  phrases: 'back',
  quizzes: 'hand',
};

export const KOI_STARTER_COSMETICS = [
  { id: 'starter-study-headband', label: 'Study Headband', slot: 'crest', unlock: { kind: 'starter' } },
  { id: 'starter-sunset-shades', label: 'Sunset Shades', slot: 'face', unlock: { kind: 'starter' } },
  { id: 'starter-traveler-pack', label: 'Traveler Pack', slot: 'back', unlock: { kind: 'starter' } },
  { id: 'starter-calligraphy-brush', label: 'Calligraphy Brush', slot: 'hand', unlock: { kind: 'starter' } },
] as const satisfies readonly KoiCosmetic[];

export const KOI_MASTERY_COSMETICS = [
  { id: 'mastery-n5-vocabulary-sakura-pin', label: 'Sakura Pin', slot: 'crest', unlock: { kind: 'mastery', rank: 'N5', domain: 'vocabulary' } },
  { id: 'mastery-n5-grammar-reading-glasses', label: 'Reading Glasses', slot: 'face', unlock: { kind: 'mastery', rank: 'N5', domain: 'grammar' } },
  { id: 'mastery-n5-phrases-scroll-case', label: 'Scroll Case', slot: 'back', unlock: { kind: 'mastery', rank: 'N5', domain: 'phrases' } },
  { id: 'mastery-n5-quizzes-vocab-card-fan', label: 'Vocab Card Fan', slot: 'hand', unlock: { kind: 'mastery', rank: 'N5', domain: 'quizzes' } },
  // IDs remain stable for persisted outfits; labels follow Koi's tanuki identity.
  { id: 'mastery-n4-vocabulary-koi-fin-crest', label: 'Maple Leaf Crest', slot: 'crest', unlock: { kind: 'mastery', rank: 'N4', domain: 'vocabulary' } },
  { id: 'mastery-n4-grammar-blue-reading-lens', label: 'Blue Reading Lens', slot: 'face', unlock: { kind: 'mastery', rank: 'N4', domain: 'grammar' } },
  { id: 'mastery-n4-phrases-koinobori-banner', label: 'Festival Banner', slot: 'back', unlock: { kind: 'mastery', rank: 'N4', domain: 'phrases' } },
  { id: 'mastery-n4-quizzes-folding-fan', label: 'Folding Fan', slot: 'hand', unlock: { kind: 'mastery', rank: 'N4', domain: 'quizzes' } },
  { id: 'mastery-n3-vocabulary-festival-knot', label: 'Festival Knot', slot: 'crest', unlock: { kind: 'mastery', rank: 'N3', domain: 'vocabulary' } },
  { id: 'mastery-n3-grammar-festival-half-mask', label: 'Festival Half-Mask', slot: 'face', unlock: { kind: 'mastery', rank: 'N3', domain: 'grammar' } },
  { id: 'mastery-n3-phrases-paper-parasol', label: 'Paper Parasol', slot: 'back', unlock: { kind: 'mastery', rank: 'N3', domain: 'phrases' } },
  { id: 'mastery-n3-quizzes-paper-crane', label: 'Paper Crane', slot: 'hand', unlock: { kind: 'mastery', rank: 'N3', domain: 'quizzes' } },
  { id: 'mastery-n2-vocabulary-moon-crest', label: 'Moon Crest', slot: 'crest', unlock: { kind: 'mastery', rank: 'N2', domain: 'vocabulary' } },
  { id: 'mastery-n2-grammar-star-spectacles', label: 'Star Spectacles', slot: 'face', unlock: { kind: 'mastery', rank: 'N2', domain: 'grammar' } },
  { id: 'mastery-n2-phrases-moon-cape', label: 'Moon Cape', slot: 'back', unlock: { kind: 'mastery', rank: 'N2', domain: 'phrases' } },
  { id: 'mastery-n2-quizzes-lantern', label: 'Lantern', slot: 'hand', unlock: { kind: 'mastery', rank: 'N2', domain: 'quizzes' } },
  { id: 'mastery-n1-vocabulary-golden-sensei-crest', label: 'Golden Sensei Crest', slot: 'crest', unlock: { kind: 'mastery', rank: 'N1', domain: 'vocabulary' } },
  { id: 'mastery-n1-grammar-golden-monocle', label: 'Golden Monocle', slot: 'face', unlock: { kind: 'mastery', rank: 'N1', domain: 'grammar' } },
  { id: 'mastery-n1-phrases-golden-lesson-banner', label: 'Golden Lesson Banner', slot: 'back', unlock: { kind: 'mastery', rank: 'N1', domain: 'phrases' } },
  { id: 'mastery-n1-quizzes-golden-pointer', label: 'Golden Pointer', slot: 'hand', unlock: { kind: 'mastery', rank: 'N1', domain: 'quizzes' } },
] as const satisfies readonly KoiCosmetic[];

export const KOI_COSMETICS: readonly KoiCosmetic[] = [
  ...KOI_STARTER_COSMETICS,
  ...KOI_MASTERY_COSMETICS,
];

export function getKoiMasteryCosmetic(rank: KoiRank, domain: KoiDomain): KoiCosmetic {
  const cosmetic = KOI_MASTERY_COSMETICS.find(item => (
    item.unlock.rank === rank && item.unlock.domain === domain
  ));
  if (!cosmetic) throw new Error(`Missing Koi mastery cosmetic for ${rank}/${domain}.`);
  return cosmetic;
}

export function getKoiUnlockedCosmetics(state: KoiProgressionStateV1): KoiCosmetic[] {
  const currentRankIndex = KOI_RANKS.indexOf(state.currentRank);
  const earned = KOI_RANKS.slice(0, currentRankIndex + 1).flatMap(rank => (
    KOI_DOMAINS
      .filter(domain => state.rankProgress[rank].domainStars[domain] === 2)
      .map(domain => getKoiMasteryCosmetic(rank, domain))
  ));
  return [...KOI_STARTER_COSMETICS, ...earned];
}
