import { AppShell } from "@/components/layout/app-shell";
import { ProviderManager } from "@/components/providers/provider-manager";

export default function ProvidersSettingsPage() {
  return (
    <AppShell showStudioViewer={false}>
      <ProviderManager />
    </AppShell>
  );
}
