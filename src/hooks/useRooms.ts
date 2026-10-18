import { useEffect, useState } from 'react';
import { 
  collection, onSnapshot, addDoc, updateDoc, doc, serverTimestamp, 
  query, orderBy, getDoc, deleteDoc, where, getDocs 
} from 'firebase/firestore';
import { db } from '../firebase';

export function useRooms() {
  const [rooms, setRooms] = useState<any[]>([]);

  // 1. Rooms ko fetch karna
  useEffect(() => {
    const q = query(collection(db, 'rooms'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
      setRooms(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  // 2. GHOST ROOM CLEANUP (2 minute wala)
  useEffect(() => {
    const interval = setInterval(async () => {
      const now = Date.now();
      rooms.forEach(async (room) => {
        if (room.createdAt && room.createdAt.toMillis) {
          const ageInSeconds = (now - room.createdAt.toMillis()) / 1000;
          
          // Agar room 120 second (2 min) se purana hai AUR usme sirf 1 player (host) hai
          if (ageInSeconds > 120 && room.players?.length === 1) {
            console.log(`Auto-deleting empty room: ${room.name}`);
            await deleteDoc(doc(db, 'rooms', room.id));
          }
        }
      });
    }, 10000); // Har 10 second mein check karega

    return () => clearInterval(interval);
  }, [rooms]);

  const createRoom = async ({ name, activity, activityTitle, isPrivate, host }: any) => {
    const code = 'SHADOW' + Math.floor(1000 + Math.random() * 9000);
    const payload = {
      name, activity, activityTitle, isPrivate, code,
      hostId: host.uid, host: host.name,
      players: [{ uid: host.uid, name: host.name, avatar: host.avatar, isHost: true }],
      createdAt: serverTimestamp(),
    };
    const ref = await addDoc(collection(db, 'rooms'), payload);
    return { id: ref.id, ...payload };
  };

  const joinRoom = async (roomId: string, user: any) => {
    const ref = doc(db, 'rooms', roomId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const data = snap.data();
    if (!data.players.some((p: any) => p.uid === user.uid)) {
      const updatedPlayers = [...data.players, { uid: user.uid, name: user.name, avatar: user.avatar, isHost: false }];
      await updateDoc(ref, { players: updatedPlayers });
    }
  };

  const leaveRoom = async (roomId: string, user: any) => {
    const ref = doc(db, 'rooms', roomId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const data = snap.data();
    const remaining = data.players.filter((p: any) => p.uid !== user.uid);
    
    if (remaining.length === 0) {
      await deleteDoc(ref);
    } else {
      if (data.hostId === user.uid) {
        remaining[0].isHost = true;
        await updateDoc(ref, { players: remaining, hostId: remaining[0].uid, host: remaining[0].name });
      } else {
        await updateDoc(ref, { players: remaining });
      }
    }
  };

  const deleteRoom = async (roomId: string) => {
    await deleteDoc(doc(db, 'rooms', roomId));
  };

  const findRoomByCode = async (code: string) => {
    const q = query(collection(db, 'rooms'), where('code', '==', code.toUpperCase()));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return { id: snap.docs[0].id, ...snap.docs[0].data() };
  };

  return { rooms, createRoom, joinRoom, leaveRoom, findRoomByCode, deleteRoom };
}