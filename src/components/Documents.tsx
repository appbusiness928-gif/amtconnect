/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Printer, X, Award, ShieldAlert, CheckCircle, FileText, Cloud, FileDown, ExternalLink } from 'lucide-react';
import { User, RoomRequest, RoomUsageRecord, BorrowRecord } from '../types';
import { getAppOriginForQR, APIService, syncWithGoogleSheets, uploadToGoogleDrive } from '../lib/api';
import { alerts as Swal } from '../lib/alerts';
// @ts-ignore
import html2pdf from 'html2pdf.js';
import { THALANG_LOGO_BASE64 } from './ThalangLogoBase64';

function oklchToRgb(oklchStr: string): string {
  try {
    const cleaned = oklchStr.trim().toLowerCase();
    const match = cleaned.match(/oklch\s*\(([^)]+)\)/);
    if (!match) return oklchStr;

    const partsStr = match[1];
    const parts = partsStr.replace(/[\/,]/g, ' ').trim().split(/\s+/);
    if (parts.length < 3) return oklchStr;

    let lVal = parts[0];
    let cVal = parts[1];
    let hVal = parts[2];
    let aVal = parts[3] !== undefined ? parts[3] : "1";

    let L = lVal.endsWith('%') ? parseFloat(lVal) / 100 : parseFloat(lVal);
    let C = cVal.endsWith('%') ? parseFloat(cVal) / 100 : parseFloat(cVal);
    
    let H = 0;
    if (hVal.endsWith('deg')) {
      H = parseFloat(hVal);
    } else if (hVal.endsWith('rad')) {
      H = parseFloat(hVal) * (180 / Math.PI);
    } else if (hVal.endsWith('%')) {
      H = (parseFloat(hVal) / 100) * 360;
    } else {
      H = parseFloat(hVal);
    }

    let alpha = aVal.endsWith('%') ? parseFloat(aVal) / 100 : parseFloat(aVal);

    if (isNaN(L) || isNaN(C) || isNaN(H)) {
      return oklchStr;
    }

    const hRad = H * (Math.PI / 180);
    const a = C * Math.cos(hRad);
    const b = C * Math.sin(hRad);

    const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
    const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
    const s_ = L - 0.0894841775 * a - 1.2914855414 * b;

    const l_linear = Math.pow(Math.max(0, l_), 3);
    const m_linear = Math.pow(Math.max(0, m_), 3);
    const s_linear = Math.pow(Math.max(0, s_), 3);

    let r = +4.0767416621 * l_linear - 3.3077115913 * m_linear + 0.2309699292 * s_linear;
    let g = -1.2684380046 * l_linear + 2.6097574011 * m_linear - 0.3413193965 * s_linear;
    let b_ = -0.0041960863 * l_linear - 0.7034186147 * m_linear + 1.7076114910 * s_linear;

    r = Math.max(0, Math.min(1, r));
    g = Math.max(0, Math.min(1, g));
    b_ = Math.max(0, Math.min(1, b_));

    const rGamma = r <= 0.0031308 ? 12.92 * r : 1.055 * Math.pow(r, 1 / 2.4) - 0.055;
    const gGamma = g <= 0.0031308 ? 12.92 * g : 1.055 * Math.pow(g, 1 / 2.4) - 0.055;
    const bGamma = b_ <= 0.0031308 ? 12.92 * b_ : 1.055 * Math.pow(b_, 1 / 2.4) - 0.055;

    const r255 = Math.max(0, Math.min(255, Math.round(rGamma * 255)));
    const g255 = Math.max(0, Math.min(255, Math.round(gGamma * 255)));
    const b255 = Math.max(0, Math.min(255, Math.round(bGamma * 255)));

    if (isNaN(alpha) || alpha === 1) {
      return `rgb(${r255}, ${g255}, ${b255})`;
    } else {
      return `rgba(${r255}, ${g255}, ${b255}, ${alpha})`;
    }
  } catch (err) {
    console.error('Error converting OKLCH to RGB:', err);
    return oklchStr;
  }
}

function oklabToRgb(oklabStr: string): string {
  try {
    const cleaned = oklabStr.trim().toLowerCase();
    const match = cleaned.match(/oklab\s*\(([^)]+)\)/);
    if (!match) return oklabStr;

    const partsStr = match[1];
    const parts = partsStr.replace(/[\/,]/g, ' ').trim().split(/\s+/);
    if (parts.length < 3) return oklabStr;

    let lVal = parts[0];
    let aValInput = parts[1];
    let bValInput = parts[2];
    let alphaVal = parts[3] !== undefined ? parts[3] : "1";

    let L = lVal.endsWith('%') ? parseFloat(lVal) / 100 : parseFloat(lVal);
    let a = aValInput.endsWith('%') ? parseFloat(aValInput) / 100 : parseFloat(aValInput);
    let b = bValInput.endsWith('%') ? parseFloat(bValInput) / 100 : parseFloat(bValInput);
    let alpha = alphaVal.endsWith('%') ? parseFloat(alphaVal) / 100 : parseFloat(alphaVal);

    if (isNaN(L) || isNaN(a) || isNaN(b)) {
      return oklabStr;
    }

    const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
    const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
    const s_ = L - 0.0894841775 * a - 1.2914855414 * b;

    const l_linear = Math.pow(Math.max(0, l_), 3);
    const m_linear = Math.pow(Math.max(0, m_), 3);
    const s_linear = Math.pow(Math.max(0, s_), 3);

    let r = +4.0767416621 * l_linear - 3.3077115913 * m_linear + 0.2309699292 * s_linear;
    let g = -1.2684380046 * l_linear + 2.6097574011 * m_linear - 0.3413193965 * s_linear;
    let b_ = -0.0041960863 * l_linear - 0.7034186147 * m_linear + 1.7076114910 * s_linear;

    r = Math.max(0, Math.min(1, r));
    g = Math.max(0, Math.min(1, g));
    b_ = Math.max(0, Math.min(1, b_));

    const rGamma = r <= 0.0031308 ? 12.92 * r : 1.055 * Math.pow(r, 1 / 2.4) - 0.055;
    const gGamma = g <= 0.0031308 ? 12.92 * g : 1.055 * Math.pow(g, 1 / 2.4) - 0.055;
    const bGamma = b_ <= 0.0031308 ? 12.92 * b_ : 1.055 * Math.pow(b_, 1 / 2.4) - 0.055;

    const r255 = Math.max(0, Math.min(255, Math.round(rGamma * 255)));
    const g255 = Math.max(0, Math.min(255, Math.round(gGamma * 255)));
    const b255 = Math.max(0, Math.min(255, Math.round(bGamma * 255)));

    if (isNaN(alpha) || alpha === 1) {
      return `rgb(${r255}, ${g255}, ${b255})`;
    } else {
      return `rgba(${r255}, ${g255}, ${b255}, ${alpha})`;
    }
  } catch (err) {
    console.error('Error converting OKLAB to RGB:', err);
    return oklabStr;
  }
}

function convertStyles(val: string): string {
  if (typeof val !== 'string') return val;
  let text = val;
  if (text.includes('oklch')) {
    try {
      text = text.replace(/oklch\s*\([^)]+\)/gi, (match: string) => oklchToRgb(match));
    } catch (e) {
      // ignore
    }
  }
  if (text.includes('oklab')) {
    try {
      text = text.replace(/oklab\s*\([^)]+\)/gi, (match: string) => oklabToRgb(match));
    } catch (e) {
      // ignore
    }
  }
  return text;
}

// Recursively proxy CSS rules and nested rules to replace OKLCH
function proxyRule(rule: any): any {
  if (!rule) return rule;
  return new Proxy(rule, {
    get(target, prop) {
      if (prop === 'cssText') {
        const text = target.cssText;
        return typeof text === 'string' ? convertStyles(text) : text;
      }
      if (prop === 'cssRules' || prop === 'rules') {
        const rules = target.cssRules;
        if (!rules) return rules;
        return new Proxy(rules, {
          get(targetRules, indexProp) {
            if (indexProp === 'length') {
              return targetRules.length;
            }
            if (indexProp === 'item') {
              return function(index: number) {
                const r = targetRules.item(index);
                return r ? proxyRule(r) : r;
              };
            }
            const idx = Number(indexProp);
            if (!isNaN(idx)) {
              const r = targetRules[idx];
              return r ? proxyRule(r) : r;
            }
            const val = (targetRules as any)[indexProp];
            if (typeof val === 'function') {
              return val.bind(targetRules);
            }
            return val;
          }
        });
      }
      if (prop === 'style') {
        const style = target.style;
        if (!style) return style;
        return new Proxy(style, {
          get(targetStyle, styleProp) {
            if (styleProp === 'cssText') {
              const text = targetStyle.cssText;
              return typeof text === 'string' ? convertStyles(text) : text;
            }
            const val = (targetStyle as any)[styleProp];
            if (typeof val === 'string') {
              return convertStyles(val);
            }
            if (typeof val === 'function') {
              return val.bind(targetStyle);
            }
            return val;
          }
        });
      }
      const val = (target as any)[prop];
      if (typeof val === 'function') {
        return val.bind(target);
      }
      return val;
    }
  });
}


export const ensureInteractionRestored = () => {
  try {
    if (document.body) {
      document.body.classList.remove('swal2-shown', 'swal2-height-auto');
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
    }
    if (document.documentElement) {
      document.documentElement.classList.remove('swal2-shown', 'swal2-height-auto');
    }
    
    const swalContainers = document.querySelectorAll('.swal2-container');
    swalContainers.forEach(container => {
      const popup = container.querySelector('.swal2-popup');
      if (!popup || !popup.classList.contains('swal2-show')) {
        container.remove();
      }
    });

    const h2cContainers = document.querySelectorAll('.html2canvas-container');
    h2cContainers.forEach(container => container.remove());
  } catch (err) {
    console.warn('Error during interaction restoration:', err);
  }
};

