import * as firebaseAdmin from 'firebase-admin';
import * as serviceAccount from '../../config/firebase-credentials.json';

firebaseAdmin.initializeApp({
  databaseURL: 'https://danger-zones.firebaseio.com',
  credential: firebaseAdmin.credential.cert(serviceAccount as firebaseAdmin.ServiceAccount),
});

const db = firebaseAdmin.database();

export { db };

