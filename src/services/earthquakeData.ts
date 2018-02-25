import * as R from 'ramda';
import * as moment from 'moment';
import axios, { AxiosResponse } from 'axios';
import { GeoJsonObject, FeatureCollection, GeometryObject, Point, Feature } from 'geojson';
import { CronJob } from 'cron';
import * as bingMapsKey from '../../config/bing-maps-key.json';
import { db, DataSnapshot } from './firebase';
import { utcToDateString } from '../util';
import { QuerySnapshot, DocumentSnapshot } from '@google-cloud/firestore';

/** Types */
type Earthquake = Feature<Point, EarthquakeProperties>;

type EarthquakeCollection = FeatureCollection<Point, EarthquakeProperties>;

interface EarthquakeSummaryProps {
  mag: number;
  place: string;
  time: number;
  updated: number;
  tz: number;
  magType: string;
  type: string;
  country?: string | null;
}

export interface EarthquakeSummary {
  id: string | number;
  geometry?: Point;
  properties?: EarthquakeSummaryProps;
  date: string | null;
}

type SummariesByDate = { [key: string]: { [key: string]: EarthquakeSummary } };
interface SummariesByDateWithMostRecent {
  mostRecentDate: string;
  summaries: SummariesByDate;
}

type BingMapsResponse = {
  statusCode: string,
  resourceSets: { resources: { address: { countryRegion: string } }[] }[];
};

interface EarthquakeSummaryWithCountry extends EarthquakeSummary {
  country: string | null;
}


/** Helper functions */
const normalize = R.pick(['id', 'geometry']);
const getTime: ({ }) => (number | undefined) = R.path(['properties', 'time']);
const getSummaryProps = R.pick(['mag', 'place', 'time', 'updated', 'tz', 'magType', 'type']);
const geoDataUrl = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_month.geojson';
const extractDateString = R.compose(utcToDateString, getTime);

/**
 * Extract the relevant data from an Earthquake
 */
function buildSummary(earthquake: Earthquake): EarthquakeSummary {
  return {
    ...normalize(earthquake),
    properties: getSummaryProps(earthquake.properties),
    date: extractDateString(earthquake),
  };
}

/**
 * Group summaries by date
 */
function groupByDate(summaries: EarthquakeSummary[]): SummariesByDateWithMostRecent {
  const group = (acc: SummariesByDate, es: EarthquakeSummary): SummariesByDate => {
    if (!es.date) {
      return acc;
    }
    if (acc[es.date]) {
      return { ...acc, [es.date]: { ...acc[es.date], [es.id]: es } };
    }
    return { ...acc, [es.date]: { [es.id]: es } };
  };
  const groupedSummaries: SummariesByDate = R.reduce(group, {}, summaries);
  const mostRecentDate = R.reduce((acc, date) => {
    return moment(date).isAfter(acc) ? date : acc;
  }, '2000-01-01', R.keys(groupedSummaries));

  return { mostRecentDate, summaries: groupedSummaries };

}

/**
 * Build a collection of new summaries, grouped by date, to be added
 * to firebase.
 */
async function buildNewSummaries(lastUpdate: string): Promise<SummariesByDateWithMostRecent> {
  /**
   * We should change how we're building the `newEvents` list since
   * we may have Earthquakes that are missing a `time` property.
   */
  const beforeLastUpdate = (date: string | null): boolean =>
    date ? moment(date).isBefore(lastUpdate) : false;
  try {
    const response: AxiosResponse<EarthquakeCollection> = await axios.get(geoDataUrl);
    const isNewEvent = (e: Earthquake): boolean => !beforeLastUpdate(extractDateString(e));
    const newEventSummaries = R.takeWhile(isNewEvent, response.data.features).map(buildSummary);
    return groupByDate(newEventSummaries);
  } catch (error) {
    throw new Error('Failed to fetch regions data');
  }
}

/**
 * Get the country for a set of coordinates. If not found, return null.
 */
