import { initializeApp } from 'firebase/app';
import { createUserWithEmailAndPassword, getAuth } from 'firebase/auth';
import { getFirestore, collection, addDoc, getDocs, query, orderBy, doc, updateDoc, deleteDoc, serverTimestamp, getDoc, setDoc, writeBatch, Timestamp, arrayUnion, arrayRemove, collectionGroup, where } from 'firebase/firestore'; // Import getAuth for createUserWithEmailAndPassword
import { Task } from '../types'; // Assuming types.ts is in the parent directory

// Your Firebase configuration
// IMPORTANT: Replace with your actual Firebase project configuration
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
  const q = query(tasksCollection, orderBy('createdAt', 'desc')); // Order by creation time
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
  // Use setDoc to specify the document ID
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
  
  // Delete all sections and their students within the class
  const sectionsSnapshot = await getDocs(collection(classRef, 'sections'));
  for (const sectionDoc of sectionsSnapshot.docs) {
    const studentsSnapshot = await getDocs(collection(sectionRef, 'students'));
    for (const studentDoc of studentsSnapshot.docs) {
      batch.delete(studentDoc.ref);
    }
    batch.delete(sectionDoc.ref);
  }
  batch.delete(classRef); // Delete the class document itself
  await batch.commit();
};

// Function to add a section to Firestore
export const addSectionToFirestore = async (classId: string, sectionData: { id: string; name: string; students: any[] }) => { // Changed type to any[]
  await setDoc(doc(db, 'classes', classId, 'sections', sectionData.id), { name: sectionData.name });
};

