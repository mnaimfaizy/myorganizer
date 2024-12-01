/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import express, { Response as ExResponse, Request as ExRequest } from 'express';
import cors from 'cors';
import * as path from 'path';
import swaggerUi from 'swagger-ui-express';
import bodyParser from 'body-parser';
import todosRouter from './routes/todo';
import usersRouter from './routes/user';
import { RegisterRoutes } from './routes/routes';

const app = express();

// CORS is enabled for the selected origins
const corsOptions = {
  origin: ['https://myorganizerapi.mnfprofile.com', 'http://localhost:3000'],
};

// Middleware to parse JSON bodies
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use('/docs', swaggerUi.serve, async (_req: ExRequest, res: ExResponse) => {
  const swaggerDocument = await import('./swagger/swagger.json').then(
    (module) => module.default
  );
  res.send(swaggerUi.generateHTML(swaggerDocument));
});
app.use(cors(corsOptions));
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// Register the routes
RegisterRoutes(app);

// Define the routes
app.use('/todos', todosRouter);
app.use('/users', usersRouter);

const port = process.env.PORT || 3000;
const server = app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}/`);
});
server.on('error', console.error);
