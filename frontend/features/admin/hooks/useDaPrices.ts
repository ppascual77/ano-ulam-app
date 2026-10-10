import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getDaCommodities,
  linkDaCommodity,
  listDaDailyPdfs,
  parseDaDailyPdf,
  saveDaDailyPrices,
  type DaParsedPdf,
} from "@/api/daPrices";
import { adminKeys } from "../queryKeys";

export function useDaDailyPdfs() {
  return useQuery({ queryKey: adminKeys.daPdfs, queryFn: listDaDailyPdfs });
}

export function useParseDaDailyPdf() {
  return useMutation({ mutationFn: (url: string) => parseDaDailyPdf(url) });
}

export function useDaCommodities() {
  return useQuery({ queryKey: adminKeys.daCommodities, queryFn: getDaCommodities });
}

const invalidateDa = (queryClient: ReturnType<typeof useQueryClient>) => {
  queryClient.invalidateQueries({ queryKey: adminKeys.daCommodities });
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
