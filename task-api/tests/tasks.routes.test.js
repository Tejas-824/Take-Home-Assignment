const request = require('supertest');
const app = require('../src/app');
const taskService = require('../src/services/taskService');

beforeEach(() => {
  taskService._reset();
});

describe('POST /tasks', () => {
  test('creates a task and returns 201', async () => {
    const res = await request(app).post('/tasks').send({ title: 'Write tests', priority: 'high' });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Write tests');
    expect(res.body.id).toBeDefined();
  });

  test('400 when title is missing', async () => {
    const res = await request(app).post('/tasks').send({ priority: 'low' });
    expect(res.status).toBe(400);
  });

  test('400 for an invalid status', async () => {
    const res = await request(app).post('/tasks').send({ title: 'A', status: 'pending' });
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

  test('paginates with page and limit', async () => {
    for (let i = 1; i <= 15; i++) taskService.create({ title: `Task ${i}` });
    const page1 = await request(app).get('/tasks?page=1&limit=10');
    const page2 = await request(app).get('/tasks?page=2&limit=10');
    expect(page1.body).toHaveLength(10);
    expect(page2.body).toHaveLength(5);
  });
});

describe('PUT /tasks/:id', () => {
  test('updates a task', async () => {
    const task = taskService.create({ title: 'Old' });
    const res = await request(app).put(`/tasks/${task.id}`).send({ title: 'New' });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('New');
  });

  test('404 for an unknown id', async () => {
    const res = await request(app).put('/tasks/nope').send({ title: 'x' });
    expect(res.status).toBe(404);
  });

  test('400 for an empty title', async () => {
    const task = taskService.create({ title: 'Old' });
    const res = await request(app).put(`/tasks/${task.id}`).send({ title: '' });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /tasks/:id', () => {
  test('deletes a task and returns 204', async () => {
    const task = taskService.create({ title: 'A' });
    const res = await request(app).delete(`/tasks/${task.id}`);
    expect(res.status).toBe(204);
    expect(taskService.getAll()).toHaveLength(0);
  });

  test('404 for an unknown id', async () => {
    const res = await request(app).delete('/tasks/nope');
    expect(res.status).toBe(404);
  });
});

describe('PATCH /tasks/:id/complete', () => {
  test('marks the task done', async () => {
    const task = taskService.create({ title: 'A' });
    const res = await request(app).patch(`/tasks/${task.id}/complete`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('done');
    expect(res.body.completedAt).not.toBeNull();
  });

  test('404 for an unknown id', async () => {
    const res = await request(app).patch('/tasks/nope/complete');
    expect(res.status).toBe(404);
  });
});

describe('GET /tasks/stats', () => {
  test('returns counts and the overdue number', async () => {
    taskService.create({ title: 'A', dueDate: '2000-01-01T00:00:00.000Z' });
    taskService.create({ title: 'B', status: 'done' });
    const res = await request(app).get('/tasks/stats');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ todo: 1, in_progress: 0, done: 1, overdue: 1 });
  });
});

describe('PATCH /tasks/:id/assign', () => {
  const assign = (id, body) => request(app).patch(`/tasks/${id}/assign`).send(body);

  test('assigns a task', async () => {
    const task = taskService.create({ title: 'A' });
    const res = await assign(task.id, { assignee: 'Rohit' });
    expect(res.status).toBe(200);
    expect(res.body.assignee).toBe('Rohit');
  });

  test('trims spaces around the name', async () => {
    const task = taskService.create({ title: 'A' });
    const res = await assign(task.id, { assignee: '  Rohit  ' });
    expect(res.body.assignee).toBe('Rohit');
  });

  test('404 if the task does not exist', async () => {
    const res = await assign('nope', { assignee: 'Rohit' });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Task not found');
  });

  // Same test, run once per bad value: empty, spaces only, not a string, missing, too long
  test.each([[''], ['   '], [123], [undefined], ['a'.repeat(101)]])(
    '400 for invalid assignee %p',
    async (bad) => {
      const task = taskService.create({ title: 'A' });
      const res = await assign(task.id, { assignee: bad });
      expect(res.status).toBe(400);
    }
  );

  test('re-assigning replaces the old assignee', async () => {
    const task = taskService.create({ title: 'A' });
    await assign(task.id, { assignee: 'Rohit' });
    const res = await assign(task.id, { assignee: 'Priya' });
    expect(res.status).toBe(200);
    expect(res.body.assignee).toBe('Priya');
  });
});