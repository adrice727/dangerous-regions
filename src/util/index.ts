import * as moment from 'moment';
import * as R from 'ramda';


const utcToDateString = (utc?: number): (string | null) =>
  utc ? moment.unix(utc / 1000).format('MM-DD-YYYY') : null;

export { utcToDateString };
