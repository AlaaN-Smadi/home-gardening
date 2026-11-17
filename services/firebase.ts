import { initializeApp } from 'firebase/app';
import { createUserWithEmailAndPassword, getAuth } from 'firebase/auth';
import { getFirestore, collection, addDoc, getDocs, query, orderBy, doc, updateDoc, deleteDoc, serverTimestamp, getDoc, setDoc, writeBatch, Timestamp, arrayUnion, arrayRemove, collectionGroup, where } from 'firebase/firestore';
import { Task } from '../types';

// Firebase configuration from environment
const firebaseConfig = {
  apiKey: import.meta.env.VITE_API_KEY,
  authDomain: import.meta.env.VITE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_APP_ID,
  measurementId: import.meta.env.VITE_MEASUREMENT_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export Auth service
export const auth = getAuth(app);

// Export Firestore service
export const db = getFirestore(app);

// Function to add a task to Firestore
export const addTaskToFirestore = async (taskData: Omit<Task, 'id'>) => {
  const docRef = await addDoc(collection(db, 'tasks'), { ...taskData, createdAt: serverTimestamp() });
  return docRef.id;
};

// Function to fetch tasks from Firestore
export const fetchTasksFromFirestore = async (): Promise<Task[]> => {
  const tasksCollection = collection(db, 'tasks');
  const q = query(tasksCollection, orderBy('createdAt', 'desc'));
  const querySnapshot = await getDocs(q);
  const tasks: Task[] = [];
  querySnapshot.forEach((doc) => {
    tasks.push({ ...doc.data(), id: doc.id } as Task);
  });
  return tasks;
};

// Function to update a task in Firestore
export const updateTaskInFirestore = async (id: string, taskData: Partial<Task>) => {
  const taskRef = doc(db, 'tasks', id);
  await updateDoc(taskRef, {
    title: taskData.title,
    description: taskData.description,
    points: taskData.points,
    icon: taskData.icon,
    color: taskData.color,
    category: taskData.category,
  });
};

// Function to delete a task from Firestore
export const deleteTaskFromFirestore = async (id: string) => {
  const taskRef = doc(db, 'tasks', id);
  await deleteDoc(taskRef);
};

// Function to fetch classes from Firestore
export const fetchClassesFromFirestore = async (): Promise<any[]> => {
  const classesCollection = collection(db, 'classes');
  const querySnapshot = await getDocs(classesCollection);
  const classes: any[] = [];

  for (const classDoc of querySnapshot.docs) {
    const classData = { id: classDoc.id, ...classDoc.data() };
    const sectionsCollection = collection(db, 'classes', classDoc.id, 'sections');
    const sectionsSnapshot = await getDocs(sectionsCollection);
    const sections: any[] = [];

    for (const sectionDoc of sectionsSnapshot.docs) {
      const sectionData = { id: sectionDoc.id, ...sectionDoc.data() };
      const studentsCollection = collection(db, 'classes', classDoc.id, 'sections', sectionDoc.id, 'students');
      const studentsSnapshot = await getDocs(studentsCollection);
      const students = studentsSnapshot.docs.map(studentDoc => ({ id: studentDoc.id, ...studentDoc.data() }));
      sections.push({ ...sectionData, students });
    }
    classes.push({ ...classData, sections });
  }
  return classes;
};

// Function to add a class to Firestore
export const addClassToFirestore = async (classData: { id: string; name: string; sections: any[] }) => {
  await setDoc(doc(db, 'classes', classData.id), { name: classData.name });
};

// Function to update a class in Firestore
export const updateClassInFirestore = async (classId: string, classData: any) => {
  const classRef = doc(db, 'classes', classId);
  await updateDoc(classRef, classData);
};

// Function to delete a class from Firestore
export const deleteClassFromFirestore = async (classId: string) => {
  const classRef = doc(db, 'classes', classId);
  const batch = writeBatch(db);
  
  const sectionsSnapshot = await getDocs(collection(classRef, 'sections'));
  for (const sectionDoc of sectionsSnapshot.docs) {
    const studentsSnapshot = await getDocs(collection(sectionDoc.ref, 'students'));
    for (const studentDoc of studentsSnapshot.docs) {
      batch.delete(studentDoc.ref);
    }
    batch.delete(sectionDoc.ref);
  }
  batch.delete(classRef);
  await batch.commit();
};

// Function to add a section to Firestore
export const addSectionToFirestore = async (classId: string, sectionData: { id: string; name: string; students: any[] }) => {
  await setDoc(doc(db, 'classes', classId, 'sections', sectionData.id), { name: sectionData.name });
};

// Function to update a section in Firestore
export const updateSectionInFirestore = async (classId: string, sectionId: string, sectionData: { name: string }) => {
  const sectionRef = doc(db, 'classes', classId, 'sections', sectionId);
  await updateDoc(sectionRef, { name: sectionData.name });
};

// Function to delete a section from Firestore
export const deleteSectionFromFirestore = async (classId: string, sectionId: string) => {
  const sectionRef = doc(db, 'classes', classId, 'sections', sectionId);
  const batch = writeBatch(db);
  const studentsSnapshot = await getDocs(collection(sectionRef, 'students'));
  studentsSnapshot.docs.forEach(studentDoc => batch.delete(studentDoc.ref));
  batch.delete(sectionRef);
  await batch.commit();
};

// Function to add a student to Firestore
export const addStudentToFirestore = async (classId: string, sectionId: string, studentData: { id: string; name: string; points: number }) => {
  await setDoc(doc(db, 'classes', classId, 'sections', sectionId, 'students', studentData.id), studentData);
  await setDoc(doc(db, 'users', studentData.id), { ...studentData, classId, sectionId }, { merge: true });
};

// Function to update a student in Firestore
export const updateStudentInFirestore = async (classId: string, sectionId: string, studentId: string, studentData: { name?: string; points?: number }) => {
  const studentRef = doc(db, 'classes', classId, 'sections', sectionId, 'students', studentId);
  await updateDoc(studentRef, studentData);
  const userRef = doc(db, 'users', studentId);
  await setDoc(userRef, studentData, { merge: true });
};

// Function to delete a student from Firestore
export const deleteStudentFromAuthAndFirestore = async (classId: string, sectionId: string, studentUid: string) => {
  const studentRef = doc(db, 'classes', classId, 'sections', sectionId, 'students', studentUid);
  const userRef = doc(db, 'users', studentUid);
  const batch = writeBatch(db);

  batch.delete(studentRef);
  batch.delete(userRef);

  await batch.commit();
};

// Function to add a competition to Firestore
export const addCompetitionToFirestore = async (competitionData: any) => {
  if (!competitionData.targetClassId) competitionData.targetClassId = '';
  const docRef = await addDoc(collection(db, 'competitions'), {
    ...competitionData,
    createdAt: serverTimestamp(),
    startDate: Timestamp.fromDate(new Date(competitionData.startDate)),
    endDate: Timestamp.fromDate(new Date(competitionData.endDate)),
  });
  return docRef.id;
};

// Function to fetch competitions from Firestore
export const fetchCompetitionsFromFirestore = async (): Promise<any[]> => {
  const competitionsCollection = collection(db, 'competitions');
  const q = query(competitionsCollection, orderBy('createdAt', 'desc'));
  const querySnapshot = await getDocs(q);
  const competitions: any[] = [];
  querySnapshot.forEach((doc) => {
    const data = doc.data();
    competitions.push({
      ...data,
      id: doc.id,
      startDate: data.startDate?.toDate().toISOString().split('T')[0],
      endDate: data.endDate?.toDate().toISOString().split('T')[0],
    });
  });
  return competitions;
};

// Function to update a competition in Firestore
export const updateCompetitionInFirestore = async (id: string, competitionData: any) => {
  if (!competitionData.targetClassId) competitionData.targetClassId = '';
  const competitionRef = doc(db, 'competitions', id);
  await updateDoc(competitionRef, {
    title: competitionData.title,
    type: competitionData.type,
    targetClassId: competitionData.targetClassId,
    startDate: Timestamp.fromDate(new Date(competitionData.startDate)),
    endDate: Timestamp.fromDate(new Date(competitionData.endDate)),
    prize: competitionData.prize,
    status: competitionData.status,
  });
};

// Function to delete a competition from Firestore
export const deleteCompetitionFromFirestore = async (id: string) => {
  const competitionRef = doc(db, 'competitions', id);
  await deleteDoc(competitionRef);
};

// Function to add a student to Firestore and register them in Firebase Auth
export const addStudentToAuthAndFirestore = async (
  classId: string, 
  sectionId: string, 
  studentName: string, 
  initialPoints: number,
  customPassword?: string
) => {
  const email = studentName.replace(/\s/g, '').toLowerCase() + '@tadweer.com';
  const password = customPassword && customPassword.trim().length >= 6 ? customPassword.trim() : 'abc@12345';

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const studentUid = userCredential.user.uid;

    const studentData = {
      id: studentUid,
      name: studentName,
      points: initialPoints,
      email: email,
      password: password,
      classId: classId,
      sectionId: sectionId,
      completedTasks: {},
      lastOpenDate: serverTimestamp(),
    };

    // Save in the class/section/students hierarchy
    await setDoc(doc(db, 'classes', classId, 'sections', sectionId, 'students', studentUid), studentData);

    // Also save in top-level users collection for instant, reliable lookups
    await setDoc(doc(db, 'users', studentUid), studentData);

    return studentData;
  } catch (error) {
    console.error("Error adding student to Auth and Firestore:", error);
    throw error;
  }
};

