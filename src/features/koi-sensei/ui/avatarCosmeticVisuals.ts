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
  crest: { primitive: 'crest', symbol: '結' },
  face: { primitive: 'glasses', symbol: '光' },
  back: { primitive: 'pack', symbol: '旅' },
  hand: { primitive: 'tool', symbol: '筆' },
};

const SYMBOL_BY_ID_FRAGMENT: ReadonlyArray<readonly [string, string]> = [
  ['sakura', '桜'],
  ['moon', '月'],
  ['golden', '金'],
  ['festival', '祭'],
  ['headband', '結'],
  ['shades', '夕'],
  ['glasses', '読'],
  ['lens', '青'],
  ['spectacles', '星'],
  ['monocle', '金'],
  ['scroll', '巻'],
  ['banner', '旗'],
  ['parasol', '傘'],
  ['cape', '月'],
  ['pack', '旅'],
  ['brush', '筆'],
  ['fan', '扇'],
  ['crane', '鶴'],
  ['lantern', '灯'],
  ['pointer', '指'],
];

function cosmeticSymbol(id: string, slot: KoiCosmeticSlot): string {
  return SYMBOL_BY_ID_FRAGMENT.find(([fragment]) => id.includes(fragment))?.[1]
    ?? SLOT_VISUALS[slot].symbol;
}

function cosmeticColor(id: string): string {
  if (id.startsWith('mastery-n1-')) return '#FFD54F';
  if (id.startsWith('mastery-n2-')) return '#7986CB';
  if (id.startsWith('mastery-n3-')) return '#CE93D8';
  if (id.startsWith('mastery-n4-')) return '#64B5F6';
  if (id.startsWith('mastery-n5-')) return '#FF8A65';
  if (id.includes('shades')) return '#FFB86B';
  if (id.includes('headband')) return '#E85D75';
  if (id.includes('pack')) return '#70A37F';
  if (id.includes('brush')) return '#D8B26E';
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
        symbol: cosmeticSymbol(cosmetic.id, slot),
      }];
    })
    .sort((left, right) => left.slot.localeCompare(right.slot));
}
