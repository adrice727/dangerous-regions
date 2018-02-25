import * as R from 'ramda';
import * as firebaseAdmin from 'firebase-admin';
import * as serviceAccount from '../../config/firebase-credentials.json';


type DataSnapshot = firebaseAdmin.database.DataSnapshot;

const credentials = serviceAccount as firebaseAdmin.ServiceAccount;
const projectId = R.propOr('', 'project_id', credentials);

firebaseAdmin.initializeApp({
  databaseURL: `https://${projectId}.firebaseio.com`,
  credential: firebaseAdmin.credential.cert(credentials),
});

const db = firebaseAdmin.database();

export { db, DataSnapshot };

