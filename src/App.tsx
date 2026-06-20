/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { User, RoomRequest, RoomUsageRecord, Equipment, BorrowRecord, ClassSchedule, ExamSchedule, ExamGrade } from './types';
import { APIService, getAppOriginForQR, pullFromGoogleSheets, syncWithGoogleSheets, sendEmailNotification } from './lib/api';
import RegistrationForms from './components/RegistrationForms';
import AdminPanel from './components/AdminPanel';
import TrainingManagerPanel from './components/TrainingManagerPanel';
import MaintenancePanel from './components/MaintenancePanel';
import ExamOfficeStudentPanel from './components/ExamOfficeStudentPanel';
import { StudentIdCard, RoomRequestDoc, RoomUsageRecordDoc } from './components/Documents';
import { 
  LogIn, LogOut, ShieldAlert, Key, Users, BookOpen, 
  Settings, RefreshCw, Mail, CheckCircle, Info, Plane, Wrench,
  Camera, QrCode
} from 'lucide-react';
import { alerts as Swal } from './lib/alerts';
import Swal2 from 'sweetalert2';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

const getTimeBasedGreeting = () => {
  const hours = new Date().getHours();
  if (hours >= 5 && hours < 11) {
    return 'สวัสดีตอนเช้า';
  } else if (hours >= 11 && hours < 13) {
    return 'สวัสดีตอนเที่ยง';
  } else if (hours >= 13 && hours < 17) {
    return 'สวัสดีตอนบ่าย';
  } else if (hours >= 17 && hours < 19) {
    return 'สวัสดีตอนเย็น';
  } else {
    return 'สวัสดีตอนค่ำ';
  }
};

