import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { supabase } from "../../config/supabaseClient";
import { updateSubscription } from "../../store/slices/dealerSlice";
import { Card, CardBody, Button, Divider, Chip } from "@heroui/react";
import { Check, ShieldCheck, Zap, Lock } from "lucide-react";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";

export default function PaymentStep() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [searchParams] = useSearchParams();
  const { user } = useSelector((state) => state.auth);

  // State
  const [selectedPlan, setSelectedPlan] = useState("free");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // 1. Initialize selection from URL
  useEffect(() => {
    const planFromUrl = searchParams.get("plan");
    if (planFromUrl === "pro" || planFromUrl === "enterprise") {
      setSelectedPlan("pro");
    }
  }, [searchParams]);

  // 2. Complete Free Tier Onboarding
  const handleFreeActivation = async () => {
    setLoading(true);
    try {
      let activeUserId = user?.id;
      if (!activeUserId) {
        const { data: { session } } = await supabase.auth.getSession();
        activeUserId = session?.user?.id;
      }

      if (activeUserId) {
        await supabase
          .from("dealers")
          .update({ subscription_tier: "free" })
          .eq("id", activeUserId);
      }
      dispatch(updateSubscription("free"));
      navigate("/onboarding/branding");
    } catch (error) {
      console.error("Free plan activation failed:", error);
      navigate("/onboarding/branding");
    } finally {
      setLoading(false);
    }
  };

  // 3. Handle PayPal Pro Subscription Approval
  const handlePayPalApprove = async (data, actions) => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const details = await actions.order.capture();

      // Ensure active user ID
      let activeUserId = user?.id;
      if (!activeUserId) {
        const { data: { session } } = await supabase.auth.getSession();
        activeUserId = session?.user?.id;
      }

      // Update Database
      if (activeUserId) {
        const { error } = await supabase
          .from("dealers")
          .update({ subscription_tier: "pro" })
          .eq("id", activeUserId);

        if (error) {
          console.warn("Could not update dealer subscription in DB:", error);
        }
      }

      // Update Redux State
      dispatch(updateSubscription("pro"));

      // Next Step
      navigate("/onboarding/branding");
    } catch (error) {
      console.error("PayPal Subscription processing failed:", error);
      setErrorMessage("PayPal transaction authorization failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-lg mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Select your plan</h2>
        <p className="text-default-500">Upgrade anytime as your dealership grows.</p>
      </div>

      {/* --- PLAN SELECTOR --- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* FREE CARD */}
        <Card
          isPressable
          onPress={() => setSelectedPlan("free")}
          className={`border-2 transition-all ${
            selectedPlan === "free"
              ? "border-primary bg-primary/5"
              : "border-transparent hover:border-default-300"
          }`}
          shadow="sm"
        >
          <CardBody className="p-6">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-2">
                <ShieldCheck
                  className={`size-5 ${selectedPlan === "free" ? "text-primary" : "text-default-400"}`}
                />
                <span className="font-semibold text-large">Starter</span>
              </div>
              {selectedPlan === "free" && (
                <Check className="size-5 text-primary" />
              )}
            </div>
            <div className="mb-4">
              <span className="text-3xl font-bold">$0</span>
              <span className="text-small text-default-500"> /mo</span>
            </div>
            <ul className="space-y-2">
              <li className="text-small text-default-500 flex items-center gap-2">
                <div className="size-1.5 rounded-full bg-default-400" /> 1 Active Story
              </li>
              <li className="text-small text-default-500 flex items-center gap-2">
                <div className="size-1.5 rounded-full bg-default-400" /> Standard Res
              </li>
              <li className="text-small text-default-500 flex items-center gap-2">
                <div className="size-1.5 rounded-full bg-default-400" /> Watermarked
              </li>
            </ul>
          </CardBody>
        </Card>

        {/* PRO CARD */}
        <div className="relative">
          {selectedPlan === "pro" && (
            <Chip
              color="primary"
              size="sm"
              className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 font-bold uppercase tracking-wider shadow-md"
            >
              Recommended
            </Chip>
          )}

          <Card
            isPressable
            onPress={() => setSelectedPlan("pro")}
            className={`border-2 transition-all w-full ${
              selectedPlan === "pro"
                ? "border-primary bg-primary/5"
                : "border-transparent hover:border-default-300"
            }`}
            shadow="sm"
          >
            <CardBody className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2">
                  <Zap
                    className={`size-5 ${selectedPlan === "pro" ? "text-primary" : "text-default-400"}`}
                  />
                  <span className="font-semibold text-large">Pro Dealer</span>
                </div>
                {selectedPlan === "pro" && (
                  <Check className="size-5 text-primary" />
                )}
              </div>
              <div className="mb-4">
                <span className="text-3xl font-bold">$49</span>
                <span className="text-small text-default-500"> /mo</span>
              </div>
              <ul className="space-y-2">
                <li className="text-small text-default-500 flex items-center gap-2">
                  <div className="size-1.5 rounded-full bg-primary" /> Unlimited Stories
                </li>
                <li className="text-small text-default-500 flex items-center gap-2">
                  <div className="size-1.5 rounded-full bg-primary" /> 360° Car Interior
                </li>
                <li className="text-small text-default-500 flex items-center gap-2">
                  <div className="size-1.5 rounded-full bg-primary" /> White-label Branding
                </li>
              </ul>
            </CardBody>
          </Card>
        </div>
      </div>

      <Divider />

      {/* --- BILLING SECTION --- */}
      <div className="min-h-[160px]">
        {selectedPlan === "free" ? (
          <div className="bg-default-50 border border-default-200 p-6 rounded-large flex flex-col items-center justify-center text-center h-full animate-in fade-in">
            <div className="p-3 bg-success-50 rounded-full text-success mb-3">
              <ShieldCheck className="size-6" />
            </div>
            <p className="font-medium text-foreground">No payment required</p>
            <p className="text-small text-default-500 mt-1">
              You can upgrade to Pro Dealer at any time from your dashboard settings.
            </p>
            <Button
              onPress={handleFreeActivation}
              isLoading={loading}
              color="default"
              variant="flat"
              size="lg"
              fullWidth
              className="mt-5 font-semibold"
            >
              Continue for Free
            </Button>
          </div>
        ) : (
          /* PRO BILLING: PayPal Checkout & Subscription */
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 bg-default-50 border border-default-200 p-6 rounded-large">
            <div className="flex items-center justify-between border-b border-default-200 pb-3">
              <div>
                <h3 className="font-semibold text-small uppercase tracking-wide text-default-700 flex items-center gap-1.5">
                  <Lock className="size-4 text-primary" /> Secure Checkout
                </h3>
                <p className="text-xs text-default-500 mt-0.5">
                  Pro Dealer Membership ($49.00 / month)
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs text-default-400 block">Total Due Today</span>
                <span className="text-lg font-bold text-primary">$49.00 USD</span>
              </div>
            </div>

            {errorMessage && (
              <div className="p-3 rounded-lg bg-danger-50 border border-danger-200 text-danger text-xs">
                {errorMessage}
              </div>
            )}

            <div className="pt-2">
              <PayPalScriptProvider
                options={{
                  clientId: import.meta.env.VITE_PAYPAL_CLIENT_ID || "test",
                  currency: "USD",
                  intent: "capture",
                }}
              >
                <PayPalButtons
                  style={{
                    layout: "vertical",
                    shape: "pill",
                    color: "gold",
                    height: 44,
                    label: "subscribe",
                  }}
                  createOrder={(data, actions) => {
                    return actions.order.create({
                      purchase_units: [
                        {
                          description: "Revv OS Pro Dealer Monthly Subscription",
                          amount: {
                            currency_code: "USD",
                            value: "49.00",
                          },
                        },
                      ],
                    });
                  }}
                  onApprove={handlePayPalApprove}
                  onError={(err) => {
                    console.error("PayPal Error:", err);
                    setErrorMessage("Unable to open PayPal Checkout. Please try again.");
                  }}
                />
              </PayPalScriptProvider>
            </div>

            <p className="text-[11px] text-default-400 text-center leading-relaxed">
              Protected by PayPal Buyer & Merchant Protection. You can cancel anytime directly from your PayPal account settings.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
