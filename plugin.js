// Control room: how Sunnn is going today, beside the chats.
// Read only. Every number comes from the hash-pinned reader command
// (~/.buzz/bin/sunnn-control-room-read), which runs one query on the live CRM
// as the read-only role claude_ro and reads the inbox triage ledger. A tile
// with no trustworthy number says "not measured", never a guess.
// Styling uses Buzz design tokens so it follows the app's theme.

export const inject = ["react", "pages", "host"];

const REFRESH_MS = 120000;
const CRM = "https://crm.sunnn.co";
const SALES = "https://sales.sunnn.co";

const ICON =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 18a8 8 0 1 1 16 0"/><path d="M12 18l4-5"/><circle cx="12" cy="18" r="1.2"/></svg>',
  );

const T = {
  text: "var(--text-standard, inherit)",
  subtle: "var(--text-subtle, color-mix(in srgb, currentColor 72%, transparent))",
  meta: "var(--text-metadata, color-mix(in srgb, currentColor 58%, transparent))",
  panel: "var(--surface-panel, color-mix(in srgb, currentColor 6%, transparent))",
  inset: "var(--surface-inset, color-mix(in srgb, currentColor 4%, transparent))",
  border: "var(--border-standard, color-mix(in srgb, currentColor 14%, transparent))",
  strong: "var(--border-prominent, color-mix(in srgb, currentColor 35%, transparent))",
  danger: "var(--text-danger, #e5484d)",
  warning: "var(--text-warning, #d49b00)",
  success: "var(--text-success, #30a46c)",
};
const tint = (c, pct) => `color-mix(in srgb, ${c} ${pct}%, transparent)`;

// Survives page remounts within one app session.
const memory = { data: null, error: null, fetchedAt: null };

// ---------- formatting ----------
const num = (v) => (typeof v === "number" && isFinite(v) ? v.toLocaleString("en-AU") : "–");
function minutes(v) {
  if (typeof v !== "number" || !isFinite(v)) return "–";
  if (v < 60) return (v < 10 ? v.toFixed(1) : Math.round(v)) + " min";
  const h = Math.floor(v / 60);
  const m = Math.round(v - h * 60);
  return h + " h" + (m ? " " + m + " min" : "");
}
function seconds(v) {
  if (typeof v !== "number" || !isFinite(v)) return "–";
  if (v < 120) return Math.round(v) + " s";
  return minutes(v / 60);
}
function hours(v) {
  if (typeof v !== "number" || !isFinite(v)) return "–";
  return (v < 24 ? v.toFixed(1) : Math.round(v)) + " h";
}
function clock(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return "";
  return d.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", timeZone: "Australia/Sydney" });
}
function ageText(iso) {
  if (!iso) return "";
  const h = (Date.now() - new Date(iso).getTime()) / 3600000;
  if (h < 1) return Math.max(1, Math.round(h * 60)) + " min";
  if (h < 48) return Math.round(h) + " h";
  return Math.round(h / 24) + " days";
}
const plural = (n, one, many) => (n === 1 ? one : many || one + "s");

