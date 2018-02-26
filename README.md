### Overview

*Dangerous Regions* is built with TypeScript, Node.js, Express, and Firebase.  It obtains earthquake data from [USGS](https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php) and uses the Bing Maps API for reverse geocoding.

#### Install Dependencies and Compile:

```
$ npm run build
```

#### Config:

You will need to set up a Firebase instance and save your [service account credentials](https://firebase.google.com/docs/admin/setup) as `firebase-credentials.json` in the `config` directory.

You will also need a `bing-maps-key.json` file in `config`.  This JSON file should have a single key, `mapsApiKey`, which points to your [Bing Maps API Key](https://msdn.microsoft.com/en-us/library/ff428642.aspx).

*The first time the service runs, it will populate Firebase with data from USGS. This may take ~2 hours since we need to space out our calls to the Bing Maps API in order to avoid rate limits.*

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
```
localhost:8080/regions?days=10&count=3&region_type=country
```
might return the following JSON results:
```javascript
[
  {
    "name": "country Papua New Guinea",
    "earthquake_count": 28,
    "total_magnitude": 7.53
  },
  {
    "name": "country Mexico",
    "earthquake_count": 12,
    "total_magnitude": 7.22
  },
  {
    "name": "country Japan",
    "earthquake_count": 6,
    "total_magnitude": 5.80
  }
]
```

If we define regions by `timezone`, our results might look like:

```javascript
[
  {
    "name": "timezone 600",
    "earthquake_count": 35,
    "total_magnitude": 7.54
  },
  {
    "name": "timezone -360",
    "earthquake_count": 55,
    "total_magnitude": 7.26
  },
  {
    "name": "timezone 540",
    "earthquake_count": 26,
    "total_magnitude": 6.34
  }
]
```