import * as moment from 'moment';
import * as R from 'ramda';


const utcToDateString = (utc?: number): (string | null) =>
  utc ? moment.unix(utc / 1000).format('YYYY-MM-DD') : null;

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
 * Get the current date and all preceeding dates that are not
 * before the provided initialDate.
 */
function getDatesAfter(initialDate: string): string[] {
  let days = 0;
  let date = moment();
  while (!(moment(date).isBefore(initialDate))) {
    date = date.subtract(1, 'day');
    days += 1;
  }
  return getDates(days);
}

export { getDates, getDatesAfter, utcToDateString };
