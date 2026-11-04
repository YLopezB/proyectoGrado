import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { can, homeFor, useAuth } from './context/AuthContext.jsx';
import { FullSpinner } from './components/ui.jsx';
import AppLayout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import ChangePassword from './pages/ChangePassword.jsx';
import Home from './pages/Home.jsx';
import Area from './pages/Area.jsx';
import Tasks from './pages/Tasks.jsx';
import AssignedTasks from './pages/AssignedTasks.jsx';
import Repository from './pages/Repository.jsx';
import Directory from './pages/Directory.jsx';
import Profile from './pages/Profile.jsx';
import Users from './pages/admin/Users.jsx';
import AreasPositions from './pages/admin/AreasPositions.jsx';
import { PostsList, PostForm } from './pages/admin/Posts.jsx';
import Org from './pages/admin/Org.jsx';
import Company from './pages/admin/Company.jsx';
import AdminPassword from './pages/admin/AdminPassword.jsx';

/**
 * Guarda de rutas:
 *  - sin sesión                 -> /login
 *  - cambio de clave pendiente  -> /cambiar-clave
 *  - role='user'                -> solo personas; role='admin' -> solo la cuenta del .env
 *  - perm                       -> exige el permiso (el admin del .env los tiene todos)
 */
function RequireAuth({ role, perm, allowMustChange = false }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="h-full"><FullSpinner /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.mustChange && !allowMustChange) return <Navigate to="/cambiar-clave" replace />;
  if (!user.mustChange && allowMustChange) return <Navigate to={homeFor(user)} replace />;
  if (role && user.role !== role) return <Navigate to={homeFor(user)} replace />;
  if (perm && !can(user, perm)) return <Navigate to={homeFor(user)} replace />;
  return <Outlet />;
}

function Anywhere({ perms }) {
  const { user } = useAuth();
  return perms.some((p) => can(user, p)) ? <Outlet /> : <Navigate to={homeFor(user)} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<RequireAuth allowMustChange />}>
        <Route path="/cambiar-clave" element={<ChangePassword />} />
      </Route>

      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route element={<RequireAuth role="user" />}>
            <Route index element={<Home />} />
            <Route path="area" element={<Area />} />
            <Route path="tareas" element={<Tasks />} />
            <Route path="tareas/realizadas" element={<Tasks done />} />
            <Route path="tareas/asignadas" element={<AssignedTasks />} />
            <Route path="repositorio" element={<Repository />} />
            <Route path="directorio" element={<Directory />} />
            <Route path="perfil" element={<Profile />} />
          </Route>

          <Route path="admin">
            <Route element={<Anywhere perms={['posts']} />}>
              <Route path="publicaciones" element={<PostsList />} />
              <Route path="publicaciones/nueva" element={<PostForm />} />
              <Route path="publicaciones/:id/editar" element={<PostForm />} />
            </Route>
            <Route element={<RequireAuth perm="admin" />}>
              <Route index element={<Navigate to="usuarios" replace />} />
              <Route path="usuarios" element={<Users />} />
              <Route path="areas" element={<AreasPositions tab="areas" />} />
              <Route path="cargos" element={<AreasPositions tab="cargos" />} />
              <Route path="organigrama" element={<Org />} />
              <Route path="empresa" element={<Company />} />
            </Route>
            <Route element={<RequireAuth role="admin" />}>
              <Route path="clave" element={<AdminPassword />} />
            </Route>
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
