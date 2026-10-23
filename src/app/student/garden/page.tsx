import { requireUser } from "@/lib/auth/current-user";
import { myGarden } from "@/lib/modules/garden";
import { Garden } from "../garden";

export const metadata = { title: "My garden" };

export default async function GardenPage() {
  const user = await requireUser("student");
  const entries = await myGarden(user.id);
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <Garden entries={entries} heading="h1" />
    </div>
  );
}