export const generateAndOpenPDF = async (selector: string, filename: string, orientation: 'portrait' | 'landscape' = 'portrait') => {
  const element = document.querySelector(selector);
  if (!element) {
    Swal.fire({
      title: 'ข้อผิดพลาด',
      text: 'ไม่พบส่วนเนื้อหาเอกสารที่ต้องการสร้าง PDF',
      icon: 'error',
      didClose: () => {
        ensureInteractionRestored();
      }
    });
    return;
  }

  Swal.fire({
    title: 'กำลังจัดเตรียมไฟล์ PDF...',
    html: `
      <div class="flex flex-col items-center justify-center p-3 font-sans">
        <div class="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-3"></div>
        <p class="text-sm text-neutral-700 font-bold mb-1">กำลังประมวลผลเอกสารสถาบัน</p>
        <p class="text-xs text-neutral-500 text-center">ระบบกำลังเรนเดอร์กราฟิกและแปลงเป็นอินทิเกรตลิงก์ PDF กรุณารอสักครู่...</p>
      </div>
    `,
    showConfirmButton: false,
    allowOutsideClick: false,
  });

  // Temporarily intercept window.getComputedStyle and document.styleSheets
  const originalGetComputedStyle = window.getComputedStyle;
  const originalStyleSheets = document.styleSheets;
  let isStyleSheetsOverridden = false;

  // Intercept window.getComputedStyle to translate modern Tailwind oklch and oklab colors on the fly
  window.getComputedStyle = function(elt, pseudoElt) {
    const style = originalGetComputedStyle(elt, pseudoElt);
    return new Proxy(style, {
      get(target, prop) {
        if (prop === 'getPropertyValue') {
          return function(propertyName: string) {
            const val = target.getPropertyValue(propertyName);
            return typeof val === 'string' ? convertStyles(val) : val;
          };
        }
        const val = (target as any)[prop];
        if (typeof val === 'string') {
          return convertStyles(val);
        }
        if (typeof val === 'function') {
          return val.bind(target);
        }
        return val;
      }
    });
  };

  try {
    const proxiedStyleSheets = Array.from(originalStyleSheets).map(sheet => {
      try {
        if (!sheet.cssRules) {
          return sheet;
        }
        return new Proxy(sheet, {
          get(target, prop) {
            if (prop === 'cssRules' || prop === 'rules') {
              try {
                const rulesArray = Array.from(target.cssRules).map(rule => proxyRule(rule));
                const mockList = [...rulesArray] as any;
                mockList.item = function(index: number) {
                  return this[index];
                };
                return mockList;
              } catch (innerRulesErr) {
                return target.cssRules;
              }
            }
            const val = (target as any)[prop];
            if (typeof val === 'function') {
              return val.bind(target);
            }
            return val;
          }
        });
      } catch (e) {
        return sheet;
      }
    });

    const mockStyleSheetsList = [...proxiedStyleSheets] as any;
    mockStyleSheetsList.item = function(index: number) {
      return this[index];
    };

    Object.defineProperty(document, 'styleSheets', {
      get() {
        return mockStyleSheetsList;
      },
      configurable: true
    });
    isStyleSheetsOverridden = true;
  } catch (overrideErr) {
    console.warn('Failed to mock styleSheets for oklch filter:', overrideErr);
  }

  try {
    const isA4FullPortrait = element.classList.contains('full-a4-portrait') || element.innerHTML.includes('TLTC-MO-033') || filename.includes('ขออนุญาตใช้ห้อง');
    const opt = {
      margin:       isA4FullPortrait ? 0 : (orientation === 'portrait' ? [12, 10, 12, 10] : [10, 10, 10, 10]),
      filename:     filename,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { 
        scale: 2, 
        useCORS: true,
        backgroundColor: '#FFFFFF',
        logging: false
      },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: orientation }
    };

    // @ts-ignore
    const worker = html2pdf().set(opt).from(element);
    
    // Generate direct blob url for live view/link
    const blobUrl = await worker.output('bloburl');
    
    // Trigger local download
    await worker.save();

    Swal.fire({
      title: 'จัดเตรียมเอกสารและดาวน์โหลดสำเร็จ!',
      html: `
        <div class="text-center font-sans space-y-3.5 pt-2">
          <p class="text-sm text-neutral-600">ได้ทำการจัดทำรูปเล่ม PDF และทำการดาวน์โหลดเข้าสู่เครื่องของท่านเรียบร้อยแล้ว</p>
          
          <div class="p-3 bg-emerald-50 text-emerald-800 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 border border-emerald-100">
            <span class="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            สถานะ: ดาวน์โหลดเอกสาร PDF สำเร็จ!
          </div>
          
          <p class="text-[11px] text-neutral-400">กรณีที่ดาวน์โหลดไม่เริ่มทำงานโดยอัตโนมัติ หรือท่านต้องการเปิดดูผ่านเว็บเบราว์เซอร์ กรุณาคลิกปุ่มด้านล่างเพื่อแสดงเอกสาร</p>
          
          <a href="${blobUrl}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-sm transition-all text-xs cursor-pointer">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            เปิดแสดงไฟล์เอกสาร PDF (A4)
          </a>
        </div>
      `,
      icon: 'success',
      confirmButtonText: 'ปิดหน้าต่าง',
      customClass: {
        confirmButton: 'bg-neutral-900 text-white px-5 py-2 rounded-md font-sans text-xs font-bold'
      },
      didClose: () => {
        ensureInteractionRestored();
      }
    });
    
    // Auto-open in tab
    try {
      window.open(blobUrl, '_blank');
    } catch (e) {
      console.warn('Auto popup blocked:', e);
    }
  } catch (error: any) {
    console.error('PDF generation error:', error);
    Swal.fire({
      title: 'เกิดข้อผิดพลาด',
      text: 'ไม่สามารถสร้างไฟล์ PDF มินิลิงก์ได้: ' + error.message,
      icon: 'error',
      didClose: () => {
        ensureInteractionRestored();
      }
    });
  } finally {
    // Restore window.getComputedStyle
    window.getComputedStyle = originalGetComputedStyle;

    // Restore original document.styleSheets safely
    if (isStyleSheetsOverridden) {
      try {
        Object.defineProperty(document, 'styleSheets', {
          value: originalStyleSheets,
          writable: true,
          configurable: true
        });
      } catch (restoreErr) {
        try {
          Object.defineProperty(document, 'styleSheets', {
            get() {
              return originalStyleSheets;
            },
            configurable: true
          });
        } catch (innerErr) {
          console.error('Failed to restore styleSheets:', innerErr);
        }
      }
    }

    setTimeout(ensureInteractionRestored, 150);
  }
};

export function ThalangLogo({ className = "w-16 h-16" }: { className?: string }) {
  return (
    <img
      src={THALANG_LOGO_BASE64}
      alt="วิทยาลัยเทคนิคถลาง"
      className={className}
      referrerPolicy="no-referrer"
    />
  );
}

interface StudentIdCardProps {
  user: User;
  onClose: () => void;
}

