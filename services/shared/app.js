const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const { notFound, errorHandler } = require('./errors');

function requireEnv(...names) {
  const missing = names.filter((n) => !process.env[n]);
  if (missing.length) {
    console.error(`Faltan variables de entorno: ${missing.join(', ')}`);
    process.exit(1);
  }
}

function createApp(serviceName) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1); // detrás del gateway nginx
  app.use(helmet());
  app.use(morgan('tiny'));
  app.use(express.json({ limit: '1mb' }));
  app.get('/health', (req, res) => res.json({ service: serviceName, status: 'ok' }));
  return app;
}

const finish = (app) => {
  app.use(notFound);
  app.use(errorHandler);
};

module.exports = { createApp, finish, requireEnv };
