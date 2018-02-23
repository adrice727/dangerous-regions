import * as R from 'ramda';
import * as moment from 'moment';
import axios, { AxiosResponse } from 'axios';
import { GeoJsonObject, FeatureCollection, GeometryObject, Point, Feature } from 'geojson';
import { CronJob } from 'cron';
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
}

export interface EarthquakeSummary {
  id?: string | number;
  geometry?: Point;
  properties?: EarthquakeSummaryProps;
  date: string | null;
}

type SummariesByDate = { [key: string]: EarthquakeSummary[] };
interface SummariesByDateWithMostRecent {
  mostRecentDate: string;
  summaries: SummariesByDate;
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
      return { ...acc, [es.date]: [...acc[es.date], es] };
    }
    return { ...acc, [es.date]: [es] };
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
 * Update summaries for specific date in firebase
 */
async function updateSummaries(date: string, summaries: EarthquakeSummary[], retryCount = 2): Promise<void> {
  try {
    await db.ref(`/earthquakes/${date}`).set(summaries);
    console.info(`Updated earthquake summaries for ${date}`);
  } catch (error) {
    if (retryCount > 0) {
      /**
       * If we fail to update the summaries, try again until we
       * exhaust retries. At this point, do nothing. They'll be
       * updated the next time the cron job runs.
       */
      return updateSummaries(date, summaries, retryCount - 1);
    }
    console.error(`Failed to update summaries in firebase for ${date}`);
  }
}

/**
 * Every 15 minutes, fetch data from USGS and update the summaries
 * for the current date, and update the `last-update` property
 * in firebase.
 */
new CronJob('* 15 * * * *', async () => {
  try {
    const snapshot: DataSnapshot = await db.ref('/last-update').once('value');
    const lastUpdate = snapshot.val();
    if (lastUpdate) {
      const { summaries, mostRecentDate } = await buildNewSummaries(lastUpdate);
      const update = async (date: string): Promise<void> => await updateSummaries(date, summaries[date]);
      await Promise.all(R.keys(summaries).map(update, summaries));
      await db.ref('/last-update').set(mostRecentDate);
    }
  } catch (error) {
    console.error('Failed to update earthquake data', error);
  }
}, undefined, true, 'America/Los_Angeles', null, true);

export { Earthquake, EarthquakeCollection };

