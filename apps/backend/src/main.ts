import bodyParser from 'body-parser';
import cors from 'cors';
import express, { Request as ExRequest, Response as ExResponse } from 'express';
import * as path from 'path';
import swaggerUi from 'swagger-ui-express';
import { RegisterRoutes } from './routes/routes';
import todosRouter from './routes/todo';
import usersRouter from './routes/user';

const routerPrefix = '/api/v1';
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
app.use(express.static('templates'));

// Register the routes
RegisterRoutes(app);

// Define the routes
app.use(`${routerPrefix}/todo`, todosRouter);
app.use(`${routerPrefix}/user`, usersRouter);

const port = process.env.PORT || 3000;
const server = app.listen(port, () => {
  console.log(`Listening at: http://localhost:${port}/`);
});
server.on('error', console.error);
