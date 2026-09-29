const taskService = require('../src/services/taskService');

beforeEach(() => {
  taskService._reset(); // fresh empty store before every test
});

describe('create', () => {
  test('creates a task with defaults', () => {
    const task = taskService.create({ title: 'Test' });
    expect(task.id).toBeDefined();
    expect(task.status).toBe('todo');
    expect(task.priority).toBe('medium');
    expect(task.description).toBe('');
    expect(task.dueDate).toBeNull();
    expect(task.completedAt).toBeNull();
    expect(task.assignee).toBeNull();
  });

  test('uses values that were passed in', () => {
    const task = taskService.create({ title: 'T', status: 'in_progress', priority: 'high' });
    expect(task.status).toBe('in_progress');
    expect(task.priority).toBe('high');
  });
});

describe('getAll / findById', () => {
  test('getAll returns all tasks', () => {
    taskService.create({ title: 'A' });
    taskService.create({ title: 'B' });
    expect(taskService.getAll()).toHaveLength(2);
  });

  test('findById returns the task, or undefined if missing', () => {
    const task = taskService.create({ title: 'A' });
    expect(taskService.findById(task.id)).toEqual(task);
    expect(taskService.findById('nope')).toBeUndefined();
  });
});

describe('getByStatus', () => {
  test('returns only tasks with that exact status', () => {
    taskService.create({ title: 'A', status: 'todo' });
    taskService.create({ title: 'B', status: 'done' });
    const result = taskService.getByStatus('todo');
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('A');
  });

  // BUG #1: uses includes() so partial strings match
  test('does not match partial status strings', () => {
    taskService.create({ title: 'A', status: 'todo' });
    taskService.create({ title: 'B', status: 'done' });
    expect(taskService.getByStatus('do')).toHaveLength(0);
  });
});

describe('getPaginated', () => {
  beforeEach(() => {
    for (let i = 1; i <= 15; i++) taskService.create({ title: `Task ${i}` });
  });

  // BUG #2: offset is page * limit instead of (page - 1) * limit
  test('page 1 returns the first items', () => {
    const result = taskService.getPaginated(1, 10);
    expect(result).toHaveLength(10);
    expect(result[0].title).toBe('Task 1');
  });

  test('last page returns the leftover items', () => {
    expect(taskService.getPaginated(2, 10)).toHaveLength(5);
  });

  test('page past the end returns an empty array', () => {
    expect(taskService.getPaginated(5, 10)).toEqual([]);
  });
});

describe('update', () => {
  test('updates the given fields only', () => {
    const task = taskService.create({ title: 'Old', priority: 'low' });
    const updated = taskService.update(task.id, { title: 'New' });
    expect(updated.title).toBe('New');
    expect(updated.priority).toBe('low');
  });

  test('returns null for unknown id', () => {
    expect(taskService.update('nope', { title: 'x' })).toBeNull();
  });
});

describe('remove', () => {
  test('removes an existing task', () => {
    const task = taskService.create({ title: 'A' });
    expect(taskService.remove(task.id)).toBe(true);
    expect(taskService.getAll()).toHaveLength(0);
  });

  test('returns false for unknown id', () => {
    expect(taskService.remove('nope')).toBe(false);
  });
});

describe('completeTask', () => {
  test('sets status to done and sets completedAt', () => {
    const task = taskService.create({ title: 'A' });
    const done = taskService.completeTask(task.id);
    expect(done.status).toBe('done');
    expect(done.completedAt).not.toBeNull();
  });

  // BUG #3: priority gets reset to 'medium'
  test('does not change the priority', () => {
    const task = taskService.create({ title: 'A', priority: 'high' });
    const done = taskService.completeTask(task.id);
    expect(done.priority).toBe('high');
  });

  test('returns null for unknown id', () => {
    expect(taskService.completeTask('nope')).toBeNull();
  });
});

describe('getStats', () => {
  test('counts tasks by status', () => {
    taskService.create({ title: 'A', status: 'todo' });
    taskService.create({ title: 'B', status: 'in_progress' });
    taskService.create({ title: 'C', status: 'done' });
    taskService.create({ title: 'D', status: 'done' });
    expect(taskService.getStats()).toEqual({ todo: 1, in_progress: 1, done: 2, overdue: 0 });
  });

  test('counts overdue only for unfinished tasks with a past due date', () => {
    const past = '2000-01-01T00:00:00.000Z';
    const future = '2999-01-01T00:00:00.000Z';
    taskService.create({ title: 'overdue', dueDate: past });
    taskService.create({ title: 'finished late', dueDate: past, status: 'done' });
    taskService.create({ title: 'not due yet', dueDate: future });
    taskService.create({ title: 'no date' });
    expect(taskService.getStats().overdue).toBe(1);
  });
});

describe('assign', () => {
  test('stores the assignee and returns the updated task', () => {
    const task = taskService.create({ title: 'A' });
    const result = taskService.assign(task.id, 'Rohit');
    expect(result.assignee).toBe('Rohit');
    expect(taskService.findById(task.id).assignee).toBe('Rohit');
  });

  test('returns null for unknown id', () => {
    expect(taskService.assign('nope', 'Rohit')).toBeNull();
  });
});