# Bug Report

I read through the code, wrote tests for every endpoint, and ran them. Some
bugs were caught by failing tests, others I found by reading the code. Each bug
says which. I fixed the first three. The rest are documented because fixing
them needs a decision from the team.

---

## Bug 1: Filtering by status gives wrong results (FIXED)

**Where:** `taskService.js`, in `getByStatus`

**What should happen:** Asking for status `todo` returns only tasks that are exactly `todo`.

**What actually happens:** It returns any task whose status contains the text
you typed. Searching `do` returns both `todo` and `done`. Searching `o` returns everything.

**Why:** The code uses `includes`, which asks "is this text anywhere inside that
text?" It should ask "are these two exactly the same?"

**How I found it:** A test searched for `do` and expected no results. It got two.

**Fix:** Changed `includes(status)` to `=== status`.

---

## Bug 2: Page 1 of the list is skipped (FIXED)

**Where:** `taskService.js`, in `getPaginated`

**What should happen:** Page 1 with 10 items per page shows items 1 to 10.

**What actually happens:** Page 1 shows items 11 to 20. The first page can never be seen,
and the last page comes back empty.

**Why:** The code skips `page x limit` items. For page 1 that is 10 items. It
should skip `(page - 1) x limit`, which is zero for page 1.

**How I found it:** A test created 15 tasks and asked for page 1. The first
task was not "Task 1".

**Fix:** Changed the calculation to `(page - 1) * limit`.

---

## Bug 3: Completing a task wipes out its priority (FIXED)

**Where:** `taskService.js`, in `completeTask`

**What should happen:** Completing a task only changes its status and records when it finished.

**What actually happens:** It also resets the priority to `medium`. A `high`
priority task silently loses that information.

**Why:** A line in the code hard-codes `priority: 'medium'`. Nothing in the
requirements asks for it, so it looks like a mistake.

**How I found it:** A test completed a `high` priority task and checked the
priority. It had changed.

**Fix:** Deleted that line.

---

## Bug 4: The update endpoint lets users change things they shouldn't (NOT FIXED)

**Where:** `taskService.js`, in `update`

**What should happen:** Users can only change editable fields: title,
description, status, priority and due date.

**What actually happens:** Whatever the user sends gets saved. They could
change the task's `id` or creation date, or add made-up fields.

**Why:** The code copies the whole request onto the task, with no list of allowed fields.

**How I found it:** By reading the code, then confirmed with a test marked
`test.failing`, which passes while the bug exists.

**Fix idea:** Copy only the allowed fields and ignore the rest.

**Why not fixed:** It is a bigger change than the others, and the team should
decide what happens to unknown fields (ignore them or return an error).

---

## Bug 5: Two ways to finish a task, and they don't agree (NOT FIXED)

**Where:** `taskService.js`, in `update`

**What actually happens:** The "complete" endpoint records the completion time.
Setting status to `done` through the update endpoint does not, so you get
finished tasks with no completion time.

**How I found it:** By reading the code. `update` never touches `completedAt`.
There is no test for this yet.

**Fix idea:** Set the completion time when status becomes `done`, and clear it
if the task is reopened.

---

## Smaller issues (NOT FIXED)

All found by reading the code, none have tests yet.

- **Bad page numbers aren't checked.** `page=-1` or `limit=-5` give odd results instead of an error.
- **Status and page can't be combined.** If you filter by status and also ask for a page, the page is ignored.
- **Empty values slip past validation.** `status: ""` is accepted because an empty string counts as "not provided".
- **Completing a finished task twice** overwrites the original completion time.

---

## Documentation mismatch (NOT FIXED)

The README lists statuses as `pending / in-progress / completed`, but the code
uses `todo / in_progress / done`. The README's example `?status=pending`
returns nothing.