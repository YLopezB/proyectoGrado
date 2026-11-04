import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import PasswordForm from '../components/PasswordForm.jsx';
import { AuthBackdrop, AuthLogo } from './Login.jsx';

// Pantalla obligatoria en el primer ingreso (la contraseña inicial es el documento)
export default function ChangePassword() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  if (!user) return <Navigate to="/login" replace />;
  return (
    <AuthBackdrop>
      <AuthLogo />
      <div className="anim-pop w-full max-w-[672px] rounded-[28px] bg-white p-7 shadow-[0_30px_80px_-20px_rgba(0,0,0,.4)] sm:p-10">
        <PasswordForm
          title="Crea tu contraseña"
          intro={`Hola, ${user.name.split(' ')[0]}. Por seguridad debes cambiar la contraseña inicial antes de continuar.`}
          onDone={() => nav('/', { replace: true })}
          onCancel={logout}
          cancelLabel="Cerrar sesión"
        />
      </div>
    </AuthBackdrop>
  );
}
