# Leaderboard months are anchored to Asia/Manila, through one helper

A "month" in GroundsPH is a Manila calendar month, not UTC and not the runtime's local
month. Every boundary — the SQL window a leaderboard aggregates over, the cron's
"previous month", the month list in the picker, the "is this month in the future" check —
goes through `utils/date/leaderboard-months.ts`, which does explicit `+08:00` arithmetic
with `Date.UTC`/`getUTC*` and returns UTC instants.

The bug that forced the decision: the four boundaries above were each derived
independently, one shifted by eight hours and one did not, so a check-in at 03:00 Manila
on the first of the month counted towards different months on the cafe board and the user
board. A developer machine in another timezone got a third answer again.

## Consequences

- Anything that reasons about a calendar day or month must use this module
  (`getMonthWindow`, `getManilaDayWindow`, `currentDayKey`, `currentMonthKey`) rather
  than `new Date(year, month, day)` or `toISOString()` on a locally-built date. The
  database and the prod servers run `Etc/UTC`; developer machines usually do not.
- Month labels and month lists come from the server, not from the browser's clock. The
  browser's timezone is not the visitor's timezone and neither is the business's.
- Tests for date logic assert absolute instants (`2026-09-30T16:00:00Z`), never local
  getters, so they pass on any machine. The suite is run both normally and with
  `TZ=UTC`.

## Considered options

- **Store a `timezone` setting and compute from it.** Rejected: one business timezone is
  not a configuration problem, and a setting invites the same drift with a new source of
  truth.
- **Do the arithmetic in SQL with `AT TIME ZONE 'Asia/Manila'` everywhere.** Partly
  adopted (the visit-day index and the visit-day count do this), but the month window has
  to exist in TypeScript too, because the cron and the client both need it without a
  round trip. Keeping both in one module keeps them provably equal.
- **Use UTC months and accept the eight-hour skew.** Rejected: it puts a visitor's
  Saturday-night check-in in the wrong month, and every leaderboard is a monthly
  artefact.
