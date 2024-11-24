/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import express from 'express';
import cors from 'cors';
import * as path from 'path';
import { specs, swaggerUi } from './swagger';
import { PrismaClient } from '@backend/prisma-schema';
import * as bodyParser from 'body-parser';
import todosRouter from './routes/todo';

const app = express();

const prisma = new PrismaClient();

// CORS is enabled for the selected origins
let corsOptions = {
  origin: [ 'https://myorganizerapi.mnfprofile.com', 'http://localhost:3000' ]
};

// Middleware to parse JSON bodies
app.use(bodyParser.json());
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));
app.use(cors(corsOptions));
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use('/todos', todosRouter);

const port = process.env.PORT || 3000;
const server = app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}/`);
});
server.on('error', console.error);
