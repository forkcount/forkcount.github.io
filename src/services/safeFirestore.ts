import {
  setDoc as fbSetDoc,
  updateDoc as fbUpdateDoc,
  addDoc as fbAddDoc,
  deleteDoc as fbDeleteDoc
} from 'firebase/firestore';

function clean(obj: any): any {
  if (Array.isArray(obj)) return obj.map(clean);
  if (obj instanceof Date) return obj;
  if (obj && typeof obj === 'object') {
    const out: any = {};
    for (const k in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, k)) {
        if (obj[k] !== undefined) out[k] = clean(obj[k]);
      }
    }
    return out;
  }
  return obj;
}

export const setDoc = (ref: any, data: any, opts?: any) => fbSetDoc(ref, clean(data), opts);
export const updateDoc = (ref: any, data: any) => fbUpdateDoc(ref, clean(data));
export const addDoc = (ref: any, data: any) => fbAddDoc(ref, clean(data));
export const deleteDoc = (ref: any) => fbDeleteDoc(ref);

export * from 'firebase/firestore';
