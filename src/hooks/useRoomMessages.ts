import { useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  updateDoc,
  doc,
} from 'firebase/firestore';
import { db } from '../firebase';

export function useRoomMessages(roomId: string) {
  const [messages, setMessages] = useState<any[]>([]);

  useEffect(() => {
    if (!roomId) return;

    const q = query(
      collection(db, 'rooms', roomId, 'messages'),
      orderBy('createdAt', 'asc')
    );

    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => unsub();
  }, [roomId]);

  const send = async (
    user: any,
    text: string,
    isCorrect: boolean = false
  ) => {
    if (!text.trim()) return;

    await addDoc(collection(db, 'rooms', roomId, 'messages'), {
      sender: user.name,
      senderId: user.uid || user.name,
      text: text.trim(),
      isCorrect,
      createdAt: serverTimestamp(),
    });
  };

  const markCorrect = async (messageId: string) => {
    await updateDoc(
      doc(db, 'rooms', roomId, 'messages', messageId),
      { isCorrect: true }
    );
  };

  return { messages, send, markCorrect };
}