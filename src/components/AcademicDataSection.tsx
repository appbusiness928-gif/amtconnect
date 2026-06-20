import React, { useState } from 'react';
import { ClassSchedule, ExamSchedule, ExamGrade } from '../types';
import { Calendar } from 'lucide-react';
import Swal from 'sweetalert2';

interface AcademicDataSectionProps {
  classSchedules: ClassSchedule[];
  examSchedules: ExamSchedule[];
  examGrades: ExamGrade[];
  currentUser: any; 
}

const DAYS_OF_WEEK_LIST = [
  { key: 'อาทิตย์', name: 'วันอาทิตย์' },
  { key: 'จันทร์', name: 'วันจันทร์' },
  { key: 'อังคาร', name: 'วันอังคาร' },
  { key: 'พุธ', name: 'วันพุธ' },
  { key: 'พฤหัส', name: 'วันพฤหัสบดี' },
  { key: 'ศุกร์', name: 'วันศุกร์' },
  { key: 'เสาร์', name: 'วันเสาร์' },
];

const THAI_MONTH_NAMES = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

const matchesDayOfWeek = (dayOfWeekStr: string, dayKey: string) => {
  if (!dayOfWeekStr) return false;
  const clean = dayOfWeekStr.trim().toLowerCase();
  const keyUpper = dayKey.toLowerCase();
  return clean === keyUpper ||
         clean.includes(keyUpper) ||
         (keyUpper === 'จันทร์' && clean.includes('จัน')) ||
         (keyUpper === 'อังคาร' && clean.includes('อัง')) ||
         (keyUpper === 'พุธ' && clean.includes('พุธ')) ||
         (keyUpper === 'พฤหัส' && (clean.includes('พฤ') || clean.includes('พฤหัส'))) ||
         (keyUpper === 'ศุกร์' && clean.includes('ศุก')) ||
         (keyUpper === 'เสาร์' && clean.includes('เสา')) ||
         (keyUpper === 'อาทิตย์' && clean.includes('อา'));
};

const getThaiDayOfWeek = (d: Date): string => {
  const days = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัส', 'ศุกร์', 'เสาร์'];
  return days[d.getDay()];
};

