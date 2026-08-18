import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { SoundToggle } from "@/components/sound-toggle";
import { PageHeading } from "@/components/motion/page-heading";
import { updateProfile } from "./actions";
import {
  DEFAULT_PACE,
  NEW_LIMIT_MAX,
  REVIEW_LIMIT_MAX,
} from "@/lib/study-pace";
import type { Profile } from "@/lib/types";

const FIELD =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

// A short list rather than free text: a typo'd zone silently falls back to the
// default and the learner has no way to tell why their day moved.
const COMMON_TIMEZONES = [
  "Asia/Bangkok",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Asia/Singapore",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Los_Angeles",
  "Australia/Sydney",
  "UTC",
];

function hourLabel(h: number): string {
  if (h === 0) return "12:00 AM (midnight)";
  if (h === 12) return "12:00 PM (noon)";
  return h < 12 ? `${h}:00 AM` : `${h - 12}:00 PM`;
}

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
  // Keep a hand-set zone selectable even when it isn't in the short list.
  const timezoneOptions = Array.from(
    new Set([...COMMON_TIMEZONES, p?.study_timezone ?? DEFAULT_PACE.timeZone]),
  );

  return (
    <div className="max-w-xl space-y-6 py-4">
      <PageHeading
        kicker="SETTINGS"
        title="Your profile"
        jp="プロフィール"
        subtitle="This personalizes every answer and lesson. The more the tutor knows about your life and goals, the more meaningful the examples."
      />

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

        <div className="space-y-1.5 border-t border-border pt-4">
          <label htmlFor="ai_engine" className="text-sm font-medium">
            AI engine
          </label>
          <select
            id="ai_engine"
            name="ai_engine"
            defaultValue={p?.ai_engine === "claude" ? "claude" : "gemini"}
            className={FIELD}
          >
            <option value="gemini">Gemini — cheaper (default)</option>
            <option value="claude">Claude — best quality</option>
          </select>
          <p className="text-xs text-muted">
            Controls exercises, kanji mnemonics, deep-dives, the knowledge map,
            review summaries, the study coach, and the Ask Sensei helper. The main
            chat tutor has its own model picker in the chat header, and OCR +
            lesson writing keep their own pickers.
          </p>
        </div>

        <div className="space-y-4 border-t border-border pt-4">
          <div>
            <h2 className="text-sm font-medium">Study pace</h2>
            <p className="mt-1 text-xs text-muted">
              How much you take on each day. Reviews come first and new words are
              woven in between them. Anything over the cap simply waits for
              tomorrow — nothing is lost, and the schedule stays honest.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="daily_new_limit" className="text-sm font-medium">
                New words / day
              </label>
              <input
                id="daily_new_limit"
                name="daily_new_limit"
                type="number"
                min={0}
                max={NEW_LIMIT_MAX}
                step={1}
                defaultValue={p?.daily_new_limit ?? DEFAULT_PACE.newLimit}
                className={FIELD}
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="daily_review_limit"
                className="text-sm font-medium"
              >
                Reviews / day
              </label>
              <input
                id="daily_review_limit"
                name="daily_review_limit"
                type="number"
                min={0}
                max={REVIEW_LIMIT_MAX}
                step={5}
                defaultValue={p?.daily_review_limit ?? DEFAULT_PACE.reviewLimit}
                className={FIELD}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="study_timezone" className="text-sm font-medium">
                Time zone
              </label>
              <select
                id="study_timezone"
                name="study_timezone"
                defaultValue={p?.study_timezone ?? DEFAULT_PACE.timeZone}
                className={FIELD}
              >
                {timezoneOptions.map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="day_start_hour" className="text-sm font-medium">
                Day starts at
              </label>
              <select
                id="day_start_hour"
                name="day_start_hour"
                defaultValue={String(
                  p?.day_start_hour ?? DEFAULT_PACE.dayStartHour,
                )}
                className={FIELD}
              >
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={String(h)}>
                    {hourLabel(h)}
                    {h === DEFAULT_PACE.dayStartHour ? " (recommended)" : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <p className="text-xs text-muted">
            A study day rolls over at this hour, so a session running past
            midnight still counts as the same day. Practice tests count toward
            your daily reviews too, since they schedule the same words.
          </p>
        </div>

        <Button type="submit">Save profile</Button>
      </form>

      <div className="space-y-2 border-t border-border pt-6">
        <h2 className="text-sm font-medium">Device preferences</h2>
        <p className="text-xs text-muted">
          Saved on this device. Tap sounds &amp; vibration give quick feedback
          when you tap buttons and flip flashcards.
        </p>
        <SoundToggle />
      </div>
    </div>
  );
}
