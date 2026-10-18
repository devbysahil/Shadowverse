import { useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  signInAnonymously, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut 
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

export function useAuth() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        const ref = doc(db, 'users', fbUser.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          setUser({ uid: fbUser.uid, ...snap.data() });
        } else {
          const newProfile = {
            name: fbUser.email?.split('@')[0] || `Hunter_${fbUser.uid.slice(0, 5)}`,
            email: fbUser.email || '',
            avatar: '👑',
            tag: '#' + fbUser.uid.slice(-4),
          };
          await setDoc(ref, newProfile);
          setUser({ uid: fbUser.uid, ...newProfile });
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const guestLogin = () => signInAnonymously(auth);
  const emailLogin = (email: string, password: string) => signInWithEmailAndPassword(auth, email, password);
  const emailSignup = (email: string, password: string) => createUserWithEmailAndPassword(auth, email, password);
  const logout = () => signOut(auth);

  return { user, loading, guestLogin, emailLogin, emailSignup, logout };
}