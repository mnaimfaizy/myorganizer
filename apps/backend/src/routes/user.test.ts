import bodyParser from 'body-parser';
import express from 'express';
import request from 'supertest';
import userRouter from './user';

jest.mock('../utils/passport', () => ({
  __esModule: true,
  default: {
    authenticate: () => (_req: any, _res: any, next: any) => next(),
  },
}));

const app = express();
app.use(bodyParser.json());
// Mount at /user to match production (main.ts uses api.use('/user', usersRouter)).
app.use('/user', userRouter);

describe('User Routes (legacy closed)', () => {
  test('GET /user returns 404 Not Found', async () => {
    const response = await request(app).get('/user');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: 'Not Found' });
  });

  test('GET /user/:userId returns 404 Not Found', async () => {
    const response = await request(app).get('/user/1');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: 'Not Found' });
  });

  test('POST /user returns 404 Not Found', async () => {
    const response = await request(app)
      .post('/user')
      .send({ name: 'John Doe' });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: 'Not Found' });
  });
});
