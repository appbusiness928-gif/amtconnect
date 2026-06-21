/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { User, RoomRequest, ClassSchedule, ExamSchedule, ExamGrade, Equipment, BorrowRecord, RoomUsageRecord } from '../types';
import SignaturePad from './SignaturePad';
import { 
  Plus, Calendar, Search, Star, Award, BookOpen, Users, 
  Wrench, Camera, HelpCircle, Eye, Printer, ShieldCheck, RefreshCw,
  ChevronLeft, ChevronRight, Edit3, X
} from 'lucide-react';
import { alerts as Swal } from '../lib/alerts';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { getAppOriginForQR } from '../lib/api';
import { TraceabilityToolsLogDoc } from './Documents';
import AcademicDataSection from './AcademicDataSection';

const TIME_OPTIONS = [
  "07:00", "07:30", "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30",
  "17:00", "17:30", "18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00"
];

interface ExamOfficeStudentPanelProps {
  currentUser: User;
  users: User[];
  roomRequests: RoomRequest[];
  classSchedules: ClassSchedule[];
  examSchedules: ExamSchedule[];
  examGrades: ExamGrade[];
  equipments: Equipment[];
  borrowRecords: BorrowRecord[];
  
  onAddSchedule: (s: ClassSchedule) => void;
  onAddExam: (ex: ExamSchedule) => void;
  onAddGrade: (grade: ExamGrade) => void;
  onBorrowEquipment: (code: string, qty: number, signature: string) => void;
  onReturnEquipment: (borrowId: string) => void;
  onSubmitRoomRequest: (req: Omit<RoomRequest, 'id' | 'maintenanceApproved' | 'isRoomUsageRecordCreated'>) => boolean;
  onViewRequestDoc: (req: RoomRequest) => void;
  onUpdateProfile: (updated: Partial<User>) => void;
  onAddUsageRecord?: (record: Omit<RoomUsageRecord, 'id' | 'maintenanceOfficerStatus'>) => void;
  onCancelRoomRequest?: (requestId: string) => void;
}

