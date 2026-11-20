// api/dailyUsage without the network: the guest path never calls these.
export const countDailyUse = async () => ({ allowed: true, left: null });
export const getDailyUsesLeft = async () => null;
