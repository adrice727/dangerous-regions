import * as R from 'ramda';
import * as moment from 'moment';
import { db, DataSnapshot } from './firebase';
import { EarthquakeSummary } from './earthquakeData';


type RegionSummaries = { [key: string]: EarthquakeSummary[] };
type RegionScore = { count: number, totalMagnitude: number };
type ScoredRegionSummaries = { [key: string]: RegionScore };


/**
 * Build an array of dates for which we need to fetch summaries,
 * based on the number of days.
 */
function getDates(days: number): string[] {
  let currentDate = moment();
  moment().subtract(1, 'day');
  return R.range(0, days).map(() => {
    const dateString = currentDate.format('YYYY-MM-DD');
    currentDate = currentDate.subtract(1, 'day');
    return dateString;
  });
}

/**
 * Fetch earthquake summaries for the given dates.
 */
async function fetchSummaries(dates: string[]): Promise<EarthquakeSummary[]> {
  const queries = R.map((date: string) => db.ref(`/earthquakes/${date}`).once('value'), dates);
  const summaries = await Promise.all(queries);
  return R.flatten(
    summaries
      .map((snapshot: DataSnapshot) => snapshot.val())
      .filter(R.complement(R.isNil)),
  );
}

/**
 * Group earthquake summaries by provided region type
 */
function group(regionType: string, summaries: EarthquakeSummary[]): RegionSummaries {
  switch (regionType) {
    case 'timezone':
      return R.groupBy(R.pathOr('', ['properties', 'tz']), summaries);
    default:
      return R.groupBy(R.pathOr('', ['properties', 'tz']), summaries);
  }
}

/**
 * Build RegionStats for all summaries
 */
function scoreRegions(regionType: string, regions: RegionSummaries): RegionStats[] {

  const calculateTotalMagnitude = (summaries: EarthquakeSummary[]): RegionScore => {
    const count = summaries.length;
    const totalMagnitude = R.sum(R.map(R.pathOr(0, ['properties', 'mag']), summaries));
    return { count, totalMagnitude };
  };

  const scoredSummaries: ScoredRegionSummaries = R.map(calculateTotalMagnitude, regions);
  return R.map((region: string) => ({
    name: `${regionType} ${region}`,
    earthquake_count: scoredSummaries[region].count,
    total_magnitude: scoredSummaries[region].totalMagnitude,
  }), R.keys(scoredSummaries));
}

/**
 * Get the most dangerous regions based on the supplied parameters
 */
async function getMostDangerous({
  count = 3,
  days = 30,
  region_type = 'timezone',
}: { count?: number, days?: number, region_type?: string }): Promise<RegionStats[]> {
  const dates = getDates(typeof days === 'string' ? parseInt(days, 10) : days);
  const summaries = await fetchSummaries(dates);
  const groupedData = group(region_type, summaries);
  const scored = scoreRegions(region_type, groupedData);
  const sorted = R.sort((a, b) => b.total_magnitude - a.total_magnitude, scored);
  return R.take(count, sorted);
}


export { getMostDangerous };