// ---------- tiles from the reader's JSON ----------
function buildTiles(d) {
  const crm = d && d.crm;
  const crmErr = d && d.crm_error;
  const read = crm ? "read " + clock(crm.read_at) : "";
  const missing = (title, href, why) => ({ title, href, notMeasured: why || crmErr || "no data yet" });
  const tiles = [];

  if (!crm) {
    ["New leads", "Speed to first call", "Calls made", "10-minute calls booked", "PV Designs booked", "PV meetings held", "Proposals sent", "Signed"].forEach((t) =>
      tiles.push(missing(t, CRM + "/reports")),
    );
  } else {
    const L = crm.leads || {};
    const src = Object.entries(L.by_source_week || {}).map(([k, v]) => v + " " + k).join(", ");
    tiles.push({
      title: "New leads",
      href: CRM + "/leads",
      today: num(L.today),
      week: num(L.week),
      lines: [src ? "7 days: " + src : null],
      source: "New contacts added to the CRM. Left out: " + num(L.excluded_cold_imports_week) + " cold-list imports and " + num(L.excluded_recruits_week) + " job applicants this week, tests and merged duplicates. A past customer who enquires again is not a new contact, so is not counted. " + read,
    });

    const S = crm.speed || {};
    const St = S.today || {};
    const Sw = S.week || {};
    const badT = (St.in_late || 0) + (St.in_not_called || 0);
    const badW = (Sw.in_late || 0) + (Sw.in_not_called || 0);
    tiles.push({
      title: "Speed to first call",
      href: CRM + "/reports",
      today: seconds(St.in_med_s),
      week: seconds(Sw.in_med_s),
      todayLabel: "today, open hours",
      weekLabel: "7 days, open hours",
      tone: badT > 0 ? "warn" : null,
      lines: [
        "Arrived while calling is allowed: today " + num(St.in_60) + " of " + num(St.in_n) + " rung within 60 s, 7 days " + num(Sw.in_60) + " of " + num(Sw.in_n),
        { text: "Rung later than 60 s or not rung: today " + num(badT) + ", 7 days " + num(badW), tone: badW > 0 ? "warn" : null },
        "Arrived while calling is not allowed (nights, Sundays): today " + num(St.out_n) + ", 7 days " + num(Sw.out_n) + ". Of the 7 days: " +
          num(Sw.out_called) + " rung when calling opened (typical wait " + hours(Sw.out_med_wait_h) + "), " +
          num(Sw.out_self) + " booked their own call by text first, " + num(Sw.out_waiting) + " still waiting",
      ],
      source: "Facebook leads only (hand-entered contacts and Sunnn+ sign-ups are not ad leads). Big number = typical (median) time from the lead arriving to the first call by Mia or a person, for leads that arrived inside legal calling hours. Calling hours = weekdays 9am to 8pm, Saturday 9am to 5pm, never Sunday, in Sydney time; public holidays and other states' time zones are not counted in. " + read,
    });

    const C = crm.calls || {};
    const row = (k, label, picked) => {
      const t = (C.today || {})[k] || { dials: 0, min1: 0, picked: 0 };
      const w = (C.week || {})[k] || { dials: 0, min1: 0, picked: 0 };
      return label + ": today " + num(t.dials) + " dials, " + num(t.min1) + " of 1 min+" + (picked ? " (" + num(t.picked) + " picked up)" : "") +
        ". 7 days " + num(w.dials) + " dials, " + num(w.min1) + " of 1 min+" + (picked ? " (" + num(w.picked) + " picked up)" : "");
    };
    const sum = (o) => Object.values(o || {}).reduce((a, v) => a + (v.dials || 0), 0);
    tiles.push({
      title: "Calls made",
      href: CRM + "/dialer",
      today: num(sum(C.today)),
      week: num(sum(C.week)),
      todayLabel: "dials today",
      weekLabel: "dials, 7 days",
      lines: [row("mia", "Mia", true), row("people", "Reps"), row("james_login", "James's login"), row("agent", "Other AI callers")],
      source: "Outbound dials in the CRM dialer log, test calls left out. \"1 min+\" = answered and lasted 60 seconds or more, the same ruler for everyone. \"Picked up\" is shown for Mia only: someone answered, even for a few seconds (this is not recorded for people's calls). James's login is shared with agents, so it is its own line. Calls from James's mobile are not seen. " + read,
    });

    const B = crm.bookings || {};
    tiles.push({
      title: "10-minute calls booked",
      href: CRM + "/calendar",
      today: num(B.ten_today),
      week: num(B.ten_week),
      lines: [
        "Customers: today " + num(B.ten_today_customers) + ", 7 days " + num(B.ten_week_customers) + " (some booked more than once)",
        "7-day bookings now: " + num(B.ten_week_showed) + " held, " + num(B.ten_week_no_show) + " no-shows, " + num(B.ten_week_cancelled) + " cancelled, " +
          num(B.ten_week_upcoming) + " still to come" + (B.ten_week_unmarked ? ", " + num(B.ten_week_unmarked) + " past and not marked" : ""),
      ],
      source: "Bookings made on the 10-Minute Call calendar, counted by the day they were made (not the day of the call), tests and Google mirrors left out. " + read,
    });
    tiles.push({
      title: "PV Designs booked",
      href: CRM + "/calendar",
      today: num(B.pv_today),
      week: num(B.pv_week),
      lines: [num(B.pv_week_cancelled) + " of the 7-day bookings since cancelled", num(B.pv_holds_open) + " upcoming " + plural(B.pv_holds_open, "hold") + " still waiting on a bill (not counted)"],
      source: "Bookings made on the PV Design calendar, counted by the day they were made, holds left out. " + read,
    });

    const P = crm.pv_held || {};
    tiles.push({
      title: "PV meetings held",
      href: CRM + "/calendar",
      today: num(P.today),
      week: num(P.week),
      tone: P.week_unmarked > 0 ? "warn" : null,
      lines: [
        num(P.upcoming_today) + " still to come today" + (P.upcoming_today_holds ? " (plus " + num(P.upcoming_today_holds) + " " + plural(P.upcoming_today_holds, "hold") + " waiting on a bill)" : ""),
        num(P.week_no_show) + " no-shows in 7 days",
        P.week_unmarked ? { text: num(P.week_unmarked) + " past " + plural(P.week_unmarked, "meeting") + " not marked held or no-show", tone: "warn" } : null,
      ],
      source: "PV Design meetings marked held (showed), by meeting time. " + read,
    });

    const R = crm.proposals || {};
    const none = R.aged_none || [];
    tiles.push({
      title: "Proposals sent",
      href: CRM + "/pipeline",
      today: num(R.today),
      week: num(R.week),
      todayLabel: "customers today",
      weekLabel: "customers, 7 days",
      tone: none.length > 0 ? "warn" : null,
      lines: [
        "First proposals: today " + num(R.today_first) + ", 7 days " + num(R.week_first) + ". Re-sends: today " + num((R.today || 0) - (R.today_first || 0)) + ", 7 days " + num((R.week || 0) - (R.week_first || 0)),
        R.aged_sent
          ? "Sent 2 to 9 days ago: " + num(R.aged_sent) + ". " + num(R.aged_touched) + " followed up within 48 h, " + num(R.aged_next_meeting) + " have their next meeting booked" + (R.aged_signed ? ", " + num(R.aged_signed) + " signed" : "")
          : "None sent 2 to 9 days ago to check for follow-up",
        none.length ? { text: num(none.length) + " with no follow-up of any kind: " + none.join(", "), tone: "warn" } : (R.aged_sent ? "None without follow-up" : null),
      ],
      source: "Customers sent a sign link, counted once each. First = their first ever proposal; re-send = they had one before. Followed up = within 48 h a rep dial, call log or hand-written text or email, or a later meeting booked (confirmed or held), or signed. Mia and automatic texts do not count. James's mobile calls are not seen, so a name here may already have had a call. " + read,
    });

    const G = crm.signed || {};
    tiles.push({
      title: "Signed",
      href: SALES + "/installs",
      today: num(G.today),
      week: num(G.week),
      tone: G.week > 0 ? "good" : null,
      lines: [G.week_cancelled ? num(G.week_cancelled) + " of these since cancelled" : null],
      source: "Install records with a signature time (one is written at signing). " + read,
    });
  }

  const I = d && d.installs;
  if (!I) tiles.push(missing("Open installs by step", SALES + "/installs"));
  else
    tiles.push({
      title: "Open installs by step",
      href: SALES + "/installs",
      wide: true,
      today: num(I.open),
      todayLabel: "open jobs",
      week: I.customers != null ? num(I.customers) : null,
      weekLabel: "customers",
      steps: I.steps,
      source: "Signed jobs not closed or cancelled, at the step the Installs sheet shows (same rule, copied from the CRM code). Some customers have two jobs. Days = how long the job has been at this step. " + read,
    });

  // Waiting on James
  const D = (crm && crm.drafts) || null;
  const E = d && d.email_drafts;
  const follow = D && D.meeting_follow_up ? D.meeting_follow_up.n : 0;
  const reply = D && D.reply ? D.reply.n : 0;
  const maybe = D ? Object.values(D).reduce((a, v) => a + (v.maybe_answered || 0), 0) : 0;
  const lines = [];
  if (D) {
    lines.push({ text: num(follow) + " after-meeting follow-up " + plural(follow, "draft") + " to tap" + (follow ? " (oldest " + ageText(D.meeting_follow_up.oldest) + ")" : ""), href: CRM + "/inbox" });
    lines.push({ text: num(reply) + " text reply " + plural(reply, "draft") + " to tap" + (reply ? " (oldest " + ageText(D.reply.oldest) + ")" : ""), href: CRM + "/inbox" });
    if (maybe) lines.push({ text: "Not counted: " + num(maybe) + " more " + plural(maybe, "draft") + " that may already be answered (someone sent a hand-written message after the draft was made)" });
  } else lines.push({ text: "CRM drafts: not measured (" + (crmErr || "no data") + ")" });
  if (E) lines.push({ text: num(E.n) + " email " + plural(E.n, "draft") + " left in his Gmail to send" + (E.n ? " (oldest " + ageText(E.oldest) + ")" : ""), href: "https://mail.google.com/mail/u/0/#drafts" });
  else lines.push({ text: "Email drafts: not measured (" + ((d && d.email_drafts_error) || "no data") + ")" });
  lines.push({ text: "Inbox cards: none, James turned them off on 12 Nov" });
  const total = (D ? follow + reply : 0) + (E ? E.n : 0);
  tiles.push({
    title: "Waiting on James",
    href: CRM + "/inbox",
    wide: true,
    // Only add up when both sources were read; a partial sum would be a guess.
    today: D && E ? num(total) : "–",
    todayLabel: "now",
    tone: total > 0 ? "warn" : "good",
    linkLines: lines,
    source: "CRM drafts ready for his tap and the inbox sorter's ledger on this Mac (reply drafts it left in James's Gmail in the last 7 days that it has not seen him answer). " + [crm ? read : null, E ? "ledger read " + clock(E.read_at) : null].filter(Boolean).join(", ") + ".",
  });

  return tiles;
}