const DAYS_OF_WEEK_LIST = [
  { key: 'จันทร์', name: 'วันจันทร์', color: 'bg-yellow-50 border-yellow-200 text-yellow-800' },
  { key: 'อังคาร', name: 'วันอังคาร', color: 'bg-pink-50 border-pink-200 text-pink-800' },
  { key: 'พุธ', name: 'วันพุธ', color: 'bg-green-50 border-green-200 text-emerald-800' },
  { key: 'พฤหัส', name: 'วันพฤหัสบดี', color: 'bg-orange-50 border-orange-200 text-orange-850' },
  { key: 'ศุกร์', name: 'วันศุกร์', color: 'bg-blue-50 border-blue-200 text-blue-800' },
  { key: 'เสาร์', name: 'วันเสาร์', color: 'bg-purple-50 border-purple-200 text-purple-800' },
  { key: 'อาทิตย์', name: 'วันอาทิตย์', color: 'bg-red-50 border-red-200 text-red-800' },
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

const THAI_MONTH_NAMES = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

const mapDayIndexToKey = (index: number) => {
  const keys = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัส', 'ศุกร์', 'เสาร์'];
  return keys[index];
};

export default function ExamOfficeStudentPanel({
  currentUser,
  users,
  roomRequests,
  classSchedules,
  examSchedules,
  examGrades,
  equipments,
  borrowRecords,
  
  onAddSchedule,
  onAddExam,
  onAddGrade,
  onBorrowEquipment,
  onReturnEquipment,
  onSubmitRoomRequest,
  onViewRequestDoc,
  onUpdateProfile,
  onAddUsageRecord,
  onCancelRoomRequest
}: ExamOfficeStudentPanelProps) {
  const isStudent = currentUser.role === 'นักศึกษา';
  const isInstructor = currentUser.role === 'Instructor';
  const isOffice = currentUser.role === 'Office Manager' || currentUser.role === 'Office Staff';
  const isExam = currentUser.role === 'Examination Manager' || currentUser.role === 'Examination Staff';

  const studentBatch = currentUser.batch || (currentUser.id && String(currentUser.id).length >= 2 && !isNaN(Number(String(currentUser.id).substring(0, 2))) ? String(currentUser.id).substring(0, 2) : '67');

  // Dynamically get cohorts based on existing student batches in the system
  const availableBatches = Array.from(
    new Set(
      (users || [])
        .filter((u) => u && u.role === 'นักศึกษา')
        .map((u) => u.batch || String(u.id || '').substring(0, 2))
        .filter((b) => b && typeof b === 'string' && b.trim().length > 0)
    )
  ).sort();
  const dbBatches = availableBatches.length > 0 ? availableBatches : ['67', '68'];

  const getThaiDayOfWeek = (d: Date): string => {
    const days = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัส', 'ศุกร์', 'เสาร์'];
    return days[d.getDay()];
  };

  const handleShowScheduleDetails = (cs: ClassSchedule, date: Date) => {
    const dStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const sTime = cs.startTime || '08:30';
    const eTime = cs.endTime || '16:30';
    Swal.fire({
      title: `<span class="text-[10px] font-sans font-extrabold uppercase text-neutral-400 block tracking-widest mb-1">รายละเอียดชั่วโมงวิชาเรียน</span> <span class="font-sans font-black text-sm text-neutral-950">${cs.subjectCode}</span>`,
      html: `
        <div class="text-left font-sans text-xs space-y-2 py-2 mt-2 border-t border-dashed border-neutral-200">
          <p class="font-bold text-neutral-950">ชื่อวิชาเรียน: <span class="font-medium text-neutral-700">${cs.subjectName}</span></p>
          <p class="font-bold text-neutral-950">วันสอนหลักประจำสัปดาห์: <span class="font-medium text-neutral-700">วัน${cs.dayOfWeek}</span></p>
          <p class="font-bold text-neutral-950">เวลาเรียนทั้งหมด: <span class="font-bold text-emerald-750 font-mono">${sTime} - ${eTime} น.</span></p>
          <p class="font-bold text-neutral-950">ช่วงเวลาพักเที่ยง: <span class="font-bold text-yellow-800 bg-yellow-50 px-1.5 py-0.5 rounded border border-yellow-200">12:30 น. (พักเบรกกลางวัน)</span></p>
          <p class="font-bold text-neutral-950 font-mono">กลุ่มเป้าหมายผู้สอน: <span class="font-medium text-neutral-700">รุ่นนักศึกษา ${cs.batch}</span></p>
          <p class="font-bold text-neutral-950">ช่วงกำหนดจัดเรียนสอน: <span class="font-medium text-neutral-700">${cs.startDate} ถึง ${cs.endDate}</span></p>
          <p class="font-bold text-neutral-950">อาจารย์ผู้รับผิดชอบชี้สอน: <span class="font-medium text-neutral-700">${cs.instructorName}</span></p>
          <p class="font-bold text-neutral-950">วันที่ตรวจสอบตาราง: <span class="font-medium text-neutral-700">${dStr}</span></p>
        </div>
      `,
      confirmButtonText: 'รับทราบตารางเรียน',
      confirmButtonColor: '#171717',
    });
  };

  const handleShowExamDetails = (ex: ExamSchedule) => {
    Swal.fire({
      title: `<span class="text-[10px] font-sans font-extrabold uppercase text-rose-500 block tracking-widest mb-1">กำหนดการทดสอบประเมิน</span> <span class="font-sans font-black text-sm text-rose-600">SCHEDULE EXAM</span>`,
      html: `
        <div class="text-left font-sans text-xs space-y-2 py-2 mt-2 border-t border-dashed border-neutral-200">
          <p class="font-bold text-neutral-950">รายวิชาทดสอบ: <span class="font-medium text-neutral-700">${ex.subjectName}</span></p>
          <p class="font-bold text-neutral-950">วันที่ทำการสอบสากล: <span class="font-medium text-neutral-700">${ex.date}</span></p>
          <p class="font-bold text-neutral-950">ช่วงเวลากำหนดสอบ: <span class="font-medium text-neutral-700">${ex.time}</span></p>
          <p class="font-bold text-neutral-950 font-mono">กลุ่มเป้าหมายผู้สอบ: <span class="font-medium text-neutral-700">รุ่นนักศึกษา ${ex.batch}</span></p>
        </div>
      `,
      confirmButtonText: 'เตรียมสิทธิ์ความพร้อมสอบ',
      confirmButtonColor: '#E11D48',
    });
  };

  // State Tabs
  const [activeTab, setActiveTab] = useState<'profile' | 'action' | 'schedule' | 'academic' | 'borrow' | 'roster' | 'requests'>('profile');

  // Instructor Action Tab Switcher (Schedule management vs Lab requests)
  const [instActionTab, setInstActionTab] = useState<'schedule' | 'room'>('schedule');

  // Monthly calendar states
  const [calendarViewMode, setCalendarViewMode] = useState<'weekly' | 'monthly'>('monthly');
  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date(2026, 5, 12)); // June 12, 2026
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<Date | null>(new Date(2026, 5, 12));

  const handlePrevMonth = () => {
    setCurrentCalendarDate(new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentCalendarDate(new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth() + 1, 1));
  };

  // Office schedule states
  const [schBatch, setSchBatch] = useState(() => dbBatches[0] || '');
  const [schCode, setSchCode] = useState('');
  const [schName, setSchName] = useState('');
  const [schDays, setSchDays] = useState<('จันทร์' | 'อังคาร' | 'พุธ' | 'พฤหัส' | 'ศุกร์' | 'เสาร์' | 'อาทิตย์')[]>(['จันทร์']);
  const [schStart, setSchStart] = useState('');
  const [schEnd, setSchEnd] = useState('');
  const [schStartTime, setSchStartTime] = useState('08:30');
  const [schEndTime, setSchEndTime] = useState('16:30');
  const [schTeacher, setSchTeacher] = useState('');

  // Auto-populate instructor name for teaching schedules if they are the instructor
  React.useEffect(() => {
    if (isInstructor && !schTeacher && currentUser) {
      setSchTeacher(`${currentUser.firstName} ${currentUser.lastName}`);
    }
  }, [isInstructor, currentUser, schTeacher]);

  // Exam states
  const [exBatch, setExBatch] = useState(() => dbBatches[0] || '');
  const [exDate, setExDate] = useState('');
  const [exTime, setExTime] = useState('09:00 - 11:30');
  const [exSubject, setExSubject] = useState('');

  // Grading states
  const [gradeBatch, setGradeBatch] = useState(() => dbBatches[0] || '');
  const [gradeSubject, setGradeSubject] = useState('');
  const [gradeRound, setGradeRound] = useState(1);
  const [studentGrades, setStudentGrades] = useState<{ [id: string]: number }>({});

  // Synchronise exam subject with class schedules when batch changes
  React.useEffect(() => {
    const activeExSubjects = Array.from(
      new Set(
        classSchedules
          .filter((s) => s.batch === exBatch)
          .map((s) => `${s.subjectCode} ${s.subjectName}`)
      )
    );
    if (activeExSubjects.length > 0) {
      if (!activeExSubjects.includes(exSubject)) {
        setExSubject(activeExSubjects[0]);
      }
    } else {
      setExSubject('');
    }
  }, [exBatch, classSchedules, exSubject]);

  // Synchronise grading subject with class schedules when batch changes
  React.useEffect(() => {
    const activeGradeSubjects = Array.from(
      new Set(
        classSchedules
          .filter((s) => s.batch === gradeBatch)
          .map((s) => `${s.subjectCode} ${s.subjectName}`)
      )
    );
    if (activeGradeSubjects.length > 0) {
      if (!activeGradeSubjects.includes(gradeSubject)) {
        setGradeSubject(activeGradeSubjects[0]);
      }
    } else {
      setGradeSubject('');
    }
  }, [gradeBatch, classSchedules, gradeSubject]);

  // Room Request form states
  const [department, setDepartment] = useState('');
  const [phone, setPhone] = useState('');
  const [purpose, setPurpose] = useState('');
  const [requestDate, setRequestDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('12:00');
  const [selectedRoom, setSelectedRoom] = useState('Practical Area in Hangar');
  const [otherRoomText, setOtherRoomText] = useState('');
  const [requestSignature, setRequestSignature] = useState('');

  // Room Usage Record form states
  const [roomSubForm, setRoomSubForm] = useState<'request' | 'usage'>('request');
  const [usageDate, setUsageDate] = useState(new Date().toISOString().split('T')[0]);
  const [usageRoomName, setUsageRoomName] = useState('');
  const [usageReportText, setUsageReportText] = useState('');
  const [usageSignature, setUsageSignature] = useState('');

  // Equipment borrowing states
  const [targetCode, setTargetCode] = useState('');
  const [borrowQty, setBorrowQty] = useState(1);
  const [borrowSignature, setBorrowSignature] = useState('');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [scannedTool, setScannedTool] = useState<Equipment | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [showTraceabilityDoc, setShowTraceabilityDoc] = useState(false);

  React.useEffect(() => {
    let html5QrCode: Html5Qrcode | null = null;
    let isMounted = true;

    if (isCameraActive) {
      setCameraError(null);
      
      const startScanner = async () => {
        // Wait briefly for React to render the scanner container div
        await new Promise((resolve) => setTimeout(resolve, 300));
        if (!isMounted) return;

        try {
          const container = document.getElementById('student-equipment-reader');
          if (!container) {
            throw new Error('ระบบไม่พบตำแหน่งแผงแสดงผลกล้องตรวจจับ');
          }
          
          html5QrCode = new Html5Qrcode('student-equipment-reader');
          await html5QrCode.start(
            { facingMode: 'environment' },
            {
              fps: 15,
              qrbox: (w, h) => {
                const size = Math.max(120, Math.min(w, h, 250));
                return { width: size, height: Math.max(size * 0.5, 90) }; // wider scan box for barcodes and QR codes
              }
            },
            (decodedText) => {
              // On scanned successfully:
              handleSimulateScan(decodedText);
            },
            () => {
              // Verbose error frames, safe to bypass
            }
          );
        } catch (err: any) {
          console.error('Error starting Html5Qrcode engine:', err);
          setCameraError(err.message || 'ไม่สามารถเข้าถึงอุปกรณ์กล้องได้ โปรดเปิดสิทธิ์อนุมัติการใช้งานกล้องในเบราว์เซอร์');
        }
      };

      startScanner();
    }

    return () => {
      isMounted = false;
      if (html5QrCode) {
        try {
          if (html5QrCode.isScanning) {
            html5QrCode.stop().catch((stopErr) => {
              console.error('Error stopping scanner during cleanup:', stopErr);
            });
          }
        } catch (e) {
          console.error(e);
        }
      }
    };
  }, [isCameraActive]);

  // Search schedule (for examinations checking)
  const [searchStudentId, setSearchStudentId] = useState('');
  const [checkedStudent, setCheckedStudent] = useState<User | null>(null);

  // Filter batch roster
  const [rosterBatch, setRosterBatch] = useState(() => dbBatches[0] || '');

  // Filter batch schedule
  const [scheduleBatch, setScheduleBatch] = useState(studentBatch || dbBatches[0] || '');

  // Automatically adjust selected batch states once options load/change
  React.useEffect(() => {
    if (dbBatches.length > 0) {
      if (!dbBatches.includes(schBatch) || !schBatch) setSchBatch(dbBatches[0]);
      if (!dbBatches.includes(exBatch) || !exBatch) setExBatch(dbBatches[0]);
      if (!dbBatches.includes(gradeBatch) || !gradeBatch) setGradeBatch(dbBatches[0]);
      if (!dbBatches.includes(rosterBatch) || !rosterBatch) setRosterBatch(dbBatches[0]);
      if (!dbBatches.includes(scheduleBatch) || !scheduleBatch) setScheduleBatch(dbBatches[0]);
    }
  }, [dbBatches, schBatch, exBatch, gradeBatch, rosterBatch, scheduleBatch]);

  // Profile Edit states
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [tableDate, setTableDate] = useState(new Date().toISOString().split('T')[0]);
  const [editFirstName, setEditFirstName] = useState(currentUser.firstName);
  const [editLastName, setEditLastName] = useState(currentUser.lastName);
  const [editEmail, setEditEmail] = useState(currentUser.email);
  const [editPassword, setEditPassword] = useState(currentUser.password || '');
  const [editPhoto, setEditPhoto] = useState(currentUser.photoUrl);
  const [editSig, setEditSig] = useState(currentUser.signature);

  // Custom ID Card state hooks
  const idCardLayout = 'vertical';
  const [idCardTheme, setIdCardTheme] = useState<'official' | 'navy' | 'dark' | 'emerald' | 'gold' | 'minimal'>('minimal');
  const [idCardDept, setIdCardDept] = useState('AMT CONNECT');
  const [idCardTitle, setIdCardTitle] = useState(currentUser.role === 'นักศึกษา' ? 'STUDENT IDENTIFICATION' : 'AIRCRAFT INSTRUCTOR PASS');
  const [idCardShowSignature, setIdCardShowSignature] = useState(true);
  const [idCardShowBarcode, setIdCardShowBarcode] = useState(true);
  const [idCardCustomBatch, setIdCardCustomBatch] = useState(currentUser.batch || studentBatch || '67');

  const handleCancelEditProfile = () => {
    setEditFirstName(currentUser.firstName);
    setEditLastName(currentUser.lastName);
    setEditEmail(currentUser.email);
    setEditPassword(currentUser.password || '');
    setEditPhoto(currentUser.photoUrl);
    setEditSig(currentUser.signature);
    setIsEditingProfile(false);
  };

  const handleUpdateProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editFirstName.trim() || !editLastName.trim() || !editEmail.trim()) {
      Swal.fire({ icon: 'error', title: 'ผิดพลาด', text: 'กรุณากรอกข้อมูลให้ครบถ้วน', confirmButtonColor: '#171717' });
      return;
    }
    onUpdateProfile({
      firstName: editFirstName,
      lastName: editLastName,
      email: editEmail,
      password: editPassword,
      photoUrl: editPhoto,
      signature: editSig
    });
    setIsEditingProfile(false);
    Swal.fire({ icon: 'success', title: 'สำเร็จ', text: 'แก้ไขข้อมูลของฉันเรียบร้อยแล้ว', confirmButtonColor: '#171717' });
  };

  const checkRoomBusy = (roomName: string): boolean => {
    if (!requestDate || !startTime || !endTime) return false;
    if (startTime >= endTime) return false;

    const normalizeDateStr = (dateStr: string): string => {
      if (!dateStr) return '';
      const trimmed = dateStr.trim();
      let year = NaN;
      let month = NaN;
      let day = NaN;

      if (trimmed.includes('-')) {
        const parts = trimmed.split('-');
        if (parts.length === 3) {
          if (parts[0].length === 4) {
            year = parseInt(parts[0], 10);
            month = parseInt(parts[1], 10);
            day = parseInt(parts[2], 10);
          } else {
            year = parseInt(parts[2], 10);
            month = parseInt(parts[1], 10);
            day = parseInt(parts[0], 10);
          }
        }
      } else if (trimmed.includes('/')) {
        const parts = trimmed.split('/');
        if (parts.length === 3) {
          if (parts[2].length === 4) {
            year = parseInt(parts[2], 10);
            month = parseInt(parts[1], 10);
            day = parseInt(parts[0], 10);
          } else if (parts[0].length === 4) {
            year = parseInt(parts[0], 10);
            month = parseInt(parts[1], 10);
            day = parseInt(parts[2], 10);
          }
        }
      }

      if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
        if (year > 2400) year -= 543;
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
      return trimmed;
    };

    const parseTimeRangeStr = (timeRangeStr: string) => {
      const parts = timeRangeStr.split('-');
      if (parts.length === 2) {
        return {
          startTime: parts[0].trim(),
          endTime: parts[1].trim(),
        };
      }
      return { startTime: '', endTime: '' };
    };

    const targetNormDate = normalizeDateStr(requestDate);

    return roomRequests.some(existing => {
      if (existing.maintenanceApproved === 'Rejected') return false;
      if (existing.room.trim().toLowerCase() !== roomName.trim().toLowerCase()) return false;
      if (normalizeDateStr(existing.date) !== targetNormDate) return false;

      const existTimes = parseTimeRangeStr(existing.timeRange);
      if (!existTimes.startTime || !existTimes.endTime) return false;

      return existTimes.startTime < endTime && startTime < existTimes.endTime;
    });
  };

  const handleRoomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!department || !phone || !purpose || !requestDate) {
      Swal.fire({ icon: 'error', title: 'ผิดพลาด', text: 'กรุณากรอกข้อมูลให้ครบถ้วน', confirmButtonColor: '#171717' });
      return;
    }
    if (!requestSignature) {
      Swal.fire({ icon: 'error', title: 'ต้องการลายเซ็น', text: 'กรุณาเซ็นชื่อลายมือบนบอร์ด', confirmButtonColor: '#171717' });
      return;
    }

    // Validate that startTime < endTime before submitting
    if (startTime >= endTime) {
      Swal.fire({
        icon: 'error',
        title: 'ช่วงเวลาไม่ถูกต้อง',
        text: 'เวลาเริ่มต้นต้องอยู่ก่อนเวลาสิ้นสุด',
        confirmButtonColor: '#171717'
      });
      return;
    }

    const finalRoom = selectedRoom === 'Other' ? otherRoomText : selectedRoom;
    if (checkRoomBusy(finalRoom)) {
      Swal.fire({
        icon: 'error',
        title: 'ห้องไม่ว่าง',
        text: 'ห้องนี้ถูกจองใช้ในช่วงเวลาที่ท่านเลือกแล้ว กรุณาเลือกเวลาอื่นหรือเปลี่ยนห้อง',
        confirmButtonColor: '#171717'
      });
      return;
    }

    const success = onSubmitRoomRequest({
      date: requestDate,
      timeRange: `${startTime} - ${endTime}`,
      room: finalRoom,
      requesterId: currentUser.id,
      requesterName: `${currentUser.firstName} ${currentUser.lastName}`,
      requesterRole: currentUser.role,
      department,
      phone,
      purpose,
      signature: requestSignature,
    });

    if (success) {
      setPurpose('');
      setDepartment('');
      setPhone('');
      setRequestSignature('');
      Swal.fire({ icon: 'success', title: 'จองเรียบร้อย', text: 'ส่งใบคำขอกุญแจห้องแล้วรอฝ่ายข่างอนุมัติ', confirmButtonColor: '#171717' });
    }
  };

  const handleUsageRecordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!usageDate || !usageRoomName || !usageReportText) {
      Swal.fire({ icon: 'error', title: 'ผิดพลาด', text: 'กรุณากรอกข้อมูลให้ครบถ้วน', confirmButtonColor: '#171717' });
      return;
    }
    if (!usageSignature) {
      Swal.fire({ icon: 'error', title: 'ต้องการลายเซ็น', text: 'ผู้เข้าใช้ห้องต้องลงลายเซ็นรับรองความรับผิดชอบ', confirmButtonColor: '#171717' });
      return;
    }
    if (onAddUsageRecord) {
      onAddUsageRecord({
        date: usageDate,
        room: usageRoomName,
        requesterName: `${currentUser.firstName} ${currentUser.lastName}`,
        report: usageReportText,
        remarks: 'บันทึกเข้าใช้งานห้องปฏิบัติการ (ไม่ต้องขอจอง)',
        requesterSignature: usageSignature,
      });
      setUsageRoomName('');
      setUsageReportText('');
      setUsageSignature('');
      Swal.fire({ icon: 'success', title: 'บันทึกสำเร็จ', text: 'บันทึกประวัติการใช้งานห้องปฏิบัติการ (TLTC-MO-034) เรียบร้อย', confirmButtonColor: '#10b981' });
    }
  };

  const handleCreateSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!schCode || !schName || !schStart || !schEnd || !schTeacher) {
      Swal.fire({ icon: 'error', title: 'ผิดพลาด', text: 'กรุณากรอกข้อมูลหลักสูตรที่เปิดสอนครบถ้วน', confirmButtonColor: '#171717' });
      return;
    }

    if (schDays.length === 0) {
      Swal.fire({ icon: 'error', title: 'ผิดพลาด', text: 'กรุณาเลือกวันที่มีเรียนอย่างน้อย 1 วัน', confirmButtonColor: '#171717' });
      return;
    }

    const schedulesToSubmit = schDays.map((day, index) => ({
      id: `SCH-${Date.now()}-${index}`,
      batch: schBatch,
      subjectCode: schCode,
      subjectName: schName,
      dayOfWeek: day,
      startDate: schStart,
      endDate: schEnd,
      instructorName: schTeacher,
      startTime: schStartTime || '08:30',
      endTime: schEndTime || '16:30',
    }));

    onAddSchedule(schedulesToSubmit);

    setSchCode('');
    setSchName('');
    setSchTeacher('');
    Swal.fire({ icon: 'success', title: 'เปิดวิชาสอนสำเร็จ', text: 'ตารางเรียนได้รับการบันทึกลงปฏิทินเรียบร้อย', confirmButtonColor: '#171717' });
  };

  const handleScheduleExam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!exDate || !exSubject) {
      Swal.fire({ icon: 'error', title: 'ผิดพลาด', text: 'กรุณากรอกข้อมูลสอบให้ครบถ้วน', confirmButtonColor: '#171717' });
      return;
    }

    onAddExam({
      id: `EXM-${Date.now()}`,
      batch: exBatch,
      date: exDate,
      time: exTime,
      subjectName: exSubject,
    });

    const activeExSubjects = Array.from(
      new Set(
        classSchedules
          .filter((s) => s.batch === exBatch)
          .map((s) => `${s.subjectCode} ${s.subjectName}`)
      )
    );
    setExSubject(activeExSubjects.length > 0 ? activeExSubjects[0] : '');
    Swal.fire({ icon: 'success', title: 'นัดหมายสอบสำเร็จ', text: 'เพิ่มวิชาสอบเข้านัดหมายแล้ว', confirmButtonColor: '#171717' });
  };

  const handlePublishGrades = (e: React.FormEvent) => {
    e.preventDefault();
    if (!gradeSubject) {
      Swal.fire({ icon: 'error', title: 'ผิดพลาด', text: 'กรุณากรอกวิชาเพื่อรายงานเกรด', confirmButtonColor: '#171717' });
      return;
    }

    const studentRoster = users.filter(u => {
      if (u.role !== 'นักศึกษา') return false;
      const stdBatch = String(u.id || '').substring(0, 2);
      return stdBatch === gradeBatch;
    });
    const parsedGrades = studentRoster.map(std => ({
      studentId: std.id,
      studentName: `${std.firstName} ${std.lastName}`,
      score: studentGrades[std.id] || 0,
    }));

    onAddGrade({
      id: `GR-${Date.now()}`,
      batch: gradeBatch,
      subjectName: gradeSubject,
      round: gradeRound,
      grades: parsedGrades,
    });

    const activeGradeSubjects = Array.from(
      new Set(
        classSchedules
          .filter((s) => s.batch === gradeBatch)
          .map((s) => `${s.subjectCode} ${s.subjectName}`)
      )
    );
    setGradeSubject(activeGradeSubjects.length > 0 ? activeGradeSubjects[0] : '');
    setStudentGrades({});
    Swal.fire({ icon: 'success', title: 'ประกาศผลสอบแล้ว', text: 'คะแนนถูกส่งเข้าสู่ตารางคะแนนนักศึกษา', confirmButtonColor: '#171717' });
  };

  // Simulate scanning of QR code
  const handleSimulateScan = (codeToScan: string) => {
    const match = equipments.find(eq => eq.code.toLowerCase() === codeToScan.toLowerCase().trim());
    if (match) {
      setScannedTool(match);
      setTargetCode(match.code);
      setIsCameraActive(false);
      Swal.fire({ icon: 'success', title: 'พบอุปกรณ์ช่าง', text: `อุปกรณ์: ${match.toolName} (คงเหลือ: ${match.qty} EA)`, confirmButtonColor: '#171717' });
    } else {
      Swal.fire({ icon: 'error', title: 'ไม่พบรหัสอุปกรณ์', text: 'คิวอาร์โค้ดนี้ไม่ได้ถูกจดจำในโรงซ่อมบำรุง', confirmButtonColor: '#171717' });
    }
  };

  const handleBorrowSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetCode) {
      Swal.fire({ icon: 'error', title: 'ระบุรหัสคิวอาร์โค้ด', text: 'โปรดสแกนป้ายคิวอาร์โค้ดหรือป้อนรหัสอุปกรณ์ก่อน', confirmButtonColor: '#171717' });
      return;
    }
    const match = equipments.find(eq => eq.code === targetCode);
    if (!match) {
      Swal.fire({ icon: 'error', title: 'ไม่พบอุปกรณ์', text: 'ไม่พบเครื่องมือชิ้นนี้ในรายการ', confirmButtonColor: '#171717' });
      return;
    }
    if (match.qty === 0 || match.status === 'NotReady' || match.status === 'Damaged' || match.status === 'Calibrating') {
      Swal.fire({
        icon: 'error',
        title: 'เครื่องมือไม่พร้อมใช้งาน',
        text: 'อุปกรณ์ชิ้นนี้ไม่อยู่ในสถานะพร้อมให้ยืมบริการขณะนี้ (เนื่องจากชำรุด สอบเทียบ หรือหมดคลัง)',
        confirmButtonColor: '#171717'
      });
      return;
    }
    const totalBorrowed = borrowRecords
      .filter(r => r.equipmentCode === match.code && r.status !== 'Returned')
      .reduce((sum, r) => sum + r.qty, 0);
    const available = match.qty - totalBorrowed;

    if (available < borrowQty) {
      Swal.fire({ icon: 'warning', title: 'ของไม่พอ', text: 'จำนวนอุปกรณ์ในคลังมีไม่เพียงพอต่อการยืมปฏิบัติการครั้งนี้', confirmButtonColor: '#171717' });
      return;
    }
    if (!borrowSignature) {
      Swal.fire({ icon: 'error', title: 'โปรดลงนามและเซ็นลายเซ็น', text: 'จำเป็นต้องวาดลายมือชื่ออิเล็กทรอนิกส์ด้านล่างก่อนยืมอุปกรณ์', confirmButtonColor: '#171717' });
      return;
    }

    onBorrowEquipment(targetCode, borrowQty, borrowSignature);
    setTargetCode('');
    setBorrowQty(1);
    setBorrowSignature('');
    setScannedTool(null);
    Swal.fire({ icon: 'success', title: 'เบิกจ่ายเครื่องมือสำเร็จ', text: 'อุปกรณ์ถูกโอนย้ายสถานะ และสิทธิ์ในการพายึดเรียบร้อย', confirmButtonColor: '#171717' });
  };

  const getThemeStyles = () => {
    switch (idCardTheme) {
      case 'official':
        return {
          bgClass: 'bg-white text-neutral-950 border border-neutral-300',
          textColor: 'text-neutral-950',
          descColor: 'text-neutral-500',
          subDescColor: 'text-neutral-400',
          tagClass: 'bg-neutral-950 text-white font-extrabold',
          stripeClass: 'bg-neutral-950',
          labelColor: 'text-neutral-500',
          subLabelColor: 'text-neutral-950 font-extrabold',
          photoBorder: 'border-neutral-950',
          dashedBorder: 'border-neutral-300',
          footerBorder: 'border-neutral-250',
          qrBorder: 'border-neutral-300',
          sigClass: 'filter grayscale mix-blend-multiply'
        };
      case 'dark':
        return {
          bgClass: 'bg-gradient-to-br from-zinc-950 via-zinc-900 to-neutral-900 text-white border border-zinc-700/50',
          textColor: 'text-white',
          descColor: 'text-zinc-400',
          subDescColor: 'text-zinc-500',
          tagClass: 'bg-orange-600 text-orange-100 font-extrabold',
          stripeClass: 'bg-orange-500',
          labelColor: 'text-zinc-400',
          subLabelColor: 'text-orange-400 font-extrabold',
          photoBorder: 'border-orange-500',
          dashedBorder: 'border-zinc-800',
          footerBorder: 'border-zinc-800',
          qrBorder: 'border-zinc-750',
          sigClass: 'invert opacity-95'
        };
      case 'emerald':
        return {
          bgClass: 'bg-gradient-to-br from-slate-950 via-emerald-950 to-teal-950 text-white border border-emerald-800/40',
          textColor: 'text-white',
          descColor: 'text-emerald-300',
          subDescColor: 'text-emerald-500',
          tagClass: 'bg-emerald-600 text-emerald-100 font-extrabold',
          stripeClass: 'bg-emerald-500',
          labelColor: 'text-emerald-300',
          subLabelColor: 'text-emerald-400 font-extrabold',
          photoBorder: 'border-emerald-500',
          dashedBorder: 'border-emerald-900',
          footerBorder: 'border-emerald-900',
          qrBorder: 'border-emerald-800',
          sigClass: 'invert opacity-95'
        };
      case 'gold':
        return {
          bgClass: 'bg-gradient-to-br from-[#121212] via-[#241f12] to-[#121212] text-yellow-105 border border-yellow-800/50',
          textColor: 'text-yellow-100',
          descColor: 'text-yellow-500/80',
          subDescColor: 'text-yellow-600/50',
          tagClass: 'bg-yellow-650 text-slate-950 font-black',
          stripeClass: 'bg-yellow-650',
          labelColor: 'text-yellow-500/80',
          subLabelColor: 'text-yellow-400 font-extrabold',
          photoBorder: 'border-yellow-650',
          dashedBorder: 'border-yellow-900/40',
          footerBorder: 'border-yellow-905/30',
          qrBorder: 'border-yellow-902/50',
          sigClass: 'invert opacity-95'
        };
      case 'minimal':
        return {
          bgClass: 'bg-[#fafafa] text-neutral-900 border-2 border-neutral-850',
          textColor: 'text-neutral-900',
          descColor: 'text-neutral-500',
          subDescColor: 'text-neutral-400',
          tagClass: 'bg-neutral-900 text-white font-extrabold',
          stripeClass: 'bg-neutral-800',
          labelColor: 'text-neutral-500',
          subLabelColor: 'text-neutral-900 font-extrabold',
          photoBorder: 'border-neutral-900',
          dashedBorder: 'border-neutral-300',
          footerBorder: 'border-neutral-250',
          qrBorder: 'border-neutral-300',
          sigClass: 'filter grayscale mix-blend-multiply'
        };
      case 'navy':
      default:
        return {
          bgClass: 'bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white border border-slate-700/50',
          textColor: 'text-white',
          descColor: 'text-indigo-300',
          subDescColor: 'text-indigo-500',
          tagClass: 'bg-blue-600 text-blue-50 font-extrabold',
          stripeClass: 'bg-blue-500',
          labelColor: 'text-indigo-300',
          subLabelColor: 'text-yellow-400 font-extrabold',
          photoBorder: 'border-blue-500',
          dashedBorder: 'border-slate-850',
          footerBorder: 'border-slate-850',
          qrBorder: 'border-slate-700',
          sigClass: 'invert opacity-95'
        };
    }
  };

  const renderIdCardFront = (mode: 'screen' | 'print') => {
    const t = getThemeStyles();
    const isPrint = mode === 'print';
    const containerClass = isPrint
      ? `${t.bgClass} physical-card relative flex flex-col justify-between overflow-hidden p-[4.2mm] rounded-[3mm]`
      : `${t.bgClass} w-[340px] h-[215px] select-none rounded-2xl shadow-xl relative flex flex-col justify-between overflow-hidden p-4 transition-all hover:scale-101 hover:shadow-2xl`;

    return (
      <div className={containerClass} style={{ boxSizing: 'border-box' }}>
        {/* Subtle aircraft grid watermark background */}
        <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />
        
        {/* Card Header */}
        <div className="flex justify-between items-start z-10 w-full">
          <div className="flex flex-col text-left">
            <span className={`text-[8.5px] font-black uppercase tracking-wider leading-tight ${idCardTheme === 'minimal' ? 'text-black font-extrabold' : 'text-slate-200'}`}>
              {idCardDept}
            </span>
            <span className="text-[6.5px] font-mono font-bold tracking-widest text-[#F59E0B] uppercase">
              AIRCRAFT MAINTENANCE SYSTEM
            </span>
          </div>
          <div className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${t.tagClass}`}>
            {idCardTitle}
          </div>
        </div>

        {/* Card Body */}
        <div className="flex gap-3 my-1 items-center flex-1 z-10 w-full">
          <div className="relative shrink-0 w-[58px] h-[72px] border-2 border-white/80 rounded overflow-hidden shadow-md bg-stone-100">
            <img 
              src={editPhoto || currentUser.photoUrl} 
              alt="Photo" 
              className="w-full h-full object-cover" 
              referrerPolicy="no-referrer"
            />
          </div>

          <div className="flex-1 min-w-0 flex flex-col justify-center text-left">
            <span className="block text-[6.5px] text-zinc-400 font-bold uppercase">NAME-SURNAME</span>
            <div className={`text-[12.5px] font-black tracking-tight truncate uppercase leading-tight ${idCardTheme === 'minimal' ? 'text-neutral-950 font-black' : 'text-white'}`}>
              {editFirstName} {editLastName}
            </div>
            
            <div className="text-[8.5px] font-sans font-medium mt-0.5">
              <span className="text-zinc-400 uppercase text-[6.5px] block font-bold">POSITION</span>
              <span className={`font-black ${idCardTheme === 'minimal' ? 'text-neutral-800 text-xs font-bold' : 'text-white'}`}>{currentUser.role || 'นักศึกษา'}</span>
            </div>

            {/* Batch & Code details info */}
            <div className="grid grid-cols-2 gap-2 mt-1 border-t border-dashed border-white/20 pt-1">
              <div>
                <span className="block text-[5.5px] text-zinc-400 font-bold uppercase">COHORT / BATCH</span>
                <span className={`block font-mono text-[9px] font-extrabold ${t.subLabelColor}`}>
                  รุ่น {idCardCustomBatch}
                </span>
              </div>
              <div>
                <span className="block text-[5.5px] text-zinc-400 font-bold uppercase">IDENTIFICATION</span>
                <span className={idCardTheme === 'minimal' ? "block font-mono text-[9px] font-extrabold text-neutral-900" : "block font-mono text-[9px] font-extrabold text-white"}>
                  {currentUser.id}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Card Footer */}
        <div className="flex justify-between items-end border-t border-dashed border-white/20 pt-1 mt-0.5 z-10 w-full">
          <div>
            {idCardShowBarcode && (
              <div className="bg-white p-0.5 rounded flex flex-col items-center select-none scale-90 origin-left">
                <div className="flex gap-[0.8px] h-3 items-center">
                  <span className="w-[1.2px] h-full bg-black"></span>
                  <span className="w-[0.6px] h-full bg-black"></span>
                  <span className="w-[1px] h-full bg-black"></span>
                  <span className="w-[2px] h-full bg-black"></span>
                  <span className="w-[0.6px] h-full bg-black"></span>
                  <span className="w-[1.2px] h-full bg-black"></span>
                  <span className="w-[1px] h-full bg-black"></span>
                  <span className="w-[2px] h-full bg-black"></span>
                  <span className="w-[0.6px] h-full bg-black"></span>
                  <span className="w-[1.2px] h-full bg-black"></span>
                </div>
                <span className="text-[4.5px] font-mono leading-none font-bold text-black select-none">
                  *{currentUser.id}*
                </span>
              </div>
            )}
          </div>

          <div className="text-right">
            {idCardShowSignature && editSig && (
              <div className="relative inline-block mr-1 text-center">
                <img 
                  src={editSig} 
                  alt="Sign" 
                  className={`h-5 object-contain bg-transparent ${idCardTheme === 'minimal' ? 'brightness-50' : 'invert opacity-95'} mx-auto`} 
                  referrerPolicy="no-referrer"
                />
                <div className="w-[45px] h-[0.5px] bg-white/40 border-t border-dashed mt-0.5"></div>
                <span className="block text-[5px] text-slate-400 font-bold uppercase tracking-wider">SIGNATURE</span>
              </div>
            )}
          </div>
        </div>

        {/* Dynamic decorative colored safety stripe at the very bottom */}
        <div className={`absolute bottom-0 left-0 right-0 h-1.5 ${t.stripeClass}`} />
      </div>
    );
  };

  const renderIdCardBack = (mode: 'screen' | 'print') => {
    const t = getThemeStyles();
    const isPrint = mode === 'print';
    const containerClass = isPrint
      ? `${t.bgClass} physical-card relative flex flex-col justify-between overflow-hidden p-[4.2mm] rounded-[3mm]`
      : `${t.bgClass} w-[340px] h-[215px] select-none rounded-2xl shadow-xl relative flex flex-col justify-between overflow-hidden p-4 transition-all hover:scale-101 hover:shadow-2xl`;

    return (
      <div className={containerClass} style={{ boxSizing: 'border-box' }}>
        <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

        {/* Card Header - Terms of Use */}
        <div className="flex justify-between items-start z-10 w-full">
          <div className="text-left">
            <h6 className="text-[7.5px] font-sans font-black uppercase tracking-wider leading-none text-amber-500">
              ข้อตกลงและเงื่อนไขความปลอดภัย
            </h6>
            <span className="text-[6px] tracking-widest text-slate-300 font-mono block mt-0.5 uppercase">
              TERMS AND CONDITIONS OF USAGE
            </span>
          </div>
          <span className="text-[8px] font-bold text-slate-400 select-none">CR-80 SECURE PASS</span>
        </div>

        {/* Terms list & QR side-by-side */}
        <div className="flex gap-3 justify-between items-center my-1.5 flex-1 z-10 w-full">
          {/* Rules List */}
          <div className="flex-1 text-[6.5px] text-slate-300 space-y-1 font-sans leading-tight text-left">
            <p className="flex items-start gap-1">
              <span className="text-amber-500">1.</span>
              <span>บัตรนี้เป็นทรัพย์สินสถาบันศึกษา บัญญัติให้ติดตัวไว้ตลอดเวลาขณะปฏิบัติบำรุงในโรงเก็บอากาศยาน (Wear card always in hangar)</span>
            </p>
            <p className="flex items-start gap-1">
              <span className="text-amber-500">2.</span>
              <span>ไม่อนุญาตให้ผู้อื่นยืมใช้โดยตรง หากฝ่าฝืนมีโทษปรับทางกฎระเบียบวินัยขั้นสูงสุด (Strictly non-transferable)</span>
            </p>
            <p className="flex items-start gap-1">
              <span className="text-amber-500">3.</span>
              <span>หากเก็บได้โปรดนำคืน แผนกพัฒนาการจัดฝึกอบรมช่างและบำรุงอากาศยาน ทันที (If found, reward upon returning)</span>
            </p>
          </div>

          {/* Large dynamic QR Code - Satisfies request "สร้างQR ให้ใหญ่กว่านี้นิดหนึ่ง" */}
          <div className="shrink-0 flex flex-col items-center bg-white p-1 rounded-lg border border-neutral-300 shadow-xs select-none">
            <img 
              src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(getAppOriginForQR() + '/?id=' + currentUser.id)}`} 
              alt="QR Check" 
              className="w-11 h-11 rounded border border-neutral-100 p-0.5 animate-pulse"
              referrerPolicy="no-referrer"
            />
            <span className="text-[4.5px] font-mono font-bold text-neutral-500 mt-0.5 uppercase tracking-widest leading-none scale-90">CHECK ID</span>
            <span className="text-[5.5px] text-[#0F172A] font-extrabold mt-0.5 leading-none">{currentUser.id}</span>
          </div>
        </div>

        {/* Back Card Footer - Authorized sign off */}
        <div className="flex justify-between items-end border-t border-dashed border-white/20 pt-1.5 z-10 mt-0.5 w-full">
          <div className="text-[5.5px] text-slate-400 font-mono text-left">
            <span>ISSUED BY ACADEMIC AVIATION COUNCIL</span>
            <span className="block mt-0.5">© 2026 AVIATION MAINTENANCE SYSTEM.</span>
          </div>

          {/* Chief approval signature line */}
          <div className="text-right flex flex-col items-center mr-1">
            <span className="text-[8px] font-serif italic font-extrabold tracking-wide text-[#E2E8F0]/80 leading-none select-none opacity-80 h-3 flex items-center">
              Adm. Chief Commander
            </span>
            <div className="w-[50px] h-[0.5px] bg-white/40 border-t border-dashed mt-0.5"></div>
            <span className="text-[5px] text-slate-400 font-bold tracking-wider uppercase leading-none mt-0.5">AUTHORIZATION</span>
          </div>
        </div>

        {/* Dynamic decorative colored safety stripe at the very bottom */}
        <div className={`absolute bottom-0 left-0 right-0 h-1.5 ${t.stripeClass}`} />
      </div>
    );
  };

  const renderIdCardVertical = (mode: 'screen' | 'print') => {
    const t = getThemeStyles();
    const isPrint = mode === 'print';

    const containerClass = isPrint
      ? `${t.bgClass} physical-card-vertical relative flex flex-col justify-between items-center text-center overflow-hidden p-[4.2mm] rounded-[3mm] h-[85.6mm] w-[53.98mm] shadow-none`
      : `${t.bgClass} w-[245px] h-[382px] select-none rounded-[14px] shadow-xl relative flex flex-col justify-between items-center text-center overflow-hidden p-4 transition-all hover:scale-101 hover:shadow-2xl`;

    return (
      <div className={containerClass} style={{ boxSizing: 'border-box' }}>
        {/* Header Accent block */}
        <div className={`absolute top-0 left-0 right-0 h-1.5 ${t.stripeClass}`} />
        
        {/* School Brand */}
        <div className="mt-2 w-full text-center">
          <h4 className={`font-sans font-extrabold text-[12.5px] uppercase tracking-wider font-black ${t.textColor}`}>
            {idCardDept}
          </h4>
          <p className={`font-sans text-[7.5px] font-bold block mt-0.5 leading-tight ${t.descColor}`}>
            สถาบันฝึกอบรมช่างบำรุงรักษาอากาศยาน
          </p>
          <p className={`font-mono text-[6.5px] mt-0.5 tracking-wider font-bold ${t.subDescColor}`}>
            AIRCRAFT MAINTENANCE TRAINING CENTER
          </p>
        </div>

        {/* Photo */}
        <div className="my-1.5 shrink-0 flex justify-center">
          <div className={`border-2 ${t.photoBorder} rounded-xs overflow-hidden bg-neutral-100 relative ${isPrint ? 'w-[20mm] h-[24mm]' : 'w-20 h-24'}`}>
            <img
              src={editPhoto || currentUser.photoUrl}
              alt="Photo"
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>

        {/* User Info Details */}
        <div className="w-full text-center">
          <h3 className={`font-sans font-extrabold text-[12px] truncate leading-tight uppercase ${t.textColor}`}>
            {editFirstName} {editLastName}
          </h3>
          <p className={`font-sans text-[9px] font-extrabold uppercase tracking-wide mt-0.5 leading-none ${t.descColor}`}>
            ตำแหน่ง: {currentUser.role || 'นักศึกษา'}
          </p>
          <p className={`font-mono text-[9px] font-bold mt-1 leading-none ${t.descColor}`}>
            ID: {currentUser.id}
          </p>
        </div>

        {/* QR Code Section - styled for durability and easy scan with white bg */}
        <div className="my-2 select-none flex flex-col items-center">
          <img 
            src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(getAppOriginForQR() + '/?id=' + currentUser.id)}`} 
            alt="QR Verification" 
            className={`w-16 h-16 border ${t.qrBorder} p-1 bg-white shadow-xs rounded-md`} 
            referrerPolicy="no-referrer"
          />
          <span className={`text-[6.5px] font-mono tracking-widest mt-1 uppercase font-bold ${t.descColor}`}>VERIFY QR CODE</span>
        </div>

        {/* Signature Area */}
        <div className={`w-full border-t border-dashed ${t.dashedBorder} pt-1 flex flex-col items-center shrink-0`}>
          {idCardShowSignature && editSig ? (
            <img
              src={editSig}
              alt="ลายมือชื่อ"
              className={`h-4.5 object-contain pointer-events-none ${t.sigClass}`}
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className={`h-4.5 text-[8px] italic flex items-center justify-center ${t.descColor}`}>ไม่มีลายเซ็น</div>
          )}
          <span className={`text-[7px] font-sans mt-0.5 ${t.descColor}`}>ลายมือชื่อผู้ถือบัตร</span>
        </div>

        {/* Footer stamp */}
        <div className={`w-full flex items-center justify-between border-t ${t.footerBorder} pt-1 text-[6.5px] font-mono uppercase leading-none mb-0.5 ${t.descColor}`}>
          <span>REG: {currentUser.createdAt || '23/04/2025'}</span>
          <span>TLTC CARD</span>
        </div>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 text-slate-850 font-sans text-xs">
      
      {/* Sidebar Navigation */}
      <div className="lg:col-span-1 bg-white border border-slate-200 p-4 rounded-xl shadow-sm flex flex-col gap-1.5">
        <h4 className="font-sans font-extrabold text-[10px] uppercase text-slate-400 mb-2 tracking-widest border-b border-slate-100 pb-1.5 font-bold">
          ระบบสารสนเทศสำหรับการช่าง
        </h4>

        <button
          id="seoStudentProfileBtn"
          onClick={() => setActiveTab('profile')}
          className={`w-full py-2 px-3 text-left rounded-lg font-sans font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'profile' ? 'bg-[#0F172A] text-white shadow-xs' : 'hover:bg-slate-50 text-slate-650 hover:text-slate-900'
          }`}
        >
          <Star size={14} />
          <span>ข้อมูลห้องเรียนของฉัน</span>
        </button>

        {/* If Office Staff or Instructor, show direct button for "จัดการตารางเรียนและสอน" */}
        {(isOffice || isInstructor) && (
          <button
            id="seoScheduleBtn"
            onClick={() => {
              setActiveTab('action');
              setInstActionTab('schedule');
            }}
            className={`w-full py-2 px-3 text-left rounded-lg font-sans font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'action' && instActionTab === 'schedule' ? 'bg-[#0F172A] text-white shadow-xs' : 'hover:bg-slate-50 text-slate-650 hover:text-slate-900'
            }`}
          >
            <Calendar size={14} />
            <span>จัดการตารางเรียนและสอน</span>
          </button>
        )}

        {/* If Exam Staff, show "จัดประกาศสอบ & คะแนน" */}
        {isExam && (
          <button
            id="seoExamActionBtn"
            onClick={() => setActiveTab('action')}
            className={`w-full py-2 px-3 text-left rounded-lg font-sans font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'action' ? 'bg-[#0F172A] text-white shadow-xs' : 'hover:bg-slate-50 text-slate-650 hover:text-slate-900'
            }`}
          >
            <Calendar size={14} />
            <span>จัดประกาศสอบ & คะแนน</span>
          </button>
        )}

        {/* "ขอใช้พื้นที่ห้องปฏิบัติการ/บันทึกการขอใช้ห้อง" - Now a direct button for Students, Instructors, and Office! */}
        {(isStudent || isInstructor || isOffice) && (
          <button
            id="seoRoomRequestSidebarBtn"
            onClick={() => {
              setActiveTab('action');
              if (isInstructor || isOffice) {
                setInstActionTab('room');
              }
            }}
            className={`w-full py-2 px-3 text-left rounded-lg font-sans font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'action' && (isStudent || instActionTab === 'room') ? 'bg-[#0F172A] text-white shadow-xs' : 'hover:bg-slate-50 text-slate-650 hover:text-slate-900'
            }`}
          >
            <Calendar size={14} />
            <span>ขอใช้พื้นที่ห้องปฏิบัติการ/บันทึกการขอใช้ห้อง</span>
          </button>
        )}

        {!isOffice && !isExam && (
          <button
            id="seoBorrowBtn"
            onClick={() => setActiveTab('borrow')}
            className={`w-full py-2 px-3 text-left rounded-lg font-sans font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'borrow' ? 'bg-[#0F172A] text-white shadow-xs' : 'hover:bg-slate-50 text-slate-650 hover:text-slate-900'
            }`}
          >
            <Wrench size={14} />
            <span>เบิกจ่าย/คืนเครื่องมือช่าง</span>
          </button>
        )}

        <button
          id="seoRosterBtn"
          onClick={() => setActiveTab('roster')}
          className={`w-full py-2 px-3 text-left rounded-lg font-sans font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'roster' ? 'bg-[#0F172A] text-white shadow-xs' : 'hover:bg-slate-50 text-slate-650 hover:text-slate-900'
          }`}
        >
          <Users size={14} />
          <span>ทำเนียบเพื่องร่วมรุ่น / บุคลากร</span>
        </button>

        <button
          id="seoRequestsBtn"
          onClick={() => setActiveTab('requests')}
          className={`w-full py-2 px-3 text-left rounded-lg font-sans font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'requests' ? 'bg-[#0F172A] text-white shadow-xs' : 'hover:bg-slate-50 text-slate-650 hover:text-slate-900'
          }`}
        >
          <BookOpen size={14} />
          <span>เอกสารคำขอของฉัน</span>
        </button>

        {isStudent && (
          <button
            id="seoAcademicBtn"
            onClick={() => setActiveTab('academic')}
            className={`w-full py-2 px-3 text-left rounded-lg font-sans font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'academic' ? 'bg-[#0F172A] text-white shadow-xs' : 'hover:bg-slate-50 text-slate-650 hover:text-slate-900'
            }`}
          >
            <Award size={14} />
            <span>ข้อมูลการเรียน</span>
          </button>
        )}
      </div>

      {/* Main Content Area */}
      <div className="lg:col-span-3 bg-white border border-slate-200 p-6 rounded-xl shadow-sm min-h-[400px]">
        
        {/* TAB 1: USER INFO / STUDENT REVIEWS */}
        {activeTab === 'profile' && (
          <div className="space-y-6 animate-fade-in">
            <h3 className="font-sans font-extrabold text-sm border-b pb-2 flex items-center justify-between">
              <span>ประวัติข้อมูลส่วนตัวและผลการจองของฉัน ({currentUser.role})</span>
              <span className="font-mono text-[10px] text-neutral-500">ID: {currentUser.id}</span>
            </h3>

            {/* EDIT PROFILE SECTION */}
            <form onSubmit={handleUpdateProfileSubmit} className="space-y-4 bg-stone-50 border border-neutral-300 p-4 rounded">
              <div className="flex items-center justify-between border-b pb-1">
                <h4 className="font-bold text-neutral-900 text-xs">แก้ไขประวัติข้อมูลและรูปภาพลายเซ็น</h4>
                
                
              </div>
              
              <div className="flex flex-col sm:flex-row items-center gap-6 p-2 rounded mb-1">
                <div className="w-16 h-20 rounded border border-neutral-400 overflow-hidden shrink-0">
                  <img src={editPhoto} alt="avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </div>
                <div className="space-y-1 w-full">
                  <span className="font-bold text-[10px] text-neutral-700">อัปเดตไฟล์รูปถ่ายประจำตัวผู้ใช้:</span>
                  {isEditingProfile ? (
                    <input
                      id="seoPhotoUploadInput"
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) {
                          const r = new FileReader();
                          r.onloadend = () => setEditPhoto(r.result as string);
                          r.readAsDataURL(f);
                        }
                      }}
                      className="block text-[10px] text-neutral-400 file:mr-2 file:py-0.5 file:px-2 file:rounded file:border-0 file:text-[9px] file:font-semibold file:bg-neutral-950 file:text-white hover:file:bg-neutral-850 cursor-pointer"
                    />
                  ) : (
                    <p className="text-[10px] text-neutral-500 italic">* กดปุ่มแก้ไขข้อมูลเพื่อเลือกไฟล์รูปภาพใหม่</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-bold text-neutral-800 mb-0.5">ชื่อจริง *</label>
                  <input 
                    type="text" 
                    required 
                    disabled={!isEditingProfile} 
                    value={editFirstName} 
                    onChange={(e) => setEditFirstName(e.target.value)} 
                    className={`w-full border px-2 py-1 rounded focus:outline-none text-xs transition-colors ${!isEditingProfile ? 'bg-neutral-150 border-neutral-250 text-neutral-500 cursor-not-allowed' : 'bg-white border-neutral-300'}`} 
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-neutral-800 mb-0.5">นามสกุล *</label>
                  <input 
                    type="text" 
                    required 
                    disabled={!isEditingProfile} 
                    value={editLastName} 
                    onChange={(e) => setEditLastName(e.target.value)} 
                    className={`w-full border px-2 py-1 rounded focus:outline-none text-xs transition-colors ${!isEditingProfile ? 'bg-neutral-150 border-neutral-250 text-neutral-500 cursor-not-allowed' : 'bg-white border-neutral-300'}`} 
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-bold text-neutral-800 mb-0.5">อีเมลผู้ใช้งาน *</label>
                  <input 
                    type="email" 
                    required 
                    disabled={!isEditingProfile} 
                    value={editEmail} 
                    onChange={(e) => setEditEmail(e.target.value)} 
                    className={`w-full border px-2 py-1 rounded focus:outline-none text-xs font-mono transition-colors ${!isEditingProfile ? 'bg-neutral-150 border-neutral-250 text-neutral-500 cursor-not-allowed' : 'bg-white border-neutral-300'}`} 
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-neutral-800 mb-0.5">เปลี่ยนรหัสผ่านเพื่อเข้าใช้งานรอบถัดไป *</label>
                  <input 
                    type="password" 
                    required 
                    disabled={!isEditingProfile} 
                    value={editPassword} 
                    onChange={(e) => setEditPassword(e.target.value)} 
                    className={`w-full border px-2 py-1 rounded focus:outline-none text-xs font-mono transition-colors ${!isEditingProfile ? 'bg-neutral-150 border-neutral-250 text-neutral-500 cursor-not-allowed' : 'bg-white border-neutral-300'}`} 
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[9px] font-bold text-neutral-800">ปรับแก้ลายเซ็นมือถือรับรองรายงาน *</label>
                {!isEditingProfile ? (
                  <div className="w-full max-w-sm space-y-2">
                    <div className="w-full p-4 bg-stone-150 border border-neutral-300 rounded flex items-center justify-center min-h-[96px] select-none">
                      {editSig ? (
                        <img src={editSig} alt="Signature Preview" className="max-h-16 object-contain" referrerPolicy="no-referrer" />
                      ) : (
                        <span className="text-[11px] text-neutral-450 italic">ยังไม่มีลายเซ็นลงทะเบียน</span>
                      )}
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => setIsEditingProfile(true)}
                        className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded font-bold cursor-pointer text-[10px] shadow-sm transition-colors"
                      >
                        <Edit3 size={12} />
                        <span>แก้ไขข้อมูลส่วนตัว</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="w-full max-w-sm">
                    <SignaturePad onSave={(data) => setEditSig(data)} defaultValue={editSig} />
                  </div>
                )}
              </div>

              <div className="pt-3 border-t flex justify-end gap-2">
                {isEditingProfile && (
                  <>
                    <button
                      type="button"
                      onClick={handleCancelEditProfile}
                      className="flex items-center gap-1 bg-neutral-200 hover:bg-neutral-300 text-neutral-800 px-3 py-1.5 rounded font-bold cursor-pointer text-[10px] transition-colors"
                    >
                      <X size={12} />
                      <span>ยกเลิก (Cancel)</span>
                    </button>
                    <button 
                      id="saveSeoProfileBtn" 
                      type="submit" 
                      className="flex items-center gap-1 bg-[#0F172A] hover:bg-neutral-800 text-white px-4 py-1.5 rounded font-bold cursor-pointer text-[10px] shadow-sm transition-colors"
                    >
                      <span>บันทึกการแก้ไขข้อมูลส่วนตัวของฉัน</span>
                    </button>
                  </>
                )}
              </div>
            </form>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-6 p-6 bg-stone-100/50 border border-neutral-300 rounded-xl no-print">
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <img src={currentUser.photoUrl} alt="avatar" className="w-16 h-20 object-cover rounded border border-neutral-400 shrink-0 shadow-sm" referrerPolicy="no-referrer" />
                <div className="text-left">
                  <h4 className="font-bold text-neutral-900 text-sm">{currentUser.firstName} {currentUser.lastName}</h4>
                  <p className="font-sans text-[11px] text-neutral-600">ตำแหน่งการช่าง: <b>{currentUser.role}</b></p>
                  <span className="bg-emerald-50 text-emerald-800 border border-emerald-300 font-mono text-[10px] px-2 py-0.5 rounded font-bold mt-2 inline-block">
                    บัญชีพร้อมใช้งาน (Approved)
                  </span>
                </div>
              </div>
              
              {/* Profile QR Verification block - enlarged to meet user request */}
              <div className="flex flex-col items-center bg-white p-4 rounded-xl border border-neutral-300 shadow-sm shrink-0 select-none">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(getAppOriginForQR() + '/?id=' + currentUser.id)}`} 
                  alt="Student ID QR Code" 
                  className="w-24 h-24 rounded-lg border border-neutral-100 p-1"
                  referrerPolicy="no-referrer"
                />
                <span className="text-[8px] font-mono font-black text-neutral-500 mt-2 uppercase tracking-widest">VERIFICATION QR</span>
                <span className="text-[10px] text-[#0F172A] font-extrabold mt-0.5 font-mono">{currentUser.id}</span>
              </div>
            </div>

            {/* -------------------- CUSTOM ID CARD GENERATOR SECTION -------------------- */}
            <hr className="border-neutral-250 my-6 border-dashed no-print" />
            
            <div className="bg-slate-50 border border-slate-205 p-6 rounded-xl space-y-6 no-print text-left">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
                <div>
                  <h4 className="font-sans font-extrabold text-[#0F172A] text-sm flex items-center gap-2">
                    <span className="p-1.5 bg-[#0F172A] text-white rounded-md text-xs">🪪</span>
                    เครื่องมือออกแบบและระบบจัดทำสร้างบัตรขึ้นทะเบียนด้วยตนเอง (Personal ID Card Creator)
                  </h4>
                  <p className="text-slate-500 text-[11px] mt-1 font-sans">
                    ออกแบบ จัดหน้าตา และได้รับบัตรประจำตัวการช่างขนาดสากลพลาสติกจริง (CR-80: 8.56 ซม. x 5.40 ซม.) สัญชาติการวิชาอากาศยาน บันทึกพล็อตลงเครื่องพิมพ์ขนาด 1:1 ได้ทันที
                  </p>
                </div>
                
                <button
                  type="button"
                  onClick={() => {
                    window.print();
                  }}
                  className="flex items-center gap-1.5 bg-neutral-950 hover:bg-neutral-850 text-white px-4 py-2 rounded-lg font-sans font-extrabold cursor-pointer text-xs transition-all shadow-sm self-start md:self-center shrink-0"
                >
                  <Printer size={13} />
                  <span>สั่งพิมพ์บัตรประจำตัวส่วนตัว</span>
                </button>
              </div>

              {/* Designer controls and live card models layout */}
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                {/* Inputs settings col */}
                <div className="xl:col-span-5 space-y-4">
                  <div className="bg-white p-5 rounded-xl border border-slate-205 shadow-2xs space-y-4">
                    <h5 className="font-sans font-extrabold text-[#0F172A] text-[11px] uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200 pb-2.5">
                      <span>🎨</span> สีพื้นหลังบัตรประจำตัว (Background Theme Color)
                    </h5>

                    <p className="text-slate-500 text-[10.5px] font-sans leading-relaxed">
                      ปรับแต่งเปลี่ยนสีธีมพื้นหลังของบัตรประจำตัวการช่างตามที่คุณต้องการ โครงสร้าง ข้อมูลส่วนตัว และตำแหน่งจะยังคงความถูกต้องตามระเบียบสถาบันอย่างเสถียร
                    </p>

                    {/* Themes list selection grid */}
                    <div className="grid grid-cols-1 gap-2 pt-1">
                      {[
                        { key: 'minimal', label: 'Swiss Light (สีขาวราชการถนอมสายตา)', color: 'bg-white border-neutral-300 text-neutral-900 border shadow-xs' },
                        { key: 'navy', label: 'Dark Navy (น้ำเงินเข้มหรูหราประจำการ)', color: 'bg-slate-900 border-indigo-505 text-white' },
                        { key: 'dark', label: 'Stealth Black (ดำคาร์บอนพรีเมียมเข้มข่าว)', color: 'bg-zinc-950 border-orange-505 shadow-sm text-white' },
                        { key: 'emerald', label: 'Emerald Tech (เขียวมรกตเทคโนโลยีชั้นสูง)', color: 'bg-emerald-950 border-emerald-500 text-white' },
                        { key: 'gold', label: 'Security Gold (สีดำทองประดับเกียรติยศชั้นเอก)', color: 'bg-[#241f12] border-yellow-500 text-yellow-105' }
                      ].map(t => (
                        <button
                          key={t.key}
                          type="button"
                          onClick={() => setIdCardTheme(t.key as any)}
                          className={`flex items-center gap-3 p-3 rounded-lg border text-[10.5px] font-bold text-left cursor-pointer transition-all ${t.color} ${
                            idCardTheme === t.key ? 'ring-2 ring-blue-500 ring-offset-1 scale-101 border-transparent' : 'opacity-85 hover:opacity-100 bg-opacity-90'
                          }`}
                        >
                          <span className="w-3.5 h-3.5 rounded-full bg-current opacity-80 shrink-0 border border-slate-300" />
                          <span className="leading-tight block font-sans">{t.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* ID Card Display previews col */}
                <div className="xl:col-span-7 flex flex-col gap-5 items-center justify-center border-l border-slate-200/50 pl-2 xl:pl-6 min-h-[300px]">
                  <h5 className="font-bold text-slate-800 text-[10.5px] uppercase tracking-wide self-start flex items-center gap-1 select-none">
                    <span>✨</span> ตัวอย่างจำลองความแม่นยำสูง (LIVE DESIGN ACCURACY PREVIEW)
                  </h5>

                  <div className="flex flex-col items-center justify-center w-full py-4 animate-fade-in">
                    <span className="text-[9px] font-black uppercase text-[#F59E0B] tracking-wider mb-3 block bg-[#0F172A] px-3 py-1 rounded-full border border-yellow-500/10">
                      VERTICAL PORTRAIT PASS • แนวตั้งหน้าเดียวพร้อมคิวอาร์โค้ดสแกน
                    </span>
                    {renderIdCardVertical('screen')}
                  </div>
                </div>
              </div>
            </div>

            {/* Print layout section hidden on screen but specifically visible when printing */}
            <div className="hidden print:block font-sans print-layout">
              {renderIdCardVertical('print')}
            </div>

            <style>{`
              @media print {
                @page {
                  size: portrait;
                  margin: 0 !important;
                }
                body {
                  margin: 0 !important;
                  padding: 0 !important;
                  background: white !important;
                  color: black !important;
                }
                /* Hide header and footer */
                header, footer {
                  display: none !important;
                }
                /* Override display none for main when it contains the vertical print card */
                main.no-print:has(.print-layout) {
                  display: block !important;
                  position: absolute !important;
                  left: 0 !important;
                  top: 0 !important;
                  width: 100% !important;
                  height: 105% !important;
                  margin: 0 !important;
                  padding: 0 !important;
                  border: none !important;
                  box-shadow: none !important;
                  background: white !important;
                  overflow: visible !important;
                }
                /* Hide everything inside the main dashboard except our print layout */
                main.no-print:has(.print-layout) * {
                  visibility: hidden !important;
                }
                /* Specifically show print-layout and all its contents */
                .print-layout, .print-layout * {
                  visibility: visible !important;
                }
                .print-layout {
                  display: flex !important;
                  flex-direction: column !important;
                  justify-content: center !important;
                  align-items: center !important;
                  width: 100% !important;
                  height: 100vh !important;
                  position: fixed !important;
                  left: 0 !important;
                  top: 0 !important;
                  margin: 0 !important;
                  padding: 0 !important;
                  background: white !important;
                  z-index: 9999999 !important;
                }
                .physical-card-vertical {
                  width: 53.98mm !important;
                  height: 85.6mm !important;
                  border: 0.5px solid #d1d5db !important;
                  border-radius: 3.18mm !important;
                  box-sizing: border-box !important;
                  page-break-inside: avoid !important;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                  margin: auto !important;
                }
              }
            `}</style>

            {/* End of content */}
          </div>
        )}

        {/* TAB 1.5: ACADEMIC DATA */}
        {isStudent && activeTab === 'academic' && (
          <div className="animate-fade-in">
            <AcademicDataSection classSchedules={classSchedules} examSchedules={examSchedules} examGrades={examGrades} currentUser={currentUser} />
          </div>
        )}

        {/* TAB 2: SPECIAL ACTION PER POSITION (Form add) */}
        {activeTab === 'action' && (
          <div className="space-y-6 animate-fade-in">
            
            {/* Content per subtab */}

            {/* If (OFFICE or INSTRUCTOR) with 'schedule' subtab: ADD/EDIT SCHEDULES */}
            {((isOffice || isInstructor) && instActionTab === 'schedule') && (
              <form onSubmit={handleCreateSchedule} className="space-y-4">
                <h3 className="font-sans font-extrabold text-sm border-b pb-2 text-neutral-950 uppercase">
                  เปิดคอร์สวิชาและลงตารางเรียนนักศึกษาการช่าง
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-700 mb-1">รุ่นนักศึกษา (เช่น 67) *</label>
                    <select
                      id="optSchBatchSelect"
                      value={schBatch}
                      onChange={(e) => setSchBatch(e.target.value)}
                      className="w-full border border-neutral-350 px-2 py-2 rounded bg-white font-mono"
                    >
                      {dbBatches.map(b => (
                        <option key={b} value={b}>รุ่น {b}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-700 mb-1">รหัสวิชาหลักสูตร *</label>
                    <input
                      id="optSchCodeInput"
                      type="text"
                      required
                      placeholder="เช่น AMT-104"
                      value={schCode}
                      onChange={(e) => setSchCode(e.target.value)}
                      className="w-full border border-neutral-300 px-3 py-2 rounded focus:outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-700 mb-1">ชื่อวิชาเรียนเต็ม *</label>
                    <input
                      id="optSchNameInput"
                      type="text"
                      required
                      placeholder="เช่น Turbine Engine Maintenance"
                      value={schName}
                      onChange={(e) => setSchName(e.target.value)}
                      className="w-full border border-neutral-300 px-3 py-2 rounded focus:outline-none"
                    />
                  </div>
                </div>

                <div className="bg-neutral-50 p-4 rounded-lg border border-neutral-200">
                  <span className="block text-[10px] font-bold text-neutral-700 mb-2">เลือกวันที่มีเรียนประจำสัปดาห์ (เลือกได้มากกว่า 1 วัน) *</span>
                  <div className="flex flex-wrap gap-2">
                    {DAYS_OF_WEEK_LIST.map((day) => {
                      const isSelected = schDays.includes(day.key as any);
                      return (
                        <button
                          key={day.key}
                          type="button"
                          id={`btnSchDaySelect-${day.key}`}
                          onClick={() => {
                            if (isSelected) {
                              setSchDays(schDays.filter((d) => d !== day.key));
                            } else {
                              setSchDays([...schDays, day.key as any]);
                            }
                          }}
                          className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                            isSelected
                              ? 'bg-neutral-900 border-neutral-900 text-white shadow-xs scale-105'
                              : 'bg-white border-neutral-300 text-neutral-600 hover:bg-neutral-100'
                          }`}
                        >
                          <span className={`w-2.5 h-2.5 rounded-full inline-block ${
                            day.key === 'จันทร์' ? 'bg-yellow-400' :
                            day.key === 'อังคาร' ? 'bg-pink-400' :
                            day.key === 'พุธ' ? 'bg-emerald-400' :
                            day.key === 'พฤหัส' ? 'bg-amber-400' :
                            day.key === 'ศุกร์' ? 'bg-sky-400' :
                            day.key === 'เสาร์' ? 'bg-purple-400' :
                            'bg-red-400'
                          }`} />
                          <span>{day.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-700 mb-1">วันที่เริ่มเรียนคลาสแรก *</label>
                    <input
                      id="optSchStartInput"
                      type="date"
                      required
                      value={schStart}
                      onChange={(e) => setSchStart(e.target.value)}
                      className="w-full border border-neutral-300 px-3 py-1.5 rounded focus:outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-700 mb-1">วันที่สิ้นเรียนคลาสสุดท้าย *</label>
                    <input
                      id="optSchEndInput"
                      type="date"
                      required
                      value={schEnd}
                      onChange={(e) => setSchEnd(e.target.value)}
                      className="w-full border border-neutral-300 px-3 py-1.5 rounded focus:outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-700 mb-1">ชื่อสลักครูผู้ชี้สอน *</label>
                    <input
                      id="optSchTeacherInput"
                      type="text"
                      required
                      placeholder="เช่น Instructor Somsak"
                      value={schTeacher}
                      onChange={(e) => setSchTeacher(e.target.value)}
                      className="w-full border border-neutral-300 px-3 py-2 rounded focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-neutral-50 p-3 rounded-lg border border-neutral-200">
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-700 mb-1">เวลาเข้าเรียน (เริ่มเรียน) *</label>
                    <input
                      id="optSchStartTimeInput"
                      type="time"
                      required
                      value={schStartTime}
                      onChange={(e) => setSchStartTime(e.target.value)}
                      className="w-full border border-neutral-300 px-3 py-1.5 rounded bg-white focus:outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-700 mb-1">เวลาเลิกเรียน (สิ้นสุดเรียน) *</label>
                    <input
                      id="optSchEndTimeInput"
                      type="time"
                      required
                      value={schEndTime}
                      onChange={(e) => setSchEndTime(e.target.value)}
                      className="w-full border border-neutral-300 px-3 py-1.5 rounded bg-white focus:outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="text-[11px] text-zinc-650 font-sans pl-1 flex items-center gap-2">
                  <span className="inline-block px-2 py-0.5 rounded bg-yellow-100 text-yellow-800 font-bold border border-yellow-250 text-center text-[10px]">พักเที่ยง 12:30 น.</span>
                  <span>ข้อมูลวิชาจะบันทึกพร้อมกาเวลาพักเรียนภาคเบรกเที่ยง <strong>(12:30 น.)</strong> ภายในระบบตารางเรียนอย่างเป็นทางการ</span>
                </div>

                <div className="flex justify-end pt-2 border-t">
                  <button
                    id="submitSchBtn"
                    type="submit"
                    className="bg-black hover:bg-neutral-850 text-white font-extrabold px-6 py-2 rounded shadow text-xs cursor-pointer"
                  >
                    เปิดตารางตริยวิชา
                  </button>
                </div>
              </form>
            )}

            {/* If EXAM DEPT: SCHEDULE EXAMS & GRADES */}
            {isExam && (
              <div className="space-y-6">
                
                {/* 1. Schedule Exam */}
                <form onSubmit={handleScheduleExam} className="bg-neutral-50 p-4 border border-neutral-300 rounded-lg space-y-4">
                  <h4 className="font-sans font-bold text-neutral-950 uppercase border-b pb-1 text-xs">นัดกำหนดการสอบนักศึกษาการช่าง</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-neutral-700 mb-1">รุ่นนักศึกษา *</label>
                      <select
                        id="examBatchSelect"
                        value={exBatch}
                        onChange={(e) => {
                          const newBatch = e.target.value;
                          setExBatch(newBatch);
                          const subjects = Array.from(
                            new Set(
                              classSchedules
                                .filter((s) => s.batch === newBatch)
                                .map((s) => `${s.subjectCode} ${s.subjectName}`)
                            )
                          );
                          setExSubject(subjects.length > 0 ? subjects[0] : '');
                        }}
                        className="w-full border border-neutral-300 px-1.5 py-1.5 rounded bg-white font-mono text-xs"
                      >
                        {dbBatches.map(b => (
                          <option key={b} value={b}>รุ่น {b}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[10px] font-bold text-neutral-700 mb-1">วิชาที่สอบ *</label>
                      {Array.from(
                        new Set(
                          classSchedules
                            .filter((s) => s.batch === exBatch)
                            .map((s) => `${s.subjectCode} ${s.subjectName}`)
                        )
                      ).length > 0 ? (
                        <select
                          id="examSubjectInput"
                          required
                          value={exSubject}
                          onChange={(e) => setExSubject(e.target.value)}
                          className="w-full border border-neutral-300 px-3 py-2.5 rounded focus:outline-none bg-white font-sans text-xs"
                        >
                          {Array.from(
                            new Set(
                              classSchedules
                                .filter((s) => s.batch === exBatch)
                                .map((s) => `${s.subjectCode} ${s.subjectName}`)
                            )
                          ).map((sub) => (
                            <option key={sub} value={sub}>
                              {sub}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="text-rose-500 font-semibold p-2 border border-rose-200 bg-rose-50 rounded text-[11px]">
                          ไม่มีรายวิชาเรียนในระบบที่เป็นของ รุ่น {exBatch} ในขณะนี้ โปรดเพิ่มตารางเรียนก่อน
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-neutral-700 mb-1">วันเวลาสอบ *</label>
                      <input
                        id="examDateInput"
                        type="date"
                        required
                        value={exDate}
                        onChange={(e) => setExDate(e.target.value)}
                        className="w-full border border-neutral-300 px-3 py-1.5 rounded focus:outline-none font-mono"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end pt-1">
                    <button id="submitExamBtn" type="submit" className="bg-black text-white hover:bg-neutral-850 px-5 py-2 rounded text-xs font-bold cursor-pointer">
                      นัดรวมรวมสอบกลาง
                    </button>
                  </div>
                </form>

                {/* 2. Publish Grades */}
                <form onSubmit={handlePublishGrades} className="bg-white p-4 border border-neutral-300 rounded-lg space-y-4">
                  <h4 className="font-sans font-bold text-neutral-950 uppercase border-b pb-1 text-xs">ประกาศประเมินสรุปคะแนนสอบ</h4>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-neutral-700 mb-1">รุ่นนักเรียน *</label>
                      <select
                        id="gradeBatchSelect"
                        value={gradeBatch}
                        onChange={(e) => {
                          const newBatch = e.target.value;
                          setGradeBatch(newBatch);
                          const subjects = Array.from(
                            new Set(
                              classSchedules
                                .filter((s) => s.batch === newBatch)
                                .map((s) => `${s.subjectCode} ${s.subjectName}`)
                            )
                          );
                          setGradeSubject(subjects.length > 0 ? subjects[0] : '');
                        }}
                        className="w-full border border-neutral-300 px-1.5 py-1.5 rounded bg-white font-mono text-xs"
                      >
                        {dbBatches.map(b => (
                          <option key={b} value={b}>รุ่น {b}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-neutral-700 mb-1">วิชาเรียน *</label>
                      {Array.from(
                        new Set(
                          classSchedules
                            .filter((s) => s.batch === gradeBatch)
                            .map((s) => `${s.subjectCode} ${s.subjectName}`)
                        )
                      ).length > 0 ? (
                        <select
                          id="gradeSubjectInput"
                          required
                          value={gradeSubject}
                          onChange={(e) => setGradeSubject(e.target.value)}
                          className="w-full border border-neutral-300 px-3 py-2.5 rounded focus:outline-none bg-white font-sans text-xs"
                        >
                          {Array.from(
                            new Set(
                              classSchedules
                                .filter((s) => s.batch === gradeBatch)
                                .map((s) => `${s.subjectCode} ${s.subjectName}`)
                            )
                          ).map((sub) => (
                            <option key={sub} value={sub}>
                              {sub}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="text-rose-500 font-semibold p-2 border border-rose-200 bg-rose-50 rounded text-[11px]">
                          ไม่มีรายวิชาเรียนในระบบที่เป็นของ รุ่น {gradeBatch} ในขณะนี้ โปรดเพิ่มตารางเรียนก่อน
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-neutral-700 mb-1">ครั้งที่พิจารณา (Round) *</label>
                      <input
                        id="gradeRoundInput"
                        type="number"
                        min={1}
                        required
                        value={gradeRound}
                        onChange={(e) => setGradeRound(parseInt(e.target.value) || 1)}
                        className="w-full border border-neutral-300 px-3 py-2 rounded focus:outline-none font-mono"
                      />
                    </div>
                  </div>

                  {/* List batch students for grading */}
                  <div className="border border-neutral-200 rounded p-3 bg-stone-50 max-h-48 overflow-y-auto">
                    <span className="font-bold block mb-2 text-neutral-600 uppercase text-[10px]">รายชื่อนักเรียนรุ่น {gradeBatch} เพื่อกรอกคะแนน (เปอร์เซ็นต์เต็ม 100)</span>
                    <div className="space-y-2">
                      {users
                        .filter(u => {
                          if (u.role !== 'นักศึกษา') return false;
                          const stdBatch = String(u.id || '').substring(0, 2);
                          return stdBatch === gradeBatch;
                        })
                        .map(std => (
                          <div key={std.id} className="flex justify-between items-center bg-white p-2 border rounded shadow-xs text-xs">
                            <span className="font-bold">{std.id} - {std.firstName} {std.lastName}</span>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              placeholder="กรอกคะแนน"
                              value={studentGrades[std.id] || ''}
                              onChange={(e) => setStudentGrades({ ...studentGrades, [std.id]: parseInt(e.target.value) || 0 })}
                              className="w-20 border px-2 py-1 text-center rounded font-mono font-bold"
                            />
                          </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button id="submitGradesBtn" type="submit" className="bg-black text-white hover:bg-neutral-850 px-5 py-2 rounded text-xs font-bold cursor-pointer">
                      ประกาศรับรองเกรดลงชีต
                    </button>
                  </div>
                </form>

              </div>
            )}

            {/* If STUDENT or ((INSTRUCTOR or OFFICE) with 'room' subtab): SUBMIT ROOM REQUEST OR RECORD DIRECT USAGE */}
            {(isStudent || ((isInstructor || isOffice) && instActionTab === 'room')) && (
              <div className="space-y-6">
                {/* Switcher pills */}
                <div className="flex gap-2 p-1 bg-neutral-100 rounded-lg w-full max-w-md no-print">
                  <button
                    type="button"
                    onClick={() => setRoomSubForm('request')}
                    className={`flex-1 text-center py-2 rounded-md font-sans font-bold text-[11px] transition-all cursor-pointer ${
                      roomSubForm === 'request'
                        ? 'bg-white text-neutral-950 shadow-xs border border-neutral-200'
                        : 'text-neutral-500 hover:text-neutral-850'
                    }`}
                  >
                    1. ขอใช้พื้นที่ห้องปฏิบัติการ (TLTC-MO-033)
                  </button>
                  <button
                    type="button"
                    onClick={() => setRoomSubForm('usage')}
                    className={`flex-1 text-center py-2 rounded-md font-sans font-bold text-[11px] transition-all cursor-pointer ${
                      roomSubForm === 'usage'
                        ? 'bg-white text-neutral-950 shadow-xs border border-neutral-200'
                        : 'text-neutral-500 hover:text-neutral-850'
                    }`}
                  >
                    2. บันทึกการใช้งานห้อง (TLTC-MO-034)
                  </button>
                </div>

                {roomSubForm === 'request' ? (
                  <form onSubmit={handleRoomSubmit} className="space-y-4">
                    <h3 className="font-sans font-extrabold text-sm border-b pb-2 text-neutral-950 uppercase">
                      เขียนใบร้องขอเข้าใช้พื้นที่ปฏิบัติการซ่อม (TLTC-MO-033)
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-neutral-700 mb-1">ฝ่ายวิทยา สังกัดแผนกหน่วยงาน *</label>
                        <input
                          id="reqDeptInput"
                          type="text"
                          required
                          placeholder="เช่น ฝ่ายทดสอบปีก ช่างการบินรุ่น 67"
                          value={department}
                          onChange={(e) => setDepartment(e.target.value)}
                          className="w-full border border-neutral-300 px-3 py-2 rounded focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-neutral-700 mb-1">เบอร์ฉุกเฉิน *</label>
                        <input
                          id="reqPhoneInput"
                          type="text"
                          required
                          placeholder="เช่น 089-xxxxxxx"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="w-full border border-neutral-300 px-3 py-2 rounded focus:outline-none font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-neutral-700 mb-1">วันที่ต้องการเข้าใช้งานห้อง *</label>
                        <input
                          id="reqDateInput"
                          type="date"
                          required
                          value={requestDate}
                          onChange={(e) => setRequestDate(e.target.value)}
                          className="w-full border border-neutral-300 px-3 py-1.5 rounded focus:outline-none font-mono text-xs bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-neutral-700 mb-1">เวลาการจอง (ชั่วโมง) *</label>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[8px] font-bold text-neutral-450 mb-0.5">ตั้งแต่เวลา</label>
                            <select
                              id="reqStartTimeSelect"
                              value={startTime}
                              onChange={(e) => setStartTime(e.target.value)}
                              className="w-full border border-neutral-300 px-2 py-1.5 rounded bg-white text-xs font-semibold"
                            >
                              {TIME_OPTIONS.map(time => (
                                <option key={time} value={time}>{time}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[8px] font-bold text-neutral-450 mb-0.5">ถึงเวลา</label>
                            <select
                              id="reqEndTimeSelect"
                              value={endTime}
                              onChange={(e) => setEndTime(e.target.value)}
                              className="w-full border border-neutral-300 px-2 py-1.5 rounded bg-white text-xs font-semibold"
                            >
                              {TIME_OPTIONS.map(time => (
                                <option key={time} value={time}>{time}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-neutral-700 mb-1">พื้นที่ปฏิบัติงานที่ต้องการขอจอง *</label>
                        <select
                          id="reqRoomSelect"
                          value={selectedRoom}
                          onChange={(e) => setSelectedRoom(e.target.value)}
                          className={`w-full border px-2 py-1.5 rounded focus:outline-none bg-white text-xs font-semibold ${
                            selectedRoom !== 'Other' && checkRoomBusy(selectedRoom) 
                              ? 'border-rose-450 text-rose-600 bg-rose-50' 
                              : 'border-neutral-300'
                          }`}
                        >
                          {[
                            "Practical Area in Hangar",
                            "Meeting Room",
                            "Theoretical Classroom",
                            "Library Room",
                            "Workshop 1",
                            "Workshop 2",
                            "Fiberglass Workshop",
                            "Examination Room",
                            "Aerodynamic Room",
                            "Electrical Room"
                          ].map(room => {
                            const isBusy = checkRoomBusy(room);
                            const isDateTimeFilled = !!(requestDate && startTime && endTime && (startTime < endTime));
                            const statusSuffix = isDateTimeFilled ? (isBusy ? " (ไม่ว่าง)" : " (ว่าง)") : " (ว่าง)";
                            return (
                              <option key={room} value={room} disabled={isBusy}>
                                {room}{statusSuffix}
                              </option>
                            );
                          })}
                          <option value="Other">อื่นๆ (ระบุห้องด้านล่าง)</option>
                        </select>
                        {selectedRoom !== 'Other' && checkRoomBusy(selectedRoom) && (
                          <p className="text-[9px] text-rose-600 font-semibold mt-1">⚠️ ห้องนี้ถูกจองใช้ในช่วงเวลาดังกล่าวแล้ว</p>
                        )}
                      </div>
                    </div>

                    {selectedRoom === 'Other' && (
                      <div className="mt-4">
                        <label className="block text-[10px] font-bold text-neutral-700 mb-1">กรอกข้อมูลระบุชื่อห้องอื่น *</label>
                        <input
                          id="reqOtherRoomInput"
                          type="text"
                          required
                          placeholder="เช่น ห้องล้างเครื่องยนต์"
                          value={otherRoomText}
                          onChange={(e) => setOtherRoomText(e.target.value)}
                          className={`w-full border px-3 py-2 rounded focus:outline-none ${
                            checkRoomBusy(otherRoomText) ? 'border-rose-450 text-rose-600 bg-rose-50' : 'border-neutral-300'
                          }`}
                        />
                        {checkRoomBusy(otherRoomText) && (
                          <p className="text-[9px] text-rose-600 font-semibold mt-1">⚠️ ห้องระบุดังกล่าวไม่ว่างในช่วงเวลาที่เลือก</p>
                        )}
                      </div>
                    )}

                    <div>
                      <label className="block text-[10px] font-bold text-neutral-700 mb-1">จุดประสงค์กิจกรรมคราดการเข้าใช้งานอย่างชัดถ้อยชัดใบ *</label>
                      <textarea
                        id="reqPurposeTextarea"
                        required
                        rows={2}
                        placeholder="ระบุ เช่น ตรวจเทียบวันหมดประกันเครื่องวัด Dial Gauges"
                        value={purpose}
                        onChange={(e) => setPurpose(e.target.value)}
                        className="w-full border border-neutral-300 px-3 py-2 rounded"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-neutral-750">ลงนามลายเซ็นรับคำยืนยันเอกสาร *</label>
                      <div className="w-full max-w-sm">
                        <SignaturePad onSave={(data) => setRequestSignature(data)} />
                      </div>
                    </div>

                    <div className="flex justify-end pt-2 border-t">
                      <button id="sendRoomRequestBtn" type="submit" className="bg-neutral-950 text-white font-bold px-6 py-2 rounded hover:bg-neutral-850 cursor-pointer text-xs">
                        บันทึกส่งเอกสารขอจอง
                      </button>
                    </div>
                  </form>
                ) : (
                  <form onSubmit={handleUsageRecordSubmit} className="space-y-4 max-w-2xl bg-white border border-neutral-300 p-5 rounded-lg shadow-xs">
                    <h3 className="font-sans font-extrabold text-xs border-b pb-2 text-neutral-900 uppercase">
                      แบบฟอร์มบันทึกการเข้าใช้งานห้องปฏิบัติการ (TLTC-MO-034 logs)
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-neutral-700 mb-1">พิมพ์ระบุชื่อห้อง / พื้นที่ห้องปฏิบัติการที่เข้าใช้ *</label>
                        <input
                          id="usageRoomNameInput"
                          type="text"
                          required
                          placeholder="พิมพ์ชื่อห้อง เช่น Workshop 1 หรือ theoretical Classroom"
                          value={usageRoomName}
                          onChange={(e) => setUsageRoomName(e.target.value)}
                          className="w-full border border-neutral-300 px-3 py-2 rounded focus:outline-none focus:border-neutral-900 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-neutral-700 mb-1">วันที่เข้าปฏิบัติงานจริง *</label>
                        <input
                          id="usageDateInput"
                          type="date"
                          required
                          value={usageDate}
                          onChange={(e) => setUsageDate(e.target.value)}
                          className="w-full border border-neutral-300 px-3 py-1.5 rounded focus:outline-none font-mono text-xs"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-neutral-700 mb-1">รายงานสิ่งที่ต้องการพัฒนา (ข้อสังเกต/อุปกรณ์ชำรุด/ความคิดเห็น) *</label>
                      <textarea
                        id="usageReportTextarea"
                        required
                        rows={3}
                        placeholder="ระบุ เช่น เพิ่มสายดินหรืออุปกรณ์ความสว่าง, แอร์เสีย 1 เครื่อง หรือความพร้อมสมบูรณ์ดี..."
                        value={usageReportText}
                        onChange={(e) => setUsageReportText(e.target.value)}
                        className="w-full border border-neutral-300 px-3 py-2 rounded text-xs focus:outline-none focus:border-neutral-900"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-neutral-750">ผู้เข้าปฏิบัติงานลงลายเซ็นรับรอง *</label>
                      <div className="w-full max-w-sm">
                        <SignaturePad onSave={(data) => setUsageSignature(data)} placeholder="วาดลายลายเซ็นอิเล็กทรอนิกส์..." />
                      </div>
                    </div>

                    <div className="flex justify-end pt-2 border-t">
                      <button id="saveDirectRoomUsageBtn" type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2 rounded cursor-pointer text-xs transition-all shadow-3xs uppercase tracking-wide">
                        บันทึกข้อมูลการใช้ห้องและเซ็นชื่อ
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

          </div>
        )}

        {/* TAB 3: BORROW AND RETURN EQUIPMENT (FITTED WITH CAM SCANNERS) */}
        {activeTab === 'borrow' && (
          <div className="space-y-6">
            
            <div className="border border-neutral-300 p-5 rounded-lg bg-neutral-50/50">
              <h3 className="font-sans font-extrabold text-sm mb-3 text-neutral-950 flex items-center gap-1.5 uppercase">
                <Camera size={16} />
                <span>เบิกและยืมเครื่องมือในอู่ / ตรวจสอบสแกนโค้ดสลักป้าย</span>
              </h3>

              {isCameraActive ? (
                <div className="border-2 border-neutral-950 bg-neutral-950 rounded-lg p-4 text-center text-white relative min-h-[300px] flex flex-col justify-between items-center transition-all duration-350">
                  <div className="absolute top-2 right-2 flex items-center gap-1.5 z-10 bg-neutral-900/60 px-2 py-0.5 rounded-full">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
                    <span className="text-[9px] font-mono tracking-widest text-emerald-400">ACTIVE CAMERA</span>
                  </div>

                  <button 
                    type="button" 
                    onClick={() => setIsCameraActive(false)} 
                    className="absolute top-2 left-2 bg-rose-900/90 hover:bg-rose-800 text-white text-[9px] font-bold px-2.5 py-1 rounded-md transition-all cursor-pointer z-10 shadow-md flex items-center gap-1"
                  >
                    <span>✕ ปิดหน้าเปิดกล้อง</span>
                  </button>
                  
                  {/* Real Web Camera Stream View with Scanner HUD Overlay */}
                  <div className="w-full mt-6">
                    {cameraError ? (
                      <div className="text-rose-400 text-[10px] font-bold p-3 bg-rose-950/40 rounded-lg max-w-md mx-auto mb-3 border border-rose-900/40 select-none">
                        ⚠️ ขออภัย: {cameraError} <br />
                        <span className="font-normal text-slate-300 mt-1 block">(ระบบตรวจพบขีดจำกัดเบราว์เซอร์ จึงสลับกลับสู่โหมดจำลองเพื่อทดสอบให้ท่านใช้ปุ่มด้านล่างสแกนทดสอบได้ทันที)</span>
                      </div>
                    ) : (
                      <div className="relative w-full max-w-sm h-48 bg-neutral-900 rounded-lg overflow-hidden border border-neutral-700 mx-auto mb-3 flex items-center justify-center">
                        <div 
                          id="student-equipment-reader" 
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                        {/* Interactive Scanner laser targeting HUD overlay */}
                        <div className="absolute inset-0 border border-emerald-500/20 flex items-center justify-center pointer-events-none z-10">
                          <div className="w-48 h-28 border border-emerald-400/50 rounded flex items-center justify-center relative">
                            <span className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-emerald-400" />
                            <span className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-emerald-400" />
                            <span className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-emerald-400" />
                            <span className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-emerald-400" />
                            <div className="w-44 h-0.5 bg-emerald-450 animate-bounce shadow-[0_0_10px_#10b981]" />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="w-full">
                    <span className="block text-[9.5px] text-neutral-300 mb-2 font-semibold">หรือคุณสามารถคลิกเลือกปุ่มด้านล่างนี้ เพื่อ "สลับสแกนอุปกรณ์" จำลองได้ทันที:</span>
                    <div className="flex flex-wrap justify-center gap-1 text-[10px]">
                      {equipments.map(tool => {
                        const isUnavailable = tool.qty === 0 || tool.status === 'NotReady' || tool.status === 'Damaged' || tool.status === 'Calibrating';
                        return (
                          <button
                            key={tool.code}
                            id={`simulateToolScanBtn_${tool.code}`}
                            type="button"
                            disabled={isUnavailable}
                            onClick={() => handleSimulateScan(tool.code)}
                            className={`px-2.5 py-1 rounded cursor-pointer font-bold font-mono transition-transform duration-100 hover:scale-105 border ${
                              isUnavailable
                                ? 'bg-rose-950/20 text-rose-300/40 border-rose-900/15 cursor-not-allowed line-through'
                                : 'bg-white/10 hover:bg-emerald-600 hover:text-white border-white/20'
                            }`}
                            title={isUnavailable ? 'ไม่พร้อมใช้งาน' : tool.toolName}
                          >
                            สแกน {tool.code} {isUnavailable ? '(ไม่ว่าง)' : ''}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 border-2 border-dashed border-neutral-300 rounded bg-white">
                  <button
                    id="activateCamScanBtn"
                    type="button"
                    onClick={() => setIsCameraActive(true)}
                    className="flex items-center gap-2 bg-neutral-950 hover:bg-neutral-850 text-white font-sans font-extrabold px-6 py-2.5 rounded shadow inline-flex text-xs transition-colors cursor-pointer"
                  >
                    <Camera size={14} />
                    <span>เปิดกล้องสแกนคิวอาร์โค้ดสลักป้ายอุปกรณ์</span>
                  </button>
                  <p className="text-[10px] text-neutral-400 mt-2">หรือกรอกรหัสคิวอาร์โค้ดตรงขวาเพื่อทำรายการแบบแมนนวล</p>
                </div>
              )}

              {/* Manual input borrowing Form */}
              <form onSubmit={handleBorrowSubmit} className="space-y-4 mt-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-700 mb-1">รหัสคิวอาร์โค้ดอุปกรณ์ *</label>
                    <input
                      id="toolCodeManualInput"
                      type="text"
                      required
                      placeholder="เช่น AMT-TL-001"
                      value={targetCode}
                      onChange={(e) => {
                        setTargetCode(e.target.value);
                        const match = equipments.find(eq => eq.code.toLowerCase() === e.target.value.toLowerCase().trim());
                        setScannedTool(match || null);
                      }}
                      className="w-full border border-neutral-300 px-3 py-2 rounded focus:outline-none focus:border-neutral-900 font-mono text-sm uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-700 mb-1">จำนวนที่ยืม (QTY EA) *</label>
                    <input
                      id="borrowQtyInput"
                      type="number"
                      min={1}
                      required
                      value={borrowQty}
                      onChange={(e) => setBorrowQty(parseInt(e.target.value) || 1)}
                      className="w-full border border-neutral-300 px-3 py-2 rounded focus:outline-none focus:border-neutral-900 font-mono text-sm"
                    />
                  </div>
                </div>

                {scannedTool && (
                  <div className="p-3 bg-neutral-100 border border-neutral-300 rounded-md flex justify-between items-center">
                    <div>
                      <p className="font-sans font-bold text-neutral-950">{scannedTool.toolName}</p>
                      <p className="text-[9px] text-neutral-500 font-mono">P/N: {scannedTool.partNumber} | ชั้นวาง: {scannedTool.location}</p>
                    </div>
                    {(() => {
                      const totalBorrowed = borrowRecords
                        .filter(r => r.equipmentCode === scannedTool.code && r.status !== 'Returned')
                        .reduce((sum, r) => sum + r.qty, 0);
                      const available = scannedTool.qty - totalBorrowed;
                      return (
                        <span className={`font-sans font-bold text-white text-[10px] px-2 py-1 rounded ${available > 0 ? 'bg-neutral-950' : 'bg-rose-600'}`}>
                          เหลือในสต๊อก: {available} {available > 0 ? 'พร้อมยืม' : 'ของหมดคลัง'}
                        </span>
                      );
                    })()}
                  </div>
                )}

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-neutral-800">เซ็นรับรองความปลอดภัยและยืมเครื่องมือคืนครบตามกติกา *</label>
                  <SignaturePad onSave={(data) => setBorrowSignature(data)} placeholder="วาดลายเซ็นของคุณด้านล่าง..." />
                </div>

                <div className="flex justify-end border-t pt-2">
                  <button id="executeBorrowBtn" type="submit" className="bg-neutral-950 text-white font-extrabold px-6 py-2 rounded hover:bg-neutral-800 text-xs shadow-sm cursor-pointer">
                    เซ็นลายมืออนุมัติเบิกจ่าย
                  </button>
                </div>
              </form>
            </div>

            {/* Display borrowed tools list (own and buddy roster) */}
            <div className="border border-neutral-300 p-5 rounded-lg space-y-3">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-neutral-150 pb-2 flex-wrap">
                <h4 className="font-sans font-extrabold text-neutral-900 uppercase">
                  ตารางเครื่องมือที่ถูกเบิกจ่าย (และครอบครองร่วมรุ่นช่าง)
                </h4>
                <button
                  id="studentPrintTraceabilityLogBtn"
                  type="button"
                  onClick={() => setShowTraceabilityDoc(true)}
                  className="flex items-center gap-1.5 bg-rose-655 hover:bg-rose-755 text-white font-sans font-extrabold text-[10px] px-3.5 py-2 rounded shadow-xs cursor-pointer select-none transition-transform duration-100 active:scale-95"
                >
                  <Printer size={12} />
                  <span>พิมพ์ประวัติยืมเครื่องมือชุดนี้ (TLTC-MO-001)</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-neutral-50 text-[10px] text-neutral-550 font-bold border-b border-neutral-200">
                      <th className="py-2.5 px-2">วันเวลาที่ยืม</th>
                      <th className="py-2.5 px-2">คิวอาร์โค้ด</th>
                      <th className="py-2.5 px-2">ชื่ออุปกรณ์ช่างอากาศยาน</th>
                      <th className="py-2.5 px-2">ผู้ถือเครื่องมือขณะนี้</th>
                      <th className="py-2.5 px-2 text-center">หน่วย (EA)</th>
                      <th className="py-2.5 px-2 text-center">คืนอุปกรณ์</th>
                    </tr>
                  </thead>
                  <tbody>
                    {borrowRecords
                      .filter(rec => isStudent ? (rec.status === 'Borrowed' || rec.status === 'PendingReturn') : true)
                      .map((rec) => {
                        const isBorrowedByMe = rec.borrowerId === currentUser.id;
                        return (
                          <tr key={rec.id} className="border-b border-neutral-100 hover:bg-neutral-50 text-[11px]">
                            <td className="py-2.5 px-2 font-mono text-neutral-550">{rec.borrowDate}</td>
                            <td className="py-2.5 px-2 font-mono font-bold">{rec.equipmentCode}</td>
                            <td className="py-2.5 px-2 font-bold text-neutral-900">{rec.toolName}</td>
                            <td className="py-2.5 px-2 font-medium">
                              {isBorrowedByMe ? (
                                <span className="bg-neutral-950 text-white px-1.5 py-0.5 rounded text-[10px] font-bold">
                                  คุณกำลังถืออยู่ (You)
                                </span>
                              ) : (
                                <span>{rec.borrowerName} ({rec.borrowerId})</span>
                              )}
                            </td>
                            <td className="py-2.5 px-2 text-center font-mono font-bold text-neutral-800">{rec.qty}</td>
                            <td className="py-2.5 px-2 text-center">
                              {rec.status === 'Returned' ? (
                                <span className="text-neutral-450 italic">คืนแล้ว ({rec.returnDate})</span>
                              ) : rec.status === 'PendingReturn' ? (
                                <span className="text-amber-600 bg-amber-50 border border-amber-300 font-sans font-bold text-[9px] px-2 py-0.5 rounded inline-block animate-pulse">
                                  รอฝ่ายรักษาบำรุงตรวจรับ
                                </span>
                              ) : (
                                <button
                                  id={`returnBtn_${rec.id}`}
                                  hidden={!isBorrowedByMe}
                                  onClick={() => {
                                    onReturnEquipment(rec.id);
                                    Swal.fire({ icon: 'success', title: 'คืนอุปกรณ์แล้ว', text: 'ส่งคืนสู่สารบบ เรียบร้อยแล้ว (รอฝ่ายซ่อมตรวจสอบแบริ่งต่อไป)', confirmButtonColor: '#171717' });
                                  }}
                                  className="bg-black hover:bg-neutral-800 text-white font-sans font-bold text-[9px] py-1 px-2.5 rounded transition-colors cursor-pointer"
                                >
                                  กดส่งคืนอุปกรณ์
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    {borrowRecords.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-neutral-450 italic">
                          ไม่มีการยืมใช้เครื่องมือในบัญชีขณะนี้
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: ROSTER GROUP (Buddy list / Cohort rosters) */}
        {activeTab === 'roster' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-sans font-extrabold text-sm text-neutral-900 uppercase">
                {isStudent ? `ทำเนียบเพื่อนเรียนร่วมรุ่นช่างอากาศยาน (รุ่น ${studentBatch})` : 'ทำเนียบบุคลากรวิชาสอนช่างการบิน'}
              </h3>
              
              {!isStudent && (
                <div className="flex items-center gap-1">
                  <span>เลือกรุ่นที่เรียกตรวจ:</span>
                  <select
                    id="rosterBatchSelect"
                    value={rosterBatch}
                    onChange={(e) => setRosterBatch(e.target.value)}
                    className="border border-neutral-300 px-1 py-0.5 rounded font-mono font-bold bg-white"
                  >
                    {dbBatches.map(b => (
                      <option key={b} value={b}>รุ่น {b}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {users
                .filter(u => {
                  if (isStudent) {
                    return u.role === 'นักศึกษา' && String(u.id || '').substring(0, 2) === studentBatch;
                  } else {
                    return u.role !== 'นักศึกษา' && u.role !== 'Admin';
                  }
                })
                .map((member) => (
                  <div key={member.id} className="flex gap-4 p-3 border border-neutral-300 rounded bg-white items-center shadow-xs">
                    <img src={member.photoUrl} alt="member" className="w-12 h-14 object-cover rounded border" referrerPolicy="no-referrer" />
                    <div>
                      <p className="font-sans font-extrabold text-neutral-950">{member.firstName} {member.lastName}</p>
                      <p className="font-mono text-[10px] text-neutral-500 font-bold uppercase">{member.role} | ID: {member.id}</p>
                      <p className="text-[10px] text-neutral-400 font-mono mt-0.5">{member.email}</p>
                    </div>
                  </div>
                ))}
            </div>
            {users.filter(u => {
              if (isStudent) {
                return u.role === 'นักศึกษา' && String(u.id || '').substring(0, 2) === studentBatch;
              } else {
                return u.role !== 'นักศึกษา' && u.role !== 'Admin';
              }
            }).length === 0 && (
              <div className="text-center py-10 text-neutral-500 italic">
                ไม่พบข้อมูลทำเนียบรายชื่อในระบบ ณ ขณะนี้
              </div>
            )}
          </div>
        )}

        {/* TAB 5: MY REQUESTS (เอกสารคำขอของฉัน) */}
        {activeTab === 'requests' && (
          <div className="space-y-6 animate-fade-in text-slate-800">
            <div className="border-b pb-2">
              <h3 className="font-sans font-extrabold text-sm text-neutral-900 uppercase">
                เอกสารคำขอและใบอนุมัติใช้งานของฉัน (My Documents & PDF)
              </h3>
              <p className="font-sans text-[10px] text-slate-400 mt-0.5">
                รวมใบคำขอใช้พื้นที่ปฏิบัติการ (TLTC-MO-033) ทั้งหมดของท่าน สามารถแสดงตัวอย่างไฟล์ PDF เพื่อพริ้นท์หรือยื่นตรวจสอบ
              </p>
            </div>

            <div className="space-y-4">
              {roomRequests.filter(req => req.requesterId === currentUser.id).length === 0 ? (
                <div className="text-center py-12 border border-dashed border-neutral-300 rounded-xl bg-neutral-50 p-6 flex flex-col items-center justify-center">
                  <BookOpen size={28} className="text-neutral-300 mb-2" />
                  <p className="font-sans text-xs font-bold text-neutral-400">ยังไม่พบประวัติการเขียนใบขอจองใช้พื้นที่</p>
                  <p className="font-sans text-[10.5px] text-neutral-400 mt-1">ท่านสามารถทำการสร้างใบขออนุมัติใหม่ได้ที่แถบ "ขอใช้พื้นที่ห้องปฏิบัติการ/บันทึกการขอใช้ห้อง"</p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-neutral-200 rounded-lg">
                  <table className="w-full text-left border-collapse bg-white">
                    <thead>
                      <tr className="bg-neutral-50 border-b border-neutral-200 text-[10px] font-bold text-neutral-600 uppercase font-sans">
                        <th className="py-2.5 px-3">เลขที่เอกสาร / ห้องพื้นที่</th>
                        <th className="py-2.5 px-3">วันที่จอง</th>
                        <th className="py-2.5 px-3">เวลากรอบชั่วโมง</th>
                        <th className="py-2.5 px-3">วัตถุประสงค์</th>
                        <th className="py-2.5 px-3 text-center">สถานะการอนุมัติ</th>
                        <th className="py-2.5 px-3 text-right">พิมพ์/เอกสาร PDF</th>
                      </tr>
                    </thead>
                    <tbody>
                      {roomRequests
                        .filter(req => req.requesterId === currentUser.id)
                        .map((req) => {
                          const docNumber = `TLTC-MO-033-${String(req.id || '').substring(0, 5).toUpperCase()}`;
                          const isApproved = req.maintenanceApproved === 'Approved';
                          const isRejected = req.maintenanceApproved === 'Rejected';
                          
                          return (
                            <tr key={req.id} className="border-b border-neutral-100 hover:bg-neutral-50/50 text-[11px] font-sans">
                              <td className="py-3 px-3">
                                <span className="font-mono text-[9px] font-extrabold bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded border border-neutral-200 block w-fit mb-1">
                                  {docNumber}
                                </span>
                                <span className="font-bold text-neutral-900">{req.room}</span>
                              </td>
                              <td className="py-3 px-3 font-mono font-bold text-neutral-500">{req.date}</td>
                              <td className="py-3 px-3 text-neutral-500">{req.timeRange}</td>
                              <td className="py-3 px-3 max-w-[150px] truncate" title={req.purpose}>{req.purpose}</td>
                              <td className="py-3 px-3 text-center">
                                {isApproved ? (
                                  <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full text-[9px] font-bold">
                                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                                    อนุมัติใช้ห้องแล้ว
                                  </span>
                                ) : isRejected ? (
                                  <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-full text-[9px] font-bold">
                                    <span className="w-1.5 h-1.5 bg-rose-500 rounded-full"></span>
                                    ปฏิเสธอนุมัติ
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full text-[9px] font-bold">
                                    <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
                                    รอตรวจสอบ (Pending)
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-3 text-right">
                                <div className="flex justify-end gap-1.5 flex-wrap">
                                  <button
                                    type="button"
                                    onClick={() => onViewRequestDoc(req)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-[10px] rounded transition-all cursor-pointer active:scale-95 shadow-3xs"
                                  >
                                    <Printer size={10} />
                                    <span>แสดงเอกสาร PDF</span>
                                  </button>
                                  {onCancelRoomRequest && (
                                    <button
                                      type="button"
                                      onClick={() => onCancelRoomRequest(req.id)}
                                      className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] rounded transition-all cursor-pointer active:scale-95 shadow-3xs"
                                    >
                                      <span>ยกเลิก</span>
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {showTraceabilityDoc && (
        <TraceabilityToolsLogDoc 
          records={borrowRecords.filter(rec => isStudent ? rec.borrowerId === currentUser.id : true)}
          onClose={() => setShowTraceabilityDoc(false)}
        />
      )}

    </div>
  );
}
