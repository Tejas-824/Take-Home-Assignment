# Bug Report

## Bug 1: Status filter matches partial strings  (FIXED)
**Where:** `taskService.js` -> `getByStatus`
**Expected:** `?status=todo` returns only tasks whose status is exactly `todo`.
**Actual:** it uses `t.status.includes(status)`, which is a substring check.
So `?status=do` returns both `todo` and `done`, and `?status=o` returns everything.
**Why it happens:** `includes` on a string checks "is this text inside that text",
not "are they equal". The developer probably wanted `===`.
**How I found it:** wrote a test that filters with `do` and expected 0 results.
**Fix:** `t.status === status`.

## Bug 2: Pagination skips the first page  (FIXED)
**Where:** `taskService.js` -> `getPaginated`
**Expected:** `page=1&limit=10` returns items 1-10.
**Actual:** it returns items 11-20, so page 1 is effectively page 2, and
the first page can never be reached.
**Why it happens:** `offset = page * limit`. Pages start at 1, so the offset
should be `(page - 1) * limit`. With page=1 the current code starts at index 10.
**How I found it:** created 15 tasks, asked for page 1, and the first task
was not "Task 1".
**Fix:** `const offset = (page - 1) * limit;`

## Bug 3: Completing a task resets its priority  (FIXED)
**Where:** `taskService.js` -> `completeTask`
**Expected:** completing a task only changes `status` and `completedAt`.
**Actual:** it also sets `priority: 'medium'`, so a high priority task silently
loses its priority.
**Why it happens:** a hard-coded `priority: 'medium'` inside the object built in
`completeTask`. Nothing in the requirements asks for it - looks like a leftover
or a mistake. It destroys user data with no warning.
**How I found it:** created a `high` task, completed it, and checked priority.
**Fix:** removed that line.

## Bug 4: PUT lets the client overwrite any field  (NOT FIXED)
**Where:** `taskService.js` -> `update` (and `validateUpdateTask` doesn't guard it)
**Expected:** only editable fields (title, description, status, priority,
dueDate) can change.
**Actual:** `{ ...tasks[index], ...fields }` copies everything from the request
body, so a client can change `id`, `createdAt`, `completedAt`, or add random
unknown fields.
**Why it happens:** the body is spread straight into the task with no whitelist.
**Fix idea:** pick only the allowed keys from `fields` before merging.
Covered by a `test.failing` test.

## Bug 5: Setting status to "done" through PUT doesn't set completedAt  (NOT FIXED)
**Where:** `taskService.js` -> `update`
**Actual:** `PUT {status: "done"}` gives a done task with `completedAt: null`,
while `/complete` sets it. Two ways to finish a task, inconsistent data.
**Fix idea:** set/clear `completedAt` inside `update` when status changes.

## Bug 6 (smaller issues)
- **Pagination input isn't validated.** `page=-1` or `limit=-5` gives strange
  slices, and `?status=` combined with `?page=` ignores pagination (status wins).
- **Empty-string/falsy values skip validation.** `if (body.status && ...)`,
  so `status: ""` passes validation.
- **Completing an already-completed task** overwrites the old `completedAt`.