// ---------- UI ----------
export function apply(ctx) {
  const React = ctx.react;
  const h = React.createElement;

  async function load() {
    const out = await ctx.host.runCommand("read");
    if (out == null) throw new Error("the reader did not answer in time");
    return JSON.parse(typeof out === "string" ? out : new TextDecoder().decode(out));
  }

  function Big(props) {
    return h(
      "div",
      { style: { display: "flex", flexDirection: "column", minWidth: 0 } },
      h("span", { style: { fontSize: "1.9rem", fontWeight: 700, lineHeight: 1.1, fontVariantNumeric: "tabular-nums", overflowWrap: "anywhere" } }, props.value),
      h("span", { style: { fontSize: "0.74rem", fontWeight: 600, letterSpacing: 0.4, textTransform: "uppercase", color: T.meta } }, props.label),
    );
  }

  function StepList(props) {
    if (!props.steps || !props.steps.length) return h("p", { style: { margin: 0, color: T.meta } }, "No open jobs");
    return h(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: 6 } },
      props.steps.map((s) =>
        h(
          "div",
          { key: s.key, style: { display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" } },
          h("strong", { style: { fontVariantNumeric: "tabular-nums", minWidth: 22 } }, s.jobs.length),
          h("span", { style: { fontWeight: 600 } }, s.label),
          h(
            "span",
            { style: { color: T.subtle, fontSize: "0.86rem" } },
            s.jobs.map((j, i) =>
              h(
                "span",
                { key: i, style: { color: j.tone === "red" ? T.danger : j.tone === "amber" ? T.warning : T.subtle } },
                (i ? ", " : "") + j.name + (j.days != null ? " " + j.days + "d" : ""),
              ),
            ),
          ),
        ),
      ),
    );
  }

  function Tile(props) {
    const t = props.tile;
    const accent = t.notMeasured ? T.meta : t.tone === "warn" ? T.warning : t.tone === "good" ? T.success : T.strong;
    const body = [];
    if (t.notMeasured) {
      body.push(h("div", { key: "nm", style: { fontSize: "1.25rem", fontWeight: 700, color: T.meta } }, "not measured"));
      body.push(h("div", { key: "why", style: { fontSize: "0.84rem", color: T.meta } }, t.notMeasured));
    } else {
      body.push(
        h(
          "div",
          { key: "nums", style: { display: "flex", gap: 22, alignItems: "flex-end", flexWrap: "wrap" } },
          h(Big, { value: t.today, label: t.todayLabel || "today" }),
          t.week != null ? h(Big, { value: t.week, label: t.weekLabel || "7 days" }) : null,
        ),
      );
      if (t.steps) body.push(h(StepList, { key: "steps", steps: t.steps }));
      (t.lines || []).filter(Boolean).forEach((l, i) => {
        const line = typeof l === "string" ? { text: l } : l;
        body.push(h("div", { key: "l" + i, style: { fontSize: "0.86rem", lineHeight: 1.45, color: line.tone === "warn" ? T.warning : T.subtle, fontWeight: line.tone === "warn" ? 600 : 400 } }, line.text));
      });
      (t.linkLines || []).forEach((l, i) =>
        body.push(
          l.href
            ? h("a", { key: "k" + i, href: l.href, target: "_blank", rel: "noreferrer", style: { fontSize: "0.9rem", color: T.text, lineHeight: 1.45 } }, l.text)
            : h("div", { key: "k" + i, style: { fontSize: "0.86rem", color: T.meta, lineHeight: 1.45 } }, l.text),
        ),
      );
    }
    body.push(h("div", { key: "src", style: { marginTop: "auto", paddingTop: 6, fontSize: "0.74rem", color: T.meta, lineHeight: 1.4 } }, "Source: " + (t.source || "none")));
    // A tile with its own links inside cannot itself be a link (no nested
    // anchors), so only its heading opens the page.
    const whole = !(t.linkLines && t.linkLines.length);
    const link = { href: t.href, target: "_blank", rel: "noreferrer", title: "Open " + (t.href || "").replace(/^https:\/\//, "") };
    return h(
      whole ? "a" : "div",
      {
        ...(whole ? link : {}),
        style: {
          gridColumn: t.wide ? "1 / -1" : undefined,
          display: "flex", flexDirection: "column", gap: 8, padding: "14px 16px", borderRadius: 14,
          border: "1px solid " + T.border, borderLeft: "4px solid " + accent,
          background: t.tone === "warn" ? tint(T.warning, 6) : T.panel,
          color: T.text, textDecoration: "none", minWidth: 0,
        },
      },
      h(
        "div",
        { style: { display: "flex", justifyContent: "space-between", gap: 8 } },
        whole
          ? h("span", { style: { fontWeight: 700, fontSize: "0.98rem" } }, t.title)
          : h("a", { ...link, style: { fontWeight: 700, fontSize: "0.98rem", color: T.text, textDecoration: "none" } }, t.title),
        h(whole ? "span" : "a", { ...(whole ? {} : link), "aria-hidden": whole, style: { color: T.meta, fontSize: "0.85rem", textDecoration: "none" } }, "↗"),
      ),
      body,
    );
  }

  function ControlRoom() {
    const [state, setState] = React.useState({ data: memory.data, error: memory.error, fetchedAt: memory.fetchedAt, busy: false });
    const refresh = React.useCallback(async () => {
      setState((s) => ({ ...s, busy: true }));
      try {
        const data = await load();
        memory.data = data; memory.error = null; memory.fetchedAt = new Date().toISOString();
      } catch (e) {
        memory.error = String((e && e.message) || e);
      }
      setState({ data: memory.data, error: memory.error, fetchedAt: memory.fetchedAt, busy: false });
    }, []);
    React.useEffect(() => {
      refresh();
      const t = setInterval(refresh, REFRESH_MS);
      return () => clearInterval(t);
    }, [refresh]);

    const tiles = state.data ? buildTiles(state.data) : null;
    return h(
      "div",
      { style: { height: "100%", overflow: "auto", padding: "var(--space-panel-inset, 20px)", boxSizing: "border-box", color: T.text } },
      h(
        "div",
        { style: { display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 14 } },
        h("h1", { style: { margin: 0, fontSize: "1.45rem" } }, "Control room"),
        h("span", { style: { color: T.meta, fontSize: "0.86rem" } },
          "Today (since midnight Sydney) and the last 7 days. Read only. " +
            (state.fetchedAt ? "Updated " + clock(state.fetchedAt) + ", refreshes every 2 min." : "Loading…")),
        h("button", { type: "button", onClick: refresh, disabled: state.busy, style: { marginLeft: "auto", fontSize: "0.84rem", padding: "3px 12px" } }, state.busy ? "Reading…" : "Refresh"),
      ),
      state.error
        ? h("div", { style: { marginBottom: 12, padding: "8px 12px", borderRadius: 10, background: tint(T.danger, 10), color: T.danger, fontSize: "0.88rem" } },
            "Last read failed: " + state.error + (state.data ? ". Showing the previous numbers." : ""))
        : null,
      tiles
        ? h("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 12 } }, tiles.map((t) => h(Tile, { key: t.title, tile: t })))
        : !state.error
          ? h("p", { style: { color: T.meta } }, "Reading the CRM…")
          : null,
    );
  }

  ctx.pages.register({ id: "control-room", title: "Control room", primary: true, icon: ICON, component: ControlRoom });
}
