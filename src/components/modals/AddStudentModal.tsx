/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { StudentProfile, Gender } from '../../types/health';
import { useHealth } from '../../context/HealthContext';
import { X, UserPlus, Sparkles, Target, Phone, MapPin, Calendar } from 'lucide-react';

interface AddStudentModalProps {
  initialStudent?: StudentProfile;
  onClose: () => void;
}

export const AddStudentModal: React.FC<AddStudentModalProps> = ({
  initialStudent,
  onClose,
}) => {
  const { addStudent, updateStudent } = useHealth();

  const [fullName, setFullName] = useState(initialStudent?.fullName || '');
  const [gender, setGender] = useState<Gender>(initialStudent?.gender || 'Nam');
  const [age, setAge] = useState(initialStudent ? String(initialStudent.age) : '25');
  const [height, setHeight] = useState(initialStudent ? String(initialStudent.height) : '1.70');
  const [phone, setPhone] = useState(initialStudent?.phone || '');
  const [address, setAddress] = useState(initialStudent?.address || '');
  const [dateOfBirth, setDateOfBirth] = useState(initialStudent?.dateOfBirth || '2000-01-01');
  const [healthGoal, setHealthGoal] = useState(initialStudent?.healthGoal || '');
  const [avatarUrl, setAvatarUrl] = useState(
    initialStudent?.avatarUrl ||
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80'
  );

  // Targets
  const [targetWeight, setTargetWeight] = useState(
    initialStudent?.targetMetrics?.targetWeight ? String(initialStudent.targetMetrics.targetWeight) : ''
  );
  const [targetVisceralFat, setTargetVisceralFat] = useState(
    initialStudent?.targetMetrics?.targetVisceralFat !== undefined
      ? String(initialStudent.targetMetrics.targetVisceralFat)
      : ''
  );
  const [targetMuscleMass, setTargetMuscleMass] = useState(
    initialStudent?.targetMetrics?.targetMuscleMass ? String(initialStudent.targetMetrics.targetMuscleMass) : ''
  );
  const [targetWaist, setTargetWaist] = useState(
    initialStudent?.targetMetrics?.targetWaist ? String(initialStudent.targetMetrics.targetWaist) : ''
  );

  // Login Credentials for the Student
  const [initialUsername, setInitialUsername] = useState('');
  const [initialPassword, setInitialPassword] = useState('123');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validatePhone = (p: string) => {
    const cleaned = p.replace(/[\s.-]+/g, '');
    return cleaned.length >= 6 && cleaned.length <= 15;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!fullName.trim() || fullName.length > 100) {
      newErrors.fullName = 'Họ và tên tối đa 100 ký tự và không được để trống';
    }

    const ageNum = parseInt(age, 10);
    if (isNaN(ageNum) || ageNum < 1 || ageNum > 120) {
      newErrors.age = 'Tuổi phải từ 1 đến 120';
    }

    const heightNum = parseFloat(height.replace(',', '.'));
    if (isNaN(heightNum) || heightNum < 0.5 || heightNum > 2.5) {
      newErrors.height = 'Chiều cao phải từ 0.50m đến 2.50m (Ví dụ: 1.70)';
    }

    if (!validatePhone(phone)) {
      newErrors.phone = 'Vui lòng nhập số điện thoại hợp lệ (từ 6 đến 15 số)';
    }

    const finalGoal =
      healthGoal.trim() || 'Cân đối vóc dáng, giảm mỡ nội tạng và cải thiện sức khỏe toàn diện';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const targetMetrics = {
      targetWeight: targetWeight ? parseFloat(targetWeight) : undefined,
      targetVisceralFat: targetVisceralFat ? parseInt(targetVisceralFat, 10) : undefined,
      targetMuscleMass: targetMuscleMass ? parseFloat(targetMuscleMass) : undefined,
      targetWaist: targetWaist ? parseFloat(targetWaist) : undefined,
    };

    try {
      setIsSubmitting(true);
      if (initialStudent) {
        await updateStudent({
          ...initialStudent,
          fullName: fullName.trim(),
          gender,
          age: ageNum,
          height: heightNum,
          phone: phone.trim(),
          address: address.trim(),
          dateOfBirth: dateOfBirth || '2000-01-01',
          healthGoal: finalGoal,
          targetMetrics,
          avatarUrl,
        });
      } else {
        await addStudent({
          fullName: fullName.trim(),
          gender,
          age: ageNum,
          height: heightNum,
          phone: phone.trim(),
          address: address.trim(),
          dateOfBirth: dateOfBirth || '2000-01-01',
          healthGoal: finalGoal,
          targetMetrics,
          avatarUrl,
          initialUsername: initialUsername.trim() || phone.trim(),
          initialPassword: initialPassword.trim() || '123',
        });
      }
      onClose();
    } catch (err: any) {
      setErrors({ submit: err?.message || 'Không thể lưu học viên. Vui lòng thử lại.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-6 my-8 animate-in fade-in zoom-in-95 duration-150 border border-slate-100">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <UserPlus className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-slate-900 text-base">
              {initialStudent ? 'Chỉnh Sửa Hồ Sơ Học Viên' : 'Tạo Hồ Sơ & Tài Khoản Học Viên Mới'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-500 mt-2">
          Theo chuẩn SRS 2.1: Quản lý chính xác 8 trường thông tin nền tảng trích xuất từ Sổ Theo Dõi Khách Hàng.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
          {/* Full Name & Gender */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">
                Họ và tên * <span className="text-slate-400 font-normal">(Tối đa 100 ký tự)</span>
              </label>
              <input
                type="text"
                required
                placeholder="Nguyễn Văn A"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className={`w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-hidden font-medium ${
                  errors.fullName ? 'border-rose-400 bg-rose-50' : 'border-slate-200'
                }`}
              />
              {errors.fullName && <p className="text-rose-500 text-[10px] mt-0.5">{errors.fullName}</p>}
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Giới tính *</label>
              <select
                value={gender}
                onChange={(e: any) => setGender(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-hidden font-medium"
              >
                <option value="Nam">Nam</option>
                <option value="Nữ">Nữ</option>
                <option value="Khác">Khác</option>
              </select>
            </div>
          </div>

          {/* Age, Height, Date of Birth */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Tuổi * [1 - 120]</label>
              <input
                type="number"
                required
                value={age}
                onChange={(e) => setAge(e.target.value)}
                className={`w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-hidden font-medium ${
                  errors.age ? 'border-rose-400 bg-rose-50' : 'border-slate-200'
                }`}
              />
              {errors.age && <p className="text-rose-500 text-[10px] mt-0.5">{errors.age}</p>}
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Chiều cao (mét) *</label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="1.72"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                className={`w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-hidden font-medium ${
                  errors.height ? 'border-rose-400 bg-rose-50' : 'border-slate-200'
                }`}
              />
              {errors.height && <p className="text-rose-500 text-[10px] mt-0.5">{errors.height}</p>}
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Ngày sinh *</label>
              <input
                type="date"
                required
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-hidden font-medium"
              />
            </div>
          </div>

          {/* Phone & Address */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Số điện thoại * <span className="text-slate-400 font-normal">(Regex VN)</span>
              </label>
              <input
                type="tel"
                required
                placeholder="0912345678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={`w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-hidden font-mono ${
                  errors.phone ? 'border-rose-400 bg-rose-50' : 'border-slate-200'
                }`}
              />
              {errors.phone && <p className="text-rose-500 text-[10px] mt-0.5">{errors.phone}</p>}
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Địa chỉ (Tùy chọn)</label>
              <input
                type="text"
                placeholder="Quận 1, TP.HCM"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-hidden font-medium"
              />
            </div>
          </div>

          {/* Health Goal */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Mục tiêu sức khỏe <span className="text-slate-400 font-normal">(Baseline Target - Tối đa 500 ký tự)</span>
            </label>
            <textarea
              rows={2}
              placeholder="Ví dụ: Giảm 5kg mỡ, hạ mỡ nội tạng từ cấp 10 xuống cấp 6, siết cơ bụng..."
              value={healthGoal}
              onChange={(e) => setHealthGoal(e.target.value)}
              className={`w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-hidden font-medium ${
                errors.healthGoal ? 'border-rose-400 bg-rose-50' : 'border-slate-200'
              }`}
            />
            {errors.healthGoal && (
              <p className="text-rose-500 text-[10px] mt-0.5">{errors.healthGoal}</p>
            )}
          </div>

          {/* Target Metrics for Gap Analysis */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
            <div className="flex items-center space-x-1.5 font-bold text-slate-800 text-xs mb-2">
              <Target className="w-4 h-4 text-emerald-600" />
              <span>Chỉ Số Mục Tiêu Đo Lường (Đối Soát Gap Analysis)</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div>
                <label className="text-[11px] text-slate-500 font-medium">Mục tiêu Cân nặng (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="72.0"
                  value={targetWeight}
                  onChange={(e) => setTargetWeight(e.target.value)}
                  className="w-full mt-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-500 font-medium">Mục tiêu Mỡ nội tạng</label>
                <input
                  type="number"
                  placeholder="5"
                  value={targetVisceralFat}
                  onChange={(e) => setTargetVisceralFat(e.target.value)}
                  className="w-full mt-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-500 font-medium">Mục tiêu Cơ bắp (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="38.0"
                  value={targetMuscleMass}
                  onChange={(e) => setTargetMuscleMass(e.target.value)}
                  className="w-full mt-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-500 font-medium">Mục tiêu Vòng eo (cm)</label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="78.0"
                  value={targetWaist}
                  onChange={(e) => setTargetWaist(e.target.value)}
                  className="w-full mt-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                />
              </div>
            </div>
          </div>

          {/* Student Login Account Setup (Only when creating new student) */}
          {!initialStudent && (
            <div className="p-3.5 bg-emerald-50/60 rounded-xl border border-emerald-200">
              <div className="font-bold text-emerald-950 text-xs mb-1.5 flex items-center">
                <span>Khởi Tạo Tài Khoản Đăng Nhập Cho Học Viên</span>
              </div>
              <p className="text-[10px] text-slate-500 mb-2.5">
                Cung cấp thông tin đăng nhập để học viên có thể vào Cổng Học Viên theo dõi tiến trình
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Tên đăng nhập (Username)
                  </label>
                  <input
                    type="text"
                    placeholder="Để trống sẽ dùng số điện thoại"
                    value={initialUsername}
                    onChange={(e) => setInitialUsername(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Mật khẩu khởi tạo
                  </label>
                  <input
                    type="text"
                    value={initialPassword}
                    onChange={(e) => setInitialPassword(e.target.value)}
                    placeholder="Mặc định: 123"
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Avatar URL */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Ảnh đại diện (URL)</label>
            <input
              type="text"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-hidden font-mono text-xs"
            />
          </div>

          {Object.keys(errors).length > 0 && (
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
              {Object.values(errors)[0]}
            </div>
          )}

          {/* Form Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 rounded-xl font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold transition-colors shadow-xs cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Đang lưu...' : initialStudent ? 'Lưu Thay Đổi' : 'Tạo Học Viên'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
