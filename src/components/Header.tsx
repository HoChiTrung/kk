/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useHealth } from '../context/HealthContext';
import {
  Activity,
  User,
  Users,
  Bell,
  Printer,
  Database,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  LogOut,
  BookOpen,
  ShieldCheck,
} from 'lucide-react';

export const Header: React.FC = () => {
  const {
    currentUser,
    logout,
    role,
    students,
    selectedStudent,
    setSelectedStudent,
    notifications,
    unreadNotificationCount,
    markNotificationRead,
    dbStatus,
    setOpenReportModal,
    setOpenStandardsModal,
  } = useHealth();

  const [showNotifications, setShowNotifications] = useState(false);
  const [showStudentMenu, setShowStudentMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-600 to-cyan-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
              <Activity className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-700 bg-clip-text text-transparent">
                  FitTrack Pro
                </span>
                <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  SRS v2.4 + AI
                </span>
              </div>
              <p className="hidden sm:block text-xs text-slate-500 font-medium">
                Quản lý & Theo dõi 10 Chỉ số Sức khỏe Học viên
              </p>
            </div>
          </div>

          {/* Database Live Status & Reference Tables Action */}
          <div className="hidden lg:flex items-center space-x-3">
            <button
              onClick={() => setOpenStandardsModal(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 transition-colors border border-slate-200"
              title="Xem bảng mỡ nội tạng, chiều cao cân nặng lý tưởng, thể hình 1-9"
            >
              <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
              <span>Bảng Chuẩn Y Tế (4 Bảng)</span>
            </button>

            <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200/80 text-xs text-slate-600">
              <Database className="w-3.5 h-3.5 text-emerald-600" />
              <span className="font-medium">Aiven Cloud:</span>
              <span className="font-semibold text-slate-800">TramTap</span>
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            </div>
          </div>

          {/* Right Controls: Actions, Notifications & User Account */}
          <div className="flex items-center space-x-3">
            {/* Quick PDF Report Trigger */}
            <button
              onClick={() => setOpenReportModal(true)}
              className="hidden sm:inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200"
              title="Xuất Báo Cáo In A4 Chuẩn SRS 3.5"
            >
              <Printer className="w-3.5 h-3.5 text-slate-600" />
              <span>Báo Cáo PDF</span>
            </button>

            {/* Smart Notifications Bell */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                title="Thông báo tự động"
              >
                <Bell className="w-5 h-5" />
                {unreadNotificationCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white ring-2 ring-white">
                    {unreadNotificationCount}
                  </span>
                )}
              </button>

              {/* Notification Dropdown */}
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-sm text-slate-900">Thông báo thông minh</span>
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                        {unreadNotificationCount} mới
                      </span>
                    </div>
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                    {notifications.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-500">
                        Không có thông báo mới
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          onClick={() => markNotificationRead(n.id)}
                          className={`p-3 text-xs hover:bg-slate-50 transition-colors cursor-pointer ${
                            !n.read ? 'bg-amber-50/50' : ''
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center space-x-1.5">
                              {n.priority === 'high' ? (
                                <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                              ) : (
                                <CheckCircle2 className="w-4 h-4 text-teal-500 shrink-0" />
                              )}
                              <span className="font-bold text-slate-800">{n.title}</span>
                            </div>
                            <span className="text-[10px] text-slate-400">{n.useCaseId}</span>
                          </div>
                          <p className="mt-1 text-slate-600 leading-relaxed pl-5.5">
                            {n.message}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Trainer: Student Selector Dropdown */}
            {role === 'trainer' && (
              <div className="relative">
                <button
                  onClick={() => setShowStudentMenu(!showStudentMenu)}
                  className="flex items-center space-x-2 pl-2 pr-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors text-left"
                >
                  <img
                    src={
                      selectedStudent?.avatarUrl ||
                      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80'
                    }
                    alt={selectedStudent?.fullName}
                    className="w-7 h-7 rounded-lg object-cover ring-1 ring-slate-200"
                  />
                  <div className="hidden sm:block">
                    <div className="text-xs font-bold text-slate-800 leading-tight">
                      {selectedStudent?.fullName || 'Chọn học viên'}
                    </div>
                    <div className="text-[10px] text-emerald-700 font-semibold">Đang quản lý</div>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>

                {showStudentMenu && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50">
                    <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Chuyển đổi hồ sơ học viên
                    </div>
                    {students.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => {
                          setSelectedStudent(s);
                          setShowStudentMenu(false);
                        }}
                        className={`w-full flex items-center space-x-2.5 px-3 py-2 text-xs text-left hover:bg-slate-50 transition-colors ${
                          selectedStudent?.id === s.id ? 'bg-emerald-50/80 font-bold text-emerald-900' : 'text-slate-700'
                        }`}
                      >
                        <img
                          src={s.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80'}
                          alt={s.fullName}
                          className="w-6 h-6 rounded-md object-cover"
                        />
                        <div className="flex-1 truncate">
                          <div className="font-semibold">{s.fullName}</div>
                          <div className="text-[10px] text-slate-400">{s.phone}</div>
                        </div>
                        {selectedStudent?.id === s.id && (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* User Account & Logout Menu */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center space-x-2 p-1.5 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-slate-800 to-slate-900 text-white flex items-center justify-center font-bold text-xs ring-2 ring-emerald-500/30">
                  {currentUser?.role === 'trainer' ? 'HLV' : 'HV'}
                </div>
                <div className="hidden md:block text-left">
                  <div className="text-xs font-extrabold text-slate-900 leading-tight">
                    {currentUser?.fullName || currentUser?.username}
                  </div>
                  <div className="text-[10px] text-emerald-700 font-bold">
                    {currentUser?.username === 'trunghbl' ? 'Huấn Luyện Viên Trưởng' : 'Tài khoản Học Viên'}
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-4 py-2 border-b border-slate-100">
                    <div className="text-xs font-bold text-slate-900">{currentUser?.fullName}</div>
                    <div className="text-[11px] text-slate-400 font-mono">@{currentUser?.username}</div>
                    <span className="mt-1 inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      {currentUser?.role === 'trainer' ? 'Role: Huấn Luyện Viên' : 'Role: Học Viên'}
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      setOpenStandardsModal(true);
                    }}
                    className="w-full flex items-center space-x-2 px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <BookOpen className="w-4 h-4 text-emerald-600" />
                    <span>Tra Cứu Bảng Chuẩn Y Tế</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      logout();
                    }}
                    className="w-full flex items-center space-x-2 px-4 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Đăng Xuất Khỏi Hệ Thống</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
