import React, { useRef, useState, useEffect } from 'react';
import { RotateCcw, Edit3 } from 'lucide-react';

interface SignaturePadProps {
  onSave: (signatureDataUrl: string) => void;
  defaultValue?: string;
  placeholder?: string;
}

export default function SignaturePad({ onSave, defaultValue, placeholder = "เขียนลายเซ็นตรงนี้..." }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSigned, setHasSigned] = useState(false);
  const [writeMode, setWriteMode] = useState<'draw' | 'type'>('draw');
  const [typedText, setTypedText] = useState('');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Line styles
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Handle high DPI screens
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width || 400;
    canvas.height = rect.height || 144;

    // Draw initial if default passed
    if (defaultValue) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0);
        setHasSigned(true);
      };
      img.src = defaultValue;
    }
  }, [defaultValue]);

  const clearHandler = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSigned(false);
    setTypedText('');
    onSave('');
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (writeMode !== 'draw') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    let clientX = 0;
    let clientY = 0;

    if ('touches' in e) {
      if (e.touches.length === 0) return;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
      // Prevent scrolling when drawing on touch screens
      if (e.cancelable) e.preventDefault();
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasSigned(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (writeMode !== 'draw' || !isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    let clientX = 0;
    let clientY = 0;

    if ('touches' in e) {
      if (e.touches.length === 0) return;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
      if (e.cancelable) e.preventDefault();
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (writeMode !== 'draw' || !isDrawing) return;
    setIsDrawing(false);
    
    // Save image to callback
    const canvas = canvasRef.current;
    if (canvas) {
      const dataUrl = canvas.toDataURL('image/png');
      onSave(dataUrl);
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setTypedText(text);
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (text.trim()) {
      // Draw simulated elegant italic/handwritten cursive signature
      ctx.fillStyle = '#0F172A';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // Use premium script-like typeface combinations fallback
      ctx.font = "italic bold 28px 'Playfair Display', 'Brush Script MT', 'Dancing Script', 'Georgia', serif";
      ctx.fillText(text, canvas.width / 2, canvas.height / 2);
      
      // Add a subtle classic calligraphic underline for visual polish
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const textWidth = ctx.measureText(text).width;
      const startX = (canvas.width - textWidth) / 2 - 10;
      const endX = (canvas.width + textWidth) / 2 + 10;
      const underlineY = (canvas.height / 2) + 20;
      
      ctx.moveTo(startX, underlineY);
      ctx.quadraticCurveTo(canvas.width / 2, underlineY + 4, endX, underlineY - 2);
      ctx.stroke();
      
      setHasSigned(true);
      
      // Save image
      const dataUrl = canvas.toDataURL('image/png');
      onSave(dataUrl);
    } else {
      setHasSigned(false);
      onSave('');
    }
  };

  return (
    <div className="relative border border-neutral-300 rounded-md bg-white overflow-hidden shadow-inner group">
      {/* Signature mode switch helper tab bar */}
      <div className="flex justify-between items-center bg-neutral-100 border-b border-neutral-300 p-2 text-[10px] sm:text-[11px] font-sans">
        <span className="font-bold text-neutral-700 flex items-center gap-1">
          <Edit3 size={11} className="text-slate-500" />
          <span>วิธีการลงลายมือชื่อ (Signature Method):</span>
        </span>
        <div className="flex gap-1 select-none">
          <button
            type="button"
            onClick={() => {
              setWriteMode('draw');
              clearHandler();
            }}
            className={`px-2 py-0.5 rounded cursor-pointer text-[10px] font-bold font-sans transition-all active:scale-95 ${
              writeMode === 'draw'
                ? 'bg-neutral-950 text-white shadow-xs'
                : 'bg-transparent text-neutral-600 hover:bg-neutral-200'
            }`}
          >
            ลากเขียนด้วยนิ้ว/เมาส์ (Draw)
          </button>
          <button
            type="button"
            onClick={() => {
              setWriteMode('type');
              clearHandler();
            }}
            className={`px-2 py-0.5 rounded cursor-pointer text-[10px] font-bold font-sans transition-all active:scale-95 ${
              writeMode === 'type'
                ? 'bg-neutral-950 text-white shadow-xs'
                : 'bg-transparent text-neutral-600 hover:bg-neutral-200'
            }`}
          >
            พิมพ์ข้อความตัวแทน (Type)
          </button>
        </div>
      </div>

      <div className="relative">
        <div className="absolute top-2 left-2 z-10 text-[10px] font-mono text-neutral-400 select-none flex items-center gap-1">
          <Edit3 size={12} />
          <span>{writeMode === 'draw' ? placeholder : "ภาพพรีวิวจำลองลายเซ็น (Preview)"}</span>
        </div>

        <canvas
          id="sigPadCanvas"
          ref={canvasRef}
          className={`w-full h-36 bg-stone-50 sig-canvas ${writeMode === 'draw' ? 'cursor-crosshair' : 'cursor-default'}`}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />

        <div className="absolute bottom-2 right-2 flex items-center gap-2 z-10">
          <button
            id="clearSigBtn"
            type="button"
            onClick={clearHandler}
            className="flex items-center gap-1 text-[11px] font-sans font-medium px-2 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-sm border border-neutral-300 transition-colors cursor-pointer"
            title="ล้างข้อมูลลายเซ็น"
          >
            <RotateCcw size={12} />
            <span>ล้างรูปภาพ</span>
          </button>
        </div>
        
        {hasSigned && (
          <div className="absolute top-2 right-2 flex items-center gap-1 bg-emerald-50 text-emerald-700 text-[10px] px-1.5 py-0.5 rounded border border-emerald-300 z-10">
            <span>มีลายเซ็นแล้ว</span>
          </div>
        )}
      </div>

      {writeMode === 'type' && (
        <div className="p-2 border-t border-neutral-200 bg-neutral-50 flex items-center gap-2">
          <input
            type="text"
            required
            maxLength={40}
            placeholder="โปรดกรอก ชื่อ-นามสกุล ของท่านเพื่อประทับตราดิจิทัล..."
            value={typedText}
            onChange={handleTextChange}
            className="w-full px-3 py-1.5 text-[11px] border border-neutral-300 rounded font-sans focus:outline-none focus:ring-1 focus:ring-neutral-950 bg-white placeholder-neutral-400 text-neutral-900 shadow-sm"
          />
        </div>
      )}
    </div>
  );
}
