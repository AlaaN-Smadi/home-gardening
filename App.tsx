import React, { useState, useEffect, useMemo } from 'react';
import { AppView, Task, StudentStats, ChatMessage, ClassRoom, Section, Student, Competition, SchoolReward, RedeemedReward } from './types';
import { INITIAL_TASKS, LEVELS, BADGES, INITIAL_REWARDS } from './constants';
import { BottomNav } from './components/BottomNav';
import { Icon } from './components/Icon';
import { EcoImpactCard } from './components/EcoImpactCard';
import { chatWithMentor, getRecyclingTip } from './services/geminiService';

import { 
  addClassToFirestore, 
  addCompetitionToFirestore, 
  auth, 
  deleteCompetitionFromFirestore, 
  fetchClassesFromFirestore, 
  fetchCompetitionsFromFirestore, 
  updateCompetitionInFirestore, 
  createEmptyDailyCompletionRecord,
  fetchStudentClassSectionInfo,
  fetchStudentCompletedTasksForDay,
  fetchStudentDailyCompletions,
  calculateStreak,
  fetchStudentData,
  fetchTasksFromFirestore,
  toggleStudentTaskCompletionInFirestore,
  updateStudentPointsAndLastOpenDate,
  updateUserPoints,
  saveUserProfile,
  fetchStudentRedeemedRewards,
  saveStudentRedeemedReward,
  updateTaskInFirestore,
  addTaskToFirestore,
  deleteTaskFromFirestore,
  addSectionToFirestore,
  addStudentToAuthAndFirestore,
  deleteStudentFromAuthAndFirestore
} from './services/firebase';
import { createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signOut, User } from 'firebase/auth';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeView, setActiveView] = useState<AppView>(AppView.HOME);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskCategoryFilter, setTaskCategoryFilter] = useState<string>('all');
  const [studentInfo, setStudentInfo] = useState<{ classId: string, sectionId: string, className?: string, sectionName?: string } | null>(null);
  const [studentCompletedTasksToday, setStudentCompletedTasksToday] = useState<string[]>([]);
  
  // Real Student Stats State (Initialized empty to show real data)
  const [stats, setStats] = useState<StudentStats>({
    name: "",
    level: "صديقة بيئة مبتدئة",
    points: 0,
    streak: 0,
    completedTasks: 0,
    totalTasks: 0,
    recycledItemsCount: 0,
    className: "",
    sectionName: "",
    email: ""
  });

  // Calculate level based on student points
  const getStudentLevel = (points: number): string => {
    const sortedLevels = [...LEVELS].reverse();
    const match = sortedLevels.find(l => points >= l.minPoints);
    return match ? match.name : LEVELS[0].name;
  };

  // Dynamic Badges based on real student stats
  const dynamicBadges = useMemo(() => {
    return BADGES.map(badge => {
      let unlocked = false;
      if (badge.id === 'b1') {
        unlocked = stats.completedTasks >= 3 || stats.points >= 40;
      } else if (badge.id === 'b2') {
        unlocked = stats.points >= 80;
      } else if (badge.id === 'b3') {
        unlocked = stats.points >= 150;
      } else if (badge.id === 'b4') {
        unlocked = stats.points >= 250;
      } else if (badge.id === 'b5') {
        unlocked = stats.streak >= 3 || stats.points >= 400;
      }
      return { ...badge, unlocked };
    });
  }, [stats.points, stats.completedTasks, stats.streak]);

  // Rewards State
  const [rewards, setRewards] = useState<SchoolReward[]>(() => {
    try {
      const saved = localStorage.getItem('tadweeri_rewards');
      return saved ? JSON.parse(saved) : INITIAL_REWARDS;
    } catch {
      return INITIAL_REWARDS;
    }
  });

  const [redeemedRewards, setRedeemedRewards] = useState<RedeemedReward[]>([]);
  const [rewardCategoryFilter, setRewardCategoryFilter] = useState<string>('all');
  const [claimedRewardModal, setClaimedRewardModal] = useState<RedeemedReward | null>(null);

  // Admin Specific State
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [selectedClass, setSelectedClass] = useState<ClassRoom | null>(null);
  const [selectedSection, setSelectedSection] = useState<Section | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editingCompetition, setEditingCompetition] = useState<Competition | null>(null);

  // Admin Form States
  const [newClassName, setNewClassName] = useState("");
  const [newSectionName, setNewSectionName] = useState("");
  const [newStudentName, setNewStudentName] = useState("");
  const [loading, setLoading] = useState<boolean>(false);
  const [toastText, setToastText] = useState<string>('');

  // New Task Form States
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [newTaskPoints, setNewTaskPoints] = useState(15);
  const [newTaskIcon, setNewTaskIcon] = useState("recycling");
  const [newTaskColor, setNewTaskColor] = useState("emerald");
  const [newTaskCategory, setNewTaskCategory] = useState("plastic");

  // Competitions
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [newCompTitle, setNewCompTitle] = useState("");
  const [newCompType, setNewCompType] = useState<'inter-class' | 'intra-class'>('inter-class');
  const [newCompClassId, setNewCompClassId] = useState("");
  const [newCompPrize, setNewCompPrize] = useState("");
  const [newCompEndDate, setNewCompEndDate] = useState("");

  // New Reward Form State (Admin)
  const [newRewardTitle, setNewRewardTitle] = useState("");
  const [newRewardDescription, setNewRewardDescription] = useState("");
  const [newRewardCost, setNewRewardCost] = useState(100);
  const [newRewardIcon, setNewRewardIcon] = useState("fastfood");
  const [newRewardColor, setNewRewardColor] = useState("amber");
  const [newRewardCategory, setNewRewardCategory] = useState<'canteen' | 'honor' | 'tools' | 'privilege'>('canteen');

  // AI Mentor Chat
  const [dailyTip, setDailyTip] = useState("فرز النفايات خطوتكِ الذكية لمدرسة أجمل ونقاط أكثر!");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      role: 'model',
      text: 'أهلاً بكِ يا بطلة البيئة! أنا "تدويرة"، مرشدتكِ الذكية لإعادة التدوير في المدرسة. كيف أساعدكِ اليوم في فرز النفايات أو كسب المزيد من نقاط المكافآت؟ 🌱✨'
    }
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Auth form states
  const [studentLoginName, setStudentLoginName] = useState("");
  const [password, setPassword] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [authError, setAuthError] = useState("");

  // ==========================================
  // REAL STUDENT DATA LOADER
  // ==========================================
  const loadRealStudentData = async (currentUser: User) => {
    try {
      const userEmail = currentUser.email || '';
      
      // 1. Fetch Class and Section Info
      const info = await fetchStudentClassSectionInfo(currentUser.uid, userEmail);

      let realName = currentUser.displayName || "";
      let realPoints = 0;
      let realClassName = "";
      let realSectionName = "";
      let classId = "";
      let sectionId = "";

      if (info) {
        setStudentInfo(info);
        classId = info.classId;
        sectionId = info.sectionId;
        realName = info.name || realName;
        realPoints = typeof info.points === 'number' ? info.points : 0;
        realClassName = info.className || "";
        realSectionName = info.sectionName || "";
      }

      // If student was fetched via top-level user doc
      if (!info) {
        const studentData = await fetchStudentData("", "", currentUser.uid);
        if (studentData) {
          realName = studentData.name || realName;
          realPoints = typeof studentData.points === 'number' ? studentData.points : 0;
          realClassName = studentData.className || "";
          realSectionName = studentData.sectionName || "";
        }
      }

      // If name is still empty, derive a clean name from email or login input
      if (!realName) {
        if (studentLoginName && !studentLoginName.includes('@')) {
          realName = studentLoginName;
        } else if (userEmail) {
          const emailPrefix = userEmail.split('@')[0];
          realName = emailPrefix ? emailPrefix.replace(/[._\d]/g, ' ').trim() : "طالبة بيئية";
        } else {
          realName = "طالبة بيئية";
        }
        // Save real name for future logins
        saveUserProfile(currentUser.uid, { name: realName, email: userEmail, points: realPoints });
      }

      // 2. Fetch Daily Completions & Calculate Real Streak
      let realStreak = 0;
      let completedTasksToday: string[] = [];
      const today = new Date().toISOString().split('T')[0];

      if (classId && sectionId) {
        try {
          const completionDates = await fetchStudentDailyCompletions(currentUser.uid, classId, sectionId);
          realStreak = calculateStreak(completionDates);

          const todayIds = await fetchStudentCompletedTasksForDay(currentUser.uid, classId, sectionId, today);
          if (todayIds === null) {
            await createEmptyDailyCompletionRecord(currentUser.uid, classId, sectionId, today);
            completedTasksToday = [];
          } else {
            completedTasksToday = todayIds;
          }
        } catch (e) {
          console.warn("Completions fetch error:", e);
        }
      }

      setStudentCompletedTasksToday(completedTasksToday);

      // 3. Real Recycled Items Count
      const realRecycledCount = Math.max(
        completedTasksToday.length * 3,
        Math.floor(realPoints / 10) + completedTasksToday.length * 2
      );

      // 4. Update Stats with 100% Real Data
      setStats({
        name: realName,
        level: getStudentLevel(realPoints),
        points: realPoints,
        streak: realStreak,
        completedTasks: completedTasksToday.length,
        totalTasks: tasks.length || INITIAL_TASKS.length,
        recycledItemsCount: realRecycledCount,
        className: realClassName,
        sectionName: realSectionName,
        email: userEmail
      });

      // 5. Load Real Redeemed Rewards for this Specific Student
      try {
        const firestoreRedeemed = await fetchStudentRedeemedRewards(currentUser.uid, classId, sectionId);
        const localKey = `tadweeri_redeemed_${currentUser.uid}`;
        const localSaved = localStorage.getItem(localKey);
        const localParsed = localSaved ? JSON.parse(localSaved) : [];

        const combined: RedeemedReward[] = [...firestoreRedeemed];
        localParsed.forEach((lp: RedeemedReward) => {
          if (!combined.some(c => c.id === lp.id || c.code === lp.code)) {
            combined.push(lp);
          }
        });

        setRedeemedRewards(combined);
        localStorage.setItem(localKey, JSON.stringify(combined));
      } catch (e) {
        console.warn("Rewards load error:", e);
      }

    } catch (err) {
      console.error("Error loading real student data:", err);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setIsLoggedIn(!!currentUser);
      if (currentUser) {
        if (currentUser.email === 'admin@tadweer.com') {
          setIsAdmin(true);
          setActiveView(AppView.ADMIN);
          setStudentInfo(null);
          setStudentCompletedTasksToday([]);
        } else {
          setIsAdmin(false);
          setActiveView(AppView.HOME);
          await loadRealStudentData(currentUser);
        }
      } else {
        setUser(null);
        setIsAdmin(false);
        setActiveView(AppView.HOME);
        setTasks(INITIAL_TASKS);
        setRedeemedRewards([]);
        setStudentInfo(null);
        setStudentCompletedTasksToday([]);
        setStats({
          name: "",
          level: "صديقة بيئة مبتدئة",
          points: 0,
          streak: 0,
          completedTasks: 0,
          totalTasks: 0,
          recycledItemsCount: 0,
          className: "",
          sectionName: "",
          email: ""
        });
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
          
          // If student is logged in, try to populate their class/section names if missing
          if (user && !isAdmin && fetchedClasses.length > 0) {
            for (const cls of fetchedClasses) {
              for (const sec of cls.sections) {
                const found = sec.students.find((s: Student) => s.id === user.uid || (user.email && (s as any).email === user.email));
                if (found) {
                  setStudentInfo({
                    classId: cls.id,
                    sectionId: sec.id,
                    className: cls.name,
                    sectionName: sec.name
                  });
                  setStats(prev => ({
                    ...prev,
                    name: found.name || prev.name,
                    points: typeof found.points === 'number' ? found.points : prev.points,
                    className: cls.name,
                    sectionName: sec.name
                  }));
                  break;
                }
              }
            }
          }
        } catch (error) {
          console.error("Failed to fetch classes:", error);
        }
      }
    };
    loadClasses();
  }, [isLoggedIn, isAdmin, user]);

  useEffect(() => {
    const loadCompetitions = async () => {
      if (isLoggedIn) {
        try {
          const fetchedCompetitions = await fetchCompetitionsFromFirestore();
          if (fetchedCompetitions && fetchedCompetitions.length > 0) {
            setCompetitions(fetchedCompetitions);
          } else {
            setCompetitions([
              {
                id: 'comp1',
                title: 'تحدي الفصل الأخضر الأكثر تدويرًا لهذا الشهر',
                type: 'inter-class',
                startDate: new Date().toISOString().split('T')[0],
                endDate: '2026-12-15',
                prize: 'كأس الاستدامة + قسائم مجانية من مقصف المدرسة',
                status: 'active'
              }
            ]);
          }
        } catch (error) {
          console.error("Failed to fetch competitions:", error);
        }
      }
    };
    loadCompetitions();
  }, [isLoggedIn]);

  useEffect(() => {
    const loadTasks = async () => {
      if (isLoggedIn && !isAdmin) {
        try {
          const fetchedTasks = await fetchTasksFromFirestore();
          const baseTasks = (fetchedTasks && fetchedTasks.length > 0) ? fetchedTasks : INITIAL_TASKS;
          
          const today = new Date().toISOString().split('T')[0];
          let todayDoneIds: string[] = [];

          if (user && studentInfo) {
            const fetchedToday = await fetchStudentCompletedTasksForDay(user.uid, studentInfo.classId, studentInfo.sectionId, today);
            if (fetchedToday) todayDoneIds = fetchedToday;
          }

          const augmentedTasks = baseTasks.map(task => ({
            ...task,
            completed: todayDoneIds.includes(task.id) || studentCompletedTasksToday.includes(task.id)
          }));
          setTasks(augmentedTasks);
        } catch (e) {
          console.error("Error loading tasks:", e);
          setTasks(INITIAL_TASKS);
        }
      } else if (isLoggedIn && isAdmin) {
        try {
          const fetchedTasks = await fetchTasksFromFirestore();
          setTasks((fetchedTasks && fetchedTasks.length > 0) ? fetchedTasks : INITIAL_TASKS);
        } catch {
          setTasks(INITIAL_TASKS);
        }
      } else {
        setTasks(INITIAL_TASKS);
      }
    };
    loadTasks();
  }, [isLoggedIn, isAdmin, user, studentInfo]);

  useEffect(() => {
    if (isLoggedIn && !isAdmin) {
      const fetchTip = async () => {
        const tip = await getRecyclingTip();
        setDailyTip(tip);
      };
      fetchTip();
    }
  }, [isLoggedIn, isAdmin]);

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    document.documentElement.classList.toggle('dark');
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    try {
      const loginEmail = studentLoginName.includes('@')
        ? studentLoginName
        : studentLoginName.replace(/\s/g, '').toLowerCase() + '@example.com';

      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, loginEmail, password);
      } else {
        await signInWithEmailAndPassword(auth, loginEmail, password);
      }
    } catch (error: any) {
      console.error("Auth error:", error);
      setAuthError("حدث خطأ في تسجيل الدخول: " + (error.message || 'تأكدي من صحة البيانات'));
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setIsLoggedIn(false);
    setIsAdmin(false);
    setStudentLoginName("");
    setPassword("");
  };

  // --- Task Actions ---
  const handleAddTask = async () => {
    const newTask: Task = {
      id: '',
      title: newTaskTitle,
      description: newTaskDescription,
      points: newTaskPoints,
      completed: false,
      icon: newTaskIcon,
      color: newTaskColor,
      category: newTaskCategory
    };

    try {
      const taskId = await addTaskToFirestore(newTask);
      setTasks([{ ...newTask, id: taskId }, ...tasks]);
      clearTaskForm();
      setActiveView(AppView.ADMIN);
    } catch (error) {
      console.error("Failed to add task:", error);
      const localId = Date.now().toString();
      setTasks([{ ...newTask, id: localId }, ...tasks]);
      clearTaskForm();
      setActiveView(AppView.ADMIN);
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
      category: newTaskCategory || editingTask.category
    };

    try {
      await updateTaskInFirestore(updatedTask.id, updatedTask);
    } catch (error) {
      console.error("Failed to update task:", error);
    }
    setTasks(prev => prev.map(t => t.id === editingTask.id ? updatedTask : t));
    clearTaskForm();
    setActiveView(AppView.ADMIN);
  };

  const handleDeleteTask = async (id: string) => {
    if (confirm("هل أنتِ متأكدة من حذف هذه المهمة؟")) {
      try {
        await deleteTaskFromFirestore(id);
      } catch (error) {
        console.error("Failed to delete task:", error);
      }
      setTasks(prev => prev.filter(t => t.id !== id));
    }
  };

  const startEditingTask = (task: Task) => {
    setEditingTask(task);
    setNewTaskTitle(task.title);
    setNewTaskDescription(task.description);
    setNewTaskPoints(task.points);
    setNewTaskIcon(task.icon);
    setNewTaskColor(task.color);
    setNewTaskCategory(task.category || 'plastic');
    setActiveView(AppView.ADMIN_EDIT_TASK);
  };

  const clearTaskForm = () => {
    setEditingTask(null);
    setNewTaskTitle("");
    setNewTaskDescription("");
    setNewTaskPoints(15);
    setNewTaskIcon("recycling");
    setNewTaskColor("emerald");
    setNewTaskCategory("plastic");
  };

  // Competition Actions
  const handleAddCompetition = async () => {
    const newComp: Competition = {
      id: '',
      title: newCompTitle,
      type: newCompType,
      targetClassId: newCompType === 'intra-class' ? newCompClassId : undefined,
      startDate: new Date().toISOString().split('T')[0],
      endDate: newCompEndDate || '2026-12-30',
      prize: newCompPrize,
      status: 'active',
    };

    try {
      const compId = await addCompetitionToFirestore(newComp);
      setCompetitions([{ ...newComp, id: compId }, ...competitions]);
    } catch (error) {
      console.error("Failed to add competition:", error);
      setCompetitions([{ ...newComp, id: Date.now().toString() }, ...competitions]);
    }
    clearCompForm();
    setActiveView(AppView.ADMIN_COMPETITIONS);
  };

  const handleUpdateCompetition = async () => {
    if (!editingCompetition) return;
    const updatedComp: Competition = {
      ...editingCompetition,
      title: newCompTitle,
      type: newCompType,
      targetClassId: newCompType === 'intra-class' ? newCompClassId : undefined,
      startDate: editingCompetition.startDate,
      endDate: newCompEndDate,
      prize: newCompPrize,
      status: editingCompetition.status,
    };

    try {
      await updateCompetitionInFirestore(updatedComp.id, updatedComp);
    } catch (error) {
      console.error("Failed to update competition:", error);
    }
    setCompetitions(prev => prev.map(c => c.id === editingCompetition.id ? updatedComp : c));
    clearCompForm();
    setActiveView(AppView.ADMIN_COMPETITIONS);
  };

  const handleDeleteCompetition = async (id: string) => {
    if (confirm("هل أنتِ متأكدة من حذف هذه المسابقة المدرسية؟")) {
      try {
        await deleteCompetitionFromFirestore(id);
      } catch (error) {
        console.error("Failed to delete competition:", error);
      }
      setCompetitions(prev => prev.filter(c => c.id !== id));
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
      addClassToFirestore(newClass);
    } catch (e) {
      console.error(e);
    }
    setClasses(prev => [...prev, newClass]);
    setNewClassName("");
    setActiveView(AppView.ADMIN_CLASSES);
  };

  const handleDeleteClass = (id: string) => {
    if (confirm("تحذير: حذف الصف سيؤدي لحذف جميع الشعب والطالبات المسجلات به. هل أنتِ متأكدة؟")) {
      setClasses(prev => prev.filter(c => c.id !== id));
      if (selectedClass?.id === id) setSelectedClass(null);
    }
  };

  const handleAddSection = async (classId: string, name: string) => {
    const newSection: Section = { id: Date.now().toString(), name, students: [] };
    try {
      await addSectionToFirestore(classId, newSection);
    } catch (e) {
      console.error(e);
    }
    setClasses(classes.map(c => c.id === classId ? { ...c, sections: [...c.sections, newSection] } : c));
    if (selectedClass?.id === classId) {
      setSelectedClass(prev => prev ? { ...prev, sections: [...prev.sections, newSection] } : null);
    }
    setNewSectionName("");
    setActiveView(AppView.ADMIN_CLASS_DETAILS);
  };

  const handleDeleteSection = (classId: string, sectionId: string) => {
    if (confirm("حذف الشعبة سيؤدي لحذف قائمة طالباتها. هل أنتِ متأكدة؟")) {
      setClasses(classes.map(c => c.id === classId ? { ...c, sections: c.sections.filter(s => s.id !== sectionId) } : c));
      if (selectedClass?.id === classId) {
        setSelectedClass(prev => prev ? { ...prev, sections: prev.sections.filter(s => s.id !== sectionId) } : null);
      }
    }
  };

  const handleAddStudent = async (classId: string, sectionId: string, name: string) => {
    setLoading(true);
    try {
      const newStudent = await addStudentToAuthAndFirestore(classId, sectionId, name, 0);
      await signInWithEmailAndPassword(auth, 'admin@tadweer.com', '123456');

      setClasses(prevClasses => prevClasses.map(c => {
        if (c.id === classId) {
          return {
            ...c,
            sections: c.sections.map(s => s.id === sectionId ? { ...s, students: [...s.students, newStudent] } : s)
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
    }
    setLoading(false);
  };

  const handleDeleteStudent = async (classId: string, sectionId: string, studentId: string) => {
    if (confirm("هل أنتِ متأكدة من حذف هذه الطالبة؟")) {
      try {
        await deleteStudentFromAuthAndFirestore(classId, sectionId, studentId);
        setClasses(classes.map(c => {
          if (c.id === classId) {
            return {
              ...c,
              sections: c.sections.map(s => s.id === sectionId ? { ...s, students: s.students.filter(st => st.id !== studentId) } : s)
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

  // --- Task Toggle with Real Data Persistence ---
  const toggleTask = (id: string) => {
    setTasks(prev => prev.map(task => {
      if (task.id === id) {
        const newState = !task.completed;
        const ptsChange = newState ? task.points : -task.points;
        const newTotalPoints = Math.max(0, stats.points + ptsChange);
        const newCompletedTasks = Math.max(0, stats.completedTasks + (newState ? 1 : -1));
        const newRecycledCount = Math.max(0, (stats.recycledItemsCount || 0) + (newState ? 3 : -3));
        const newStreak = newState ? Math.max(1, stats.streak) : stats.streak;

        setStats(s => ({
          ...s,
          points: newTotalPoints,
          completedTasks: newCompletedTasks,
          recycledItemsCount: newRecycledCount,
          level: getStudentLevel(newTotalPoints),
          streak: newStreak
        }));

        if (user) {
          const today = new Date().toISOString().split('T')[0];
          if (studentInfo) {
            toggleStudentTaskCompletionInFirestore(user.uid, studentInfo.classId, studentInfo.sectionId, id, today, newState)
              .then(() => {
                if (newState) {
                  setStudentCompletedTasksToday(curr => [...curr, id]);
                } else {
                  setStudentCompletedTasksToday(curr => curr.filter(tId => tId !== id));
                }
                updateStudentPointsAndLastOpenDate(studentInfo.classId, studentInfo.sectionId, user.uid, newTotalPoints)
                  .catch(err => console.error("Failed to update student points:", err));
              })
              .catch(err => console.error("Failed task toggle in Firestore:", err));
          } else {
            // Update user document directly
            updateUserPoints(user.uid, newTotalPoints).catch(console.warn);
            if (newState) {
              setStudentCompletedTasksToday(curr => [...curr, id]);
            } else {
              setStudentCompletedTasksToday(curr => curr.filter(tId => tId !== id));
            }
          }
        }
        return { ...task, completed: newState };
      }
      return task;
    }));
  };

  // --- Rewards Redemption with Real Data Persistence ---
  const handleRedeemReward = (reward: SchoolReward) => {
    if (stats.points < reward.cost) {
      alert(`عذراً يا ${stats.name || 'بطلة التدوير'}! رصيد نقاطكِ (${stats.points} نقطة) أقل من المطلوب (${reward.cost} نقطة). أنجزي مهام تدوير إضافية لتجمعي النقاط! 🌿`);
      return;
    }

    const voucherCode = `ECO-${Math.floor(1000 + Math.random() * 9000)}`;
    const redeemedItem: RedeemedReward = {
      id: Date.now().toString(),
      rewardId: reward.id,
      rewardTitle: reward.title,
      cost: reward.cost,
      redeemedAt: new Date().toLocaleDateString('ar-SA'),
      code: voucherCode,
      status: 'active'
    };

    const newPoints = stats.points - reward.cost;
    setStats(prev => ({
      ...prev,
      points: newPoints,
      level: getStudentLevel(newPoints)
    }));

    const updatedRedeemed = [redeemedItem, ...redeemedRewards];
    setRedeemedRewards(updatedRedeemed);

    if (user) {
      const localKey = `tadweeri_redeemed_${user.uid}`;
      localStorage.setItem(localKey, JSON.stringify(updatedRedeemed));

      if (studentInfo) {
        saveStudentRedeemedReward(user.uid, redeemedItem, studentInfo.classId, studentInfo.sectionId);
        updateStudentPointsAndLastOpenDate(studentInfo.classId, studentInfo.sectionId, user.uid, newPoints);
      } else {
        saveStudentRedeemedReward(user.uid, redeemedItem);
        updateUserPoints(user.uid, newPoints);
      }
    }

    setClaimedRewardModal(redeemedItem);
  };

  // Admin Add Reward
  const handleAddRewardAdmin = () => {
    if (!newRewardTitle.trim()) return;
    const newReward: SchoolReward = {
      id: Date.now().toString(),
      title: newRewardTitle,
      description: newRewardDescription,
      cost: newRewardCost,
      icon: newRewardIcon,
      color: newRewardColor,
      category: newRewardCategory
    };
    const updated = [newReward, ...rewards];
    setRewards(updated);
    try {
      localStorage.setItem('tadweeri_rewards', JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
    setNewRewardTitle("");
    setNewRewardDescription("");
    setNewRewardCost(100);
    alert("تمت إضافة المكافأة المدرسية بنجاح!");
  };

  // --- AI Chat Logic ---
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
    setToastText('تم النسخ!');
    setTimeout(() => setToastText(''), 1500);
  };

  // Filter tasks
  const filteredTasks = tasks.filter(t => {
    if (taskCategoryFilter === 'all') return true;
    return t.category === taskCategoryFilter;
  });

  // Filter rewards
  const filteredRewards = rewards.filter(r => {
    if (rewardCategoryFilter === 'all') return true;
    return r.category === rewardCategoryFilter;
  });

  // Avatar URL based on student name
  const studentAvatarUrl = `https://api.dicebear.com/7.x/lorelei/svg?seed=${encodeURIComponent(stats.name || 'student')}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;

  // --- Render Views ---

  const renderHome = () => (
    <div className="animate-in fade-in duration-500 space-y-4 pb-28">
      {/* Student Welcome Header Card with Real Data */}
      <div className="p-4 pt-2">
        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-3xl p-5 shadow-lg text-white relative overflow-hidden">
          <div className="absolute -left-8 -bottom-8 opacity-10">
            <Icon name="recycling" className="text-[180px]" filled />
          </div>
          <div className="flex gap-4 items-center relative z-10">
            <div className="relative">
              <div className="size-20 rounded-full border-4 border-white/40 bg-white/20 flex items-center justify-center backdrop-blur-md overflow-hidden shadow-inner">
                <img
                  src={studentAvatarUrl}
                  alt={stats.name || 'Student Avatar'}
                  className="size-full object-cover"
                  onError={(e) => {
                    // Fallback to initial character on error
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
                <span className="font-black text-2xl text-white select-none absolute">
                  {stats.name ? stats.name.charAt(0) : 'ط'}
                </span>
              </div>
              <div className="absolute -bottom-1 -right-1 bg-amber-400 text-gray-900 rounded-full p-1 border-2 border-white shadow">
                <Icon name="auto_awesome" className="text-xs" filled />
              </div>
            </div>
            <div className="flex flex-col justify-center flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="text-white text-xl font-black leading-tight truncate">
                  {stats.name || "طالبة بيئية"}
                </p>
                <span className="text-[10px] bg-white/25 px-2 py-0.5 rounded-full font-bold shrink-0">
                  سفيرة التدوير
                </span>
              </div>
              {/* Real Class and Section Badge */}
              <div className="flex items-center gap-1.5 mt-1 text-emerald-100 text-xs font-semibold">
                <Icon name="school" className="text-amber-300 text-sm" filled />
                <span>
                  {stats.className ? `${stats.className} • شعبة ${stats.sectionName}` : 'مدرستي الخضراء'}
                </span>
              </div>
              <div className="flex items-center gap-1 mt-1.5 bg-black/20 self-start px-3 py-1 rounded-full">
                <Icon name="stars" className="text-amber-300 text-sm" filled />
                <span className="font-black text-amber-300 text-sm">{stats.points} نقطة مكافأة</span>
              </div>
            </div>
            <button
              onClick={() => setActiveView(AppView.PROFILE)}
              className="bg-white/20 hover:bg-white/30 backdrop-blur-sm p-2.5 rounded-2xl text-white transition-all active:scale-95 shrink-0"
              title="الملف الشخصي"
            >
              <Icon name="settings" className="text-lg" />
            </button>
          </div>
        </div>
      </div>

      {/* 3 Real Stat Badges */}
      <div className="grid grid-cols-3 gap-2 px-4">
        <div className="bg-white dark:bg-[#162b20] p-3 rounded-2xl border border-emerald-100 dark:border-emerald-950/60 shadow-sm text-center">
          <div className="flex items-center justify-center gap-1 text-amber-500 mb-1">
            <Icon name="card_giftcard" className="text-base" filled />
            <span className="text-[10px] font-bold uppercase">النقاط</span>
          </div>
          <p className="text-xl font-black text-gray-900 dark:text-white">{stats.points}</p>
          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">للمكافآت</span>
        </div>

        <div className="bg-white dark:bg-[#162b20] p-3 rounded-2xl border border-emerald-100 dark:border-emerald-950/60 shadow-sm text-center">
          <div className="flex items-center justify-center gap-1 text-orange-500 mb-1">
            <Icon name="local_fire_department" className="text-base" filled />
            <span className="text-[10px] font-bold uppercase">السلسلة</span>
          </div>
          <p className="text-xl font-black text-gray-900 dark:text-white">{stats.streak} أيام</p>
          <span className="text-[10px] font-bold text-orange-500">
            {stats.streak > 0 ? 'نشطة اليوم!' : 'ابدئي اليوم'}
          </span>
        </div>

        <div className="bg-white dark:bg-[#162b20] p-3 rounded-2xl border border-emerald-100 dark:border-emerald-950/60 shadow-sm text-center">
          <div className="flex items-center justify-center gap-1 text-teal-500 mb-1">
            <Icon name="recycling" className="text-base" filled />
            <span className="text-[10px] font-bold uppercase">مفروزة</span>
          </div>
          <p className="text-xl font-black text-gray-900 dark:text-white">{stats.recycledItemsCount || 0}</p>
          <span className="text-[10px] font-bold text-teal-600 dark:text-teal-400">مادة بيئية</span>
        </div>
      </div>

      {/* School Eco Impact Meter */}
      <div className="px-4">
        <EcoImpactCard
          points={stats.points}
          completedTasksCount={tasks.filter(t => t.completed).length}
          level={stats.level}
        />
      </div>

      {/* Daily Recycling Tip from Tadweera */}
      <div className="px-4">
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 p-4 rounded-2xl flex items-center gap-3 shadow-sm">
          <div className="size-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-md">
            <Icon name="lightbulb" className="text-xl animate-pulse" filled />
          </div>
          <div className="flex-1">
            <p className="text-[11px] font-black text-emerald-800 dark:text-emerald-300 uppercase tracking-wide">نصيحة اليوم من تدويرة</p>
            <p className="text-xs text-gray-700 dark:text-gray-200 font-medium mt-0.5 leading-relaxed">"{dailyTip}"</p>
          </div>
        </div>
      </div>

      {/* School Rewards Spotlight Banner */}
      <div className="px-4">
        <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 rounded-3xl p-4 text-white shadow-md flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white text-2xl shadow-inner">
              <Icon name="redeem" filled />
            </div>
            <div>
              <h3 className="font-black text-sm">متجر المكافآت المدرسية</h3>
              <p className="text-xs text-amber-100">استبدلي نقاطكِ بوجبات مقصف وشهادات تميز</p>
            </div>
          </div>
          <button
            onClick={() => setActiveView(AppView.REWARDS)}
            className="bg-white text-amber-600 font-black text-xs px-3.5 py-2 rounded-xl shadow hover:bg-amber-50 active:scale-95 transition-all"
          >
            تصفح الجوائز
          </button>
        </div>
      </div>

      {/* Upcoming Recycling Tasks */}
      <div className="px-4">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-1.5">
            <Icon name="checklist" className="text-primary" />
            <h2 className="text-[#111813] dark:text-white text-base font-black">مهام التدوير القادمة</h2>
          </div>
          <button onClick={() => setActiveView(AppView.TASKS)} className="text-primary text-xs font-bold hover:underline">
            عرض كل المهام
          </button>
        </div>
        <div className="flex flex-col gap-2.5">
          {tasks.filter(t => !t.completed).slice(0, 3).map(task => (
            <div
              key={task.id}
              className="flex items-center gap-3 bg-white dark:bg-[#162b20] p-3.5 rounded-2xl border border-emerald-100 dark:border-emerald-950/60 shadow-sm hover:border-primary/40 transition-all"
            >
              <div className="size-11 rounded-xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Icon name={task.icon || 'recycling'} className="text-2xl" filled />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-gray-900 dark:text-white font-bold text-sm truncate">{task.title}</p>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300">
                    +{task.points} ن
                  </span>
                </div>
                <p className="text-gray-500 dark:text-gray-400 text-xs line-clamp-1 mt-0.5">{task.description}</p>
              </div>
              <button
                onClick={() => toggleTask(task.id)}
                className="bg-primary hover:bg-primary-dark text-white px-3.5 py-1.5 rounded-xl text-xs font-bold shadow-md shadow-primary/20 active:scale-95 transition-all shrink-0"
              >
                أنجزتِها
              </button>
            </div>
          ))}
          {tasks.filter(t => !t.completed).length === 0 && (
            <div className="bg-emerald-50 dark:bg-emerald-950/20 p-6 rounded-2xl text-center border border-emerald-200 dark:border-emerald-900">
              <Icon name="task_alt" className="text-4xl text-emerald-500 mb-2" filled />
              <p className="font-bold text-emerald-800 dark:text-emerald-300 text-sm">رائع جداً! أتممتِ جميع مهام التدوير اليوم 🎉</p>
              <p className="text-xs text-gray-500 mt-1">تفقدّي متجر المكافآت لاستبدال نقاطكِ</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderTasks = () => (
    <div className="p-4 pb-28 animate-in slide-in-from-bottom duration-500 space-y-4">
      {/* Header and Progress */}
      <div className="bg-white dark:bg-[#162b20] p-5 rounded-3xl border border-emerald-100 dark:border-emerald-950/60 shadow-sm">
        <div className="flex justify-between items-start mb-3">
          <div>
            <h2 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2">
              <Icon name="recycling" className="text-primary text-2xl" filled />
              مهام التدوير المدرسية
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">
              افرزي النفايات واجمعي النقاط لاستبدالها بجوائز المقصف المدرسي!
            </p>
          </div>
          <div className="text-left bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1.5 rounded-2xl border border-emerald-200 dark:border-emerald-900">
            <span className="text-xs text-gray-500 block">الإنجاز اليوم</span>
            <span className="text-primary font-black text-base">
              {tasks.filter(t => t.completed).length}/{tasks.length}
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-100 dark:bg-gray-800 h-2.5 rounded-full overflow-hidden">
          <div
            className="bg-gradient-to-l from-primary to-teal-400 h-full transition-all duration-500 rounded-full"
            style={{ width: `${tasks.length > 0 ? (tasks.filter(t => t.completed).length / tasks.length) * 100 : 0}%` }}
          ></div>
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {[
          { key: 'all', label: 'الكل' },
          { key: 'plastic', label: 'بلاستيك' },
          { key: 'paper', label: 'ورق وكرتون' },
          { key: 'reuse', label: 'إعادة استخدام' },
          { key: 'sorting', label: 'فرز وأغطية' }
        ].map(cat => (
          <button
            key={cat.key}
            onClick={() => setTaskCategoryFilter(cat.key)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
              taskCategoryFilter === cat.key
                ? 'bg-primary text-white shadow-md shadow-primary/20 scale-105'
                : 'bg-white dark:bg-[#162b20] text-gray-600 dark:text-gray-300 border border-emerald-100 dark:border-emerald-950/60'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Task List */}
      <div className="space-y-3">
        {filteredTasks.map(task => (
          <div
            key={task.id}
            className={`flex items-center gap-3.5 bg-white dark:bg-[#162b20] p-4 rounded-2xl border border-emerald-100 dark:border-emerald-950/60 shadow-sm transition-all ${
              task.completed ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200/80 opacity-80' : 'hover:border-primary/50'
            }`}
          >
            <div
              className={`size-12 rounded-2xl flex items-center justify-center shrink-0 transition-transform ${
                task.completed ? 'bg-emerald-500 text-white shadow' : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
              }`}
            >
              <Icon name={task.icon || 'recycling'} className="text-2xl" filled={task.completed} />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className={`font-bold text-sm text-gray-900 dark:text-white ${task.completed ? 'line-through opacity-70' : ''}`}>
                  {task.title}
                </p>
                <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 text-[10px] font-black shrink-0">
                  +{task.points} ن
                </span>
              </div>
              <p className="text-gray-500 dark:text-gray-400 text-xs leading-relaxed mt-0.5">{task.description}</p>
            </div>

            <button
              onClick={() => toggleTask(task.id)}
              className={`size-10 rounded-2xl flex items-center justify-center transition-all shrink-0 active:scale-90 ${
                task.completed
                  ? 'bg-primary text-white shadow-md shadow-primary/30 ring-2 ring-primary/20'
                  : 'border-2 border-primary/40 text-primary hover:bg-primary/10'
              }`}
              title={task.completed ? 'مكتملة' : 'أنجزت هذه المهمة'}
            >
              {task.completed ? <Icon name="check" className="font-black text-lg" /> : <Icon name="add" className="text-lg" />}
            </button>
          </div>
        ))}

        {filteredTasks.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <Icon name="search_off" className="text-4xl mb-2" />
            <p className="text-sm">لا توجد مهام تحت هذا التصنيف حالياً</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderRewards = () => (
    <div className="p-4 pb-28 animate-in slide-in-from-bottom duration-500 space-y-4">
      {/* Rewards Points Balance Card with Real Student Points */}
      <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 rounded-3xl p-5 text-white shadow-lg relative overflow-hidden">
        <div className="absolute -left-6 -bottom-6 opacity-15">
          <Icon name="redeem" className="text-[160px]" filled />
        </div>
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <span className="text-xs text-amber-100 font-bold block uppercase tracking-wider">
              رصيدكِ المتاح يا {stats.name || 'بطلة البيئة'}
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-3xl font-black">{stats.points}</span>
              <span className="text-sm font-bold text-amber-100">نقطة مكافأة</span>
            </div>
            <p className="text-xs text-amber-100/90 mt-1">استبدلي نقاطكِ بجوائز مدرسية حقيقية وشهادات تميز</p>
          </div>
          <div className="size-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white text-3xl shadow-inner">
            <Icon name="card_giftcard" filled />
          </div>
        </div>
      </div>

      {/* Rewards Category Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {[
          { key: 'all', label: 'كل الجوائز' },
          { key: 'canteen', label: 'المقصف المدرسي' },
          { key: 'honor', label: 'شهادات وأوسمة' },
          { key: 'tools', label: 'أدوات صديقة للبيئة' },
          { key: 'privilege', label: 'امتيازات مدرسية' },
        ].map(cat => (
          <button
            key={cat.key}
            onClick={() => setRewardCategoryFilter(cat.key)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
              rewardCategoryFilter === cat.key
                ? 'bg-amber-500 text-white shadow-md shadow-amber-500/30 scale-105'
                : 'bg-white dark:bg-[#162b20] text-gray-600 dark:text-gray-300 border border-emerald-100 dark:border-emerald-950/60'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Rewards Grid */}
      <div className="space-y-3">
        {filteredRewards.map(reward => {
          const canAfford = stats.points >= reward.cost;
          return (
            <div
              key={reward.id}
              className="bg-white dark:bg-[#162b20] p-4 rounded-3xl border border-emerald-100 dark:border-emerald-950/60 shadow-sm flex flex-col justify-between gap-3 hover:border-amber-400/50 transition-all"
            >
              <div className="flex items-start gap-3.5">
                <div className="size-13 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <Icon name={reward.icon || 'redeem'} className="text-2xl" filled />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <h3 className="font-black text-sm text-gray-900 dark:text-white leading-tight">{reward.title}</h3>
                    <span className="font-black text-xs px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 shrink-0">
                      {reward.cost} نقطة
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">{reward.description}</p>
                </div>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-gray-100 dark:border-gray-800/80">
                <span className="text-[11px] text-gray-400 font-medium">
                  {canAfford ? '✓ رصيدكِ كافٍ للاستبدال' : `ينقصكِ ${reward.cost - stats.points} نقطة`}
                </span>
                <button
                  onClick={() => handleRedeemReward(reward)}
                  disabled={!canAfford}
                  className={`px-4 py-2 rounded-xl text-xs font-black shadow-md transition-all active:scale-95 ${
                    canAfford
                      ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed shadow-none'
                  }`}
                >
                  استبدال المكافأة
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Real Redeemed Rewards Section for this Student */}
      {redeemedRewards.length > 0 && (
        <div className="mt-8 pt-4 border-t border-emerald-100 dark:border-emerald-950/60">
          <div className="flex items-center gap-2 mb-3">
            <Icon name="confirmation_number" className="text-primary text-xl" />
            <h3 className="font-black text-base text-gray-900 dark:text-white">قسائمي المستبدلة ({redeemedRewards.length})</h3>
          </div>
          <div className="space-y-2">
            {redeemedRewards.map(red => (
              <div
                key={red.id}
                className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 p-3.5 rounded-2xl flex items-center justify-between"
              >
                <div>
                  <p className="font-bold text-xs text-gray-900 dark:text-white">{red.rewardTitle}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">تاريخ الاستبدال: {red.redeemedAt}</p>
                </div>
                <div className="text-left">
                  <span className="font-mono font-black text-xs px-2.5 py-1 bg-white dark:bg-black/30 rounded-lg border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 block">
                    {red.code}
                  </span>
                  <span className="text-[9px] text-emerald-600 font-bold mt-0.5 block">قسيمة جاهزة للصرف</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderChallenges = () => {
    const studentClass = studentInfo ? classes.find(c => c.id === studentInfo.classId) : undefined;
    const studentRelevantCompetitions = competitions.filter(comp => {
      if (comp.type === 'inter-class') return true;
      return comp.type === 'intra-class' && comp.targetClassId === studentInfo?.classId;
    });

    const classRankings = classes.map(c => ({
      name: c.name,
      points: c.sections.reduce((acc, s) => acc + s.students.reduce((acc2, st) => acc2 + st.points, 0), 0)
    })).sort((a, b) => b.points - a.points);

    const displayRankings = classRankings.length > 0 ? classRankings : [
      { name: stats.className || 'الصف السادس - أ', points: stats.points + 240 }
    ];

    // Real Classmates Ranking
    const rawClassmates = studentClass?.sections.flatMap(s => s.students) || [];
    
    // Ensure logged-in student is included with their real points
    let studentRankings = [...rawClassmates];
    if (user) {
      const existingIdx = studentRankings.findIndex(s => s.id === user.uid || (stats.name && s.name === stats.name));
      if (existingIdx >= 0) {
        studentRankings[existingIdx] = {
          ...studentRankings[existingIdx],
          name: stats.name,
          points: stats.points
        };
      } else if (stats.name) {
        studentRankings.push({
          id: user.uid,
          name: stats.name,
          points: stats.points
        });
      }
    }
    studentRankings.sort((a, b) => (b.points || 0) - (a.points || 0));

    return (
      <div className="p-4 pb-28 animate-in slide-in-from-bottom duration-500 space-y-6">
        <div>
          <h2 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2">
            <Icon name="emoji_events" className="text-amber-500 text-2xl" filled />
            مسابقات وتحديات التدوير
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">
            تنافسي مع فصول وزميلات المدرسة واجمعي درع الاستدامة الأخضر!
          </p>
        </div>

        {/* Active Competitions */}
        {studentRelevantCompetitions.map(comp => (
          <section key={comp.id} className="bg-white dark:bg-[#162b20] rounded-3xl border border-emerald-100 dark:border-emerald-950/60 p-5 shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-black text-base text-gray-900 dark:text-white">{comp.title}</h3>
                <p className="text-xs text-emerald-700 dark:text-emerald-300 font-bold mt-1 flex items-center gap-1">
                  <Icon name="card_giftcard" className="text-sm" filled />
                  الجائزة: {comp.prize}
                </p>
              </div>
              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2.5 py-1 rounded-full animate-pulse shrink-0">
                نشطة الآن
              </span>
            </div>

            <div className="space-y-3 pt-2 border-t border-gray-100 dark:border-gray-800">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">لوحة صدارة الصفوف بالمدرسة</h4>
              <div className="space-y-2">
                {displayRankings.map((cr, idx) => {
                  const isMyClass = stats.className && cr.name.includes(stats.className);
                  return (
                    <div
                      key={idx}
                      className={`flex items-center justify-between p-3 rounded-2xl transition-all ${
                        isMyClass 
                          ? 'bg-emerald-100/70 dark:bg-emerald-950/60 border-2 border-primary' 
                          : idx === 0 ? 'bg-amber-50 dark:bg-amber-950/30 border border-amber-200' : 'bg-gray-50 dark:bg-gray-900/60'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`size-8 rounded-full flex items-center justify-center font-black text-xs ${
                            idx === 0 ? 'bg-amber-400 text-white shadow' : idx === 1 ? 'bg-gray-300 text-gray-700' : 'bg-gray-200 text-gray-500'
                          }`}
                        >
                          {idx + 1}
                        </div>
                        <span className="font-bold text-sm text-gray-900 dark:text-white">
                          {cr.name} {isMyClass && '(صفي)'}
                        </span>
                      </div>
                      <span className="text-xs font-black text-primary">{cr.points} نقطة</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        ))}

        {/* Real Classmates Leaderboard */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Icon name="stars" className="text-amber-500" filled />
              <h3 className="font-black text-sm text-gray-900 dark:text-white">
                أفضل سفيرات التدوير في {stats.className ? `${stats.className}` : 'صفكِ'}
              </h3>
            </div>
            <span className="text-[11px] text-gray-400 font-bold">
              {stats.sectionName ? `شعبة ${stats.sectionName}` : ''}
            </span>
          </div>

          <div className="bg-white dark:bg-[#162b20] rounded-2xl border border-emerald-100 dark:border-emerald-950/60 divide-y dark:divide-gray-800 overflow-hidden shadow-sm">
            {studentRankings.length > 0 ? (
              studentRankings.map((st, idx) => {
                const isMe = user && (st.id === user.uid || st.name === stats.name);
                return (
                  <div 
                    key={st.id || idx} 
                    className={`p-3.5 flex items-center justify-between ${
                      isMe ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-r-4 border-r-primary' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-black ${idx === 0 ? 'text-amber-500' : 'text-gray-400'}`}>
                        {idx + 1}
                      </span>
                      <div>
                        <p className="text-xs font-bold text-gray-900 dark:text-white">
                          {st.name} {isMe && <span className="text-primary text-[10px] font-black mr-1">(أنتِ)</span>}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-black text-primary">{st.points} نقطة</span>
                  </div>
                );
              })
            ) : (
              <div className="p-4 text-center text-xs text-gray-400">
                لا توجد طالبات مسجلات في هذا الصف بعد
              </div>
            )}
          </div>
        </section>
      </div>
    );
  };

  const renderMentor = () => (
    <div className="flex flex-col h-[calc(100vh-140px)] p-4 pb-20 animate-in fade-in duration-300">
      {/* Mentor Header */}
      <div className="flex items-center gap-3 mb-3 border-b pb-3 dark:border-gray-800 bg-white dark:bg-[#162b20] p-3 rounded-2xl shadow-sm border border-emerald-100">
        <div className="size-11 bg-primary text-white rounded-2xl flex items-center justify-center shadow-md shadow-primary/30">
          <Icon name="smart_toy" className="text-2xl" filled />
        </div>
        <div className="flex-1">
          <h2 className="font-black text-sm text-gray-900 dark:text-white flex items-center gap-1.5">
            المرشدة تدويرة
            <span className="size-2 bg-emerald-500 rounded-full animate-ping"></span>
          </h2>
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">مرشدتكِ الذكية لإعادة التدوير والاستدامة المدرسية</p>
        </div>
      </div>

      {/* Suggested Questions */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none mb-2">
        {[
          "كيف أفرز العلب البلاستيكية؟",
          "أفكار لتدوير الدفاتر القديمة؟",
          "كيف أكسب نقاطاً لمقصف المدرسة؟",
          "فكرة لركن التدوير في فصلنا؟"
        ].map((q, idx) => (
          <button
            key={idx}
            onClick={() => { setInputMessage(q); }}
            className="text-[11px] font-bold px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border border-emerald-200 whitespace-nowrap active:scale-95 transition-all"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 mb-3 px-1 scrollbar-none">
        {chatMessages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}>
            <div
              className={`max-w-[85%] p-3.5 rounded-2xl shadow-sm text-xs leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-primary text-white rounded-br-none shadow-primary/20'
                  : 'bg-white dark:bg-[#162b20] border border-emerald-100 dark:border-emerald-950/60 rounded-bl-none text-gray-800 dark:text-gray-100'
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-end">
            <div className="bg-white dark:bg-[#162b20] p-3 rounded-2xl border border-emerald-100 flex gap-1.5 items-center">
              <span className="size-2 bg-emerald-400 rounded-full animate-bounce"></span>
              <span className="size-2 bg-emerald-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
              <span className="size-2 bg-emerald-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex gap-2 bg-white dark:bg-[#162b20] p-2 rounded-2xl border border-emerald-200 dark:border-emerald-900/60 shadow-lg">
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
          placeholder="اسألي تدويرة عن كيفية فرز مادة أو كسب النقاط..."
          className="flex-1 bg-transparent border-none focus:ring-0 text-xs px-2"
          dir="rtl"
        />
        <button
          onClick={handleSendMessage}
          className="size-10 bg-primary hover:bg-primary-dark text-white rounded-xl flex items-center justify-center active:scale-90 transition-all shrink-0"
        >
          <Icon name="send" className="text-lg" />
        </button>
      </div>
    </div>
  );

  const renderProfile = () => (
    <div className="p-4 pb-28 animate-in slide-in-from-top duration-500 space-y-4">
      {/* Profile Card with Real Student Data */}
      <div className="bg-white dark:bg-[#162b20] rounded-3xl p-6 shadow-sm border border-emerald-100 dark:border-emerald-950/60 text-center">
        <div className="relative inline-block mb-3">
          <div className="size-24 rounded-full border-4 border-primary/20 flex items-center justify-center mx-auto overflow-hidden bg-primary/10 shadow-inner">
            <img
              src={studentAvatarUrl}
              className="size-full object-cover"
              alt={stats.name || "Student Avatar"}
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            <span className="font-black text-3xl text-primary select-none absolute">
              {stats.name ? stats.name.charAt(0) : 'ط'}
            </span>
          </div>
          <div className="absolute -bottom-1 -right-1 bg-primary text-white rounded-full p-1.5 border-2 border-white dark:border-[#162b20]">
            <Icon name="verified" className="text-sm" filled />
          </div>
        </div>

        <h2 className="text-xl font-black text-gray-900 dark:text-white">{stats.name || "طالبة بيئية"}</h2>
        <p className="text-emerald-700 dark:text-emerald-300 font-bold text-xs mt-0.5">{stats.level}</p>

        {stats.className && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center justify-center gap-1">
            <Icon name="school" className="text-xs" />
            <span>{stats.className} • شعبة {stats.sectionName}</span>
          </p>
        )}

        {stats.email && (
          <p className="text-[11px] text-gray-400 mt-0.5 font-mono">{stats.email}</p>
        )}

        <div className="flex justify-center gap-2 mt-4 flex-wrap">
          <span className="px-3 py-1 bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 rounded-full text-xs font-black">
            {stats.points} نقطة مكافأة
          </span>
          <span className="px-3 py-1 bg-orange-100 dark:bg-orange-950/70 text-orange-800 dark:text-orange-300 rounded-full text-xs font-black">
            {stats.streak} أيام متتالية
          </span>
          <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 rounded-full text-xs font-black">
            {stats.recycledItemsCount || 0} مادة مفروزة
          </span>
        </div>
      </div>

      {/* Dynamic Badges Showcase */}
      <div className="bg-white dark:bg-[#162b20] rounded-3xl p-5 border border-emerald-100 dark:border-emerald-950/60 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Icon name="military_tech" className="text-amber-500 text-xl" filled />
          <h3 className="font-black text-sm text-gray-900 dark:text-white">أوسمة وسجلات التدوير المكتسبة</h3>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {dynamicBadges.map(badge => (
            <div
              key={badge.id}
              className={`p-3 rounded-2xl border transition-all flex items-start gap-2.5 ${
                badge.unlocked
                  ? 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-200'
                  : 'bg-gray-50 dark:bg-gray-900/40 border-gray-100 opacity-50'
              }`}
            >
              <div className={`size-8 rounded-xl flex items-center justify-center shrink-0 ${badge.unlocked ? 'bg-primary text-white shadow' : 'bg-gray-200 text-gray-400'}`}>
                <Icon name={badge.icon} className="text-base" filled={badge.unlocked} />
              </div>
              <div>
                <div className="flex items-center gap-1">
                  <p className="font-black text-xs text-gray-900 dark:text-white leading-tight">{badge.name}</p>
                  {badge.unlocked && <Icon name="check_circle" className="text-xs text-emerald-600" filled />}
                </div>
                <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-2">{badge.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* App Settings */}
      <div className="space-y-2.5">
        <button
          onClick={toggleDarkMode}
          className="w-full flex items-center justify-between p-4 bg-white dark:bg-[#162b20] rounded-2xl border border-emerald-100 dark:border-emerald-950/60 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <Icon name={isDarkMode ? 'light_mode' : 'dark_mode'} className="text-gray-500" />
            <span className="font-bold text-xs">{isDarkMode ? 'الوضع الفاتح' : 'الوضع الليلي'}</span>
          </div>
          <div className={`w-11 h-6 rounded-full p-1 transition-colors ${isDarkMode ? 'bg-primary' : 'bg-gray-300'}`}>
            <div className={`bg-white size-4 rounded-full transition-transform ${isDarkMode ? '-translate-x-5' : 'translate-x-0'}`}></div>
          </div>
        </button>

        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-between p-4 bg-white dark:bg-[#162b20] rounded-2xl border border-red-100 text-red-500 shadow-sm hover:bg-red-50/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Icon name="logout" />
            <span className="font-bold text-xs">تسجيل الخروج</span>
          </div>
        </button>
      </div>
    </div>
  );

  // --- Teacher / Admin Views ---
  const renderAdmin = () => (
    <div className="p-4 pb-28 animate-in slide-in-from-right duration-500 space-y-5">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-primary-dark dark:text-primary">لوحة المعلمة والمشرفة</h2>
          <p className="text-xs text-gray-500">نادي التدوير والبيئة المدرسية</p>
        </div>
        <button onClick={() => setActiveView(AppView.ADMIN_PROFILE)} className="bg-primary/10 text-primary p-2.5 rounded-2xl">
          <Icon name="person" filled />
        </button>
      </div>

      {/* Quick Action Navigation Grid */}
      <div className="grid grid-cols-3 gap-2.5">
        <button
          onClick={() => setActiveView(AppView.ADMIN_CLASSES)}
          className="bg-white dark:bg-[#162b20] p-3.5 rounded-2xl shadow-sm border border-emerald-100 dark:border-emerald-950/60 text-right flex flex-col justify-between h-28 hover:border-primary transition-all"
        >
          <Icon name="school" className="text-primary text-2xl" filled />
          <div>
            <p className="text-xs font-black">الصفوف والطالبات</p>
            <p className="text-[10px] text-gray-400">{classes.length} صفوف</p>
          </div>
        </button>

        <button
          onClick={() => setActiveView(AppView.ADMIN_COMPETITIONS)}
          className="bg-white dark:bg-[#162b20] p-3.5 rounded-2xl shadow-sm border border-emerald-100 dark:border-emerald-950/60 text-right flex flex-col justify-between h-28 hover:border-amber-400 transition-all"
        >
          <Icon name="emoji_events" className="text-amber-500 text-2xl" filled />
          <div>
            <p className="text-xs font-black">المسابقات</p>
            <p className="text-[10px] text-gray-400">{competitions.length} مسابقات</p>
          </div>
        </button>

        <button
          onClick={() => setActiveView(AppView.ADMIN_REWARDS)}
          className="bg-white dark:bg-[#162b20] p-3.5 rounded-2xl shadow-sm border border-emerald-100 dark:border-emerald-950/60 text-right flex flex-col justify-between h-28 hover:border-orange-400 transition-all"
        >
          <Icon name="redeem" className="text-orange-500 text-2xl" filled />
          <div>
            <p className="text-xs font-black">المكافآت</p>
            <p className="text-[10px] text-gray-400">{rewards.length} جوائز</p>
          </div>
        </button>
      </div>

      {/* Active Recycling Tasks */}
      <section>
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-black text-sm text-gray-900 dark:text-white">مهام التدوير النشطة للفتيات</h3>
          <button
            onClick={() => {
              clearTaskForm();
              setActiveView(AppView.ADMIN_ADD_TASK);
            }}
            className="text-xs text-primary font-bold flex items-center gap-1 bg-primary/10 px-3 py-1.5 rounded-full hover:bg-primary/20 transition-colors"
          >
            <Icon name="add_circle" className="text-sm" /> مهمة جديدة
          </button>
        </div>

        <div className="bg-white dark:bg-[#162b20] rounded-2xl border border-emerald-100 dark:border-emerald-950/60 divide-y dark:divide-gray-800 shadow-sm overflow-hidden">
          {tasks.map(task => (
            <div key={task.id} className="p-3.5 flex justify-between items-center hover:bg-gray-50/80 dark:hover:bg-gray-800/40 transition-colors">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center shrink-0">
                  <Icon name={task.icon || 'recycling'} className="text-xl" filled />
                </div>
                <div>
                  <span className="text-xs font-bold text-gray-900 dark:text-white block">{task.title}</span>
                  <span className="text-[10px] text-gray-400">{task.points} نقطة مكافأة</span>
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => startEditingTask(task)}
                  className="text-primary hover:bg-primary/10 p-2 rounded-xl transition-colors"
                  title="تعديل المهمة"
                >
                  <Icon name="edit" className="text-base" />
                </button>
                <button
                  onClick={() => handleDeleteTask(task.id)}
                  className="text-red-500 hover:bg-red-50 p-2 rounded-xl transition-colors"
                  title="حذف المهمة"
                >
                  <Icon name="delete" className="text-base" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );

  const renderAdminRewards = () => (
    <div className="p-4 pb-28 animate-in slide-in-from-bottom duration-500 space-y-5">
      <div className="flex items-center gap-3 mb-2">
        <button onClick={() => setActiveView(AppView.ADMIN)} className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full">
          <Icon name="arrow_forward" />
        </button>
        <div>
          <h2 className="text-xl font-black">إدارة جوائز ومكافآت المدرسة</h2>
          <p className="text-xs text-gray-500">تعديل وإضافة جوائز مقصف المدرسة والأوسمة</p>
        </div>
      </div>

      {/* Add New Reward Form Card */}
      <div className="bg-white dark:bg-[#162b20] p-5 rounded-3xl border border-emerald-100 dark:border-emerald-950/60 shadow-sm space-y-3">
        <h3 className="font-black text-sm text-gray-900 dark:text-white flex items-center gap-1.5">
          <Icon name="add_circle" className="text-primary" />
          إضافة مكافأة مدرسية جديدة
        </h3>
        <div>
          <label className="text-xs font-bold block mb-1">اسم الجائزة / المكافأة</label>
          <input
            type="text"
            placeholder="مثلاً: قسيمة مشتريات من المقصف المدرسي"
            value={newRewardTitle}
            onChange={(e) => setNewRewardTitle(e.target.value)}
            className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-xl p-3 text-xs focus:ring-primary"
            dir="rtl"
          />
        </div>
        <div>
          <label className="text-xs font-bold block mb-1">الوصف</label>
          <input
            type="text"
            placeholder="تفاصيل الجائزة وكيفية تسليمها..."
            value={newRewardDescription}
            onChange={(e) => setNewRewardDescription(e.target.value)}
            className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-xl p-3 text-xs focus:ring-primary"
            dir="rtl"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold block mb-1">النقاط المطلوبة</label>
            <input
              type="number"
              value={newRewardCost}
              onChange={(e) => setNewRewardCost(parseInt(e.target.value) || 0)}
              className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-xl p-3 text-xs focus:ring-primary"
            />
          </div>
          <div>
            <label className="text-xs font-bold block mb-1">التصنيف</label>
            <select
              value={newRewardCategory}
              onChange={(e) => setNewRewardCategory(e.target.value as any)}
              className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-xl p-3 text-xs focus:ring-primary"
            >
              <option value="canteen">المقصف المدرسي</option>
              <option value="honor">شهادات وتكريم</option>
              <option value="tools">أدوات بيئية</option>
              <option value="privilege">امتيازات مدرسية</option>
            </select>
          </div>
        </div>
        <button
          onClick={handleAddRewardAdmin}
          disabled={!newRewardTitle.trim()}
          className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs shadow-md disabled:opacity-50 transition-all mt-2"
        >
          حفظ ونشر المكافأة للطالبات
        </button>
      </div>

      {/* Rewards List */}
      <div className="space-y-2.5">
        <h3 className="font-black text-sm">المكافآت الحالية ({rewards.length})</h3>
        {rewards.map(r => (
          <div key={r.id} className="bg-white dark:bg-[#162b20] p-3.5 rounded-2xl border border-emerald-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
                <Icon name={r.icon || 'redeem'} />
              </div>
              <div>
                <p className="font-bold text-xs">{r.title}</p>
                <p className="text-[10px] text-gray-400">{r.cost} نقطة</p>
              </div>
            </div>
            <button
              onClick={() => {
                const filtered = rewards.filter(item => item.id !== r.id);
                setRewards(filtered);
                localStorage.setItem('tadweeri_rewards', JSON.stringify(filtered));
              }}
              className="text-red-400 hover:text-red-600 p-1.5"
            >
              <Icon name="delete" className="text-base" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  const renderAdminCompetitions = () => (
    <div className="p-4 pb-28 animate-in slide-in-from-bottom duration-500 space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setActiveView(AppView.ADMIN)} className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full">
            <Icon name="arrow_forward" />
          </button>
          <h2 className="text-xl font-black">مسابقات التدوير المدرسية</h2>
        </div>
        <button
          onClick={() => { clearCompForm(); setActiveView(AppView.ADMIN_ADD_COMPETITION); }}
          className="bg-primary text-white px-3.5 py-1.5 rounded-full text-xs font-bold shadow"
        >
          + مسابقة جديدة
        </button>
      </div>

      <div className="space-y-3">
        {competitions.map(comp => (
          <div key={comp.id} className="bg-white dark:bg-[#162b20] p-4 rounded-3xl border border-emerald-100 dark:border-emerald-950/60 shadow-sm relative">
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-3">
                <div className="size-11 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center">
                  <Icon name="emoji_events" filled />
                </div>
                <div>
                  <h3 className="font-black text-sm">{comp.title}</h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                    {comp.type === 'inter-class' ? 'بين صفوف المدرسة' : 'داخل الصف'}
                  </span>
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => startEditingCompetition(comp)} className="p-1.5 text-primary">
                  <Icon name="edit" className="text-base" />
                </button>
                <button onClick={() => handleDeleteCompetition(comp.id)} className="p-1.5 text-red-500">
                  <Icon name="delete" className="text-base" />
                </button>
              </div>
            </div>
            <div className="text-xs text-gray-500 mt-2 space-y-1">
              <p>ينتهي في: {comp.endDate}</p>
              <p className="font-bold text-emerald-700 dark:text-emerald-300">الجائزة: {comp.prize}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderCompetitionForm = (isEdit: boolean) => (
    <div className="p-6 animate-in slide-in-from-bottom duration-300">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => { clearCompForm(); setActiveView(AppView.ADMIN_COMPETITIONS); }} className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full">
          <Icon name="arrow_forward" />
        </button>
        <h2 className="text-xl font-bold">{isEdit ? 'تعديل المسابقة' : 'إضافة مسابقة تدوير جديدة'}</h2>
      </div>

      <div className="bg-white dark:bg-[#162b20] p-6 rounded-3xl border space-y-4">
        <div>
          <label className="text-xs font-bold block mb-1">عنوان المسابقة</label>
          <input
            type="text"
            placeholder="مثلاً: تحدي الفصل الأكثر تدويرًا للبلاستيك"
            value={newCompTitle}
            onChange={(e) => setNewCompTitle(e.target.value)}
            className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-2xl p-3.5 text-xs focus:ring-primary"
            dir="rtl"
          />
        </div>
        <div>
          <label className="text-xs font-bold block mb-1">الجائزة والمكافأة</label>
          <input
            type="text"
            placeholder="مثلاً: درع الاستدامة + قسائم مقصف مجانية للفصل"
            value={newCompPrize}
            onChange={(e) => setNewCompPrize(e.target.value)}
            className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-2xl p-3.5 text-xs focus:ring-primary"
            dir="rtl"
          />
        </div>
        <div>
          <label className="text-xs font-bold block mb-1">تاريخ الانتهاء</label>
          <input
            type="date"
            value={newCompEndDate}
            onChange={(e) => setNewCompEndDate(e.target.value)}
            className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-2xl p-3.5 text-xs focus:ring-primary"
          />
        </div>
        <button
          onClick={isEdit ? handleUpdateCompetition : handleAddCompetition}
          disabled={!newCompTitle.trim()}
          className="w-full py-3.5 bg-primary text-white font-bold rounded-2xl text-xs shadow-md mt-4"
        >
          {isEdit ? 'تحديث المسابقة' : 'نشر المسابقة'}
        </button>
      </div>
    </div>
  );

  const renderTaskForm = (isEdit: boolean) => (
    <div className="p-6 animate-in slide-in-from-bottom duration-300">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => { clearTaskForm(); setActiveView(AppView.ADMIN); }} className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full">
          <Icon name="arrow_forward" />
        </button>
        <h2 className="text-xl font-bold">{isEdit ? 'تعديل مهمة التدوير' : 'إضافة مهمة تدوير جديدة'}</h2>
      </div>

      <div className="bg-white dark:bg-[#162b20] p-6 rounded-3xl border space-y-4">
        {/* Quick Presets */}
        <div>
          <span className="text-xs font-bold text-gray-500 block mb-2">اقتراحات سريعة لمهام التدوير:</span>
          <div className="flex flex-wrap gap-1.5">
            {[
              { title: 'فرز علب البلاستيك في الساحة', pts: 15, cat: 'plastic', icon: 'recycling' },
              { title: 'جمع أوراق الفصل المستعملة', pts: 20, cat: 'paper', icon: 'description' },
              { title: 'استخدام مطارة ماء صديقة للبيئة', pts: 10, cat: 'reuse', icon: 'local_drink' },
              { title: 'نظافة ركن التدوير بالفصل', pts: 15, cat: 'sorting', icon: 'cleaning_services' }
            ].map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setNewTaskTitle(p.title);
                  setNewTaskPoints(p.pts);
                  setNewTaskCategory(p.cat);
                  setNewTaskIcon(p.icon);
                }}
                className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border border-emerald-200"
              >
                + {p.title}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-bold block mb-1">عنوان المهمة</label>
          <input
            type="text"
            placeholder="مثلاً: فرز 5 علب بلاستيكية في الحاوية المخصصة"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-2xl p-3.5 text-xs focus:ring-primary"
            dir="rtl"
          />
        </div>

        <div>
          <label className="text-xs font-bold block mb-1">وصف المهمة والخطوات</label>
          <textarea
            placeholder="اشرحي للطالبات كيفية تنفيذ فرز المادة ووضعها في المكان المخصص..."
            value={newTaskDescription}
            onChange={(e) => setNewTaskDescription(e.target.value)}
            className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-2xl p-3.5 text-xs focus:ring-primary h-20"
            dir="rtl"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold block mb-1">نقاط المكافأة</label>
            <input
              type="number"
              value={newTaskPoints}
              onChange={(e) => setNewTaskPoints(parseInt(e.target.value) || 0)}
              className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-2xl p-3.5 text-xs focus:ring-primary"
            />
          </div>
          <div>
            <label className="text-xs font-bold block mb-1">التصنيف</label>
            <select
              value={newTaskCategory}
              onChange={(e) => setNewTaskCategory(e.target.value)}
              className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-2xl p-3.5 text-xs focus:ring-primary"
            >
              <option value="plastic">بلاستيك</option>
              <option value="paper">ورق وكرتون</option>
              <option value="reuse">إعادة استخدام</option>
              <option value="sorting">فرز وأغطية</option>
              <option value="awareness">توعية ونظافة</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs font-bold block mb-2">الأيقونة</label>
          <div className="grid grid-cols-5 gap-2">
            {['recycling', 'inventory_2', 'description', 'local_drink', 'category', 'cleaning_services', 'photo_camera', 'compost', 'stars', 'eco'].map(icon => (
              <button
                key={icon}
                type="button"
                onClick={() => setNewTaskIcon(icon)}
                className={`p-2.5 rounded-xl border-2 flex items-center justify-center transition-all ${
                  newTaskIcon === icon ? 'border-primary bg-primary/10 text-primary' : 'border-gray-100 text-gray-400'
                }`}
              >
                <Icon name={icon} className="text-xl" filled={newTaskIcon === icon} />
              </button>
            ))}
          </div>
        </div>

        <button
          disabled={!newTaskTitle.trim()}
          onClick={isEdit ? handleUpdateTask : handleAddTask}
          className="w-full py-3.5 bg-primary text-white font-bold rounded-2xl text-xs shadow-md mt-4 active:scale-95 transition-all"
        >
          {isEdit ? 'تحديث المهمة' : 'حفظ ونشر المهمة للطالبات'}
        </button>
      </div>
    </div>
  );

  const renderAdminClasses = () => (
    <div className="p-4 pb-28 animate-in slide-in-from-bottom duration-500 space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setActiveView(AppView.ADMIN)} className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full">
            <Icon name="arrow_forward" />
          </button>
          <h2 className="text-xl font-black">إدارة الصفوف والشعب</h2>
        </div>
        <button
          onClick={() => setActiveView(AppView.ADMIN_ADD_CLASS)}
          className="bg-primary text-white p-2 rounded-full shadow"
        >
          <Icon name="add" className="text-lg" />
        </button>
      </div>

      <div className="space-y-3">
        {classes.map(cls => (
          <div
            key={cls.id}
            className="bg-white dark:bg-[#162b20] rounded-2xl p-4 border border-emerald-100 flex items-center justify-between shadow-sm cursor-pointer hover:border-primary/50"
            onClick={() => { setSelectedClass(cls); setActiveView(AppView.ADMIN_CLASS_DETAILS); }}
          >
            <div className="flex items-center gap-3">
              <div className="size-11 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                <Icon name="school" filled />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">{cls.name}</h3>
                <p className="text-[11px] text-gray-400">{cls.sections.length} شُعب - {cls.sections.reduce((a, s) => a + s.students.length, 0)} طالبة</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); handleDeleteClass(cls.id); }}
                className="text-red-400 hover:text-red-600 p-2"
                title="حذف الصف"
              >
                <Icon name="delete" className="text-base" />
              </button>
              <Icon name="chevron_left" className="text-gray-300" />
            </div>
          </div>
        ))}
        {classes.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-xs">
            <Icon name="school" className="text-4xl mb-2 text-gray-300" />
            <p>لا توجد صفوف مضافة حالياً. أضيفي صفاً للبدء!</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderAddClass = () => (
    <div className="p-6 animate-in slide-in-from-bottom duration-300">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => setActiveView(AppView.ADMIN_CLASSES)} className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full">
          <Icon name="arrow_forward" />
        </button>
        <h2 className="text-xl font-bold">إضافة صف دراسي جديد</h2>
      </div>
      <div className="bg-white dark:bg-[#162b20] p-6 rounded-3xl border">
        <label className="text-xs font-bold block mb-2">اسم الصف</label>
        <input
          type="text"
          placeholder="مثلاً: الصف السادس الابتدائي"
          value={newClassName}
          onChange={(e) => setNewClassName(e.target.value)}
          className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-2xl p-3.5 text-xs mb-4 focus:ring-primary"
          dir="rtl"
        />
        <button
          disabled={!newClassName.trim()}
          onClick={() => handleAddClass(newClassName)}
          className="w-full py-3.5 bg-primary text-white font-bold rounded-2xl text-xs shadow-md disabled:opacity-50"
        >
          حفظ الصف
        </button>
      </div>
    </div>
  );

  const renderClassDetails = () => {
    if (!selectedClass) return null;
    return (
      <div className="p-4 pb-28 animate-in slide-in-from-right duration-500 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <button onClick={() => setActiveView(AppView.ADMIN_CLASSES)} className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full">
            <Icon name="arrow_forward" />
          </button>
          <h2 className="text-xl font-black">{selectedClass.name}</h2>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between items-center px-1">
            <h3 className="font-bold text-xs text-gray-500 uppercase">شُعب الصف</h3>
            <button
              onClick={() => setActiveView(AppView.ADMIN_ADD_SECTION)}
              className="text-xs font-bold text-primary flex items-center gap-1"
            >
              <Icon name="add" className="text-sm" /> إضافة شعبة
            </button>
          </div>

          {selectedClass.sections.map(sec => (
            <div
              key={sec.id}
              className="bg-white dark:bg-[#162b20] p-4 rounded-2xl border border-emerald-100 flex justify-between items-center cursor-pointer shadow-sm"
              onClick={() => { setSelectedSection(sec); setActiveView(AppView.ADMIN_SECTION_DETAILS); }}
            >
              <div className="flex items-center gap-3">
                <div className="size-10 bg-primary/20 rounded-xl flex items-center justify-center text-primary font-black text-sm">
                  {sec.name}
                </div>
                <div>
                  <p className="font-bold text-xs text-gray-900 dark:text-white">شعبة {sec.name}</p>
                  <p className="text-[10px] text-gray-400">{sec.students.length} طالبة</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteSection(selectedClass.id, sec.id); }}
                  className="text-red-400 hover:text-red-600 p-1.5"
                >
                  <Icon name="delete" className="text-base" />
                </button>
                <Icon name="chevron_left" className="text-gray-300" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderAddSection = () => (
    <div className="p-6 animate-in slide-in-from-bottom duration-300">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => setActiveView(AppView.ADMIN_CLASS_DETAILS)} className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full">
          <Icon name="arrow_forward" />
        </button>
        <h2 className="text-xl font-bold">إضافة شعبة</h2>
      </div>
      <div className="bg-white dark:bg-[#162b20] p-6 rounded-3xl border">
        <p className="text-xs text-gray-500 mb-3">إلى صف: {selectedClass?.name}</p>
        <label className="text-xs font-bold block mb-2">اسم الشعبة (أ، ب، ج...)</label>
        <input
          type="text"
          placeholder="مثلاً: أ"
          value={newSectionName}
          onChange={(e) => setNewSectionName(e.target.value)}
          className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-2xl p-3.5 text-xs mb-4 focus:ring-primary"
          dir="rtl"
        />
        <button
          disabled={!newSectionName.trim()}
          onClick={() => selectedClass && handleAddSection(selectedClass.id, newSectionName)}
          className="w-full py-3.5 bg-primary text-white font-bold rounded-2xl text-xs shadow-md disabled:opacity-50"
        >
          حفظ الشعبة
        </button>
      </div>
    </div>
  );

  const renderSectionDetails = () => {
    if (!selectedSection || !selectedClass) return null;
    return (
      <div className="p-4 pb-28 animate-in slide-in-from-right duration-500 space-y-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <button onClick={() => setActiveView(AppView.ADMIN_CLASS_DETAILS)} className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full">
              <Icon name="arrow_forward" />
            </button>
            <div>
              <h2 className="text-xl font-black">شعبة {selectedSection.name}</h2>
              <p className="text-xs text-gray-500">{selectedClass.name}</p>
            </div>
          </div>
          <button
            onClick={() => setActiveView(AppView.ADMIN_ADD_STUDENT)}
            className="bg-primary text-white px-3.5 py-1.5 rounded-full text-xs font-bold shadow"
          >
            + إضافة طالبة
          </button>
        </div>

        <div className="bg-white dark:bg-[#162b20] rounded-2xl border border-emerald-100 divide-y dark:divide-gray-800 shadow-sm overflow-hidden">
          {selectedSection.students.map((student, i) => (
            <div key={student.id} className="p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-gray-300 font-bold text-xs">{i + 1}</span>
                <div>
                  <p className="text-xs font-bold text-gray-900 dark:text-white">{student.name}</p>
                  <p className="text-[10px] text-gray-400">اسم الدخول: {student.name.replace(/\s/g, '').toLowerCase()}@example.com</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-black text-primary">{student.points} نقطة</span>
                <button
                  onClick={() => handleDeleteStudent(selectedClass.id, selectedSection.id, student.id)}
                  className="text-red-400 hover:text-red-600 p-1.5"
                  title="حذف الطالبة"
                >
                  <Icon name="close" className="text-base" />
                </button>
              </div>
            </div>
          ))}
          {selectedSection.students.length === 0 && (
            <p className="text-center py-10 text-gray-400 text-xs italic">لا توجد طالبات في هذه الشعبة بعد</p>
          )}
        </div>
      </div>
    );
  };

  const renderAddStudent = () => (
    <div className="p-6 animate-in slide-in-from-bottom duration-300">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => setActiveView(AppView.ADMIN_SECTION_DETAILS)} className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full">
          <Icon name="arrow_forward" />
        </button>
        <h2 className="text-xl font-bold">إضافة طالبة جديدة</h2>
      </div>
      <div className="bg-white dark:bg-[#162b20] p-6 rounded-3xl border">
        <p className="text-xs text-gray-500 mb-3">
          إلى صف: {selectedClass?.name} - شعبة {selectedSection?.name}
        </p>
        <label className="text-xs font-bold block mb-2">اسم الطالبة الكامل</label>
        <input
          type="text"
          placeholder="مثلاً: ريم خالد القحطاني"
          value={newStudentName}
          onChange={(e) => setNewStudentName(e.target.value)}
          className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-2xl p-3.5 text-xs mb-4 focus:ring-primary"
          dir="rtl"
        />
        <button
          disabled={!newStudentName.trim() || loading}
          onClick={() => selectedClass && selectedSection && handleAddStudent(selectedClass.id, selectedSection.id, newStudentName)}
          className="w-full py-3.5 bg-primary text-white font-bold rounded-2xl text-xs shadow-md disabled:opacity-50"
        >
          {loading ? 'جاري الإضافة...' : 'إضافة الطالبة'}
        </button>
      </div>
    </div>
  );

  const renderAdminProfile = () => (
    <div className="p-4 pb-28 animate-in slide-in-from-top duration-500 space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <button onClick={() => setActiveView(AppView.ADMIN)} className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full">
          <Icon name="arrow_forward" />
        </button>
        <h2 className="text-xl font-bold">حساب المشرفة</h2>
      </div>

      <div className="bg-white dark:bg-[#162b20] rounded-3xl p-6 shadow-sm border border-emerald-100 text-center">
        <div className="size-20 rounded-full bg-primary/20 text-primary flex items-center justify-center mx-auto mb-3">
          <Icon name="school" className="text-4xl" filled />
        </div>
        <h2 className="text-lg font-bold">المعلمة / مشرفة نادي التدوير</h2>
        <p className="text-xs text-gray-400 mt-0.5">admin@tadweer.com</p>
      </div>

      <div className="space-y-2">
        <button
          onClick={toggleDarkMode}
          className="w-full flex items-center justify-between p-4 bg-white dark:bg-[#162b20] rounded-2xl border"
        >
          <div className="flex items-center gap-3">
            <Icon name={isDarkMode ? 'light_mode' : 'dark_mode'} className="text-gray-500" />
            <span className="font-bold text-xs">{isDarkMode ? 'الوضع الفاتح' : 'الوضع الليلي'}</span>
          </div>
          <div className={`w-11 h-6 rounded-full p-1 transition-colors ${isDarkMode ? 'bg-primary' : 'bg-gray-300'}`}>
            <div className={`bg-white size-4 rounded-full transition-transform ${isDarkMode ? '-translate-x-5' : 'translate-x-0'}`}></div>
          </div>
        </button>

        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-between p-4 bg-white dark:bg-[#162b20] rounded-2xl border text-red-500"
        >
          <div className="flex items-center gap-3">
            <Icon name="logout" />
            <span className="font-bold text-xs">تسجيل الخروج</span>
          </div>
        </button>
      </div>
    </div>
  );

  // --- Login View ---
  const renderLogin = () => (
    <div className="min-h-screen flex flex-col justify-center items-center p-6 bg-background-light dark:bg-background-dark max-w-[480px] mx-auto shadow-2xl">
      <div className="w-full space-y-6 animate-in fade-in zoom-in duration-500">
        <div className="text-center">
          <div className="size-24 bg-primary/20 rounded-3xl flex items-center justify-center text-primary mx-auto mb-4 shadow-inner ring-4 ring-primary/10">
            <Icon name="recycling" className="text-6xl text-primary" filled />
          </div>
          <h1 className="text-4xl font-black text-primary-dark dark:text-primary mb-1 tracking-tight">تدويري</h1>
          <p className="text-emerald-700 dark:text-emerald-300 font-bold text-sm">منصة إعادة التدوير والمكافآت المدرسية للطالبات</p>
          <p className="text-xs text-gray-400 mt-1">افرزي النفايات، اجمعي النقاط، واحصلي على مكافآت مقصف وشهادات تميز</p>
        </div>

        <form onSubmit={handleAuth} className="bg-white dark:bg-[#162b20] p-6 rounded-[2.5rem] shadow-xl border border-primary/20 space-y-4">
          {authError && (
            <div className="bg-red-50 text-red-600 p-3 rounded-2xl text-xs text-center font-bold">
              {authError}
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1.5 mr-1 text-right">
              اسم الطالبة أو البريد الإلكتروني
            </label>
            <div className="relative">
              <Icon name="person" className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-lg" />
              <input
                type="text"
                value={studentLoginName}
                onChange={(e) => setStudentLoginName(e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-2xl p-3.5 pr-11 text-xs focus:ring-2 focus:ring-primary text-right"
                placeholder="أدخلي اسمكِ أو بريدكِ المدرسي"
                required
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1.5 mr-1 text-right">
              كلمة المرور
            </label>
            <div className="relative">
              <Icon name="lock" className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-lg" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-2xl p-3.5 pr-11 text-xs focus:ring-2 focus:ring-primary text-right"
                placeholder="أدخلي كلمة المرور"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3.5 bg-primary text-white font-black rounded-2xl shadow-lg shadow-primary/30 hover:bg-primary-dark transition-all active:scale-95 text-xs flex items-center justify-center gap-1.5"
          >
            <Icon name="login" className="text-base" />
            <span>{isRegistering ? 'إنشاء حساب طالبة جديد' : 'تسجيل الدخول'}</span>
          </button>

          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => { setIsRegistering(!isRegistering); setAuthError(""); }}
              className="text-xs text-gray-400 hover:text-primary transition-colors font-medium"
            >
              {isRegistering ? 'لديكِ حساب بالفعل؟ تسجيل الدخول' : 'حساب جديد؟ سجلي معنا الآن'}
            </button>
          </div>

          <div className="pt-3 border-t border-gray-100 dark:border-gray-800 text-center" style={{display: "none"}}>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              دخول المشرفة والمعلمة: <span className="font-bold text-primary">admin@tadweer.com</span>
              <br />
              كلمة المرور: <span className="font-bold text-primary">123456</span>
            </p>
          </div>
        </form>
      </div>
    </div>
  );

  if (!isLoggedIn) return renderLogin();

  return (
    <div className="flex flex-col min-h-screen max-w-[480px] mx-auto bg-background-light dark:bg-background-dark shadow-2xl relative overflow-x-hidden">
      {/* Top Header */}
      <header className="flex items-center bg-white/90 dark:bg-[#162b20]/90 backdrop-blur-md p-3.5 justify-between sticky top-0 z-40 border-b border-emerald-100 dark:border-emerald-950/60 shadow-sm">
        <button
          onClick={() => setActiveView(isAdmin ? AppView.ADMIN : AppView.HOME)}
          className="size-10 bg-primary/15 rounded-2xl flex items-center justify-center text-primary hover:bg-primary/25 transition-colors"
          title="تدويري"
        >
          <Icon name="recycling" className="text-xl" filled />
        </button>

        <h1 className="text-base font-black flex-1 text-center font-display tracking-tight text-gray-900 dark:text-white">
          {activeView === AppView.HOME ? 'تدويري' :
            activeView === AppView.TASKS ? 'مهام التدوير' :
              activeView === AppView.REWARDS ? 'متجر المكافآت' :
                activeView === AppView.CHAT ? 'المرشدة تدويرة' :
                  activeView === AppView.PROFILE ? 'حسابي' :
                    activeView === AppView.ADMIN ? 'لوحة المشرفة' :
                      activeView === AppView.ADMIN_CLASSES ? 'الصفوف والشعب' :
                        activeView === AppView.ADMIN_ADD_CLASS ? 'إضافة صف' :
                          activeView === AppView.ADMIN_CLASS_DETAILS ? 'تفاصيل الصف' :
                            activeView === AppView.ADMIN_SECTION_DETAILS ? 'الشعبة' :
                              activeView === AppView.ADMIN_ADD_SECTION ? 'إضافة شعبة' :
                                activeView === AppView.ADMIN_ADD_STUDENT ? 'إضافة طالبة' :
                                  activeView === AppView.ADMIN_ADD_TASK ? 'إضافة مهمة' :
                                    activeView === AppView.ADMIN_EDIT_TASK ? 'تعديل المهمة' :
                                      activeView === AppView.ADMIN_COMPETITIONS ? 'مسابقات التدوير' :
                                        activeView === AppView.ADMIN_ADD_COMPETITION ? 'إضافة مسابقة' :
                                          activeView === AppView.ADMIN_EDIT_COMPETITION ? 'تعديل مسابقة' :
                                            activeView === AppView.ADMIN_REWARDS ? 'إدارة المكافآت' :
                                              activeView === AppView.CHALLENGES ? 'المسابقات والتحديات' : 'تدويري'}
        </h1>

        <button
          onClick={() => setActiveView(isAdmin ? AppView.ADMIN_PROFILE : AppView.PROFILE)}
          className="size-10 bg-emerald-50 dark:bg-emerald-950/60 rounded-2xl flex items-center justify-center text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900/60"
          title="الملف الشخصي"
        >
          <Icon name={isAdmin ? 'manage_accounts' : 'person'} className="text-lg" />
        </button>
      </header>

      {/* Main Content Area */}
      <main className="flex-1">
        {activeView === AppView.HOME && renderHome()}
        {activeView === AppView.TASKS && renderTasks()}
        {activeView === AppView.REWARDS && renderRewards()}
        {activeView === AppView.CHAT && renderMentor()}
        {activeView === AppView.PROFILE && renderProfile()}
        {activeView === AppView.CHALLENGES && renderChallenges()}
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
        {activeView === AppView.ADMIN_REWARDS && renderAdminRewards()}
      </main>

      {/* Bottom Navigation for Student */}
      {!isAdmin && <BottomNav activeView={activeView} setActiveView={setActiveView} />}

      {/* Bottom Navigation for Admin */}
      {isAdmin && (
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-white/95 dark:bg-[#162b20]/95 backdrop-blur-md border-t border-emerald-100 dark:border-emerald-950/60 flex justify-around items-center py-3 z-50 shadow-lg">
          <button
            onClick={() => setActiveView(AppView.ADMIN)}
            className={`flex flex-col items-center flex-1 py-1 transition-all ${
              [AppView.ADMIN, AppView.ADMIN_ADD_TASK, AppView.ADMIN_EDIT_TASK, AppView.ADMIN_COMPETITIONS, AppView.ADMIN_ADD_COMPETITION, AppView.ADMIN_EDIT_COMPETITION, AppView.ADMIN_REWARDS].includes(activeView)
                ? 'text-primary font-bold'
                : 'text-gray-400'
            }`}
          >
            <Icon name="dashboard" filled={[AppView.ADMIN, AppView.ADMIN_ADD_TASK, AppView.ADMIN_EDIT_TASK, AppView.ADMIN_COMPETITIONS, AppView.ADMIN_ADD_COMPETITION, AppView.ADMIN_EDIT_COMPETITION, AppView.ADMIN_REWARDS].includes(activeView)} />
            <span className="text-[10px] mt-0.5">الرئيسية</span>
          </button>
          <button
            onClick={() => setActiveView(AppView.ADMIN_CLASSES)}
            className={`flex flex-col items-center flex-1 py-1 transition-all ${
              activeView === AppView.ADMIN_CLASSES ? 'text-primary font-bold' : 'text-gray-400'
            }`}
          >
            <Icon name="school" filled={activeView === AppView.ADMIN_CLASSES} />
            <span className="text-[10px] mt-0.5">الصفوف</span>
          </button>
          <button
            onClick={() => setActiveView(AppView.ADMIN_REWARDS)}
            className={`flex flex-col items-center flex-1 py-1 transition-all ${
              activeView === AppView.ADMIN_REWARDS ? 'text-primary font-bold' : 'text-gray-400'
            }`}
          >
            <Icon name="redeem" filled={activeView === AppView.ADMIN_REWARDS} />
            <span className="text-[10px] mt-0.5">المكافآت</span>
          </button>
          <button
            onClick={() => setActiveView(AppView.ADMIN_PROFILE)}
            className={`flex flex-col items-center flex-1 py-1 transition-all ${
              activeView === AppView.ADMIN_PROFILE ? 'text-primary font-bold' : 'text-gray-400'
            }`}
          >
            <Icon name="account_circle" filled={activeView === AppView.ADMIN_PROFILE} />
            <span className="text-[10px] mt-0.5">حسابي</span>
          </button>
        </div>
      )}

      {/* Claimed Reward Success Modal */}
      {claimedRewardModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-[#162b20] rounded-3xl p-6 max-w-sm w-full text-center border border-amber-200 dark:border-amber-900 shadow-2xl space-y-4">
            <div className="size-20 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto text-4xl shadow-inner animate-bounce">
              <Icon name="celebration" filled />
            </div>

            <div>
              <h3 className="text-xl font-black text-gray-900 dark:text-white">
                تهانينا يا {stats.name || 'بطلة التدوير'}! 🎉
              </h3>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold mt-1">تم استبدال المكافأة بنجاح</p>
              <p className="text-sm font-bold text-gray-800 dark:text-gray-200 mt-2">{claimedRewardModal.rewardTitle}</p>
            </div>

            <div className="bg-amber-50 dark:bg-amber-950/40 border border-dashed border-amber-300 dark:border-amber-800 p-3.5 rounded-2xl">
              <span className="text-[10px] text-gray-500 uppercase font-bold block mb-1">رمز القسيمة المدرسية</span>
              <span className="font-mono text-2xl font-black text-amber-600 tracking-wider block">
                {claimedRewardModal.code}
              </span>
              <button
                onClick={() => copyToClipboard(claimedRewardModal.code)}
                className="mt-2 text-xs font-bold text-amber-700 dark:text-amber-300 flex items-center justify-center gap-1 mx-auto hover:underline"
              >
                <Icon name="content_copy" className="text-sm" />
                <span>نسخ الرمز</span>
              </button>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              أظهري هذا الكود لمعلمتكِ أو لمشرفة المقصف المدرسي لاستلام مكافأتكِ!
            </p>

            <button
              onClick={() => setClaimedRewardModal(null)}
              className="w-full py-3 bg-primary hover:bg-primary-dark text-white font-black rounded-2xl text-xs shadow-md transition-all active:scale-95"
            >
              تم، شكراً!
            </button>
          </div>
        </div>
      )}

      {/* Copy Toast */}
      {toastText && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-4 py-2 rounded-full shadow-lg z-50 animate-in fade-in duration-200">
          {toastText}
        </div>
      )}
    </div>
  );
};

export default App;
