import { initializeApp } from "firebase/app";
import { getDatabase, get, goOffline, ref, update } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyBFrTdu7DO1TZB1AksPdW6N-PAq-a1HBbs",
  authDomain: "newdiary-1c766.firebaseapp.com",
  databaseURL: "https://newdiary-1c766-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "newdiary-1c766",
  storageBucket: "newdiary-1c766.firebasestorage.app",
  messagingSenderId: "833028121069",
  appId: "1:833028121069:web:fd8f4bf1f2b96a520347e4",
  measurementId: "G-156VETRE09",
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

async function main() {
  const usersRef = ref(db, "users");
  const snapshot = await get(usersRef);

  if (!snapshot.exists()) {
    console.log("Khong tim thay user nao trong Realtime Database.");
    return;
  }

  const users = snapshot.val();
  const updates = {};
  let migratedCount = 0;

  for (const [uid, user] of Object.entries(users)) {
    if (!user || typeof user !== "object") continue;

    if (user.emailVerified === undefined) {
      updates[`users/${uid}/emailVerified`] = true;
      updates[`users/${uid}/emailVerifiedAt`] = Date.now();
      migratedCount += 1;
    }
  }

  if (migratedCount === 0) {
    console.log("Khong co tai khoan cu nao can migrate.");
    return;
  }

  await update(ref(db), updates);
  console.log(`Da migrate ${migratedCount} tai khoan cu sang emailVerified=true.`);
}

main()
  .catch((error) => {
    console.error("Migrate that bai:");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    goOffline(db);
    setTimeout(() => process.exit(process.exitCode ?? 0), 0);
  });