// Function to update a section in Firestore
export const updateSectionInFirestore = async (classId: string, sectionId: string, sectionData: { name: string }) => { // Changed type to any
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

// Function to add a student to Firestore (now handled by addStudentToAuthAndFirestore)
export const addStudentToFirestore = async (classId: string, sectionId: string, studentData: { id: string; name: string; points: number }) => {
  await setDoc(doc(db, 'classes', classId, 'sections', sectionId, 'students', studentData.id), studentData);
};

// Function to update a student in Firestore
export const updateStudentInFirestore = async (classId: string, sectionId: string, studentId: string, studentData: { name?: string; points?: number }) => {
  const studentRef = doc(db, 'classes', classId, 'sections', sectionId, 'students', studentId);
  await updateDoc(studentRef, studentData);
};

// Function to delete a student from Firestore
export const deleteStudentFromAuthAndFirestore = async (classId: string, sectionId: string, studentUid: string) => {
  const studentRef = doc(db, 'classes', classId, 'sections', sectionId, 'students', studentUid);
  const userRef = doc(db, 'users', studentUid);
  const batch = writeBatch(db);

  batch.delete(studentRef); // Delete student document in class subcollection
  batch.delete(userRef); // Delete student document in top-level users collection

  await batch.commit();
  console.warn("Deleting a user's Firebase Auth account from client-side is not directly possible for an admin. This action only deletes Firestore data. A backend function is typically required for full user deletion.");
};

// Function to add a competition to Firestore
export const addCompetitionToFirestore = async (competitionData: any) => {
  if (!competitionData.targetClassId) competitionData.targetClassId = '';
  const docRef = await addDoc(collection(db, 'competitions'), {
    ...competitionData,
    createdAt: serverTimestamp(), // Add server timestamp for creation
    startDate: Timestamp.fromDate(new Date(competitionData.startDate)), // Convert date strings to Firestore Timestamps
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
      startDate: data.startDate?.toDate().toISOString().split('T')[0], // Convert Timestamp back to string for UI
      endDate: data.endDate?.toDate().toISOString().split('T')[0], // Convert Timestamp back to string for UI
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
export const addStudentToAuthAndFirestore = async (classId: string, sectionId: string, studentName: string, initialPoints: number) => {
  const email = studentName.replace(/\s/g, '').toLowerCase() + '@example.com'; // Generate email from name
  const password = studentName.replace(/\s/g, '') + '123'; // Generate password from name

  try {
    // 1. Register student in Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const studentUid = userCredential.user.uid;

    // 2. Add student data to Firestore
    const studentData = {
      id: studentUid,
      name: studentName,
      points: initialPoints,
      email: email, // Store email for reference
      // Add any other student-specific fields here
      completedTasks: {}, // Initialize completedTasks as an empty object
      lastOpenDate: serverTimestamp(), // Initialize lastOpenDate
    };

    await setDoc(doc(db, 'classes', classId, 'sections', sectionId, 'students', studentUid), studentData);

    return studentData; // Return the full student object
  } catch (error) {
    console.error("Error adding student to Auth and Firestore:", error);
    throw error; // Re-throw the error for App.tsx to handle
  }
};


// New function to fetch student's class and section info
export const fetchStudentClassSectionInfo = async (studentUid: string) => {
  // let's get student here
  const studentQuery = query(
      collectionGroup(db, 'students'), 
      where('id', '==', studentUid) // '__name__' refers to the Document ID
    );

    const querySnapshot = await getDocs(studentQuery);
    if (!querySnapshot.empty) {
  // Since IDs are usually unique, we take the first result
  const studentDoc = querySnapshot.docs[0];
  if (studentDoc.exists()) {
    const fullPath = studentDoc.ref.path;
    const classId = fullPath.split('/')[1];
    const sectionId = fullPath.split('/')[3];
    return {
      ...studentDoc.data(),
      classId: classId,
      sectionId: sectionId,
    } as { classId: string, sectionId: string, name: string, email: string, role: string };
  }
  
  return null;
} else {
  console.log("No student found with that UID anywhere.");
  return null;
}
};

// New function to create an empty daily completion record
export const createEmptyDailyCompletionRecord = async (
  studentUid: string,
  classId: string,
  sectionId: string,
  dateString: string // YYYY-MM-DD
) => {
  const dailyCompletionRef = doc(db, 'classes', classId, 'sections', sectionId, 'students', studentUid, 'dailyCompletions', dateString);
  await setDoc(dailyCompletionRef, { completedTasks: [] }, { merge: true });
};

// New function to toggle student task completion for a specific day
export const toggleStudentTaskCompletionInFirestore = async (
  studentUid: string,
  classId: string,
  sectionId: string,
  taskId: string,
  dateString: string, // YYYY-MM-DD
  isCompleted: boolean
) => {
  const dailyCompletionRef = doc(db, 'classes', classId, 'sections', sectionId, 'students', studentUid, 'dailyCompletions', dateString);
debugger
  if (isCompleted) {
    await updateDoc(dailyCompletionRef, { completedTasks: arrayUnion(taskId) }, { merge: true }); // Use merge: true to create if not exists
  } else {
    await updateDoc(dailyCompletionRef, { completedTasks: arrayRemove(taskId) });
  }
};

// New function to update student's points and last open date
export const updateStudentPointsAndLastOpenDate = async (classId: string, sectionId: string, studentUid: string, points: number) => {
  const studentRef = doc(db, 'classes', classId, 'sections', sectionId, 'students', studentUid);
  await updateDoc(studentRef, {
    points: points,
    lastOpenDate: serverTimestamp(),
  });
};

// New function to fetch student's completed tasks for a specific day
export const fetchStudentCompletedTasksForDay = async (
  studentUid: string,
  classId: string,
  sectionId: string,
  dateString: string // YYYY-MM-DD
): Promise<string[]> => { 
  const dailyCompletionRef = doc(db, 'classes', classId, 'sections', sectionId, 'students', studentUid, 'dailyCompletions', dateString);
  const docSnap = await getDoc(dailyCompletionRef);
  if (docSnap.exists()) {
    const data = docSnap.data();
    return data.completedTasks || null;
  }
  return null;
};

// New function to fetch a student's full data from the nested collection
export const fetchStudentData = async (classId: string, sectionId: string, studentUid: string) => {
  const studentRef = doc(db, 'classes', classId, 'sections', sectionId, 'students', studentUid);
  const docSnap = await getDoc(studentRef);
  if (docSnap.exists()) {
    return docSnap.data();
  }
  return null;
};

// New function to fetch all daily completion records for a student
export const fetchStudentDailyCompletions = async (
  studentUid: string,
  classId: string,
  sectionId: string
): Promise<string[]> => {
  const dailyCompletionsCollectionRef = collection(db, 'classes', classId, 'sections', sectionId, 'students', studentUid, 'dailyCompletions');
  const querySnapshot = await getDocs(dailyCompletionsCollectionRef);
  const completedDates: string[] = [];
  querySnapshot.forEach((docSnap) => {
    const data = docSnap.data();
    if (data.completedTasks && data.completedTasks.length > 0) {
      completedDates.push(docSnap.id); // doc.id is the dateString
    }
  });
  return completedDates;
};