'use strict';

import * as express from 'express';
import { getStats } from './services/regions';

const app = express();

app.get('/regions', (req: express.Request, res: express.Response, next: express.NextFunction) => {
  res.send('hello there');
});

export = app;
