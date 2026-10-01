<script lang="ts">
  // Profile (it shapes Sensei's examples and mnemonics), study pace (the daily
  // budget the review queue works to), and per-device preferences.
  import { onMount } from 'svelte';
  import { sb, requireUser } from '../../lib/supabase';
  import { DEFAULT_PACE, NEW_LIMIT_MAX, REVIEW_LIMIT_MAX, clampNewLimit, clampReviewLimit, resetStudyPace } from '../../lib/pace';
  import { resolveDayStartHour, resolveTimeZone } from '../../lib/study-day';
  import { prefs } from '../../lib/prefs.svelte';
  import { clearDue, loadDue } from '../../lib/due';
  import { clearSession } from '../../lib/review-session';
  import { pendingCount, flush } from '../../lib/outbox';
  import { playTap } from '../../lib/sound';
  import { arrive } from '../../lib/mv';

  // A short list, not free text: a mistyped zone would silently fall back and
  // the day would move for no visible reason.
  const ZONES = [
    'Asia/Bangkok',
    'Asia/Tokyo',
    'Asia/Seoul',
    'Asia/Singapore',
    'Europe/London',
    'Europe/Berlin',
    'America/New_York',
    'America/Los_Angeles',
    'Australia/Sydney',
    'UTC',
  ];
  const hourLabel = (h: number) =>
    h === 0 ? '12:00 AM (midnight)' : h === 12 ? '12:00 PM (noon)' : h < 12 ? `${h}:00 AM` : `${h - 12}:00 PM`;

  let phase = $state<'loading' | 'ready' | 'error'>('loading');
  let userId = '';
  let email = $state('');
  let form = $state({
    display_name: '',
    jlpt_target: 'N2',
    native_language: 'Thai',
    interests: '',
    tone: '',
    daily_new_limit: DEFAULT_PACE.newLimit,
    daily_review_limit: DEFAULT_PACE.reviewLimit,
    study_timezone: DEFAULT_PACE.timeZone,
    day_start_hour: DEFAULT_PACE.dayStartHour,
  });
  let saving = $state(false);
  let status = $state<{ ok: boolean; msg: string } | null>(null);
  let paperTone = $state(false);

  const zones = $derived([...new Set([...ZONES, form.study_timezone])]);

  onMount(async () => {
    try {
      paperTone = localStorage.getItem('tone') === 'paper';
    } catch {}
    try {
      const user = await requireUser();
      userId = user.id;
      email = user.email ?? '';
      const { data, error } = await sb()
        .from('profiles')
        .select('display_name,jlpt_target,native_language,interests,tone,daily_new_limit,daily_review_limit,study_timezone,day_start_hour')
        .eq('id', user.id)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        form = {
          display_name: data.display_name ?? '',
          jlpt_target: data.jlpt_target ?? 'N2',
          native_language: data.native_language ?? 'Thai',
          interests: data.interests ?? '',
          tone: data.tone ?? '',
          daily_new_limit: clampNewLimit(data.daily_new_limit),
          daily_review_limit: clampReviewLimit(data.daily_review_limit),
          study_timezone: resolveTimeZone(data.study_timezone),
          day_start_hour: resolveDayStartHour(data.day_start_hour),
        };
      }
      phase = 'ready';
    } catch (e) {
      console.error(e);
      phase = 'error';
    }
  });

  async function save(e: SubmitEvent) {
    e.preventDefault();
    if (saving) return;
    saving = true;
    status = null;
    const s = (v: string) => v.trim() || null;
    const { error } = await sb()
      .from('profiles')
      .upsert({
        id: userId,
        display_name: s(form.display_name),
        jlpt_target: s(form.jlpt_target) ?? 'N2',
        native_language: s(form.native_language) ?? 'Thai',
        interests: s(form.interests),
        tone: s(form.tone),
        daily_new_limit: clampNewLimit(form.daily_new_limit),
        daily_review_limit: clampReviewLimit(form.daily_review_limit),
        study_timezone: resolveTimeZone(form.study_timezone),
        day_start_hour: resolveDayStartHour(form.day_start_hour),
        updated_at: new Date().toISOString(),
      });
    saving = false;
    if (error) {
      status = { ok: false, msg: "Couldn't save — try again." };
      return;
    }
    // Today's plan depends on the pace: drop everything computed from the old one.
    resetStudyPace();
    clearDue();
    clearSession();
    void loadDue(() => {});
    playTap();
    status = { ok: true, msg: 'Saved.' };
  }

  function setTone(paper: boolean) {
    paperTone = paper;
    try {
      if (paper) localStorage.setItem('tone', 'paper');
      else localStorage.removeItem('tone');
    } catch {}
    if (paper) document.documentElement.dataset.tone = 'paper';
    else delete document.documentElement.dataset.tone;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', paper ? '#e9e4d8' : '#0c0c0d');
  }

  let signingOut = $state(false);
  async function signOut() {
    signingOut = true;
    // Grades still queued would be lost with the session; try once more.
    if (pendingCount()) await flush();
    if (pendingCount() && !confirm(`${pendingCount()} review(s) haven't synced yet and will be lost. Sign out anyway?`)) {
      signingOut = false;
      return;
    }
    await sb().auth.signOut();
    clearDue();
    clearSession();
    location.replace('/login');
  }