export default function AcademicDataSection({ classSchedules, examSchedules, examGrades, currentUser }: AcademicDataSectionProps) {
  const studentBatch = currentUser.batch || (currentUser.id && String(currentUser.id).length >= 2 ? String(currentUser.id).substring(0, 2) : '67');
  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date());

  const handlePrevMonth = () => setCurrentCalendarDate(new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth() - 1, 1));
  const handleNextMonth = () => setCurrentCalendarDate(new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth() + 1, 1));

  const handleShowScheduleDetails = (cs: ClassSchedule, date: Date) => {
    const dStr = `${date.getDate()} ${THAI_MONTH_NAMES[date.getMonth()]} ${date.getFullYear() + 543}`;
    const sTime = cs.startTime || '08:30';
    const eTime = cs.endTime || '16:30';
    Swal.fire({
      title: `<span class="text-[10px] font-sans font-extrabold uppercase text-neutral-450 block tracking-widest mb-1">รายละเอียดชั่วโมงวิชาเรียน</span> <span class="font-sans font-black text-sm text-neutral-950">${cs.subjectCode}</span>`,
      html: `
        <div class="text-left font-sans text-xs space-y-2.5 py-2 mt-2 border-t border-dashed border-neutral-200">
          <p class="font-bold text-neutral-950">ชื่อวิชาเรียน: <span class="font-medium text-neutral-700">${cs.subjectName}</span></p>
          <p class="font-bold text-neutral-950">วันที่มีเรียนตามสัปดาห์: <span class="font-medium text-neutral-700">วัน${cs.dayOfWeek} (ที่ ${dStr})</span></p>
          <p class="font-bold text-neutral-950">กำหนดเวลาเรียนสอน: <span class="font-bold text-emerald-700 font-mono">${sTime} - ${eTime} น.</span></p>
          <p class="font-bold text-neutral-950">เวลาพักเบรกกลางวัน: <span class="font-bold text-yellow-800 bg-yellow-50 px-1.5 py-0.5 rounded border border-yellow-250 font-mono">12:30 น. (พักเบรกเที่ยง)</span></p>
          <p class="font-bold text-neutral-950 font-mono">กลุ่มเป้ารุ่นผู้เรียน: <span class="font-medium text-neutral-700">รุ่นนักศึกษา ${cs.batch}</span></p>
          <p class="font-bold text-neutral-950">ช่วงวันตลอดหลักสูตร: <span class="font-medium text-neutral-700">${cs.startDate} ถึง ${cs.endDate}</span></p>
          <p class="font-bold text-neutral-950">อาจารย์ผู้รับผิดชอบชี้สอน: <span class="font-medium text-neutral-700">${cs.instructorName}</span></p>
        </div>
      `,
      confirmButtonText: 'รับทราบเวลาตารางเรียน',
      confirmButtonColor: '#171717',
    });
  };

  return (
    <div className="space-y-6">
      <h3 className="font-sans font-black text-lg text-neutral-950">ข้อมูลการเรียนประจำรุ่น {studentBatch}</h3>
      
      {/* Schedule Calendar */}
      <div className="bg-white border border-neutral-300 p-4 rounded-lg shadow-sm">
        <div className="flex justify-between items-center bg-stone-50 p-2 border border-neutral-200 rounded-lg mb-4">
          <button onClick={handlePrevMonth} className="px-3 py-1.5 text-[10px] font-black bg-white border border-neutral-300 rounded-lg shadow-3xs cursor-pointer">&larr; ก่อนหน้า</button>
          <span className="font-sans font-extrabold text-xs">{THAI_MONTH_NAMES[currentCalendarDate.getMonth()]} {currentCalendarDate.getFullYear() + 543}</span>
          <button onClick={handleNextMonth} className="px-3 py-1.5 text-[10px] font-black bg-white border border-neutral-300 rounded-lg shadow-3xs cursor-pointer">ถัดไป &rarr;</button>
        </div>

        <div className="grid grid-cols-7 gap-1.5 text-center font-bold text-[9px] text-neutral-500 uppercase py-1 border-b">
          {DAYS_OF_WEEK_LIST.map(d => <div key={d.key}>{d.name.substring(0, 3)}</div>)}
        </div>

        <div className="grid grid-cols-7 gap-1.5 mt-2">
          {(() => {
            const year = currentCalendarDate.getFullYear();
            const month = currentCalendarDate.getMonth();
            const firstDay = new Date(year, month, 1).getDay();
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const cells = [];
            for (let i = 0; i < firstDay; i++) cells.push(null);
            for (let i = 1; i <= daysInMonth; i++) cells.push(new Date(year, month, i));
            
            return cells.map((cellDate, index) => {
              if (!cellDate) return <div key={index} className="min-h-[60px]" />;
              const currDateStr = `${cellDate.getFullYear()}-${String(cellDate.getMonth() + 1).padStart(2, '0')}-${String(cellDate.getDate()).padStart(2, '0')}`;
              const dayThaiName = getThaiDayOfWeek(cellDate);
              const classesToday = classSchedules.filter(s => s.batch === studentBatch && matchesDayOfWeek(s.dayOfWeek, dayThaiName) && currDateStr >= s.startDate && currDateStr <= s.endDate);

              return (
                <div key={index} className="min-h-[80px] p-1 border rounded text-[9px]">
                  <div className="font-bold mb-1">{cellDate.getDate()}</div>
                  <div className="flex flex-col gap-0.5">
                    {classesToday.map(cs => (
                      <button
                        key={cs.id}
                        type="button"
                        onClick={() => handleShowScheduleDetails(cs, cellDate)}
                        className="w-full text-left bg-neutral-900 text-white rounded px-1.5 py-0.5 font-sans truncate hover:bg-neutral-800 transition-colors cursor-pointer block text-[8px] border-none"
                        title={`${cs.subjectCode} - ${cs.subjectName}`}
                      >
                        <span className="font-extrabold">{cs.subjectCode}</span>
                        <span className="block text-[7px] text-zinc-300 font-mono leading-none mt-0.5">
                          {cs.startTime || '08:30'}-{cs.endTime || '16:30'}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            });
          })()}
        </div>
      </div>
      
      {/* Exams */}
      <div className="bg-white border border-neutral-300 p-4 rounded-lg shadow-sm">
        <h4 className="font-bold text-neutral-900 text-sm mb-3">ตารางนัดสอบ</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px]">
            <thead>
              <tr className="border-b bg-stone-50">
                <th className="p-2">รายวิชา</th>
                <th className="p-2">วันที่สอบ</th>
                <th className="p-2">เวลา</th>
              </tr>
            </thead>
            <tbody>
              {examSchedules.filter(e => e.batch === studentBatch).map(e => (
                <tr key={e.id} className="border-b hover:bg-neutral-50">
                  <td className="p-2 font-bold">{e.subjectName}</td>
                  <td className="p-2 font-mono">{e.date}</td>
                  <td className="p-2 font-mono">{e.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

       {/* Grades */}
       <div className="bg-white border border-neutral-300 p-4 rounded-lg shadow-sm">
        <h4 className="font-bold text-neutral-900 text-sm mb-3">คะแนนการทดสอบ</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px]">
            <thead>
              <tr className="border-b bg-stone-50">
                <th className="p-2">รายวิชา</th>
                <th className="p-2">ผลคะแนน</th>
                <th className="p-2">รอบการสอบ</th>
              </tr>
            </thead>
            <tbody>
              {examGrades.map(eg => {
                const grade = eg.grades.find(g => g.studentId === currentUser.id);
                if (!grade) return null;
                return (
                  <tr key={eg.id} className="border-b hover:bg-neutral-50">
                    <td className="p-2 font-bold">{eg.subjectName}</td>
                    <td className="p-2 font-mono font-bold text-emerald-700">{grade.score}</td>
                    <td className="p-2 font-mono">{eg.round}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
