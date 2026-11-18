/** Price after an active promotion campaign: a fixed campaign price wins, otherwise the percentage rounded to cents. */
export function campaignPrice(basePrice: number | null, campaign: { discountPercent: number | null; fixedPriceEur: number | null } | undefined) {
  if (!campaign || basePrice === null) return null;
  if (campaign.fixedPriceEur !== null) return campaign.fixedPriceEur;
  return Math.max(0, Math.round(basePrice * (1 - (campaign.discountPercent ?? 0) / 100) * 100) / 100);
}
