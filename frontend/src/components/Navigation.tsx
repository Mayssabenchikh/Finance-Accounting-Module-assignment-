"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useEffect, useState } from "react";

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const checkLoginStatus = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setIsLoggedIn(!!session);
    };
    checkLoginStatus();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setIsLoggedIn(!!session);
      }
    );

    return () => {
      authListener?.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    // Clear tenant selection from localStorage
    localStorage.removeItem("selectedTenantId");
    // Redirect to home page
    router.push("/");
  };

  return (
    <nav
      style={{
        background: "white",
        borderBottom: "2px solid var(--border-color)",
        padding: "16px 24px",
        marginBottom: "0",
        display: "flex",
        gap: "24px",
        alignItems: "center",
        boxShadow: "var(--shadow)",
      }}
    >
      <div style={{ display: "flex", gap: "24px", alignItems: "center", flex: 1 }}>
        <Link
          href="/"
          style={{
            padding: "8px 12px",
            textDecoration: "none",
            color: pathname === "/" ? "var(--primary-color)" : "#495057",
            fontWeight: pathname === "/" ? "600" : "400",
            borderBottom: pathname === "/" ? "2px solid var(--primary-color)" : "2px solid transparent",
            transition: "all 0.2s",
          }}
        >
          Home
        </Link>
        {isLoggedIn && (
          <>
            <Link
              href="/tenants"
              style={{
                padding: "8px 12px",
                textDecoration: "none",
                color: pathname === "/tenants" ? "var(--primary-color)" : "#495057",
                fontWeight: pathname === "/tenants" ? "600" : "400",
                borderBottom: pathname === "/tenants" ? "2px solid var(--primary-color)" : "2px solid transparent",
                transition: "all 0.2s",
              }}
            >
              Tenants
            </Link>
            <Link
              href="/transactions"
              style={{
                padding: "8px 12px",
                textDecoration: "none",
                color: pathname === "/transactions" ? "var(--primary-color)" : "#495057",
                fontWeight: pathname === "/transactions" ? "600" : "400",
                borderBottom: pathname === "/transactions" ? "2px solid var(--primary-color)" : "2px solid transparent",
                transition: "all 0.2s",
              }}
            >
              Transactions
            </Link>
            <Link
              href="/summary"
              style={{
                padding: "8px 12px",
                textDecoration: "none",
                color: pathname === "/summary" ? "var(--primary-color)" : "#495057",
                fontWeight: pathname === "/summary" ? "600" : "400",
                borderBottom: pathname === "/summary" ? "2px solid var(--primary-color)" : "2px solid transparent",
                transition: "all 0.2s",
              }}
            >
              Summary
            </Link>
          </>
        )}
      </div>
      <div>
        {isLoggedIn ? (
          <button
            onClick={handleLogout}
            className="btn btn-secondary"
            style={{ fontSize: "14px" }}
          >
            Logout
          </button>
        ) : (
          <Link
            href="/login"
            className="btn btn-primary"
            style={{
              textDecoration: "none",
              fontSize: "14px",
            }}
          >
            Login
          </Link>
        )}
      </div>
    </nav>
  );
}

