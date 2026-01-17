import bodyParser from 'body-parser';
import cors from 'cors';
import express from 'express';
import request from 'supertest';
import { createCorsOptions } from './config/http';
import { RegisterRoutes } from './routes/routes';
import usersRouter from './routes/user';

const app = express();

beforeAll(() => {
  process.env.CORS_ORIGINS =
    'https://myorganizerapi.mnfprofile.com,http://localhost:3000';
  process.env.ROUTER_PREFIX = '/api/v1';
});

afterAll(() => {
  delete process.env.CORS_ORIGINS;
  delete process.env.ROUTER_PREFIX;
});

const corsOptions = createCorsOptions();

app.use(cors(corsOptions));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const prefix = process.env.ROUTER_PREFIX || '/api/v1';
const api = express.Router();
api.use('/user', usersRouter);
RegisterRoutes(api);
app.use(prefix, api);

describe('Main Application', () => {
  it('should have CORS enabled for specific origins', async () => {
    const response = await request(app)
      .options('/')
      .set('Origin', 'https://myorganizerapi.mnfprofile.com');
    expect(response.headers['access-control-allow-origin']).toBe(
      'https://myorganizerapi.mnfprofile.com',
    );
  });

  it('should register /users route', async () => {
    const response = await request(app).get('/api/v1/user');
    expect(response.status).not.toBe(404);
  });
});
