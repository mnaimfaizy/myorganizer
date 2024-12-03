import bodyParser from 'body-parser';
import cors from 'cors';
import express from 'express';
import request from 'supertest';
import { RegisterRoutes } from './routes/routes';
import todosRouter from './routes/todo';
import usersRouter from './routes/user';

const app = express();

const corsOptions = {
  origin: ['https://myorganizerapi.mnfprofile.com', 'http://localhost:3000'],
};

app.use(cors(corsOptions));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

RegisterRoutes(app);
app.use('/todos', todosRouter);
app.use('/users', usersRouter);

describe('Main Application', () => {
  it('should have CORS enabled for specific origins', async () => {
    const response = await request(app)
      .options('/')
      .set('Origin', corsOptions.origin[0]);
    expect(response.headers['access-control-allow-origin']).toBe(
      corsOptions.origin[0]
    );
  });

  it('should register /todos route', async () => {
    const response = await request(app).get('/todos');
    expect(response.status).not.toBe(404);
  });

  it('should register /users route', async () => {
    const response = await request(app).get('/users');
    expect(response.status).not.toBe(404);
  });
});
