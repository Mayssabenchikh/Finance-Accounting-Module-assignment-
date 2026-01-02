"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLogin) {
      await signIn();
    } else {
      await signUp();
    }
  };

  const signUp = async () => {
    setLoading(true);
    setMsg("");
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setMsg(error.message);
    } else {
      setMsg("Signup successful! Please check your email to verify your account.");
    }
    setLoading(false);
  };

  const signIn = async () => {
    setLoading(true);
    setMsg("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setMsg(error.message);
      setLoading(false);
    } else {
      setMsg("Login successful! Redirecting...");
      setTimeout(() => {
        router.push("/tenants");
      }, 1000);
    }
  };

  return (
    <main className="auth-page">
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <h1 className="auth-title">
              {isLogin ? "Welcome Back" : "Create Account"}
            </h1>
            <p className="auth-subtitle">
              {isLogin 
                ? "Sign in to access your finance dashboard" 
                : "Start managing your finances today"}
            </p>
          </div>

          <div className="auth-tabs">
            <button
              onClick={() => {
                setIsLogin(true);
                setMsg("");
              }}
              className={`auth-tab ${isLogin ? "auth-tab-active" : ""}`}
            >
              Login
            </button>
            <button
              onClick={() => {
                setIsLogin(false);
                setMsg("");
              }}
              className={`auth-tab ${!isLogin ? "auth-tab-active" : ""}`}
            >
              Sign Up
            </button>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="auth-field">
              <label className="auth-label">Email Address</label>
              <input
                className="auth-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@example.com"
                type="email"
                required
                disabled={loading}
              />
            </div>

            <div className="auth-field">
              <label className="auth-label">Password</label>
              <input
                className="auth-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                placeholder={isLogin ? "Enter your password" : "Enter your password (min. 6 characters)"}
                required
                disabled={loading}
                minLength={isLogin ? undefined : 6}
              />
            </div>

            <button 
              type="submit" 
              className="auth-submit-btn"
              disabled={loading}
            >
              {loading ? "Processing..." : isLogin ? "Sign In" : "Create Account"}
            </button>
          </form>

          {msg && (
            <div
              className={`auth-message ${
                msg.includes("successful") || msg.includes("Redirecting")
                  ? "auth-message-success"
                  : "auth-message-error"
              }`}
            >
              {msg}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
