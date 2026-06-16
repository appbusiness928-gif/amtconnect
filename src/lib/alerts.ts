import Swal from 'sweetalert2';

export const alerts = Swal.mixin({
  confirmButtonColor: '#0f172a',
  cancelButtonColor: '#e2e8f0',
  customClass: {
    popup: 'rounded-3xl shadow-2xl border border-slate-200/60 !p-8 bg-white/95 backdrop-blur-sm',
    title: 'text-2xl font-black text-slate-950 mb-3 !tracking-tight',
    htmlContainer: 'text-[15px] text-slate-600 font-sans !tracking-normal !leading-relaxed',
    confirmButton: 'bg-slate-950 text-white rounded-full px-8 py-3 font-bold hover:bg-slate-800 transition-all duration-300 transform hover:scale-[1.02] shadow-md',
    cancelButton: 'bg-slate-100 text-slate-700 rounded-full px-8 py-3 font-bold hover:bg-slate-200 transition-all duration-300 transform hover:scale-[1.02]',
    actions: 'mt-6 gap-3',
  },
  buttonsStyling: false,
  backdrop: 'rgba(15, 23, 42, 0.25)',
  padding: '1.5rem',
});