// Function to register a self-signing student into a chosen class & section
export const registerStudentWithClass = async (
  studentUid: string,
  classId: string,
  sectionId: string,
  studentName: string,
  email: string,
  className?: string,
  sectionName?: string,
  password?: string
) => {
  const studentData = {
    id: studentUid,
    name: studentName,
    points: 0,
    email: email,
    password: password || 'abc@12345',
    classId: classId,
    sectionId: sectionId,
    className: className || '',
    sectionName: sectionName || '',
    completedTasks: {},
    lastOpenDate: serverTimestamp(),
    createdAt: serverTimestamp()
  };

  if (classId && sectionId) {
    try {
      await setDoc(doc(db, 'classes', classId, 'sections', sectionId, 'students', studentUid), studentData);
    } catch (e) {
      console.warn("Could not save to class subcollection:", e);
    }
  }

  try {
    await setDoc(doc(db, 'users', studentUid), studentData);
  } catch (e) {
    console.warn("Could not save to users collection:", e);
  }

  return studentData;
};

// Comprehensive function to fetch student's class, section, and profile info
export const fetchStudentClassSectionInfo = async (studentUid: string, userEmail?: string | null) => {
  // 1. Try checking top-level users collection first
  try {
    const userDocRef = doc(db, 'users', studentUid);
    const userDocSnap = await getDoc(userDocRef);
    if (userDocSnap.exists()) {
      const uData = userDocSnap.data();
      if (uData.classId && uData.sectionId) {
        let className = uData.className || '';
        let sectionName = uData.sectionName || '';
        if (!className) {
          try {
            const cSnap = await getDoc(doc(db, 'classes', uData.classId));
            if (cSnap.exists()) className = cSnap.data()?.name || '';
          } catch (e) {
            console.warn(e);
          }
        }
        if (!sectionName) {
          try {
            const sSnap = await getDoc(doc(db, 'classes', uData.classId, 'sections', uData.sectionId));
            if (sSnap.exists()) sectionName = sSnap.data()?.name || '';
          } catch (e) {
            console.warn(e);
          }
        }
        return {
          ...uData,
          id: studentUid,
          classId: uData.classId,
          sectionId: uData.sectionId,
          className,
          sectionName,
          name: uData.name || '',
          points: uData.points || 0
        };
      }
    }
  } catch (err) {
    console.warn("Could not fetch from users collection:", err);
  }

  // 2. Try collectionGroup query by studentUid or email
  try {
    const studentQuery = query(
      collectionGroup(db, 'students'), 
      where('id', '==', studentUid)
    );
    const querySnapshot = await getDocs(studentQuery);
    if (!querySnapshot.empty) {
      const studentDoc = querySnapshot.docs[0];
      const fullPath = studentDoc.ref.path;
      const parts = fullPath.split('/');
      const classId = parts[1];
      const sectionId = parts[3];
      let className = '';
      let sectionName = '';
      try {
        const cSnap = await getDoc(doc(db, 'classes', classId));
        if (cSnap.exists()) className = cSnap.data()?.name || '';
        const sSnap = await getDoc(doc(db, 'classes', classId, 'sections', sectionId));
        if (sSnap.exists()) sectionName = sSnap.data()?.name || '';
      } catch (e) {
        console.warn(e);
      }
      return {
        ...studentDoc.data(),
        id: studentUid,
        classId,
        sectionId,
        className,
        sectionName,
      };
    }
  } catch (err) {
    console.warn("CollectionGroup query error:", err);
  }

  // 3. Fallback scan through classes & sections
  try {
    const classesSnapshot = await getDocs(collection(db, 'classes'));
    for (const classDoc of classesSnapshot.docs) {
      const classId = classDoc.id;
      const className = classDoc.data()?.name || '';
      const sectionsSnapshot = await getDocs(collection(db, 'classes', classId, 'sections'));
      for (const secDoc of sectionsSnapshot.docs) {
        const sectionId = secDoc.id;
        const sectionName = secDoc.data()?.name || '';

        // Check if student doc with studentUid exists
        const directStudentDoc = await getDoc(doc(db, 'classes', classId, 'sections', sectionId, 'students', studentUid));
        if (directStudentDoc.exists()) {
          const sData = directStudentDoc.data();
          return {
            ...sData,
            id: studentUid,
            classId,
            sectionId,
            className,
            sectionName,
          };
        }

        // Search students in section by email
        if (userEmail) {
          const studentsSnap = await getDocs(collection(db, 'classes', classId, 'sections', sectionId, 'students'));
          for (const sDoc of studentsSnap.docs) {
            const sData = sDoc.data();
            const emailMatch = sData.email && sData.email.toLowerCase() === userEmail.toLowerCase();
            const idMatch = sData.id === studentUid || sDoc.id === studentUid;
            if (emailMatch || idMatch) {
              return {
                ...sData,
                id: sDoc.id,
                classId,
                sectionId,
                className,
                sectionName,
              };
            }
          }
        }
      }
    }
  } catch (err) {
    console.error("Error scanning classes for student:", err);
  }

  return null;
};

