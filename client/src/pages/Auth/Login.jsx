import React, { useState } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { supabase } from "../../config/supabaseClient";
import { Input, Button, Link } from "@heroui/react";
import {
  Mail,
  Lock,
  ArrowRight,
  AlertCircle,
  Eye,
  EyeOff,
  ShieldCheck, // <--- New icon for the header
} from "lucide-react";

export default function Login() {
  const navigate = useNavigate();

  // State
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [isVisible, setIsVisible] = useState(false);

  const toggleVisibility = () => setIsVisible(!isVisible);

  const handleLogin = async (e, overrides = {}) => {
    if (e?.preventDefault) e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const loginEmail = overrides.email || email;
      const loginPassword = overrides.password || password;
      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      });

      if (error) throw error;

      navigate("/dashboard");
    } catch (err) {
      if (err?.message?.toLowerCase().includes("email not confirmed")) {
        setError("Your email address has not been confirmed yet. Please check your inbox for the verification link.");
      } else {
        setError("Invalid email or password. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2 text-center">
        <h2 className="text-3xl font-semibold tracking-tight text-zinc-900">
          Sign in to your account
        </h2>
        <p className="text-sm text-zinc-500">
          Enter your details below to access your dealership dashboard
        </p>
      </div>

      <form onSubmit={handleLogin} className="space-y-6">
        {/* Error Alert */}
        {error && (
          <div className="bg-red-50 border border-red-200 p-3.5 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-top-1 duration-300">
            <AlertCircle className="size-4 text-red-600 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 font-medium">{error}</p>
          </div>
        )}

        <div className="space-y-4 pt-0.5">
          <Input
            isRequired
            type="email"
            label="Email Address"
            placeholder="name@dealership.com"
            variant="bordered"
            labelPlacement="outside"
            size="lg"
            classNames={{
              label: "text-sm font-medium text-zinc-700 mb-1.5",
              input: "text-sm",
              inputWrapper:
                "border-zinc-200 hover:border-zinc-300 focus-within:border-zinc-800 data-[hover=true]:border-zinc-300 group-data-[focus=true]:border-zinc-800 transition-colors",
            }}
            startContent={
              <Mail className="size-4 text-zinc-400 pointer-events-none shrink-0" />
            }
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <div className="space-y-2 p-0.5">
            <Input
              isRequired
              label="Password"
              placeholder="Enter your password"
              variant="bordered"
              labelPlacement="outside"
              size="lg"
              classNames={{
                label: "text-sm font-medium text-zinc-700 mb-1.5 ",
                input: "text-sm",
                inputWrapper:
                  "border-zinc-200 hover:border-zinc-300 focus-within:border-zinc-800 data-[hover=true]:border-zinc-300 group-data-[focus=true]:border-zinc-800 transition-colors",
              }}
              startContent={
                <Lock className="size-4 text-zinc-400 pointer-events-none shrink-0" />
              }
              endContent={
                <button
                  className="focus:outline-none hover:opacity-70 transition-opacity"
                  type="button"
                  onClick={toggleVisibility}
                  aria-label="Toggle password visibility"
                >
                  {isVisible ? (
                    <EyeOff className="size-4 text-zinc-400" />
                  ) : (
                    <Eye className="size-4 text-zinc-400" />
                  )}
                </button>
              }
              type={isVisible ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {/* Kept minimal, removed "forgot password" as judges won't need it */}
          </div>
        </div>

        <Button
          type="submit"
          fullWidth
          size="lg"
          isLoading={loading}
          endContent={!loading && <ArrowRight className="size-4" />}
          className="bg-zinc-900 text-white font-semibold hover:bg-zinc-800 shadow-sm transition-colors mt-2"
        >
          {loading ? "Signing In..." : "Sign In"}
        </Button>

        <p className="text-center text-sm text-zinc-500 pt-2">
          Don't have an account?{" "}
          <RouterLink
            to="/register"
            className="font-semibold text-zinc-900 hover:underline"
          >
            Sign up
          </RouterLink>
        </p>
      </form>
    </div>
  );
}
