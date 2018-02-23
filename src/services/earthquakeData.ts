import * as R from 'ramda';
import * as moment from 'moment';
import axios, { AxiosResponse } from 'axios';
import { GeoJsonObject, FeatureCollection, GeometryObject, Point, Feature } from 'geojson';
import { db } from './firebase';
import { utcToDateString } from '../util';

/** Types */
type Earthquake = Feature<Point, EarthquakeProperties>;

type EarthquakeCollection = FeatureCollection<Point, EarthquakeProperties>;

interface SummaryProperties {
  mag: number;
  place: string;
  time: number;
  updated: number;
  tz: number;
  magType: string;
  type: string;
}

interface EarthquakeSummary {
  id?: string | number;
  geometry?: Point;
  properties?: SummaryProperties;
  date: string | null;
}

type SummariesByDate = { [key: string]: EarthquakeSummary[] };
/** ***** */


const normalize = R.pick(['id', 'geometry']);
const getTime: ({ }) => (number | undefined) = R.path(['properties', 'time']);
const getSummaryProps = R.pick(['mag', 'place', 'time', 'updated', 'tz', 'magType', 'type']);
const geoDataUrl = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_month.geojson';

/**
 * Extract the relevant data from an Earthquake Feature
 */
function buildSummary(earthquake: Earthquake): EarthquakeSummary {
  return {
    ...normalize(earthquake),
    properties: getSummaryProps(earthquake.properties),
    date: utcToDateString(getTime(earthquake))
  };
}

function groupByDate(summaries: EarthquakeSummary[]): SummariesByDate {

  const group = (acc: SummariesByDate, es: EarthquakeSummary): SummariesByDate => {
    if (!es.date) {
      return acc;
    }
    if (acc[es.date]) {
      return { ...acc, [es.date]: [...acc[es.date], es] };
    }
    return { ...acc, [es.date]: [es] };
  };

  return R.reduce(group, {}, summaries);
}


function parseCollection(collection: EarthquakeCollection): void {
  const summaries: EarthquakeSummary[] = collection.features.map(buildSummary);
  const byDate = groupByDate(summaries);
}

async function updateStats({
  count = 10,
  days = 30,
  clustering,
}: { count?: number, days?: number, clustering?: string }): Promise<RegionStats[]> {

  try {
    const response: AxiosResponse<EarthquakeCollection> = await axios.get(geoDataUrl);
    parseCollection(response.data);
  } catch (error) {
    throw new Error('Failed to fetch regions data');
  }

  return [];
}

export { updateStats, Earthquake, EarthquakeCollection };

