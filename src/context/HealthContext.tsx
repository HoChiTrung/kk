/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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
} from '../utils/healthCalculations';
import { analyzeFoodImageVisuals } from '../utils/mealVisionAnalyzer';
import { getAccessToken, initAuth } from '../services/googleDriveAuth';
import {
  saveCloudDatabaseToDrive,
  loadCloudDatabaseFromDrive,
} from '../services/googleDriveService';

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
  addStudent: (
    student: Omit<StudentProfile, 'id' | 'createdAt'> & {
      initialUsername?: string;
      initialPassword?: string;
    }
  ) => Promise<StudentProfile>;
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

function getDeletedIds(storageKey: string): Set<string> {
  try {
    const raw = localStorage.getItem(storageKey);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function addDeletedId(storageKey: string, id: string) {
  try {
    const set = getDeletedIds(storageKey);
    set.add(id);
    localStorage.setItem(storageKey, JSON.stringify(Array.from(set)));
  } catch {
    // Ignore storage error
  }
}

function mergeById<T extends { id: string }>(
  localItems: T[],
  remoteOrSeedItems: T[],
  deletedIds: Set<string> = new Set()
): T[] {
  const map = new Map<string, T>();
  // First add local items so user edits/additions take priority
  for (const item of localItems) {
    if (item && item.id && !deletedIds.has(item.id)) {
      map.set(item.id, item);
    }
  }
  // Then add remote/seed items that aren't already in local or deleted
  for (const item of remoteOrSeedItems) {
    if (item && item.id && !deletedIds.has(item.id) && !map.has(item.id)) {
      map.set(item.id, item);
    }
  }
  return Array.from(map.values());
}

export const HealthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Current logged in user (null = show Login Page)
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => {
    try {
      const saved = localStorage.getItem('fit_auth_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [role, setRole] = useState<UserRole>(currentUser?.role || 'trainer');

  const [students, setStudents] = useState<StudentProfile[]>(() => {
    try {
      const deleted = getDeletedIds('fit_deleted_students');
      const saved = localStorage.getItem('fit_students');
      const parsed: StudentProfile[] = saved ? JSON.parse(saved) : [];
      const merged = mergeById(parsed, SEED_STUDENTS, deleted);
      localStorage.setItem('fit_students', JSON.stringify(merged));
      return merged;
    } catch {
      return SEED_STUDENTS;
    }
  });

  const [selectedStudent, setSelectedStudent] = useState<StudentProfile | null>(() => {
    try {
      const savedId = localStorage.getItem('fit_selected_student_id');
      const savedList = localStorage.getItem('fit_students');
      const pool: StudentProfile[] = savedList ? JSON.parse(savedList) : SEED_STUDENTS;
      return pool.find((s) => s.id === savedId) || pool[0] || SEED_STUDENTS[0];
    } catch {
      return SEED_STUDENTS[0];
    }
  });

  const [metrics, setMetrics] = useState<HealthMetricRecord[]>(() => {
    try {
      const deleted = getDeletedIds('fit_deleted_metrics');
      const saved = localStorage.getItem('fit_metrics');
      const parsed: HealthMetricRecord[] = saved ? JSON.parse(saved) : [];
      const merged = mergeById(parsed, SEED_METRICS, deleted);
      localStorage.setItem('fit_metrics', JSON.stringify(merged));
      return merged;
    } catch {
      return SEED_METRICS;
    }
  });

  const [advices, setAdvices] = useState<AIAdviceRecord[]>(() => {
    try {
      const saved = localStorage.getItem('fit_advices');
      const parsed: AIAdviceRecord[] = saved ? JSON.parse(saved) : [];
      return mergeById(parsed, SEED_ADVICES);
    } catch {
      return SEED_ADVICES;
    }
  });

  const [meals, setMeals] = useState<MealLog[]>(() => {
    try {
      const saved = localStorage.getItem('fit_meals');
      const parsed: MealLog[] = saved ? JSON.parse(saved) : [];
      // Filter out any old broken test meal logs
      const cleanParsed = parsed.filter(
        (m) =>
          m.id !== 'meal-1793863958272' &&
          m.id !== 'meal-1793863416052' &&
          !m.nutritionAdvice?.includes('Hãy chọn nhanh món ăn bên dưới')
      );
      return mergeById(cleanParsed, SEED_MEALS);
    } catch {
      return SEED_MEALS;
    }
  });

  const [workouts, setWorkouts] = useState<WorkoutLog[]>(() => {
    try {
      const saved = localStorage.getItem('fit_workouts');
      const parsed: WorkoutLog[] = saved ? JSON.parse(saved) : [];
      return mergeById(parsed, SEED_WORKOUTS);
    } catch {
      return SEED_WORKOUTS;
    }
  });

  const [photos, setPhotos] = useState<PhysiquePhoto[]>(() => {
    try {
      const saved = localStorage.getItem('fit_photos');
      const parsed: PhysiquePhoto[] = saved ? JSON.parse(saved) : [];
      return mergeById(parsed, SEED_PHOTOS);
    } catch {
      return SEED_PHOTOS;
    }
  });

  const [badges] = useState<Badge[]>(() => {
    try {
      const saved = localStorage.getItem('fit_badges');
      return saved ? JSON.parse(saved) : SEED_BADGES;
    } catch {
      return SEED_BADGES;
    }
  });

  const [notifications, setNotifications] = useState<SmartNotification[]>(() => {
    try {
      const saved = localStorage.getItem('fit_notifications');
      return saved ? JSON.parse(saved) : SEED_NOTIFICATIONS;
    } catch {
      return SEED_NOTIFICATIONS;
    }
  });

  const isGitHubPages =
    typeof window !== 'undefined' && window.location.hostname.endsWith('github.io');

  const [apiAvailable, setApiAvailable] = useState<boolean>(!isGitHubPages);

  const [dbStatus, setDbStatus] = useState<{ connected: boolean; name: string }>({
    connected: true,
    name: isGitHubPages ? 'Cloud & Local DB (GitHub Pages)' : 'Aiven TramTap (PostgreSQL)',
  });

  const [openReportModal, setOpenReportModal] = useState(false);
  const [openStandardsModal, setOpenStandardsModal] = useState(false);

  // Helper to push current database snapshot to Google Drive when token is active
  const syncSnapshotToDrive = useCallback(
    async (overrideData?: {
      students?: StudentProfile[];
      metrics?: HealthMetricRecord[];
      advices?: AIAdviceRecord[];
      meals?: MealLog[];
      workouts?: WorkoutLog[];
      photos?: PhysiquePhoto[];
    }) => {
      try {
        const token = await getAccessToken();
        if (!token) return;
        const customUsers = JSON.parse(localStorage.getItem('fit_custom_users') || '[]');
        await saveCloudDatabaseToDrive(token, {
          students: overrideData?.students || students,
          customUsers,
          metrics: overrideData?.metrics || metrics,
          advices: overrideData?.advices || advices,
          meals: overrideData?.meals || meals,
          workouts: overrideData?.workouts || workouts,
          photos: overrideData?.photos || photos,
        });
      } catch {
        // Ignore background cloud sync error
      }
    },
    [students, metrics, advices, meals, workouts, photos]
  );

  // Listen for Google Drive auth token to pull & merge cloud database on GitHub Pages / multi-device
  useEffect(() => {
    const unsubscribe = initAuth(async (_user, token) => {
      if (!token) return;
      try {
        const cloudDb = await loadCloudDatabaseFromDrive(token);
        if (cloudDb) {
          const deletedStudents = getDeletedIds('fit_deleted_students');
          const deletedMetrics = getDeletedIds('fit_deleted_metrics');

          if (Array.isArray(cloudDb.students) && cloudDb.students.length > 0) {
            setStudents((prev) => {
              const merged = mergeById(prev, cloudDb.students, deletedStudents);
              localStorage.setItem('fit_students', JSON.stringify(merged));
              return merged;
            });
          }
          if (Array.isArray(cloudDb.customUsers) && cloudDb.customUsers.length > 0) {
            const localCustom = JSON.parse(localStorage.getItem('fit_custom_users') || '[]');
            const map = new Map<string, any>();
            for (const u of [...localCustom, ...cloudDb.customUsers]) {
              if (u && u.username) map.set(u.username.toLowerCase(), u);
            }
            localStorage.setItem('fit_custom_users', JSON.stringify(Array.from(map.values())));
          }
          if (Array.isArray(cloudDb.metrics) && cloudDb.metrics.length > 0) {
            setMetrics((prev) => {
              const merged = mergeById(prev, cloudDb.metrics, deletedMetrics);
              localStorage.setItem('fit_metrics', JSON.stringify(merged));
              return merged;
            });
          }
          if (Array.isArray(cloudDb.advices) && cloudDb.advices.length > 0) {
            setAdvices((prev) => {
              const merged = mergeById(prev, cloudDb.advices);
              localStorage.setItem('fit_advices', JSON.stringify(merged));
              return merged;
            });
          }
          if (Array.isArray(cloudDb.meals) && cloudDb.meals.length > 0) {
            setMeals((prev) => {
              const merged = mergeById(prev, cloudDb.meals);
              localStorage.setItem('fit_meals', JSON.stringify(merged));
              return merged;
            });
          }
        }
      } catch {
        // Ignore cloud pull error
      }
    });
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

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

        const deletedStudents = getDeletedIds('fit_deleted_students');
        const deletedMetrics = getDeletedIds('fit_deleted_metrics');

        if (resS.status === 'fulfilled' && Array.isArray(resS.value) && resS.value.length > 0) {
          const remoteStudents: StudentProfile[] = resS.value;
          const remoteIds = new Set(remoteStudents.map((s) => s.id));

          setStudents((prevLocal) => {
            // Push any locally created students that aren't in remote DB yet
            for (const localStd of prevLocal) {
              if (!remoteIds.has(localStd.id) && !deletedStudents.has(localStd.id)) {
                fetch('/api/students', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'x-auth-username': 'trunghbl',
                  },
                  body: JSON.stringify({
                    ...localStd,
                    _requestedBy: 'trunghbl',
                  }),
                }).catch(() => null);
              }
            }

            const merged = mergeById(prevLocal, remoteStudents, deletedStudents);
            localStorage.setItem('fit_students', JSON.stringify(merged));
            return merged;
          });
        }
        if (resM.status === 'fulfilled' && Array.isArray(resM.value)) {
          setMetrics((prev) => {
            const merged = mergeById(prev, resM.value, deletedMetrics);
            localStorage.setItem('fit_metrics', JSON.stringify(merged));
            return merged;
          });
        }
        if (resA.status === 'fulfilled' && Array.isArray(resA.value)) {
          setAdvices((prev) => {
            const merged = mergeById(prev, resA.value);
            localStorage.setItem('fit_advices', JSON.stringify(merged));
            return merged;
          });
        }
        if (resMeals.status === 'fulfilled' && Array.isArray(resMeals.value)) {
          const cleanRemoteMeals = resMeals.value.filter(
            (m: MealLog) =>
              m.id !== 'meal-1793863958272' &&
              m.id !== 'meal-1793863416052' &&
              !m.nutritionAdvice?.includes('Hãy chọn nhanh món ăn bên dưới')
          );
          setMeals((prev) => {
            const merged = mergeById(prev, cleanRemoteMeals);
            localStorage.setItem('fit_meals', JSON.stringify(merged));
            return merged;
          });
        }
        if (resW.status === 'fulfilled' && Array.isArray(resW.value)) {
          setWorkouts((prev) => {
            const merged = mergeById(prev, resW.value);
            localStorage.setItem('fit_workouts', JSON.stringify(merged));
            return merged;
          });
        }
        if (resP.status === 'fulfilled' && Array.isArray(resP.value)) {
          setPhotos((prev) => {
            const merged = mergeById(prev, resP.value);
            localStorage.setItem('fit_photos', JSON.stringify(merged));
            return merged;
          });
        }
        if (resN.status === 'fulfilled' && Array.isArray(resN.value)) {
          setNotifications((prev) => {
            const merged = mergeById(prev, resN.value);
            localStorage.setItem('fit_notifications', JSON.stringify(merged));
            return merged;
          });
        }
      } catch (err) {
        setApiAvailable(false);
        console.warn('API sync warning, using persisted client store', err);
      }
    }

    loadData();
  }, [isGitHubPages]);

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
      { key: 'trungne', name: 'Trung nè', studentId: 'student-1793860586776' },
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
    const matchedByPhone = students.find((s) => s.phone.replace(/\s+/g, '') === cleanUser);
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
    // First check local custom accounts so newly added students always log in immediately
    const localCheck = authenticateLocally(username, pass);
    if (localCheck.success) {
      return localCheck;
    }

    if (!apiAvailable || isGitHubPages) {
      return localCheck;
    }

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password: pass }),
      });
      if (res.status === 404 || res.status === 405) {
        setApiAvailable(false);
        return localCheck;
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
      return localCheck;
    }
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('fit_auth_user');
  };

  // Permission: Trainer / trunghbl can create students
  const isTrainer = currentUser?.role === 'trainer';
  const canCreateStudent =
    currentUser?.role === 'trainer' || currentUser?.username?.toLowerCase() === 'trunghbl';

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

  // Add Student - Persists immediately to localStorage, remote PostgreSQL, and Google Drive Cloud DB
  const addStudent = async (
    studentData: Omit<StudentProfile, 'id' | 'createdAt'> & {
      initialUsername?: string;
      initialPassword?: string;
    }
  ) => {
    const newStudent: StudentProfile = {
      fullName: studentData.fullName.trim(),
      gender: studentData.gender,
      age: Number(studentData.age) || 25,
      height: Number(studentData.height) || 1.7,
      phone: studentData.phone.trim(),
      address: studentData.address?.trim() || '',
      dateOfBirth: studentData.dateOfBirth || '2000-01-01',
      healthGoal:
        studentData.healthGoal?.trim() || 'Cân đối vóc dáng & Cải thiện sức khỏe toàn diện',
      targetMetrics: studentData.targetMetrics || {},
      avatarUrl:
        studentData.avatarUrl ||
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
      id: `student-${Date.now()}`,
      createdAt: new Date().toISOString().split('T')[0],
    };

    let updatedList: StudentProfile[] = [];
    setStudents((prev) => {
      updatedList = [newStudent, ...prev.filter((s) => s.id !== newStudent.id)];
      localStorage.setItem('fit_students', JSON.stringify(updatedList));
      return updatedList;
    });
    setSelectedStudent(newStudent);

    // Persist student login credentials locally
    try {
      const customAccounts = JSON.parse(localStorage.getItem('fit_custom_users') || '[]');
      const usernameToSave = (
        studentData.initialUsername ||
        studentData.phone ||
        newStudent.id
      ).trim();
      const passwordToSave = (studentData.initialPassword || '123').trim();
      const filteredAccounts = customAccounts.filter(
        (u: any) => u.username?.toLowerCase() !== usernameToSave.toLowerCase()
      );
      filteredAccounts.push({
        username: usernameToSave,
        password: passwordToSave,
        fullName: newStudent.fullName,
        studentId: newStudent.id,
        avatarUrl: newStudent.avatarUrl,
      });
      localStorage.setItem('fit_custom_users', JSON.stringify(filteredAccounts));
    } catch {
      // Ignore storage error
    }

    // Sync to Google Drive Cloud DB if connected
    syncSnapshotToDrive({ students: updatedList });

    if (!isGitHubPages) {
      try {
        const res = await fetch('/api/students', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-auth-username': currentUser?.username || 'trunghbl',
          },
          body: JSON.stringify({
            ...newStudent,
            _requestedBy: currentUser?.username || 'trunghbl',
            initialUsername: studentData.initialUsername || studentData.phone,
            initialPassword: studentData.initialPassword || '123',
          }),
        });
        if (res.ok) {
          setApiAvailable(true);
        }
      } catch (err) {
        console.warn('Could not save student to remote DB (persisted in local & cloud storage)', err);
      }
    }
    return newStudent;
  };

  // Update Student
  const updateStudent = async (student: StudentProfile) => {
    let updatedList: StudentProfile[] = [];
    setStudents((prev) => {
      updatedList = prev.map((s) => (s.id === student.id ? student : s));
      localStorage.setItem('fit_students', JSON.stringify(updatedList));
      return updatedList;
    });
    if (selectedStudent?.id === student.id) {
      setSelectedStudent(student);
    }

    syncSnapshotToDrive({ students: updatedList });

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
    let updatedList: StudentProfile[] = [];
    setStudents((prev) => {
      updatedList = prev.map((s) => (s.id === studentId ? { ...s, driveFolderUrl } : s));
      localStorage.setItem('fit_students', JSON.stringify(updatedList));
      return updatedList;
    });
    if (selectedStudent?.id === studentId) {
      setSelectedStudent((prev) => (prev ? { ...prev, driveFolderUrl } : null));
    }

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
    addDeletedId('fit_deleted_students', id);
    let updatedList: StudentProfile[] = [];
    setStudents((prev) => {
      updatedList = prev.filter((s) => s.id !== id);
      localStorage.setItem('fit_students', JSON.stringify(updatedList));
      return updatedList;
    });
    if (selectedStudent?.id === id) {
      setSelectedStudent(updatedList[0] || null);
    }

    syncSnapshotToDrive({ students: updatedList });

    if (apiAvailable && !isGitHubPages) {
      try {
        await fetch(`/api/students/${id}`, { method: 'DELETE' });
      } catch (err) {
        console.warn('Could not delete student on remote DB', err);
      }
    }
  };

  // Add Metric Record (10 indicators) + INSTANT AI ADVICE
  const addMetricRecord = async (recordData: Omit<HealthMetricRecord, 'id' | 'timestamp'>) => {
    const timestamp = new Date(recordData.date).getTime() || Date.now();
    const newRecord: HealthMetricRecord = {
      ...recordData,
      id: `metric-${Date.now()}`,
      timestamp,
    };

    const studentHistory = getStudentMetrics(recordData.studentId);
    const previousRecord = studentHistory[studentHistory.length - 1];

    let updatedMetrics: HealthMetricRecord[] = [];
    setMetrics((prev) => {
      updatedMetrics = [...prev, newRecord].sort((a, b) => a.timestamp - b.timestamp);
      localStorage.setItem('fit_metrics', JSON.stringify(updatedMetrics));
      return updatedMetrics;
    });

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

    // Auto-generate INSTANT AI Advice
    const targetStudent = students.find((s) => s.id === recordData.studentId);
    if (targetStudent) {
      const adviceContent = generateInstantAIAdvice(targetStudent, newRecord, previousRecord);
      const newAdvice: AIAdviceRecord = {
        id: `advice-${Date.now()}`,
        studentId: recordData.studentId,
        metricRecordId: newRecord.id,
        date: recordData.date,
        status: 'auto_generated',
        aiDraftContent: adviceContent,
        trainerEditedContent: adviceContent.summary,
        approvedAt: new Date().toLocaleString('vi-VN'),
      };

      let updatedAdvices: AIAdviceRecord[] = [];
      setAdvices((prev) => {
        updatedAdvices = [newAdvice, ...prev];
        localStorage.setItem('fit_advices', JSON.stringify(updatedAdvices));
        return updatedAdvices;
      });

      syncSnapshotToDrive({ metrics: updatedMetrics, advices: updatedAdvices });

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
    } else {
      syncSnapshotToDrive({ metrics: updatedMetrics });
    }
  };

  // Delete Metric Record
  const deleteMetricRecord = async (id: string) => {
    addDeletedId('fit_deleted_metrics', id);
    let updatedMetrics: HealthMetricRecord[] = [];
    setMetrics((prev) => {
      updatedMetrics = prev.filter((m) => m.id !== id);
      localStorage.setItem('fit_metrics', JSON.stringify(updatedMetrics));
      return updatedMetrics;
    });

    syncSnapshotToDrive({ metrics: updatedMetrics });

    if (apiAvailable && !isGitHubPages) {
      try {
        await fetch(`/api/metrics/${id}`, { method: 'DELETE' });
      } catch (err) {
        console.warn('Could not delete metric from remote DB', err);
      }
    }
  };

  // Add Meal Log
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

    let updatedMeals: MealLog[] = [];
    setMeals((prev) => {
      updatedMeals = [newMeal, ...prev];
      localStorage.setItem('fit_meals', JSON.stringify(updatedMeals));
      return updatedMeals;
    });

    syncSnapshotToDrive({ meals: updatedMeals });

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
    let updatedMeals: MealLog[] = [];
    setMeals((prev) => {
      updatedMeals = prev.map((m) =>
        m.id === id ? { ...m, trainerReaction: reaction, trainerComment: comment } : m
      );
      localStorage.setItem('fit_meals', JSON.stringify(updatedMeals));
      return updatedMeals;
    });

    syncSnapshotToDrive({ meals: updatedMeals });

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

  // AI Meal Photo Recognition Service (Server Gemini API + Real Client Computer Vision Pixel Analyzer)
  const analyzeMealPhoto = async (params: {
    imageBase64: string;
    mimeType?: string;
    studentGoal?: string;
    mealType?: string;
    studentName?: string;
    dishHint?: string;
    fileName?: string;
  }) => {
    // Always compute client-side visual pixel analysis on the actual image so if running on GitHub Pages
    // or if the server falls back, we have exact canvas-based visual analysis of the food photo
    const visualAnalysisPromise = analyzeFoodImageVisuals(params.imageBase64, {
      mealType: params.mealType,
      studentGoal: params.studentGoal,
      fileName: params.fileName,
    });

    if (!apiAvailable || isGitHubPages) {
      return await visualAnalysisPromise;
    }

    try {
      const res = await fetch('/api/ai/analyze-meal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      if (res.status === 404 || res.status === 405) {
        setApiAvailable(false);
        return await visualAnalysisPromise;
      }

      const rawText = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(rawText);
      } catch {
        return await visualAnalysisPromise;
      }

      if (!res.ok || !data?.analysis) {
        return await visualAnalysisPromise;
      }

      // If the server used its non-canvas byte fallback (because GEMINI_API_KEY wasn't set in env),
      // prefer the browser's true HTML5 Canvas pixel vision analysis!
      return await visualAnalysisPromise.then((canvasResult) => {
        if (data.analysis && data.analysis.geminiModelUsed) {
          return data.analysis;
        }
        return canvasResult || data.analysis;
      });
    } catch {
      return await visualAnalysisPromise;
    }
  };

  // Add Workout Log
  const addWorkoutLog = async (workoutData: Omit<WorkoutLog, 'id' | 'loggedAt'>) => {
    const newWorkout: WorkoutLog = {
      ...workoutData,
      id: `workout-${Date.now()}`,
      loggedAt: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    };

    let updatedWorkouts: WorkoutLog[] = [];
    setWorkouts((prev) => {
      updatedWorkouts = [newWorkout, ...prev];
      localStorage.setItem('fit_workouts', JSON.stringify(updatedWorkouts));
      return updatedWorkouts;
    });

    syncSnapshotToDrive({ workouts: updatedWorkouts });

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
  const addWorkoutFeedback = async (
    id: string,
    reaction: '🔥' | '💪' | '👏' | '❤️',
    comment?: string
  ) => {
    let updatedWorkouts: WorkoutLog[] = [];
    setWorkouts((prev) => {
      updatedWorkouts = prev.map((w) =>
        w.id === id ? { ...w, trainerReaction: reaction, trainerComment: comment } : w
      );
      localStorage.setItem('fit_workouts', JSON.stringify(updatedWorkouts));
      return updatedWorkouts;
    });

    syncSnapshotToDrive({ workouts: updatedWorkouts });

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
    let updatedPhotos: PhysiquePhoto[] = [];
    setPhotos((prev) => {
      updatedPhotos = [...prev, newPhoto];
      localStorage.setItem('fit_photos', JSON.stringify(updatedPhotos));
      return updatedPhotos;
    });

    syncSnapshotToDrive({ photos: updatedPhotos });

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
    setNotifications((prev) => {
      const updated = prev.map((n) => (n.id === id ? { ...n, read: true } : n));
      localStorage.setItem('fit_notifications', JSON.stringify(updated));
      return updated;
    });

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
