"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

interface Tenant {
  id: string;
  name: string;
}

interface TenantWithRole extends Tenant {
  role?: "read" | "write";
}

export default function TenantsPage() {
  const router = useRouter();
  const [tenants, setTenants] = useState<TenantWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [newTenantName, setNewTenantName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    checkAuthAndLoadTenants();
    // Load selected tenant from localStorage
    const stored = localStorage.getItem("selectedTenantId");
    if (stored) {
      setSelectedTenantId(stored);
    }
  }, []);

  const checkAuthAndLoadTenants = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }

      await loadTenants();
    } catch (err) {
      setError("Failed to check authentication");
      setLoading(false);
    }
  };

  const loadTenants = async () => {
    try {
      setLoading(true);
      setError("");
      
      // Load tenants with user role
      const { data: tenantsData, error: tenantsError } = await supabase
        .from("tenants")
        .select("id, name");

      if (tenantsError) {
        console.error("Supabase error loading tenants:", tenantsError);
        if (
          tenantsError.code === "42501" || 
          tenantsError.code === "PGRST116" ||
          tenantsError.message?.includes("permission") || 
          tenantsError.message?.includes("policy") ||
          tenantsError.message?.includes("row-level security") ||
          tenantsError.status === 500
        ) {
          setTenants([]);
          setError("You are not a member of any tenant yet. Create one below.");
          return;
        }
        throw tenantsError;
      }

      // Load user roles for each tenant
      const { data: { user } } = await supabase.auth.getUser();
      if (user && tenantsData) {
        const { data: rolesData } = await supabase
          .from("tenant_users")
          .select("tenant_id, role")
          .eq("user_id", user.id);

        const rolesMap = new Map(
          rolesData?.map((r) => [r.tenant_id, r.role]) || []
        );

        const tenantsWithRoles: TenantWithRole[] = tenantsData.map((tenant) => ({
          ...tenant,
          role: rolesMap.get(tenant.id) as "read" | "write" | undefined,
        }));

        setTenants(tenantsWithRoles);
      } else {
        setTenants(tenantsData || []);
      }
    } catch (err: any) {
      console.error("Error loading tenants:", err);
      if (
        err.code === "42501" || 
        err.code === "PGRST116" ||
        err.message?.includes("permission") || 
        err.message?.includes("policy") ||
        err.message?.includes("row-level security") ||
        err.status === 500
      ) {
        setTenants([]);
        setError("You are not a member of any tenant yet. Create one below.");
      } else {
        setError(err.message || "Failed to load tenants. Please check your connection and try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const createTenant = async () => {
    if (!newTenantName.trim()) {
      setError("Tenant name is required");
      return;
    }

    try {
      setCreating(true);
      setError("");

      // Call the RPC function
      const { data, error } = await supabase.rpc("create_tenant_and_join", {
        tenant_name: newTenantName.trim(),
      });

      if (error) {
        if (error.message.includes("function") || error.code === "42883") {
          setError(
            "RPC function not found. Please run the SQL from database_setup.sql in your Supabase SQL Editor."
          );
        } else {
          throw error;
        }
        return;
      }

      // Success - reload tenants and select the new one
      setNewTenantName("");
      await loadTenants();
      if (data) {
        setSelectedTenantId(data);
        localStorage.setItem("selectedTenantId", data);
      }
    } catch (err: any) {
      setError(err.message || "Failed to create tenant");
    } finally {
      setCreating(false);
    }
  };

  const handleSelectTenant = (tenantId: string) => {
    setSelectedTenantId(tenantId);
    localStorage.setItem("selectedTenantId", tenantId);
    setError("");
  };

  return (
    <main className="container" style={{ maxWidth: 900 }}>
      <h1 style={{ marginBottom: "24px", fontSize: "32px", color: "var(--foreground)" }}>
        Tenants
      </h1>

      {error && (
        <div className={error.includes("not found") ? "alert alert-warning" : "alert alert-error"}>
          {error}
        </div>
      )}

      <div className="card" style={{ marginBottom: "24px" }}>
        <h2 style={{ marginBottom: "20px", fontSize: "20px", color: "var(--foreground)" }}>
          Create New Tenant
        </h2>
        <div style={{ display: "flex", gap: "12px" }}>
          <input
            className="input"
            type="text"
            value={newTenantName}
            onChange={(e) => setNewTenantName(e.target.value)}
            placeholder="Enter tenant name"
            style={{ flex: 1, maxWidth: "400px" }}
            onKeyPress={(e) => e.key === "Enter" && createTenant()}
          />
          <button
            onClick={createTenant}
            disabled={creating}
            className="btn btn-primary"
          >
            {creating ? "Creating..." : "Create Tenant"}
          </button>
        </div>
      </div>

      <div className="card">
        <h2 style={{ marginBottom: "20px", fontSize: "20px", color: "var(--foreground)" }}>
          Your Tenants
        </h2>
        {tenants.length === 0 ? (
          <p style={{ color: "#6c757d", textAlign: "center", padding: "40px" }}>
            No tenants found. Create one above.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {tenants.map((tenant) => (
              <div
                key={tenant.id}
                className="card"
                style={{
                  backgroundColor:
                    selectedTenantId === tenant.id ? "#e7f3ff" : "white",
                  border:
                    selectedTenantId === tenant.id
                      ? "2px solid var(--primary-color)"
                      : "1px solid var(--border-color)",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  marginBottom: 0,
                }}
                onClick={() => handleSelectTenant(tenant.id)}
                onMouseEnter={(e) => {
                  if (selectedTenantId !== tenant.id) {
                    e.currentTarget.style.backgroundColor = "#f8f9fa";
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedTenantId !== tenant.id) {
                    e.currentTarget.style.backgroundColor = "white";
                  }
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                  <strong style={{ fontSize: "16px", color: "var(--foreground)" }}>
                    {tenant.name}
                  </strong>
                  {tenant.role && (
                    <span className={tenant.role === "write" ? "badge badge-success" : "badge badge-warning"}>
                      {tenant.role === "write" ? "✏️ Write" : "👁️ Read"}
                    </span>
                  )}
                  {selectedTenantId === tenant.id && (
                    <span
                      style={{
                        marginLeft: "auto",
                        color: "var(--primary-color)",
                        fontWeight: "600",
                        fontSize: "14px",
                      }}
                    >
                      ✓ Selected
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
