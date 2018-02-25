import * as firebaseAdmin from 'firebase-admin';
import * as serviceAccount from '../../config/firebase-credentials.json';

type DataSnapshot = firebaseAdmin.database.DataSnapshot;

firebaseAdmin.initializeApp({
  databaseURL: 'https://danger-reg.firebaseio.com',
  credential: firebaseAdmin.credential.cert(serviceAccount as firebaseAdmin.ServiceAccount),
});

const db = firebaseAdmin.database();

export { db, DataSnapshot };

