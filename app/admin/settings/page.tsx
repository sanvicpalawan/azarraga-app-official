import { AppShell } from "@/components/app-shell";
import { SettingsForm } from "@/components/settings-form";
import { getSettings } from "@/lib/documents";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const settings = await getSettings();

  return (
    <AppShell>
      <div className="page-head">
        <div>
          <h1>Settings</h1>
          <p className="page-sub">
            Logo, contact details, currency and the terms printed on every document.
          </p>
        </div>
      </div>

      <SettingsForm settings={settings} />
    </AppShell>
  );
}
