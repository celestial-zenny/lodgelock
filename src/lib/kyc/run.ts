import "server-only";
import type { MarketplaceClient } from "@/lib/interswitch/marketplace";
import type { KycDetailsInput } from "./schema";

export type KycResults = { nin: boolean; bvn: boolean | null; bank: boolean | null };

/**
 * Runs the checks in order: NIN -> BVN Boolean Match -> bank account. Stops at the first failure so
 * we don't send more identifiers to a provider than needed (NDPA data minimisation). A skipped check is null.
 * Throws MarketplaceError on outages, so an outage is never recorded as a fail.
 *
 * The identifiers live only in this call's arguments; nothing here logs or returns them.
 */
export async function runKycChecks(
  client: MarketplaceClient,
  name: { firstName: string; lastName: string },
  details: KycDetailsInput,
): Promise<KycResults> {
  const nin = (await client.verifyNin({ nin: details.nin, ...name })).passed;
  if (!nin) return { nin, bvn: null, bank: null };

  const bvn = (await client.bvnBooleanMatch({ bvn: details.bvn, ...name })).passed;
  if (!bvn) return { nin, bvn, bank: null };

  const bank = (
    await client.verifyBankAccount({ accountNumber: details.accountNumber, bankCode: details.bankCode, ...name })
  ).passed;
  return { nin, bvn, bank };
}
