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

  const [dbStatus, setDbStatus] = useState<{ connected: boolean; name: string }>({
    connected: true,
    name: 'Aiven TramTap (PostgreSQL)',
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

  // Sync to API on Mount
  useEffect(() => {
    async function loadData() {
      try {
        const [resHealth, resS, resM, resA, resMeals, resW, resP, resN] = await Promise.allSettled([
          fetch('/api/health').then((r) => r.json()),
          fetch('/api/students').then((r) => r.json()),
          fetch('/api/metrics').then((r) => r.json()),
          fetch('/api/advices').then((r) => r.json()),
          fetch('/api/meals').then((r) => r.json()),
          fetch('/api/workouts').then((r) => r.json()),
          fetch('/api/photos').then((r) => r.json()),
          fetch('/api/notifications').then((r) => r.json()),
        ]);

        if (resHealth.status === 'fulfilled' && resHealth.value) {
          setDbStatus({
            connected: resHealth.value.databaseConnected ?? true,
            name: `${resHealth.value.databaseName || 'TramTap'} (PostgreSQL)`,
          });
        }
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

  // Login handler
  const login = async (username: string, pass: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password: pass }),
      });
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
    } catch (err: any) {
      // In-memory fallback if network offline
      if (username.trim().toLowerCase() === 'trunghbl' && pass === '123') {
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
      return { success: false, error: 'Không thể kết nối đến máy chủ đăng nhập' };
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

    try {
      await fetch(`/api/students/${student.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(student),
      });
    } catch (err) {
      console.warn('Could not update student on remote DB', err);
    }
  };

  const updateStudentDriveFolder = async (studentId: string, driveFolderUrl: string) => {
    const updated = students.map((s) => (s.id === studentId ? { ...s, driveFolderUrl } : s));
    setStudents(updated);
    if (selectedStudent?.id === studentId) {
      setSelectedStudent({ ...selectedStudent, driveFolderUrl });
    }
    localStorage.setItem('fit_students', JSON.stringify(updated));

    try {
      await fetch(`/api/students/${studentId}/drive-folder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driveFolderUrl }),
      });
    } catch (err) {
      console.warn('Could not update student drive folder URL', err);
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

    try {
      await fetch(`/api/students/${id}`, { method: 'DELETE' });
    } catch (err) {
      console.warn('Could not delete student on remote DB', err);
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
    try {
      await fetch('/api/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRecord),
      });
    } catch (err) {
      console.warn('Could not save metric to remote DB', err);
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

      try {
        await fetch('/api/advices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newAdvice),
        });
      } catch (err) {
        console.warn('Could not save advice to remote DB', err);
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

    try {
      await fetch(`/api/metrics/${id}`, { method: 'DELETE' });
    } catch (err) {
      console.warn('Could not delete metric from remote DB', err);
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

    try {
      await fetch('/api/meals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMeal),
      });
    } catch (err) {
      console.warn('Could not save meal to remote DB', err);
    }
  };

  // Add Meal Trainer Feedback
  const addMealFeedback = async (id: string, reaction: '🔥' | '💪' | '👏' | '❤️', comment?: string) => {
    const updated = meals.map((m) => (m.id === id ? { ...m, trainerReaction: reaction, trainerComment: comment } : m));
    setMeals(updated);
    localStorage.setItem('fit_meals', JSON.stringify(updated));

    try {
      await fetch(`/api/meals/${id}/feedback`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reaction, comment }),
      });
    } catch (err) {
      console.warn('Could not save meal feedback', err);
    }
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
    const res = await fetch('/api/ai/analyze-meal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    const rawText = await res.text();
    let data: any = null;
    try {
      data = JSON.parse(rawText);
    } catch {
      throw new Error('Máy chủ đang khởi động hoặc bận xử lý, vui lòng bấm chọn lại ảnh sau 2 giây.');
    }

    if (!res.ok) {
      throw new Error(data?.error || 'Lỗi khi phân tích bữa ăn qua AI');
    }
    return data.analysis;
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

    try {
      await fetch('/api/workouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newWorkout),
      });
    } catch (err) {
      console.warn('Could not save workout to remote DB', err);
    }
  };

  // Add Workout Feedback
  const addWorkoutFeedback = async (id: string, reaction: '🔥' | '💪' | '👏' | '❤️', comment?: string) => {
    const updated = workouts.map((w) => (w.id === id ? { ...w, trainerReaction: reaction, trainerComment: comment } : w));
    setWorkouts(updated);
    localStorage.setItem('fit_workouts', JSON.stringify(updated));

    try {
      await fetch(`/api/workouts/${id}/feedback`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reaction, comment }),
      });
    } catch (err) {
      console.warn('Could not save workout feedback', err);
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

    try {
      await fetch('/api/photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPhoto),
      });
    } catch (err) {
      console.warn('Could not save photo to remote DB', err);
    }
  };

  // Mark notification read
  const markNotificationRead = async (id: string) => {
    const updated = notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
    setNotifications(updated);
    localStorage.setItem('fit_notifications', JSON.stringify(updated));

    try {
      await fetch(`/api/notifications/${id}/read`, { method: 'PUT' });
    } catch (err) {
      console.warn('Could not mark notification read', err);
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
