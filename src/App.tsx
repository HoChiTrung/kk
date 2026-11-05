/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { HealthProvider, useHealth } from './context/HealthContext';
import { LoginPage } from './components/auth/LoginPage';
import { Header } from './components/Header';
import { StudentList } from './components/trainer/StudentList';
import { StudentDetailView } from './components/trainer/StudentDetailView';
import { StudentPortal } from './components/student/StudentPortal';
import { PrintableReportModal } from './components/reports/PrintableReportModal';
import { ReferenceStandardsModal } from './components/common/ReferenceStandardsModal';
import {
  Users,
  ChevronLeft,
  LayoutDashboard,
  ShieldCheck,
  BookOpen,
} from 'lucide-react';

const MainApp: React.FC = () => {
  const {
    currentUser,
    role,
    selectedStudent,
    setSelectedStudent,
    canCreateStudent,
    setOpenStandardsModal,
  } = useHealth();

  const [trainerSubView, setTrainerSubView] = useState<'directory' | 'detail'>('detail');

  // If not authenticated, show the complete LoginPage
  if (!currentUser) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 pb-16 font-sans">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {role === 'trainer' ? (
          <div>
            {/* Trainer Sub-Navigation Breadcrumb & Quick Reference Action */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 bg-white px-4 py-3 rounded-2xl border border-slate-200/90 shadow-2xs no-print">
              <div className="flex items-center space-x-2 text-xs">
                <button
                  onClick={() => setTrainerSubView('directory')}
                  className={`font-semibold transition-colors flex items-center space-x-1 cursor-pointer ${
                    trainerSubView === 'directory'
                      ? 'text-emerald-700 font-bold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Users className="w-4 h-4 mr-1" />
                  <span>Danh Sách Học Viên</span>
                </button>

                {selectedStudent && (
                  <>
                    <span className="text-slate-300">/</span>
                    <button
                      onClick={() => setTrainerSubView('detail')}
                      className={`font-semibold transition-colors flex items-center space-x-1 cursor-pointer ${
                        trainerSubView === 'detail'
                          ? 'text-emerald-700 font-bold'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <span>Hồ sơ: {selectedStudent.fullName}</span>
                    </button>
                  </>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setOpenStandardsModal(true)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-colors cursor-pointer border border-slate-200"
                >
                  <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
                  <span>4 Bảng Chuẩn Y Tế</span>
                </button>

                {trainerSubView === 'detail' ? (
                  <button
                    onClick={() => setTrainerSubView('directory')}
                    className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center space-x-1 transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Tất Cả Học Viên</span>
                  </button>
                ) : selectedStudent ? (
                  <button
                    onClick={() => setTrainerSubView('detail')}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1 transition-colors cursor-pointer shadow-xs"
                  >
                    <span>Mở Hồ Sơ Đang Chọn</span>
                  </button>
                ) : null}
              </div>
            </div>

            {/* View Render */}
            {trainerSubView === 'directory' || !selectedStudent ? (
              <StudentList
                onSelectStudent={(student) => {
                  setSelectedStudent(student);
                  setTrainerSubView('detail');
                }}
              />
            ) : (
              <StudentDetailView student={selectedStudent} />
            )}
          </div>
        ) : (
          /* Student Portal View */
          <div>
            {selectedStudent ? (
              <StudentPortal student={selectedStudent} />
            ) : (
              <div className="py-20 text-center bg-white rounded-3xl border border-slate-200">
                <p className="text-sm font-semibold text-slate-600">
                  Đang đồng bộ hồ sơ học viên của bạn...
                </p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Printable Report Modal */}
      <PrintableReportModal />

      {/* Reference Standards Modal (From Center Charts) */}
      <ReferenceStandardsModal />
    </div>
  );
};

export default function App() {
  return (
    <HealthProvider>
      <MainApp />
    </HealthProvider>
  );
}