export default function App() {
  // Database state
  const [db, setDb] = useState<ReturnType<typeof APIService.getDb>>(APIService.getDb());
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Real-time automatic notifications tracking list
  const [notifications, setNotifications] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('amt_notifications_v1');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isNotifDropdownOpen, setIsNotifDropdownOpen] = useState(false);
  const [notifDropdownTab, setNotifDropdownTab] = useState<'alerts' | 'emails'>('alerts');
  const [emailLogs, setEmailLogs] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('amt_email_logs_v1');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const sendSystemEmail = async (recipient: string, subject: string, body: string) => {
    const logId = `EMAIL-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const timestamp = new Date().toLocaleTimeString('th-TH') + ' ' + new Date().toLocaleDateString('th-TH');
    
    // optimistic add
    const newLog = { 
      id: logId, 
      recipient, 
      subject, 
      body, 
      status: 'sending', 
      timestamp 
    };
    setEmailLogs(prev => {
      const updated = [newLog, ...prev].slice(0, 30); // Keep up to 30 latest
      try { localStorage.setItem('amt_email_logs_v1', JSON.stringify(updated)); } catch {}
      return updated;
    });

    try {
      const result = await sendEmailNotification(recipient, subject, body);
      setEmailLogs(prev => {
        const updated = prev.map(log => log.id === logId ? { 
          ...log, 
          status: result.success ? 'success' : 'failed', 
          errorMessage: result.success ? undefined : result.message 
        } : log);
        try { localStorage.setItem('amt_email_logs_v1', JSON.stringify(updated)); } catch {}
        return updated;
      });
      return result;
    } catch (err: any) {
      const msg = err.message || String(err);
      setEmailLogs(prev => {
        const updated = prev.map(log => log.id === logId ? { 
          ...log, 
          status: 'failed', 
          errorMessage: msg 
        } : log);
        try { localStorage.setItem('amt_email_logs_v1', JSON.stringify(updated)); } catch {}
        return updated;
      });
      return { success: false, message: msg };
    }
  };

  const triggerNotif = (title: string, text: string, type: 'info' | 'success' | 'warning' | 'error' = 'info', emailRecipient?: string) => {
    // 1. Create a notification item
    const newItem = {
      id: `NOTIF-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      title,
      text,
      timestamp: new Date().toLocaleTimeString('th-TH'),
      read: false,
      type
    };

    setNotifications(prev => {
      const updated = [newItem, ...prev].slice(0, 50); // Keep up to 50 latest
      try {
        localStorage.setItem('amt_notifications_v1', JSON.stringify(updated));
      } catch (err) {
        console.warn('Could not save notifications:', err);
      }
      return updated;
    });

    // 2. Fire SweetAlert Toast
    const Toast = Swal2.mixin({
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 5000,
      timerProgressBar: true,
      didOpen: (toast) => {
        toast.addEventListener('mouseenter', Swal2.stopTimer);
        toast.addEventListener('mouseleave', Swal2.resumeTimer);
      },
      customClass: {
        popup: '!rounded-2xl !shadow-xl border border-slate-100 !p-4 bg-white/95 backdrop-blur-sm',
        title: 'text-sm font-black text-slate-800 font-sans',
        htmlContainer: 'text-[11.5px] text-slate-500 font-sans mt-1'
      }
    });

    Toast.fire({
      icon: type,
      title: title,
      text: text
    });

    // 3. Send email to the originally registered email of the user
    if (emailRecipient) {
      const emailSubject = `[AMT CONNECT ALERT] แจ้งเตือน: ${title}`;
      const emailBody = `สวัสดีสมาชิกระบบ AMT CONNECT,

มีรายการความเคลื่อนไหวอาร์เรย์และกิจกรรมผู้ใช้ถูกอัปเดตแจ้งเตือนในระบบ:

- เรื่องเด่น: ${title}
- รายละเอียด: ${text}
- เวลาตรวจพบล่าสุด: ${new Date().toLocaleTimeString('th-TH')} วันที่ ${new Date().toLocaleDateString('th-TH')}

กรุณากรอกข้อมูลและลายมือชื่อตรวจสอบสิทธิตามปกติบนโปรแกรม AMT CONNECT เพื่อยืนยันข้อมูล

ด้วยความเคารพ,
ศูนย์บริหารสารสนเทศและการสอบอู่การช่างอากาศยาน AMT CONNECT`;

      sendSystemEmail(emailRecipient, emailSubject, emailBody).catch((err) => {
        console.warn('Silent auto-notification background email error:', err);
      });
    }
  };

  const detectAndNotifyChanges = (prev: typeof db, next: typeof db) => {
    // 1. Own user profile status changes
    if (currentUser) {
      const pUser = prev.users.find(u => u.id === currentUser.id);
      const nUser = next.users.find(u => u.id === currentUser.id);
      if (pUser && nUser) {
        if (pUser.status !== nUser.status) {
          triggerNotif(
            '🔔 อัปเดตสถานะบัญชี',
            `สถานะของบัญชีคุณถูกอัปเดตเป็น: ${nUser.status}`,
            nUser.status === 'Active' ? 'success' : 'warning',
            nUser.email
          );
          // Set in state too so currentUser is in sync!
          setCurrentUser(nUser);
        }
      }
    }

    // 2. Incoming registration (for Admins / Staff / Managers who approve)
    if (currentUser && currentUser.role !== 'นักศึกษา') {
      const prevPendingIds = prev.users.filter(u => u.status === 'Pending').map(u => u.id);
      const newlyPending = next.users.filter(u => u.status === 'Pending' && !prevPendingIds.includes(u.id));
      if (newlyPending.length > 0) {
        newlyPending.forEach(u => {
          triggerNotif(
            '👤 คำร้องสมัครระบบใหม่',
            `ผู้ใช้สมัครใหม่: ${u.firstName} ${u.lastName} (${u.role}) รอตรวจหลักฐานเพื่ออนุมัติสิทธิ์`,
            'info',
            currentUser.email
          );
        });
      }
    }

    // 3. Room certification alerts (if student context)
    if (currentUser) {
      const myPrevReqs = prev.roomRequests.filter(r => r.requesterId === currentUser.id);
      const myNextReqs = next.roomRequests.filter(r => r.requesterId === currentUser.id);
      myNextReqs.forEach(nReq => {
        const pReq = myPrevReqs.find(p => p.id === nReq.id);
        if (pReq && pReq.maintenanceApproved !== nReq.maintenanceApproved) {
          const statusTh = nReq.maintenanceApproved === 'Approved' ? 'อนุมัติเข้าใช้งานสำเร็จ' : nReq.maintenanceApproved === 'Rejected' ? 'ปฏิเสธคำจองห้องพัก' : 'รอรับรอง';
          triggerNotif(
            '🏫 ตอบรับคำร้องขอจองห้อง',
            `ห้อง ${nReq.room} วันที่ ${nReq.date} ได้รับการพิจารณา: ${statusTh}`,
            nReq.maintenanceApproved === 'Approved' ? 'success' : 'error',
            currentUser.email
          );
        }
      });
    }

    // 4. Alert on NEW room request (for admins and managers who check rooms)
    if (currentUser && currentUser.role !== 'นักศึกษา') {
      const prevReqIds = prev.roomRequests.map(r => r.id);
      const newlyCreatedReqs = next.roomRequests.filter(r => !prevReqIds.includes(r.id));
      if (newlyCreatedReqs.length > 0) {
        newlyCreatedReqs.forEach(r => {
          triggerNotif(
            '📝 คำร้องขอใช้ห้องใหม่เข้ามา',
            `ผู้ยื่น: ${r.requesterName} ขออนุญาตใช้ ${r.room} ในวันที่ ${r.date}`,
            'info',
            currentUser.email
          );
        });
      }
    }

    // 5. Exam Grades release notification
    if (currentUser && currentUser.role === 'นักศึกษา') {
      next.examGrades.forEach(nGrade => {
        const pGrade = prev.examGrades.find(p => p.id === nGrade.id);
        const myOldScoreObj = pGrade ? pGrade.grades.find(g => g.studentId === currentUser.id) : null;
        const myNewScoreObj = nGrade.grades.find(g => g.studentId === currentUser.id);
        if (myNewScoreObj && (!myOldScoreObj || myOldScoreObj.score !== myNewScoreObj.score)) {
          triggerNotif(
            '📊 ประกาศผลสอบวิชาใหม่',
            `คะแนนวิชาเรียน: ${nGrade.subjectName} (สอบปฏิบัติรอบที่ ${nGrade.round}) ประกาศแล้วที่: ${myNewScoreObj.score} คะแนน`,
            'success',
            currentUser.email
          );
        }
      });
    }

    // 6. Borrow Equipments update (Approved/Return alerts)
    if (currentUser) {
      const myPrevBorrows = prev.borrowRecords.filter(b => b.borrowerId === currentUser.id);
      const myNextBorrows = next.borrowRecords.filter(b => b.borrowerId === currentUser.id);
      myNextBorrows.forEach(nBorrow => {
        const pBorrow = myPrevBorrows.find(p => p.id === nBorrow.id);
        if (pBorrow && pBorrow.status !== nBorrow.status) {
          const statusTh = nBorrow.status === 'Returned' ? 'คืนเครื่องมือเรียบร้อย' : 'กำลังรอดำเนินการ';
          triggerNotif(
            '🔧 ประวัติยืมเครื่องมือส่งคืน',
            `หมายเลขทะเบียน: ${nBorrow.equipmentCode} (${nBorrow.toolName}) เปลี่ยนสถานะเป็น: ${statusTh}`,
            nBorrow.status === 'Returned' ? 'success' : 'info',
            currentUser.email
          );
        }
      });
    }
  };

  // Load data from Google Sheets first on startup
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const fetchInitialData = async () => {
      const startTime = Date.now();
      try {
        const fetchedData = await pullFromGoogleSheets();
        if (!active) return;
        
        if (fetchedData && typeof fetchedData === 'object') {
          const currentDb = APIService.getDb();
          const mergedDb = {
            users: fetchedData.users || currentDb.users,
            roomRequests: fetchedData.roomRequests || currentDb.roomRequests,
            roomUsageRecords: fetchedData.roomUsageRecords || currentDb.roomUsageRecords,
            equipment: fetchedData.equipment || currentDb.equipment,
            borrowRecords: fetchedData.borrowRecords || currentDb.borrowRecords,
            schedules: fetchedData.schedules || currentDb.schedules,
            examSchedules: fetchedData.examSchedules || currentDb.examSchedules,
            examGrades: fetchedData.examGrades || currentDb.examGrades,
          };
          APIService.saveDb(mergedDb);
          setDb(mergedDb);
        }
      } catch (err) {
        console.warn('Initial pull from Google Sheets failed:', err);
      } finally {
        if (active) {
          const elapsedTime = Date.now() - startTime;
          const remainingTime = Math.max(0, 5000 - elapsedTime);
          setTimeout(() => {
            if (active) {
              setIsInitialLoading(false);
            }
          }, remainingTime);
        }
      }
    };
    
    fetchInitialData();
    return () => {
      active = false;
    };
  }, []);

  // App navigation state: 'home' | 'dashboard' | 'register'
  const [currentScreen, setCurrentScreen] = useState<'home' | 'dashboard' | 'register'>('home');

  // Floating printable dialog overlays state
  const [activeCardUser, setActiveCardUser] = useState<User | null>(null);
  const [activeRequestDoc, setActiveRequestDoc] = useState<RoomRequest | null>(null);
  const [showUsageRecordDoc, setShowUsageRecordDoc] = useState(false);

  // Input states for login screen
  const [loginId, setLoginId] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Login QR code Scanner interface states
  const [loginMethod, setLoginMethod] = useState<'password' | 'qr'>('password');
  const [isLoginCameraActive, setIsLoginCameraActive] = useState(false);
  const [loginCameraFacingMode, setLoginCameraFacingMode] = useState<'environment' | 'user'>('environment');
  const [loginCameraError, setLoginCameraError] = useState<string | null>(null);
  const [scannedUser, setScannedUser] = useState<User | null>(null);

  // Parse QR link verification from search query parameters or direct URL pathname segment on app load
  useEffect(() => {
    if (isInitialLoading) return;
    const params = new URLSearchParams(window.location.search);
    let idParam = params.get('id') || params.get('verifyId') || params.get('data');

    // Extrapolate the ID from the pathname if no valid query parameter is passed
    if (!idParam) {
      const pathSegment = window.location.pathname.replace(/^\/|\/$/g, '').trim();
      const reservedPaths = ['home', 'register', 'dashboard', 'index.html'];
      if (pathSegment && !reservedPaths.includes(pathSegment.toLowerCase())) {
        idParam = pathSegment;
      }
    }

    if (idParam) {
      const cleanId = idParam.trim().replace(/^['"]|['"]$/g, '').trim();
      
      // A. Check if the ID belongs to a registered User
      const foundUser = db.users.find(u => {
        const uIdClean = String(u.id || '').trim().toLowerCase();
        const scannedIdClean = cleanId.toLowerCase();
        return uIdClean === scannedIdClean || uIdClean === scannedIdClean.replace(/\D/g, '') || scannedIdClean === uIdClean.replace(/\D/g, '');
      });

      if (foundUser) {
        // Safe clean url to keep URL tidy as a real-world system
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);

        // Strict security status checks
        if (foundUser.status === 'Pending') {
          Swal.fire({
            icon: 'warning',
            title: 'บัญชีอยู่ระหว่างรออนุมัติ',
            text: 'สถานะของท่าน: กำลังรอการอนุมัติโปรดติดต่อผู้บริหารระบบ',
            confirmButtonColor: '#0F172A'
          });
          return;
        }
        if (foundUser.status === 'พ้นสภาพ') {
          Swal.fire({
            icon: 'error',
            title: 'บัญชีผู้ใช้นี้พ้นสภาพแล้ว',
            text: 'สถานะของท่าน: พ้นสภาพนักศึกษา/บุคคลากร และไม่สามารถเข้าสู่ระบบได้ โปรดติดต่อแผนกทะเบียน',
            confirmButtonColor: '#0F172A'
          });
          return;
        }
        if (foundUser.status === 'พักการเรียน') {
          Swal.fire({
            icon: 'error',
            title: 'บัญชีถูกระงับชั่วคราว',
            text: 'สถานะของท่าน: พักการเรียน และไม่สามารถเข้าสู่ระบบได้',
            confirmButtonColor: '#0F172A'
          });
          return;
        }
        if (foundUser.status === 'จบการศึกษา') {
          Swal.fire({
            icon: 'error',
            title: 'บัญชีพ้นฐานพอร์ทัลหลัก',
            text: 'สถานะของท่าน: จบการศึกษา และไม่สามารถเข้าใช้งานระบบควบคุมได้',
            confirmButtonColor: '#0F172A'
          });
          return;
        }

        // Automatic secure login redirection
        setCurrentUser(foundUser);
        setCurrentScreen('dashboard');

        // Automatically trigger complete document Student/Staff ID Card popup overlay on top!
        setActiveCardUser(foundUser);

        let statusBg = 'bg-emerald-50 text-emerald-800 border-emerald-300 font-extrabold';
        let statusText = 'อนุมัติเรียบร้อย (Active)';

        Swal.fire({
          title: '📌 เข้าสู่ระบบสำเร็จ (TLTC Verified)',
          html: `
            <div class="flex flex-col items-center text-center space-y-4 font-sans select-none my-2 p-1">
              ${foundUser.photoUrl ? `
                <img src="${foundUser.photoUrl}" alt="Photo" class="w-24 h-28 object-cover rounded-lg border-2 border-slate-900 shadow-md" referrerPolicy="no-referrer" />
              ` : `
                <div class="w-24 h-28 bg-slate-200 rounded-lg flex items-center justify-center text-slate-500 font-extrabold text-3xl border border-slate-300">
                  ${foundUser.firstName.charAt(0)}
                </div>
              `}
              <div class="space-y-1">
                <h4 class="font-bold text-base text-slate-950">${foundUser.firstName} ${foundUser.lastName}</h4>
                <p class="text-xs text-slate-500 font-mono">ID: ${foundUser.id}</p>
                <p class="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded-full border border-slate-250 inline-block mt-1">${foundUser.role}</p>
              </div>

              <div class="w-full border-t border-neutral-200 my-1 pt-3.5 space-y-2 text-left">
                <div class="flex items-center justify-between text-xs">
                  <span class="text-neutral-500">สถานภาพความมั่นคง:</span>
                  <span class="px-2 py-0.5 rounded border text-[11px] ${statusBg}">${statusText}</span>
                </div>
                ${foundUser.batch ? `
                  <div class="flex items-center justify-between text-xs">
                    <span class="text-neutral-500">รุ่น/ห้องเรียน:</span>
                    <span class="font-mono text-neutral-800 font-bold">Class ${foundUser.batch}</span>
                  </div>
                ` : ''}
                <div class="flex items-center justify-between text-xs">
                  <span class="text-neutral-500 font-sans">ลงทะเบียน ณ วันที่:</span>
                  <span class="font-mono text-neutral-800">${foundUser.createdAt}</span>
                </div>
              </div>

              <p class="text-[9.5px] text-slate-400 font-sans text-center leading-normal max-w-[280px]">
                สแกนแผงตรวจสอบความเสถียร ระบบได้ทำการยืนยันสิทธิ์และเปิดใช้งานแดชบอร์ดตามฐานสิทธิ์เรียบร้อยแล้ว
              </p>
            </div>
          `,
          confirmButtonText: 'เข้าชมพอร์ทัลระบบของฉัน',
          confirmButtonColor: '#0F172A'
        });
        return;
      }

      // B. Check if the ID belongs to a Room Request
      const foundRequest = db.roomRequests.find(r => {
        const rIdClean = String(r.id || '').trim().toLowerCase();
        const scannedIdClean = cleanId.toLowerCase();
        return rIdClean === scannedIdClean;
      });

      if (foundRequest) {
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);

        // Open Room Request document directly!
        setActiveRequestDoc(foundRequest);

        // Find associated user to set as current logged-in context if possible
        const associatedUser = db.users.find(u => u.id === foundRequest.requesterId);
        if (associatedUser) {
          setCurrentUser(associatedUser);
          setCurrentScreen('dashboard');
        }
        return;
      }

      // C. Otherwise, clean parameters and raise an errors alert
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
      Swal.fire({
        icon: 'error',
        title: 'ไม่พบคิวอาร์หรือรหัสคีย์สิทธิ์นี้',
        text: `ข้อมูลรหัสประจำสิทธิ์หรือใบขอใช้อาคารไม่ถูกต้อง: ${cleanId}`,
        confirmButtonColor: '#0F172A'
      });
    }
  }, [db, isInitialLoading]);

  useEffect(() => {
    let html5QrCode: Html5Qrcode | null = null;
    let isMounted = true;
    let lastScannedText = '';
    let lastScanTime = 0;

    if (isLoginCameraActive && loginMethod === 'qr') {
      setLoginCameraError(null);
      
      const startScanner = async () => {
        // Wait briefly for React to render the scanner container div
        await new Promise((resolve) => setTimeout(resolve, 300));
        if (!isMounted) return;

        try {
          const container = document.getElementById('login-qr-reader');
          if (!container) {
            throw new Error('ไม่พบตำแหน่งแผงแสดงผลกล้องเครื่องสแกน');
          }
          
          html5QrCode = new Html5Qrcode('login-qr-reader');
          await html5QrCode.start(
            { facingMode: loginCameraFacingMode },
            {
              fps: 15,
              qrbox: (w, h) => {
                const size = Math.max(120, Math.min(w, h, 250));
                return { width: size, height: size };
              }
            },
            (decodedText) => {
              const now = Date.now();
              if (decodedText === lastScannedText && now - lastScanTime < 3000) {
                return; // Prevent repeating scans of the same item within 3s
              }
              lastScannedText = decodedText;
              lastScanTime = now;
              handleQRLoginSubmit(decodedText);
            },
            () => {
              // Quietly bypass non-matches
            }
          );
        } catch (err: any) {
          console.error('Error starting Login Html5Qrcode engine:', err);
          setLoginCameraError(err.message || 'ไม่สามารถเข้าถึงอุปกรณ์กล้องได้ โปรดอนุมัติสิทธิ์การใช้งานกล้องในเบราว์เซอร์');
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
  }, [isLoginCameraActive, loginMethod, loginCameraFacingMode]);

  const handleQRLoginSubmit = async (qrData: string) => {
    const cleanQR = qrData.trim();
    let parsedId = '';

    // Show high-end loading popup to pull latest database entries before verifying credentials
    Swal.fire({
      title: 'กำลังตรวจสอบระบบความปลอดภัย...',
      text: 'ระบบกำลังดึงข้อมูลรายชื่อผู้เข้าใช้และสิทธิ์การอนุมัติล่าสุดจาก Google Sheets โปรดรอสักครู่...',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    // Synchronously pull latest database state
    await pullLatestData(true);

    Swal.close();

    // Advanced Robust URL & Parameter parsing
    // 1. Try standard browser URL parsing first (extremely reliable for full verification links)
    if (cleanQR.startsWith('http://') || cleanQR.startsWith('https://') || cleanQR.includes('//') || cleanQR.includes('/?')) {
      try {
        let urlText = cleanQR;
        if (!urlText.startsWith('http://') && !urlText.startsWith('https://')) {
          urlText = 'https://' + urlText;
        }
        const urlObj = new URL(urlText);
        const idParam = urlObj.searchParams.get('id') || urlObj.searchParams.get('verifyId') || urlObj.searchParams.get('data');
        if (idParam) {
          parsedId = idParam.trim();
        }
      } catch (e) {
        console.error("Standard URL parsing error, falling back to regex regex:", e);
      }
    }

    // 2. Regular expression fallback if standard URL parsing didn't find the ID
    if (!parsedId) {
      try {
        const idMatch = cleanQR.match(/[?&]id=([^&?#]+)/i) || cleanQR.match(/id=([^&?#]+)/i);
        const dataMatch = cleanQR.match(/[?&]data=([^&?#]+)/i) || cleanQR.match(/data=([^&?#]+)/i);
        const verifyIdMatch = cleanQR.match(/[?&]verifyId=([^&?#]+)/i) || cleanQR.match(/verifyId=([^&?#]+)/i);

        if (idMatch && idMatch[1]) {
          parsedId = decodeURIComponent(idMatch[1]).trim();
        } else if (dataMatch && dataMatch[1]) {
          parsedId = decodeURIComponent(dataMatch[1]).trim();
        } else if (verifyIdMatch && verifyIdMatch[1]) {
          parsedId = decodeURIComponent(verifyIdMatch[1]).trim();
        }
      } catch (e) {
        console.error("Regex extraction error:", e);
      }
    }

    // 3. Last path segment fallback (e.g. https://domain/user/67010214)
    if (!parsedId) {
      if (cleanQR.includes('/') && !cleanQR.endsWith('/')) {
        const lastSlash = cleanQR.lastIndexOf('/');
        const segment = cleanQR.substring(lastSlash + 1).trim();
        if (segment && segment.length >= 4 && !segment.includes('?') && !segment.includes('&')) {
          parsedId = segment;
        }
      }
    }

    // 4. Default to the whole scanned QR string if no URL syntax found
    if (!parsedId) {
      parsedId = cleanQR;
    }

    // 5. Clean legacy prefixes
    if (parsedId.toUpperCase().includes('AMT-CONNECT-VERIFY:')) {
      const parts = parsedId.split(/AMT-CONNECT-VERIFY:/i);
      if (parts && parts[1]) {
        parsedId = parts[1];
      }
    }

    // Trim and clean possible enclosing quotes
    parsedId = parsedId.trim().replace(/^['"\[\]]|['"\[\]]$/g, '').trim();

    // Re-verify the DB from disk just to be absolutely sure we're checking against fresh sync results
    const freshDb = APIService.getDb();
    const found = freshDb.users.find(u => {
      const uIdClean = String(u.id || '').trim().toLowerCase();
      const scannedIdClean = parsedId.toLowerCase();
      return uIdClean === scannedIdClean || uIdClean === scannedIdClean.replace(/\D/g, '') || scannedIdClean === uIdClean.replace(/\D/g, '');
    });

    if (found) {
      // Ensure we validate their account security status first
      if (found.status === 'Pending') {
        Swal.fire({
          icon: 'warning',
          title: 'บัญชีอยู่ระหว่างรออนุมัติ',
          text: 'สถานะของท่าน: กำลังรอการอนุมัติโปรดติดต่อผู้บริหารระบบ',
          confirmButtonColor: '#0F172A'
        });
        return;
      }
      if (found.status === 'พ้นสภาพ') {
        Swal.fire({
          icon: 'error',
          title: 'บัญชีผู้ใช้นี้พ้นสภาพแล้ว',
          text: 'สถานะของท่าน: พ้นสภาพนักศึกษา/บุคคลากร และไม่สามารถเข้าสู่ระบบได้',
          confirmButtonColor: '#0F172A'
        });
        return;
      }
      if (found.status === 'พักการเรียน') {
        Swal.fire({
          icon: 'error',
          title: 'บัญชีถูกระงับชั่วคราว',
          text: 'สถานะของท่าน: พักการเรียน และไม่สามารถเข้าสู่ระบบได้',
          confirmButtonColor: '#0F172A'
        });
        return;
      }
      if (found.status === 'จบการศึกษา') {
        Swal.fire({
          icon: 'error',
          title: 'บัญชีพ้นฐานพอร์ทัลหลัก',
          text: 'สถานะของท่าน: จบการศึกษา และไม่สามารถเข้าใช้งานระบบควบคุมได้',
          confirmButtonColor: '#0F172A'
        });
        return;
      }

      // Prompt confirmation before logging in to verify user identity
      Swal.fire({
        title: 'ยืนยันตัวตนผู้ใช้ระบบ',
        html: `
          <div class="flex flex-col items-center space-y-4 font-sans select-none my-2 p-1 text-center">
            ${found.photoUrl ? `
              <img src="${found.photoUrl}" alt="Profile" class="w-24 h-24 rounded-full object-cover border-4 border-slate-100 shadow-md" referrerPolicy="no-referrer" />
            ` : `
              <div class="w-24 h-24 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center border border-dashed border-slate-300">
                <span class="text-xs uppercase font-extrabold text-slate-500">${found.firstName.charAt(0)}</span>
              </div>
            `}
            <div>
              <h3 class="text-sm font-bold text-slate-800">คุณคือ ${found.firstName} ${found.lastName} ใช่หรือไม่?</h3>
              <p class="text-xs text-slate-500 mt-1">ตำแหน่ง: <span class="font-bold text-slate-700">${found.role}</span> | รหัส: <span class="font-mono text-slate-700">${found.id}</span></p>
            </div>
            <p class="text-[10px] text-slate-400 font-sans tracking-wide leading-normal max-w-[280px]">
              โปรดยืนยันตัวตนของคุณเพื่อความปลอดภัยก่อนเข้าใช้งานแดชบอร์ดพอร์ทัล
            </p>
          </div>
        `,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'ใช่, ฉันเอง',
        cancelButtonText: 'ไม่ใช่ฉัน',
        confirmButtonColor: '#0F172A',
        cancelButtonColor: '#64748B'
      }).then((result) => {
        if (result.isConfirmed) {
          setIsLoginCameraActive(false);
          setScannedUser(null);
          setCurrentUser(found);
          setCurrentScreen('dashboard');

          Swal.fire({
            icon: 'success',
            title: 'เข้าสู่ระบบสำเร็จผ่านคิวอาร์โค้ด',
            text: `ยินดีต้อนรับคุณ ${found.firstName} ${found.lastName} (${found.role})`,
            timer: 1800,
            showConfirmButton: false
          });
        }
      });
    } else {
      Swal.fire({
        icon: 'error',
        title: 'ไม่พบคิวอาร์โค้ดสิทธิ์นี้',
        html: `
          <div class="text-left text-xs space-y-2 select-text font-sans">
            <p><strong>รหัสประจำตัวที่ถอดความได้:</strong> <code class="bg-slate-100 text-slate-800 px-1 py-0.5 rounded font-mono text-xs font-bold">${parsedId || 'ว่างเปล่า'}</code></p>
            <p class="text-slate-500 text-[11px] leading-relaxed">
              ไม่พบรหัสคิวอาร์นี้ในฐานข้อมูลโรงเรียนช่างการบินชลบุรี หรือรูปแบบข้อมูลคิวอาร์ไม่ได้รับสิทธิ์ตรวจสอบ
            </p>
            <p class="text-slate-400 text-[10px] break-all font-mono">ข้อมูลสแกนดิบ (Raw): "${qrData}"</p>
          </div>
        `,
        confirmButtonColor: '#0F172A'
      });
    }
  };

  // Overlays state values synced early

  // Sync state polling
  const [syncStatus, setSyncStatus] = useState(APIService.getLastSyncStatus());

  useEffect(() => {
    // Sync status checker loop
    const interval = setInterval(() => {
      setSyncStatus(APIService.getLastSyncStatus());
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // Real-time data polling loop (every 45 seconds to keep well inside Google Apps Script API quotas)
  useEffect(() => {
    const interval = setInterval(() => {
      if (currentUser) {
        pullLatestData(true);
      }
    }, 45000);
    return () => clearInterval(interval);
  }, [currentUser]);

  // Update central state and auto-save
  const updateDb = async (newDb: typeof db) => {
    setDb(newDb);
    APIService.saveDb(newDb);

    try {
      await syncWithGoogleSheets(newDb);
    } catch (err) {
      console.warn('Background sync on update failed:', err);
    }
  };

  const pullLatestData = async (quiet = false): Promise<boolean> => {
    if (!quiet) {
      Swal.fire({
        title: 'กำลังเตรียม Form เพื่อลงทะเบียน',
        allowOutsideClick: false,
        showConfirmButton: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });
    }

    try {
      const fetchedData = await pullFromGoogleSheets();
      if (fetchedData && typeof fetchedData === 'object') {
        const currentDb = APIService.getDb();
        const mergedDb = {
          ...currentDb,
          users: fetchedData.users || currentDb.users,
          roomRequests: fetchedData.roomRequests || currentDb.roomRequests,
          roomUsageRecords: fetchedData.roomUsageRecords || currentDb.roomUsageRecords,
          equipment: fetchedData.equipment || currentDb.equipment,
          borrowRecords: fetchedData.borrowRecords || currentDb.borrowRecords,
          schedules: fetchedData.schedules || currentDb.schedules,
          examSchedules: fetchedData.examSchedules || currentDb.examSchedules,
          examGrades: fetchedData.examGrades || currentDb.examGrades,
        };
        
        // --- DETECT REAL-TIME BACKGROUND CHANGES AND PUSH NOTIFICATIONS ---
        detectAndNotifyChanges(currentDb, mergedDb);

        APIService.saveDb(mergedDb);
        setDb(mergedDb);
        return true;
      }
    } catch (err) {
      console.warn('Pulling latest user data failed, using cached database:', err);
    } finally {
      if (!quiet) {
        Swal.close();
      }
    }
    return false;
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const idClean = loginId.trim();

    // Show a modern high-end loading popup to pull latest database entries before verifying credentials
    Swal.fire({
      title: 'กำลังเข้าสู่ระบบ',
      allowOutsideClick: false,
      showConfirmButton: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    // Synchronously pull latest database state
    await pullLatestData(true);

    Swal.close();

    // 1. Admin bypass check
    if (idClean.toLowerCase() === 'admin' && loginPassword === 'admin1234') {
      const adminObject: User = {
        id: 'ADMIN',
        photoUrl: 'https://images.unsplash.com/photo-1540569014015-19a7be504e3a?w=150',
        firstName: 'Admin',
        lastName: 'Manager',
        role: 'Admin',
        signature: 'ADMIN_SIGNATURE',
        email: 'admin@amtconnect.com',
        status: 'Active',
        createdAt: '2569/06/11'
      };
      
      setCurrentUser(adminObject);
      setCurrentScreen('dashboard');
      Swal.fire({
        icon: 'success',
        title: 'ผู้บริหารระบบเข้าใช้งาน',
        text: 'ยินดีต้อนรับเข้าสูู่บอร์ดแอดมิน AMT Connect',
        timer: 1500,
        showConfirmButton: false
      });
      return;
    }

    // 2. Normal check using APIService
    const res = APIService.login(idClean, loginPassword);
    if (res.success && res.user) {
      setCurrentUser(res.user);
      setCurrentScreen('dashboard');
      Swal.fire({
        icon: 'success',
        title: 'ลงชื่อเข้าใช้สำเร็จ',
        text: `ยินดีต้อนรับคุณ ${res.user.firstName} (${res.user.role}) เข้าใช้งานระบบ`,
        timer: 1500,
        showConfirmButton: false
      });
    } else {
      Swal.fire({
        icon: 'error',
        title: 'ไม่สามารถเข้าสู่ระบบได้เนื่องจากรหัสผ่านไม่ถูกต้อง',
        text: res.message,
        confirmButtonColor: '#171717'
      });
    }
  };

  const handleRegisterSuccess = (candidate: Omit<User, 'status' | 'createdAt'>) => {
    const res = APIService.register(candidate);
    if (res.success) {
      const currentDb = APIService.getDb();
      setDb(currentDb); // reload from disk helper
      
      Swal.fire({
        icon: 'success',
        title: 'ยื่นใบลงทะเบียนสำเร็จ',
        text: 'ข้อมูลใบสมัครและลายเซ็นของท่านได้รับการบันทึกบนอุปกรณ์นี้แล้ว และกำลังซิงค์ขึ้นระบบ Google Sheets ในพื้นหลังเฉกเช่นคลาเวย์ โปรดรอผู้ประสานงาน/แอดมินวิทยาลัยตรวจสอบและอนุมัติสิทธิ์เข้าใช้',
        confirmButtonColor: '#0F172A'
      });

      // Send email notification to registered user
      if (candidate.email) {
        const emailSubject = `[AMT CONNECT] ยืนยันการลงทะเบียนขอสิทธิ์เข้าใช้งานระบบ`;
        const emailBody = `สวัสดีคุณ ${candidate.firstName} ${candidate.lastName},

ขอบคุณสำหรับการลงทะเบียนเข้าใช้งานระบบ AMT CONNECT (ศูนย์บริหารสารสนเทศและการสอบอู่การช่างอากาศยาน)
ข้อมูลการสมัครสถานภาพ (${candidate.role}) ของท่านได้รับการอัปโหลดเข้าสู่คิวระบบเรียบร้อยแล้ว สำเร็จ ณ วันที่ ${new Date().toLocaleDateString('th-TH')}

โปรดรอทางแอดมินหรือผู้บริหารการช่างพิจารณาตรวจสอบข้อมูลและลายเซ็นดิจิทัล เพื่ออนุมัติเปิดสิทธิ์การเข้าใช้ระบบในขั้นตอนต่อไป

ด้วยความเคารพ,
ศูนย์บริหารสารสนเทศและการสอบอู่การช่างอากาศยาน AMT CONNECT`;
        
        sendSystemEmail(candidate.email, emailSubject, emailBody).catch((err) => {
          console.warn('Silent registration email failure:', err);
        });
      }

      // Synchronize in the background immediately
      syncWithGoogleSheets(currentDb).catch((err) => {
        console.warn('Background registration sheet sync status:', err);
      });

      setCurrentScreen('home');
      setLoginId('');
      setLoginPassword('');
    } else {
      Swal.fire({
        icon: 'error',
        title: 'ลงทะเบียนติดขัด',
        text: res.message,
        confirmButtonColor: '#171717'
      });
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setCurrentScreen('home');
    setLoginId('');
    setLoginPassword('');
    Swal.fire({
      icon: 'info',
      title: 'ออกจากระบบสำเร็จ',
      text: 'ขอบคุณที่ใช้งานระบบตรวจห้องและอุปกรณ์ AMT Connect',
      timer: 1000,
      showConfirmButton: false
    });
  };

  const forceTriggerSync = () => {
    Swal.fire({
      title: 'กำลังอัพเดตข้อมูลไปยังคลาวด์ชีต...',
      text: 'ติดต่อระบบประมวลผล Google Apps Script',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    APIService.saveDb(db);
    setTimeout(() => {
      Swal.close();
      Swal.fire({
        icon: 'success',
        title: 'อัปเดตระบบชีตสมบูรณ์',
        text: 'ประวัติ อุปกรณ์ และตารางสอบ ได้อัพโหลดขึ้น Google Sheet เรียบร้อยแล้ว',
        confirmButtonColor: '#171717'
      });
    }, 1500);
  };

  // --- ACTIONS FOR ADMIN ---
  const handleApproveUser = (userId: string) => {
    const userToApprove = db.users.find(u => u.id === userId);
    if (!userToApprove) return;

    if (currentUser?.role === 'Admin') {
      if (userToApprove.role === 'Instructor' || userToApprove.role === 'นักศึกษา') {
        Swal.fire('ไม่สามารถอนุมัติได้', 'Admin ไม่สามารถอนุมัติ Instructor หรือ นักศึกษาได้', 'error');
        return;
      }
    } else if (currentUser?.role === 'Training Manager' || currentUser?.role === 'Training Staff') {
      if (userToApprove.role !== 'นักศึกษา' && userToApprove.role !== 'Instructor') {
        Swal.fire('ไม่สามารถอนุมัติได้', 'ฝ่าย Training สามารถอนุมัติได้เฉพาะ นักศึกษา และ Instructor เท่านั้น', 'error');
        return;
      }
    }

    const nextUsers = db.users.map(u => u.id === userId ? { ...u, status: 'Active' as const } : u);
    updateDb({ ...db, users: nextUsers });

    // Send email notification to approved user
    if (userToApprove.email) {
      const emailSubject = `[AMT CONNECT] บัญชีผู้ใช้งานได้รับการอนุมัติใช้งานแล้ว`;
      const emailBody = `สวัสดีคุณ ${userToApprove.firstName} ${userToApprove.lastName},

ฝ่ายจัดการระบบของศูนย์บริหารสารสนเทศและการสอบอู่การช่างอากาศยาน AMT CONNECT ได้พิจารณาและอนุมัติบัญชีผู้ใช้งานของคุณแล้วเมื่อวันที่ ${new Date().toLocaleDateString('th-TH')}

รายละเอียดบัญชีการเข้าใช้งาน:
- รหัสประจำตัว/รหัสนักศึกษา: ${userToApprove.id}
- ชื่อ-นามสกุล: ${userToApprove.firstName} ${userToApprove.lastName}
- บทบาทหน้าที่: ${userToApprove.role}
- สถานะระบบ: ✅ Active (พร้อมใช้งาน)

ขณะนี้ท่านสามารถนำรหัสประจำตัวของคุณสแกน/สืบค้นบนอุปกรณ์ปลายทางเพื่อเข้าใช้งาน ขอยืมเครื่องมือ หรือขอใช้ห้องปฏิบัติการได้ตามสิทธิ์ของบทบาทตนเองในระบบเรียบร้อยแล้วค่ะ/ครับ

ด้วยความเคารพ,
ศูนย์บริหารสารสนเทศและการสอบอู่การช่างอากาศยาน AMT CONNECT`;

      Swal.fire({
        title: 'กำลังอนุมัติสิทธิ์...',
        text: 'กรุณารอสักครู่ ระบบกำลังสื่อสารกับเครื่องส่งเมล',
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });

      sendSystemEmail(userToApprove.email, emailSubject, emailBody).then((emailRes) => {
        if (emailRes.success) {
          Swal.fire({
            icon: 'success',
            title: 'อนุมัติผู้ใช้สำเร็จ!',
            text: `อนุมัติสิทธิ์บัญชีเรียบร้อย และระบบส่งจดหมายตอบรับสำเร็จไปยัง ${userToApprove.email}`,
            confirmButtonColor: '#0F172A'
          });
        } else {
          Swal.fire({
            icon: 'warning',
            title: 'อนุมัติสำเร็จ แต่อีเมลล้มเหลว',
            text: `ฝ่ายทะเบียนได้รับการเปิดสิทธิ์เข้าระบบแล้ว แต่อีเมลส่งแจ้งตอบกลับขัดข้อง: ${emailRes.message} (โปรดขอให้ Admin นำ Google Apps Script Web App URL บัญชีของท่านไปบันทึกตรงแผง Admin Settings เพื่อปลดล็อก)`,
            confirmButtonColor: '#0F172A'
          });
        }
      }).catch((err) => {
        Swal.fire({
          icon: 'warning',
          title: 'อนุมัติสำเร็จ แต่ติดต่อส่งเมลขัดข้อง',
          text: `สิทธิ์ผู้ใช้เปิดแล้ว แต่การเชื่อมต่อเครือข่ายส่งอีเมลล้มเหลว: ${err.message || err}`,
          confirmButtonColor: '#0F172A'
        });
      });
    } else {
      Swal.fire('อนุมัติแล้ว', `อนุมัติสิทธิ์ความปลอดภัยผู้ใช้นี้เรียบร้อย`, 'success');
    }
  };

  const handleRejectUser = (userId: string) => {
    const nextUsers = db.users.filter(u => u.id !== userId);
    updateDb({ ...db, users: nextUsers });
    Swal.fire('ปฏิเสธคำขอสำเร็จ', 'นำผู้ใช้งานออกจากบัญชีคิวคำขอลงทะเบียนแล้ว', 'info');
  };

  const handleUpdateStudentStatus = (userId: string, newStatus: User['status']) => {
    const targetUser = db.users.find(u => u.id === userId);
    const nextUsers = db.users.map(u => u.id === userId ? { ...u, status: newStatus } : u);
    updateDb({ ...db, users: nextUsers });

    // Send email notification to updated user
    if (targetUser && targetUser.email) {
      const emailSubject = `[AMT CONNECT] ปรับเปลี่ยนสถานะบัญชีนักศึกษา/ผู้ใช้งานในระบบ`;
      const emailBody = `สวัสดีคุณ ${targetUser.firstName} ${targetUser.lastName},

ระบบได้รับข้อมูลการขออัปเดตหรือมีการปรับเปลี่ยนสถานะข้อมูลบัญชีของคุณเมื่อวันที่ ${new Date().toLocaleDateString('th-TH')}

รายละเอียดการเปลี่ยนแปลง:
- รหัสนักศึกษา/รหัสประจำตัว: ${targetUser.id}
- ชื่อ-นามสกุล: ${targetUser.firstName} ${targetUser.lastName}
- สถานะใหม่ในระบบ: ${newStatus}

หากการเปลี่ยนสถานะดังกล่าวส่งผลให้ช่องทางการเข้าใช้ห้องหรืออุปกรณ์พังเสียหาย/ถูกยกเลิก โปรดเข้าสู่ระบบหรือติดต่อแอดมินหรือผู้ควบคุมที่ดูแลระบบเพื่อสอบถามรายละเอียดเพิ่มเติม

ด้วยความเคารพ,
ศูนย์บริหารสารสนเทศและการสอบอู่การช่างอากาศยาน AMT CONNECT`;

      Swal.fire({
        title: 'กำลังสลักข้อมูลใหม่...',
        text: 'กรุณารอสักครู่ ระบบกำลังปรับปรุงและส่งเมลตรวจสอบสิทธิ์',
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });

      sendSystemEmail(targetUser.email, emailSubject, emailBody).then((emailRes) => {
        if (emailRes.success) {
          Swal.fire({
            icon: 'success',
            title: 'เปลี่ยนสถานะสำเร็จ',
            text: `สันทัดสถานะใหม่เป็น ${newStatus} และระบบได้จัดส่งอีเมลแจ้งถึงผู้ถือบัญชี ${targetUser.email} แล้ว`,
            confirmButtonColor: '#0F172A'
          });
        } else {
          Swal.fire({
            icon: 'warning',
            title: 'เปลี่ยนสถานะแล้ว แต่อีเมลล้มเหลว',
            text: `ระบบปรับข้อมูลเป็น ${newStatus} เรียบร้อย แต่อีเมลสะท้อนกลับไม่สำเร็จ: ${emailRes.message} (โปรดตรวจสอบลิงก์ Google Script API ในการควบคุม)`,
            confirmButtonColor: '#0F172A'
          });
        }
      }).catch((err) => {
        Swal.fire({
          icon: 'warning',
          title: 'ปรับปรุงสำเร็จ แต่ส่งเมลขัดข้อง',
          text: `เปลี่ยนสถานะเป็น ${newStatus} สำเร็จ แต่พบข้อผิดพลาด: ${err.message || err}`,
          confirmButtonColor: '#0F172A'
        });
      });
    } else {
      Swal.fire('เปลี่ยนสถานะเรียบร้อย', `สันทัดสถานะสำเร็จเป็น ${newStatus}`, 'success');
    }
  };

  const handleToggleRecordStatus = (recId: string) => {
    const nextRecords = db.roomUsageRecords.map(r => 
      r.id === recId 
        ? { ...r, maintenanceOfficerStatus: (r.maintenanceOfficerStatus === 'Acknowledged' ? 'Pending' : 'Acknowledged') as any } 
        : r
    );
    updateDb({ ...db, roomUsageRecords: nextRecords });
    Swal.fire('อัปเดตบันทึกห้องสำเร็จ', 'เปลี่ยนสถานภาพยอมรับลายเซ็นสมุดส่งตรวจเสร็จสิ้น', 'success');
  };

  // --- ACTIONS FOR TRAINING STAFF/MANAGER ---
  const handleUpdateProfile = (updatedProfile: Partial<User>) => {
    if (!currentUser) return;
    const nextUsers = db.users.map(u => u.id === currentUser.id ? { ...u, ...updatedProfile } : u);
    const updatedUser = { ...currentUser, ...updatedProfile };
    setCurrentUser(updatedUser);
    updateDb({ ...db, users: nextUsers });
  };

  const handleSubmitRoomRequest = (newRequest: Omit<RoomRequest, 'id' | 'maintenanceApproved' | 'isRoomUsageRecordCreated'>): boolean => {
    // 1. Validate date
    if (!newRequest.date) {
      Swal.fire({
        icon: 'error',
        title: 'ข้อมูลไม่ถูกต้อง',
        text: 'กรุณาระบุวันที่ต้องการจองใช้ห้อง',
        confirmButtonColor: '#171717'
      });
      return false;
    }

    // Helper functions for validation
    const normalizeDate = (dateStr: string): string => {
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
        // Correct Thai Buddhist Era (B.E.) years to C.E. if necessary
        if (year > 2400) {
          year -= 543;
        }
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
      return trimmed;
    };

    const parseTimeRange = (timeRangeStr: string) => {
      const parts = timeRangeStr.split('-');
      if (parts.length === 2) {
        return {
          startTime: parts[0].trim(),
          endTime: parts[1].trim(),
        };
      }
      return { startTime: '', endTime: '' };
    };

    // 2. Parse and validate requested times
    const newTimes = parseTimeRange(newRequest.timeRange);
    if (!newTimes.startTime || !newTimes.endTime) {
      Swal.fire({
        icon: 'error',
        title: 'รูปแบบเวลาไม่ถูกต้อง',
        text: 'การระบุช่วงเวลาการจองไม่ครบคู่สมบูรณ์',
        confirmButtonColor: '#171717'
      });
      return false;
    }

    if (newTimes.startTime >= newTimes.endTime) {
      Swal.fire({
        icon: 'error',
        title: 'ช่วงเวลาไม่ถูกต้อง',
        text: 'เวลาเริ่มต้นต้องเร็วกว่าเวลาสิ้นสุด',
        confirmButtonColor: '#171717'
      });
      return false;
    }

    // 3. Collision check: Cannot book same room, same date, overlapping time if not Rejected
    const currentNormDate = normalizeDate(newRequest.date);
    const hasOverlap = db.roomRequests.some(existing => {
      if (existing.maintenanceApproved === 'Rejected') return false;
      if (existing.room.trim().toLowerCase() !== newRequest.room.trim().toLowerCase()) return false;
      if (normalizeDate(existing.date) !== currentNormDate) return false;

      const existTimes = parseTimeRange(existing.timeRange);
      if (!existTimes.startTime || !existTimes.endTime) return false;

      // Check range overlap: S1 < E2 and S2 < E1
      return existTimes.startTime < newTimes.endTime && newTimes.startTime < existTimes.endTime;
    });

    if (hasOverlap) {
      Swal.fire({
        icon: 'error',
        title: 'การจองซ้อนทับกัน',
        text: `ห้อง "${newRequest.room}" ถูกจองในช่วงเวลาดังกล่าวแล้วในวันที่ระบุ กรุณาปรับเปลี่ยนเวลาหรือห้องปฏิบัติการใหม่`,
        confirmButtonColor: '#171717'
      });
      return false;
    }

    const freshRequest: RoomRequest = {
      ...newRequest,
      id: `REQ-${Date.now()}`,
      maintenanceApproved: 'Pending' as const,
      isRoomUsageRecordCreated: false,
    };
    const nextReqs = [...db.roomRequests, freshRequest];
    updateDb({ ...db, roomRequests: nextReqs });

    // Find requester email from db.users and send notification
    const requesterUser = db.users.find(u => u.id === newRequest.requesterId);
    if (requesterUser && requesterUser.email) {
      const emailSubject = `[AMT CONNECT] ยืนยันการยื่นคำร้องขอใช้ห้องปฏิบัติการ (${newRequest.room})`;
      const emailBody = `สวัสดีคุณ ${newRequest.requesterName},

คำร้องขอใช้ห้องปฏิบัติการของท่านได้รับการลงระบบเรียบร้อยแล้ว:
- หมายเลขคำขอ: ${freshRequest.id}
- ห้องปฏิบัติการ: ${newRequest.room}
- วันที่เข้าใช้งานที่ขอ: ${newRequest.date}
- ช่วงเวลา: ${newRequest.timeRange}
- วัตถุประสงค์: ${newRequest.purpose}

ขณะนี้คำขออยู่ระหว่างการพิจารณาตรวจสอบสิทธิ์และความพร้อมใช้งานของคลังโรงผลิต/ผู้ดูแลระบบซ่อมบำรุง

ด้วยความเคารพ,
ศูนย์บริหารสารสนเทศและการสอบอู่การช่างอากาศยาน AMT CONNECT`;

      sendSystemEmail(requesterUser.email, emailSubject, emailBody).catch((err) => {
        console.warn('Silent room request email notification failure:', err);
      });
    }

    return true;
  };

  const handleCancelRoomRequest = (requestId: string) => {
    Swal.fire({
      title: 'ต้องการยกเลิกคำขอใช้ห้องปฏิบัติการนี้?',
      text: 'คุณต้องการยกเลิกคำขอใช้ห้องแบบฟอร์มนี้ใช่หรือไม่?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#e11d48',
      cancelButtonColor: '#525252',
      confirmButtonText: 'ใช่, ดำเนินการยกเลิก',
      cancelButtonText: 'ย้อนกลับ'
    }).then((result) => {
      if (result.isConfirmed) {
        const nextReqs = db.roomRequests.filter(r => r.id !== requestId);
        updateDb({ ...db, roomRequests: nextReqs });
        Swal.fire('ยกเลิกแล้ว!', 'ทำการยกเลิกและนำการขอจองห้องดังกล่าวออกจากระบบแล้ว', 'success');
      }
    });
  };

  const handleUpdateStudentStatusByStaff = (studentId: string, status: User['status']) => {
    const targetStudent = db.users.find(u => u.id === studentId);
    const nextUsers = db.users.map(u => u.id === studentId ? { ...u, status } : u);
    updateDb({ ...db, users: nextUsers });

    // Send email notification to student
    if (targetStudent && targetStudent.email) {
      const emailSubject = `[AMT CONNECT] อัปเดตข้อเสนอเปลี่ยนแปลงสถานภาพนักศึกษา`;
      const emailBody = `สวัสดีคุณ ${targetStudent.firstName} ${targetStudent.lastName},

เจ้าหน้าที่แผนกอบรม (Training Staff) ได้ส่งรายชื่อข้อเสนอเปลี่ยนแปลงสถานภาพทางทะเบียนและผลการเรียนของคุณเข้าสู่ที่ประชุมคณะทำงานเพื่อพิจารณาอนุมัติเชิงบริหาร:
- รหัสนักศึกษา: ${targetStudent.id}
- สถานะที่เสนอ: ${status}

ในระหว่างขั้นตอนนี้ สิทธิ์หรือความสามารถในการขอใช้ระบบของโรงเรียนฝึกอู่การช่างอาจมีการเปลี่ยนแปลง หรือรอการลงลายมือชื่อพินิจการปรับเปลี่ยนอย่างเป็นทางการโดยผู้บริหารการอบรมหลักสูตรต่อไป

ด้วยความเคารพ,
ศูนย์บริหารสารสนเทศและการสอบอู่การช่างอากาศยาน AMT CONNECT`;

      Swal.fire({
        title: 'กำลังอัปเดตและแจ้งเตือน...',
        text: 'กรุณารอสักครู่ ระบบกำลังส่งต่อและโทรแจ้งผู้ใช้ผ่านอีเมล',
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });

      sendSystemEmail(targetStudent.email, emailSubject, emailBody).then((emailRes) => {
        if (emailRes.success) {
          Swal.fire({
            icon: 'success',
            title: 'เสนอเปลี่ยนแปลงสถานภาพสำเร็จ!',
            text: `ปรับปรุงข้อมูลเป็น ${status} และส่งเมลความคืบหน้าแก่นักศึกษา (${targetStudent.email}) เรียบร้อยแล้ว`,
            confirmButtonColor: '#0F172A'
          });
        } else {
          Swal.fire({
            icon: 'warning',
            title: 'เสนอเปลี่ยนข้อมูลสำเร็จ แต่อีเมลขัดข้อง',
            text: `ปรับสถานะเป็น ${status} แล้ว แต่อีเมลส่งออกแจ้งผู้เรียนไม่สำเร็จ: ${emailRes.message} (โปรดตรวจสอบ API Google Apps Script)`,
            confirmButtonColor: '#0F172A'
          });
        }
      }).catch((err) => {
        Swal.fire({
          icon: 'warning',
          title: 'เปลี่ยนแล้ว แต่อีเมลขัดข้อง',
          text: `เปลี่ยนสถานะเป็น ${status} แล้ว แต่อีเมลขัดข้องขณะเชื่อมโยง: ${err.message || err}`,
          confirmButtonColor: '#0F172A'
        });
      });
    } else {
      Swal.fire('สำเร็จ', 'ส่งข้อเสนอเปลี่ยนแปลงสถานะนักศึกษาเข้าสู่ระบบบริหารพิจารณาแล้ว', 'success');
    }
  };

  const handleApproveStudentStatusByManager = (studentId: string) => {
    const student = db.users.find(u => u.id === studentId);

    // Send email notification to student
    if (student && student.email) {
      const emailSubject = `[AMT CONNECT] ผู้บริหารได้รับการตรวจสอบและอนุมัติสถานะระดับหลักสูตร`;
      const emailBody = `สวัสดีคุณ ${student.firstName} ${student.lastName},

ผู้จัดการแผนกฝึกอบรม (Training Manager) ได้ลงนามและทำการอนุมัติสิทธิ์ พร้อมทั้งรับรองสถานะภาพทางทะเบียนการเรียนของคุณในระบบเรียบร้อยแล้ว:
- รหัสนักศึกษา: ${student.id}
- ชื่อ-นามสกุล: ${student.firstName} ${student.lastName}
- สถานภาพล่าสุด: ✅ ${student.status} (ความเห็นชอบ: อนุมัติผ่านเกณฑ์สิทธิ์ความปลอดภัย)

ขณะนี้ประวัติและสถานภาพของคุณได้รับการบันทึกยืนยันเป็นที่ประจักษ์ในศูนย์บริหารระบบจัดจ้างแล้ว คุณสามารถดำเนินการกิจกรรมขอสิทธิ์อื่นๆ ได้ทันทีค่ะ/ครับ

ด้วยความเคารพ,
ศูนย์บริหารสารสนเทศและการสอบอู่การช่างอากาศยาน AMT CONNECT`;

      Swal.fire({
        title: 'กำลังส่งเมลรับรอง...',
        text: 'กรุณารอสักครู่ ระบบกำลังส่งต่อและโทรแจ้งผู้ใช้ผ่านอีเมล',
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });

      sendSystemEmail(student.email, emailSubject, emailBody).then((emailRes) => {
        if (emailRes.success) {
          Swal.fire({
            icon: 'success',
            title: 'พิจารณาอนุมัติสถานะสิทธิ์สมบูรณ์!',
            text: `สิทธิผู้รับคำยืนยันคือ ${student.status} และได้แจ้งใบอนุญาตอย่างเป็นทางการแก่นักศึกษา (${student.email}) แล้ว`,
            confirmButtonColor: '#0F172A'
          });
        } else {
          Swal.fire({
            icon: 'warning',
            title: 'พิจารณาอนุมัติสำเร็จ แต่อีเมลขัดข้อง',
            text: `ลงประวัติช่าง ${student.status} แล้ว แต่อีเมลรายงานภายนอกเข้าสมุดบัญชีไม่สำเร็จ: ${emailRes.message}`,
            confirmButtonColor: '#0F172A'
          });
        }
      }).catch((err) => {
        Swal.fire({
          icon: 'warning',
          title: 'อนุมัติสำเร็จ แต่อีเมลขัดข้อง',
          text: `เปลี่ยนสถานภาพทางทะเบียนเรียบร้อย แต่เครือข่ายประจบพึ่งพิงขัดข้อง: ${err.message || err}`,
          confirmButtonColor: '#1E293B'
        });
      });
    } else {
      Swal.fire('สำเร็จ', 'อนุมัติสถานภาพนักศึกษาเรียบร้อยแล้ว', 'success');
    }
  };

  const handleAddEquipment = (newTool: Equipment) => {
    const adjustedTool = {
      ...newTool,
      status: (newTool.qty === 0) ? ('NotReady' as const) : newTool.status
    };
    const nextEquipments = [...db.equipment, adjustedTool];
    updateDb({ ...db, equipment: nextEquipments });
  };

  const handleCheckReturnEquipment = (borrowId: string) => {
    const borrowObj = db.borrowRecords.find(b => b.id === borrowId);
    if (!borrowObj) return;

    // Mark borrow returned, save check signature and name
    const nextBorrowRecords = db.borrowRecords.map(b => 
      b.id === borrowId 
        ? { 
            ...b, 
            status: 'Returned' as const, 
            returnDate: new Date().toLocaleDateString('th-TH') + ' ' + new Date().toLocaleTimeString('th-TH'),
            checkSignature: currentUser?.signature || '',
            checkerName: currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'Maintenance Officer'
          } 
        : b
    );

    // Increase equipment stock
    const nextEquipment = db.equipment.map(eq => 
      eq.code === borrowObj.equipmentCode 
        ? { 
            ...eq, 
            qty: eq.qty + borrowObj.qty,
            status: (eq.qty + borrowObj.qty > 0 && eq.status === 'NotReady') ? ('Ready' as const) : eq.status
          } 
        : eq
    );

    updateDb({
      ...db,
      borrowRecords: nextBorrowRecords,
      equipment: nextEquipment
    });
  };

  const handleUpdateCalibration = (toolCode: string, calDate: string, status: Equipment['status']) => {
    const nextEquipment = db.equipment.map(eq => 
      eq.code === toolCode 
        ? { 
            ...eq, 
            calibrationDate: calDate, 
            status: eq.qty === 0 ? ('NotReady' as const) : status 
          } 
        : eq
    );
    updateDb({ ...db, equipment: nextEquipment });
  };

  const handleUpdateEquipment = (toolCode: string, fields: Partial<Equipment>) => {
    const nextEquipment = db.equipment.map(eq => {
      if (eq.code === toolCode) {
        const nextQty = fields.qty !== undefined ? fields.qty : eq.qty;
        const nextStatus = nextQty === 0 ? ('NotReady' as const) : (fields.status !== undefined ? fields.status : eq.status);
        return {
          ...eq,
          ...fields,
          qty: nextQty,
          status: nextStatus
        };
      }
      return eq;
    });
    updateDb({ ...db, equipment: nextEquipment });
  };



  // --- ACTIONS FOR MAINTENANCE ---
  const handleCertifyRoomRequest = (requestId: string, status: 'Approved' | 'Rejected', note: string, officerName: string, officerSignature?: string) => {
    const reqObj = db.roomRequests.find(r => r.id === requestId);
    if (!reqObj) return;

    const todayStr = new Date().toISOString().split('T')[0];
    const nextRequests = db.roomRequests.map(r => 
      r.id === requestId 
        ? { 
            ...r, 
            maintenanceApproved: status, 
            maintenanceOfficerName: officerName, 
            maintenanceOfficerSignature: officerSignature, 
            maintenanceCertifiedDate: status === 'Approved' ? todayStr : undefined,
            maintenanceNote: note, 
            isRoomUsageRecordCreated: status === 'Approved' 
          } 
        : r
    );

    // If marked approved, auto export a room record on TLTC-MO-034
    let nextUsageRecords = [...db.roomUsageRecords];
    if (status === 'Approved') {
      const freshRecord: RoomUsageRecord = {
        id: `REC-${Date.now()}`,
        date: reqObj.date,
        room: reqObj.room,
        requesterName: reqObj.requesterName,
        report: `ความประสงค์: ${reqObj.purpose}. สังเกตุใบงาน: ${note || '-'}`,
        maintenanceOfficerStatus: 'Pending',
        remarks: `อ้างอิงเอกสารอนุมัติห้อง ${reqObj.id}`
      };
      nextUsageRecords.push(freshRecord);
    }

    updateDb({
      ...db,
      roomRequests: nextRequests,
      roomUsageRecords: nextUsageRecords
    });

    // Find requester email from db.users and send approval/rejection notification
    const requesterUser = db.users.find(u => u.id === reqObj.requesterId);
    if (requesterUser && requesterUser.email) {
      const isApproved = status === 'Approved';
      const emailSubject = `[AMT CONNECT] แจ้งผลการพิจารณาคำร้องขอใช้ห้องปฏิบัติการ (${reqObj.room})`;
      const emailBody = `สวัสดีคุณ ${reqObj.requesterName},

คำร้องขอใช้ห้องปฏิบัติการของท่านได้รับการพิจารณาเรียบร้อยแล้ว:
- หมายเลขคำขอ: ${reqObj.id}
- ห้องปฏิบัติการ: ${reqObj.room}
- วันที่เข้าใช้งาน: ${reqObj.date}
- ช่วงเวลา: ${reqObj.timeRange}
- ผลการพิจารณา: ${isApproved ? '✅ อนุมัติการเข้าใช้ห้อง' : '❌ ปฏิเสธคำร้องขอ'}
- เจ้าหน้าที่ผู้พิจารณา: ${officerName}
- หมายเหตุเพิ่มเติม: ${note || '-'}

${isApproved ? 'กรุณาตรวจสอบและปฏิบัติตามมาตรการช่างอย่างเคร่งครัด รวมถึงทำบันทึกประวัติการใช้ห้องปฏิบัติการ (TLTC-MO-034) หลังใช้งานเรียบร้อยด้วยค่ะ/ครับ' : 'ท่านสามารถเข้าสู่ระบบและปรับแก้รายละเอียดที่เหมาะสม เพื่อยื่นคำขอลมปราณใหม่อีกครั้งได้'}

ด้วยความเคารพ,
ศูนย์บริหารสารสนเทศและการสอบอู่การช่างอากาศยาน AMT CONNECT`;

      sendSystemEmail(requesterUser.email, emailSubject, emailBody).catch((err) => {
        console.warn('Silent room certification email failure:', err);
      });
    }
  };

  // --- ACTIONS FOR OFFICE / EXAMS ---
  const handleAddSchedule = (s: ClassSchedule | ClassSchedule[]) => {
    const schedulesToAdd = Array.isArray(s) ? s : [s];
    const nextSch = [...db.schedules, ...schedulesToAdd];
    updateDb({ ...db, schedules: nextSch });
  };

  const handleAddExam = (ex: ExamSchedule) => {
    const nextEx = [...db.examSchedules, ex];
    updateDb({ ...db, examSchedules: nextEx });
  };

  const handleAddGrade = (grade: ExamGrade) => {
    const nextGr = [...db.examGrades, grade];
    updateDb({ ...db, examGrades: nextGr });

    // Send email notification to each student listed in grades
    if (grade.grades && Array.isArray(grade.grades)) {
      grade.grades.forEach((item) => {
        const studentUser = db.users.find(u => u.id === item.studentId);
        if (studentUser && studentUser.email) {
          const emailSubject = `[AMT CONNECT] ประกาศรายงานผลคะแนนสอบวิชาสอบ ${grade.subjectName}`;
          const emailBody = `สวัสดีคุณ ${item.studentName},

สำนักงานหลักสูตรและการสอบอู่การช่างอากาศยานร่วมผลิตได้ประกาศรายงานผลคะแนนและผลฝึกฝนในกลุ่มวิชาเรียนอย่างเป็นทางการแล้ว:
- รายวิชาเรียน: ${grade.subjectName}
- สอบปฏิบัติครั้งที่: ${grade.round}
- รุ่นนักศึกษา: ชั้นรุ่นที่ ${grade.batch}
- คะแนนสอบที่ได้: ${item.score} คะแนน

คุณสามารถลงลายมือชื่อเข้าใช้งานบนเว็บไซต์ขบวนการเพื่อตรวจสอบตารางคะแนนสะสม และสมรรถนะการช่างภาพขยายของบอร์ดฝึกปฏิบัติการ ได้ทันทีในหน้านักเรียน/นักศึกษา

ด้วยความเคารพ,
ศูนย์บริหารสารสนเทศและการสอบอู่การช่างอากาศยาน AMT CONNECT`;

          sendSystemEmail(studentUser.email, emailSubject, emailBody).catch((err) => {
            console.warn(`Silent exam result email failure for student ${item.studentId}:`, err);
          });
        }
      });
    }
  };

  const handleRecordUsageFromDoc = (requestId: string, reportText: string, customRoom?: string, signature?: string) => {
    const reqObj = db.roomRequests.find(r => r.id === requestId);
    if (!reqObj) return;

    const freshRecord: RoomUsageRecord = {
      id: `REC-${Date.now()}`,
      date: reqObj.date,
      room: customRoom || reqObj.room,
      requesterName: reqObj.requesterName,
      report: reportText,
      maintenanceOfficerStatus: 'Pending',
      remarks: `บันทึกเพิ่มเติมจากเอกสาร ${reqObj.id}`,
      requesterSignature: signature || reqObj.signature
    };

    updateDb({
      ...db,
      roomUsageRecords: [...db.roomUsageRecords, freshRecord]
    });

    // Find requester email in db.users to notify
    const requesterUser = db.users.find(u => `${u.firstName} ${u.lastName}`.trim().toLowerCase() === reqObj.requesterName.trim().toLowerCase());
    if (requesterUser && requesterUser.email) {
      const emailSubject = `[AMT CONNECT] บันทึกการเข้าใช้งานห้องปฏิบัติการเรียบร้อยแล้ว (${freshRecord.room})`;
      const emailBody = `สวัสดีคุณ ${freshRecord.requesterName},

ข้อมูลบันทึกข้อเสนอแนะสำหรับการปฏิบัติงานของท่านได้รับการบันทึกเข้าระบบแล้ว:
- หมายเลขบันทึก: ${freshRecord.id}
- ห้องปฏิบัติการ: ${freshRecord.room}
- วันที่เข้าใช้งาน: ${freshRecord.date}
- สิ่งที่รายงานเสนอพิจารณาเพิ่ม/ปรับปรุง: ${freshRecord.report}
- สถานะระบบดูแลรักษาซ่อมบำรุง: รอการรับทราบ (Pending)

ข้อมูลนี้จะถูกส่งต่อไปยังเจ้าหน้าที่ผู้ควบคุมเครื่องมือแผนกซ่อมบำรุงเพื่อพิจารณาพัฒนาสภาพแวดล้อมต่อไปค่ะ/ครับ

ด้วยความเคารพ,
ศูนย์บริหารสารสนเทศและการสอบอู่การช่างอากาศยาน AMT CONNECT`;

      sendSystemEmail(requesterUser.email, emailSubject, emailBody).catch((err) => {
        console.warn('Silent room record email notification failure:', err);
      });
    }

    Swal.fire({
      icon: 'success',
      title: 'บันทึกรายงานสำเร็จ',
      text: 'ระบบบันทึกรายงานการใช้ห้อง (สิ่งที่ต้องการพัฒนา) เรียบร้อยแล้ว',
      confirmButtonColor: '#10b981',
      timer: 2000,
      showConfirmButton: false
    });
  };

  const handleAddUsageRecord = (record: Omit<RoomUsageRecord, 'id' | 'maintenanceOfficerStatus'>) => {
    const freshRecord: RoomUsageRecord = {
      id: `REC-${Date.now()}`,
      ...record,
      maintenanceOfficerStatus: 'Pending',
    };

    updateDb({
      ...db,
      roomUsageRecords: [...db.roomUsageRecords, freshRecord]
    });

    // Find requester email in db.users to notify
    const requesterUser = db.users.find(u => `${u.firstName} ${u.lastName}`.trim().toLowerCase() === record.requesterName.trim().toLowerCase());
    if (requesterUser && requesterUser.email) {
      const emailSubject = `[AMT CONNECT] ยืนยันการบันทึกประวัติการใช้งานห้องปฏิบัติการ (${freshRecord.room})`;
      const emailBody = `สวัสดีคุณ ${freshRecord.requesterName},

ข้อมูลบันทึกประวัติการใช้งานห้องปฏิบัติการ (แบบฟอร์ม TLTC-MO-034) ของท่านได้รับการบันทึกเรียบร้อยแล้ว:
- หมายเลขบันทึก: ${freshRecord.id}
- ห้องปฏิบัติการ: ${freshRecord.room}
- วันที่บันทึกข้อมูล: ${freshRecord.date}
- สิ่งที่ต้องการให้พัฒนาหรือซ่อมบำรุงเพิ่มเติม: ${freshRecord.report || '-'}
- สถานะใบรายงาน: รอผู้ควบคุมยอมรับทราบ (Pending)

ขบวนการส่งมอบข้อมูลและรายงานสภาพห้องปฏิบัติการเสร็จสมบูรณ์ ระบบได้ป้อนสิ่งจดบันทึกให้แก่ฝ่ายผู้รับซ่อมบำรุงเข้าตรวจสอบเรียบร้อยแล้ว

ด้วยความเคารพ,
ศูนย์บริหารสารสนเทศและการสอบอู่การช่างอากาศยาน AMT CONNECT`;

      sendSystemEmail(requesterUser.email, emailSubject, emailBody).catch((err) => {
        console.warn('Silent room record email notification failure:', err);
      });
    }

    Swal.fire({
      icon: 'success',
      title: 'บันทึกการใช้ห้องสำเร็จ',
      text: 'บันทึกข้อมูลการเข้าใช้ห้องปฏิบัติการ (TLTC-MO-034) เรียบร้อยแล้ว',
      confirmButtonColor: '#10b981',
    });
  };

  // --- ACTIONS FOR BORROWING ---
  const handleBorrowEquipment = (code: string, qtyNeeded: number, sigImage: string) => {
    if (!currentUser) return;
    const tool = db.equipment.find(eq => eq.code === code);
    if (!tool) return;

    const freshBorrow: BorrowRecord = {
      id: `BRW-${Date.now()}`,
      equipmentCode: code,
      toolName: tool.toolName,
      borrowerId: currentUser.id,
      borrowerName: `${currentUser.firstName} ${currentUser.lastName}`,
      borrowerRole: currentUser.role,
      qty: qtyNeeded,
      borrowDate: new Date().toLocaleDateString('th-TH') + ' ' + new Date().toLocaleTimeString('th-TH'),
      status: 'Borrowed',
      borrowSignature: sigImage,
      toolLocation: tool.location,
    };

    const nextBorrowRecords = [...db.borrowRecords, freshBorrow];

    // Deduct stock Qty
    const nextEquipment = db.equipment.map(eq => 
      eq.code === code 
        ? { 
            ...eq, 
            qty: eq.qty - qtyNeeded,
            status: eq.qty - qtyNeeded === 0 ? ('NotReady' as const) : eq.status
          } 
        : eq
    );

    updateDb({
      ...db,
      borrowRecords: nextBorrowRecords,
      equipment: nextEquipment
    });
  };

  const handleReturnEquipment = (borrowId: string) => {
    const nextBorrowRecords = db.borrowRecords.map(b => {
      if (b.id === borrowId) {
        const studentUser = db.users.find(u => u.id === b.borrowerId);
        return { 
          ...b, 
          status: 'PendingReturn' as const,
          returnSignature: studentUser?.signature || b.borrowSignature || ''
        };
      }
      return b;
    });
    updateDb({
      ...db,
      borrowRecords: nextBorrowRecords
    });
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-between font-sans selection:bg-slate-900 selection:text-white">
      
      {/* 1. Header component */}
      <header className="bg-[#0F172A] text-slate-100 shadow-md no-print border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          
          {/* Logo & title brand */}
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-12 h-12 bg-gradient-to-tr from-slate-900 via-slate-800 to-slate-850 text-slate-100 rounded-xl border border-slate-700/60 shadow-[0_4px_20px_rgba(0,0,0,0.3)] select-none transition-all duration-300 hover:border-sky-500/50 hover:shadow-[0_0_15px_rgba(14,165,233,0.35)] group">
              {/* Glowing ring/circle behind */}
              <div className="absolute inset-0.5 rounded-[10px] border border-dashed border-slate-700/40 group-hover:border-sky-500/30 transition-colors duration-300" />
              
              {/* Inner icons container */}
              <div className="relative flex items-center justify-center w-8 h-8">
                {/* Airplane flying upwards */}
                <Plane size={22} className="text-slate-100 transform -rotate-45 transition-transform duration-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                
                {/* Crossing Wrench in bottom right with solid badge */}
                <div className="absolute -bottom-1 -right-1.5 bg-sky-500 text-white p-1 rounded-lg border border-slate-900 shadow-[0_2px_8px_rgba(14,165,233,0.3)] transform transition-transform duration-500 group-hover:rotate-12 group-hover:scale-110">
                  <Wrench size={10} className="text-white" />
                </div>
              </div>
            </div>
            <div>
              <h1 className="font-sans font-extrabold text-xl sm:text-2xl uppercase tracking-widest flex items-center gap-2">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-slate-350">AMT CONNECT</span>
              </h1>
              <p className="font-sans text-[10px] text-slate-400 font-medium tracking-normal">
                ระบบจัดการห้อง และ คลังเบิกอุปกรณ์ช่างอากาศยานวิทยาลัยเทคนิคถลาง | PART-147
              </p>
            </div>
          </div>

          {/* Sync indicator + session controls info */}
          <div className="flex items-center gap-4 text-xs font-sans">
            
            {/* Real-time Google Sheets Auto-Sync Status Badge */}
            <div 
              className="flex items-center justify-center p-2 rounded-full bg-slate-900/40 border border-slate-800/60"
              title={
                syncStatus.isSyncing 
                  ? 'กำลังบันทึกลง Google Sheets... (Syncing)' 
                  : 'ซิงค์ Google Sheets อัตโนมัติสำเร็จ (Synced)'
              }
            >
              <span className="relative flex h-2.5 w-2.5">
                {syncStatus.isSyncing && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                )}
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                  syncStatus.isSyncing
                    ? 'bg-amber-500'
                    : syncStatus.lastSyncSuccess
                    ? 'bg-emerald-500'
                    : 'bg-slate-500'
                }`}></span>
              </span>
            </div>

            {currentUser && (
              <div className="flex items-center gap-3 border-l border-slate-800 pl-4 relative">
                
                {/* 🔔 Automatic Change Notifications Bell Dropdown */}
                <div className="relative">
                  <button
                    id="headerNotifBellBtn"
                    onClick={() => setIsNotifDropdownOpen(!isNotifDropdownOpen)}
                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-lg transition-colors cursor-pointer relative"
                    title="การแจ้งเตือนและการเปลี่ยนแปลง"
                    type="button"
                  >
                    <Mail size={16} className={notifications.some(n => !n.read) ? "animate-bounce text-amber-400" : ""} />
                    {notifications.filter(n => !n.read).length > 0 && (
                      <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-sans font-bold text-white shadow-xs">
                        {notifications.filter(n => !n.read).length}
                      </span>
                    )}
                  </button>
                  
                  {isNotifDropdownOpen && (
                    <div className="absolute right-0 mt-3 w-80 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-4 z-50 text-left font-sans space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <span className="text-xs font-black text-slate-200">ประวัติแจ้งเตือนและระบบอีเมล</span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setNotifications(prev => {
                                const updated = prev.map(n => ({ ...n, read: true }));
                                try { localStorage.setItem('amt_notifications_v1', JSON.stringify(updated)); } catch {}
                                return updated;
                              });
                            }}
                            className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold cursor-pointer"
                          >
                            อ่านทั้งหมด
                          </button>
                          <span className="text-slate-800 text-[10px]">|</span>
                          <button
                            type="button"
                            onClick={() => {
                              if (notifDropdownTab === 'alerts') {
                                setNotifications([]);
                                try { localStorage.setItem('amt_notifications_v1', '[]'); } catch {}
                              } else {
                                setEmailLogs([]);
                                try { localStorage.setItem('amt_email_logs_v1', '[]'); } catch {}
                              }
                            }}
                            className="text-[10px] text-rose-400 hover:text-rose-300 font-bold cursor-pointer"
                          >
                            ล้าง{notifDropdownTab === 'alerts' ? 'แจ้งเตือน' : 'จดหมาย'}
                          </button>
                        </div>
                      </div>

                      {/* Tab selection */}
                      <div className="flex border-b border-slate-800/80 bg-slate-950/20 rounded-md p-0.5">
                        <button
                          type="button"
                          onClick={() => setNotifDropdownTab('alerts')}
                          className={`flex-1 py-1 text-center text-[10px] font-bold rounded transition-all ${
                            notifDropdownTab === 'alerts'
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'text-slate-400 hover:text-slate-300'
                          }`}
                        >
                          แจ้งในแอป ({notifications.filter(n => !n.read).length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setNotifDropdownTab('emails')}
                          className={`flex-1 py-1 text-center text-[10px] font-bold rounded transition-all ${
                            notifDropdownTab === 'emails'
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'text-slate-400 hover:text-slate-300'
                          }`}
                        >
                          บันทึกจดหมาย ({emailLogs.length})
                        </button>
                      </div>

                      <div className="max-h-64 overflow-y-auto space-y-2 pr-1 select-none">
                        {notifDropdownTab === 'alerts' ? (
                          notifications.length === 0 ? (
                            <div className="text-center py-8 text-xs text-slate-500">
                              ไม่มีรายการแจ้งเตือนใหม่ในระบบ
                            </div>
                          ) : (
                            notifications.map((notif) => (
                              <div 
                                key={notif.id} 
                                className={`p-2.5 rounded-lg border text-xs transition-colors cursor-pointer ${
                                  notif.read 
                                    ? 'bg-slate-950/40 border-slate-850 text-slate-400' 
                                    : 'bg-slate-850/50 border-slate-700 text-slate-200 font-medium'
                                } flex flex-col gap-1`}
                                onClick={() => {
                                  setNotifications(prev => {
                                    const updated = prev.map(n => n.id === notif.id ? { ...n, read: true } : n);
                                    try { localStorage.setItem('amt_notifications_v1', JSON.stringify(updated)); } catch {}
                                    return updated;
                                  });
                                }}
                              >
                                <div className="flex items-center justify-between">
                                  <span className={`text-[10px] font-black tracking-wide ${
                                    notif.type === 'success' ? 'text-emerald-400' :
                                    notif.type === 'warning' ? 'text-amber-400' :
                                    notif.type === 'error' ? 'text-rose-400' :
                                    'text-indigo-400'
                                  }`}>
                                    {notif.title}
                                  </span>
                                  <span className="text-[9px] font-mono text-slate-500 whitespace-nowrap">{notif.timestamp}</span>
                                </div>
                                <p className="text-[11px] leading-relaxed break-normal text-slate-300">{notif.text}</p>
                              </div>
                            ))
                          )
                        ) : (
                          emailLogs.length === 0 ? (
                            <div className="text-center py-8 text-xs text-slate-550 space-y-1">
                              <p className="text-slate-400">ไม่มีข้อมูลการส่งอีเมล</p>
                              <p className="text-[9px] text-indigo-400">จดหมายจะถูกส่งเมื่ออนุมัติ ยื่นสิทธิ์ หรือประกาศวิชา</p>
                            </div>
                          ) : (
                            emailLogs.map((log) => (
                              <div 
                                key={log.id} 
                                className="p-2 border border-slate-800 bg-slate-950/45 rounded-lg text-xs space-y-1 text-left"
                              >
                                <div className="flex items-center justify-between border-b border-slate-850 pb-1 mb-1">
                                  <span className="text-[9px] font-mono text-slate-500">{log.timestamp}</span>
                                  <span className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded ${
                                    log.status === 'success' ? 'bg-emerald-950 text-emerald-400 border border-emerald-900/60' :
                                    log.status === 'sending' ? 'bg-amber-950 text-amber-400 border border-amber-950/60 animate-pulse' :
                                    'bg-rose-950 text-rose-400 border border-rose-950'
                                  }`}>
                                    {log.status === 'success' ? 'สำเร็จ' : log.status === 'sending' ? 'กำลังส่ง' : 'ล้มเหลว'}
                                  </span>
                                </div>
                                <div className="text-[10px] text-slate-305">
                                  <span className="font-extrabold text-slate-500">ผู้รับ:</span> <span className="font-mono text-indigo-300 select-all">{log.recipient}</span>
                                </div>
                                <div className="text-[10px] text-slate-400 truncate" title={log.subject}>
                                  <span className="font-extrabold text-slate-500">เรื่อง:</span> {log.subject}
                                </div>
                                {log.errorMessage && (
                                  <div className="bg-rose-950/10 text-rose-400 text-[9px] p-1.5 rounded border border-rose-900/30 space-y-1 mt-1 font-mono leading-tight">
                                    <div className="font-bold text-rose-300">⚠️ รายละเอียดเหตุเสีย:</div>
                                    <div className="break-all">{log.errorMessage}</div>
                                  </div>
                                )}
                                <div className="flex justify-between items-center mt-1 border-t border-slate-850 pt-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      Swal2.fire({
                                        title: 'เนื้อหาจดหมายแจ้งเตือน',
                                        html: `<div class="text-left font-sans text-xs bg-slate-950 text-slate-300 p-3 rounded-lg border border-slate-850 max-h-60 overflow-y-auto whitespace-pre-wrap leading-relaxed">${log.body}</div>`,
                                        confirmButtonText: 'รับทราบ',
                                        confirmButtonColor: '#0F172A'
                                      });
                                    }}
                                    className="text-[9px] text-slate-400 hover:text-slate-250 hover:underline cursor-pointer font-bold"
                                  >
                                    ดูเนื้อหา
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      Swal2.fire({
                                        title: 'กำลังส่งเมลทดสอบ...',
                                        text: 'ระบบกำลังคัดส่งจดหมายต้นฉบับใหม่อีกครั้งไปยังปลายทาง',
                                        allowOutsideClick: false,
                                        didOpen: () => { Swal2.showLoading(); }
                                      });
                                      sendSystemEmail(log.recipient, log.subject, log.body).then((res) => {
                                        if (res.success) {
                                          Swal2.fire('สำเร็จ', 'ดำเนินการส่งทดสอบใหม่เสร็จสิ้น ปลายทางได้รับการอัปเดตเข้ารายงานประวัติปัจจุบัน', 'success');
                                        } else {
                                          Swal2.fire('ล้มเหลว', `ผลลัพธ์สะท้อนกลับล้มเหลว: ${res.message} (โปรดขอให้แอดมินอัปเดตสคริปต์ในคู่มือ Settings)`, 'error');
                                        }
                                      }).catch(err => {
                                        Swal2.fire('ข้อผิดพลาด', `การเชื่อมสคริปต์ขัดข้อง: ${err.message || err}`, 'error');
                                      });
                                    }}
                                    className="text-[9px] text-indigo-400 hover:text-indigo-300 hover:underline cursor-pointer font-bold"
                                  >
                                    ทดสอบส่งใหม่
                                  </button>
                                </div>
                              </div>
                            ))
                          )
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <img src={currentUser.photoUrl} alt="avatar" className="w-8 h-8 rounded-full border border-slate-700 object-cover" referrerPolicy="no-referrer" />
                <div className="text-left font-sans">
                  <span className="block font-bold truncate text-slate-200">{currentUser.firstName} {currentUser.lastName}</span>
                  <span className="block text-[10px] text-slate-400 uppercase font-mono tracking-wider font-semibold">{currentUser.role}</span>
                </div>
                <button
                  id="headerLogoutBtn"
                  onClick={handleLogout}
                  className="p-1.5 bg-rose-950/40 border border-rose-800 hover:bg-rose-900 text-rose-300 hover:text-white rounded-lg transition-colors cursor-pointer"
                  title="ออกจากระบบการช่าง"
                >
                  <LogOut size={13} />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 2. Main Page content viewport switch */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 no-print">
        
        {/* VIEW 1: HOME PAGE (WELCOME TO AMT - AUTH FORM) */}
        {currentScreen === 'home' && (
          <div className="max-w-md mx-auto py-12">
            
            {isInitialLoading ? (
              <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-xs text-center flex flex-col items-center justify-center space-y-6 animate-fade-in select-none">
                <div className="relative flex items-center justify-center">
                  <div className="w-16 h-16 rounded-full border-4 border-slate-100 border-t-emerald-600 animate-spin"></div>
                  <div className="absolute p-3 bg-emerald-50 text-emerald-600 rounded-full">
                    <RefreshCw size={24} className="animate-spin text-emerald-500" style={{ animationDuration: '4s' }} />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h4 className="font-sans font-extrabold text-slate-900 text-base tracking-wide">AMT Connect</h4>
                  <p className="text-[11.5px] text-slate-500 leading-relaxed font-sans max-w-sm">
                    กำลังอัพเดตข้อมูล
                  </p>
                </div>
              </div>
            ) : (
              /* Login Frame column */
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
              <h3 className="font-sans font-extrabold text-slate-900 text-lg mb-1 flex items-center gap-2">
                <LogIn size={20} className="text-slate-800" />
                <span>ลงชื่อเข้าใช้ระบบ AMT Connect</span>
              </h3>
              <p className="text-[10px] text-slate-400 mb-4 uppercase font-mono tracking-wider">Aviation Secure login gateway</p>

              {/* Login Method tabs */}
              <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 gap-1 mb-4 select-none">
                <button
                  type="button"
                  onClick={() => {
                    setLoginMethod('password');
                    setIsLoginCameraActive(false);
                  }}
                  className={`flex-1 text-[11px] font-bold py-1.5 rounded-md transition-all cursor-pointer text-center ${
                    loginMethod === 'password' ? 'bg-[#0F172A] text-white shadow-xs' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  ใช้รหัสผ่าน (Password)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLoginMethod('qr');
                    setIsLoginCameraActive(true);
                  }}
                  className={`flex-1 text-[11px] font-bold py-1.5 rounded-md transition-all cursor-pointer text-center flex items-center justify-center gap-1 ${
                    loginMethod === 'qr' ? 'bg-[#0F172A] text-white shadow-xs' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <QrCode size={12} />
                  <span>สแกน QR Code</span>
                </button>
              </div>

              {loginMethod === 'password' ? (
                <form onSubmit={handleLoginSubmit} className="space-y-4 text-xs animate-fade-in">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      รหัสนักศึกษา หรือ รหัสบุคลากร (User ID) *
                    </label>
                    <input
                      id="loginIdInput"
                      type="text"
                      required
                      placeholder="เช่น 67010214 หรือ STAFF101"
                      value={loginId}
                      onChange={(e) => setLoginId(e.target.value)}
                      className="w-full border border-slate-250 px-3 py-2 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 font-mono text-sm uppercase transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      รหัสผ่านเข้าเล่นระบบ (Password) *
                    </label>
                    <input
                      id="loginPasswordInput"
                      type="password"
                      required
                      placeholder="ป้อนรหัสเข้าใช้ของคุณ"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="w-full border border-slate-250 px-3 py-2 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 font-mono text-sm transition-all"
                    />
                  </div>

                  <button
                    id="loginSubmitBtn"
                    type="submit"
                    className="w-full bg-[#0F172A] hover:bg-slate-850 text-white font-extrabold py-2.5 rounded-lg shadow-sm text-xs transition-colors tracking-wide cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <LogIn size={13} />
                    <span>เข้าสู่ระบบความปลอดภัย</span>
                  </button>
                </form>
              ) : (
                <div className="space-y-4 animate-fade-in text-xs">
                  {scannedUser ? (
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-center space-y-4 animate-fade-in">
                      <div className="text-slate-600 font-bold text-xs uppercase tracking-wider mb-1 flex items-center justify-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span>ตรวจพบข้อมูลสิทธิ์เข้าใช้งาน</span>
                      </div>
                      
                      <div className="flex flex-col items-center space-y-2">
                        {scannedUser.photoUrl ? (
                          <img
                            src={scannedUser.photoUrl}
                            alt={`${scannedUser.firstName} Profile`}
                            className="w-20 h-20 rounded-full border-2 border-slate-800 object-cover shadow-xs"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-20 h-20 rounded-full bg-slate-200 border-2 border-slate-300 flex items-center justify-center text-slate-500 font-extrabold text-2xl select-none">
                            {scannedUser.firstName.charAt(0)}
                          </div>
                        )}
                        <div>
                          <h4 className="font-sans font-extrabold text-slate-950 text-sm">
                            {scannedUser.firstName} {scannedUser.lastName}
                          </h4>
                          <p className="text-[10px] text-slate-450 font-mono mt-0.5">
                            ID: {scannedUser.id}
                          </p>
                        </div>
                        
                        <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[10px] bg-slate-900 text-slate-100 font-bold border border-slate-705">
                          {scannedUser.role}
                        </div>
                      </div>

                      <div className="pt-2.5 border-t border-slate-200 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setScannedUser(null);
                            setIsLoginCameraActive(true);
                          }}
                          className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-[11px] rounded-lg cursor-pointer transition-colors"
                        >
                          สแกนใหม่ (Cancel)
                        </button>
                        
                        <button
                          type="button"
                          onClick={() => {
                            const confirmedUser = scannedUser;
                            setScannedUser(null);
                            setCurrentUser(confirmedUser);
                            setCurrentScreen('dashboard');
                            setIsLoginCameraActive(false);
                            Swal.fire({
                              icon: 'success',
                              title: 'เข้าสู่ระบบสำเร็จ',
                              text: `ยินดีต้อนรับคุณ ${confirmedUser.firstName} (${confirmedUser.role})`,
                              timer: 1500,
                              showConfirmButton: false
                            });
                          }}
                          className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[11px] rounded-lg cursor-pointer shadow-sm transition-colors"
                        >
                          ยืนยันเข้าสู่ระบบ
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="border border-slate-200 bg-slate-950 rounded-lg p-3 text-center text-white relative">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[9px] font-mono tracking-widest text-emerald-400 flex items-center gap-1">
                            <span className={`w-1.5 h-1.5 rounded-full ${isLoginCameraActive ? 'bg-emerald-500 animate-ping' : 'bg-rose-500'}`} />
                            QR SCANNER PORT
                          </span>
                          <div className="flex items-center gap-1.5">
                            {isLoginCameraActive && (
                              <button
                                type="button"
                                onClick={() => setLoginCameraFacingMode(prev => prev === 'environment' ? 'user' : 'environment')}
                                className="bg-emerald-500/20 hover:bg-emerald-500/35 border border-emerald-400/30 text-emerald-300 text-[8.5px] px-2.5 py-0.5 rounded cursor-pointer font-bold flex items-center gap-1 active:scale-95 transition-all"
                              >
                                <RefreshCw size={10} />
                                <span>สลับกล้อง ({loginCameraFacingMode === 'environment' ? 'หลัง' : 'หน้า'})</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setIsLoginCameraActive(!isLoginCameraActive)}
                              className="bg-white/10 hover:bg-white/20 text-white text-[8.5px] px-2 py-0.5 rounded cursor-pointer"
                            >
                              {isLoginCameraActive ? 'พักกล้อง' : 'เปิดทำงาน'}
                            </button>
                          </div>
                        </div>

                        {isLoginCameraActive ? (
                          <div>
                            {loginCameraError ? (
                              <div className="text-rose-400 text-[10px] p-2 bg-rose-950/40 rounded border border-rose-900/40 select-none">
                                ⚠️ {loginCameraError}
                              </div>
                            ) : (
                              <div className="relative w-full h-64 bg-neutral-900 rounded-lg overflow-hidden border border-neutral-800 flex items-center justify-center">
                                <div
                                  id="login-qr-reader"
                                  className="absolute inset-0 w-full h-full object-cover"
                                />
                                {/* Scanning square targeting HUD with guiding prompt */}
                                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10 p-2">
                                  <div className="w-40 h-40 border border-white/10 rounded-lg relative flex items-center justify-center bg-emerald-500/5">
                                    {/* Pulsing Emerald Corners */}
                                    <span className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-emerald-400 rounded-tl-sm animate-pulse" />
                                    <span className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-emerald-400 rounded-tr-sm animate-pulse" />
                                    <span className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-emerald-400 rounded-bl-sm animate-pulse" />
                                    <span className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-emerald-400 rounded-br-sm animate-pulse" />
                                    
                                    {/* Sweeping laser line */}
                                    <div className="w-full h-0.5 bg-emerald-400 animate-bounce shadow-[0_0_8px_#10b981]" style={{ animationDuration: '2.5s' }} />
                                    
                                    {/* Helper instruction directly targeting user intent */}
                                    <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[9px] font-sans font-bold text-emerald-400 tracking-wider text-center uppercase bg-slate-950/95 px-2.5 py-1 rounded border border-emerald-500/30 whitespace-nowrap shadow-md select-none">
                                      เล็งคิวอาร์โค้ด (QR CODE) ในกรอบนี้
                                    </span>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="h-64 bg-slate-900 rounded flex flex-col items-center justify-center text-slate-500 border border-slate-800">
                            <Camera size={26} className="opacity-45 mb-1.5" />
                            <span className="text-[10px] font-bold">กล้องปิดการทำงานชั่วคราว</span>
                            <span className="text-[8.5px] font-mono opacity-55 uppercase mt-0.5">CAMERA INTERFACE STANDBY</span>
                          </div>
                        )}
                      </div>


                    </>
                  )}
                </div>
              )}


              <div className="mt-4 border-t border-slate-100 pt-3 text-center">
                <span className="text-[11px] text-slate-500 font-sans">ยังไม่ได้เชื่อมต่อหรือลงทะเบียนบัญชี?</span>
                <button
                  id="goRegisterBtn"
                  onClick={async () => {
                    await pullLatestData(false);
                    setCurrentScreen('register');
                  }}
                  className="ml-1.5 font-bold text-slate-950 hover:underline cursor-pointer"
                >
                  ลงทะเบียนผู้ใช้ใหม่ที่นี่
                </button>
              </div>
            </div>
            )}

          </div>
        )}

        {/* VIEW 2: REGISTER PROFILE PAGE */}
        {currentScreen === 'register' && (
          <div className="py-6 sm:py-12">
            <RegistrationForms 
              onRegisterSuccess={handleRegisterSuccess} 
              onCancel={() => setCurrentScreen('home')} 
              existingUsers={db.users}
            />
          </div>
        )}

        {/* VIEW 3: SYSTEM DASHBOARD (ACCORDING TO DIFFERENT LOGGED ROLES) */}
        {currentScreen === 'dashboard' && currentUser && (
          <div className="space-y-6">
            
            {/* Display profile welcome overlay and screen navigation alerts */}
            <div className="bg-white border border-slate-200 p-5 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-xs">
              <div>
                <span className="bg-slate-100 text-slate-700 uppercase tracking-widest font-mono text-[9px] font-extrabold px-2.5 py-1 rounded-full border border-slate-200 shadow-3xs">
                  {currentUser.role} AREA BOARD
                </span>
                <h3 className="font-sans font-extrabold text-slate-900 text-base sm:text-lg mt-1.5">
                  {getTimeBasedGreeting()}, {currentUser.firstName} {currentUser.lastName}
                </h3>
              </div>
            </div>

            {/* ROUTE INDIVIDUAL DASHBOARD ROOT DEPENDING ON USER POSITION ROLE */}
            {currentUser.role === 'Admin' ? (
              <AdminPanel
                currentUser={currentUser}
                users={db.users}
                roomRequests={db.roomRequests}
                roomUsageRecords={db.roomUsageRecords}
                borrowRecords={db.borrowRecords}
                onApproveUser={handleApproveUser}
                onRejectUser={handleRejectUser}
                onUpdateUserStatus={handleUpdateStudentStatus}
                onToggleRecordStatus={handleToggleRecordStatus}
                onViewStudentCard={(user) => setActiveCardUser(user)}
                onViewRequestDoc={(req) => setActiveRequestDoc(req)}
                onPrintUsageRecords={() => setShowUsageRecordDoc(true)}
                onReloadDb={() => setDb(APIService.getDb())}
              />
            ) : currentUser.role === 'Training Manager' || currentUser.role === 'Training Staff' ? (
              <TrainingManagerPanel
                currentUser={currentUser}
                users={db.users}
                roomRequests={db.roomRequests}
                classSchedules={db.schedules}
                roomUsageRecords={db.roomUsageRecords}
                borrowRecords={db.borrowRecords}
                onUpdateProfile={handleUpdateProfile}
                onSubmitRoomRequest={handleSubmitRoomRequest}
                onUpdateStudentStatusByStaff={handleUpdateStudentStatusByStaff}
                onApproveStudentStatusByManager={handleApproveStudentStatusByManager}
                onViewRequestDoc={(req) => setActiveRequestDoc(req)}
                onPrintUsageRecords={() => setShowUsageRecordDoc(true)}
                onApproveUser={handleApproveUser}
                onRejectUser={handleRejectUser}
                onAddUsageRecord={handleAddUsageRecord}
                onCancelRoomRequest={handleCancelRoomRequest}
              />
            ) : currentUser.role === 'Maintenance Manager' || currentUser.role === 'Maintenance Staff' ? (
              <MaintenancePanel
                currentUser={currentUser}
                roomRequests={db.roomRequests}
                roomUsageRecords={db.roomUsageRecords}
                equipments={db.equipment}
                borrowRecords={db.borrowRecords}
                onCertifyRoomRequest={handleCertifyRoomRequest}
                onAcknowledgeUsageRecord={handleToggleRecordStatus}
                onAddEquipment={handleAddEquipment}
                onCheckReturnEquipment={handleCheckReturnEquipment}
                onUpdateCalibration={handleUpdateCalibration}
                onUpdateEquipment={handleUpdateEquipment}
                onUpdateProfile={handleUpdateProfile}
                onPrintUsageRecords={() => setShowUsageRecordDoc(true)}
                onViewRequestDoc={(req) => setActiveRequestDoc(req)}
              />
            ) : (
              /* Office Manager, Exam Staff, Students and general Instructors Panel */
              <ExamOfficeStudentPanel
                currentUser={currentUser}
                users={db.users}
                roomRequests={db.roomRequests}
                classSchedules={db.schedules}
                examSchedules={db.examSchedules}
                examGrades={db.examGrades}
                equipments={db.equipment}
                borrowRecords={db.borrowRecords}
                onAddSchedule={handleAddSchedule}
                onAddExam={handleAddExam}
                onAddGrade={handleAddGrade}
                onBorrowEquipment={handleBorrowEquipment}
                onReturnEquipment={handleReturnEquipment}
                onSubmitRoomRequest={handleSubmitRoomRequest}
                onViewRequestDoc={(req) => setActiveRequestDoc(req)}
                onUpdateProfile={handleUpdateProfile}
                onAddUsageRecord={handleAddUsageRecord}
                onCancelRoomRequest={handleCancelRoomRequest}
              />
            )}

          </div>
        )}

      </main>

      {/* 3. Footer markup */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center select-none no-print">
        <p className="font-sans text-[11px] text-slate-500 font-bold uppercase tracking-wider">
          ระบบ AMT Connect I ผู้พัฒนา นายซัยฟูลลอฮ อาแวบือราเฮง และนาย เลิศภพ เสตะพะ
        </p>
        <p className="font-mono text-[9px] text-slate-400 mt-1.5 uppercase font-semibold">
          © {new Date().getFullYear()} AMT THALANG COMPLIANT PART-147 AVIATION SCHOOL INFRASTRUCTURE
        </p>
      </footer>

      {/* --- PRINT FLOATING PORTABLES OVERLAYS FRAME SECTION --- */}
      {activeCardUser && (
        <StudentIdCard 
          user={activeCardUser} 
          onClose={() => setActiveCardUser(null)} 
        />
      )}

      {activeRequestDoc && (
        <RoomRequestDoc 
          request={activeRequestDoc} 
          onClose={() => setActiveRequestDoc(null)} 
          onRecordUsage={handleRecordUsageFromDoc}
          currentUser={currentUser || undefined}
        />
      )}

      {showUsageRecordDoc && (
        <RoomUsageRecordDoc 
          records={db.roomUsageRecords} 
          roomRequests={db.roomRequests}
          onClose={() => setShowUsageRecordDoc(false)} 
        />
      )}

    </div>
  );
}
