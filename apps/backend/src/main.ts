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
import { createCorsOptions, getSessionSecret } from './config/http';
import { vaultRateLimiter } from './middleware/vaultRateLimit';
import authRouter from './routes/auth';
import { RegisterRoutes } from './routes/routes';
import todosRouter from './routes/todo';
import usersRouter from './routes/user';
import passport from './utils/passport';

function normalizeRouterPrefix(raw: string | undefined): string {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return '';
  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  const withoutTrailingSlash = withLeadingSlash.replace(/\/+$/, '');
  return withoutTrailingSlash === '/' ? '' : withoutTrailingSlash;
}

function joinPath(a: string, b: string): string {
  const left = normalizeRouterPrefix(a);
  const right = normalizeRouterPrefix(b);
  if (!left) return right;
  if (!right) return left;
  return `${left}${right}`;
}

const routerPrefix =
  normalizeRouterPrefix(process.env.ROUTER_PREFIX) || '/api/v1';

// cPanel Passenger can mount the app under a base URI.
// When configured, requests arrive with that base prefix.
const passengerBaseUri = normalizeRouterPrefix(process.env.PASSENGER_BASE_URI);
const app = express();

// Middleware to parse JSON bodies
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json({ limit: '2mb' }));

// Serve Swagger UI.
function mountSwagger(mountPath: string) {
  app.use(
    mountPath,
    swaggerUi.serve,
    async (_req: ExRequest, res: ExResponse) => {
      const swaggerDocument = await import('./swagger/swagger.json').then(
        (module) => module.default
      );

      // tsoa spec config is generated with a localhost server; override it at runtime
      // so Swagger "Try it out" targets the actual deployed host.
      const req = _req;
      const forwardedProto = (
        req.headers['x-forwarded-proto'] as string | undefined
      )
        ?.split(',')[0]
        ?.trim();
      const proto = forwardedProto || req.protocol;
      const host = req.get('host');
      const origin = host ? `${proto}://${host}` : '';

      const canonicalApiBase = origin
        ? `${origin}${joinPath(passengerBaseUri, routerPrefix)}`
        : '';
      const rootApiBase = origin ? `${origin}${passengerBaseUri || ''}` : '';

      const doc = JSON.parse(JSON.stringify(swaggerDocument)) as any;
      const servers: Array<{ url: string; description?: string }> = [];
      if (canonicalApiBase) {
        servers.push({ url: canonicalApiBase, description: 'API (prefixed)' });
      }
      if (rootApiBase && rootApiBase !== canonicalApiBase) {
        servers.push({ url: rootApiBase, description: 'API (root)' });
      }
      if (servers.length > 0) {
        doc.servers = servers;
      }

      res.send(swaggerUi.generateHTML(doc));
    }
  );
}

// Swagger UI is exposed at common locations.
// Keep it accessible regardless of router prefix and Passenger base URI.
const swaggerMounts = new Set<string>();
swaggerMounts.add('/docs');
swaggerMounts.add(`${routerPrefix}/docs`);
if (passengerBaseUri) {
  swaggerMounts.add(joinPath(passengerBaseUri, '/docs'));
  swaggerMounts.add(joinPath(passengerBaseUri, `${routerPrefix}/docs`));
}
for (const mountPath of swaggerMounts) {
  mountSwagger(mountPath);
}

// Enable CORS
app.use(cors(createCorsOptions()));

// Enable session
app.use(
  session({
    secret: getSessionSecret(),
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

// Define the API routes under a single prefix.
const api = express.Router();
api.use('/todo', todosRouter);
api.use('/user', usersRouter);
api.use('/auth', authRouter);

// Apply additional protections for blind-storage endpoints.
api.use('/vault', vaultRateLimiter);

// Register tsoa routes
RegisterRoutes(api);

// Mount API routes in a tolerant way to avoid base-path/prefix mismatches
// across local dev, reverse proxies, and cPanel Passenger.
const apiMounts = new Set<string>();
apiMounts.add(routerPrefix);
apiMounts.add('');
if (passengerBaseUri) {
  apiMounts.add(passengerBaseUri);
  apiMounts.add(joinPath(passengerBaseUri, routerPrefix));
}
for (const mountPath of apiMounts) {
  app.use(mountPath || '/', api);
}

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