async function getCountryForCoords(lat: number, long: number, retryCount = 1): Promise<string | null> {
  console.log(lat, long);
  const apiKey: string = R.propOr('', 'mapsApiKey', bingMapsKey);
  const bingMapsUrl = (long: number, lat: number): string =>
    `http://dev.virtualearth.net/REST/v1/Locations/${lat},${long}?key=${apiKey}`;
  try {
    const response: AxiosResponse<BingMapsResponse> = await axios(bingMapsUrl(long, lat));
    if (response.statusText !== 'OK') {
      return null;
    }
    const country = R.pathOr(null, ['resourceSets', '0', 'resources', '0', 'address', 'countryRegion'], response.data);
    console.info(country);
    return country;

  } catch (error) {
    console.error('Bing Maps API Error', error.message);
    if (retryCount > 0) {
      return getCountryForCoords(lat, long, retryCount - 1);
    }
    return null;
  }
}

/**
 * Update summaries in Firebase
 */
async function updateSummary(
  date: string,
  summaries: { [key: string]: EarthquakeSummary },
  retryCount: number = 3,
): Promise<void> {
  try {
    await db.ref(`earthquakes/${date}`).update(summaries);
  } catch (error) {
    if (retryCount > 0) {
      return updateSummary(date, summaries, retryCount - 1);
    }
  }
}

/**
 * Update a summary with it's associated country and then update in Firbase.
 */
async function updateWithCountry(date: string, summary: EarthquakeSummary, lat: number, long: number) {
  const country = await getCountryForCoords(lat, long);
  const propertiesWithCountry = R.assoc('country', country, summary.properties);
  const summaryWithCountry = R.assoc('properties', propertiesWithCountry, summary);
  updateSummary(date, { [summary.id]: summaryWithCountry });
}

/**
 * Separate summaries with coords and without coordinates.  Those with coordinates will be updated
 * with country information before being saved in Firebase. Those without can be saved immediately.
 */
function getCountriesAndUpdate(summariesByDate: SummariesByDate): void {
  type SummaryWithCoords = {date: string, summary: EarthquakeSummary, lat: number, long: number };
  const summariesMissingCoords: SummariesByDate = {};
  const summariesWithCoords: SummaryWithCoords[] = [];

  const checkForCoords = (date: string, summaries: EarthquakeSummary[]): void => {
    const check = (summary: EarthquakeSummary): void => {
      const coords = R.pathOr(null, ['geometry', 'coordinates'], summary);
      if (!coords) {
        summariesMissingCoords[date] = summariesMissingCoords[date] || {};
        summariesMissingCoords[date][summary.id] = summary;
      } else {
        const [long, lat] = coords;
        summariesWithCoords.push({ date, summary, lat, long });
      }
    };
    R.forEach(check, summaries);
  };


  R.forEach((date: string) => checkForCoords(date, R.values(summariesByDate[date])), R.keys(summariesByDate));

  // Update the summaries missing coordinates (which seem to be few to none)
  R.forEach((date: string) => updateSummary(date, summariesMissingCoords[date]), R.keys(summariesMissingCoords));

  /**
   * Since we need to space out our Maps API calls to avoid rate limiting issues,
   * we'll update each summary at an interval.  This will also work if we ever need to
   * repopulate the database from scratch (as I found out).
   *
   * Footnote: Bing Maps has higher rate limits and more sanely structured results
   * than Google Maps. Who knew?
  */
  const intervalId = setInterval(() => {
    const next = summariesWithCoords.shift();
    if (next) {
      const { date, summary, lat, long  } = next;
      updateWithCountry(date, summary, lat, long);
    }
    if (R.isEmpty(summariesWithCoords)) {
      clearInterval(intervalId);
    }
  }, 1500);

}

/**
 * Every 15 minutes, fetch data from USGS and update the summaries
 * for the current date, and update the `last-update` property
 * in firebase.
 */
new CronJob('* 300 * * * *', async () => {
  try {
    const snapshot: DataSnapshot = await db.ref('/last-update').once('value');
    const lastUpdate = snapshot.val();
    if (lastUpdate) {
      // const { summaries, mostRecentDate } = await buildNewSummaries(lastUpdate);
      // await getCountriesAndUpdate(summaries);
      // await db.ref('/last-update').set(mostRecentDate);
    }
  } catch (error) {
    console.error('Failed to update earthquake data', error);
  }
}, undefined, true, 'America/Los_Angeles', null, true);

export { Earthquake, EarthquakeCollection };
