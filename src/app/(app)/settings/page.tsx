import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { updateProfile } from "./actions";
import type { Profile } from "@/lib/types";

const FIELD =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user!.id)
    .maybeSingle();
  const p = data as Profile | null;

  return (
    <div className="max-w-xl space-y-6 py-4">
      <div>
        <h1 className="text-xl font-semibold">Your profile</h1>
        <p className="mt-1 text-sm text-muted">
          This personalizes every answer and lesson. The more the tutor knows
          about your life and goals, the more meaningful the examples.
        </p>
      </div>

      <form action={updateProfile} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="display_name" className="text-sm font-medium">
            Display name
          </label>
          <input
            id="display_name"
            name="display_name"
            defaultValue={p?.display_name ?? ""}
            className={FIELD}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="jlpt_target" className="text-sm font-medium">
              JLPT target
            </label>
            <select
              id="jlpt_target"
              name="jlpt_target"
              defaultValue={p?.jlpt_target ?? "N2"}
              className={FIELD}
            >
              {["N1", "N2", "N3"].map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="native_language" className="text-sm font-medium">
              Native language
            </label>
            <input
              id="native_language"
              name="native_language"
              defaultValue={p?.native_language ?? "Thai"}
              className={FIELD}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="interests" className="text-sm font-medium">
            Interests & life context
          </label>
          <textarea
            id="interests"
            name="interests"
            rows={5}
            defaultValue={p?.interests ?? ""}
            placeholder="e.g. Manga artist active on X with Japanese illustrators; background in English-language teaching; into music; follow lots of world news — politics, crime, science, technology, food. Love character design and casual online conversation."
            className={FIELD}
          />
          <p className="text-xs text-muted">
            Used to make examples relevant to your real life. Anything you add
            here is combined with your core background; the tutor also draws on a
            wide range of real-world JLPT topics.
          </p>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="tone" className="text-sm font-medium">
            Preferred tone (optional)
          </label>
          <input
            id="tone"
            name="tone"
            defaultValue={p?.tone ?? ""}
            placeholder="e.g. friendly but precise; challenge me"
            className={FIELD}
          />
        </div>

        <Button type="submit">Save profile</Button>
      </form>
    </div>
  );
}
