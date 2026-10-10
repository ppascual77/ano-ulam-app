import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getDaCommodities,
  getSavedPriceDates,
  linkDaCommodity,
  listDaDailyPdfs,
  parseDaDailyPdf,
  saveDaDailyPrices,
  type DaParsedPdf,
} from "@/api/daPrices";
import { adminKeys } from "../queryKeys";

// No automatic retries: a slow DA site would otherwise keep the screen
// spinning through several long attempts. The panel shows the error and a
// Retry button instead.
export function useDaDailyPdfs() {
  return useQuery({ queryKey: adminKeys.daPdfs, queryFn: listDaDailyPdfs, retry: false, staleTime: 10 * 60 * 1000 });
}

export function useParseDaDailyPdf() {
  return useMutation({ mutationFn: (url: string) => parseDaDailyPdf(url) });
}

export function useSavedPriceDates(dates: string[]) {
  return useQuery({
    queryKey: [...adminKeys.daSavedDates, dates] as const,
    queryFn: () => getSavedPriceDates(dates),
    enabled: dates.length > 0,
  });
}

export function useDaCommodities() {
  return useQuery({ queryKey: adminKeys.daCommodities, queryFn: getDaCommodities });
}

const invalidateDa = (queryClient: ReturnType<typeof useQueryClient>) => {
  queryClient.invalidateQueries({ queryKey: adminKeys.daCommodities });
  queryClient.invalidateQueries({ queryKey: adminKeys.daSavedDates });
  // Price Watch and Home's best value meals read the same prices.
  queryClient.invalidateQueries({ queryKey: ["prices"] });
};

export function useSaveDaDailyPrices() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ parsed, sourceUrl }: { parsed: DaParsedPdf; sourceUrl: string }) =>
      saveDaDailyPrices(parsed, sourceUrl),
    onSuccess: () => invalidateDa(queryClient),
  });
}

export function useLinkDaCommodity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ commodityId, ingredientId }: { commodityId: string; ingredientId: string | null }) =>
      linkDaCommodity(commodityId, ingredientId),
    onSuccess: () => invalidateDa(queryClient),
  });
}
