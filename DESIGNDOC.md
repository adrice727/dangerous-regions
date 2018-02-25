## Design Impovements

#### Data Persistence

We're current persisting data from USGS to Firebase by means of a Cron Job that runs every 15 minutes. This allows us to calculate scores for regions using more than 30 days worth of data.  It also allows us to fetch data for specific dates instead of having to fetch the entire JSON object from USGS on every request.  But there are a couple ways this can be improved.

First, if we know exactly when the USGS data is updated, we can sync our Cron Job with the USGS updates so that the data in Firebase is always as update-to-date as possible.

Second, we're currently updating the data for the current date every time the Cron Jobs runs. I'm not sure whether or not this needs to be done or not.  It depends on whether or not USGS updates records after initially publishing them. If so, the current method works is preferable.  If not, we can just push new records to Firebase.

## Regions

There are two available region definitions.  The default definition is `country` and the other is `timezone`.  Timezone is an easy choice because it's already available in the USGS data.  While country is certainly more specific than timezone, it can still include a large area.  Saying that the United States or China is dangerous doesn't tell us much about specific regions within those counties.  So, we can likely further leverage the data from reverse geocoding services (e.g. Google Maps, Bing Maps, etc.) to define smaller regions.


## Getting Ready for Production

There are several things that would need to be addressed before moving this to production:

 - Do we want to store our data somewhere other than Firebase?
	 - Do we expect to expand or change the information we're storing in the future?
	 - Will we be running queries for specific information in the future?
	 - How might we structure the data taking into account the two points above?
 - We need to improve error handling.  How much fault tolerance do we want to build into the service? There is a small amount built in (i.e. retrying failed API calls and Firebase updates), but there's certainly more (or less) that can be done.  Also, how do we want to present errors to the user?
 - Tests!  What are our potential points of failure? What happens if one of our data sources changes?  What if we make a change that breaks something?  End-to-end tests would be helpful for these things, and should be fairly easy to write for this service.
