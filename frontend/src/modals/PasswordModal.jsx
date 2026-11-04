import { X } from 'lucide-react';
import { Modal } from '../components/ui.jsx';
import PasswordForm from '../components/PasswordForm.jsx';

export default function PasswordModal({ onClose }) {
  return (
    <Modal open onClose={onClose} title="Cambiar contraseña" width={672}>
      <div className="relative min-h-0 flex-1 overflow-y-auto p-6 sm:p-8">
        <button type="button" onClick={onClose} aria-label="Cerrar" className="absolute right-5 top-5 rounded-lg p-1.5 text-brand hover:bg-tint"><X className="h-5 w-5" strokeWidth={1.5} /></button>
        <PasswordForm onDone={onClose} onCancel={onClose} />
      </div>
    </Modal>
  );
}
