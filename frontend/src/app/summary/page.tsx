"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

interface Summary {
  totalIncome: number;
  totalExpense: number;
  balance: number;
}

const API_URL = "http://localhost:4000";

export default function SummaryPage() {
  const router = useRouter();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tenantId, setTenantId] = useState<string | null>(null);

  useEffect(() => {
    checkAuthAndLoad();
  }, []);

  const checkAuthAndLoad = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }

      // Get selected tenant from localStorage
      const stored = localStorage.getItem("selectedTenantId");
      if (!stored) {
        setError("Please select a tenant first from the Tenants page");
        setLoading(false);
        return;
      }

      setTenantId(stored);
      await loadSummary(stored, session.access_token);
    } catch (err: any) {
      setError(err.message || "Failed to initialize");
      setLoading(false);
    }
  };

  const loadSummary = async (tid: string, token: string) => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(`${API_URL}/summary?tenantId=${tid}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to load summary");
      }

      const data = await response.json();
      setSummary(data);
    } catch (err: any) {
      setError(err.message || "Failed to load summary");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="container" style={{ maxWidth: 1000 }}>
      <h1 style={{ marginBottom: "24px", fontSize: "32px", color: "var(--foreground)" }}>
        Financial Summary
      </h1>

      {error && (
        <div className="alert alert-error">
          {error}
        </div>
      )}

      {!tenantId ? (
        <div className="card">
          <p style={{ marginBottom: "16px", color: "#6c757d" }}>
            Please select a tenant from the <a href="/tenants">Tenants</a> page.
          </p>
        </div>
      ) : summary ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
            gap: "24px",
          }}
        >
          <div
            className="card summary-card"
            style={{
              background: "linear-gradient(135deg, var(--income-bg) 0%, #c3e6cb 100%)",
              border: "2px solid var(--income-color)",
            }}
          >
            <h3 style={{ margin: "0 0 12px 0", fontSize: "16px", color: "#155724", fontWeight: "600" }}>
              Total Income
            </h3>
            <p style={{ fontSize: "32px", fontWeight: "bold", margin: 0, color: "#155724" }}>
              {summary.totalIncome.toFixed(2)}
            </p>
          </div>

          <div
            className="card summary-card"
            style={{
              background: "linear-gradient(135deg, var(--expense-bg) 0%, #f5c6cb 100%)",
              border: "2px solid var(--expense-color)",
            }}
          >
            <h3 style={{ margin: "0 0 12px 0", fontSize: "16px", color: "#721c24", fontWeight: "600" }}>
              Total Expenses
            </h3>
            <p style={{ fontSize: "32px", fontWeight: "bold", margin: 0, color: "#721c24" }}>
              {summary.totalExpense.toFixed(2)}
            </p>
          </div>

          <div
            className="card summary-card"
            style={{
              background:
                summary.balance >= 0
                  ? "linear-gradient(135deg, #d1ecf1 0%, #bee5eb 100%)"
                  : "linear-gradient(135deg, var(--expense-bg) 0%, #f5c6cb 100%)",
              border: `2px solid ${summary.balance >= 0 ? "#0c5460" : "var(--expense-color)"}`,
            }}
          >
            <h3
              style={{
                margin: "0 0 12px 0",
                fontSize: "16px",
                color: summary.balance >= 0 ? "#0c5460" : "#721c24",
                fontWeight: "600",
              }}
            >
              Balance
            </h3>
            <p
              style={{
                fontSize: "32px",
                fontWeight: "bold",
                margin: 0,
                color: summary.balance >= 0 ? "#0c5460" : "#721c24",
              }}
            >
              {summary.balance.toFixed(2)}
            </p>
          </div>
        </div>
      ) : (
        <div className="card">
          <p style={{ color: "#6c757d", textAlign: "center" }}>No summary data available.</p>
        </div>
      )}
    </main>
  );
}

