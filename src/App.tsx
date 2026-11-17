import { useState } from "react";
import {
  Routes,
  Route,
  NavLink,
  Link,
  Outlet,
  useNavigate,
} from "react-router-dom";
import { supabase } from "./lib/supabase";
import { useSession } from "./hooks/useSession.ts";
import { ProtectedRoute } from "./components/ProtectedRoute.tsx";
import Home from "./pages/Home.tsx";
import Dashboard from "./pages/Dashboard";
import Editor from "./pages/Editor.tsx";
import Viewer from "./pages/Viewer.tsx";
import ProfileEditor from "./pages/ProfileEditor";
import Login from "./pages/Login.tsx";

const navLink = ({ isActive }: { isActive: boolean }) =>
  `text-sm ${isActive ? "font-medium text-gray-900" : "text-gray-600 hover:text-gray-900"}`;

// Creates an empty wireframe row, then opens it in the editor
function NewWireframeButton() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const create = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      navigate("/login");
      return;
    }

    setBusy(true);
    const { data, error } = await supabase
      .from("wireframes")
      .insert({
        owner_id: session.user.id,
        title: "Untitled",
        document: { version: 1, elements: {}, order: [] },
      })
      .select("id")
      .single();
    setBusy(false);

    if (error) {
      window.alert(error.message);
      return;
    }
    navigate(`/editor/${data.id}`);
  };

  return (
    <button
      onClick={create}
      disabled={busy}
      className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
    >
      {busy ? "Creating…" : "New wireframe"}
    </button>
  );
}

function Layout() {
  const { session } = useSession();

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-12 shrink-0 items-center gap-5 border-b border-gray-200 bg-white px-4">
        <Link to="/" className="font-semibold">
          Wireframes
        </Link>

        <nav className="flex items-center gap-4">
          <NavLink to="/dashboard" className={navLink}>
            Dashboard
          </NavLink>
          {session && (
            <NavLink to="/profile" className={navLink}>
              Profile
            </NavLink>
          )}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <NewWireframeButton />
          {session ? (
            <button
              onClick={() => supabase.auth.signOut()}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Sign out
            </button>
          ) : (
            <Link
              to="/login"
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Sign in
            </Link>
          )}
        </div>
      </header>

      {/* Pages fill this area; the editor and viewer use h-full inside it */}
      <main className="min-h-0 flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="w/:id" element={<Viewer />} />
        <Route path="login" element={<Login />} />

        <Route element={<ProtectedRoute />}>
          <Route path="profile" element={<ProfileEditor />} />
          <Route path="editor/:id" element={<Editor />} />
        </Route>

        <Route
          path="*"
          element={<p className="p-6 text-sm text-gray-500">Page not found.</p>}
        />
      </Route>
    </Routes>
  );
}