// Function to create an empty daily completion record
export const createEmptyDailyCompletionRecord = async (
  studentUid: string,
  classId: string,
  sectionId: string,
  dateString: string
) => {
  const dailyCompletionRef = doc(db, 'classes', classId, 'sections', sectionId, 'students', studentUid, 'dailyCompletions', dateString);
  await setDoc(dailyCompletionRef, { completedTasks: [] }, { merge: true });
};

// Function to toggle student task completion for a specific day
export const toggleStudentTaskCompletionInFirestore = async (
  studentUid: string,
  classId: string,
  sectionId: string,
  taskId: string,
  dateString: string,
  isCompleted: boolean
) => {
  const dailyCompletionRef = doc(db, 'classes', classId, 'sections', sectionId, 'students', studentUid, 'dailyCompletions', dateString);
  if (isCompleted) {
    await setDoc(dailyCompletionRef, { completedTasks: arrayUnion(taskId) }, { merge: true });
  } else {
    await updateDoc(dailyCompletionRef, { completedTasks: arrayRemove(taskId) });
  }
};

// Function to update student's points and last open date
export const updateStudentPointsAndLastOpenDate = async (classId: string, sectionId: string, studentUid: string, points: number) => {
  try {
    const studentRef = doc(db, 'classes', classId, 'sections', sectionId, 'students', studentUid);
    await updateDoc(studentRef, {
      points: points,
      lastOpenDate: serverTimestamp(),
    });
  } catch (e) {
    console.warn("Could not update studentRef points:", e);
  }

  try {
    const userRef = doc(db, 'users', studentUid);
    await setDoc(userRef, {
      points: points,
      lastOpenDate: serverTimestamp(),
    }, { merge: true });
  } catch (e) {
    console.warn("Could not update userRef points:", e);
  }
};

