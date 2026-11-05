import { AppShell } from "@/components/app-shell";
import { AssistantSettings, DataOrganizer } from "@/components/assistant-panel";
export const dynamic = "force-dynamic";
export default function AssistantPage() {
  return <AppShell><div className="page-head"><div><h1>Data Assistant</h1><p className="page-sub">Your real drawings and product data, organized with free OpenRouter models.</p></div></div><AssistantSettings /><DataOrganizer /></AppShell>;
}
