import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Trash2, Bell, Mail, Send, Plane, LogOut, Plus } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useThemeStore } from "@/lib/store";
import { initAnalytics, trackPageView } from "@/lib/analytics";
import { formatPrice } from "@/lib/currency";
import { useCurrencyStore } from "@/lib/store";
import { toast } from "sonner";

export const Route = createFileRoute("/deals")({
  head: () => ({
    meta: [
      { title: "My Tracked Deals — FlightIQ" },
      {
        name: "description",
        content: "View and manage your flight price alerts.",
      },
    ],
  }),
  component: DealsPage,
});

type Alert = {
  id: string;
  origin: string;
  destination: string;
  route_label: string;
  target_price_usd: number;
  channel: "email" | "telegram";
  email: string | null;
  telegram_chat_id: string | null;
  last_price_usd: number | null;
  is_active: boolean;
  created_at: string;
};

function DealsPage() {
  const { hydrate: hydrateTheme } = useThemeStore();
  const { currency } = useCurrencyStore();
  const [session, setSession] = useState<null | { user: { email?: string } }>(null);
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<Alert[]>([]);

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const loadAlerts = useCallback(async () => {
    const { data, error } = await supabase
      .from("price_alerts")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Could not load your alerts.");
      return;
    }
    setAlerts((data ?? []) as Alert[]);
  }, []);

  useEffect(() => {
    hydrateTheme();
    initAnalytics();
    trackPageView("/deals");

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      if (session) loadAlerts();
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        setSession(session);
        if (session) {
          await loadAlerts();
        } else {
          setAlerts([]);
        }
      })();
    });

    return () => listener.subscription.unsubscribe();
  }, [hydrateTheme, loadAlerts]);

  async function handleAuth() {
    if (!email || !password) {
      toast.error("Please enter your email and password.");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }

    setAuthLoading(true);
    const { error } =
      mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    setAuthLoading(false);

    if (error) {
      toast.error(
        mode === "signin"
          ? "Invalid email or password. Please try again."
          : "Could not create account. " + error.message,
      );
      return;
    }

    if (mode === "signup") {
      toast.success("Account created! You're now signed in.");
    }
    setEmail("");
    setPassword("");
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from("price_alerts").update({ is_active: false }).eq("id", id);
    if (error) {
      toast.error("Could not delete alert.");
      return;
    }
    setAlerts((prev) => prev.filter((a) => a.id !== id));
    toast.success("Alert removed.");
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    setAlerts([]);
    toast.success("Signed out.");
  }

  if (loading) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="flex items-center justify-center py-20">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="mx-auto flex max-w-md flex-col items-center px-4 py-16">
          <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent shadow-lg">
            <Bell className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Track Your Flight Deals</h1>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Sign in to save price alerts and get notified when fares drop.
          </p>

          <Card className="mt-8 w-full">
            <CardHeader>
              <CardTitle>{mode === "signin" ? "Welcome Back" : "Create Account"}</CardTitle>
              <CardDescription>
                {mode === "signin"
                  ? "Sign in to manage your tracked deals."
                  : "Create an account to start tracking flights."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1"
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1"
                  placeholder="At least 6 characters"
                />
              </div>
              <Button onClick={handleAuth} disabled={authLoading} className="w-full glow-cta">
                {authLoading ? "Please wait..." : mode === "signin" ? "Sign In" : "Create Account"}
              </Button>
              <Separator />
              <button
                onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
                className="w-full text-center text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {mode === "signin"
                  ? "Don't have an account? Sign up"
                  : "Already have an account? Sign in"}
              </button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">My Tracked Deals</h1>
            <p className="text-sm text-muted-foreground">Signed in as {session.user.email}</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleSignOut}>
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>

        {alerts.length === 0 ? (
          <div className="glass-panel rounded-xl p-10 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <Bell className="h-6 w-6 text-primary" />
            </div>
            <h2 className="font-semibold text-foreground">No alerts yet</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Search for flights and click "Track" to create your first price alert.
            </p>
            <Button asChild className="mt-4">
              <Link to="/">
                <Plus className="h-4 w-4" />
                Search Flights
              </Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div key={alert.id} className="glass-panel rounded-xl p-4 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Plane className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{alert.route_label}</p>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                        {alert.channel === "email" ? (
                          <>
                            <Mail className="h-3 w-3" />
                            {alert.email}
                          </>
                        ) : (
                          <>
                            <Send className="h-3 w-3" />
                            Telegram
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Target price</p>
                      <p className="font-bold text-foreground">
                        {formatPrice(alert.target_price_usd, currency)}
                      </p>
                      {alert.last_price_usd && (
                        <p className="text-xs text-muted-foreground">
                          Last: {formatPrice(alert.last_price_usd, currency)}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(alert.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