// Function to update points in user doc when student has no class yet
export const updateUserPoints = async (studentUid: string, points: number) => {
  const userRef = doc(db, 'users', studentUid);
  await setDoc(userRef, {
    points: points,
    lastOpenDate: serverTimestamp(),
  }, { merge: true });
};

// Function to save or update top-level user profile
export const saveUserProfile = async (studentUid: string, data: any) => {
  const userRef = doc(db, 'users', studentUid);
  await setDoc(userRef, data, { merge: true });
};

// Function to fetch student's completed tasks for a specific day
export const fetchStudentCompletedTasksForDay = async (
  studentUid: string,
  classId: string,
  sectionId: string,
  dateString: string
): Promise<string[] | null> => { 
  const dailyCompletionRef = doc(db, 'classes', classId, 'sections', sectionId, 'students', studentUid, 'dailyCompletions', dateString);
  const docSnap = await getDoc(dailyCompletionRef);
  if (docSnap.exists()) {
    const data = docSnap.data();
    return data.completedTasks || null;
  }
  return null;
};

export const fetchClassById = async (classId: string) => {
  const classRef = doc(db, 'classes', classId);
  const docSnap = await getDoc(classRef);
  if (docSnap.exists()) {
    const _class = docSnap.data();
    return {
      ..._class,
      id: classId,
    };
  }
  return null;
}; 

