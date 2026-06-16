import Swal from 'sweetalert2';

export const alerts = Swal.mixin({
  confirmButtonColor: '#0F172A',
  cancelButtonColor: '#64748B',
  customClass: {
    popup: 'rounded-2xl shadow-2xl border border-slate-100 p-6',
    title: 'text-xl font-extrabold text-slate-900 mb-2',
    htmlContainer: 'text-sm text-slate-600 font-sans',
    confirmButton: 'px-5 py-2.5 font-bold rounded-lg cursor-pointer transform hover:scale-105 transition-all',
    cancelButton: 'px-5 py-2.5 font-bold rounded-lg cursor-pointer transform hover:scale-105 transition-all'
  },
  buttonsStyling: true,
  backdrop: 'rgba(15, 23, 42, 0.4)',
});
