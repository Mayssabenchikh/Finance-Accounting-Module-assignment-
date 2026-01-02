"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import React from "react";

interface Transaction {
  id: string;
  tenant_id: string;
  type: "income" | "expense";
  amount: number;
  description: string;
  date: string;
  category: string;
  created_by: string;
  created_at: string;
}

interface Document {
  id: string;
  transaction_id: string;
  file_url: string;
  created_at: string;
}

const API_URL = "http://localhost:4000";

export default function TransactionsPage() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [documents, setDocuments] = useState<Record<string, Document[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<"read" | "write" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [addingDocument, setAddingDocument] = useState<string | null>(null);
  const [documentUrl, setDocumentUrl] = useState("");

  // Form state
  const [formType, setFormType] = useState<"income" | "expense">("income");
  const [formAmount, setFormAmount] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [formDate, setFormDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  useEffect(() => {
    checkAuthAndLoad();
  }, []);

  // Reload role and transactions when tenant changes
  useEffect(() => {
    const handleStorageChange = () => {
      const stored = localStorage.getItem("selectedTenantId");
      if (stored && stored !== tenantId) {
        setTenantId(stored);
        setError(""); // Clear previous errors
        // Reload data for new tenant
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session) {
            loadUserRole(stored);
            loadTransactions(stored, session.access_token);
          }
        });
      } else if (!stored && tenantId) {
        // Only clear if localStorage was actually removed (not just empty on first load)
        setTenantId(null);
        setUserRole(null);
        setTransactions([]);
        setDocuments({});
      }
    };

    const handleFocus = () => {
      const stored = localStorage.getItem("selectedTenantId");
      if (stored && stored !== tenantId) {
        setTenantId(stored);
        setError(""); // Clear previous errors
        // Reload data for new tenant
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session) {
            loadUserRole(stored);
            loadTransactions(stored, session.access_token);
          }
        });
      } else if (!stored && tenantId) {
        setTenantId(null);
        setUserRole(null);
        setTransactions([]);
        setDocuments({});
      }
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, [tenantId]);

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
      
      // Load user role and transactions in parallel for better UX
      // Load transactions even if role loading fails (user might still be able to view)
      await Promise.allSettled([
        loadUserRole(stored),
        loadTransactions(stored, session.access_token),
      ]);
    } catch (err: any) {
      setError(err.message || "Failed to initialize");
      setLoading(false);
    }
  };

  const reloadData = async () => {
    if (!tenantId) return;
    
    setError("");
    setLoading(true);
    
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }

      await Promise.allSettled([
        loadUserRole(tenantId),
        loadTransactions(tenantId, session.access_token),
      ]);
    } catch (err: any) {
      setError(err.message || "Failed to reload data");
    } finally {
      setLoading(false);
    }
  };

  const loadUserRole = async (tid: string) => {
    if (!tid) {
      setUserRole(null);
      return;
    }

    try {
      // Get current user to ensure we're querying with the right context
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        console.error("Error getting user:", userError);
        setUserRole(null);
        setError("Authentication error. Please log in again.");
        return;
      }

      console.log("Loading role for tenant:", tid, "user:", user.id);

      // Query tenant_users - Filter explicitly by user_id AND tenant_id
      // This ensures we only get the current user's role for this tenant
      // RLS should also enforce this, but explicit filtering is safer
      const { data, error } = await supabase
        .from("tenant_users")
        .select("role")
        .eq("tenant_id", tid)
        .eq("user_id", user.id) // Explicitly filter by current user ID
        .maybeSingle(); // Use maybeSingle() since we expect 0 or 1 row
      
      console.log("Role query result:", { data, error });

      // If we get an error, handle it
      if (error) {
        console.error("Error loading user role:", error);
        // PGRST116 means no rows found (user not a member of this tenant)
        if (error.code === "PGRST116") {
          console.log("User is not a member of tenant:", tid);
          setUserRole(null);
          setError("You are not a member of this tenant. Please add yourself via SQL or select a valid tenant from the Tenants page.");
          return;
        }
        // If it's a permission error, user is not a member
        if (error.code === "42501" || error.message?.includes("permission")) {
          setUserRole(null);
          setError("You are not a member of this tenant. Please add yourself via SQL or select a valid tenant from the Tenants page.");
          return;
        }
        // Other errors
        setUserRole(null);
        setError(`Error loading role: ${error.message}`);
        return;
      }

      // If no data returned, user is not a member
      if (!data) {
        console.log("No role data returned for tenant:", tid);
        setUserRole(null);
        setError("You are not a member of this tenant. Please add yourself via SQL or select a valid tenant from the Tenants page.");
        return;
      }

      console.log("Role loaded successfully:", data.role);
      setUserRole(data.role || null);
      // Clear any previous error if role loaded successfully
      setError("");
    } catch (err: any) {
      console.error("Error loading user role:", err);
      setUserRole(null);
      setError(`Error loading role: ${err.message}`);
    }
  };

  const loadTransactions = async (tid: string, token: string) => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(`${API_URL}/transactions?tenantId=${tid}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to load transactions");
      }

      const data = await response.json();
      const loadedTransactions = data.transactions || [];
      setTransactions(loadedTransactions);

      // Load documents for all transactions
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        const docsMap: Record<string, Document[]> = {};
        for (const tx of loadedTransactions) {
          const docs = await loadDocuments(tx.id, session.access_token);
          docsMap[tx.id] = docs;
        }
        setDocuments(docsMap);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load transactions");
    } finally {
      setLoading(false);
    }
  };

  const loadDocuments = async (transactionId: string, token: string): Promise<Document[]> => {
    try {
      const response = await fetch(`${API_URL}/documents?transactionId=${transactionId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      return data.documents || [];
    } catch (err) {
      return [];
    }
  };

  const handleAddDocument = async (transactionId: string) => {
    const url = documentUrl.trim();
    
    if (!url) {
      setError("Document URL is required");
      return;
    }

    // Validate URL format
    if (url.startsWith("file://")) {
      setError(
        "Local file URLs (file://) are not allowed for security reasons. " +
        "Please use an HTTP or HTTPS URL."
      );
      return;
    }

    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      setError("URL must start with http:// or https://");
      return;
    }

    try {
      setAddingDocument(transactionId);
      setError("");

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }

      const response = await fetch(`${API_URL}/documents`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          transactionId,
          fileUrl: documentUrl.trim(),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to add document");
      }

      // Reset form and reload documents
      setDocumentUrl("");
      setAddingDocument(null);
      const updatedDocs = await loadDocuments(transactionId, session.access_token);
      setDocuments((prev) => ({ ...prev, [transactionId]: updatedDocs }));
    } catch (err: any) {
      setError(err.message || "Failed to add document");
    } finally {
      setAddingDocument(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) {
      setError("No tenant selected");
      return;
    }

    try {
      setSubmitting(true);
      setError("");

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }

      const amount = parseFloat(formAmount);
      if (isNaN(amount) || amount <= 0) {
        setError("Amount must be a positive number");
        setSubmitting(false);
        return;
      }

      const response = await fetch(`${API_URL}/transactions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          tenantId,
          type: formType,
          amount,
          description: formDescription,
          date: formDate,
          category: formCategory.trim(),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create transaction");
      }

      // Reset form
      setFormAmount("");
      setFormDescription("");
      setFormCategory("");
      setFormDate(new Date().toISOString().split("T")[0]);
      setFormType("income");

      // Reset form
      setFormAmount("");
      setFormDescription("");
      setFormCategory("");
      setFormDate(new Date().toISOString().split("T")[0]);
      setFormType("income");

      // Reload transactions
      await loadTransactions(tenantId, session.access_token);
    } catch (err: any) {
      setError(err.message || "Failed to create transaction");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="container" style={{ maxWidth: 1200 }}>
      <h1 style={{ marginBottom: "24px", fontSize: "32px", color: "var(--foreground)" }}>
        Transactions
      </h1>

      {error && (
        <div className="alert alert-error">
          <div style={{ marginBottom: "12px" }}>{error}</div>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <button
              onClick={reloadData}
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? "Reloading..." : "🔄 Reload"}
            </button>
            <a 
              href="/tenants" 
              className="btn btn-secondary"
              style={{ 
                textDecoration: "none",
                display: "inline-block"
              }}
            >
              Go to Tenants Page
            </a>
          </div>
        </div>
      )}

      {!tenantId ? (
        <div className="card">
          <p style={{ marginBottom: "16px", color: "#6c757d" }}>
            Please select a tenant from the <a href="/tenants" className="text-link">Tenants</a> page.
          </p>
          <a 
            href="/tenants" 
            className="btn btn-primary"
            style={{ textDecoration: "none", display: "inline-block" }}
          >
            Select a Tenant
          </a>
        </div>
      ) : (
        <>
          {userRole === "read" && (
            <div className="alert alert-warning">
              <strong>⚠️ Read-Only Access:</strong> You can view transactions but cannot create or modify them.
            </div>
          )}

          {userRole === "write" && (
            <div className="card" style={{ marginBottom: "32px" }}>
              <h2 style={{ marginBottom: "20px", fontSize: "20px", color: "var(--foreground)" }}>
                Add Transaction
              </h2>
              <form onSubmit={handleSubmit}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
                  <div>
                    <label className="label">Type</label>
                    <select
                      className="input"
                      value={formType}
                      onChange={(e) =>
                        setFormType(e.target.value as "income" | "expense")
                      }
                    >
                      <option value="income">Income</option>
                      <option value="expense">Expense</option>
                    </select>
                  </div>

                  <div>
                    <label className="label">Date</label>
                    <input
                      className="input"
                      type="date"
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div style={{ marginBottom: "16px" }}>
                  <label className="label">Amount</label>
                  <input
                    className="input"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    required
                    placeholder="0.00"
                  />
                </div>

                <div style={{ marginBottom: "16px" }}>
                  <label className="label">Description</label>
                  <input
                    className="input"
                    type="text"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    required
                    placeholder="Transaction description"
                  />
                </div>

                <div style={{ marginBottom: "20px" }}>
                  <label className="label">Category</label>
                  <input
                    className="input"
                    type="text"
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    placeholder="e.g., Food, Transport, Salary"
                    required
                  />
                </div>

                <div style={{ display: "flex", gap: "12px" }}>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn btn-primary"
                    style={{ flex: 1 }}
                  >
                    {submitting ? "Creating..." : "Create Transaction"}
                  </button>
                </div>
            </form>
            </div>
          )}

          <div className="card">
            <h2 style={{ marginBottom: "20px", fontSize: "20px", color: "var(--foreground)" }}>
              Transaction List
            </h2>
            {transactions.length === 0 ? (
              <p style={{ color: "#6c757d", textAlign: "center", padding: "40px" }}>
                No transactions found. {userRole === "write" && "Create your first transaction above."}
              </p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th style={{ textAlign: "right" }}>Amount</th>
                      <th>Description</th>
                      <th>Category</th>
                      <th>Documents</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx) => (
                      <React.Fragment key={tx.id}>
                        <tr
                          style={{
                            backgroundColor:
                              tx.type === "income" ? "var(--income-bg)" : "var(--expense-bg)",
                          }}
                        >
                        <td>{tx.date}</td>
                        <td>
                          <span
                            style={{
                              display: "inline-block",
                              padding: "4px 8px",
                              borderRadius: "4px",
                              fontSize: "12px",
                              fontWeight: "500",
                              backgroundColor:
                                tx.type === "income" ? "var(--income-color)" : "var(--expense-color)",
                              color: "white",
                            }}
                          >
                            {tx.type === "income" ? "💰 Income" : "💸 Expense"}
                          </span>
                        </td>
                        <td style={{ textAlign: "right", fontWeight: "600" }}>
                          {tx.amount.toFixed(2)}
                        </td>
                        <td>{tx.description}</td>
                        <td>
                          <span className="badge badge-primary">{tx.category}</span>
                        </td>
                        <td>
                          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            {/* Documents list */}
                            {documents[tx.id] && documents[tx.id].length > 0 && (
                              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                {documents[tx.id].map((doc) => (
                                  <a
                                    key={doc.id}
                                    href={doc.file_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                      color: "var(--primary-color)",
                                      textDecoration: "none",
                                      fontSize: "12px",
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "4px",
                                      padding: "4px 8px",
                                      backgroundColor: "#f8f9fa",
                                      borderRadius: "4px",
                                      border: "1px solid var(--border-color)",
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.backgroundColor = "#e9ecef";
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.backgroundColor = "#f8f9fa";
                                    }}
                                  >
                                    <span>📄</span>
                                    <span style={{ 
                                      maxWidth: "200px", 
                                      overflow: "hidden", 
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap"
                                    }}>
                                      {doc.file_url}
                                    </span>
                                  </a>
                                ))}
                              </div>
                            )}
                            
                            {/* Add document form - only for write role */}
                            {userRole === "write" && (
                              <div>
                                {addingDocument === tx.id ? (
                                  <div style={{ display: "flex", gap: "4px", flexDirection: "column" }}>
                                    <input
                                      className="input"
                                      type="url"
                                      value={documentUrl}
                                      onChange={(e) => setDocumentUrl(e.target.value)}
                                      placeholder="https://example.com/doc.pdf"
                                      style={{ fontSize: "11px", padding: "4px 8px" }}
                                      onKeyPress={(e) => {
                                        if (e.key === "Enter") {
                                          e.preventDefault();
                                          handleAddDocument(tx.id);
                                        }
                                      }}
                                    />
                                    <div style={{ display: "flex", gap: "4px" }}>
                                      <button
                                        onClick={() => handleAddDocument(tx.id)}
                                        disabled={!documentUrl.trim()}
                                        className="btn btn-primary"
                                        style={{ 
                                          fontSize: "11px",
                                          padding: "4px 8px",
                                          flex: 1
                                        }}
                                      >
                                        Add
                                      </button>
                                      <button
                                        onClick={() => {
                                          setAddingDocument(null);
                                          setDocumentUrl("");
                                        }}
                                        className="btn btn-secondary"
                                        style={{ 
                                          fontSize: "11px",
                                          padding: "4px 8px"
                                        }}
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => {
                                      setAddingDocument(tx.id);
                                      setDocumentUrl("");
                                    }}
                                    className="btn btn-secondary"
                                    style={{ 
                                      fontSize: "11px",
                                      padding: "4px 8px",
                                      whiteSpace: "nowrap"
                                    }}
                                    title="Add document"
                                  >
                                    📎 Add Doc
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </main>
  );
}

