/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { StudentProfile, HealthMetricRecord, BodyTypeClassification } from '../../types/health';
import { useHealth } from '../../context/HealthContext';
import { calculateHealthScore } from '../../utils/healthCalculations';
import {
  X,
  PlusCircle,
  AlertTriangle,
  Scale,
  Sparkles,
  Info,
} from 'lucide-react';

interface AddMetricModalProps {
  student: StudentProfile;
  latestMetric?: HealthMetricRecord;
  onClose: () => void;
}

export const AddMetricModal: React.FC<AddMetricModalProps> = ({
  student,
  latestMetric,
  onClose,
}) => {
  const { addMetricRecord } = useHealth();

  // Form State initialized with either latest metric or smart defaults
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [weight, setWeight] = useState(latestMetric ? String(latestMetric.weight) : '70.0');
  const [subcutaneousFat, setSubcutaneousFat] = useState(
    latestMetric ? String(latestMetric.subcutaneousFat) : '20.0'
  );
  const [boneCalcium, setBoneCalcium] = useState(
    latestMetric ? String(latestMetric.boneCalcium) : '3.0'
  );
  const [bodyWater, setBodyWater] = useState(
    latestMetric ? String(latestMetric.bodyWater) : '55.0'
  );
  const [muscleMass, setMuscleMass] = useState(
    latestMetric ? String(latestMetric.muscleMass) : '32.0'
  );
  const [bodyType, setBodyType] = useState<BodyTypeClassification>(
    latestMetric ? latestMetric.bodyType : 'Tiêu chuẩn'
  );
  const [bmr, setBmr] = useState(latestMetric ? String(latestMetric.bmr) : '1600');
  const [biologicalAge, setBiologicalAge] = useState(
    latestMetric ? String(latestMetric.biologicalAge) : String(student.age)
  );
  const [visceralFat, setVisceralFat] = useState(
    latestMetric ? String(latestMetric.visceralFat) : '6'
  );
  const [waist, setWaist] = useState(latestMetric ? String(latestMetric.waist) : '80.0');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Real-time Preview Calculation
  const tempMetric: HealthMetricRecord = {
    id: 'temp',
    studentId: student.id,
    date,
    timestamp: Date.now(),
    weight: parseFloat(weight) || 70,
    subcutaneousFat: parseFloat(subcutaneousFat) || 20,
    boneCalcium: parseFloat(boneCalcium) || 3,
    bodyWater: parseFloat(bodyWater) || 55,
    muscleMass: parseFloat(muscleMass) || 32,
    bodyType,
    bmr: parseInt(bmr, 10) || 1600,
    biologicalAge: parseInt(biologicalAge, 10) || student.age,
    visceralFat: parseInt(visceralFat, 10) || 5,
    waist: parseFloat(waist) || 80,
  };

  const scorePreview = calculateHealthScore(student, tempMetric);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    const w = parseFloat(weight);
    if (isNaN(w) || w < 10 || w > 300) newErrors.weight = 'Cân nặng phải từ 10.00 đến 300.00 kg';

    const fat = parseFloat(subcutaneousFat);
    if (isNaN(fat) || fat < 1 || fat > 60) newErrors.subcutaneousFat = 'Mỡ dưới da phải từ 1.0 đến 60.0%';

    const bone = parseFloat(boneCalcium);
    if (isNaN(bone) || bone < 0.5 || bone > 10) newErrors.boneCalcium = 'Canxi xương phải từ 0.5 đến 10.0';

    const water = parseFloat(bodyWater);
    if (isNaN(water) || water < 20 || water > 80) newErrors.bodyWater = 'Lượng nước phải từ 20.0 đến 80.0%';

    const muscle = parseFloat(muscleMass);
    if (isNaN(muscle) || muscle < 5 || muscle > 150) newErrors.muscleMass = 'Cơ bắp phải từ 5.00 đến 150.00 kg';

    const b = parseInt(bmr, 10);
    if (isNaN(b) || b < 500 || b > 5000) newErrors.bmr = 'BMR phải từ 500 đến 5000 Kcal';

    const bioAge = parseInt(biologicalAge, 10);
    if (isNaN(bioAge) || bioAge < 1 || bioAge > 120) newErrors.biologicalAge = 'Tuổi sinh học từ 1 đến 120';

    const visc = parseInt(visceralFat, 10);
    if (isNaN(visc) || visc < 1 || visc > 30) newErrors.visceralFat = 'Mỡ nội tạng từ cấp 1 đến 30';

    const wst = parseFloat(waist);
    if (isNaN(wst) || wst < 30 || wst > 200) newErrors.waist = 'Vòng eo từ 30.0 đến 200.0 cm';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    await addMetricRecord({
      studentId: student.id,
      date,
      weight: parseFloat(w.toFixed(2)),
      subcutaneousFat: parseFloat(fat.toFixed(1)),
      boneCalcium: parseFloat(bone.toFixed(1)),
      bodyWater: parseFloat(water.toFixed(1)),
      muscleMass: parseFloat(muscle.toFixed(2)),
      bodyType,
      bmr: b,
      biologicalAge: bioAge,
      visceralFat: visc,
      waist: parseFloat(wst.toFixed(1)),
      notes,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 my-8 animate-in fade-in zoom-in-95 duration-150 border border-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                Nhập Nhật Ký 10 Chỉ Số Sinh Học
              </h3>
              <p className="text-xs text-slate-500">
                Học viên: <span className="font-semibold text-slate-800">{student.fullName}</span> ({student.age} tuổi)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Score Preview & Instant Anomaly Warning Banner */}
        <div className="mt-4 p-3 rounded-xl bg-emerald-50/70 border border-emerald-200/80 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <span className="font-semibold text-emerald-900">Điểm Sức Khỏe Dự Kiến:</span>
            <span className="text-sm font-extrabold text-emerald-700 bg-white px-2 py-0.5 rounded-md border border-emerald-300">
              {scorePreview.totalScore} / 100 ({scorePreview.tier})
            </span>
          </div>

          {tempMetric.visceralFat >= 10 && (
            <span className="inline-flex items-center text-rose-700 font-bold bg-rose-100 px-2 py-0.5 rounded border border-rose-300">
              <AlertTriangle className="w-3.5 h-3.5 mr-1" />
              Mỡ nội tạng ≥ 10
            </span>
          )}
          {tempMetric.biologicalAge - student.age >= 3 && (
            <span className="inline-flex items-center text-amber-800 font-bold bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
              <AlertTriangle className="w-3.5 h-3.5 mr-1" />
              Lão hóa +{tempMetric.biologicalAge - student.age} tuổi
            </span>
          )}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
          {/* Measurement Date */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Ngày cân đo *</label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-hidden font-medium"
            />
          </div>

          {/* 10 Indicators Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* 1. Cân nặng */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                1. Cân nặng (kg) * <span className="text-slate-400 font-normal">[10 - 300]</span>
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className={`w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-hidden font-medium ${
                  errors.weight ? 'border-rose-400 bg-rose-50' : 'border-slate-200'
                }`}
              />
              {errors.weight && <p className="text-rose-500 text-[10px] mt-0.5">{errors.weight}</p>}
            </div>

            {/* 2. Mỡ dưới da */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                2. Mỡ dưới da (%) * <span className="text-slate-400 font-normal">[1.0 - 60.0]</span>
              </label>
              <input
                type="number"
                step="0.1"
                required
                value={subcutaneousFat}
                onChange={(e) => setSubcutaneousFat(e.target.value)}
                className={`w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-hidden font-medium ${
                  errors.subcutaneousFat ? 'border-rose-400 bg-rose-50' : 'border-slate-200'
                }`}
              />
              {errors.subcutaneousFat && (
                <p className="text-rose-500 text-[10px] mt-0.5">{errors.subcutaneousFat}</p>
              )}
            </div>

            {/* 3. Canxi xương */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                3. Canxi xương (Chỉ số) * <span className="text-slate-400 font-normal">[0.5 - 10.0]</span>
              </label>
              <input
                type="number"
                step="0.1"
                required
                value={boneCalcium}
                onChange={(e) => setBoneCalcium(e.target.value)}
                className={`w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-hidden font-medium ${
                  errors.boneCalcium ? 'border-rose-400 bg-rose-50' : 'border-slate-200'
                }`}
              />
              {errors.boneCalcium && (
                <p className="text-rose-500 text-[10px] mt-0.5">{errors.boneCalcium}</p>
              )}
            </div>

            {/* 4. Lượng nước */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                4. Lượng nước (%) * <span className="text-slate-400 font-normal">[20.0 - 80.0]</span>
              </label>
              <input
                type="number"
                step="0.1"
                required
                value={bodyWater}
                onChange={(e) => setBodyWater(e.target.value)}
                className={`w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-hidden font-medium ${
                  errors.bodyWater ? 'border-rose-400 bg-rose-50' : 'border-slate-200'
                }`}
              />
              {errors.bodyWater && (
                <p className="text-rose-500 text-[10px] mt-0.5">{errors.bodyWater}</p>
              )}
            </div>

            {/* 5. Trọng lượng cơ bắp */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                5. Trọng lượng cơ bắp (kg) * <span className="text-slate-400 font-normal">[5 - 150]</span>
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={muscleMass}
                onChange={(e) => setMuscleMass(e.target.value)}
                className={`w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-hidden font-medium ${
                  errors.muscleMass ? 'border-rose-400 bg-rose-50' : 'border-slate-200'
                }`}
              />
              {errors.muscleMass && (
                <p className="text-rose-500 text-[10px] mt-0.5">{errors.muscleMass}</p>
              )}
            </div>

            {/* 6. Thể hình */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                6. Phân loại Thể hình *
              </label>
              <select
                value={bodyType}
                onChange={(e: any) => setBodyType(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-hidden font-semibold"
              >
                <option value="Tiêu chuẩn">Tiêu chuẩn</option>
                <option value="Cơ bắp gọn">Cơ bắp gọn</option>
                <option value="Vận động viên">Vận động viên</option>
                <option value="Gầy">Gầy</option>
                <option value="Thiếu cân nhẹ">Thiếu cân nhẹ</option>
                <option value="Mỡ tiềm ẩn">Mỡ tiềm ẩn</option>
                <option value="Thừa cân">Thừa cân</option>
                <option value="Béo phì">Béo phì</option>
              </select>
            </div>

            {/* 7. BMR */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                7. Năng lượng nghỉ ngơi BMR (Kcal) * <span className="text-slate-400 font-normal">[500 - 5000]</span>
              </label>
              <input
                type="number"
                required
                value={bmr}
                onChange={(e) => setBmr(e.target.value)}
                className={`w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-hidden font-medium ${
                  errors.bmr ? 'border-rose-400 bg-rose-50' : 'border-slate-200'
                }`}
              />
              {errors.bmr && <p className="text-rose-500 text-[10px] mt-0.5">{errors.bmr}</p>}
            </div>

            {/* 8. Tuổi sinh học */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                8. Tuổi sinh học (Tuổi) * <span className="text-slate-400 font-normal">[1 - 120]</span>
              </label>
              <input
                type="number"
                required
                value={biologicalAge}
                onChange={(e) => setBiologicalAge(e.target.value)}
                className={`w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-hidden font-medium ${
                  errors.biologicalAge ? 'border-rose-400 bg-rose-50' : 'border-slate-200'
                }`}
              />
              {errors.biologicalAge && (
                <p className="text-rose-500 text-[10px] mt-0.5">{errors.biologicalAge}</p>
              )}
            </div>

            {/* 9. Mỡ nội tạng */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                9. Mỡ nội tạng (Cấp) * <span className="text-slate-400 font-normal">[Cấp 1 - 30]</span>
              </label>
              <input
                type="number"
                required
                value={visceralFat}
                onChange={(e) => setVisceralFat(e.target.value)}
                className={`w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-hidden font-medium ${
                  errors.visceralFat ? 'border-rose-400 bg-rose-50' : 'border-slate-200'
                }`}
              />
              {errors.visceralFat && (
                <p className="text-rose-500 text-[10px] mt-0.5">{errors.visceralFat}</p>
              )}
            </div>

            {/* 10. Vòng eo */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                10. Vòng eo (cm) * <span className="text-slate-400 font-normal">[30.0 - 200.0]</span>
              </label>
              <input
                type="number"
                step="0.1"
                required
                value={waist}
                onChange={(e) => setWaist(e.target.value)}
                className={`w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-hidden font-medium ${
                  errors.waist ? 'border-rose-400 bg-rose-50' : 'border-slate-200'
                }`}
              />
              {errors.waist && <p className="text-rose-500 text-[10px] mt-0.5">{errors.waist}</p>}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Ghi chú của Huấn luyện viên
            </label>
            <textarea
              rows={2}
              placeholder="Ghi nhận tình trạng thể lực, cảm giác cơ bắp, mức năng lượng..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-hidden"
            />
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] text-slate-400 flex items-center">
              <Info className="w-3.5 h-3.5 mr-1" />
              Tự động lưu vào Aiven PostgreSQL & tạo dự thảo Lời khuyên AI
            </span>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-slate-200 rounded-xl font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold transition-colors shadow-xs"
              >
                Lưu Nhật Ký Đo
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
