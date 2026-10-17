import { useNavigate } from "@tanstack/react-router";
export function useSignInAction() {
  const navigate = useNavigate();
  return () => {
    const redirect = window.location.pathname + window.location.search;
    try { sessionStorage.setItem("mas.auth.return", redirect); } catch { /* optional */ }
    void navigate({ to: "/auth", search: { redirect } });
  };
}