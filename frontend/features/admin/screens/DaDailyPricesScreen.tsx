import { useState } from "react";
import { View } from "react-native";
import { SegmentedSwitch, Screen } from "@/frontend/components/ui";
import { DaImportPanel } from "../components/DaImportPanel";
import { DaLinkPanel } from "../components/DaLinkPanel";
import { AdminHeader } from "../components/AdminHeader";

type Tab = "import" | "link";

export default function DaDailyPricesScreen() {
  const [tab, setTab] = useState<Tab>("import");

  return (
    <Screen padded={false}>
      <AdminHeader title="DA Daily Prices" />

      <View className="mb-4 items-start px-5">
        <SegmentedSwitch<Tab> size="md" options={[{ value: "import", label: "Import" }, { value: "link", label: "Link to ingredients" }]} value={tab} onChange={setTab} />
      </View>

      {tab === "import" ? <DaImportPanel /> : <DaLinkPanel />}
    </Screen>
  );
}
