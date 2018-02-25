### Overview

*Dangerous Regions* is built with TypeScript, Node.js, Express, and Firebase.  It obtains earthquake data from [USGS](https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php) and uses the Bing Maps API for reverse geocoding.

#### Install Dependencies and Compile:

```
$ npm run build
```

#### Config:

You will need to set up a Firebase instance and save your [service account credentials](https://firebase.google.com/docs/admin/setup) as `firebase-credentials.json` in the `config` directory.  You will also need to update the `databaseURL` in `services/firebase.ts` to point to your Firebase instance.

You will also need a `bing-maps-key.json` file in `config`.  This JSON file should have a single key, `mapsApiKey`, which points to your [Bing Maps API Key](https://msdn.microsoft.com/en-us/library/ff428642.aspx).

#### Run:
```
$ npm run start
```

*Alternatively, after running `npm run build`, you can run `npm run watch` to automatically recompile and restart the server whenever changes occur.*

#### Service:

You can access the service at `localhost:8080/regions`.  This endpoint accepts three query parameters:

- `days` (default:  30)
	- The number of days to consider
- `count` (default: 10)
	- The top `n` results to return
- `region_type`
	- How to define a region? Current options are:
			- `country` (default)
			- `timezone`

As an example, the following query:
```html
localhost:8080/regions?days=10&count=3&region_type=country
```
might return the following JSON results:
```javascript
[
  {
    "name": "country United States",
    "earthquake_count": 16,
    "total_magnitude": 22.06
  },
  {
    "name": "country Indonesia",
    "earthquake_count": 6,
    "total_magnitude": 12.4
  },
  {
    "name": "country Chile",
    "earthquake_count": 4,
    "total_magnitude": 6.1
  }
]
```

If we define regions by `timezone`, our results might look like:

```javascript
[
  {
    "name": "timezone -300",
    "earthquake_count": 11,
    "total_magnitude": 19.16
  },
  {
    "name": "timezone -1000",
    "earthquake_count": 9,
    "total_magnitude": 9.4
  },
  {
    "name": "timezone 500",
    "earthquake_count": 5,
    "total_magnitude": 7.1
  }
]
```