const taskService = require('../src/services/taskService');

// The tasks live in one global array, so I empty it before every test.
// Without this, tasks from one test would leak into the next.
beforeEach(() => {
  taskService._reset();
});

describe('create', () => {
  test('fills in default values', () => {
    const task = taskService.create({ title: 'Test' });
    expect(task.id).toBeDefined();
    expect(task.status).toBe('todo');
    expect(task.priority).toBe('medium');
    expect(task.completedAt).toBeNull();
    expect(task.assignee).toBeNull();
  });

  test('uses the values I pass in', () => {
    const task = taskService.create({ title: 'T', status: 'in_progress', priority: 'high' });
    expect(task.status).toBe('in_progress');
    expect(task.priority).toBe('high');
  });
});

describe('getAll and findById', () => {
  test('getAll returns every task', () => {
    taskService.create({ title: 'A' });
    taskService.create({ title: 'B' });
    expect(taskService.getAll()).toHaveLength(2);
  });

  test('findById finds a task, and gives undefined for a wrong id', () => {
    const task = taskService.create({ title: 'A' });
    expect(taskService.findById(task.id)).toEqual(task);
    expect(taskService.findById('nope')).toBeUndefined();
  });
});

describe('getByStatus', () => {
  test('returns only tasks with that status', () => {
    taskService.create({ title: 'A', status: 'todo' });
    taskService.create({ title: 'B', status: 'done' });
    const result = taskService.getByStatus('todo');
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('A');
  });

  // BUG 1: the code used includes(), so "do" matched both "todo" and "done"
  test('does not match part of a status word', () => {
    taskService.create({ title: 'A', status: 'todo' });
    taskService.create({ title: 'B', status: 'done' });
    expect(taskService.getByStatus('do')).toHaveLength(0);
  });
});

describe('getPaginated', () => {
  // 15 tasks, so page 1 is full and page 2 is half full
  beforeEach(() => {
    for (let i = 1; i <= 15; i++) taskService.create({ title: `Task ${i}` });
  });

  // BUG 2: the code skipped page * limit items, so page 1 started at item 11
  test('page 1 starts at the first task', () => {
    const result = taskService.getPaginated(1, 10);
    expect(result).toHaveLength(10);
    expect(result[0].title).toBe('Task 1');
  });

  test('last page has the leftover tasks', () => {
    expect(taskService.getPaginated(2, 10)).toHaveLength(5);
  });

  test('a page past the end is empty', () => {
    expect(taskService.getPaginated(5, 10)).toEqual([]);
  });
});

describe('update', () => {
  test('changes only the fields I send', () => {
    const task = taskService.create({ title: 'Old', priority: 'low' });
    const updated = taskService.update(task.id, { title: 'New' });
    expect(updated.title).toBe('New');
    expect(updated.priority).toBe('low');
  });

  test('returns null for an unknown id', () => {
    expect(taskService.update('nope', { title: 'x' })).toBeNull();
  });

  // BUG 4 (known, not fixed): update copies everything, even the id.
  // test.failing passes while the bug exists, and turns red once someone fixes it,
  // which is the signal to change it to a normal test.
  test.failing('should not allow changing the id', () => {
    const task = taskService.create({ title: 'A' });
    const updated = taskService.update(task.id, { id: 'hacked' });
    expect(updated.id).toBe(task.id);
  });
});

describe('remove', () => {
  test('deletes an existing task', () => {
    const task = taskService.create({ title: 'A' });
    expect(taskService.remove(task.id)).toBe(true);
    expect(taskService.getAll()).toHaveLength(0);
  });

  test('returns false for an unknown id', () => {
    expect(taskService.remove('nope')).toBe(false);
  });
});

describe('completeTask', () => {
  test('sets status to done and records completedAt', () => {
    const task = taskService.create({ title: 'A' });
    const done = taskService.completeTask(task.id);
    expect(done.status).toBe('done');
    expect(done.completedAt).not.toBeNull();
  });

  // BUG 3: the code hard-coded priority: 'medium' when completing
  test('keeps the original priority', () => {
    const task = taskService.create({ title: 'A', priority: 'high' });
    expect(taskService.completeTask(task.id).priority).toBe('high');
  });

  test('returns null for an unknown id', () => {
    expect(taskService.completeTask('nope')).toBeNull();
  });
});

describe('getStats', () => {
  test('counts tasks per status', () => {
    taskService.create({ title: 'A', status: 'todo' });
    taskService.create({ title: 'B', status: 'in_progress' });
    taskService.create({ title: 'C', status: 'done' });
    taskService.create({ title: 'D', status: 'done' });
    expect(taskService.getStats()).toEqual({ todo: 1, in_progress: 1, done: 2, overdue: 0 });
  });

  test('overdue means: has a past due date AND is not done', () => {
    taskService.create({ title: 'overdue', dueDate: '2000-01-01T00:00:00.000Z' });
    taskService.create({ title: 'done late', dueDate: '2000-01-01T00:00:00.000Z', status: 'done' });
    taskService.create({ title: 'future', dueDate: '2999-01-01T00:00:00.000Z' });
    taskService.create({ title: 'no date' });
    expect(taskService.getStats().overdue).toBe(1);
  });
});

describe('assign (new feature)', () => {
  test('saves the assignee and returns the updated task', () => {
    const task = taskService.create({ title: 'A' });
    const result = taskService.assign(task.id, 'Rohit');
    expect(result.assignee).toBe('Rohit');
    expect(taskService.findById(task.id).assignee).toBe('Rohit');
  });

  test('returns null for an unknown id', () => {
    expect(taskService.assign('nope', 'Rohit')).toBeNull();
  });
});