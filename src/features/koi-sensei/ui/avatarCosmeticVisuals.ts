import { KOI_COSMETICS, type KoiCosmeticSlot } from '../domain';

export type KoiCosmeticPrimitive = 'crest' | 'glasses' | 'pack' | 'tool';

export interface KoiEquippedCosmeticVisual {
  id: string;
  label: string;
  slot: KoiCosmeticSlot;
  color: string;
  primitive: KoiCosmeticPrimitive;
  symbol: string;
}

const SLOT_VISUALS: Record<KoiCosmeticSlot, Pick<KoiEquippedCosmeticVisual, 'primitive' | 'symbol'>> = {
  crest: { primitive: 'crest', symbol: '紋' },
  face: { primitive: 'glasses', symbol: '眼' },
  back: { primitive: 'pack', symbol: '背' },
  hand: { primitive: 'tool', symbol: '具' },
};

function cosmeticColor(id: string): string {
  if (id.startsWith('mastery-n1-')) return '#FFD54F';
  if (id.startsWith('mastery-n2-')) return '#7986CB';
  if (id.startsWith('mastery-n3-')) return '#CE93D8';
  if (id.startsWith('mastery-n4-')) return '#64B5F6';
  if (id.startsWith('mastery-n5-')) return '#FF8A65';
  return '#FFF3E0';
}

/**
 * Resolves only catalogued, slot-correct cosmetics. Persisted or synced
 * arbitrary identifiers are ignored instead of becoming renderer input.
 */
export function getKoiEquippedCosmeticVisuals(
  equippedCosmeticIds: Partial<Record<KoiCosmeticSlot, string>>,
): KoiEquippedCosmeticVisual[] {
  return (Object.entries(equippedCosmeticIds) as Array<[KoiCosmeticSlot, string]>)
    .flatMap(([slot, id]) => {
      const cosmetic = KOI_COSMETICS.find(item => item.id === id && item.slot === slot);
      if (!cosmetic) return [];
      return [{
        id: cosmetic.id,
        label: cosmetic.label,
        slot,
        color: cosmeticColor(cosmetic.id),
        ...SLOT_VISUALS[slot],
      }];
    })
    .sort((left, right) => left.slot.localeCompare(right.slot));
}

