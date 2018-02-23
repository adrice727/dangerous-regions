import * as R from 'ramda';
import { db } from './firebase';

async function getStats({
  count = 10,
  days = 30,
  clustering,
}: { count?: number, days?: number, clustering?: string }): Promise<RegionStats[]> {

  return Promise.resolve([]);
}


export { getStats };