// Function to fetch a student's full data from the nested collection
export const fetchStudentData = async (classId: string, sectionId: string, studentUid: string) => {
  try {
    const studentRef = doc(db, 'classes', classId, 'sections', sectionId, 'students', studentUid);
    const docSnap = await getDoc(studentRef);
    if (docSnap.exists()) {
      return docSnap.data();
    }
  } catch (e) {
    console.warn("fetchStudentData error:", e);
  }

  // Fallback to top-level users collection
  try {
    const userRef = doc(db, 'users', studentUid);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      return userSnap.data();
    }
  } catch (e) {
    console.warn("fetchStudentData users fallback error:", e);
  }

  return null;
};

// Function to fetch all daily completion records for a student
export const fetchStudentDailyCompletions = async (
  studentUid: string,
  classId: string,
  sectionId: string
): Promise<string[]> => {
  try {
    const dailyCompletionsCollectionRef = collection(db, 'classes', classId, 'sections', sectionId, 'students', studentUid, 'dailyCompletions');
    const querySnapshot = await getDocs(dailyCompletionsCollectionRef);
    const completedDates: string[] = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.completedTasks && data.completedTasks.length > 0) {
        completedDates.push(docSnap.id);
      }
    });
    return completedDates;
  } catch (e) {
    console.warn("fetchStudentDailyCompletions error:", e);
    return [];
  }
};

// Calculate real consecutive days streak
export const calculateStreak = (completionDates: string[]): number => {
  if (!completionDates || completionDates.length === 0) return 0;
  
  const uniqueDates = Array.from(new Set(completionDates)).sort().reverse();
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  // If student hasn't completed anything today or yesterday, streak is 0
  if (!uniqueDates.includes(todayStr) && !uniqueDates.includes(yesterdayStr)) {
    return 0;
  }

  let streak = 0;
  let checkDate = uniqueDates.includes(todayStr) ? new Date(today) : new Date(yesterday);

  while (true) {
    const dateStr = checkDate.toISOString().split('T')[0];
    if (uniqueDates.includes(dateStr)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
};

// Fetch redeemed rewards for a student
export const fetchStudentRedeemedRewards = async (
  studentUid: string,
  classId?: string,
  sectionId?: string
): Promise<any[]> => {
  try {
    if (classId && sectionId) {
      const colRef = collection(db, 'classes', classId, 'sections', sectionId, 'students', studentUid, 'redeemedRewards');
      const qSnap = await getDocs(colRef);
      if (!qSnap.empty) {
        const items: any[] = [];
        qSnap.forEach(d => items.push({ ...d.data(), id: d.id }));
        return items;
      }
    }
    const userColRef = collection(db, 'users', studentUid, 'redeemedRewards');
    const uSnap = await getDocs(userColRef);
    const items: any[] = [];
    uSnap.forEach(d => items.push({ ...d.data(), id: d.id }));
    return items;
  } catch (err) {
    console.warn("Could not fetch redeemed rewards from firestore:", err);
    return [];
  }
};

// Save a redeemed reward for a student
export const saveStudentRedeemedReward = async (
  studentUid: string,
  redeemedItem: any,
  classId?: string,
  sectionId?: string
) => {
  try {
    if (classId && sectionId) {
      await setDoc(
        doc(db, 'classes', classId, 'sections', sectionId, 'students', studentUid, 'redeemedRewards', redeemedItem.id),
        redeemedItem
      );
    }
    await setDoc(
      doc(db, 'users', studentUid, 'redeemedRewards', redeemedItem.id),
      redeemedItem
    );
  } catch (err) {
    console.warn("Could not save redeemed reward to firestore:", err);
  }
};
