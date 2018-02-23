'use strict';

import * as express from 'express';
import { getMostDangerous } from './services/regions';

const app = express();

app.get('/regions', async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    const results = await getMostDangerous(req.query);
    res.send(results);
  } catch (error) {
    res.status(500).send(new Error('We were unable to fetch results. Please try again'));
  }
});

export = app;
