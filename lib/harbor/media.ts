'use client'
function database(): Promise<IDBDatabase> {
 return new Promise((resolve,reject)=>{const request=indexedDB.open('harbor-media',1);request.onupgradeneeded=()=>request.result.createObjectStore('files');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)})
}
export async function saveMedia(id:string,file:Blob) {
 const db=await database();return new Promise<void>((resolve,reject)=>{const tx=db.transaction('files','readwrite');tx.objectStore('files').put(file,id);tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>{db.close();reject(tx.error)}})
}
export async function getMedia(id:string):Promise<Blob|undefined> {
 const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction('files','readonly');const request=tx.objectStore('files').get(id);request.onsuccess=()=>{db.close();resolve(request.result)};request.onerror=()=>{db.close();reject(request.error)}})
}
export async function clearMedia() {
 const db=await database();return new Promise<void>((resolve,reject)=>{const tx=db.transaction('files','readwrite');tx.objectStore('files').clear();tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>{db.close();reject(tx.error)}})
}
