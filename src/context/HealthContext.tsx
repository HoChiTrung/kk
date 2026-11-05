/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  StudentProfile,
  HealthMetricRecord,
  AIAdviceRecord,
  MealLog,
  WorkoutLog,
  PhysiquePhoto,
  Badge,
  SmartNotification,
  UserRole,
  AuthUser,
} from '../types/health';
import {
  SEED_STUDENTS,
  SEED_METRICS,
  SEED_ADVICES,
  SEED_MEALS,
  SEED_WORKOUTS,
  SEED_PHOTOS,
  SEED_BADGES,
  SEED_NOTIFICATIONS,
} from '../data/seedData';
import {
  generateInstantAIAdvice,
  detectAnomalies,
  calculateHealthScore,
} from '../utils/healthCalculations';

interface HealthContextType {
  // Authentication
  currentUser: AuthUser | null;
  login: (username: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  isTrainer: boolean;
  canCreateStudent: boolean;

  // Role & selection
  role: UserRole;
  setRole: (role: UserRole) => void;
  students: StudentProfile[];
  selectedStudent: StudentProfile | null;
  setSelectedStudent: (student: StudentProfile | null) => void;
  metrics: HealthMetricRecord[];
  getStudentMetrics: (studentId: string) => HealthMetricRecord[];
  advices: AIAdviceRecord[];
  getStudentAdvices: (studentId: string) => AIAdviceRecord[];
  meals: MealLog[];
  getStudentMeals: (studentId: string) => MealLog[];
  workouts: WorkoutLog[];
  getStudentWorkouts: (studentId: string) => WorkoutLog[];
  photos: PhysiquePhoto[];
  getStudentPhotos: (studentId: string) => PhysiquePhoto[];
  badges: Badge[];
  notifications: SmartNotification[];
  unreadNotificationCount: number;
  dbStatus: { connected: boolean; name: string };

  // Operations
  addStudent: (student: Omit<StudentProfile, 'id' | 'createdAt'> & { initialUsername?: string; initialPassword?: string }) => Promise<StudentProfile>;
  updateStudent: (student: StudentProfile) => Promise<void>;
  updateStudentDriveFolder: (studentId: string, driveFolderUrl: string) => Promise<void>;
  deleteStudent: (id: string) => Promise<void>;
  addMetricRecord: (record: Omit<HealthMetricRecord, 'id' | 'timestamp'>) => Promise<void>;
  deleteMetricRecord: (id: string) => Promise<void>;
  addMealLog: (meal: Omit<MealLog, 'id' | 'loggedAt'>) => Promise<void>;
  addMealFeedback: (id: string, reaction: '🔥' | '💪' | '👏' | '❤️', comment?: string) => Promise<void>;
  analyzeMealPhoto: (params: {
    imageBase64: string;
    mimeType?: string;
    studentGoal?: string;
    mealType?: string;
    studentName?: string;
    dishHint?: string;
    fileName?: string;
  }) => Promise<any>;
  addWorkoutLog: (workout: Omit<WorkoutLog, 'id' | 'loggedAt'>) => Promise<void>;
  addWorkoutFeedback: (id: string, reaction: '🔥' | '💪' | '👏' | '❤️', comment?: string) => Promise<void>;
  addPhysiquePhoto: (photo: Omit<PhysiquePhoto, 'id'>) => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;

  // Modals
  openReportModal: boolean;
  setOpenReportModal: (open: boolean) => void;
  openStandardsModal: boolean;
  setOpenStandardsModal: (open: boolean) => void;
}

const HealthContext = createContext<HealthContextType | undefined>(undefined);

export const HealthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Current logged in user (null = show Login Page)
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => {
    const saved = localStorage.getItem('fit_auth_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [role, setRole] = useState<UserRole>(currentUser?.role || 'trainer');
  const [students, setStudents] = useState<StudentProfile[]>(() => {
    const saved = localStorage.getItem('fit_students');
    return saved ? JSON.parse(saved) : SEED_STUDENTS;
  });

  const [selectedStudent, setSelectedStudent] = useState<StudentProfile | null>(() => {
    const saved = localStorage.getItem('fit_selected_student_id');
    const pool = saved ? JSON.parse(localStorage.getItem('fit_students') || '[]') : SEED_STUDENTS;
    return pool.find((s: StudentProfile) => s.id === saved) || SEED_STUDENTS[0];
  });

  const [metrics, setMetrics] = useState<HealthMetricRecord[]>(() => {
    const saved = localStorage.getItem('fit_metrics');
    return saved ? JSON.parse(saved) : SEED_METRICS;
  });

  const [advices, setAdvices] = useState<AIAdviceRecord[]>(() => {
    const saved = localStorage.getItem('fit_advices');
    return saved ? JSON.parse(saved) : SEED_ADVICES;
  });

  const [meals, setMeals] = useState<MealLog[]>(() => {
    const saved = localStorage.getItem('fit_meals');
    return saved ? JSON.parse(saved) : SEED_MEALS;
  });

  const [workouts, setWorkouts] = useState<WorkoutLog[]>(() => {
    const saved = localStorage.getItem('fit_workouts');
    return saved ? JSON.parse(saved) : SEED_WORKOUTS;
  });

  const [photos, setPhotos] = useState<PhysiquePhoto[]>(() => {
    const saved = localStorage.getItem('fit_photos');
    return saved ? JSON.parse(saved) : SEED_PHOTOS;
  });

  const [badges] = useState<Badge[]>(() => {
    const saved = localStorage.getItem('fit_badges');
    return saved ? JSON.parse(saved) : SEED_BADGES;
  });

  const [notifications, setNotifications] = useState<SmartNotification[]>(() => {
    const saved = localStorage.getItem('fit_notifications');
    return saved ? JSON.parse(saved) : SEED_NOTIFICATIONS;
  });

  const isGitHubPages =
    typeof window !== 'undefined' && window.location.hostname.endsWith('github.io');

  const [apiAvailable, setApiAvailable] = useState<boolean>(!isGitHubPages);

  const [dbStatus, setDbStatus] = useState<{ connected: boolean; name: string }>({
    connected: true,
    name: isGitHubPages ? 'Cloud Sync (GitHub Pages)' : 'Aiven TramTap (PostgreSQL)',
  });

  const [openReportModal, setOpenReportModal] = useState(false);
  const [openStandardsModal, setOpenStandardsModal] = useState(false);

  // Sync role and selected student when user changes
  useEffect(() => {
    if (currentUser) {
      setRole(currentUser.role);
      if (currentUser.role === 'student' && currentUser.studentId) {
        const found = students.find((s) => s.id === currentUser.studentId);
        if (found) setSelectedStudent(found);
      }
    }
  }, [currentUser, students]);

  // Sync to API on Mount (skip on GitHub Pages static hosting to avoid 404 errors)
  useEffect(() => {
    if (isGitHubPages) {
      setApiAvailable(false);
      return;
    }

    async function loadData() {
      try {
        const healthCheck = await fetch('/api/health').catch(() => null);
        if (!healthCheck || !healthCheck.ok) {
          setApiAvailable(false);
          return;
        }
        const healthData = await healthCheck.json().catch(() => null);
        if (!healthData) {
          setApiAvailable(false);
          return;
        }

        setApiAvailable(true);
        setDbStatus({
          connected: healthData.databaseConnected ?? true,
          name: `${healthData.databaseName || 'TramTap'} (PostgreSQL)`,
        });

        const [resS, resM, resA, resMeals, resW, resP, resN] = await Promise.allSettled([
          fetch('/api/students').then((r) => (r.ok ? r.json() : null)),
          fetch('/api/metrics').then((r) => (r.ok ? r.json() : null)),
          fetch('/api/advices').then((r) => (r.ok ? r.json() : null)),
          fetch('/api/meals').then((r) => (r.ok ? r.json() : null)),
          fetch('/api/workouts').then((r) => (r.ok ? r.json() : null)),
          fetch('/api/photos').then((r) => (r.ok ? r.json() : null)),
          fetch('/api/notifications').then((r) => (r.ok ? r.json() : null)),
        ]);

        if (resS.status === 'fulfilled' && Array.isArray(resS.value) && resS.value.length > 0) {
          setStudents(resS.value);
          localStorage.setItem('fit_students', JSON.stringify(resS.value));
          if (!selectedStudent || !resS.value.some((s) => s.id === selectedStudent.id)) {
            setSelectedStudent(resS.value[0]);
          }
        }
        if (resM.status === 'fulfilled' && Array.isArray(resM.value)) {
          setMetrics(resM.value);
          localStorage.setItem('fit_metrics', JSON.stringify(resM.value));
        }
        if (resA.status === 'fulfilled' && Array.isArray(resA.value)) {
          setAdvices(resA.value);
          localStorage.setItem('fit_advices', JSON.stringify(resA.value));
        }
        if (resMeals.status === 'fulfilled' && Array.isArray(resMeals.value)) {
          setMeals(resMeals.value);
          localStorage.setItem('fit_meals', JSON.stringify(resMeals.value));
        }
        if (resW.status === 'fulfilled' && Array.isArray(resW.value)) {
          setWorkouts(resW.value);
          localStorage.setItem('fit_workouts', JSON.stringify(resW.value));
        }
        if (resP.status === 'fulfilled' && Array.isArray(resP.value)) {
          setPhotos(resP.value);
          localStorage.setItem('fit_photos', JSON.stringify(resP.value));
        }
        if (resN.status === 'fulfilled' && Array.isArray(resN.value)) {
          setNotifications(resN.value);
          localStorage.setItem('fit_notifications', JSON.stringify(resN.value));
        }
      } catch (err) {
        setApiAvailable(false);
        console.warn('API sync warning, using persisted client store', err);
      }
    }

    loadData();
  }, []);

  // Sync selectedStudent ID to localStorage
  useEffect(() => {
    if (selectedStudent) {
      localStorage.setItem('fit_selected_student_id', selectedStudent.id);
    }
  }, [selectedStudent]);

  // Local authentication helper (used on GitHub Pages or when backend API is offline)
  const authenticateLocally = (username: string, pass: string) => {
    const cleanUser = username.trim().toLowerCase();
    const cleanPass = pass.trim();

    if (cleanUser === 'trunghbl' && cleanPass === '123') {
      const trainerUser: AuthUser = {
        id: 'user-trainer-1',
        username: 'trunghbl',
        fullName: 'Huấn Luyện Viên Trung HBL',
        role: 'trainer',
        avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
      };
      setCurrentUser(trainerUser);
      setRole('trainer');
      localStorage.setItem('fit_auth_user', JSON.stringify(trainerUser));
      return { success: true };
    }

    const defaultStudents = [
      { key: 'hoanglong', name: 'Nguyễn Hoàng Long', studentId: 'student-1' },
      { key: 'thuha', name: 'Trần Thị Thu Hà', studentId: 'student-2' },
      { key: 'minhduc', name: 'Phạm Minh Đức', studentId: 'student-3' },
      { key: 'kimngan', name: 'Lê Kim Ngân', studentId: 'student-4' },
    ];
    const matchedDefault = defaultStudents.find((item) => item.key === cleanUser);
    if (matchedDefault && cleanPass === '123') {
      const stdUser: AuthUser = {
        id: `user-${cleanUser}`,
        username: cleanUser,
        fullName: matchedDefault.name,
        role: 'student',
        studentId: matchedDefault.studentId,
      };
      setCurrentUser(stdUser);
      setRole('student');
      localStorage.setItem('fit_auth_user', JSON.stringify(stdUser));
      const found = students.find((s) => s.id === matchedDefault.studentId);
      if (found) setSelectedStudent(found);
      return { success: true };
    }

    // Check custom student accounts created by trainer
    try {
      const customAccounts: Array<{
        username: string;
        password: string;
        fullName: string;
        studentId: string;
        avatarUrl?: string;
      }> = JSON.parse(localStorage.getItem('fit_custom_users') || '[]');
      const matchedCustom = customAccounts.find(
        (u) => u.username.trim().toLowerCase() === cleanUser && u.password === cleanPass
      );
      if (matchedCustom) {
        const stdUser: AuthUser = {
          id: `user-${matchedCustom.studentId}`,
          username: matchedCustom.username,
          fullName: matchedCustom.fullName,
          role: 'student',
          studentId: matchedCustom.studentId,
          avatarUrl: matchedCustom.avatarUrl,
        };
        setCurrentUser(stdUser);
        setRole('student');
        localStorage.setItem('fit_auth_user', JSON.stringify(stdUser));
        const found = students.find((s) => s.id === matchedCustom.studentId);
        if (found) setSelectedStudent(found);
        return { success: true };
      }
    } catch {
      // Ignore parse error
    }

    // Also allow login by student phone number with password '123'
    const matchedByPhone = students.find((s) => s.phone.trim() === cleanUser);
    if (matchedByPhone && cleanPass === '123') {
      const stdUser: AuthUser = {
        id: `user-${matchedByPhone.id}`,
        username: matchedByPhone.phone,
        fullName: matchedByPhone.fullName,
        role: 'student',
        studentId: matchedByPhone.id,
        avatarUrl: matchedByPhone.avatarUrl,
      };
      setCurrentUser(stdUser);
      setRole('student');
      localStorage.setItem('fit_auth_user', JSON.stringify(stdUser));
      setSelectedStudent(matchedByPhone);
      return { success: true };
    }

    return { success: false, error: 'Tên đăng nhập hoặc mật khẩu không chính xác!' };
  };

  // Login handler
  const login = async (username: string, pass: string) => {
    if (!apiAvailable || isGitHubPages) {
      return authenticateLocally(username, pass);
    }

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password: pass }),
      });
      if (res.status === 404 || res.status === 405) {
        setApiAvailable(false);
        return authenticateLocally(username, pass);
      }
      const data = await res.json();
      if (res.ok && data.success && data.user) {
        setCurrentUser(data.user);
        setRole(data.user.role);
        localStorage.setItem('fit_auth_user', JSON.stringify(data.user));

        if (data.user.role === 'student' && data.user.studentId) {
          const found = students.find((s) => s.id === data.user.studentId);
          if (found) setSelectedStudent(found);
        }
        return { success: true };
      }
      return { success: false, error: data.error || 'Đăng nhập không thành công' };
    } catch {
      return authenticateLocally(username, pass);
    }
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('fit_auth_user');
  };

  // Permission: ONLY trunghbl can create students
  const isTrainer = currentUser?.role === 'trainer';
  const canCreateStudent = currentUser?.username === 'trunghbl';

  const getStudentMetrics = (studentId: string) => {
    return metrics
      .filter((m) => m.studentId === studentId)
      .sort((a, b) => a.timestamp - b.timestamp);
  };

  const getStudentAdvices = (studentId: string) => {
    return advices.filter((a) => a.studentId === studentId);
  };

  const getStudentMeals = (studentId: string) => {
    return meals.filter((m) => m.studentId === studentId);
  };

  const getStudentWorkouts = (studentId: string) => {
    return workouts.filter((w) => w.studentId === studentId);
  };

  const getStudentPhotos = (studentId: string) => {
    return photos.filter((p) => p.studentId === studentId);
  };

  const unreadNotificationCount = notifications.filter((n) => !n.read).length;

  // Add Student - ONLY trunghbl
  const addStudent = async (studentData: Omit<StudentProfile, 'id' | 'createdAt'> & { initialUsername?: string; initialPassword?: string }) => {
    if (!canCreateStudent) {
      throw new Error('Chỉ có tài khoản Huấn Luyện Viên (trunghbl) mới có quyền tạo hồ sơ cho học viên!');
    }

    const newStudent: StudentProfile = {
      fullName: studentData.fullName,
      gender: studentData.gender,
      age: studentData.age,
      height: studentData.height,
      phone: studentData.phone,
      address: studentData.address,
      dateOfBirth: studentData.dateOfBirth,
      healthGoal: studentData.healthGoal,
      targetMetrics: studentData.targetMetrics,
      avatarUrl: studentData.avatarUrl,
      id: `student-${Date.now()}`,
      createdAt: new Date().toISOString().split('T')[0],
    };

    const updated = [newStudent, ...students];
    setStudents(updated);
    setSelectedStudent(newStudent);
    localStorage.setItem('fit_students', JSON.stringify(updated));

    // Persist student login credentials locally as well
    try {
      const customAccounts = JSON.parse(localStorage.getItem('fit_custom_users') || '[]');
      customAccounts.push({
        username: studentData.initialUsername || studentData.phone || newStudent.id,
        password: studentData.initialPassword || '123',
        fullName: newStudent.fullName,
        studentId: newStudent.id,
        avatarUrl: newStudent.avatarUrl,
      });
      localStorage.setItem('fit_custom_users', JSON.stringify(customAccounts));
    } catch {
      // Ignore storage error
    }

    if (apiAvailable && !isGitHubPages) {
      try {
        await fetch('/api/students', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-auth-username': currentUser?.username || 'trunghbl',
          },
          body: JSON.stringify({
            ...newStudent,
            _requestedBy: currentUser?.username,
            initialUsername: studentData.initialUsername,
            initialPassword: studentData.initialPassword,
          }),
        });
      } catch (err) {
        console.warn('Could not save student to remote DB', err);
      }
    }
    return newStudent;
  };

  // Update Student
  const updateStudent = async (student: StudentProfile) => {
    const updated = students.map((s) => (s.id === student.id ? student : s));
    setStudents(updated);
    if (selectedStudent?.id === student.id) {
      setSelectedStudent(student);
    }
    localStorage.setItem('fit_students', JSON.stringify(updated));

    if (apiAvailable && !isGitHubPages) {
      try {
        await fetch(`/api/students/${student.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(student),
        });
      } catch (err) {
        console.warn('Could not update student on remote DB', err);
      }
    }
  };

  const updateStudentDriveFolder = async (studentId: string, driveFolderUrl: string) => {
    const updated = students.map((s) => (s.id === studentId ? { ...s, driveFolderUrl } : s));
    setStudents(updated);
    if (selectedStudent?.id === studentId) {
      setSelectedStudent({ ...selectedStudent, driveFolderUrl });
    }
    localStorage.setItem('fit_students', JSON.stringify(updated));

    if (apiAvailable && !isGitHubPages) {
      try {
        await fetch(`/api/students/${studentId}/drive-folder`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ driveFolderUrl }),
        });
      } catch (err) {
        console.warn('Could not update student drive folder URL', err);
      }
    }
  };

  // Delete Student
  const deleteStudent = async (id: string) => {
    const updated = students.filter((s) => s.id !== id);
    setStudents(updated);
    if (selectedStudent?.id === id) {
      setSelectedStudent(updated[0] || null);
    }
    localStorage.setItem('fit_students', JSON.stringify(updated));

    if (apiAvailable && !isGitHubPages) {
      try {
        await fetch(`/api/students/${id}`, { method: 'DELETE' });
      } catch (err) {
        console.warn('Could not delete student on remote DB', err);
      }
    }
  };

  // Add Metric Record (10 indicators) + INSTANT AI ADVICE (NO APPROVAL NEEDED)
  const addMetricRecord = async (recordData: Omit<HealthMetricRecord, 'id' | 'timestamp'>) => {
    const timestamp = new Date(recordData.date).getTime() || Date.now();
    const newRecord: HealthMetricRecord = {
      ...recordData,
      id: `metric-${Date.now()}`,
      timestamp,
    };

    const studentHistory = getStudentMetrics(recordData.studentId);
    const previousRecord = studentHistory[studentHistory.length - 1];

    const updatedMetrics = [...metrics, newRecord].sort((a, b) => a.timestamp - b.timestamp);
    setMetrics(updatedMetrics);
    localStorage.setItem('fit_metrics', JSON.stringify(updatedMetrics));

    // Remote DB sync
    if (apiAvailable && !isGitHubPages) {
      try {
        await fetch('/api/metrics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newRecord),
        });
      } catch (err) {
        console.warn('Could not save metric to remote DB', err);
      }
    }

    // Auto-generate INSTANT AI Advice (No manual approval bottleneck, directly active!)
    const targetStudent = students.find((s) => s.id === recordData.studentId);
    if (targetStudent) {
      const adviceContent = generateInstantAIAdvice(targetStudent, newRecord, previousRecord);
      const newAdvice: AIAdviceRecord = {
        id: `advice-${Date.now()}`,
        studentId: recordData.studentId,
        metricRecordId: newRecord.id,
        date: recordData.date,
        status: 'auto_generated', // Instantly published to student and trainer!
        aiDraftContent: adviceContent,
        trainerEditedContent: adviceContent.summary,
        approvedAt: new Date().toLocaleString('vi-VN'),
      };

      const updatedAdvices = [newAdvice, ...advices];
      setAdvices(updatedAdvices);
      localStorage.setItem('fit_advices', JSON.stringify(updatedAdvices));

      if (apiAvailable && !isGitHubPages) {
        try {
          await fetch('/api/advices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newAdvice),
          });
        } catch (err) {
          console.warn('Could not save advice to remote DB', err);
        }
      }

      // Check anomalies & create smart notifications
      const anomalies = detectAnomalies(targetStudent, newRecord, [...studentHistory, newRecord]);
      for (const anomaly of anomalies) {
        const notif: SmartNotification = {
          id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          useCaseId: anomaly.type === 'PLATEAU' ? 'UC-NOTIF-03' : 'UC-NOTIF-01',
          studentId: targetStudent.id,
          title: anomaly.title,
          message: anomaly.message,
          priority: anomaly.severity === 'high' ? 'high' : 'medium',
          createdAt: new Date().toLocaleString('vi-VN'),
          read: false,
        };
        setNotifications((prev) => [notif, ...prev]);
      }
    }
  };

  // Delete Metric Record
  const deleteMetricRecord = async (id: string) => {
    const updated = metrics.filter((m) => m.id !== id);
    setMetrics(updated);
    localStorage.setItem('fit_metrics', JSON.stringify(updated));

    if (apiAvailable && !isGitHubPages) {
      try {
        await fetch(`/api/metrics/${id}`, { method: 'DELETE' });
      } catch (err) {
        console.warn('Could not delete metric from remote DB', err);
      }
    }
  };

  // Add Meal Log (Only store lightweight Drive/HTTP URLs, never Base64 image data)
  const addMealLog = async (mealData: Omit<MealLog, 'id' | 'loggedAt'>) => {
    const rawImg = mealData.imageUrl || '';
    const lightweightUrl = rawImg.startsWith('data:')
      ? 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80'
      : rawImg || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80';

    const newMeal: MealLog = {
      ...mealData,
      imageUrl: lightweightUrl,
      id: `meal-${Date.now()}`,
      loggedAt: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    };
    const updated = [newMeal, ...meals];
    setMeals(updated);
    localStorage.setItem('fit_meals', JSON.stringify(updated));

    if (apiAvailable && !isGitHubPages) {
      try {
        await fetch('/api/meals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newMeal),
        });
      } catch (err) {
        console.warn('Could not save meal to remote DB', err);
      }
    }
  };

  // Add Meal Trainer Feedback
  const addMealFeedback = async (id: string, reaction: '🔥' | '💪' | '👏' | '❤️', comment?: string) => {
    const updated = meals.map((m) => (m.id === id ? { ...m, trainerReaction: reaction, trainerComment: comment } : m));
    setMeals(updated);
    localStorage.setItem('fit_meals', JSON.stringify(updated));

    if (apiAvailable && !isGitHubPages) {
      try {
        await fetch(`/api/meals/${id}/feedback`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reaction, comment }),
        });
      } catch (err) {
        console.warn('Could not save meal feedback', err);
      }
    }
  };

  // Client-side smart nutrition analyzer fallback (when hosted on GitHub Pages without Node backend)
  const buildLocalMealAnalysis = (params: {
    studentGoal?: string;
    mealType?: string;
    dishHint?: string;
    fileName?: string;
  }) => {
    const goal = params.studentGoal || 'Cân đối vóc dáng';
    const mealType = params.mealType || 'Bữa trưa';
    const searchTarget = `${params.dishHint || ''} ${params.fileName || ''}`.toLowerCase();

    if (searchTarget.includes('pho') || searchTarget.includes('phở') || searchTarget.includes('bo')) {
      return {
        foodDescription: '1 tô Phở bò tái nạm hành hoa tươi, bánh phở mềm',
        estimatedCalories: 480,
        macros: { protein: 32, carbs: 62, fat: 12 },
        nutritionScore: 9,
        advice: `Món ăn giàu đạm sắt từ thịt bò tươi, phù hợp mục tiêu "${goal}". Nên ăn kèm nhiều rau thơm giá đỗ.`,
        healthTags: ['Đạm bò tươi', 'Ít dầu mỡ'],
      };
    }
    if (searchTarget.includes('ga') || searchTarget.includes('gà') || searchTarget.includes('uc ga')) {
      return {
        foodDescription: '150g Ức gà áp chảo, cơm gạo lứt và rau củ luộc',
        estimatedCalories: 450,
        macros: { protein: 42, carbs: 45, fat: 9 },
        nutritionScore: 9.5,
        advice: `Chuẩn tỉ lệ macro thể hình cho mục tiêu "${goal}". Đạm nạc nguyên chất tối ưu hóa phục hồi cơ bắp.`,
        healthTags: ['Giàu Protein', 'Eat Clean'],
      };
    }
    if (mealType === 'Bữa sáng') {
      return {
        foodDescription: 'Khẩu phần ăn sáng giàu năng lượng (Tinh bột phức hợp, Đạm và chất xơ)',
        estimatedCalories: 420,
        macros: { protein: 26, carbs: 50, fat: 13 },
        nutritionScore: 8.5,
        advice: `Bữa sáng cung cấp năng lượng tốt cho mục tiêu "${goal}". Nên uống thêm 300ml nước ấm và hạn chế nước sốt nhiều dầu mỡ.`,
        healthTags: ['Năng lượng sáng', 'Cân đối Macro'],
      };
    }
    if (mealType === 'Bữa tối') {
      return {
        foodDescription: 'Khẩu phần ăn tối thanh đạm (Ưu tiên Protein và Rau củ chất xơ)',
        estimatedCalories: 430,
        macros: { protein: 35, carbs: 42, fat: 12 },
        nutritionScore: 9,
        advice: `Bữa tối gọn nhẹ giúp tối ưu mục tiêu "${goal}". Hạn chế ăn quá muộn sau 20h và giảm lượng tinh bột vào buổi tối.`,
        healthTags: ['Thanh đạm', 'Phục hồi cơ'],
      };
    }
    if (mealType === 'Bữa phụ') {
      return {
        foodDescription: 'Bữa phụ bổ sung năng lượng & phục hồi cơ bắp',
        estimatedCalories: 310,
        macros: { protein: 22, carbs: 38, fat: 8 },
        nutritionScore: 9,
        advice: `Bữa phụ hỗ trợ duy trì đồng hóa cơ bắp cho mục tiêu "${goal}". Rất tốt khi dùng trước hoặc sau buổi tập 60 phút.`,
        healthTags: ['Bữa phụ', 'Nạp năng lượng'],
      };
    }
    return {
      foodDescription: 'Khẩu phần ăn trưa đầy đủ nhóm chất (Đạm nạc, Tinh bột và Rau xanh)',
      estimatedCalories: 520,
      macros: { protein: 38, carbs: 58, fat: 15 },
      nutritionScore: 8.5,
      advice: `Khẩu phần bữa trưa phù hợp với mục tiêu "${goal}". Lưu ý ăn phần rau xanh và đạm trước khi ăn tinh bột để kiểm soát đường huyết tốt hơn.`,
      healthTags: ['Giàu đạm', 'Đủ nhóm chất'],
    };
  };

  // AI Meal Photo Recognition Service
  const analyzeMealPhoto = async (params: {
    imageBase64: string;
    mimeType?: string;
    studentGoal?: string;
    mealType?: string;
    studentName?: string;
    dishHint?: string;
    fileName?: string;
  }) => {
    if (!apiAvailable || isGitHubPages) {
      return buildLocalMealAnalysis(params);
    }

    try {
      const res = await fetch('/api/ai/analyze-meal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      if (res.status === 404 || res.status === 405) {
        setApiAvailable(false);
        return buildLocalMealAnalysis(params);
      }

      const rawText = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(rawText);
      } catch {
        return buildLocalMealAnalysis(params);
      }

      if (!res.ok) {
        return buildLocalMealAnalysis(params);
      }
      return data.analysis;
    } catch {
      return buildLocalMealAnalysis(params);
    }
  };

  // Add Workout Log
  const addWorkoutLog = async (workoutData: Omit<WorkoutLog, 'id' | 'loggedAt'>) => {
    const newWorkout: WorkoutLog = {
      ...workoutData,
      id: `workout-${Date.now()}`,
      loggedAt: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    };
    const updated = [newWorkout, ...workouts];
    setWorkouts(updated);
    localStorage.setItem('fit_workouts', JSON.stringify(updated));

    if (apiAvailable && !isGitHubPages) {
      try {
        await fetch('/api/workouts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newWorkout),
        });
      } catch (err) {
        console.warn('Could not save workout to remote DB', err);
      }
    }
  };

  // Add Workout Feedback
  const addWorkoutFeedback = async (id: string, reaction: '🔥' | '💪' | '👏' | '❤️', comment?: string) => {
    const updated = workouts.map((w) => (w.id === id ? { ...w, trainerReaction: reaction, trainerComment: comment } : w));
    setWorkouts(updated);
    localStorage.setItem('fit_workouts', JSON.stringify(updated));

    if (apiAvailable && !isGitHubPages) {
      try {
        await fetch(`/api/workouts/${id}/feedback`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reaction, comment }),
        });
      } catch (err) {
        console.warn('Could not save workout feedback', err);
      }
    }
  };

  // Add Physique Photo
  const addPhysiquePhoto = async (photoData: Omit<PhysiquePhoto, 'id'>) => {
    const newPhoto: PhysiquePhoto = {
      ...photoData,
      id: `photo-${Date.now()}`,
    };
    const updated = [...photos, newPhoto];
    setPhotos(updated);
    localStorage.setItem('fit_photos', JSON.stringify(updated));

    if (apiAvailable && !isGitHubPages) {
      try {
        await fetch('/api/photos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newPhoto),
        });
      } catch (err) {
        console.warn('Could not save photo to remote DB', err);
      }
    }
  };

  // Mark notification read
  const markNotificationRead = async (id: string) => {
    const updated = notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
    setNotifications(updated);
    localStorage.setItem('fit_notifications', JSON.stringify(updated));

    if (apiAvailable && !isGitHubPages) {
      try {
        await fetch(`/api/notifications/${id}/read`, { method: 'PUT' });
      } catch (err) {
        console.warn('Could not mark notification read', err);
      }
    }
  };

  return (
    <HealthContext.Provider
      value={{
        currentUser,
        login,
        logout,
        isTrainer,
        canCreateStudent,
        role,
        setRole,
        students,
        selectedStudent,
        setSelectedStudent,
        metrics,
        getStudentMetrics,
        advices,
        getStudentAdvices,
        meals,
        getStudentMeals,
        workouts,
        getStudentWorkouts,
        photos,
        getStudentPhotos,
        badges,
        notifications,
        unreadNotificationCount,
        dbStatus,
        addStudent,
        updateStudent,
        updateStudentDriveFolder,
        deleteStudent,
        addMetricRecord,
        deleteMetricRecord,
        addMealLog,
        addMealFeedback,
        analyzeMealPhoto,
        addWorkoutLog,
        addWorkoutFeedback,
        addPhysiquePhoto,
        markNotificationRead,
        openReportModal,
        setOpenReportModal,
        openStandardsModal,
        setOpenStandardsModal,
      }}
    >
      {children}
    </HealthContext.Provider>
  );
};

export const useHealth = () => {
  const context = useContext(HealthContext);
  if (!context) {
    throw new Error('useHealth must be used within a HealthProvider');
  }
  return context;
};