</script>

<header class="head">
  <p class="mono">設定 · Settings</p>
  <h1 class="head__title" use:arrive>Your profile</h1>
  <p class="head__sub">Sensei uses this to make examples and mnemonics about your life. The study pace sets how much review you get each day.</p>
</header>

{#if phase === 'loading'}
  <p><span class="spin dim"></span></p>
{:else if phase === 'error'}
  <p class="dim">Couldn't load your profile. Check the connection and reload.</p>
{:else}
  <form class="form" onsubmit={save}>
    <label class="field"><span>Display name</span><input bind:value={form.display_name} autocomplete="nickname" /></label>
    <div class="two">
      <label class="field">
        <span>JLPT target</span>
        <select bind:value={form.jlpt_target}>
          {#each ['N1', 'N2', 'N3'] as l (l)}<option value={l}>{l}</option>{/each}
        </select>
      </label>
      <label class="field"><span>Native language</span><input bind:value={form.native_language} /></label>
    </div>
    <label class="field">
      <span>Interests &amp; life context</span>
      <textarea rows="5" bind:value={form.interests} placeholder="e.g. Manga artist on X with Japanese illustrators; English-teaching background; music; world news…"></textarea>
      <small>Added to your core background, so examples land close to your real life.</small>
    </label>
    <label class="field"><span>Preferred tone (optional)</span><input bind:value={form.tone} placeholder="friendly but precise; challenge me" /></label>

    <hr class="rule" />
    <div>
      <h2 class="mono">Study pace</h2>
      <p class="dim note">
        How much you take on each day. Reviews come first and new words are woven in between them. Anything over the cap waits for tomorrow —
        nothing is lost, and the schedule stays honest.
      </p>
    </div>
    <div class="two">
      <label class="field">
        <span>New words / day</span>
        <input type="number" min="0" max={NEW_LIMIT_MAX} step="1" bind:value={form.daily_new_limit} inputmode="numeric" />
      </label>
      <label class="field">
        <span>Reviews / day</span>
        <input type="number" min="0" max={REVIEW_LIMIT_MAX} step="5" bind:value={form.daily_review_limit} inputmode="numeric" />
      </label>
    </div>
    <div class="two">
      <label class="field">
        <span>Time zone</span>
        <select bind:value={form.study_timezone}>
          {#each zones as z (z)}<option value={z}>{z}</option>{/each}
        </select>
      </label>
      <label class="field">
        <span>Day starts at</span>
        <select bind:value={form.day_start_hour}>
          {#each Array.from({ length: 24 }, (_, h) => h) as h (h)}
            <option value={h}>{hourLabel(h)}{h === DEFAULT_PACE.dayStartHour ? ' (recommended)' : ''}</option>
          {/each}
        </select>
      </label>
    </div>
    <p class="faint note">A study day rolls over at this hour, so a session past midnight still counts as the same day.</p>

    <div class="actions">
      <button type="submit" class="btn btn--lead" disabled={saving}>{#if saving}<span class="spin"></span>{/if} Save</button>
      {#if status}<span class="status" class:bad={!status.ok}>{status.msg}</span>{/if}
    </div>
  </form>

  <hr class="rule gap" />
  <section class="device">
    <h2 class="mono">This device</h2>
    <div class="row">
      <span>Page</span>
      <div class="chips">
        <button type="button" class="chip" aria-pressed={!paperTone} onclick={() => setTone(false)}>Ink</button>
        <button type="button" class="chip" aria-pressed={paperTone} onclick={() => setTone(true)}>Paper</button>
      </div>
    </div>
    <div class="row">
      <span>Tap sounds &amp; vibration</span>
      <button type="button" class="chip" aria-pressed={prefs.sound} onclick={() => prefs.setSound(!prefs.sound)}>{prefs.sound ? 'On' : 'Off'}</button>
    </div>
    <div class="row">
      <span>Pitch-accent marks</span>
      <button type="button" class="chip" aria-pressed={prefs.pitch} onclick={() => prefs.setPitch(!prefs.pitch)}>{prefs.pitch ? 'On' : 'Off'}</button>
    </div>
  </section>

  <hr class="rule gap" />
  <section class="device">
    <h2 class="mono">Account</h2>
    <div class="row">
      <span class="dim">{email}</span>
      <button type="button" class="btn btn--sm" disabled={signingOut} onclick={signOut}>Sign out</button>
    </div>
  </section>
{/if}

<style>
  .form {
    display: grid;
    gap: 1rem;
  }
  .two {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.9rem;
  }
  @media (max-width: 420px) {
    .two {
      grid-template-columns: 1fr;
    }
  }
  .note {
    margin-top: 0.35rem;
    font-size: 0.85rem;
  }
  .rule {
    margin: 0.6rem 0;
  }
  .rule.gap {
    margin: 2rem 0 1.4rem;
  }
  .actions {
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  .status {
    font-size: 0.85rem;
    color: var(--m-mastered);
  }
  .status.bad {
    color: var(--r-again);
  }
  .device {
    display: grid;
    gap: 0.9rem;
  }
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    font-size: 0.92rem;
  }
</style>
