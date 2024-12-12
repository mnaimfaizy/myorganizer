import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, {
  Request as ExRequest,
  Response as ExResponse,
  NextFunction,
} from 'express';
import session from 'express-session';
import * as path from 'path';
import swaggerUi from 'swagger-ui-express';
import { ValidateError } from 'tsoa';
import authRouter from './routes/auth';
import { RegisterRoutes } from './routes/routes';
import todosRouter from './routes/todo';
import usersRouter from './routes/user';
import passport from './utils/passport';

const routerPrefix = process.env.ROUTER_PREFIX || '';
const app = express();

// CORS is enabled for the selected origins
const corsOptions = {
  origin: ['https://myorganizerapi.mnfprofile.com', 'http://localhost:3000'],
};

// Middleware to parse JSON bodies
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Serve the Swagger UI at /docs
app.use('/docs', swaggerUi.serve, async (_req: ExRequest, res: ExResponse) => {
  const swaggerDocument = await import('./swagger/swagger.json').then(
    (module) => module.default
  );
  res.send(swaggerUi.generateHTML(swaggerDocument));
});

// Enable CORS
app.use(cors(corsOptions));

// Enable session
app.use(
  session({
    secret: 'secret', // TODO: Change this to a secure secret
    resave: false,
    saveUninitialized: true,
    cookie: { secure: process.env.NODE_ENV === 'production' },
  })
);

// Enable cookie parser
app.use(cookieParser());

// Serve the static files
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use(express.static('templates'));

// Initialize passport
app.use(passport.initialize());

// Define the routes
app.use(`${routerPrefix}/todo`, todosRouter);
app.use(`${routerPrefix}/user`, usersRouter);
app.use(`${routerPrefix}/auth`, authRouter);

// Register the routes
RegisterRoutes(app);

// Error handler for 404 routes
app.use(function notFoundHandler(_req, res: ExResponse) {
  res.status(404).send({
    message: 'Not Found',
  });
});

// Error handler for Tsoa validation errors
app.use(function errorHandler(
  err: unknown,
  req: ExRequest,
  res,
  next: NextFunction
) {
  if (err instanceof ValidateError) {
    console.warn(`Caught Validation Error for ${req.path}:`, err.fields);
    return res.status(422).json({
      message: 'Validation Failed',
      details: err?.fields,
    });
  }
  if (err instanceof Error) {
    return res.status(500).json({
      message: 'Internal Server Error',
    });
  }

  next();
});

const port = process.env.PORT || 3000;
const server = app.listen(port, () => {
  console.log(`Listening at: http://localhost:${port}/`);
});
server.on('error', console.error);
