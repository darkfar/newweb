const DB_NAME = 'story-map-db';
const DB_VERSION = 1;
const SAVED_STORE = 'saved-stories'; // cerita dari API yang disimpan pengguna
const PENDING_STORE = 'pending-stories'; // cerita yang dibuat saat offline, menunggu sinkronisasi

let dbPromise = null;

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;

        if (!db.objectStoreNames.contains(SAVED_STORE)) {
          const store = db.createObjectStore(SAVED_STORE, { keyPath: 'id' });
          store.createIndex('createdAt', 'createdAt');
          store.createIndex('name', 'name');
        }

        if (!db.objectStoreNames.contains(PENDING_STORE)) {
          db.createObjectStore(PENDING_STORE, { keyPath: 'localId', autoIncrement: true });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        dbPromise = null;
        reject(request.error);
      };
    });
  }
  return dbPromise;
}

async function run(storeName, mode, operation) {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const request = operation(transaction.objectStore(storeName));
    let result;

    request.onsuccess = () => {
      result = request.result;
    };
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function notifyPendingChanged() {
  window.dispatchEvent(new Event('pending-stories-changed'));
}

export const SavedStoryDb = {
  put(story) {
    return run(SAVED_STORE, 'readwrite', (store) => store.put(story));
  },
  getAll() {
    return run(SAVED_STORE, 'readonly', (store) => store.getAll());
  },
  get(id) {
    return run(SAVED_STORE, 'readonly', (store) => store.get(id));
  },
  delete(id) {
    return run(SAVED_STORE, 'readwrite', (store) => store.delete(id));
  },
};

export const PendingStoryDb = {
  async add(item) {
    const key = await run(PENDING_STORE, 'readwrite', (store) => store.add(item));
    notifyPendingChanged();
    return key;
  },
  getAll() {
    return run(PENDING_STORE, 'readonly', (store) => store.getAll());
  },
  async update(item) {
    await run(PENDING_STORE, 'readwrite', (store) => store.put(item));
    notifyPendingChanged();
  },
  async delete(localId) {
    await run(PENDING_STORE, 'readwrite', (store) => store.delete(localId));
    notifyPendingChanged();
  },
};
