import * as R from 'ramda';
import * as moment from 'moment';
import axios, { AxiosResponse } from 'axios';
import { db, DataSnapshot } from './firebase';
import { EarthquakeSummary } from './earthquakeData';
import * as googleCredentialsJson from '../../config/google-credentials.json';

type RegionSummaries = { [key: string]: EarthquakeSummary[] };
type RegionScore = { count: number, totalMagnitude: number };
type ScoredRegionSummaries = { [key: string]: RegionScore };
type AddressComponent = { long_name: string, types: string[] };
type GoogleMapsResponse = { status: string, results: { address_component: AddressComponent[] }[] };
interface EarthquakeSummaryWithCountry extends EarthquakeSummary {
  country: string | null;
}



/**
 * Add a country property to an EarthquakeSummary.  If the summary is missing
 * coordinates or we don't get an AddressComponent with a country, we set the
 * country to null.
 */
async function addCountryToSummary(summary: EarthquakeSummary): Promise<EarthquakeSummaryWithCountry> {
  const coords = R.pathOr([], ['geometry', 'coordinates'], summary);
  const apiKey: string = R.propOr('', 'mapsApiKey', googleCredentialsJson);
  if (!coords) {
    return { ...summary, country: null };
  }
  const [long, lat] = coords;
  const gMapsUrl = (long: number, lat: number): string =>
    `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${long}`;
  try {
    /**
     * We need to find the address component with the type of 'country'
     * https://goo.gl/E8e9mx
    */
    const response: AxiosResponse<GoogleMapsResponse> = await axios(gMapsUrl(long, lat));
    if (response.data.status !== 'OK') {
      return { ...summary, country: null };
    }
    // All address components
    const components: AddressComponent[] = R.flatten(R.map(R.prop('address_components'), response.data.results));
    // Components with type of country
    const countryComponents = R.filter((c: AddressComponent) => R.contains('country', R.prop('types', c)), components);
    // The country or null
    const country: string | null = R.propOr(null, 'long_name', R.head(countryComponents) || {});

    return { ...summary, country };
  } catch (error) {
    console.log(error);
    return { ...summary, country: null };
  }
}


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
async function group(regionType: string, summaries: EarthquakeSummary[]): Promise<RegionSummaries> {

  switch (regionType) {
    case 'timezone':
      return R.groupBy(R.pathOr('', ['properties', 'tz']), summaries);
    case 'country':
      const summariesWithCountry = await Promise.all(R.map(addCountryToSummary, summaries));
      // If country is missing (i.e. is null), let's omit the results
      return R.omit(['null'], R.groupBy(R.propOr(null, 'country'), summariesWithCountry));
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
  const groupedData = await group(region_type, summaries);
  const scored = scoreRegions(region_type, groupedData);
  const sorted = R.sort((a, b) => b.total_magnitude - a.total_magnitude, scored);
  return R.take(count, sorted);
}

export { getMostDangerous };
