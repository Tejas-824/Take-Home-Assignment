const request = require('supertest');
const app = require('../src/app');
const taskService = require('../src/services/taskService');

beforeEach(() => {
  taskService._reset();
});

describe('POST /tasks', () => {
  test('creates a task (201)', async () => {
    const res = await request(app).post('/tasks').send({ title: 'Write tests', priority: 'high' });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Write tests');
    expect(res.body.priority).toBe('high');
    expect(res.body.id).toBeDefined();
  });

  test('400 when title is missing', async () => {
    const res = await request(app).post('/tasks').send({ priority: 'low' });
    expect(res.status).toBe(400);
  });

  test('400 when title is only spaces', async () => {
    const res = await request(app).post('/tasks').send({ title: '   ' });
    expect(res.status).toBe(400);
  });

  test('400 for invalid status', async () => {
    const res = await request(app).post('/tasks').send({ title: 'A', status: 'pending' });
    expect(res.status).toBe(400);
  });

  test('400 for invalid priority', async () => {
    const res = await request(app).post('/tasks').send({ title: 'A', priority: 'urgent' });
    expect(res.status).toBe(400);
  });

  test('400 for invalid dueDate', async () => {
    const res = await request(app).post('/tasks').send({ title: 'A', dueDate: 'not-a-date' });
    expect(res.status).toBe(400);
  });
});

describe('GET /tasks', () => {
  test('returns all tasks', async () => {
    taskService.create({ title: 'A' });
    taskService.create({ title: 'B' });
    const res = await request(app).get('/tasks');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  test('filters by status', async () => {
    taskService.create({ title: 'A', status: 'todo' });
    taskService.create({ title: 'B', status: 'done' });
    const res = await request(app).get('/tasks?status=done');
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe('B');
  });

  test('partial status should not match (bug #1)', async () => {
    taskService.create({ title: 'A', status: 'todo' });
    const res = await request(app).get('/tasks?status=to');
    expect(res.body).toHaveLength(0);
  });

  test('paginates - page 1 gives first items (bug #2)', async () => {
    for (let i = 1; i <= 15; i++) taskService.create({ title: `Task ${i}` });
    const res = await request(app).get('/tasks?page=1&limit=10');
    expect(res.body).toHaveLength(10);
    expect(res.body[0].title).toBe('Task 1');
  });

  test('page 2 gives the remaining items', async () => {
    for (let i = 1; i <= 15; i++) taskService.create({ title: `Task ${i}` });
    const res = await request(app).get('/tasks?page=2&limit=10');
    expect(res.body).toHaveLength(5);
  });
});

describe('PUT /tasks/:id', () => {
  test('updates a task', async () => {
    const task = taskService.create({ title: 'Old' });
    const res = await request(app).put(`/tasks/${task.id}`).send({ title: 'New', status: 'in_progress' });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('New');
    expect(res.body.status).toBe('in_progress');
  });

  test('404 for unknown id', async () => {
    const res = await request(app).put('/tasks/nope').send({ title: 'x' });
    expect(res.status).toBe(404);
  });

  test('400 for empty title', async () => {
    const task = taskService.create({ title: 'Old' });
    const res = await request(app).put(`/tasks/${task.id}`).send({ title: '' });
    expect(res.status).toBe(400);
  });

  // BUG #4 (not fixed - documented in bug report). test.failing passes
  // while the bug exists and will start failing once someone fixes it.
  test.failing('should not let the client overwrite id', async () => {
    const task = taskService.create({ title: 'A' });
    const res = await request(app).put(`/tasks/${task.id}`).send({ id: 'hacked' });
    expect(res.body.id).toBe(task.id);
  });
});

describe('DELETE /tasks/:id', () => {
  test('deletes a task (204)', async () => {
    const task = taskService.create({ title: 'A' });
    const res = await request(app).delete(`/tasks/${task.id}`);
    expect(res.status).toBe(204);
    expect(taskService.getAll()).toHaveLength(0);
  });

  test('404 for unknown id', async () => {
    const res = await request(app).delete('/tasks/nope');
    expect(res.status).toBe(404);
  });
});

describe('PATCH /tasks/:id/complete', () => {
  test('marks the task complete', async () => {
    const task = taskService.create({ title: 'A' });
    const res = await request(app).patch(`/tasks/${task.id}/complete`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('done');
    expect(res.body.completedAt).not.toBeNull();
  });

  test('keeps the original priority (bug #3)', async () => {
    const task = taskService.create({ title: 'A', priority: 'high' });
    const res = await request(app).patch(`/tasks/${task.id}/complete`);
    expect(res.body.priority).toBe('high');
  });

  test('404 for unknown id', async () => {
    const res = await request(app).patch('/tasks/nope/complete');
    expect(res.status).toBe(404);
  });
});

describe('GET /tasks/stats', () => {
  test('returns counts and overdue', async () => {
    taskService.create({ title: 'A', status: 'todo', dueDate: '2000-01-01T00:00:00.000Z' });
    taskService.create({ title: 'B', status: 'done' });
    const res = await request(app).get('/tasks/stats');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ todo: 1, in_progress: 0, done: 1, overdue: 1 });
  });
});

describe('PATCH /tasks/:id/assign', () => {
  test('assigns a task', async () => {
    const task = taskService.create({ title: 'A' });
    const res = await request(app).patch(`/tasks/${task.id}/assign`).send({ assignee: 'Rohit' });
    expect(res.status).toBe(200);
    expect(res.body.assignee).toBe('Rohit');
  });

  test('trims whitespace around the name', async () => {
    const task = taskService.create({ title: 'A' });
    const res = await request(app).patch(`/tasks/${task.id}/assign`).send({ assignee: '  Rohit  ' });
    expect(res.body.assignee).toBe('Rohit');
  });

  test('404 if task does not exist', async () => {
    const res = await request(app).patch('/tasks/nope/assign').send({ assignee: 'Rohit' });
    expect(res.status).toBe(404);
  });

  test('400 for empty string', async () => {
    const task = taskService.create({ title: 'A' });
    const res = await request(app).patch(`/tasks/${task.id}/assign`).send({ assignee: '' });
    expect(res.status).toBe(400);
  });

  test('400 for whitespace-only string', async () => {
    const task = taskService.create({ title: 'A' });
    const res = await request(app).patch(`/tasks/${task.id}/assign`).send({ assignee: '   ' });
    expect(res.status).toBe(400);
  });

  test('400 when assignee is missing', async () => {
    const task = taskService.create({ title: 'A' });
    const res = await request(app).patch(`/tasks/${task.id}/assign`).send({});
    expect(res.status).toBe(400);
  });

  test('400 when assignee is not a string', async () => {
    const task = taskService.create({ title: 'A' });
    const res = await request(app).patch(`/tasks/${task.id}/assign`).send({ assignee: 123 });
    expect(res.status).toBe(400);
  });

  test('400 when name is too long', async () => {
    const task = taskService.create({ title: 'A' });
    const res = await request(app).patch(`/tasks/${task.id}/assign`).send({ assignee: 'a'.repeat(101) });
    expect(res.status).toBe(400);
  });

  test('re-assigning replaces the old assignee', async () => {
    const task = taskService.create({ title: 'A' });
    await request(app).patch(`/tasks/${task.id}/assign`).send({ assignee: 'Rohit' });
    const res = await request(app).patch(`/tasks/${task.id}/assign`).send({ assignee: 'Priya' });
    expect(res.status).toBe(200);
    expect(res.body.assignee).toBe('Priya');
  });
});