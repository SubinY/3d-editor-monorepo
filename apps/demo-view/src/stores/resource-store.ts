export interface ResourceRecord {
  id: string
  name: string
  mime: string
  size: number
  createdAt: number
  updatedAt: number
  blob: Blob
}

const DB_NAME = 'cabinet-resources-db'
const DB_VERSION = 1
const STORE_NAME = 'resources'

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'))
  })
  return dbPromise
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  })
}

function generateId(): string {
  return `res-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

async function runWrite<T>(fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb()
  const tx = db.transaction(STORE_NAME, 'readwrite')
  const store = tx.objectStore(STORE_NAME)
  const result = await requestToPromise(fn(store))
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB write tx failed'))
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB write tx aborted'))
  })
  return result
}

async function runRead<T>(fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb()
  const tx = db.transaction(STORE_NAME, 'readonly')
  const store = tx.objectStore(STORE_NAME)
  const result = await requestToPromise(fn(store))
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB read tx failed'))
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB read tx aborted'))
  })
  return result
}

export const resourceStore = {
  async put(input: { id?: string; name: string; mime?: string; blob: Blob }): Promise<ResourceRecord> {
    const now = Date.now()
    const id = input.id ?? generateId()
    const existing = await this.get(id)
    const record: ResourceRecord = {
      id,
      name: input.name,
      mime: input.mime || input.blob.type || 'application/octet-stream',
      size: input.blob.size,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      blob: input.blob
    }
    await runWrite(store => store.put(record))
    return record
  },

  async get(id: string): Promise<ResourceRecord | undefined> {
    const result = await runRead(store => store.get(id))
    return result ?? undefined
  },

  async getBlob(id: string): Promise<Blob | undefined> {
    const result = await this.get(id)
    return result?.blob
  },

  async remove(id: string): Promise<void> {
    await runWrite(store => store.delete(id))
  }
}

