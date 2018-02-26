import * as R from 'ramda';
import * as moment from 'moment';
import axios, { AxiosResponse } from 'axios';
import { db, DataSnapshot } from './firebase';
import { fetchSummaries, EarthquakeSummary } from './earthquakeData';
import { getDates } from '../util';
import * as googleCredentialsJson from '../../config/google-credentials.json';
import * as bingMapsKey from '../../config/bing-maps-key.json';

type RegionSummaries = { [key: string]: EarthquakeSummary[] };
type RegionScore = { count: number, totalMagnitude: number };
type ScoredRegionSummaries = { [key: string]: RegionScore };

/**
 * Group earthquake summaries by provided region type
 */
async function group(regionType: RegionType, summaries: EarthquakeSummary[]): Promise<RegionSummaries> {
  switch (regionType) {
    case 'timezone':
      return R.groupBy(R.pathOr('', ['properties', 'tz']), summaries);
    case 'country':
      const summariesWithCountry = R.groupBy(R.pathOr(null, ['properties', 'country']), summaries);
      // If country property is missing (i.e. is null), let's omit the results
      return R.omit(['null'], summariesWithCountry);
    default:
      return group('country', summaries);
  }
}

/**
 * Build RegionStats for all summaries
 */
function scoreRegions(regionType: string, regions: RegionSummaries): RegionStats[] {

  const calculateTotalMagnitude = (summaries: EarthquakeSummary[]): RegionScore => {
    const count = summaries.length;
    const getMagnitude = R.pathOr(0, ['properties', 'mag']);
    const power10 = (mag: number) => Math.pow(10, mag);
    const calcEnergy = R.compose(power10, getMagnitude);
    const totalMagnitude = parseFloat(Math.log10(R.sum(R.map(calcEnergy, summaries))).toFixed(2));
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
  region_type = 'country',
}: { count?: number, days?: number, region_type?: RegionType }): Promise<RegionStats[]> {
  const dates = getDates(typeof days === 'string' ? parseInt(days, 10) : days);
  const summaries = await fetchSummaries(dates);
  const groupedData = await group(region_type, summaries);
  const scored = scoreRegions(region_type, groupedData);
  const sorted = R.sort((a, b) => b.total_magnitude - a.total_magnitude, scored);
  return R.take(count, sorted);
}

export { getMostDangerous };
