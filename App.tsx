import React, { useState, useEffect } from 'react';
import { AppView, Task, StudentStats, ChatMessage, ClassRoom, Section, Student, Competition } from './types';
import { INITIAL_TASKS, LEVELS, BADGES } from './constants';
import { BottomNav } from './components/BottomNav';
import { Icon } from './components/Icon';
import { PlantAvatar } from './components/PlantAvatar'; // This import is not used, but it's in the original code. I'll keep it.
import { chatWithMentor, getGardeningTip } from './services/geminiService';

import { addClassToFirestore, addCompetitionToFirestore, auth, deleteCompetitionFromFirestore, fetchClassesFromFirestore, fetchCompetitionsFromFirestore, updateCompetitionInFirestore, createEmptyDailyCompletionRecord, fetchClassById } from './services/firebase';
import { createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signOut, User } from 'firebase/auth';
import { addSectionToFirestore, addStudentToAuthAndFirestore, addTaskToFirestore, deleteStudentFromAuthAndFirestore, deleteTaskFromFirestore, fetchStudentClassSectionInfo, fetchStudentCompletedTasksForDay, fetchStudentData, fetchTasksFromFirestore, toggleStudentTaskCompletionInFirestore, updateStudentPointsAndLastOpenDate, updateTaskInFirestore } from './services/firebase'; // Import Firestore task functions and addSectionToFirestore

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeView, setActiveView] = useState<AppView>(AppView.HOME); // Default to HOME, will change based on auth
  const [tasks, setTasks] = useState<Task[]>([]);
  const [studentInfo, setStudentInfo] = useState<{ classId: string, sectionId: string } | null>(null); // To store student's class/section
  const [studentCompletedTasksToday, setStudentCompletedTasksToday] = useState<string[]>([]); // IDs of tasks completed today by the student (from studentData.completedTasks[today])
  const [stats, setStats] = useState<StudentStats>({ name: "", level: "برعم ناشئ", points: 0, streak: 0, completedTasks: 0, totalTasks: 0 }); // Initial student stats
  console.log(activeView);

  // Admin Specific State
  const [classes, setClasses] = useState<ClassRoom[]>([]); // Initialize as empty, will fetch from Firestore

  // Management Contexts
  const [selectedClass, setSelectedClass] = useState<ClassRoom | null>(null);
  const [selectedSection, setSelectedSection] = useState<Section | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editingCompetition, setEditingCompetition] = useState<Competition | null>(null);

  // Admin Form States
  const [newClassName, setNewClassName] = useState("");
  const [newSectionName, setNewSectionName] = useState("");
  const [newStudentName, setNewStudentName] = useState("");
  const [loading, setLoading] = useState<Boolean | false>(false);
  const [toastText, setToastText] = useState<string | ''>('');

  // New Task Form States
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [newTaskPoints, setNewTaskPoints] = useState(10);
  const [newTaskIcon, setNewTaskIcon] = useState("eco");
  const [newTaskColor, setNewTaskColor] = useState("green");

  const [competitions, setCompetitions] = useState<Competition[]>([]); // Initialize as empty, will fetch from Firestore
  // Competition Form States
  const [newCompTitle, setNewCompTitle] = useState("");
  const [newCompType, setNewCompType] = useState<'inter-class' | 'intra-class'>('inter-class');
  const [newCompClassId, setNewCompClassId] = useState("");
  const [newCompPrize, setNewCompPrize] = useState("");
  const [newCompEndDate, setNewCompEndDate] = useState("");

  const [dailyTip, setDailyTip] = useState("جاري تحميل نصيحة اليوم...");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Auth form states
  const [studentLoginName, setStudentLoginName] = useState(""); // Changed from email to studentLoginName
  const [password, setPassword] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => { // Make async
      setUser(user);
      setIsLoggedIn(!!user);
      if (user) {
        // Simple admin check based on email
        if (user.email === 'admin@example.com') {
          setIsAdmin(true);
          setActiveView(AppView.ADMIN);
          setStudentInfo(null); // Clear student info for admin
          setStudentCompletedTasksToday([]); // Clear student completed tasks for admin
        } else {
          setIsAdmin(false);
          setActiveView(AppView.HOME);
          // Fetch student's class and section info
          const info = await fetchStudentClassSectionInfo(user.uid);
          if (info) {
            setStudentInfo(info);
            const studentData = await fetchStudentData(info.classId, info.sectionId, user.uid);
            if (studentData) {
              setStats(prevStats => ({
                ...prevStats,
                name: studentData.name,
                points: studentData.points,
                // level, streak, totalTasks, completedTasks will be updated based on other logic or derived
              }));
            }
            // Fetch student's completed tasks for today
            const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
            let completedTasksIdsToday = await fetchStudentCompletedTasksForDay(user.uid, info.classId, info.sectionId, today);
            if (completedTasksIdsToday === null) {
              await createEmptyDailyCompletionRecord(user.uid, info.classId, info.sectionId, today);
              completedTasksIdsToday = [];
            }
            setStudentCompletedTasksToday(completedTasksIdsToday || []);
          }
        }
      } else {
        // User logged out
        setUser(null); // Ensure user is null on logout
        setIsAdmin(false);
        setActiveView(AppView.LOGIN); // Redirect to login view on logout
        setTasks([]); // Clear tasks on logout
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const loadClasses = async () => {
      if (isLoggedIn) {
        try {
          const fetchedClasses = await fetchClassesFromFirestore();
          setClasses(fetchedClasses);
        } catch (error) {
          console.error("Failed to fetch classes:", error);
        }
      }
    };

    loadClasses();
  }, [isLoggedIn, isAdmin]);

  // Effect for fetching competitions when user logs in (both admin and student)
  useEffect(() => {
    const loadCompetitions = async () => {
      if (isLoggedIn) { // Fetch for both admin and student
        try {
          const fetchedCompetitions = await fetchCompetitionsFromFirestore();
          setCompetitions(fetchedCompetitions);
        } catch (error) {
          console.error("Failed to fetch competitions:", error);
        }
      }
    };
    loadCompetitions();
  }, [isLoggedIn]);

  // Effect for fetching tasks when user logs in
  useEffect(() => {
    const loadTasks = async () => {
      if (isLoggedIn && !isAdmin) { // Only for students
        const fetchedTasks = await fetchTasksFromFirestore();
        // Augment tasks with completion status for today
        const today = new Date().toISOString().split('T')[0];
        if (user && studentInfo) {
          const studentData = await fetchStudentData(studentInfo.classId, studentInfo.sectionId, user.uid);
          if (studentData) {
            setStats(prevStats => ({ ...prevStats, name: studentData.name, points: studentData.points }));
          }
          let completedTasksIdsToday = await fetchStudentCompletedTasksForDay(user.uid, studentInfo.classId, studentInfo.sectionId, today);
          if (completedTasksIdsToday === null) {
            await createEmptyDailyCompletionRecord(user.uid, studentInfo.classId, studentInfo.sectionId, today);
            completedTasksIdsToday = [];
          }
          const augmentedTasks = fetchedTasks.map(task => ({ ...task, completed: completedTasksIdsToday.includes(task.id) }));
          setTasks(augmentedTasks);
          setStudentCompletedTasksToday(completedTasksIdsToday);
        } else {
          // If studentInfo is not yet loaded, just load global tasks without completion status
          setTasks(fetchedTasks.map(task => ({ ...task, completed: false })));
        }
      } else if (isLoggedIn && isAdmin) { // For admin, just fetch global tasks
        const fetchedTasks = await fetchTasksFromFirestore();
        setTasks(fetchedTasks.map(task => ({ ...task, completed: false }))); // Admin view doesn't need student-specific completion
      }
    };
    loadTasks();
  }, [isLoggedIn, isAdmin, user, studentInfo]); // Add user and studentInfo to dependencies

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    document.documentElement.classList.toggle('dark');
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    try {
      // For student login, construct the email from the provided name
      const loginEmail = isRegistering ? studentLoginName.replace(/\s/g, '').toLowerCase() + '@example.com' : studentLoginName.replace(/\s/g, '').toLowerCase() + '@example.com';
      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, loginEmail, password);
      } else {
        await signInWithEmailAndPassword(auth, loginEmail, password);
      }
    } catch (error: any) {
      console.error("Auth error:", error);
      setAuthError("حدث خطأ في المصادقة: " + error.message);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setIsLoggedIn(false);
    setIsAdmin(false);
    setStudentLoginName(""); // Clear studentLoginName on logout
    setPassword("");
  };

  // --- Teacher Actions ---

  // Task Actions
  const handleAddTask = async () => { // Make it async
    const newTask: Task = {
      id: '', // ID will be generated by Firestore
      title: newTaskTitle,
      description: newTaskDescription,
      points: newTaskPoints,
      completed: false,
      icon: newTaskIcon,
      color: newTaskColor,
      category: 'general' // Assuming a default category
    };

    try {
      const taskId = await addTaskToFirestore(newTask); // Add to Firestore
      setTasks([{ ...newTask, id: taskId }, ...tasks]); // Update local state with Firestore ID
      clearTaskForm();
      setActiveView(AppView.ADMIN);
    } catch (error) {
      console.error("Failed to add task:", error);
      // Optionally, show an error message to the user
    }
  };

  const handleUpdateTask = async () => {
    if (!editingTask) return;
    const updatedTask: Task = {
      ...editingTask,
      title: newTaskTitle,
      description: newTaskDescription,
      points: newTaskPoints,
      icon: newTaskIcon,
      color: newTaskColor,
      category: editingTask.category // Ensure category is preserved
    };

    try {
      await updateTaskInFirestore(updatedTask.id, updatedTask);
      setTasks(prev => prev.map(t => t.id === editingTask.id ? updatedTask : t));
      clearTaskForm();
      setActiveView(AppView.ADMIN);
    } catch (error) {
      console.error("Failed to update task:", error);
    }
  };

  const handleDeleteTask = async (id: string) => {
    if (confirm("هل أنت متأكد من حذف هذه المهمة نهائياً؟")) {
      try {
        await deleteTaskFromFirestore(id);
        setTasks(prev => prev.filter(t => t.id !== id));
      } catch (error) {
        console.error("Failed to delete task:", error);
      }
    }
  };

  const startEditingTask = (task: Task) => {
    setEditingTask(task);
    setNewTaskTitle(task.title);
    setNewTaskDescription(task.description);
    setNewTaskPoints(task.points);
    setNewTaskIcon(task.icon);
    setNewTaskColor(task.color);
    setActiveView(AppView.ADMIN_EDIT_TASK);
  };

  const clearTaskForm = () => {
    setEditingTask(null);
    setNewTaskTitle("");
    setNewTaskDescription("");
    setNewTaskPoints(10);
    setNewTaskIcon("eco");
    setNewTaskColor("green");
  };

  // Competition Actions
  const handleAddCompetition = async () => {
    const newComp: Competition = {
      id: '', // Firestore will generate ID
      title: newCompTitle,
      type: newCompType,
      targetClassId: newCompType === 'intra-class' ? newCompClassId : undefined,
      startDate: new Date().toISOString().split('T')[0],
      endDate: newCompEndDate,
      prize: newCompPrize,
      status: 'active',
      createdAt: new Date(), // Add creation timestamp for ordering
    };

    try {
      const compId = await addCompetitionToFirestore(newComp);
      setCompetitions([{ ...newComp, id: compId }, ...competitions]);
      clearCompForm();
      setActiveView(AppView.ADMIN_COMPETITIONS);
    } catch (error) {
      console.error("Failed to add competition:", error);
    }
  };

  const handleUpdateCompetition = async () => {
    if (!editingCompetition) return;
    const updatedComp: Competition = {
      ...editingCompetition,
      title: newCompTitle,
      type: newCompType,
      targetClassId: newCompType === 'intra-class' ? newCompClassId : undefined,
      startDate: editingCompetition.startDate, // Preserve original start date
      endDate: newCompEndDate,
      prize: newCompPrize,
      status: editingCompetition.status, // Preserve original status
    };

    try {
      await updateCompetitionInFirestore(updatedComp.id, updatedComp);
      setCompetitions(prev => prev.map(c => c.id === editingCompetition.id ? updatedComp : c));
      clearCompForm();
      setActiveView(AppView.ADMIN_COMPETITIONS);
    } catch (error) {
      console.error("Failed to update competition:", error);
    }
  };

  const handleDeleteCompetition = async (id: string) => {
    if (confirm("سيتم حذف المسابقة وإيقاف تتبع النقاط الخاصة بها. هل أنت متأكد؟")) {
      try {
        await deleteCompetitionFromFirestore(id);
        setCompetitions(prev => prev.filter(c => c.id !== id));
      } catch (error) {
        console.error("Failed to delete competition:", error);
      }
    }
  };

  const startEditingCompetition = (comp: Competition) => {
    setEditingCompetition(comp);
    setNewCompTitle(comp.title);
    setNewCompType(comp.type);
    setNewCompClassId(comp.targetClassId || "");
    setNewCompPrize(comp.prize);
    setNewCompEndDate(comp.endDate);
    setActiveView(AppView.ADMIN_EDIT_COMPETITION);
  };

  const clearCompForm = () => {
    setEditingCompetition(null);
    setNewCompTitle("");
    setNewCompPrize("");
    setNewCompEndDate("");
    setNewCompClassId("");
    setNewCompType('inter-class');
  };

  // Class & Section Actions
  const handleAddClass = (name: string) => {
    const newClass: ClassRoom = { id: Date.now().toString(), name, sections: [] };
    try {
      // Add class to Firestore
      // We use newClass.id as the document ID in Firestore
      addClassToFirestore(newClass);
      setClasses(prev => [...prev, newClass]); // Update local state
      setNewClassName("");
      setActiveView(AppView.ADMIN_CLASSES);
    } catch (error) {
      console.error("Failed to add class:", error);
    }
  };

  const handleDeleteClass = (id: string) => {
    if (confirm("تحذير: حذف الصف سيؤدي لحذف جميع الشعب والطلاب المرتبطين به. هل أنت متأكد؟")) {
      setClasses(prev => prev.filter(c => c.id !== id));
      if (selectedClass?.id === id) setSelectedClass(null);
    }
  };

  const handleAddSection = async (classId: string, name: string) => {
    const newSection: Section = { id: Date.now().toString(), name, students: [] };
    try {
      await addSectionToFirestore(classId, newSection);
      setClasses(classes.map(c =>
        c.id === classId
          ? { ...c, sections: [...c.sections, newSection] }
          : c
      ));
      if (selectedClass?.id === classId) {
        setSelectedClass(prev => prev ? { ...prev, sections: [...prev.sections, newSection] } : null);
      }
      setNewSectionName("");
      setActiveView(AppView.ADMIN_CLASS_DETAILS);
    } catch (error) {
      console.error("Failed to add section:", error);
      // Optionally, show an error message to the user
    }
  };

  const handleDeleteSection = (classId: string, sectionId: string) => {
    if (confirm("حذف الشعبة سيؤدي لحذف قائمة طلابها. هل أنت متأكد؟")) {
      setClasses(classes.map(c =>
        c.id === classId
          ? { ...c, sections: c.sections.filter(s => s.id !== sectionId) }
          : c
      ));
      if (selectedClass?.id === classId) {
        setSelectedClass(prev => prev ? { ...prev, sections: prev.sections.filter(s => s.id !== sectionId) } : null);
      }
    }
  };

  const handleAddStudent = async (classId: string, sectionId: string, name: string) => {
    setLoading(true);
    try {
      // Add student to Firebase Auth and Firestore
      const newStudent = await addStudentToAuthAndFirestore(classId, sectionId, name, 0); // Initial points 0

      // After adding the student, the admin might be logged out and the new student logged in.
      // We need to re-authenticate the admin to maintain their session.
      await signInWithEmailAndPassword(auth, 'admin@example.com', 'admin123'); // Re-authenticate admin

      setClasses(prevClasses => prevClasses.map(c => {
        if (c.id === classId) {
          return {
            ...c,
            sections: c.sections.map(s =>
              s.id === sectionId
                ? { ...s, students: [...s.students, newStudent] }
                : s
            )
          };
        }
        return c;
      }));

      if (selectedSection?.id === sectionId) {
        setSelectedSection(prev => prev ? { ...prev, students: [...prev.students, newStudent] } : null);
      }
      setNewStudentName("");
      setActiveView(AppView.ADMIN_SECTION_DETAILS);
    } catch (error) {
      console.error("Failed to add student:", error);
      // Optionally, show an error message to the user
    }
    setLoading(false);
  };

  const handleDeleteStudent = async (classId: string, sectionId: string, studentId: string) => {
    if (confirm("هل تريد حذف هذا الطالب من النظام؟")) {
      try {
        await deleteStudentFromAuthAndFirestore(classId, sectionId, studentId);
        setClasses(prevClasses => prevClasses.map(c => {
          if (c.id === classId) {
            return {
              ...c,
              sections: c.sections.map(s =>
                s.id === sectionId
                  ? { ...s, students: s.students.filter(st => st.id !== studentId) }
                  : s
              )
            };
          }
          return c;
        }));

        if (selectedSection?.id === sectionId) {
          setSelectedSection(prev => prev ? { ...prev, students: prev.students.filter(st => st.id !== studentId) } : null);
        }
      } catch (error) {
        console.error("Failed to delete student:", error);
      }
    }
  };

  // Effect for fetching daily tip (student view)
  useEffect(() => {
    if (isLoggedIn && !isAdmin) {
      const fetchTip = async () => {
        const tip = await getGardeningTip();
        setDailyTip(tip);
      };
      fetchTip();
    }
  }, [isLoggedIn, isAdmin]);






  // Common Task Toggle (Student Logic)
  const toggleTask = (id: string) => {
    setTasks(prev => prev.map(task => {
      if (task.id === id) {
        const newState = !task.completed;
        if (newState) {
          // Update Firestore for student's daily completion
          if (user && studentInfo) {
            const today = new Date().toISOString().split('T')[0];
            toggleStudentTaskCompletionInFirestore(user.uid, studentInfo.classId, studentInfo.sectionId, id, today, true)
              .then(() => {
                setStudentCompletedTasksToday(prev => [...prev, id]);
                setStats(s => {
                  const newPoints = s.points + task.points;
                  updateStudentPointsAndLastOpenDate(studentInfo.classId, studentInfo.sectionId, user.uid, newPoints).catch(error => console.error("Failed to update student points:", error));
                  return { ...s, points: newPoints, completedTasks: s.completedTasks + 1 };
                });
              })
              .catch(error => console.error("Failed to mark task as complete in Firestore:", error));
          }
        } else {
          // Update Firestore for student's daily uncompletion
          if (user && studentInfo) {
            const today = new Date().toISOString().split('T')[0];
            toggleStudentTaskCompletionInFirestore(user.uid, studentInfo.classId, studentInfo.sectionId, id, today, false)
              .then(() => {
                setStudentCompletedTasksToday(prev => prev.filter(taskId => taskId !== id));
                setStats(s => {
                  const newPoints = s.points - task.points;
                  updateStudentPointsAndLastOpenDate(studentInfo.classId, studentInfo.sectionId, user.uid, newPoints).catch(error => console.error("Failed to update student points:", error));
                  return { ...s, points: newPoints, completedTasks: Math.max(0, s.completedTasks - 1) };
                });
              })
              .catch(error => console.error("Failed to mark task as incomplete in Firestore:", error));
          }
        }
        return { ...task, completed: newState };
      }
      return task;
    }));
  };
  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    const userMsg: ChatMessage = { role: 'user', text: inputMessage };
    setChatMessages(prev => [...prev, userMsg]);
    setInputMessage("");
    setIsTyping(true);

    const history = chatMessages.map(m => ({
      role: m.role,
      parts: [{ text: m.text }]
    }));

    const response = await chatWithMentor(inputMessage, history);
    setChatMessages(prev => [...prev, { role: 'model', text: response }]);
    setIsTyping(false);
  };

  const copyToClipboard = (str: string) => {
    navigator.clipboard.writeText(str);
    setToastText('تم النسخ!')
    return setTimeout(() => {
      setToastText('');
    }, 1000);
  }

  // --- Render Admin Views ---

  const renderAdmin = () => (
    <div className="p-4 pb-24 animate-in slide-in-from-right duration-500 overflow-x-hidden">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-primary-dark dark:text-primary">لوحة المعلمة</h2>
          <p className="text-sm text-gray-500">إدارة المهام، المسابقات، والطلاب</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setActiveView(AppView.ADMIN_PROFILE)} className="bg-primary/10 text-primary p-2 rounded-xl">
            <Icon name="person" filled />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <button onClick={() => setActiveView(AppView.ADMIN_CLASSES)} className="bg-white dark:bg-[#1a2e1f] p-4 rounded-2xl shadow-sm border dark:border-gray-800 text-right flex flex-col justify-between h-32 hover:border-primary/50 transition-colors">
          <Icon name="school" className="text-primary text-3xl mb-2" filled />
          <div>
            <p className="text-sm font-bold">إدارة الصفوف</p>
            <p className="text-[10px] text-gray-400">تنظيم الشُعب والطلاب</p>
          </div>
        </button>
        <button onClick={() => setActiveView(AppView.ADMIN_COMPETITIONS)} className="bg-white dark:bg-[#1a2e1f] p-4 rounded-2xl shadow-sm border dark:border-gray-800 text-right flex flex-col justify-between h-32 hover:border-primary/50 transition-colors">
          <Icon name="emoji_events" className="text-yellow-500 text-3xl mb-2" filled />
          <div>
            <p className="text-sm font-bold">المسابقات</p>
            <p className="text-[10px] text-gray-400">إدارة التحديات والجوائز</p>
          </div>
        </button>
      </div>

      <div className="space-y-6">
        <section>
          <div className="flex justify-between items-center mb-3 px-1">
            <h3 className="font-bold text-lg">المهام النشطة</h3>
            <button
              onClick={() => {
                clearTaskForm();
                setActiveView(AppView.ADMIN_ADD_TASK);
              }}
              className="text-xs text-primary font-bold flex items-center gap-1 bg-primary/10 px-3 py-1.5 rounded-full"
            >
              <Icon name="add_circle" className="text-sm" /> مهمة جديدة
            </button>
          </div>
          <div className="bg-white dark:bg-[#1a2e1f] rounded-2xl border dark:border-gray-800 divide-y dark:divide-gray-800 overflow-hidden shadow-sm">
            {tasks.map(task => (
              <div key={task.id} className="p-4 flex justify-between items-center hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`size-10 rounded-lg bg-${task.color}-100 flex items-center justify-center`}>
                    <Icon name={task.icon} className={`text-${task.color}-500`} />
                  </div>
                  <div>
                    <span className="text-sm font-bold block">{task.title}</span>
                    <span className="text-[10px] text-gray-400">{task.points} نقطة</span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => startEditingTask(task)}
                    className="text-primary hover:bg-primary/10 p-2 rounded-full transition-colors"
                    title="تعديل"
                  >
                    <Icon name="edit" className="text-sm" />
                  </button>
                  <button
                    onClick={() => handleDeleteTask(task.id)}
                    className="text-red-500 hover:bg-red-50 p-2 rounded-full transition-colors"
                    title="حذف"
                  >
                    <Icon name="delete" className="text-sm" />
                  </button>
                </div>
              </div>
            ))}
            {tasks.length === 0 && (
              <div className="p-10 text-center opacity-30">
                <Icon name="checklist" className="text-4xl mb-2" />
                <p className="text-sm italic">لا توجد مهام حالياً</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );

  const renderAdminCompetitions = () => (
    <div className="p-4 pb-24 animate-in slide-in-from-bottom duration-500">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => setActiveView(AppView.ADMIN)} className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full">
            <Icon name="arrow_forward" />
          </button>
          <h2 className="text-2xl font-bold">المسابقات</h2>
        </div>
        <button
          onClick={() => { clearCompForm(); setActiveView(AppView.ADMIN_ADD_COMPETITION); }}
          className="bg-primary text-white px-4 py-2 rounded-full text-xs font-bold shadow-lg"
        >
          + مسابقة جديدة
        </button>
      </div>

      <div className="space-y-4">
        {competitions.map(comp => (
          <div key={comp.id} className="bg-white dark:bg-[#1a2e1f] p-5 rounded-2xl border dark:border-gray-800 shadow-sm relative group overflow-hidden">
            {/* Action Buttons */}
            <div className="absolute top-4 left-4 flex gap-2">
              <button
                onClick={() => startEditingCompetition(comp)}
                className="p-2 bg-primary/10 text-primary rounded-full hover:bg-primary/20 transition-colors"
                title="تعديل المسابقة"
              >
                <Icon name="edit" className="text-sm" />
              </button>
              <button
                onClick={() => handleDeleteCompetition(comp.id)}
                className="p-2 bg-red-100 text-red-600 rounded-full hover:bg-red-200 transition-colors"
                title="حذف المسابقة"
              >
                <Icon name="delete" className="text-sm" />
              </button>
            </div>

            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="size-12 bg-yellow-100 text-yellow-600 rounded-xl flex items-center justify-center">
                  <Icon name="emoji_events" filled />
                </div>
                <div>
                  <h3 className="font-bold text-lg">{comp.title}</h3>
                  <div className="flex gap-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${comp.type === 'inter-class' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'}`}>
                      {comp.type === 'inter-class' ? 'بين الصفوف' : 'داخل الصف'}
                    </span>
                    {comp.targetClassId && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-bold">
                        {classes.find(c => c.id === comp.targetClassId)?.name}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Icon name="calendar_month" className="text-sm" />
                <span>ينتهي في: {comp.endDate}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-600 font-bold">
                <Icon name="card_giftcard" className="text-sm" />
                <span>الجائزة: {comp.prize}</span>
              </div>
            </div>

            <button className="w-full py-2 bg-gray-50 dark:bg-gray-900 text-gray-500 text-xs font-bold rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
              عرض قائمة المتصدرين
            </button>
          </div>
        ))}
        {competitions.length === 0 && (
          <div className="text-center py-20 opacity-30">
            <Icon name="military_tech" className="text-6xl mb-4" />
            <p>لا يوجد مسابقات نشطة حالياً</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderCompetitionForm = (isEdit: boolean) => (
    <div className="p-6 animate-in slide-in-from-bottom duration-300">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => { clearCompForm(); setActiveView(AppView.ADMIN_COMPETITIONS); }} className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full">
          <Icon name="arrow_forward" />
        </button>
        <h2 className="text-2xl font-bold">{isEdit ? 'تعديل مسابقة' : 'تنظيم مسابقة'}</h2>
      </div>

      <div className="bg-white dark:bg-[#1a2e1f] p-6 rounded-[2rem] border dark:border-gray-800 space-y-4">
        <div>
          <label className="text-sm font-bold block mb-2">اسم المسابقة</label>
          <input
            type="text"
            placeholder="مثلاً: بطل الزراعة الصيفي"
            value={newCompTitle}
            onChange={(e) => setNewCompTitle(e.target.value)}
            className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-2xl p-4 focus:ring-primary"
            dir="rtl"
          />
        </div>

        <div>
          <label className="text-sm font-bold block mb-2">نوع المسابقة</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setNewCompType('inter-class')}
              className={`py-3 rounded-2xl border-2 font-bold text-sm transition-all ${newCompType === 'inter-class' ? 'border-primary bg-primary/10 text-primary' : 'border-gray-100 text-gray-400'}`}
            >
              بين الصفوف
            </button>
            <button
              onClick={() => setNewCompType('intra-class')}
              className={`py-3 rounded-2xl border-2 font-bold text-sm transition-all ${newCompType === 'intra-class' ? 'border-primary bg-primary/10 text-primary' : 'border-gray-100 text-gray-400'}`}
            >
              داخل الصف
            </button>
          </div>
        </div>

        {newCompType === 'intra-class' && (
          <div className="animate-in slide-in-from-top duration-200">
            <label className="text-sm font-bold block mb-2">اختر الصف المستهدف</label>
            <select
              value={newCompClassId}
              onChange={(e) => setNewCompClassId(e.target.value)}
              className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-2xl p-4 focus:ring-primary appearance-none"
            >
              <option value="">اختر صفاً...</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}

        <div>
          <label className="text-sm font-bold block mb-2">الجائزة</label>
          <input
            type="text"
            placeholder="مثلاً: قسيمة شراء بقيمة 100 ريال"
            value={newCompPrize}
            onChange={(e) => setNewCompPrize(e.target.value)}
            className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-2xl p-4 focus:ring-primary"
            dir="rtl"
          />
        </div>

        <div>
          <label className="text-sm font-bold block mb-2">تاريخ الانتهاء</label>
          <input
            type="date"
            value={newCompEndDate}
            onChange={(e) => setNewCompEndDate(e.target.value)}
            className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-2xl p-4 focus:ring-primary"
          />
        </div>

        <button
          disabled={!newCompTitle.trim() || !newCompEndDate || (newCompType === 'intra-class' && !newCompClassId)}
          onClick={isEdit ? handleUpdateCompetition : handleAddCompetition}
          className="w-full py-4 bg-primary text-white font-bold rounded-2xl shadow-lg disabled:opacity-50 mt-4 active:scale-[0.98] transition-all"
        >
          {isEdit ? 'تحديث المسابقة' : 'إطلاق المسابقة'}
        </button>
      </div>
    </div>
  );

  const renderTaskForm = (isEdit: boolean) => (
    <div className="p-6 animate-in slide-in-from-bottom duration-300">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => { clearTaskForm(); setActiveView(AppView.ADMIN); }} className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full">
          <Icon name="arrow_forward" />
        </button>
        <h2 className="text-2xl font-bold">{isEdit ? 'تعديل المهمة' : 'إضافة مهمة جديدة'}</h2>
      </div>

      <div className="bg-white dark:bg-[#1a2e1f] p-6 rounded-[2rem] border dark:border-gray-800 space-y-4">
        <div>
          <label className="text-sm font-bold block mb-2">عنوان المهمة</label>
          <input
            type="text"
            placeholder="مثلاً: ري النعناع"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-2xl p-4 focus:ring-primary"
            dir="rtl"
          />
        </div>

        <div>
          <label className="text-sm font-bold block mb-2">وصف المهمة</label>
          <textarea
            placeholder="اشرح للطلاب ماذا يفعلون..."
            value={newTaskDescription}
            onChange={(e) => setNewTaskDescription(e.target.value)}
            className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-2xl p-4 focus:ring-primary h-24"
            dir="rtl"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-bold block mb-2">النقاط</label>
            <input
              type="number"
              value={newTaskPoints}
              onChange={(e) => setNewTaskPoints(parseInt(e.target.value) || 0)}
              className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-2xl p-4 focus:ring-primary"
            />
          </div>
          <div>
            <label className="text-sm font-bold block mb-2">اللون</label>
            <select
              value={newTaskColor}
              onChange={(e) => setNewTaskColor(e.target.value)}
              className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-2xl p-4 focus:ring-primary appearance-none"
            >
              <option value="green">أخضر</option>
              <option value="blue">أزرق</option>
              <option value="orange">برتقالي</option>
              <option value="yellow">أصفر</option>
              <option value="purple">بنفسجي</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-sm font-bold block mb-2">الأيقونة</label>
          <div className="grid grid-cols-4 gap-2">
            {['eco', 'water_drop', 'photo_camera', 'light_mode', 'potted_plant', 'agriculture', 'nest_eco_leaf', 'psychology_alt'].map(icon => (
              <button
                key={icon}
                onClick={() => setNewTaskIcon(icon)}
                className={`p-3 rounded-xl border-2 transition-all ${newTaskIcon === icon ? 'border-primary bg-primary/10' : 'border-gray-100 dark:border-gray-800'}`}
              >
                <Icon name={icon} className={newTaskIcon === icon ? 'text-primary' : 'text-gray-400'} filled={newTaskIcon === icon} />
              </button>
            ))}
          </div>
        </div>

        <button
          disabled={!newTaskTitle.trim()}
          onClick={isEdit ? handleUpdateTask : handleAddTask}
          className="w-full py-4 bg-primary text-white font-bold rounded-2xl shadow-lg disabled:opacity-50 mt-4 active:scale-[0.98] transition-all"
        >
          {isEdit ? 'تحديث المهمة' : 'حفظ المهمة ونشرها'}
        </button>
      </div>
    </div>
  );

  const renderAdminClasses = () => (
    <div className="p-4 pb-24 animate-in slide-in-from-bottom duration-500">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => setActiveView(AppView.ADMIN)} className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full">
            <Icon name="arrow_forward" />
          </button>
          <h2 className="text-2xl font-bold">إدارة الصفوف</h2>
        </div>
        <button
          onClick={() => setActiveView(AppView.ADMIN_ADD_CLASS)}
          className="bg-primary text-white p-2 rounded-full shadow-lg"
        >
          <Icon name="add" className="text-xl" />
        </button>
      </div>

      <div className="space-y-4">
        {classes.map(cls => (
          <div
            key={cls.id}
            className="bg-white dark:bg-[#1a2e1f] rounded-2xl p-5 border dark:border-gray-800 shadow-sm flex items-center justify-between group"
          >
            <div
              onClick={() => { setSelectedClass(cls); setActiveView(AppView.ADMIN_CLASS_DETAILS); }}
              className="flex items-center gap-4 cursor-pointer flex-1"
            >
              <div className="size-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                <Icon name="school" filled />
              </div>
              <div>
                <h3 className="text-lg font-bold">{cls.name}</h3>
                <p className="text-xs text-gray-500">{cls.sections.length} شُعب - {cls.sections.reduce((a, s) => a + s.students.length, 0)} طالب</p>
              </div>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => handleDeleteClass(cls.id)}
                className="text-red-400 hover:text-red-600 p-2 rounded-full hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                title="حذف الصف"
              >
                <Icon name="delete" className="text-lg" />
              </button>
              <Icon name="chevron_left" className="text-gray-300 self-center" />
            </div>
          </div>
        ))}
        {classes.length === 0 && (
          <p className="text-center py-20 text-gray-400 text-sm">لا توجد صفوف مضافة حالياً</p>
        )}
      </div>
    </div>
  );

  const renderAddClass = () => (
    <div className="p-6 animate-in slide-in-from-bottom duration-300">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => setActiveView(AppView.ADMIN_CLASSES)} className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full">
          <Icon name="arrow_forward" />
        </button>
        <h2 className="text-2xl font-bold">إضافة صف جديد</h2>
      </div>
      <div className="bg-white dark:bg-[#1a2e1f] p-6 rounded-3xl border dark:border-gray-800">
        <label className="text-sm font-bold block mb-2">اسم الصف الدراسي</label>
        <input
          type="text"
          placeholder="مثلاً: الصف السادس"
          value={newClassName}
          onChange={(e) => setNewClassName(e.target.value)}
          className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-2xl p-4 mb-6 focus:ring-primary"
          dir="rtl"
        />
        <button
          disabled={!newClassName.trim()}
          onClick={() => handleAddClass(newClassName)}
          className="w-full py-4 bg-primary text-white font-bold rounded-2xl shadow-lg disabled:opacity-50"
        >
          حفظ الصف
        </button>
      </div>
    </div>
  );

  const renderAddSection = () => (
    <div className="p-6 animate-in slide-in-from-bottom duration-300">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => setActiveView(AppView.ADMIN_CLASS_DETAILS)} className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full">
          <Icon name="arrow_forward" />
        </button>
        <h2 className="text-2xl font-bold">إضافة شعبة</h2>
      </div>
      <div className="bg-white dark:bg-[#1a2e1f] p-6 rounded-3xl border dark:border-gray-800">
        <p className="text-xs text-gray-500 mb-4">أنت تضيف شعبة جديدة إلى: {selectedClass?.name}</p>
        <label className="text-sm font-bold block mb-2">اسم الشعبة</label>
        <input
          type="text"
          placeholder="مثلاً: أ"
          value={newSectionName}
          onChange={(e) => setNewSectionName(e.target.value)}
          className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-2xl p-4 mb-6 focus:ring-primary"
          dir="rtl"
        />
        <button
          disabled={!newSectionName.trim()}
          onClick={() => selectedClass && handleAddSection(selectedClass.id, newSectionName)}
          className="w-full py-4 bg-primary text-white font-bold rounded-2xl shadow-lg disabled:opacity-50"
        >
          حفظ الشعبة
        </button>
      </div>
    </div>
  );

  const renderAddStudent = () => (
    <div className="p-6 animate-in slide-in-from-bottom duration-300">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => setActiveView(AppView.ADMIN_SECTION_DETAILS)} className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full">
          <Icon name="arrow_forward" />
        </button>
        <h2 className="text-2xl font-bold">إضافة طالب</h2>
      </div>
      <div className="bg-white dark:bg-[#1a2e1f] p-6 rounded-3xl border dark:border-gray-800">
        <p className="text-xs text-gray-500 mb-4">أنت تضيف طالب إلى: {selectedClass?.name} - شعبة {selectedSection?.name}</p>
        <label className="text-sm font-bold block mb-2">اسم الطالب الكامل</label>
        <input
          type="text"
          placeholder="مثلاً: علي محمد"
          value={newStudentName}
          onChange={(e) => setNewStudentName(e.target.value)}
          className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-2xl p-4 pr-12 focus:ring-2 focus:ring-primary text-right"
          dir="rtl"
        />
        <button
          disabled={!newStudentName.trim()}
          onClick={() => selectedClass && selectedSection && handleAddStudent(selectedClass.id, selectedSection.id, newStudentName)}
          className="w-full py-4 bg-primary text-white font-bold rounded-2xl shadow-lg disabled:opacity-50 mt-4 active:scale-[0.98] transition-all"
        >
          إضافة الطالب
        </button>
      </div>
    </div>
  );

  const renderClassDetails = () => {
    if (!selectedClass) return null;
    return (
      <div className="p-4 pb-24 animate-in slide-in-from-right duration-500">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button onClick={() => setActiveView(AppView.ADMIN_CLASSES)} className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full">
              <Icon name="arrow_forward" />
            </button>
            <h2 className="text-2xl font-bold">{selectedClass.name}</h2>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <h3 className="font-bold text-lg px-1">شُعب الصف</h3>
          {selectedClass.sections.map(sec => (
            <div
              key={sec.id}
              className="bg-white dark:bg-[#1a2e1f] p-4 rounded-2xl border dark:border-gray-800 flex justify-between items-center group transition-all"
            >
              <div
                onClick={() => { setSelectedSection(sec); setActiveView(AppView.ADMIN_SECTION_DETAILS); }}
                className="flex items-center gap-3 cursor-pointer flex-1"
              >
                <div className="size-10 bg-primary/20 rounded-full flex items-center justify-center text-primary font-bold">
                  {sec.name}
                </div>
                <div>
                  <p className="font-bold">شعبة {sec.name}</p>
                  <p className="text-xs text-gray-500">{sec.students.length} طالب</p>
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => handleDeleteSection(selectedClass.id, sec.id)}
                  className="text-red-400 hover:text-red-600 p-2 rounded-full hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                  title="حذف الشعبة"
                >
                  <Icon name="delete" className="text-lg" />
                </button>
                <Icon name="chevron_left" className="text-gray-300 self-center" />
              </div>
            </div>
          ))}
          <button
            onClick={() => setActiveView(AppView.ADMIN_ADD_SECTION)}
            className="py-4 border-2 border-dashed border-gray-300 rounded-2xl text-gray-400 font-bold flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors"
          >
            <Icon name="add" /> إضافة شعبة جديدة
          </button>
        </div>
      </div>
    );
  };

  const renderSectionDetails = () => {
    if (!selectedSection || !selectedClass) return null;
    return (
      <div className="p-4 pb-24 animate-in slide-in-from-right duration-500">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button onClick={() => setActiveView(AppView.ADMIN_CLASS_DETAILS)} className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full">
              <Icon name="arrow_forward" />
            </button>
            <div>
              <h2 className="text-2xl font-bold">شعبة {selectedSection.name}</h2>
              <p className="text-xs text-gray-500">{selectedClass.name}</p>
            </div>
          </div>
          <button
            onClick={() => setActiveView(AppView.ADMIN_ADD_STUDENT)}
            className="bg-primary text-white px-4 py-2 rounded-full text-xs font-bold shadow-md shadow-primary/20"
          >
            + طالب جديد
          </button>
        </div>

        <div className="bg-white dark:bg-[#1a2e1f] rounded-2xl border dark:border-gray-800 overflow-hidden divide-y dark:divide-gray-800 shadow-sm">
          {selectedSection.students.map((student, i) => (
            <div key={student.id} className="p-4 flex items-center justify-between group">
              <div className="flex items-center gap-3">
                <span className="text-gray-300 font-bold text-xs">{i + 1}</span>
                <div>
                  <p className="text-sm font-medium">{student.name}</p>
                  <p className="text-[10px] text-gray-400 flex items-center mb-2">اسم المستخدم: {student.name.replace(/\s/g, '')} <span onClick={() => copyToClipboard(student.name.replace(/\s/g, ''))}><Icon name="content_copy" /></span></p>
                  <p className="text-[10px] text-gray-400 flex items-center mb-2">كلمة المرور: {student.name.replace(/\s/g, '')}123 <span onClick={() => copyToClipboard(student.name.replace(/\s/g, '') + '123')}><Icon name="content_copy" /></span></p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-left">
                  <span className="text-xs font-bold text-primary">{student.points} pts</span>
                </div>
                <button
                  onClick={() => handleDeleteStudent(selectedClass.id, selectedSection.id, student.id)}
                  className="text-red-400 hover:text-red-600 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  title="حذف الطالب"
                >
                  <Icon name="close" className="text-sm" />
                </button>
              </div>
            </div>
          ))}
          {selectedSection.students.length === 0 && (
            <p className="text-center py-10 text-gray-400 text-sm italic">لا يوجد طلاب في هذه الشعبة بعد</p>
          )}
        </div>
      </div>
    );
  };

  const renderAdminProfile = () => (
    <div className="p-4 pb-24 animate-in slide-in-from-top duration-500 overflow-x-hidden">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => setActiveView(AppView.ADMIN)} className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full">
          <Icon name="arrow_forward" />
        </button>
        <h2 className="text-2xl font-bold">حساب المعلمة</h2>
      </div>

      <div className="bg-white dark:bg-[#1a2e1f] rounded-3xl p-8 shadow-sm border dark:border-gray-800 text-center mb-6">
        <div className="relative inline-block mb-4">
          <img
            src="https://picsum.photos/seed/teacher/200/200"
            className="rounded-3xl h-32 w-32 border-8 border-primary/10 object-cover mx-auto"
            alt="Teacher Profile"
          />
          <div className="absolute -bottom-2 -right-2 bg-primary text-white rounded-full p-2 border-4 border-white dark:border-[#1a2e1f]">
            <Icon name="school" className="text-xl" filled />
          </div>
        </div>
        <h2 className="text-2xl font-bold">وضحى المري</h2>
      </div>

      <div className="space-y-3">
        <button
          onClick={toggleDarkMode}
          className="w-full flex items-center justify-between p-4 bg-white dark:bg-[#1a2e1f] rounded-2xl border dark:border-gray-800"
        >
          <div className="flex items-center gap-3">
            <Icon name={isDarkMode ? 'light_mode' : 'dark_mode'} className="text-gray-500" />
            <span className="font-medium">{isDarkMode ? 'الوضع الفاتح' : 'الوضع الليلي'}</span>
          </div>
          <div className={`w-12 h-6 rounded-full p-1 transition-colors ${isDarkMode ? 'bg-primary' : 'bg-gray-300'}`}>
            <div className={`bg-white size-4 rounded-full transition-transform ${isDarkMode ? '-translate-x-6' : 'translate-x-0'}`}></div>
          </div>
        </button>

        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-between p-4 bg-white dark:bg-[#1a2e1f] rounded-2xl border dark:border-gray-800 text-red-500 group active:bg-red-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Icon name="logout" className="group-hover:translate-x-1 transition-transform" />
            <span className="font-medium">تسجيل الخروج</span>
          </div>
        </button>
      </div>
    </div>
  );

  // --- Student Views ---

  const renderHome = () => (
    <div className="animate-in fade-in duration-500">
      <div className="p-4">
        <div className="bg-white dark:bg-[#1a2e1f] rounded-xl p-4 shadow-sm border border-[#dbe6df] dark:border-[#2a3f30]">
          <div className="flex gap-4 items-center">
            <div className="relative">
              <img src="https://picsum.photos/seed/gardener/100/100" className="rounded-full h-20 w-20 border-4 border-primary/20 object-cover" alt="Profile" />
              <div className="absolute -bottom-1 -right-1 bg-primary text-white rounded-full p-1 border-2 border-white dark:border-[#1a2e1f]">
                <Icon name="verified" className="text-sm" filled />
              </div>
            </div>
            <div className="flex flex-col justify-center flex-1">
              <p className="text-[#111813] dark:text-white text-xl font-bold leading-tight">{stats.name}</p>
              <div className="flex items-center gap-1 mt-1">
                <Icon name="potted_plant" className="text-primary text-sm" />
                <p className="text-[#61896f] dark:text-[#a3c3ad] text-sm font-medium">{stats.level}</p>
              </div>
              <div className="flex items-center gap-1 mt-1">
                <Icon name="energy_savings_leaf" className="text-primary text-sm" filled />
                <p className="text-primary font-bold text-sm">{stats.points} نقطة</p>
              </div>
            </div>
            <button onClick={() => setActiveView(AppView.PROFILE)} className="bg-[#f0f4f2] dark:bg-[#2a3f30] p-2 rounded-full text-[#111813] dark:text-white">
              <Icon name="settings" className="text-sm" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 px-4">
        <div className="flex min-w-[140px] flex-1 flex-col gap-1 rounded-xl p-4 bg-white dark:bg-[#1a2e1f] border border-[#dbe6df] dark:border-[#2a3f30] shadow-sm">
          <div className="flex justify-between items-start">
            <p className="text-[#61896f] dark:text-[#a3c3ad] text-xs font-medium uppercase tracking-wider">النقاط</p>
            <Icon name="military_tech" className="text-primary" filled />
          </div>
          <p className="text-[#111813] dark:text-white text-2xl font-bold leading-tight">{stats.points.toLocaleString()}</p>
          <p className="text-[#078829] text-xs font-bold bg-[#078829]/10 self-start px-2 py-0.5 rounded-full">+12% اليوم</p>
        </div>
        <div className="flex min-w-[140px] flex-1 flex-col gap-1 rounded-xl p-4 bg-white dark:bg-[#1a2e1f] border border-[#dbe6df] dark:border-[#2a3f30] shadow-sm">
          <div className="flex justify-between items-start">
            <p className="text-[#61896f] dark:text-[#a3c3ad] text-xs font-medium uppercase tracking-wider">سلسلة الأيام</p>
            <Icon name="local_fire_department" className="text-orange-500" filled />
          </div>
          <p className="text-[#111813] dark:text-white text-2xl font-bold leading-tight">{stats.streak} أيام</p>
          <p className="text-[#61896f] dark:text-[#a3c3ad] text-xs">أداء متميز!</p>
        </div>
      </div>

      <div className="px-4 pt-6">
        <div className="bg-primary/10 border border-primary/20 p-4 rounded-xl flex items-center gap-3">
          <Icon name="lightbulb" className="text-primary animate-bounce" filled />
          <p className="text-sm font-medium italic">"{dailyTip}"</p>
        </div>
      </div>

      <div className="px-4 flex justify-between items-center pt-2">
        <h2 className="text-[#111813] dark:text-white text-[20px] font-bold">المهام القادمة</h2>
        <button onClick={() => setActiveView(AppView.TASKS)} className="text-primary text-sm font-bold">عرض الكل</button>
      </div>
      <div className="px-4 flex flex-col gap-3 py-3 pb-24">
        {tasks.filter(t => !t.completed).slice(0, 2).map(task => (
          <div key={task.id} className="flex items-center gap-4 bg-white dark:bg-[#1a2e1f] p-4 rounded-xl border border-[#dbe6df] dark:border-[#2a3f30] shadow-sm">
            <div className={`size-12 rounded-lg bg-${task.color}-100 dark:bg-${task.color}-900/30 flex items-center justify-center`}>
              <Icon name={task.icon} className={`text-${task.color}-500`} />
            </div>
            <div className="flex-1">
              <p className="text-[#111813] dark:text-white font-bold text-sm">{task.title}</p>
              <p className="text-[#61896f] dark:text-[#a3c3ad] text-xs">{task.description}</p>
            </div>
            <button onClick={() => toggleTask(task.id)} className="bg-primary text-white px-4 py-2 rounded-lg text-xs font-bold shadow-md active:scale-95 transition-transform">ابدأ</button>
          </div>
        ))}
      </div>
    </div>
  );

  const renderTasks = () => (
    <div className="p-4 pb-24 animate-in slide-in-from-bottom duration-500">
      <div className="flex justify-between items-end mb-6">
        <div>
          <h2 className="text-2xl font-bold">مهامي اليومية</h2>
          <p className="text-gray-500 text-sm">أنجز المهام لتحصل على نقاط!</p>
        </div>
        <div className="text-left">
          <p className="text-primary font-bold">{tasks.filter(t => t.completed).length}/{tasks.length}</p>
          <div className="w-24 bg-gray-200 h-1.5 rounded-full overflow-hidden mt-1">
            <div className="bg-primary h-full transition-all duration-500" style={{ width: `${(tasks.filter(t => t.completed).length / tasks.length) * 100}%` }}></div>
          </div>
        </div>
      </div>
      <div className="space-y-4">
        {tasks.map(task => (
          <div key={task.id} className={`flex items-center gap-4 bg-white dark:bg-[#1a2e1f] p-4 rounded-xl border border-[#dbe6df] dark:border-[#2a3f30] shadow-sm transition-all ${task.completed ? 'opacity-60 grayscale' : ''}`}>
            <div className={`size-14 rounded-xl bg-${task.color}-50 dark:bg-${task.color}-900/20 flex items-center justify-center shrink-0`}>
              <Icon name={task.icon} className={`text-3xl text-${task.color}-500`} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className={`font-bold ${task.completed ? 'line-through' : ''}`}>{task.title}</p>
                <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-[10px] font-bold">+{task.points} pts</span>
              </div>
              <p className="text-gray-500 text-sm leading-tight mt-1">{task.description}</p>
            </div>
            <button onClick={() => toggleTask(task.id)} className={`size-10 rounded-full flex items-center justify-center transition-all ${task.completed ? 'bg-primary text-white' : 'border-2 border-primary/30 text-primary hover:bg-primary/10'}`}>
              {task.completed ? <Icon name="check" className="font-bold" /> : <Icon name="add" />}
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  const renderChallenges = () => {
    // Find the student's class from the fetched classes.
    const studentClass = studentInfo ? classes.find(c => c.id === studentInfo.classId) : undefined;
    // Filter competitions relevant to the student.
    const studentRelevantCompetitions = competitions.filter(comp => {
      if (comp.type === 'inter-class') {
        return true; // All inter-class competitions are relevant
      }
      // For intra-class, it must target the student's class
      return comp.type === 'intra-class' && comp.targetClassId === studentInfo?.classId;
    });

    // Calculate class rankings (if studentClass is available).
    // Note: If 'classes' state only contains the student's class, this ranking will be limited.
    const classRankings = classes.map(c => ({
      name: c.name,
      points: c.sections.reduce((acc, s) => acc + s.students.reduce((acc2, st) => acc2 + st.points, 0), 0)
    })).sort((a, b) => b.points - a.points);

    // Calculate student rankings within their class (if studentClass is available)
    const studentRankings = studentClass?.sections.flatMap(s => s.students).sort((a, b) => b.points - a.points) || [];

    return (
      <div className="p-4 pb-24 animate-in slide-in-from-bottom duration-500">
        <h2 className="text-2xl font-bold mb-2">المسابقات والتحديات</h2>
        <p className="text-gray-500 text-sm mb-6">تنافس مع زملائك واجمع أكبر قدر من النقاط!</p>

        {studentRelevantCompetitions && studentRelevantCompetitions.length > 0 && (
          studentRelevantCompetitions.map(userComp => (
            <section key={userComp.id} className="bg-white dark:bg-[#1a2e1f] rounded-3xl border dark:border-gray-800 p-6 shadow-sm mb-8">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-lg">{userComp.title}</h3>
                <div className="bg-yellow-400 text-white px-3 py-1 rounded-full text-[10px] font-bold animate-pulse">
                  مسابقة نشطة
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">لوحة المتصدرين (الصفوف)</h4>
                <div className="space-y-3">
                  {classRankings.map((cr, idx) => (
                    <div key={idx} className={`flex items-center justify-between p-3 rounded-2xl ${cr.name === 'الصف السادس' ? 'bg-primary/10 border border-primary/20' : 'bg-gray-50 dark:bg-gray-900'}`}>
                      <div className={`flex items-center gap-3 ${cr.name === studentClass?.name ? 'text-primary' : ''}`}>
                        <div className={`size-8 rounded-full flex items-center justify-center font-bold text-sm ${idx === 0 ? 'bg-yellow-400 text-white' : 'bg-gray-200 text-gray-500'}`}>
                          {idx + 1}
                        </div>
                        <span className="font-bold text-sm">{cr.name}</span>
                      </div>
                      <span className="text-sm font-bold text-primary">{cr.points} نقطة</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ))
        )}
        {studentRelevantCompetitions.length === 0 && (
          <div className="text-center py-20 opacity-30">
            <Icon name="military_tech" className="text-6xl mb-4" />
            <p>لا يوجد مسابقات نشطة حالياً لك</p>
          </div>
        )}

        <section>
          <h3 className="font-bold text-lg mb-4">أفضل الطلاب في صفك</h3>
          <div className="bg-white dark:bg-[#1a2e1f] rounded-2xl border dark:border-gray-800 divide-y dark:divide-gray-800">
            {studentRankings.length > 0 ? (
              studentRankings.map((st, idx) => (
                <div key={st.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-bold ${idx < 3 ? 'text-yellow-500' : 'text-gray-300'}`}>{idx + 1}</span>
                    <p className="text-sm font-medium">{st.name}</p>
                  </div>
                  <span className="text-xs font-bold text-primary">{st.points} pts</span>
                </div>
              ))
            ) : (
              <p className="text-center py-10 text-gray-400 text-sm italic">لا يوجد طلاب في هذا الصف بعد</p>
            )}
          </div>
        </section>
      </div>
    );
  };

  const renderMentor = () => (
    <div className="flex flex-col h-[calc(100vh-80px)] p-4 pb-24 animate-in fade-in duration-300">
      <div className="flex items-center gap-4 mb-4 border-b pb-4 dark:border-gray-800">
        <div className="size-12 bg-primary/20 rounded-full flex items-center justify-center text-primary"><Icon name="smart_toy" className="text-3xl" filled /></div>
        <div>
          <h2 className="font-bold text-lg">المرشد زراعي</h2>
          <p className="text-xs text-green-500 flex items-center gap-1"><span className="size-2 bg-green-500 rounded-full"></span> متصل الآن</p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 px-2">
        {chatMessages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}>
            <div className={`max-w-[80%] p-4 rounded-2xl shadow-sm ${msg.role === 'user' ? 'bg-primary text-white rounded-br-none' : 'bg-white dark:bg-[#1a2e1f] border dark:border-gray-800 rounded-bl-none'}`}>
              <p className="text-sm leading-relaxed">{msg.text}</p>
            </div>
          </div>
        ))}
        {isTyping && <div className="flex justify-end"><div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-2xl animate-pulse flex gap-1"><span className="size-1.5 bg-gray-400 rounded-full"></span><span className="size-1.5 bg-gray-400 rounded-full"></span><span className="size-1.5 bg-gray-400 rounded-full"></span></div></div>}
      </div>
      <div className="flex gap-2 sticky bottom-24 bg-white/80 dark:bg-background-dark/80 backdrop-blur p-2 rounded-2xl border dark:border-gray-800 shadow-lg">
        <input type="text" value={inputMessage} onChange={(e) => setInputMessage(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()} placeholder="كيف يمكنني مساعدتك اليوم؟" className="flex-1 bg-transparent border-none focus:ring-0 text-sm" />
        <button onClick={handleSendMessage} className="size-12 bg-primary text-white rounded-xl flex items-center justify-center active:scale-90 transition-transform"><Icon name="send" /></button>
      </div>
    </div>
  );

  const renderProfile = () => (
    <div className="p-4 pb-24 animate-in slide-in-from-top duration-500 overflow-x-hidden">
      <div className="bg-white dark:bg-[#1a2e1f] rounded-3xl p-8 shadow-sm border border-[#dbe6df] dark:border-[#2a3f30] text-center mb-6">
        <div className="relative inline-block mb-4">
          <img src="https://picsum.photos/seed/gardener/200/200" className="rounded-full h-32 w-32 border-8 border-primary/10 object-cover mx-auto" alt="Profile" />
          <div className="absolute -bottom-2 -right-2 bg-primary text-white rounded-full p-2 border-4 border-white dark:border-[#1a2e1f]"><Icon name="verified" className="text-sm" filled /></div>
        </div>
        <h2 className="text-2xl font-bold">{stats.name}</h2>
        <p className="text-[#61896f] dark:text-[#a3c3ad] font-medium mb-4">{stats.level}</p>
        <div className="flex justify-center gap-2"><span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-bold">{stats.points} نقطة</span></div>
      </div>
      <div className="space-y-3">
        <button onClick={toggleDarkMode} className="w-full flex items-center justify-between p-4 bg-white dark:bg-[#1a2e1f] rounded-2xl border dark:border-gray-800">
          <div className="flex items-center gap-3"><Icon name={isDarkMode ? 'light_mode' : 'dark_mode'} className="text-gray-500" /><span>الوضع {isDarkMode ? 'الفاتح' : 'الليلي'}</span></div>
          <div className={`w-12 h-6 rounded-full p-1 transition-colors ${isDarkMode ? 'bg-primary' : 'bg-gray-300'}`}><div className={`bg-white size-4 rounded-full transition-transform ${isDarkMode ? '-translate-x-6' : 'translate-x-0'}`}></div></div>
        </button>
        <button onClick={handleLogout} className="w-full flex items-center justify-between p-4 bg-white dark:bg-[#1a2e1f] rounded-2xl border dark:border-gray-800 text-red-500"><div className="flex items-center gap-3"><Icon name="logout" /><span>تسجيل الخروج</span></div></button>
      </div>
    </div>
  );

  // --- Login View ---
  const renderLogin = () => (
    <div className="min-h-screen flex flex-col justify-center items-center p-6 bg-background-light dark:bg-background-dark max-w-[480px] mx-auto shadow-2xl">
      <div className="w-full space-y-8 animate-in fade-in zoom-in duration-500">
        <div className="text-center">
          <div className="size-24 bg-primary/20 rounded-3xl flex items-center justify-center text-primary mx-auto mb-6">
            <Icon name="eco" className="text-6xl" filled />
          </div>
          <h1 className="text-4xl font-black text-primary-dark dark:text-primary mb-2">زراعتي</h1>
          <p className="text-[#61896f] dark:text-[#a3c3ad] font-medium">خطوتك الأولى نحو عالم الزراعة المنزلية الممتع</p>
        </div>

        <form onSubmit={handleAuth} className="bg-white dark:bg-[#1a2e1f] p-8 rounded-[2.5rem] shadow-xl border border-primary/10 space-y-6">
          {authError && (
            <div className="bg-red-50 text-red-500 p-3 rounded-xl text-sm text-center font-bold">
              {authError}
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label className="text-sm font-bold text-gray-700 dark:text-gray-300 block mb-2 mr-2 text-right">اسم</label>
              <div className="relative">
                <Icon name="person" className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text" // Changed type to text
                  value={studentLoginName}
                  onChange={(e) => setStudentLoginName(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-2xl p-4 pr-12 focus:ring-2 focus:ring-primary text-right"
                  placeholder="name@example.com"
                  required
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-bold text-gray-700 dark:text-gray-300 block mb-2 mr-2 text-right">كلمة المرور</label>
              <div className="relative">
                <Icon name="lock" className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-2xl p-4 pr-12 focus:ring-2 focus:ring-primary text-right"
                  placeholder="أدخل كلمة المرور"
                  required
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-4 bg-primary text-white font-bold rounded-2xl shadow-lg shadow-primary/30 hover:bg-primary-dark transition-all active:scale-95"
          >
            {isRegistering ? 'إنشاء حساب جديد' : 'تسجيل الدخول'}
          </button>

          <div className="text-center">
            <button
              type="button"
              onClick={() => { setIsRegistering(!isRegistering); setAuthError(""); }}
              className="text-sm text-gray-500 hover:text-primary transition-colors"
            >
              {isRegistering ? 'لديك حساب بالفعل؟ تسجيل الدخول' : 'ليس لديك حساب؟ إنشاء حساب جديد'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  if (!isLoggedIn) return renderLogin();

  return (
    <div className="flex flex-col min-h-screen max-w-[480px] mx-auto bg-background-light dark:bg-background-dark shadow-2xl relative overflow-x-hidden">
      <header className="flex items-center bg-white dark:bg-[#1a2e1f] p-4 justify-between sticky top-0 z-50 shadow-sm">
        <div className="size-10 bg-primary/20 rounded-full flex items-center justify-center text-primary"><Icon name="eco" filled /></div>
        <h2 className="text-lg font-bold flex-1 text-center font-display">
          {activeView === AppView.HOME ? 'زراعتي' :
            activeView === AppView.TASKS ? 'مهامي' :
              activeView === AppView.CHAT ? 'مرشدي' :
                activeView === AppView.PROFILE ? 'حسابي' :
                  activeView === AppView.ADMIN ? 'المعلمة' :
                    activeView === AppView.ADMIN_CLASSES ? 'الصفوف' :
                      activeView === AppView.ADMIN_ADD_CLASS ? 'إضافة صف' :
                        activeView === AppView.ADMIN_CLASS_DETAILS ? 'تفاصيل الصف' :
                          activeView === AppView.ADMIN_SECTION_DETAILS ? 'الشعبة' :
                            activeView === AppView.ADMIN_ADD_SECTION ? 'إضافة شعبة' :
                              activeView === AppView.ADMIN_ADD_STUDENT ? 'إضافة طالب' :
                                activeView === AppView.ADMIN_ADD_TASK ? 'إضافة مهمة' :
                                  activeView === AppView.ADMIN_EDIT_TASK ? 'تعديل المهمة' :
                                    activeView === AppView.ADMIN_COMPETITIONS ? 'المسابقات' :
                                      activeView === AppView.ADMIN_ADD_COMPETITION ? 'إضافة مسابقة' :
                                        activeView === AppView.ADMIN_EDIT_COMPETITION ? 'تعديل مسابقة' :
                                          activeView === AppView.CHALLENGES ? 'التحديات' : 'زراعتي'}
        </h2>
      </header>

      {
        loading ? <div className='loading flex items-center justify-around fixed top-0 right-0 left-0 bottom-0 z-[100] bg-[#4f855433]'>
          <img src="https://c.tenor.com/SLFiTi_nrQ4AAAAj/loader.gif" alt='loading' />
        </div> : <div></div>
      }

      {
        toastText ? <div className='flex items-center justify-around fixed bottom-[100px] w-[300px] h-[50px] z-[100] left-[50%] translate-x-[-50%] bg-[#4f855433]'>
          <p>{toastText}</p>
        </div> : <div></div>
      }

      <main className="flex-1 overflow-y-auto">
        {activeView === AppView.HOME && renderHome()}
        {activeView === AppView.TASKS && renderTasks()}
        {activeView === AppView.CHAT && renderMentor()}
        {activeView === AppView.PROFILE && renderProfile()}
        {activeView === AppView.ADMIN && renderAdmin()}
        {activeView === AppView.ADMIN_CLASSES && renderAdminClasses()}
        {activeView === AppView.ADMIN_PROFILE && renderAdminProfile()}
        {activeView === AppView.ADMIN_ADD_CLASS && renderAddClass()}
        {activeView === AppView.ADMIN_CLASS_DETAILS && renderClassDetails()}
        {activeView === AppView.ADMIN_SECTION_DETAILS && renderSectionDetails()}
        {activeView === AppView.ADMIN_ADD_SECTION && renderAddSection()}
        {activeView === AppView.ADMIN_ADD_STUDENT && renderAddStudent()}
        {activeView === AppView.ADMIN_ADD_TASK && renderTaskForm(false)}
        {activeView === AppView.ADMIN_EDIT_TASK && renderTaskForm(true)}
        {activeView === AppView.ADMIN_COMPETITIONS && renderAdminCompetitions()}
        {activeView === AppView.ADMIN_ADD_COMPETITION && renderCompetitionForm(false)}
        {activeView === AppView.ADMIN_EDIT_COMPETITION && renderCompetitionForm(true)}
        {activeView === AppView.CHALLENGES && renderChallenges()}
        {activeView === AppView.LEARN && (
          <div className="p-8 text-center opacity-50 flex flex-col items-center gap-4">
            <Icon name="construction" className="text-6xl" />
            <p className="font-bold text-xl">قيد التطوير</p>
            <p className="text-sm">هذه الصفحة ستوفر دروساً تفاعلية عن الزراعة قريباً.</p>
          </div>
        )}
      </main>

      {!isAdmin && <BottomNav activeView={activeView} setActiveView={setActiveView} />}
      {isAdmin && (
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-white dark:bg-[#1a2e1f] border-t dark:border-gray-800 flex justify-around items-center py-4 z-50">
          <button onClick={() => setActiveView(AppView.ADMIN)} className={`flex flex-col items-center ${[AppView.ADMIN, AppView.ADMIN_ADD_TASK, AppView.ADMIN_EDIT_TASK, AppView.ADMIN_COMPETITIONS, AppView.ADMIN_ADD_COMPETITION, AppView.ADMIN_EDIT_COMPETITION].includes(activeView) ? 'text-primary' : 'text-gray-400'}`}><Icon name="dashboard" filled={[AppView.ADMIN, AppView.ADMIN_ADD_TASK, AppView.ADMIN_EDIT_TASK, AppView.ADMIN_COMPETITIONS, AppView.ADMIN_ADD_COMPETITION, AppView.ADMIN_EDIT_COMPETITION].includes(activeView)} /><span className="text-[10px] font-bold">الرئيسية</span></button>
          <button onClick={() => setActiveView(AppView.ADMIN_CLASSES)} className={`flex flex-col items-center ${activeView === AppView.ADMIN_CLASSES ? 'text-primary' : 'text-gray-400'}`}><Icon name="school" filled={activeView === AppView.ADMIN_CLASSES} /><span className="text-[10px] font-bold">الصفوف</span></button>
          <button onClick={() => setActiveView(AppView.ADMIN_PROFILE)} className={`flex flex-col items-center ${activeView === AppView.ADMIN_PROFILE ? 'text-primary' : 'text-gray-400'}`}><Icon name="account_circle" filled={activeView === AppView.ADMIN_PROFILE} /><span className="text-[10px] font-bold">حسابي</span></button>
        </div>
      )}
    </div>
  );
};

export default App;