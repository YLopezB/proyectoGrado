import { Card, PageHeader } from '../../components/ui.jsx';
import PasswordForm from '../../components/PasswordForm.jsx';

export default function AdminPassword() {
  return (
    <div className="max-w-[1112px]">
      <PageHeader eyebrow="Administración / Seguridad" title="Contraseña" subtitle="Acceso de la cuenta de administración." />
      <Card className="max-w-[672px] p-6 sm:p-8">
        <PasswordForm
          intro="Al actualizarla se cerrarán las demás sesiones abiertas del administrador. La contraseña del archivo .env (ADMIN_PASSWORD) deja de ser válida."
        />
      </Card>
      <p className="mt-4 max-w-[672px] text-[13px] leading-[1.6] text-muted">
        Las demás personas cambian su contraseña desde “Mi perfil”, y el administrador puede restablecerla desde “Usuarios y permisos”.
      </p>
    </div>
  );
}
