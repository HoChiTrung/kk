/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useHealth } from '../../context/HealthContext';
import {
  Activity,
  Lock,
  User,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  AlertCircle,
  Database,
  CheckCircle2,
} from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login, dbStatus } = useHealth();
  const [username, setUsername] = useState('trunghbl');
  const [password, setPassword] = useState('123');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    const res = await login(username, password);
    setLoading(false);
    if (!res.success) {
      setErrorMsg(res.error || 'Tên đăng nhập hoặc mật khẩu không đúng!');
    }
  };

  const fillCredentials = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    setErrorMsg('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 flex items-center justify-center p-4 sm:p-6 font-sans">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-8 sm:p-10 border border-slate-100 relative overflow-hidden">
        {/* Subtle decorative gradient glow */}
        <div className="absolute -top-12 -right-12 w-40 h-40 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none"></div>

        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 via-teal-600 to-cyan-500 text-white flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/25 mb-4">
            <Activity className="w-8 h-8 stroke-[2.5]" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            FitTrack Pro
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Hệ thống Quản lý & Phân tích 10 Chỉ số Sức khỏe Sinh học
          </p>

          <div className="mt-3 inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <Database className="w-3.5 h-3.5 text-emerald-600" />
            <span>Kết nối Aiven Cloud: TramTap</span>
          </div>
        </div>

        {/* Error Notification */}
        {errorMsg && (
          <div className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center space-x-2 animate-in fade-in duration-150">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Tên đăng nhập (Username)
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Nhập tên đăng nhập (ví dụ: trunghbl)"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-hidden font-medium text-slate-900 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Mật khẩu (Password)
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-hidden font-medium text-slate-900 transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl font-bold text-sm shadow-md shadow-emerald-600/25 transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
          >
            <span>{loading ? 'Đang xác thực...' : 'Đăng Nhập Vào Hệ Thống'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Quick Demo Access Pills */}
        <div className="mt-8 pt-6 border-t border-slate-100">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3 text-center">
            Tài khoản thử nghiệm nhanh
          </div>

          <div className="space-y-2 text-xs">
            {/* Trainer trunghbl */}
            <div
              onClick={() => fillCredentials('trunghbl', '123')}
              className="p-2.5 rounded-xl border border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100/70 transition-colors cursor-pointer flex items-center justify-between"
            >
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-emerald-700" />
                <div>
                  <span className="font-bold text-emerald-950">HLV: trunghbl</span>
                  <span className="text-[10px] text-emerald-700 ml-1.5">(Quyền tạo học viên)</span>
                </div>
              </div>
              <span className="text-[11px] font-mono bg-white px-2 py-0.5 rounded text-emerald-800 font-semibold border border-emerald-200">
                pass: 123
              </span>
            </div>

            {/* Student 1 */}
            <div
              onClick={() => fillCredentials('hoanglong', '123')}
              className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer flex items-center justify-between"
            >
              <div className="flex items-center space-x-2">
                <User className="w-4 h-4 text-slate-500" />
                <div>
                  <span className="font-bold text-slate-800">Học viên: hoanglong</span>
                  <span className="text-[10px] text-slate-500 ml-1.5">(Nguyễn Hoàng Long)</span>
                </div>
              </div>
              <span className="text-[11px] font-mono bg-white px-2 py-0.5 rounded text-slate-600 font-semibold border border-slate-200">
                pass: 123
              </span>
            </div>

            {/* Student 2 */}
            <div
              onClick={() => fillCredentials('thuha', '123')}
              className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer flex items-center justify-between"
            >
              <div className="flex items-center space-x-2">
                <User className="w-4 h-4 text-slate-500" />
                <div>
                  <span className="font-bold text-slate-800">Học viên: thuha</span>
                  <span className="text-[10px] text-slate-500 ml-1.5">(Trần Thị Thu Hà)</span>
                </div>
              </div>
              <span className="text-[11px] font-mono bg-white px-2 py-0.5 rounded text-slate-600 font-semibold border border-slate-200">
                pass: 123
              </span>
            </div>
          </div>
        </div>

        {/* Security Rule Note */}
        <div className="mt-5 text-center text-[11px] text-slate-400">
          Chỉ tài khoản <strong className="text-slate-600">trunghbl</strong> mới có thẩm quyền khởi tạo tài khoản và hồ sơ mới cho học viên.
        </div>
      </div>
    </div>
  );
};