export function StudentIdCard({ user, onClose }: StudentIdCardProps) {
  const [isWorking, setIsWorking] = React.useState(false);

  const handlePrint = async () => {
    if (isWorking) return;
    setIsWorking(true);
    try {
      await syncWithGoogleSheets(APIService.getDb()).catch(() => {});
      window.print();
    } finally {
      setIsWorking(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (isWorking) return;
    setIsWorking(true);
    try {
      await generateAndOpenPDF('.print-card', `บัตรประจำตัว_${user.firstName}_${user.id}.pdf`, 'portrait');
    } finally {
      setIsWorking(false);
    }
  };

  const handleSaveToDrive = async () => {
    if (isWorking) return;
    setIsWorking(true);
    Swal.fire({
      title: 'กำลังบันทึกลง Google Drive...',
      text: 'กรุณารอสักครู่ ระบบกำลังจัดทำชุดเอกสาร PDF บันทึกลงเครื่อง และอัปโหลดไปยังคลาวด์ไดรฟ์',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    const cardEl = document.querySelector('.print-card');
    if (!cardEl) {
      Swal.fire({
        title: 'ข้อผิดพลาด',
        text: 'ไม่พบการ์ดข้อมูลผู้ที่ต้องการพิมพ์',
        icon: 'error',
        didClose: () => {
          ensureInteractionRestored();
        }
      });
      setIsWorking(false);
      return;
    }

    // Download locally first side-by-side to comply with downloading and saving to Drive at once
    try {
      await generateAndOpenPDF('.print-card', `บัตรประจำตัว_${user.firstName}_${user.id}.pdf`, 'portrait');
    } catch (e) {
      console.warn('Local PDF download fallback:', e);
    }

    try {
      const htmlContent = cardEl.outerHTML;
      const result = await uploadToGoogleDrive(`บัตรประจำตัว_${user.firstName}_${user.id}.pdf`, htmlContent);
      if (result.success) {
        Swal.fire({
          title: 'ดาวน์โหลดและบันทึกสำเร็จ!',
          html: `
            <div class="text-center font-sans space-y-3 pt-1">
              <p class="text-xs text-neutral-600">ได้ทำการดาวน์โหลดเอกสารลงตัวเครื่องและบันทึกลง Google Drive มินิโฟลเดอร์ของท่านเรียบร้อยแล้ว!</p>
              
              <div class="my-3.5 p-3 bg-emerald-50 text-emerald-800 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 border border-emerald-100">
                <span class="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                สถานะ: พร้อมเข้าดูและแก้ไขใน Google Drive ได้ทันที
              </div>
              
              <a href="https://drive.google.com/drive/my-drive" target="_blank" rel="noopener noreferrer" class="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-sm transition-all text-xs cursor-pointer">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                เปิดไดรฟ์เพื่อดูไฟล์เอกสาร (Google Drive)
              </a>
            </div>
          `,
          icon: 'success',
          confirmButtonText: 'ปิด',
          customClass: {
            confirmButton: 'bg-neutral-900 text-white px-5 py-2 rounded-md font-sans text-xs font-bold'
          },
          didClose: () => {
            ensureInteractionRestored();
          }
        });
      } else {
        Swal.fire({
          title: 'บันทึกเกลียวไดรฟ์ไม่สำเร็จ',
          text: result.message,
          icon: 'error',
          didClose: () => {
            ensureInteractionRestored();
          }
        });
      }
    } catch (error: any) {
      console.error('PDF Drive save error:', error);
      Swal.fire({
        title: 'เกิดข้อผิดพลาด',
        text: 'ไม่สามารถบันทึกลงไดรฟ์ได้: ' + error.message,
        icon: 'error',
        didClose: () => {
          ensureInteractionRestored();
        }
      });
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-4 no-print modal-print-ready animate-fade-in">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm overflow-hidden flex flex-col border border-neutral-200">
        <div className="bg-neutral-950 text-white p-3 flex items-center justify-between no-print relative z-50">
          <span className="text-xs font-mono font-bold">AMT CONNECT ID CARD ENGINE</span>
          <button
            onClick={isWorking ? undefined : onClose}
            disabled={isWorking}
            className={`text-neutral-400 hover:text-white text-xs font-medium relative z-50 ${isWorking ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            {isWorking ? 'กำลังทำงาน...' : 'ปิด'}
          </button>
        </div>

        <div className="p-8 bg-neutral-100 flex-1 flex flex-col items-center justify-center">
          {/* Vertical ID Badge Card Layout */}
          <div className="w-[60mm] h-[95mm] bg-white border border-neutral-400 rounded-lg shadow-md p-4 flex flex-col justify-between items-center relative text-center print-card overflow-hidden">
            
            {/* Header Accent block */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-neutral-950" />
            
            {/* School Brand */}
            <div className="mt-2 w-full">
              <h4 className="font-sans font-extrabold text-[11px] uppercase tracking-wider text-neutral-950 font-semibold">
                AMT CONNECT
              </h4>
              <p className="font-sans text-[7px] text-neutral-500 font-medium">สถาบันฝึกอบรมช่างบำรุงรักษาอากาศยาน</p>
              <p className="font-mono text-[6px] text-neutral-400 mt-0.5">AIRCRAFT MAINTENANCE TRAINING CENTER</p>
            </div>

            {/* Photo */}
            <div className="my-1.5 shrink-0">
              <div className="w-20 h-24 border-2 border-neutral-950 rounded-xs overflow-hidden bg-neutral-100 relative">
                {user.photoUrl ? (
                  <img
                    src={user.photoUrl}
                    alt={user.firstName}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[10px] text-neutral-400 font-sans">
                    รูปถ่ายนักศึกษา
                  </div>
                )}
              </div>
            </div>

            {/* User Info Details */}
            <div className="w-full">
              <h3 className="font-sans font-bold text-xs text-neutral-950 truncate">
                {user.firstNameEn && user.lastNameEn ? `${user.firstNameEn} ${user.lastNameEn}` : `${user.firstName} ${user.lastName}`}
              </h3>
              <p className="font-sans text-[9px] font-bold text-neutral-600 uppercase tracking-wide">
                ตำแหน่ง: {user.role}
              </p>
              <p className="font-mono text-[9px] text-neutral-500 font-bold mt-0.5">
                ID: {user.id}
              </p>
            </div>

            {/* QR Code Section */}
            <div className="my-2 select-none flex flex-col items-center">
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(getAppOriginForQR() + '/?id=' + user.id)}`} 
                alt="QR Verification" 
                className="w-18 h-18 border border-neutral-300 p-1 bg-white shadow-xs rounded-md" 
                referrerPolicy="no-referrer"
              />
              <span className="text-[6.5px] text-neutral-400 font-mono tracking-widest mt-1 uppercase font-bold">VERIFY QR CODE</span>
            </div>

            {/* Signature Area */}
            <div className="w-full border-t border-dashed border-neutral-300 pt-1 flex flex-col items-center shrink-0">
              {user.signature ? (
                <img
                  src={user.signature}
                  alt="ลายมือชื่อ"
                  className="h-5 object-contain pointer-events-none filter grayscale mix-blend-multiply"
                />
              ) : (
                <div className="h-5 text-[8px] text-neutral-300 font-sans italic">ไม่มีลายเซ็น</div>
              )}
              <span className="text-[7px] text-neutral-400 font-sans mt-0.5">ลายมือชื่อผู้ถือบัตร</span>
            </div>

            {/* Footer stamp */}
            <div className="w-full flex items-center justify-between border-t border-neutral-200 pt-1 text-[6px] font-mono text-neutral-400 uppercase">
              <span>REG: {user.createdAt || '-'}</span>
              <span>TLTC CARD</span>
            </div>
          </div>
        </div>

        <div className="bg-neutral-50 p-3 flex justify-end gap-2 border-t border-neutral-200 no-print flex-wrap">
          <button
            onClick={handleDownloadPDF}
            disabled={isWorking}
            className={`flex items-center gap-1.5 bg-emerald-650 hover:bg-emerald-700 text-white font-sans text-xs font-bold py-1.5 px-3 rounded-md transition-all hover:shadow-sm ${isWorking ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <FileDown size={13} />
            <span>ดาวน์โหลดเอกสาร PDF</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function formatEffectiveDate(dateStr: string | undefined): string {
  if (!dateStr) return '23/04/2025';
  if (dateStr.includes('-')) {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parts[0];
      const month = parts[1].padStart(2, '0');
      const day = parts[2].padStart(2, '0');
      return `${day}/${month}/${year}`;
    }
  }
  return dateStr;
}

interface RoomRequestDocProps {
  request: RoomRequest;
  onClose: () => void;
  onRecordUsage?: (requestId: string, report: string, customRoom?: string, signature?: string) => void;
  currentUser?: User;
}

// Robust Helper to convert Date String (DD/MM/YYYY or YYYY-MM-DD) into Thai BE date string (e.g., 19 ส.ค. 68)
function formatThaiDate(dateStr: string): string {
  if (!dateStr) return '....... / ....... / .......';
  
  let day = NaN;
  let month = NaN;
  let year = NaN;

  if (dateStr.includes('-')) {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
      day = parseInt(parts[2], 10);
    }
  } else if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      day = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
      year = parseInt(parts[2], 10);
    }
  }

  const thaiMonthsShort = [
    'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
    'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
  ];

  if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
    // Convert CE (G.C.) to Buddhist Era (B.E.)
    const fullYear = year < 2400 ? year + 543 : year;
    const thYearShort = String(fullYear).slice(-2);
    const monthName = month >= 1 && month <= 12 ? thaiMonthsShort[month - 1] : '___';
    return `${day} ${monthName} ${thYearShort}`;
  }
  return dateStr;
}

export function getMaintenanceManagerInfo() {
  try {
    const db = APIService.getDb();
    if (!db || !db.users) return null;
    const manager = db.users.find(u => u && u.role === 'Maintenance Manager' && u.status === 'Active')
                 || db.users.find(u => u && u.role === 'Maintenance Manager');
    if (manager) {
      const fName = manager.firstName || '';
      const lName = manager.lastName || '';
      const pfx = (fName.startsWith('นาย') || fName.startsWith('นาง') || fName.startsWith('นางสาว') || fName.startsWith('Mr') || fName.startsWith('Ms')) ? '' : 'นาย';
      return {
        fullName: `${pfx}${fName} ${lName}`.trim(),
        shortName: fName,
        signature: manager.signature
      };
    }
  } catch (err) {
    console.warn('Error reading maintenance manager from DB:', err);
  }
  return null;
}

export function RoomRequestDoc({ request, onClose, onRecordUsage, currentUser }: RoomRequestDocProps) {
  const managerInfo = getMaintenanceManagerInfo();
  const [isWorking, setIsWorking] = React.useState(false);
  const isRequester = currentUser && (
    currentUser.id === request.requesterId || 
    `${currentUser.firstName} ${currentUser.lastName}` === request.requesterName
  );

  const handleDownloadPDF = async () => {
    if (isWorking) return;
    setIsWorking(true);
    try {
      await generateAndOpenPDF('.print-card', `ขออนุญาตใช้ห้อง_${request.requesterName}_${request.id}.pdf`, 'portrait');
    } finally {
      setIsWorking(false);
    }
  };

  const promptRecordUsage = () => {
    Swal.fire({
      title: 'บันทึกรายงานการใช้ห้อง (TLTC-MO-034)',
      html: `
        <div class="text-left font-sans text-sm space-y-3">
          <div>
            <label class="text-slate-750 font-bold text-xs block mb-1">พิมพ์ระบุชื่อห้อง / พื้นที่ห้องปฏิบัติการที่เข้าใช้ *</label>
            <input id="usage-room-input" type="text" value="${request.room || ''}" class="w-full p-2 border border-slate-300 rounded font-sans text-sm focus:outline-emerald-500" placeholder="ระบุชื่อห้องเรียน/ห้องปฏิบัติการ เช่น Practical Area in Hangar" />
          </div>
          <div>
            <label class="text-slate-750 font-bold text-xs block mb-1">รายงานการใช้ห้องและสิ่งที่ต้องการพัฒนา/ปรับปรุง *</label>
            <textarea id="usage-report-input" class="w-full h-24 p-2 border border-slate-300 rounded font-sans text-xs focus:outline-emerald-500" placeholder="เช่น เพิ่มจำนวนปลั๊กไฟในห้องเรียน, เพิ่มความสว่าง, ซ่อมบำรุงแอร์ที่เสียงดัง ฯลฯ..."></textarea>
          </div>
          <div>
            <label class="text-slate-755 font-bold text-xs block mb-0.5">ผู้เข้าใช้ห้องลงลายมือชื่อ (กรุณาใช้เมาส์หรือทัชสกรีนเพื่อเซ็น) *</label>
            <div class="border border-dashed border-slate-300 rounded bg-slate-50 p-2 flex flex-col items-center">
              <canvas id="usage-sig-canvas" width="360" height="120" style="touch-action: none; background: white; border: 1px solid #cbd5e1; border-radius: 4px; cursor: crosshair;"></canvas>
              <button type="button" id="usage-sig-clear" class="mt-1.5 text-[10.5px] text-rose-650 font-sans font-bold hover:text-rose-800 transition-colors uppercase">ล้างลายเซ็น (Clear)</button>
            </div>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'บันทึกข้อมูลและเซ็นชื่อ',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#10b981', // emerald-500
      cancelButtonColor: '#6b7280', // gray-500
      focusConfirm: false,
      didOpen: () => {
        const canvas = document.getElementById('usage-sig-canvas') as HTMLCanvasElement;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.strokeStyle = '#0000FF'; // Blue signature ink
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        let drawing = false;
        let lastX = 0;
        let lastY = 0;

        const getMousePos = (canvasDom: HTMLCanvasElement, touchOrMouseEvent: any) => {
          const rect = canvasDom.getBoundingClientRect();
          const clientX = touchOrMouseEvent.touches ? touchOrMouseEvent.touches[0].clientX : touchOrMouseEvent.clientX;
          const clientY = touchOrMouseEvent.touches ? touchOrMouseEvent.touches[0].clientY : touchOrMouseEvent.clientY;
          return {
            x: clientX - rect.left,
            y: clientY - rect.top
          };
        };

        const startDrawing = (e: any) => {
          drawing = true;
          const pos = getMousePos(canvas, e);
          lastX = pos.x;
          lastY = pos.y;
        };

        const draw = (e: any) => {
          if (!drawing) return;
          e.preventDefault();
          const pos = getMousePos(canvas, e);
          ctx.beginPath();
          ctx.moveTo(lastX, lastY);
          ctx.lineTo(pos.x, pos.y);
          ctx.stroke();
          lastX = pos.x;
          lastY = pos.y;
        };

        const stopDrawing = () => {
          drawing = false;
        };

        // Mouse Events
        canvas.addEventListener('mousedown', startDrawing);
        canvas.addEventListener('mousemove', draw);
        canvas.addEventListener('mouseup', stopDrawing);
        canvas.addEventListener('mouseleave', stopDrawing);

        // Touch Events
        canvas.addEventListener('touchstart', startDrawing, { passive: false });
        canvas.addEventListener('touchmove', draw, { passive: false });
        canvas.addEventListener('touchend', stopDrawing);

        // Clear button
        const clearBtn = document.getElementById('usage-sig-clear');
        if (clearBtn) {
          clearBtn.addEventListener('click', () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
          });
        }
      },
      preConfirm: () => {
        const roomInput = document.getElementById('usage-room-input') as HTMLInputElement;
        const reportInput = document.getElementById('usage-report-input') as HTMLTextAreaElement;
        const canvas = document.getElementById('usage-sig-canvas') as HTMLCanvasElement;

        const roomVal = roomInput ? roomInput.value.trim() : '';
        const reportVal = reportInput ? reportInput.value.trim() : '';

        if (!roomVal) {
          Swal.showValidationMessage('กรุณากรอกระบุชื่อห้อง');
          return false;
        }
        if (!reportVal) {
          Swal.showValidationMessage('กรุณากรอกรายงานความต้องการ/สิ่งที่พัฒนา');
          return false;
        }

        let sigData = '';
        if (canvas) {
          // Check if canvas has any drawn strokes (since we clear with a white rect or transparent)
          // Simple heuristic: compare with initial transparent data url or just read pixels
          const ctx = canvas.getContext('2d');
          const pix = ctx ? ctx.getImageData(0, 0, canvas.width, canvas.height).data : [];
          let hasContent = false;
          for (let i = 3; i < pix.length; i += 4) {
            if (pix[i] > 0) {
              hasContent = true;
              break;
            }
          }
          if (!hasContent) {
            Swal.showValidationMessage('กรุณาเซ็นชื่อรับรองผู้เข้าใช้งานห้องปฏิบัติการ');
            return false;
          }
          sigData = canvas.toDataURL();
        }

        return {
          room: roomVal,
          report: reportVal,
          signature: sigData
        };
      }
    }).then((result) => {
      if (result.isConfirmed && onRecordUsage && result.value) {
        onRecordUsage(request.id, result.value.report, result.value.room, result.value.signature);
      }
    });
  };

  const [startTime, endTime] = React.useMemo(() => {
    if (!request.timeRange) return ['12:00', '12:45'];
    const parts = request.timeRange.split(/[\s]*-[\s]*/);
    return [parts[0] || '12:00', parts[1] || '12:45'];
  }, [request.timeRange]);

  const isHangar = request.room.toLowerCase().includes('hangar') || request.room.includes('โรงจอด') || request.room.toLowerCase().includes('practical');
  const isMeeting = request.room.toLowerCase().includes('meeting') || request.room.includes('ประชุม');
  const isTheoretical = request.room.toLowerCase().includes('theoretical') || request.room.toLowerCase().includes('classroom') || request.room.includes('ห้องเรียน');
  const isLibrary = request.room.toLowerCase().includes('library') || request.room.includes('ห้องสมุด');
  const isWorkshop1 = request.room.toLowerCase().includes('workshop 1') || request.room.includes('ช็อป 1') || request.room.toLowerCase().includes('workshop1');
  const isWorkshop2 = request.room.toLowerCase().includes('workshop 2') || request.room.includes('ช็อป 2') || request.room.toLowerCase().includes('workshop2');
  const isFiberglass = request.room.toLowerCase().includes('fiberglass') || request.room.includes('ไฟเบอร์กลาส') || request.room.toLowerCase().includes('fiber glass');
  const isExamination = request.room.toLowerCase().includes('examination') || request.room.includes('สอบ') || request.room.toLowerCase().includes('exam');
  const isAerodynamic = request.room.toLowerCase().includes('aerodynamic') || request.room.includes('แอร์โร') || request.room.toLowerCase().includes('aero');
  const isElectrical = request.room.toLowerCase().includes('electrical') || request.room.includes('ไฟฟ้า') || request.room.toLowerCase().includes('electric');
  const isOther = !isHangar && !isMeeting && !isTheoretical && !isLibrary && !isWorkshop1 && !isWorkshop2 && !isFiberglass && !isExamination && !isAerodynamic && !isElectrical;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-4 no-print modal-print-ready animate-fade-in">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[95vh] overflow-hidden flex flex-col border border-neutral-200">
        <div className="bg-neutral-950 text-white p-4 flex items-center justify-between no-print relative z-50">
          <div>
            <h3 className="font-sans font-bold text-sm">พิมพ์เอกสารขออนุมัติใช้ห้อง (TLTC-MO-033)</h3>
            <p className="font-mono text-xs text-neutral-400">AMT-DOCUMENT GENERATOR SYSTEM</p>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 p-1 hover:bg-neutral-800 rounded transition-colors relative z-50 hover:text-white cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-8 overflow-y-auto bg-neutral-650 flex-1">
          {/* Printable A4 PDF Paper Mock */}
          <div className="bg-white p-10 shadow-2xl max-w-[210mm] mx-auto min-h-[297mm] font-sans text-black relative print-card full-a4-portrait text-[12px] leading-relaxed border border-neutral-300">
            
            {/* Form Header Table modeled exactly like Photo 1 */}
            <table className="w-full border-collapse border border-black text-xs text-black mb-6">
              <tbody>
                <tr>
                  <td rowSpan={2} className="border border-black p-1 w-[12%] text-center align-middle">
                    <ThalangLogo className="w-14 h-14 mx-auto" />
                  </td>
                  <td className="border border-black p-2 w-[58%] text-center align-middle font-sans font-bold text-[11px] uppercase tracking-wide">
                    TLTC AIRCRAFT MAINTENANCE TRAINING ORGANIZATION
                  </td>
                  <td className="border border-black p-2 w-[30%] text-center align-middle font-sans font-semibold text-[11px]">
                    Maintenance Office
                  </td>
                </tr>
                <tr>
                  <td className="border border-black p-2 text-center align-middle font-sans font-bold text-sm">
                    ขออนุญาตใช้ห้อง
                  </td>
                  <td className="border border-black p-2 text-center align-middle font-mono font-bold text-[11.5px] tracking-wide">
                    TLTC-MO-033
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Content Details Grid Block mirroring Photo 1 layout with blue ink text & dotted lines */}
            <div className="space-y-3 my-5 text-black font-sans text-[12px] leading-[2.2]">
              <div className="flex flex-wrap items-baseline gap-1">
                <span>ข้าพเจ้า</span>
                <span className="flex-1 min-w-[200px] border-b border-dotted border-black px-2 font-bold text-blue-800 text-center select-none font-serif text-[13px] italic">
                  {request.requesterName}
                </span>
                <span>ตำแหน่ง</span>
                <span className="w-[180px] border-b border-dotted border-black px-2 font-bold text-blue-800 text-center select-none font-serif text-[13px] italic">
                  {request.requesterRole || 'นักศึกษา'}
                </span>
              </div>

              <div className="flex flex-wrap items-baseline gap-1">
                <span>สังกัด/หน่วยงาน</span>
                <span className="flex-1 min-w-[220px] border-b border-dotted border-black px-2 font-bold text-blue-800 text-center select-none font-serif text-[13px] italic">
                  {request.department || 'แผนกวิชาช่างอากาศยาน'}
                </span>
                <span>เบอร์โทรศัพท์</span>
                <span className="w-[180px] border-b border-dotted border-black px-2 font-mono font-bold text-blue-800 text-center select-none text-[13px]">
                  {request.phone || '063-4303414'}
                </span>
              </div>

              <div className="flex flex-wrap items-baseline gap-1">
                <span>ความประสงค์ขออนุญาตใช้ห้องเพื่อ</span>
                <span className="flex-1 min-w-[300px] border-b border-dotted border-black px-2 font-bold text-blue-800 text-center select-none font-serif text-[13px] italic">
                  {request.purpose || 'การเรียนการสอนและการฝึกปฏิบัติวิชาชีพ'}
                </span>
              </div>

              <div className="flex flex-wrap items-baseline gap-1">
                <span>ระยะเวลาการขอใช้ห้อง วันที่</span>
                <span className="w-[150px] border-b border-dotted border-black px-2 font-bold text-blue-800 text-center select-none font-serif text-[13px] italic">
                  {formatThaiDate(request.date)}
                </span>
                <span>เวลา</span>
                <span className="w-[100px] border-b border-dotted border-black px-2 font-mono font-bold text-blue-800 text-center select-none text-[13px]">
                  {startTime}
                </span>
                <span>น.</span>
              </div>

              <div className="flex flex-wrap items-baseline gap-1 justify-end mr-[165px]">
                <span className="mr-2">วันที่</span>
                <span className="w-[150px] border-b border-dotted border-black px-2 font-bold text-blue-800 text-center select-none font-serif text-[13px] italic">
                  {formatThaiDate(request.date)}
                </span>
                <span>เวลา</span>
                <span className="w-[100px] border-b border-dotted border-black px-2 font-mono font-bold text-blue-800 text-center select-none text-[13px]">
                  {endTime}
                </span>
                <span>น.</span>
              </div>
            </div>

            {/* Checklist Box Area modeled on Photo 1 checkbox layout */}
            <div className="my-5 text-black border border-neutral-300 p-4 rounded-md relative bg-neutral-50/20">
              <h4 className="font-bold font-sans text-xs mb-4 text-black border-b border-neutral-200 pb-1">
                ห้องที่มีความประสงค์ขอใช้
              </h4>
              <div className="grid grid-cols-3 gap-y-4 pl-2 text-[11.5px] font-sans">
                {/* Practical Area in Hangar */}
                <div className="flex items-center">
                  <div className="relative flex items-center justify-center w-4 h-4 border border-black bg-white mr-3 text-blue-800 select-none flex-shrink-0">
                    {isHangar && <span className="absolute text-[16px] font-bold -mt-1 font-serif">✓</span>}
                  </div>
                  <span>Practical Area in Hangar</span>
                </div>
                {/* Meeting Room */}
                <div className="flex items-center">
                  <div className="relative flex items-center justify-center w-4 h-4 border border-black bg-white mr-3 text-blue-800 select-none flex-shrink-0">
                    {isMeeting && <span className="absolute text-[16px] font-bold -mt-1 font-serif">✓</span>}
                  </div>
                  <span>Meeting Room</span>
                </div>
                {/* Theoretical Classroom */}
                <div className="flex items-center">
                  <div className="relative flex items-center justify-center w-4 h-4 border border-black bg-white mr-3 text-blue-800 select-none flex-shrink-0">
                    {isTheoretical && <span className="absolute text-[16px] font-bold -mt-1 font-serif">✓</span>}
                  </div>
                  <span>Theoretical Classroom</span>
                </div>

                {/* Library Room */}
                <div className="flex items-center">
                  <div className="relative flex items-center justify-center w-4 h-4 border border-black bg-white mr-3 text-blue-800 select-none flex-shrink-0">
                    {isLibrary && <span className="absolute text-[16px] font-bold -mt-1 font-serif">✓</span>}
                  </div>
                  <span>Library Room</span>
                </div>
                {/* Workshop 1 */}
                <div className="flex items-center">
                  <div className="relative flex items-center justify-center w-4 h-4 border border-black bg-white mr-3 text-blue-800 select-none flex-shrink-0">
                    {isWorkshop1 && <span className="absolute text-[16px] font-bold -mt-1 font-serif">✓</span>}
                  </div>
                  <span>Workshop 1</span>
                </div>
                {/* Workshop 2 */}
                <div className="flex items-center">
                  <div className="relative flex items-center justify-center w-4 h-4 border border-black bg-white mr-3 text-blue-800 select-none flex-shrink-0">
                    {isWorkshop2 && <span className="absolute text-[16px] font-bold -mt-1 font-serif">✓</span>}
                  </div>
                  <span>Workshop 2</span>
                </div>

                {/* Fiberglass Workshop */}
                <div className="flex items-center">
                  <div className="relative flex items-center justify-center w-4 h-4 border border-black bg-white mr-3 text-blue-800 select-none flex-shrink-0">
                    {isFiberglass && <span className="absolute text-[16px] font-bold -mt-1 font-serif">✓</span>}
                  </div>
                  <span>Fiberglass Workshop</span>
                </div>
                {/* Examination Room */}
                <div className="flex items-center">
                  <div className="relative flex items-center justify-center w-4 h-4 border border-black bg-white mr-3 text-blue-800 select-none flex-shrink-0">
                    {isExamination && <span className="absolute text-[16px] font-bold -mt-1 font-serif">✓</span>}
                  </div>
                  <span className="font-semibold">Examination Room</span>
                </div>
                {/* Aerodynamic Room */}
                <div className="flex items-center">
                  <div className="relative flex items-center justify-center w-4 h-4 border border-black bg-white mr-3 text-blue-800 select-none flex-shrink-0">
                    {isAerodynamic && <span className="absolute text-[16px] font-bold -mt-1 font-serif">✓</span>}
                  </div>
                  <span>Aerodynamic Room</span>
                </div>

                {/* Electrical Room */}
                <div className="flex items-center">
                  <div className="relative flex items-center justify-center w-4 h-4 border border-black bg-white mr-3 text-blue-800 select-none flex-shrink-0">
                    {isElectrical && <span className="absolute text-[16px] font-bold -mt-1 font-serif">✓</span>}
                  </div>
                  <span>Electrical Room</span>
                </div>
                {/* Other rooms */}
                <div className="col-span-2 flex items-center">
                  <div className="relative flex items-center justify-center w-4 h-4 border border-black bg-white mr-3 text-blue-800 select-none flex-shrink-0">
                    {isOther && <span className="absolute text-[16px] font-bold -mt-1 font-serif">✓</span>}
                  </div>
                  <span className="flex-shrink-0">Other rooms/</span>
                  <span className="ml-1 flex-1 border-b border-dotted border-black px-1 text-blue-800 font-serif text-[12px] italic min-h-[14px]">
                    {isOther ? request.room : ''}
                  </span>
                </div>
              </div>
            </div>

            {/* Requester Signature Block matching Photo 1 positioning */}
            <div className="my-5 flex justify-end mr-4">
              <div className="w-[310px] flex flex-col items-center text-center space-y-1.5 text-black font-sans text-xs">
                <div className="flex items-baseline w-full justify-center gap-1">
                  <span>ลงชื่อ</span>
                  <div className="relative flex-1 border-b border-dotted border-black flex justify-center items-center h-10">
                    {request.signature ? (
                      <img
                        src={request.signature}
                        alt="Signature"
                        className="absolute max-h-12 object-contain filter grayscale mix-blend-multiply brightness-[0.6] contrast-[1.4]"
                        style={{ top: '-11px' }}
                      />
                    ) : (
                      <span className="text-blue-800 italic font-mono select-none font-bold text-xs mt-1 block">Yhn</span>
                    )}
                  </div>
                  <span>ผู้ใช้ห้อง</span>
                </div>

                <div className="flex items-baseline w-full justify-center">
                  <span>( </span>
                  <span className="flex-1 text-blue-850 font-bold px-1 font-serif text-[13.5px] italic">
                    {request.requesterName}
                  </span>
                  <span> )</span>
                </div>

                <div className="flex items-baseline w-full justify-center gap-1">
                  <span>ตำแหน่ง</span>
                  <span className="flex-1 border-b border-dotted border-black text-blue-850 font-bold text-center select-none font-serif text-[13px] italic">
                    {request.requesterRole || 'นักศึกษา'}
                  </span>
                </div>

                <div className="flex items-baseline w-full justify-center gap-1 pt-1.5 font-mono text-[11px] text-blue-850 font-bold">
                  {formatThaiDate(request.date)}
                </div>
              </div>
            </div>

            {/* Readiness Opinion Box modeled on Photo 1 bottom region */}
            <div className="border border-black p-4 space-y-3 my-5 text-black font-sans text-xs bg-neutral-50/20">
              <h4 className="font-bold underline">ความคิดเห็นผู้ตรวจสอบความพร้อมของห้อง</h4>
              
              <div className="space-y-3 pl-3">
                <div className="flex items-center">
                  <div className="relative flex items-center justify-center w-4 h-4 border border-black bg-white mr-3 text-blue-800 select-none flex-shrink-0">
                    {request.maintenanceApproved === 'Approved' && <span className="absolute text-[16px] font-bold -mt-1 font-serif">✓</span>}
                  </div>
                  <span>ห้องมีความพร้อมสามารถใช้งานได้</span>
                </div>

                <div className="flex items-center">
                  <div className="relative flex items-center justify-center w-4 h-4 border border-black bg-white mr-3 text-blue-800 select-none flex-shrink-0">
                    {request.maintenanceApproved === 'Rejected' && <span className="absolute text-[16px] font-bold -mt-1 font-serif">✓</span>}
                  </div>
                  <span>ห้องมีข้อบกพร่องไม่สามารถใช้งานได้</span>
                </div>
              </div>

              <div className="flex items-baseline gap-1 mt-2">
                <span>หมายเหตุ</span>
                <span className="flex-1 border-b border-dotted border-black px-2 text-blue-800 font-serif text-[12.5px] italic font-semibold min-h-[16px]">
                  {request.maintenanceNote || '................................................................................................................................................'}
                </span>
              </div>

              {/* Maintenance Inspector Signature block matching Photo 1 exactly */}
              <div className="flex justify-end pt-3 mr-4">
                <div className="w-[310px] flex flex-col items-center text-center space-y-1.5 text-black font-sans text-xs">
                  <div className="flex items-baseline w-full justify-center gap-1">
                    <span>ลงชื่อ</span>
                    <div className="relative flex-1 border-b border-dotted border-black flex justify-center items-center h-10">
                      {request.maintenanceApproved === 'Approved' ? (
                        request.maintenanceOfficerSignature ? (
                          <img 
                            src={request.maintenanceOfficerSignature} 
                            alt="signature" 
                            className="absolute max-h-[38px] object-contain mix-blend-multiply pointer-events-none mt-1 scale-105" 
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="absolute text-blue-800 font-serif italic text-[16px] select-none font-black scale-110 -rotate-3 tracking-widest leading-none mt-2">
                            {request.maintenanceOfficerName ? request.maintenanceOfficerName.split(' ')[0] : (managerInfo ? managerInfo.shortName : '')}
                          </div>
                        )
                      ) : (
                        <span className="text-neutral-300 italic font-mono select-none">Signature</span>
                      )}
                    </div>
                    <span>ผู้ตรวจสอบ</span>
                  </div>

                  <div className="flex items-baseline w-full justify-center">
                    <span>( </span>
                    <span className="flex-1 text-blue-850 font-bold px-1 font-serif text-[13.5px] italic">
                      {request.maintenanceOfficerName || (managerInfo ? managerInfo.fullName : '')}
                    </span>
                    <span> )</span>
                  </div>

                  <div className="text-[11.5px] font-extrabold text-neutral-800 uppercase tracking-wider">
                    Maintenance Officer
                  </div>

                  <div className="flex items-baseline w-full justify-center gap-1 pt-1.5 font-mono text-[11px] text-blue-850 font-bold">
                    {request.maintenanceApproved === 'Approved' ? formatThaiDate(request.date) : '....... / ....... / .......'}
                  </div>
                </div>
              </div>
            </div>

            {/* Document Footer */}
            <div className="flex justify-between items-center text-[10px] text-neutral-500 font-sans mt-6 pt-2 border-t border-neutral-300 select-none">
              <span>Effective date {formatEffectiveDate(request.maintenanceCertifiedDate)}, Rev.00</span>
              <span className="font-semibold">Page 1 of 1</span>
            </div>
          </div>
        </div>

        <div className="bg-neutral-50 p-3.5 flex justify-end gap-3 border-t border-neutral-200 no-print flex-wrap">
          <button
            disabled={isWorking}
            onClick={handleDownloadPDF}
            className={`flex items-center gap-1.5 ${isWorking ? 'bg-neutral-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'} text-white font-sans text-xs font-bold py-2 px-4 rounded-md transition-all shadow-sm cursor-pointer`}
          >
            <FileDown size={13} />
            <span>{isWorking ? 'กำลังเตรียมไฟล์ PDF...' : 'ดาวน์โหลดเอกสาร PDF (Download PDF)'}</span>
          </button>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 bg-emerald-650 hover:bg-emerald-700 text-white font-sans text-xs font-bold py-2 px-4 rounded-md transition-all shadow-sm cursor-pointer"
          >
            <Printer size={13} />
            <span>พิมพ์เอกสารนี้ (Print)</span>
          </button>
          
          {onRecordUsage && isRequester && (
            <button
              onClick={promptRecordUsage}
              className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-700 text-white font-sans text-xs font-bold py-2 px-4 rounded-md transition-all shadow-sm cursor-pointer"
            >
              <FileText size={13} />
              <span>บันทึกการใช้ห้อง (รายงานสิ่งที่ต้องการพัฒนา)</span>
            </button>
          )}

          <button
            onClick={onClose}
            className="flex items-center gap-1.5 bg-neutral-800 hover:bg-neutral-700 text-white font-sans text-xs font-bold py-2 px-4 rounded-md transition-all shadow-sm cursor-pointer"
          >
            <X size={13} />
            <span>ปิดหน้าต่างนี้ (Close)</span>
          </button>
        </div>
      </div>
    </div>
  );
}

interface RoomUsageRecordDocProps {
  records: RoomUsageRecord[];
  roomRequests?: RoomRequest[];
  onClose: () => void;
}

export function RoomUsageRecordDoc({ records, roomRequests = [], onClose }: RoomUsageRecordDocProps) {
  const managerInfo = getMaintenanceManagerInfo();
  const [isWorking, setIsWorking] = React.useState(false);

  const handleDownloadPDF = async () => {
    if (isWorking) return;
    setIsWorking(true);
    try {
      await generateAndOpenPDF('.print-landscape', 'สมุดบันทึกการใช้ห้อง_TLTC-MO-034.pdf', 'landscape');
    } finally {
      setIsWorking(false);
    }
  };

  const latestCertifiedDate = React.useMemo(() => {
    const list = roomRequests.filter(r => r.maintenanceApproved === 'Approved' && r.maintenanceCertifiedDate);
    if (list.length === 0) return undefined;
    // Sort descending
    const sorted = [...list].sort((a, b) => {
      return new Date(b.maintenanceCertifiedDate!).getTime() - new Date(a.maintenanceCertifiedDate!).getTime();
    });
    return sorted[0].maintenanceCertifiedDate;
  }, [roomRequests]);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-4 no-print modal-print-ready animate-fade-in">
      {/* Dynamic Landscape print setup */}
      <style>{`
        @media print {
          .print-landscape {
            width: 297mm !important;
            height: 210mm !important;
            max-width: 100% !important;
            border: none !important;
            box-shadow: none !important;
            padding: 8mm !important;
            background: white !important;
          }
          @page {
            size: landscape;
            margin: 0;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[95vh] overflow-hidden flex flex-col border border-neutral-200">
        <div className="bg-neutral-950 text-white p-4 flex items-center justify-between no-print relative z-50">
          <div>
            <h3 className="font-sans font-bold text-sm">พิมพ์สมุดบันทึกการใช้ห้อง (TLTC-MO-034)</h3>
            <p className="font-mono text-xs text-neutral-400">AMT-DOCUMENT GENERATOR SYSTEM</p>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 p-1 hover:bg-neutral-800 rounded transition-colors relative z-50 hover:text-white cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-8 overflow-y-auto bg-neutral-600 flex-1">
          {/* Printable Book Pattern (A4 Widescreen / Landscape Format) */}
          <div className="bg-white p-10 border border-neutral-300 shadow-2xl max-w-[297mm] mx-auto min-h-[210mm] font-sans text-black relative print-landscape text-xs leading-relaxed">
            
            {/* Form Header Table modeled after Photo 2 */}
            <table className="w-full border-collapse border border-black text-xs text-black mb-6">
              <tbody>
                <tr>
                  <td rowSpan={2} className="border border-black p-1 w-[10%] text-center align-middle">
                    <ThalangLogo className="w-14 h-14 mx-auto" />
                  </td>
                  <td className="border border-black p-2 w-[65%] text-center align-middle font-sans font-bold text-[11px] uppercase tracking-wide">
                    TLTC AIRCRAFT MAINTENANCE TRAINING ORGANIZATION
                  </td>
                  <td className="border border-black p-1 w-[25%] text-center align-middle font-sans font-semibold text-[10.5px]">
                    Maintenance Office
                  </td>
                </tr>
                <tr>
                  <td className="border border-black p-2 text-center align-middle font-sans font-bold text-[13px] tracking-wide">
                    บันทึกการใช้ห้อง
                  </td>
                  <td className="border border-black p-1 text-center align-middle font-mono font-bold text-[11px] tracking-wide">
                    TLTC-MO-034
                  </td>
                </tr>
              </tbody>
            </table>

            {/* List Table print layout modeled closely on Photo 2 */}
            <table className="w-full border-collapse border border-neutral-950 text-center font-sans mt-2">
              <thead>
                <tr className="bg-neutral-100/50 font-bold text-[11px] text-black">
                  <th className="border border-neutral-950 p-2.5 w-[11%]">ว/ด/ป</th>
                  <th className="border border-neutral-950 p-2.5 w-[16%]">ห้อง</th>
                  <th className="border border-neutral-950 p-2.5 w-[18%]">ผู้เข้าใช้ห้อง</th>
                  <th className="border border-neutral-950 p-2.5 w-[37%] text-left pl-4">รายงานการใช้ห้อง (สิ่งที่ต้องการให้พัฒนา)</th>
                  <th className="border border-neutral-950 p-2.5 w-[18%]">Maintenance Officer (ผู้ตรวจรับ)</th>
                </tr>
              </thead>
              <tbody>
                {records.map((rec) => {
                  const formattedDate = formatThaiDate(rec.date);
                  return (
                    <tr key={rec.id} className="text-[11px] h-12">
                      {/* Date */}
                      <td className="border border-neutral-950 p-2.5 font-bold text-blue-800 font-serif text-[12px] italic select-none">
                        {formattedDate}
                      </td>
                      {/* Room */}
                      <td className="border border-neutral-950 p-2.5 font-semibold text-blue-800 font-sans select-none">
                        {rec.room}
                      </td>
                      {/* Requester Signature & typed name inside parentheses */}
                      <td className="border border-neutral-950 p-1">
                        <div className="flex flex-col items-center justify-center leading-none text-blue-800">
                          {rec.requesterSignature ? (
                            <img 
                              src={rec.requesterSignature} 
                              alt="Signature" 
                              className="max-h-8 max-w-[120px] object-contain mix-blend-multiply" 
                              referrerPolicy="no-referrer" 
                            />
                          ) : (
                            <span className="font-serif italic font-black text-[13.5px] -rotate-2 select-none">
                              {rec.requesterName ? rec.requesterName.split(' ')[0] : 'ไซฮัน'}
                            </span>
                          )}
                          <span className="text-[8.5px] text-neutral-500 mt-1.5 pb-0.5">
                            ({rec.requesterName || 'นายไซฮัน ซาราบรรณ'})
                          </span>
                        </div>
                      </td>
                      {/* Report / Feedback */}
                      <td className="border border-neutral-950 p-2.5 text-left pl-4 text-blue-800 font-serif text-[12.5px] italic font-semibold select-none">
                        {rec.report || 'ปฏิบัติงานเรียบร้อย ทำความสะอาดห้องเรียนสมบูรณ์หลังใช้บริการ'}
                      </td>
                      {/* Maintenance Officer Signature status */}
                      <td className="border border-neutral-950 p-2.5">
                        {managerInfo ? (
                          <div className="flex flex-col items-center justify-center leading-none text-blue-800 select-none">
                            <span className="font-serif italic font-black text-[14px] -rotate-3 text-blue-800 scale-105 tracking-wider">
                              {managerInfo.shortName}
                            </span>
                            <span className="text-[8.5px] text-neutral-500 mt-1 pb-0.5">
                              (M.O. ตรวจทานเรียบร้อย)
                            </span>
                          </div>
                        ) : (
                          <div className="text-neutral-300 italic text-[10px] select-none font-mono">
                            Pending Approval
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {/* Pad empty lines to look like empty rows in notebook if records are few */}
                {Array.from({ length: Math.max(0, 8 - records.length) }).map((_, i) => (
                  <tr key={`empty-${i}`} className="text-[11px] h-12">
                    <td className="border border-neutral-950 p-2.5 font-mono text-neutral-300">/......../......../</td>
                    <td className="border border-neutral-950 p-2.5 text-neutral-300">........................</td>
                    <td className="border border-neutral-950 p-2.5 text-neutral-300">........................</td>
                    <td className="border border-neutral-950 p-2.5 text-left pl-4 text-neutral-300">................................................................................................................</td>
                    <td className="border border-neutral-950 p-2.5 text-neutral-300">........................</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Verification End block matching Photo 2 hand-written checklist styles */}
            <div className="mt-10 flex justify-between items-start">
              <div className="text-[9.5px] text-neutral-500 max-w-[500px]">
                <span className="font-semibold block">คำชี้แนะการกรอกสมุดบันทึก:</span>
                <p>1. กรอกรายละเอียดทันทีหลังจากปฏิบัติงานเสร็จสิ้นในแต่ละช่วงวัน / คาบปฏิบัติการ</p>
                <p>2. แจ้งเบาะแสหรือข้อบกพร่องแอร์, ระบบกำลังไฟฟ้า, เครื่องมือดับเพลิง แก่ Maintenance Officer สังเกตการซ่อมบำรุง</p>
              </div>
              <div className="flex flex-col items-center text-center space-y-1.5 text-black font-sans text-xs mr-4">
                <span className="block mb-6 text-[10px] font-bold">รับรองโดย Maintenance Officer</span>
                <div className="relative w-48 border-b border-dotted border-black flex justify-center items-center h-8">
                  <div className="absolute text-blue-850 font-serif italic text-[15px] select-none font-black -rotate-3 pl-2 tracking-widest">
                    {managerInfo ? managerInfo.shortName : ''}
                  </div>
                </div>
                <span className="text-[10px] text-neutral-500 font-semibold">{managerInfo ? `( ${managerInfo.fullName} )` : ''}</span>
                <span className="text-[9px] text-neutral-400">Maintenance Lead Certifier</span>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-between items-center text-[10.5px] text-neutral-500 font-sans mt-8 pt-3 border-t border-neutral-300 select-none">
              <span>Effective date {formatEffectiveDate(latestCertifiedDate)}, Rev.00</span>
              <span className="font-bold">Page 1 of 1</span>
            </div>
          </div>
        </div>

        {/* Bottom bar for easy print and close */}
        <div className="bg-neutral-50 p-3.5 flex justify-end gap-3 border-t border-neutral-200 no-print flex-wrap">
          <button
            disabled={isWorking}
            onClick={handleDownloadPDF}
            className={`flex items-center gap-1.5 ${isWorking ? 'bg-neutral-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'} text-white font-sans text-xs font-bold py-2 px-4 rounded-md transition-all shadow-sm cursor-pointer`}
          >
            <FileDown size={13} />
            <span>{isWorking ? 'กำลังเตรียมไฟล์ PDF...' : 'ดาวน์โหลดเอกสาร PDF (Download PDF)'}</span>
          </button>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 bg-emerald-650 hover:bg-emerald-700 text-white font-sans text-xs font-bold py-2 px-4 rounded-md transition-all shadow-sm cursor-pointer"
          >
            <Printer size={13} />
            <span>พิมพ์บันทึกการใช้ห้อง (Print)</span>
          </button>
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 bg-neutral-800 hover:bg-neutral-700 text-white font-sans text-xs font-bold py-2 px-4 rounded-md transition-all shadow-sm cursor-pointer"
          >
            <X size={13} />
            <span>ปิดหน้าต่างนี้ (Close)</span>
          </button>
        </div>

      </div>
    </div>
  );
}

interface TraceabilityToolsLogDocProps {
  records: BorrowRecord[];
  onClose: () => void;
}

export function TraceabilityToolsLogDoc({ records, onClose }: TraceabilityToolsLogDocProps) {
  const managerInfo = getMaintenanceManagerInfo();
  const [isWorking, setIsWorking] = React.useState(false);

  const handleDownloadPDF = async () => {
    if (isWorking) return;
    setIsWorking(true);
    try {
      await generateAndOpenPDF('.print-landscape-mo001', 'สมุดทะเบียนยืมคืนเครื่องมือช่าง_TLTC-MO-001.pdf', 'landscape');
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-4 no-print animate-fade-in">
      {/* Dynamic Landscape Print Setup for TLTC-MO-001 */}
      <style>{`
        @media print {
          .print-landscape-mo001 {
            width: 297mm !important;
            height: 210mm !important;
            max-width: 100% !important;
            border: none !important;
            box-shadow: none !important;
            padding: 10mm !important;
            background: white !important;
          }
          @page {
            size: landscape;
            margin: 0;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="bg-white rounded-lg shadow-xl w-full max-w-7xl max-h-[95vh] overflow-hidden flex flex-col border border-neutral-200">
        <div className="bg-neutral-950 text-white p-3 flex items-center justify-between no-print relative z-50">
          <div className="flex items-center gap-2">
            <span className="bg-rose-600 text-white px-2 py-0.5 rounded text-[10px] font-bold">PDF GENERATOR</span>
            <span className="text-xs font-mono font-bold uppercase tracking-wider">สมุดทะเบียนการยืม-คืนเครื่องมือช่างอากาศยาน (TLTC-MO-001) [แนวนอน]</span>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white text-xs font-extrabold flex items-center gap-1 border border-neutral-700 px-2.5 py-1 rounded relative z-50 transition-colors cursor-pointer"
          >
            <X size={12} />
            <span>ปิด</span>
          </button>
        </div>

        {/* Printable Area Cover - dynamic overflow-auto for landscape sheet preview */}
        <div className="p-8 bg-neutral-100 flex-1 overflow-auto flex justify-start lg:justify-center">
          
          {/* A4 Landscape Sheet Container (297mm x 210mm) */}
          <div className="w-[297mm] min-h-[210mm] shrink-0 bg-white border border-neutral-350 p-[12mm] flex flex-col justify-between shadow-sm relative text-black print-landscape-mo001 selection:bg-neutral-150">
            <div>
              {/* Header Grid Table style matching actual standard */}
              <div className="border border-black grid grid-cols-12 text-center text-xs mb-4">
                <div className="col-span-3 border-r border-black p-3.5 flex flex-col items-center justify-center">
                  <ThalangLogo className="w-14 h-14" />
                  <span className="text-[8px] font-sans font-black mt-1 tracking-widest text-black">TLTC AMTO</span>
                </div>
                
                <div className="col-span-6 border-r border-black p-3 flex flex-col justify-center items-center">
                  <span className="font-sans font-black text-[10.5px] leading-tight text-neutral-950 uppercase tracking-tight block">
                    TLTC AIRCRAFT MAINTENANCE TRAINING ORGANIZATION
                  </span>
                  <div className="h-0.5 w-16 bg-black my-1.5" />
                  <span className="font-sans font-black text-xs sm:text-sm tracking-wider text-neutral-950 block">
                    TRACEABILITY TOOLS LOG (TLTC-MO-001)
                  </span>
                </div>
                
                <div className="col-span-3 text-left p-3.5 flex flex-col justify-center gap-1.5 text-[9.5px] font-sans">
                  <div className="flex justify-between">
                    <span className="font-semibold text-neutral-500">Dept:</span>
                    <span className="font-bold text-neutral-950 uppercase text-[9px]">Maintenance Office</span>
                  </div>
                  <div className="border-t border-dashed border-neutral-200 my-0.5" />
                  <div className="flex justify-between">
                    <span className="font-semibold text-neutral-500">Doc No:</span>
                    <span className="font-bold text-rose-700 font-mono text-[10px]">TLTC-MO-001</span>
                  </div>
                </div>
              </div>

              {/* Document Info Subheader */}
              <div className="flex justify-between items-center text-[10px] mb-3 text-neutral-600 bg-neutral-50 p-2 border border-neutral-300 rounded font-sans font-medium">
                <p>
                  * สารบบสมุดรับรองตรวจจับประวัติยืม-คืนเครื่องมือและอุปกรณ์ตรวจสอบย้อนกลับ (Traceability Verification Log Segment)
                </p>
                <span className="font-extrabold text-neutral-950 font-mono">
                  รวมบันทึก: {records.length} แถว
                </span>
              </div>

              {/* Main Log Table */}
              <table className="w-full text-left border-collapse border border-black max-w-full text-[8.5px] leading-snug">
                <thead>
                  <tr className="bg-neutral-50 text-[8px] sm:text-[8.5px] font-sans font-black text-center uppercase text-neutral-950 border-b border-black">
                    <th className="py-2 px-0.5 border-r border-black font-semibold text-center w-[12%]">Date / Time Out</th>
                    <th className="py-2 px-1 border-r border-black font-semibold text-left w-[24%]">Description of Tool</th>
                    <th className="py-2 px-0.5 border-r border-black font-semibold text-center w-[11%]">QR Code</th>
                    <th className="py-2 px-0.5 border-r border-black font-semibold text-center w-[5%]">Qty</th>
                    <th className="py-2 px-0.5 border-r border-black font-semibold text-center w-[11%]">Location</th>
                    <th className="py-2 px-1 border-r border-black font-semibold w-[13%]">Borrow Signature</th>
                    <th className="py-2 px-0.5 border-r border-black font-semibold text-center w-[12%]">Date / Time In</th>
                    <th className="py-2 px-1 border-r border-black font-semibold w-[13%]">Return Signature</th>
                    <th className="py-2 px-0.5 font-semibold text-center w-[11%]">Checked By</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((rec) => (
                    <tr key={rec.id} className="border-b border-black text-neutral-950 h-10 text-center">
                      {/* 1. Date Out */}
                      <td className="py-1 px-0.5 border-r border-black font-mono text-[7px] leading-tight text-center">
                        {rec.borrowDate}
                      </td>
                      
                      {/* 2. Tool Description */}
                      <td className="py-1 px-1 border-r border-black text-left font-sans font-bold text-neutral-950 uppercase truncate max-w-[150px]">
                        {rec.toolName}
                      </td>
                      
                      {/* 3. QR Code / P/N */}
                      <td className="py-1 px-0.5 border-r border-black font-mono font-bold text-[7.5px]">
                        {rec.equipmentCode}
                      </td>
                      
                      {/* 4. Qty */}
                      <td className="py-1 px-0.5 border-r border-black font-mono font-black text-[9px]">
                        {rec.qty}
                      </td>
                      
                      {/* 5. Location */}
                      <td className="py-1 px-0.5 border-r border-black font-sans text-neutral-700 uppercase text-[7.5px]">
                        {rec.toolLocation || 'Board 4'}
                      </td>
                      
                      {/* 6. Borrow Signature Image */}
                      <td className="py-1 px-1 border-r border-black text-center flex flex-col justify-center items-center gap-0.5 h-10">
                        {rec.borrowSignature ? (
                          <img
                            src={rec.borrowSignature}
                            alt="Borrow Sig"
                            className="h-5 w-auto object-contain select-none max-w-[65px]"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="h-4 w-10 border-b border-neutral-300 border-dashed" />
                        )}
                        <span className="text-[6.5px] text-neutral-500 font-sans truncate max-w-[65px] leading-none block">
                          {rec.borrowerName}
                        </span>
                      </td>
                      
                      {/* 7. Date In */}
                      <td className="py-0.5 px-0.5 border-r border-black font-mono text-[7px] leading-tight">
                        {rec.status === 'Returned' ? rec.returnDate : '-'}
                      </td>
                      
                      {/* 8. Return Student Signature */}
                      <td className="py-1 px-1 border-r border-black text-center flex flex-col justify-center items-center gap-0.5 h-10">
                        {(rec.status === 'Returned' || rec.status === 'PendingReturn') ? (
                          rec.returnSignature ? (
                            <img
                              src={rec.returnSignature}
                              alt="Return Sig"
                              className="h-5 w-auto object-contain select-none max-w-[65px]"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <img
                              src={rec.borrowSignature}
                              alt="Return Sig"
                              className="h-5 w-auto object-contain select-none max-w-[65px]"
                              referrerPolicy="no-referrer"
                            />
                          )
                        ) : (
                          <div className="h-4 w-10 border-b border-neutral-300 border-dashed" />
                        )}
                        <span className="text-[6.5px] text-neutral-500 font-sans truncate max-w-[65px] leading-none block">
                          {(rec.status === 'Returned' || rec.status === 'PendingReturn') ? rec.borrowerName : '-'}
                        </span>
                      </td>
                      
                      {/* 9. Checked by Maintenance Inspector (แสดงเฉพาะหลังเซ็นรับรับรองการส่งคืนเสร็จสิ้น) */}
                      <td className="py-1 px-1 text-center flex flex-col justify-center items-center gap-0.5 h-10">
                        {rec.status === 'Returned' && rec.checkSignature ? (
                          <img
                            src={rec.checkSignature}
                            alt="Checker Sig"
                            className="h-5 w-auto object-contain select-none max-w-[60px]"
                            referrerPolicy="no-referrer"
                          />
                        ) : rec.status === 'Returned' ? (
                          <span className="text-[6.5px] text-emerald-700 font-bold uppercase block leading-none">CLEARED</span>
                        ) : (
                          <span className="text-[7px] text-neutral-350 font-sans">-</span>
                        )}
                        <span className="text-[6px] font-sans text-neutral-500 truncate max-w-[60px] leading-none block font-semibold">
                          {rec.status === 'Returned' ? (rec.checkerName || 'Inspector') : ''}
                        </span>
                      </td>
                    </tr>
                  ))}

                  {/* Empty fallback rows to preserve standard paper length */}
                  {Array.from({ length: Math.max(0, 12 - records.length) }).map((_, index) => (
                    <tr key={`empty_row_${index}`} className="border-b border-black text-neutral-300 h-10 text-center">
                      <td className="border-r border-black font-mono text-[7px]">-</td>
                      <td className="border-r border-black font-sans text-left px-2 italic text-neutral-350">-</td>
                      <td className="border-r border-black font-mono text-[7px]">-</td>
                      <td className="border-r border-black font-mono text-[7px]">-</td>
                      <td className="border-r border-black font-sans text-neutral-350">-</td>
                      <td className="border-r border-black text-center flex flex-col justify-center items-center h-10 text-[7px]">-</td>
                      <td className="border-r border-black font-mono text-[7px]">-</td>
                      <td className="border-r border-black text-center flex flex-col justify-center items-center h-10 text-[7px]">-</td>
                      <td className="text-center h-10 text-[7px]">-</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Rules and verification flow section */}
              <div className="mt-8 flex justify-between items-start text-[9.5px] font-sans">
                <div className="max-w-[420px] text-neutral-500 leading-relaxed text-[8.5px]">
                  <span className="font-extrabold text-neutral-800 block text-[9px] mb-1">คำชี้แจงระเบียบรายงานยืมและรับคืนสิ่งอำนวยความสะดวก:</span>
                  <p>1. แบบฟอร์มชุดนี้เป็นหนึ่งในขั้นตอนประกันคุณภาพของฝ่ายสลักการบิน (AMTO Traceability Compliance)</p>
                  <p>2. การรับอนุมัติคืนแบบดิจิทัลจะเปลี่ยนสถานะเครื่องมือในคลังกองซ่อมบำรุงเป็น Ready ทันที</p>
                  <p>3. ห้ามนักศึกษานำเครื่องมือชิ้นแกนออกไปใช้นอกน่านปฏิบัติการในร่ม หากไม่มีอาจารย์ผู้คุมประเมินสถานการณ์</p>
                </div>

                <div className="flex flex-col items-center text-center space-y-1 text-black font-sans w-52">
                  <span className="block mb-6 text-[8.5px] font-extrabold text-neutral-800 uppercase tracking-tight">Certified by Lead Maintenance Officer</span>
                  <div className="relative w-40 border-b border-neutral-900 border-dotted h-8 flex justify-center items-center">
                    <div className="absolute text-emerald-800 font-medium font-serif italic text-xs -rotate-2 select-none">
                      {managerInfo ? managerInfo.fullName : ''}
                    </div>
                  </div>
                  <span className="text-[9.5px] font-bold text-neutral-900 leading-none mt-1">{managerInfo ? managerInfo.fullName : ''}</span>
                  <span className="text-[8px] text-neutral-500">Lead Maintenance Quality Officer</span>
                </div>
              </div>
            </div>

            {/* Footer Form Standard info */}
            <div className="flex justify-between items-center text-[8.5px] text-neutral-400 font-sans mt-8 pt-2 select-none border-t border-neutral-200">
              <span>Effective Date: 23/04/25, Rev.01</span>
              <span>TLTC-MO-001 / Traceability Tools Control Sheet</span>
              <span className="font-extrabold">Page 1 of 1</span>
            </div>
          </div>
        </div>

        {/* Bottom bar for easy print and close */}
        <div className="bg-neutral-50 p-3.5 flex justify-end gap-3 border-t border-neutral-200 no-print flex-wrap">
          <button
            disabled={isWorking}
            onClick={handleDownloadPDF}
            className={`flex items-center gap-1.5 ${isWorking ? 'bg-neutral-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'} text-white font-sans text-xs font-bold py-2 px-4 rounded-md transition-all shadow-sm cursor-pointer`}
          >
            <FileDown size={13} />
            <span>{isWorking ? 'กำลังเตรียมไฟล์ PDF...' : 'ดาวน์โหลดเอกสาร PDF (Download PDF)'}</span>
          </button>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 bg-emerald-650 hover:bg-emerald-700 text-white font-sans text-xs font-bold py-2 px-4 rounded-md transition-all shadow-sm cursor-pointer"
          >
            <Printer size={13} />
            <span>พิมพ์รายงานชิ้นนี้ (Print)</span>
          </button>
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 bg-neutral-800 hover:bg-neutral-700 text-white font-sans text-xs font-bold py-2 px-4 rounded-md transition-all shadow-sm cursor-pointer"
          >
            <X size={13} />
            <span>ปิดหน้าต่างนี้ (Close)</span>
          </button>
        </div>

      </div>
    </div>
  );
}
