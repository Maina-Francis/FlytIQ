import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Bell, Mail, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatPrice, getCurrency } from "@/lib/currency";
import { trackPriceAlertCreated } from "@/lib/analytics";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  origin: string;
  destination: string;
  currency: string;
  currentPriceUsd: number;
};

export function AlertModal({
  open,
  onOpenChange,
  origin,
  destination,
  currency,
  currentPriceUsd,
}: Props) {
  const [signedIn, setSignedIn] = useState(false);
  const [targetPrice, setTargetPrice] = useState("");
  const [channel, setChannel] = useState<"email" | "telegram">("email");
  const [email, setEmail] = useState("");
  const [telegramChatId, setTelegramChatId] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setSignedIn(!!session);
        if (session?.user?.email) setEmail(session.user.email);
      });
      const suggested = Math.round(
        (currentPriceUsd * 0.85 * getCurrency(currency).rate * 100) / 100,
      );
      setTargetPrice(String(suggested));
    }
  }, [open, currentPriceUsd, currency]);

  async function handleCreate() {
    const priceNum = Number(targetPrice);
    if (!priceNum || priceNum <= 0) {
      toast.error("Please enter a valid target price.");
      return;
    }
    if (channel === "email" && !email) {
      toast.error("Please enter your email address.");
      return;
    }
    if (channel === "telegram" && !telegramChatId) {
      toast.error("Please enter your Telegram chat ID.");
      return;
    }

    setLoading(true);
    const targetUsd = Math.round((priceNum / getCurrency(currency).rate) * 100) / 100;

    const { error } = await supabase.from("price_alerts").insert({
      origin,
      destination,
      route_label: `${origin} → ${destination}`,
      target_price_usd: targetUsd,
      channel,
      email: channel === "email" ? email : null,
      telegram_chat_id: channel === "telegram" ? telegramChatId : null,
    });

    setLoading(false);

    if (error) {
      toast.error("Could not create alert. Please try again.");
      return;
    }

    trackPriceAlertCreated({
      route: `${origin} → ${destination}`,
      target_price: targetUsd,
      channel,
    });

    toast.success("Price alert created! We'll notify you when the fare drops.");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Create Price Alert
          </DialogTitle>
          <DialogDescription>
            Get notified when {origin} → {destination} drops below your target price.
          </DialogDescription>
        </DialogHeader>

        {!signedIn ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/30 p-4 text-center">
              <p className="text-sm text-muted-foreground">
                You need to sign in to track price alerts. Your alerts are saved to your account and
                can be managed anytime.
              </p>
              <Button asChild className="mt-3">
                <Link to="/deals">Sign in to track deals</Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Current best fare</span>
                <span className="font-semibold">{formatPrice(currentPriceUsd, currency)}</span>
              </div>
            </div>

            <div>
              <Label htmlFor="target-price">Target price ({currency})</Label>
              <Input
                id="target-price"
                type="number"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                className="mt-1"
                placeholder="Enter target price"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                We'll alert you when the price drops below this amount.
              </p>
            </div>

            <div>
              <Label>Notification channel</Label>
              <RadioGroup
                value={channel}
                onValueChange={(v) => setChannel(v as "email" | "telegram")}
                className="mt-2 flex gap-4"
              >
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-input px-3 py-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                  <RadioGroupItem value="email" />
                  <Mail className="h-4 w-4" />
                  Email
                </label>
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-input px-3 py-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                  <RadioGroupItem value="telegram" />
                  <Send className="h-4 w-4" />
                  Telegram
                </label>
              </RadioGroup>
            </div>

            {channel === "email" ? (
              <div>
                <Label htmlFor="alert-email">Email address</Label>
                <Input
                  id="alert-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1"
                  placeholder="you@example.com"
                />
              </div>
            ) : (
              <div>
                <Label htmlFor="telegram-id">Telegram chat ID</Label>
                <Input
                  id="telegram-id"
                  type="text"
                  value={telegramChatId}
                  onChange={(e) => setTelegramChatId(e.target.value)}
                  className="mt-1"
                  placeholder="e.g. 123456789"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Message @userinfobot on Telegram to get your chat ID.
                </p>
              </div>
            )}

            <Button onClick={handleCreate} disabled={loading} className="w-full glow-cta">
              {loading ? "Creating..." : "Create Alert"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
