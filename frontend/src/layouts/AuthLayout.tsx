import {
  Outlet,
} from "react-router-dom";

export default function AuthLayout() {
  return (
    <main className="min-h-screen overflow-hidden bg-slate-950">
      <Outlet />
    </main>
  );
}