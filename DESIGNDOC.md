## Design Impovements

#### Data Persistence

We're current persisting data from USGS to Firebase by means of a Cron Job that runs every 15 minutes. This allows us to calculate scores for regions using more than 30 days worth of data.  It also allows us to fetch data for specific dates instead of having to fetch the entire JSON object from USGS on every request.  But there are a couple ways this can be improved.

First, if we know exactly when the USGS data is updated, we can sync our Cron Job with the USGS updates so that the data in Firebase is always as update-to-date as possible.

Second, we're currently replacing the data for the current date every time the Cron Jobs runs. It would be better if we were instead only adding new data. Since the data from USGS is in chronological order, we could theoretically do this by keeping track of the `updated` property of the last event added.  However, we would first need to ensure that this data doesn't change from update to update, so that we don't end up missing or duplicating events.


