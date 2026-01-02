"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function Home() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setIsLoggedIn(!!session);
      setUserEmail(session?.user?.email || null);
      setLoading(false);
    };

    checkAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setIsLoggedIn(!!session);
        setUserEmail(session?.user?.email || null);
      }
    );

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  return (
    <main className="home-page">
      <div className="home-hero">
        <div className="home-content">
          <div className="home-header">
            <h1 className="home-title">
              Finance App
            </h1>
            <p className="home-subtitle">
              {isLoggedIn 
                ? `Welcome back, ${userEmail?.split("@")[0] || "User"}! 👋`
                : "Your Multi-Tenant Finance Management Solution"
              }
            </p>
          </div>

          <div className="home-body">
            <h2 className="home-section-title">
              {isLoggedIn ? "What you can do:" : "Welcome to the Finance & Accounting Module"}
            </h2>
            <p className="home-section-description">
              {isLoggedIn 
                ? "Manage your finances efficiently with our comprehensive tools:"
                : "This is a multi-tenant finance application that allows you to:"
              }
            </p>
            
            <div className="features-grid">
              <div className="feature-card">
                <div className="feature-icon">🏢</div>
                <h3 className="feature-title">Multi-Tenant Management</h3>
                <p className="feature-description">
                  Manage multiple tenants (clubs, associations, organizations)
                </p>
              </div>

              <div className="feature-card">
                <div className="feature-icon">💰</div>
                <h3 className="feature-title">Transaction Tracking</h3>
                <p className="feature-description">
                  Track income and expense transactions with ease
                </p>
              </div>

              <div className="feature-card">
                <div className="feature-icon">📊</div>
                <h3 className="feature-title">Financial Summaries</h3>
                <p className="feature-description">
                  View financial summaries with totals and balance
                </p>
              </div>

              <div className="feature-card">
                <div className="feature-icon">📎</div>
                <h3 className="feature-title">Document Management</h3>
                <p className="feature-description">
                  Attach documents to transactions
                </p>
              </div>

              <div className="feature-card">
                <div className="feature-icon">🔐</div>
                <h3 className="feature-title">Role-Based Access</h3>
                <p className="feature-description">
                  Control access with role-based permissions (read/write)
                </p>
              </div>
            </div>

            {!isLoggedIn && (
              <div className="cta-card">
                <div className="cta-header">
                  <span className="cta-icon">🚀</span>
                  <h3 className="cta-title">Getting Started</h3>
                </div>
                <p className="cta-description">
                  Please{" "}
                  <Link href="/login" className="cta-link">
                    login or signup
                  </Link>{" "}
                  to begin using the application.
                </p>
                <Link href="/login" className="btn btn-primary cta-button">
                  Get Started →
                </Link>
              </div>
            )}

            {isLoggedIn && (
              <div className="home-actions">
                <Link href="/tenants" className="btn btn-primary home-action-btn">
                  Manage Tenants →
                </Link>
                <Link href="/transactions" className="btn btn-secondary home-action-btn">
                  View Transactions →
                </Link>
                <Link href="/summary" className="btn btn-secondary home-action-btn">
                  Financial Summary →
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
