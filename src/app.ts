'use strict';

import * as express from 'express';
import { getStats } from './services/regions';
import { updateStats } from './services/earthquakeData';

const app = express();

app.get('/regions', (req: express.Request, res: express.Response, next: express.NextFunction) => {
  updateStats(req.query);
  res.send('hello there');
});

export = app;
