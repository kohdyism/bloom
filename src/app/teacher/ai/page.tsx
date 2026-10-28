import { requireUser } from "@/lib/auth/current-user";
import { myAiSettings } from "@/lib/modules/ai-settings";
import { PageHeader } from "@/components/ui/primitives";
import { AiSettingsForm } from "./ai-settings-form";

export const metadata = { title: "AI settings" };

export default async function AiSettingsPage() {
  const user = await requireUser("teacher");
  const settings = await myAiSettings(user.id);
  return (
    <>
      <PageHeader title="AI settings" description="One place to control Bloom and Pip across all of your lessons. Changes apply straight away, including to lessons that are running." />
      <AiSettingsForm initial={settings} />
    </>
  );
}
